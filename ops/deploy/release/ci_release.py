"""Download a reviewed release asset, pin its bytes, and verify the tagged source.

GitHub CLI is required only on the disposable GitHub-hosted runner. This program
does not publish releases, alter repository settings or contact WordPress.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

from release import (REPOSITORY, ReleaseError, check_declaration, extract_verified,
                     inspect_archive, load_json, require, valid_tag, verify_source)


def command(args):
    result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", timeout=120)
    require(result.returncode == 0, "Git/GitHub read failed; release admission stopped")
    return result.stdout.strip()


def verify_repository_policy():
    branch = json.loads(command(["gh", "api", f"repos/{REPOSITORY}/branches/main"]))
    require(branch.get("protected") is True, "main branch protection is required before deployment")
    rulesets = json.loads(command(["gh", "api", f"repos/{REPOSITORY}/rulesets"]))
    for summary in rulesets:
        if summary.get("target") != "tag" or summary.get("enforcement") != "active":
            continue
        identifier = summary.get("id")
        require(type(identifier) is int and identifier > 0, "invalid ruleset identifier")
        ruleset = json.loads(command(["gh", "api", f"repos/{REPOSITORY}/rulesets/{identifier}"]))
        ref = ruleset.get("conditions", {}).get("ref_name", {})
        includes, excludes = ref.get("include", []), ref.get("exclude", [])
        types = {rule.get("type") for rule in ruleset.get("rules", [])}
        if not excludes and ("refs/tags/setae-v*" in includes or "~ALL" in includes) and {"creation", "update", "deletion"}.issubset(types):
            return
    raise ReleaseError("an active release-tag ruleset limiting creation/update/deletion is required")


def prepare_test_workspace(artifact, repository, destination):
    """The existing root-app suite needs an actual adjacent theme; never skip it."""
    repository, destination = Path(repository), Path(destination)
    require(not destination.exists(), "test workspace already exists")
    theme = repository / "themes/setae-theme"
    require(theme.is_dir() and not theme.is_symlink(), "the tagged theme is required by the plugin integration unit suite")
    for file in theme.rglob("*"):
        require(not file.is_symlink() and file.resolve().is_relative_to(theme.resolve()), "linked theme test dependency")
    extract_verified(artifact, destination / "wp-content/plugins")
    shutil.copytree(theme, destination / "wp-content/themes/setae-theme")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--directory", required=True)
    parser.add_argument("--extract")
    parser.add_argument("--expected-commit")
    args = parser.parse_args(argv)
    tag = valid_tag(args.tag)
    require(os.environ.get("GITHUB_REPOSITORY") == REPOSITORY, "unexpected repository")
    commit = command(["git", "rev-parse", "--verify", "HEAD"])
    require(re.fullmatch(r"[0-9a-f]{40}", commit), "invalid checked-out commit")
    tagged = command(["git", "rev-parse", "--verify", f"refs/tags/{tag}^{{commit}}"])
    require(commit == tagged, "checkout is not the release tag commit")
    if args.expected_commit:
        require(commit == args.expected_commit, "release commit changed after verification")
    command(["git", "merge-base", "--is-ancestor", commit, "refs/remotes/origin/main"])
    verify_repository_policy()
    release = json.loads(command(["gh", "release", "view", tag, "--repo", REPOSITORY,
                                  "--json", "tagName,isDraft,isPrerelease"]))
    require(release.get("tagName") == tag and release.get("isDraft") is False and release.get("isPrerelease") is False,
            "only published stable releases may deploy")
    declaration_path = Path("ops/deploy/releases") / (tag + ".json")
    declaration = load_json(declaration_path)
    require(declaration.get("tag") == tag, "declaration belongs to another release")
    expected_name = f"setae-core-{tag[len('setae-v'):]}-wordpress.zip"
    require(declaration.get("artifact", {}).get("name") == expected_name, "unexpected asset name")
    destination = Path(args.directory).resolve()
    destination.mkdir(parents=True, exist_ok=False)
    command(["gh", "release", "download", tag, "--repo", REPOSITORY, "--pattern", expected_name,
             "--dir", str(destination)])
    archive = destination / expected_name
    artifact = inspect_archive(archive)
    verify_source(artifact, Path("plugins/setae-core"))
    check_declaration(declaration, artifact)
    if args.extract:
        prepare_test_workspace(artifact, Path.cwd(), args.extract)
    outputs = {"commit": commit, "version": artifact["version"], "archive": str(archive),
               "declaration": str(declaration_path.resolve()), "sha256": artifact["sha256"]}
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
            for key, value in outputs.items():
                require("\n" not in value and "\r" not in value, "unsafe workflow output")
                stream.write(f"{key}={value}\n")
    print(json.dumps({"status": "ADMITTED", "scope": "artifact, source and recorded review admission only; no test executed", **outputs,
                      "review_checks": {name: check["status"] for name, check in declaration["review"]["checks"].items()},
                      "acknowledged_not_run": [risk["check"] for risk in declaration["review"]["risk_acknowledgments"]]}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ReleaseError, OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"STOP: {error}", file=sys.stderr)
        sys.exit(1)
