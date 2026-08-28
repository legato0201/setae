"""Release admission and SSH transport. Never builds/replaces a delivered ZIP.

Only Python's standard library is used. Review evidence is a human attestation,
not a substitute for the executable checks or a signature of the release.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import tempfile
import zipfile

REPOSITORY = "legato0201/setae"
MAX_ZIP_BYTES = 32 * 1024 * 1024
MAX_EXPANDED_BYTES = 128 * 1024 * 1024
MAX_FILE_BYTES = 16 * 1024 * 1024
MAX_FILES = 10000
DECLARATION_SCHEMA = 2
REVIEW_CHECKS = (
    "database_billing_permissions_compatibility",
    "wordpress_mysql_acceptance",
    "gui_and_browser_regression",
    "performance_budget",
    "backup_restore_drill",
)
PRODUCTION_ONLY_NOT_RUN_CHECKS = {"wordpress_mysql_acceptance", "backup_restore_drill"}
IGNORE_PARTS = {".DS_Store", "__MACOSX", "__pycache__", ".git", "node_modules"}


class ReleaseError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def version_tuple(value):
    require(isinstance(value, str) and re.fullmatch(r"(?:0|[1-9][0-9]{0,5})(?:\.(?:0|[1-9][0-9]{0,5})){2,3}", value), "invalid version")
    numbers = tuple(int(part) for part in value.split("."))
    return numbers + (0,) * (4 - len(numbers))


def valid_tag(tag):
    require(isinstance(tag, str) and tag.startswith("setae-v"), "release tag must start with setae-v")
    version_tuple(tag[len("setae-v"):])
    return tag


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def index_digest(index):
    return sha256(json.dumps(index, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("ascii"))


def plugin_version(data):
    text = data.decode("utf-8-sig")
    headers = re.findall(r"^\s*\*\s*Version:\s*(\S+)\s*$", text[:8192], re.MULTILINE)
    constants = re.findall(r"define\(\s*['\"]SETAE_VERSION['\"]\s*,\s*['\"]([^'\"]+)['\"]\s*\)", text)
    require(len(headers) == len(constants) == 1 and headers[0] == constants[0], "plugin header/constant versions differ or are missing")
    version_tuple(headers[0])
    return headers[0]


def safe_member(info):
    name = info.filename
    require(info.orig_filename == name, "truncated ZIP name")
    require(isinstance(name, str) and len(name) <= 512, "invalid ZIP name")
    require(not any(ord(c) < 32 or ord(c) == 127 for c in name), "control character in ZIP path")
    require("\\" not in name and ":" not in name and not name.startswith("/"), "ambiguous/absolute ZIP path")
    trimmed = name[:-1] if name.endswith("/") else name
    parts = trimmed.split("/")
    require(parts and parts[0] == "setae-core" and all(p not in {"", ".", ".."} for p in parts), "ZIP escapes setae-core")
    require(len(parts) > 1 or info.is_dir(), "plugin root must be a directory")
    require(all(p.rstrip(" .") == p for p in parts), "ambiguous ZIP component")
    require(not info.flag_bits & 1, "encrypted ZIP is not supported")
    require(info.compress_type in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}, "unsupported ZIP compression")
    mode = info.external_attr >> 16
    kind = stat.S_IFMT(mode)
    require(kind in ({0, stat.S_IFDIR} if info.is_dir() else {0, stat.S_IFREG}), "ZIP links/special files are forbidden")
    require(not mode & (stat.S_ISUID | stat.S_ISGID | stat.S_ISVTX), "unsafe ZIP mode")
    require(info.file_size <= MAX_FILE_BYTES, "ZIP entry too large")
    require(info.file_size <= max(1, info.compress_size) * 200, "ZIP compression ratio too large")
    return trimmed


def inspect_archive(path):
    path = Path(path)
    require(path.is_file() and not path.is_symlink(), "ZIP must be a regular file")
    with path.open("rb") as stream:
        data = stream.read(MAX_ZIP_BYTES + 1)
    require(0 < len(data) <= MAX_ZIP_BYTES, "ZIP size outside limits")
    # Work from one immutable in-memory snapshot, not a second filesystem read.
    from io import BytesIO
    files, names = {}, set()
    total = 0
    with zipfile.ZipFile(BytesIO(data)) as archive:
        entries = archive.infolist()
        require(0 < len(entries) <= MAX_FILES, "ZIP entry count outside limits")
        for info in entries:
            canonical = safe_member(info)
            folded = canonical.casefold()
            require(folded not in names, "duplicate/case-colliding ZIP path")
            names.add(folded)
            total += info.file_size
            require(total <= MAX_EXPANDED_BYTES, "expanded ZIP too large")
            if info.is_dir():
                continue
            body = archive.read(info)  # CRC is checked by zipfile.
            require(len(body) == info.file_size, "ZIP entry size mismatch")
            files[canonical[len("setae-core/"):]] = body
    file_paths = {("setae-core/" + p).casefold() for p in files}
    for relative in files:
        full = "setae-core/" + relative
        for parent in PurePosixPath(full).parents:
            require(str(parent).casefold() not in file_paths, "ZIP file/directory collision")
    require("setae-core.php" in files and "vendor/autoload.php" in files and "composer.lock" in files, "incomplete distributable; do not rebuild vendor implicitly")
    version = plugin_version(files["setae-core.php"])
    index = {name: sha256(body) for name, body in files.items()}
    first_party = {name: digest for name, digest in index.items() if not name.startswith("vendor/")}
    return {
        "version": version, "bytes": len(data), "sha256": sha256(data),
        "files_sha256": index_digest(index), "first_party_sha256": index_digest(first_party),
        "file_count": len(files), "files": files,
    }


def source_index(plugin):
    plugin = Path(plugin)
    require(plugin.is_dir() and not plugin.is_symlink(), "plugin source directory missing/linked")
    root = plugin.resolve()
    index = {}
    for file in sorted(plugin.rglob("*")):
        relative = file.relative_to(plugin)
        if relative.parts[0] == "vendor" or any(p in IGNORE_PARTS for p in relative.parts) or file.suffix in {".pyc", ".pyo"}:
            continue
        require(not file.is_symlink() and file.resolve().is_relative_to(root), "linked source path")
        if file.is_file():
            index[relative.as_posix()] = sha256(file.read_bytes())
    require("setae-core.php" in index, "plugin source missing")
    return index


def verify_source(artifact, plugin):
    actual = source_index(plugin)
    packaged = {name: sha256(data) for name, data in artifact["files"].items() if not name.startswith("vendor/")}
    require(actual == packaged, "checked-out plugin source differs from the reviewed ZIP (including added/deleted files)")


def declaration_for(artifact, expected_current):
    require(version_tuple(artifact["version"]) > version_tuple(expected_current), "candidate must be newer than the expected installed version")
    return {
        "schema_version": DECLARATION_SCHEMA,
        "tag": "setae-v" + artifact["version"],
        "version": artifact["version"],
        "expected_current_version": expected_current,
        "artifact": {"name": f"setae-core-{artifact['version']}-wordpress.zip", **{k: artifact[k] for k in ("bytes", "sha256", "files_sha256", "first_party_sha256")}},
        "review": {
            "artifact_sha256": artifact["sha256"], "code_only": False, "approved_by": "",
            "checks": {name: {"status": "NOT_RUN", "evidence": ""} for name in REVIEW_CHECKS},
            "production_only_acknowledgment": {
                "accepted": False, "reason": "", "approved_by": "", "initial_manual_verification_evidence": "",
            },
            "risk_acknowledgments": [],
        },
    }


def _review_text(value, label, minimum=1):
    require(isinstance(value, str) and minimum <= len(value.strip()) <= 2000
            and value.strip().lower() not in {"not run", "not_run", "todo", "example", "replace_me", "placeholder"},
            f"meaningful review text is required: {label}")


def check_declaration(declaration, artifact, require_review=True):
    require(type(declaration) is dict and type(declaration.get("schema_version")) is int and declaration["schema_version"] == DECLARATION_SCHEMA, "unsupported release declaration")
    require(declaration.get("version") == artifact["version"], "declared version mismatch")
    require(valid_tag(declaration.get("tag")) == "setae-v" + artifact["version"], "tag/version mismatch")
    require(version_tuple(artifact["version"]) > version_tuple(declaration.get("expected_current_version")), "same/older release is not deployable")
    expected = declaration_for(artifact, declaration["expected_current_version"])["artifact"]
    require(declaration.get("artifact") == expected, "artifact hash/size/inventory does not match declaration")
    if require_review:
        review = declaration.get("review", {})
        require(type(review) is dict and review.get("artifact_sha256") == artifact["sha256"], "review refers to a different artifact")
        require(set(review) == {"artifact_sha256", "code_only", "approved_by", "checks", "production_only_acknowledgment", "risk_acknowledgments"}, "release review fields are missing/unknown")
        require(review.get("code_only") is True, "DB/billing/permission/migration changes require a separate deployment plan")
        _review_text(review.get("approved_by"), "release reviewer")
        production = review["production_only_acknowledgment"]
        require(type(production) is dict and set(production) == {"accepted", "reason", "approved_by", "initial_manual_verification_evidence"}
                and production["accepted"] is True, "production-only operation and the initial manual verification are not approved")
        _review_text(production["reason"], "production-only reason", 8)
        _review_text(production["approved_by"], "production-only approver")
        _review_text(production["initial_manual_verification_evidence"], "initial manual verification evidence", 8)
        checks = review.get("checks", {})
        require(type(checks) is dict and set(checks) == set(REVIEW_CHECKS), "required review checks are missing/unknown")
        risks = review["risk_acknowledgments"]
        require(type(risks) is list and len(risks) <= len(PRODUCTION_ONLY_NOT_RUN_CHECKS), "invalid risk acknowledgments")
        accepted = {}
        for risk in risks:
            require(type(risk) is dict and set(risk) == {"check", "status", "reason", "approved_by"}, "risk acknowledgment fields are missing/unknown")
            name = risk["check"]
            require(isinstance(name, str) and name in PRODUCTION_ONLY_NOT_RUN_CHECKS and name not in accepted
                    and risk["status"] == "NOT_RUN", "only the named unexecuted WordPress/restore checks may have an explicit risk acknowledgment")
            _review_text(risk["reason"], "unexecuted-check reason", 8)
            _review_text(risk["approved_by"], "unexecuted-check approver")
            accepted[name] = risk
        for name in REVIEW_CHECKS:
            check = checks[name]
            require(type(check) is dict and set(check) == {"status", "evidence"} and isinstance(check["evidence"], str), f"invalid review check: {name}")
            if check["status"] == "PASS":
                require(name not in accepted, f"risk acknowledgment does not match the recorded status: {name}")
                _review_text(check["evidence"], name + " evidence", 8)
            else:
                # Preserve the original result. No FAIL, performance, GUI or
                # compatibility check can be converted into an admitted PASS.
                require(check["status"] == "NOT_RUN" and name in accepted, f"review gate blocks deployment: {name}")
    return declaration


def load_json(path):
    def unique(pairs):
        obj = {}
        for key, value in pairs:
            require(key not in obj, "duplicate JSON key")
            obj[key] = value
        return obj
    return json.loads(Path(path).read_text(encoding="utf-8"), object_pairs_hook=unique)


def manifest_for(declaration, artifact, commit):
    check_declaration(declaration, artifact)
    require(isinstance(commit, str) and re.fullmatch(r"[0-9a-f]{40}", commit), "source commit must be a full Git SHA")
    return {
        "protocol_version": 1, "operation": "deploy", "version": artifact["version"],
        "expected_current_version": declaration["expected_current_version"],
        "sha256": artifact["sha256"], "bytes": artifact["bytes"],
        "source_commit": commit, "code_only": True, "release_id": declaration["tag"],
    }


def write_new_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as output:
        json.dump(value, output, ensure_ascii=False, indent=2)
        output.write("\n")


def extract_verified(artifact, destination):
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    for relative, body in artifact["files"].items():
        file = destination / "setae-core" / relative
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open("xb") as output:
            output.write(body)
    return destination / "setae-core"


def ssh_arguments(host, port, key_file, known_hosts_file, ssh="ssh"):
    require(isinstance(host, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]{0,252}", host), "SSH host must be a DNS name or IPv4 address")
    require(str(port).isdigit() and 1 <= int(port) <= 65535, "invalid SSH port")
    return [ssh, "-F", "/dev/null", "-T", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes",
            "-o", "IdentityAgent=none", "-o", "StrictHostKeyChecking=yes",
            "-o", f"UserKnownHostsFile={known_hosts_file}", "-o", "GlobalKnownHostsFile=/dev/null",
            "-o", "ForwardAgent=no", "-o", "ClearAllForwardings=yes", "-o", "ProxyCommand=none",
            "-o", "ProxyJump=none", "-o", "ConnectionAttempts=1", "-o", "ConnectTimeout=15",
            "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=3",
            "-i", str(key_file), "-p", str(port), "-l", "setae-deploy", host,
            "/usr/bin/sudo -n -u www-data -- /usr/local/sbin/setae-deploy"]


def send(artifact_path, declaration, artifact, commit):
    require(os.name == "posix", "SSH deployment transport is supported on Linux CI only")
    manifest = manifest_for(declaration, artifact, commit)
    # Re-snapshot and verify immediately before transmission; no substitution of ZIP.
    with Path(artifact_path).open("rb") as stream:
        data = stream.read(MAX_ZIP_BYTES + 1)
    require(sha256(data) == manifest["sha256"] and len(data) == manifest["bytes"], "artifact changed before transmission")
    key = os.environ.get("SETAE_SSH_PRIVATE_KEY", "")
    known_hosts = os.environ.get("SETAE_SSH_KNOWN_HOSTS", "")
    require("PRIVATE KEY-----" in key and known_hosts.strip(), "deployment key/verified known_hosts is missing")
    with tempfile.TemporaryDirectory(prefix="setae-ssh-") as directory:
        os.chmod(directory, 0o700)
        key_file, hosts_file = Path(directory) / "identity", Path(directory) / "known_hosts"
        for file, value in ((key_file, key), (hosts_file, known_hosts)):
            fd = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
                stream.write(value.rstrip() + "\n")
        command = ssh_arguments(os.environ.get("SETAE_SSH_HOST", ""), os.environ.get("SETAE_SSH_PORT", ""), key_file, hosts_file)
        result = subprocess.run(command, input=json.dumps(manifest, separators=(",", ":")).encode() + b"\n" + data,
                                capture_output=True, timeout=1800, env={"PATH": "/usr/bin:/bin", "HOME": directory, "LANG": "C.UTF-8"})
        require(result.returncode == 0, "remote deployment failed; check the server's private deployment journal before retrying")
        try:
            response = json.loads(result.stdout)
        except (ValueError, UnicodeError):
            raise ReleaseError("remote did not return a valid deployment receipt") from None
        require(type(response) is dict and response.get("status") == "success" and response.get("version") == artifact["version"]
                and response.get("sha256") == artifact["sha256"] and response.get("source_commit") == commit
                and response.get("release_id") == declaration["tag"], "remote receipt does not confirm the target artifact")
        print(json.dumps({"status": "success", "version": artifact["version"], "sha256": artifact["sha256"]}))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("inspect", "prepare", "verify", "extract", "send"):
        p = sub.add_parser(name)
        p.add_argument("--archive", required=True)
        if name in {"prepare", "verify", "extract", "send"}:
            p.add_argument("--plugin-source", required=True)
        if name == "prepare":
            p.add_argument("--expected-current", required=True)
            p.add_argument("--output", required=True)
        if name in {"verify", "extract", "send"}:
            p.add_argument("--declaration", required=True)
        if name == "extract":
            p.add_argument("--destination", required=True)
        if name == "send":
            p.add_argument("--commit", required=True)
    args = parser.parse_args(argv)
    artifact = inspect_archive(args.archive)
    if args.command == "inspect":
        print(json.dumps({k: v for k, v in artifact.items() if k != "files"}))
        return 0
    verify_source(artifact, args.plugin_source)
    if args.command == "prepare":
        write_new_json(args.output, declaration_for(artifact, args.expected_current))
        print("Schema 2 declaration created with NOT_RUN checks and no production-only/risk approval. Deployment is NOT approved.")
        return 0
    declaration = check_declaration(load_json(args.declaration), artifact)
    if args.command == "extract":
        print(extract_verified(artifact, args.destination))
    elif args.command == "send":
        send(args.archive, declaration, artifact, args.commit)
    else:
        print(json.dumps({"status": "ADMITTED", "scope": "artifact, source and recorded review admission only; no test executed", "version": artifact["version"], "sha256": artifact["sha256"],
                          "review_checks": {name: check["status"] for name, check in declaration["review"]["checks"].items()},
                          "acknowledged_not_run": [risk["check"] for risk in declaration["review"]["risk_acknowledgments"]]}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ReleaseError, OSError, ValueError, zipfile.BadZipFile, subprocess.SubprocessError) as error:
        print(f"STOP: {error}", file=sys.stderr)
        sys.exit(1)
