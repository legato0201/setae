"""Local admission tests; synthetic review attestations never authorize a release."""
import contextlib
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "release"))
import release
import ci_release

PLUGIN = b"<?php\n/**\n * Plugin Name: SETAE Core\n * Version: 1.0.251.1\n */\ndefine('SETAE_VERSION', '1.0.251.1');\n"
FILES = {"setae-core.php": PLUGIN, "composer.lock": b"{}", "vendor/autoload.php": b"<?php // fixture"}


def zip_bytes(files):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, body in files.items():
            archive.writestr("setae-core/" + name, body)
    return stream.getvalue()


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="setae-release-test-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.archive = self.root / "candidate.zip"
        self.archive.write_bytes(zip_bytes(FILES))
        self.artifact = release.inspect_archive(self.archive)
        self.plugin = release.extract_verified(self.artifact, self.root / "source")

    def approved(self):
        value = release.declaration_for(self.artifact, "1.0.251")
        value["review"].update(code_only=True, approved_by="Synthetic local test reviewer")
        value["review"]["production_only_acknowledgment"] = {
            "accepted": True,
            "reason": "Synthetic test fixture: deployment has no staging environment.",
            "approved_by": "Synthetic local test reviewer",
            "initial_manual_verification_evidence": "local-test://synthetic-initial-verification",
        }
        for check in value["review"]["checks"].values():
            check.update(status="PASS", evidence="local-test://synthetic-evidence-only")
        return value

    def risk_approved(self):
        value = self.approved()
        value["review"]["risk_acknowledgments"] = []
        for name in ("wordpress_mysql_acceptance", "backup_restore_drill"):
            value["review"]["checks"][name].update(status="NOT_RUN", evidence="")
            value["review"]["risk_acknowledgments"].append({
                "check": name, "status": "NOT_RUN",
                "reason": "Synthetic fixture: this verification has not been performed.",
                "approved_by": "Synthetic local test reviewer",
            })
        return value

    @contextlib.contextmanager
    def ci_review_context(self, declaration):
        """Actual CI admission with temporary files; only Git/GitHub reads are stubbed."""
        repository = self.root / "synthetic-ci-repository"
        release.extract_verified(self.artifact, repository / "plugins")
        tag = declaration["tag"]
        release.write_new_json(repository / "ops/deploy/releases" / (tag + ".json"), declaration)
        commit = "a" * 40
        endpoint = "repos/" + release.REPOSITORY
        # CI resolves this path before passing it to gh; Windows temp roots may
        # otherwise use an 8.3 alias, which is the same directory but a different string.
        destination = (self.root / "synthetic-ci-download").resolve()
        workflow_output = self.root / "synthetic-github-output.txt"
        commands = {
            ("git", "rev-parse", "--verify", "HEAD"): commit,
            ("git", "rev-parse", "--verify", "refs/tags/" + tag + "^{commit}"): commit,
            ("git", "merge-base", "--is-ancestor", commit, "refs/remotes/origin/main"): "",
            ("gh", "api", endpoint + "/branches/main"): json.dumps({"protected": True}),
            ("gh", "api", endpoint + "/rulesets"): json.dumps([
                {"id": 1, "target": "tag", "enforcement": "active"}
            ]),
            ("gh", "api", endpoint + "/rulesets/1"): json.dumps({
                "conditions": {"ref_name": {"include": ["refs/tags/setae-v*"], "exclude": []}},
                "rules": [{"type": name} for name in ("creation", "update", "deletion")],
            }),
            ("gh", "release", "view", tag, "--repo", release.REPOSITORY,
             "--json", "tagName,isDraft,isPrerelease"): json.dumps({
                "tagName": tag, "isDraft": False, "isPrerelease": False,
            }),
        }
        download = ["gh", "release", "download", tag, "--repo", release.REPOSITORY,
                    "--pattern", declaration["artifact"]["name"], "--dir", str(destination)]

        def fake_command(arguments):
            if arguments == download:
                (destination / declaration["artifact"]["name"]).write_bytes(self.archive.read_bytes())
                return ""
            self.assertIn(tuple(arguments), commands, "Unexpected external command; no fallback is permitted")
            return commands[tuple(arguments)]

        with contextlib.chdir(repository), mock.patch.object(ci_release, "command", side_effect=fake_command), \
                mock.patch.dict(os.environ, {"GITHUB_REPOSITORY": release.REPOSITORY,
                                            "GITHUB_OUTPUT": str(workflow_output)}, clear=True), \
                mock.patch("sys.stdout", new_callable=io.StringIO) as output:
            yield ["--tag", tag, "--directory", str(destination), "--expected-commit", commit], output, workflow_output

    def test_inspect_and_source_equality_use_exact_zip_bytes(self):
        self.assertEqual(self.artifact["sha256"], hashlib.sha256(self.archive.read_bytes()).hexdigest())
        self.assertEqual(self.artifact["file_count"], 3)
        release.verify_source(self.artifact, self.plugin)

    def test_fresh_declaration_is_never_approved(self):
        value = release.declaration_for(self.artifact, "1.0.251")
        self.assertEqual(value["schema_version"], 2)
        self.assertIs(value["review"]["code_only"], False)
        self.assertIs(value["review"]["production_only_acknowledgment"]["accepted"], False)
        self.assertEqual(value["review"]["risk_acknowledgments"], [])
        self.assertTrue(all(check["status"] == "NOT_RUN" for check in value["review"]["checks"].values()))
        with self.assertRaises(release.ReleaseError):
            release.check_declaration(value, self.artifact)

    def test_production_only_risk_review_preserves_not_run_statuses(self):
        value = self.risk_approved()
        before = copy.deepcopy(value)
        admitted = release.check_declaration(value, self.artifact)
        self.assertEqual(admitted, before)
        self.assertEqual(value, before)
        self.assertEqual(value["review"]["checks"]["wordpress_mysql_acceptance"]["status"], "NOT_RUN")
        self.assertEqual(value["review"]["checks"]["backup_restore_drill"]["status"], "NOT_RUN")

    def test_production_only_all_pass_review_needs_no_staging_check(self):
        value = self.approved()
        self.assertEqual(set(value["review"]["checks"]), {
            "database_billing_permissions_compatibility", "wordpress_mysql_acceptance",
            "gui_and_browser_regression", "performance_budget", "backup_restore_drill",
        })
        self.assertEqual(value["review"]["risk_acknowledgments"], [])
        release.check_declaration(value, self.artifact)

    def test_only_schema_two_is_admitted(self):
        for schema in (1, True, "2", 2.0, None):
            value = self.approved()
            value["schema_version"] = schema
            with self.subTest(schema=schema), self.assertRaises(release.ReleaseError):
                release.check_declaration(value, self.artifact)

    def test_production_only_acknowledgment_is_explicit_and_complete(self):
        for accepted in (False, 1, "true", None):
            value = self.approved()
            value["review"]["production_only_acknowledgment"]["accepted"] = accepted
            with self.subTest(accepted=accepted), self.assertRaises(release.ReleaseError):
                release.check_declaration(value, self.artifact)
        for key in ("accepted", "reason", "approved_by", "initial_manual_verification_evidence"):
            value = self.approved()
            del value["review"]["production_only_acknowledgment"][key]
            with self.subTest(missing=key), self.assertRaises(release.ReleaseError):
                release.check_declaration(value, self.artifact)
        for key in ("reason", "approved_by", "initial_manual_verification_evidence"):
            for bad in ("", "  ", "placeholder", None):
                value = self.approved()
                value["review"]["production_only_acknowledgment"][key] = bad
                with self.subTest(key=key, bad=bad), self.assertRaises(release.ReleaseError):
                    release.check_declaration(value, self.artifact)

    def test_review_and_acknowledgment_reject_unknown_fields(self):
        for location in ("review", "production", "check", "risk"):
            value = self.risk_approved()
            targets = {
                "review": value["review"],
                "production": value["review"]["production_only_acknowledgment"],
                "check": value["review"]["checks"]["performance_budget"],
                "risk": value["review"]["risk_acknowledgments"][0],
            }
            targets[location]["skip_validation"] = True
            with self.subTest(location=location), self.assertRaises(release.ReleaseError):
                release.check_declaration(value, self.artifact)

    def test_each_unexecuted_check_requires_its_own_risk(self):
        for name in ("wordpress_mysql_acceptance", "backup_restore_drill"):
            value = self.risk_approved()
            value["review"]["risk_acknowledgments"] = [
                risk for risk in value["review"]["risk_acknowledgments"] if risk["check"] != name
            ]
            with self.subTest(missing_risk=name), self.assertRaises(release.ReleaseError):
                release.check_declaration(value, self.artifact)
            # One acknowledged unexecuted check is sufficient when all others passed.
            value["review"]["checks"][name].update(status="PASS", evidence="local-test://synthetic-evidence-only")
            release.check_declaration(value, self.artifact)

    def test_risk_reasons_and_reviewers_cannot_be_placeholders(self):
        for key in ("reason", "approved_by"):
            for bad in ("", "  ", "placeholder", None):
                value = self.risk_approved()
                value["review"]["risk_acknowledgments"][0][key] = bad
                with self.subTest(key=key, bad=bad), self.assertRaises(release.ReleaseError):
                    release.check_declaration(value, self.artifact)
        for key in ("check", "status", "reason", "approved_by"):
            value = self.risk_approved()
            del value["review"]["risk_acknowledgments"][0][key]
            with self.subTest(missing=key), self.assertRaises(release.ReleaseError):
                release.check_declaration(value, self.artifact)

    def test_no_failed_check_can_be_acknowledged_away(self):
        for name in release.REVIEW_CHECKS:
            for risk_status in ("FAIL", "NOT_RUN"):
                value = self.approved()
                value["review"]["checks"][name].update(status="FAIL", evidence="local-test://synthetic-failure")
                value["review"]["risk_acknowledgments"] = [{
                    "check": name, "status": risk_status,
                    "reason": "Synthetic attempt to acknowledge a failed check.",
                    "approved_by": "Synthetic local test reviewer",
                }]
                before = copy.deepcopy(value)
                with self.subTest(name=name, risk_status=risk_status), self.assertRaises(release.ReleaseError):
                    release.manifest_for(value, self.artifact, "a" * 40)
                self.assertEqual(value, before)

    def test_performance_gui_and_compatibility_cannot_be_unexecuted(self):
        for name in ("performance_budget", "gui_and_browser_regression", "database_billing_permissions_compatibility"):
            value = self.approved()
            value["review"]["checks"][name].update(status="NOT_RUN", evidence="")
            value["review"]["risk_acknowledgments"] = [{
                "check": name, "status": "NOT_RUN",
                "reason": "Synthetic attempt to bypass a mandatory review check.",
                "approved_by": "Synthetic local test reviewer",
            }]
            with self.subTest(name=name), self.assertRaises(release.ReleaseError):
                release.check_declaration(value, self.artifact)

    def test_risk_status_must_match_the_actual_check(self):
        for actual in ("PASS", "FAIL", "SKIP", "", None):
            value = self.risk_approved()
            value["review"]["checks"]["wordpress_mysql_acceptance"].update(
                status=actual, evidence="local-test://synthetic-evidence-only")
            with self.subTest(actual=actual), self.assertRaises(release.ReleaseError):
                release.check_declaration(value, self.artifact)
        for recorded in ("PASS", "FAIL", "SKIP", "", None):
            value = self.risk_approved()
            value["review"]["risk_acknowledgments"][0]["status"] = recorded
            with self.subTest(recorded=recorded), self.assertRaises(release.ReleaseError):
                release.check_declaration(value, self.artifact)

    def test_duplicate_unknown_and_malformed_risk_lists_are_rejected(self):
        first = self.risk_approved()["review"]["risk_acknowledgments"][0]
        bad_lists = [None, {}, "approved", [None], [first, first], [first, first, first],
                     [{**first, "check": "staging_deployment"}]]
        for risks in bad_lists:
            value = self.risk_approved()
            value["review"]["risk_acknowledgments"] = risks
            with self.subTest(risks=risks), self.assertRaises(release.ReleaseError):
                release.check_declaration(value, self.artifact)

    def test_risk_admission_remains_bound_to_the_exact_archive(self):
        value = self.risk_approved()
        manifest = release.manifest_for(value, self.artifact, "a" * 40)
        self.assertEqual(manifest["sha256"], self.artifact["sha256"])
        value["review"]["artifact_sha256"] = "0" * 64
        with self.assertRaises(release.ReleaseError):
            release.manifest_for(value, self.artifact, "a" * 40)

    def test_verify_cli_reports_admission_without_claiming_execution(self):
        for value in (self.approved(), self.risk_approved()):
            declaration = self.root / "synthetic-declaration.json"
            declaration.write_text(json.dumps(value), encoding="utf-8")
            with mock.patch("sys.stdout", new_callable=io.StringIO) as output, mock.patch.object(release, "send") as sender:
                code = release.main(["verify", "--archive", str(self.archive),
                                     "--plugin-source", str(self.plugin), "--declaration", str(declaration)])
            sender.assert_not_called()
            self.assertEqual(code, 0)
            result = json.loads(output.getvalue())
            self.assertEqual(result["status"], "ADMITTED")
            self.assertIn("no test executed", result["scope"])
            self.assertEqual(result["review_checks"], {
                name: check["status"] for name, check in value["review"]["checks"].items()
            })
            self.assertEqual(result["acknowledged_not_run"], [
                risk["check"] for risk in value["review"]["risk_acknowledgments"]
            ])
            self.assertEqual(json.loads(declaration.read_text(encoding="utf-8")), value)

    def test_verify_cli_never_prints_admitted_on_a_failed_performance_gate(self):
        value = self.risk_approved()
        value["review"]["checks"]["performance_budget"].update(status="FAIL", evidence="local-test://synthetic-failure")
        declaration = self.root / "synthetic-failure.json"
        declaration.write_text(json.dumps(value), encoding="utf-8")
        with mock.patch("sys.stdout", new_callable=io.StringIO) as output, mock.patch.object(release, "send") as sender:
            with self.assertRaises(release.ReleaseError):
                release.main(["verify", "--archive", str(self.archive),
                              "--plugin-source", str(self.plugin), "--declaration", str(declaration)])
        self.assertEqual(output.getvalue(), "")
        sender.assert_not_called()

    def test_ci_cli_reports_admission_and_preserves_unexecuted_checks(self):
        value = self.risk_approved()
        before = copy.deepcopy(value)
        with self.ci_review_context(value) as (arguments, output, workflow_output):
            code = ci_release.main(arguments)
        self.assertEqual(code, 0)
        result = json.loads(output.getvalue())
        self.assertEqual(result["status"], "ADMITTED")
        self.assertIn("no test executed", result["scope"])
        self.assertEqual(result["review_checks"], {
            name: check["status"] for name, check in value["review"]["checks"].items()
        })
        self.assertEqual(result["acknowledged_not_run"], [
            "wordpress_mysql_acceptance", "backup_restore_drill"
        ])
        self.assertEqual(value, before)
        self.assertIn("sha256=" + self.artifact["sha256"], workflow_output.read_text(encoding="utf-8"))

    def test_ci_cli_failed_performance_never_emits_admission_or_workflow_outputs(self):
        value = self.risk_approved()
        value["review"]["checks"]["performance_budget"].update(status="FAIL", evidence="local-test://synthetic-failure")
        with self.ci_review_context(value) as (arguments, output, workflow_output):
            with self.assertRaises(release.ReleaseError):
                ci_release.main(arguments)
        self.assertEqual(output.getvalue(), "")
        self.assertFalse(workflow_output.exists())

    def test_nul_member_name_is_rejected_before_extraction(self):
        data = zip_bytes({**FILES, "badX.php": b"unsafe"})
        self.archive.write_bytes(data.replace(b"setae-core/badX.php", b"setae-core/bad\x00.php"))
        with self.assertRaises(release.ReleaseError):
            release.inspect_archive(self.archive)

    def test_artifact_inventory_hashes_are_required(self):
        for key in ("sha256", "files_sha256", "first_party_sha256"):
            value = self.approved()
            value["artifact"][key] = "0" * 64
            with self.subTest(key=key), self.assertRaises(release.ReleaseError):
                release.check_declaration(value, self.artifact)

    def test_review_hash_must_match_exact_archive(self):
        value = self.approved()
        value["review"]["artifact_sha256"] = "0" * 64
        with self.assertRaises(release.ReleaseError):
            release.check_declaration(value, self.artifact)

    def test_without_risk_each_review_must_be_pass_with_evidence(self):
        release.check_declaration(self.approved(), self.artifact)
        for name in release.REVIEW_CHECKS:
            for status in ("NOT_RUN", "FAIL", "SKIP", ""):
                value = self.approved()
                value["review"]["checks"][name]["status"] = status
                with self.subTest(name=name, status=status), self.assertRaises(release.ReleaseError):
                    release.check_declaration(value, self.artifact)
            value = self.approved()
            value["review"]["checks"][name]["evidence"] = ""
            with self.subTest(name=name, missing_evidence=True), self.assertRaises(release.ReleaseError):
                release.check_declaration(value, self.artifact)
