"""Actual local admission/transport logic; GitHub, Windows ACL and SSH are stubs.

No test reads an identity, contacts a server, or performs a real deployment.
"""
import contextlib
import copy
import io
import json
from pathlib import Path
import ssl
import subprocess
import sys
import tempfile
import types
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "release"))
import local_release as local
import release
from test_release import FILES, zip_bytes


COMMIT = "a" * 40
TREE = "b" * 40
CONNECTION = {"schema_version": 1, "host": "example.invalid", "port": 2222,
              "key_file": r"C:\Users\Fixture User\.ssh\identity",
              "known_hosts_file": r"C:\Users\Fixture User\.ssh\known_hosts"}


def public_tree(files):
    entries = [{"path": name, "type": "tree", "mode": "040000", "sha": "c" * 40}
               for name in ("plugins", "plugins/setae-core")]
    for name, body in files.items():
        if not name.startswith("vendor/"):
            entries.append({"path": "plugins/setae-core/" + name, "type": "blob", "mode": "100644", "sha": local.git_blob_sha1(body)})
    return {"sha": TREE, "truncated": False, "tree": entries}


def preflight_receipt():
    return {"status": "success", "operation": "preflight", "version": "1.0.251",
            "wordpress_version": "7.1", "php_version": "8.3.6", "wp_cli_version": "2.12.0",
            "php_cli_compatible": True, "tested_php_cli_minor": "8.3", "enabled": False, "auth_ready": False,
            "deployment_ready": False, "manual_recovery_required": False, "maintenance_file_present": False}


def deploy_receipt(manifest, artifact):
    return {"status": "success", "operation": "deploy", "version": manifest["version"],
            "previous_version": manifest["expected_current_version"], "sha256": manifest["sha256"],
            "source_commit": manifest["source_commit"], "release_id": manifest["release_id"],
            "backup_id": "20260829T000000Z-" + "d" * 32,
            "installed_code": {"files": artifact["file_count"], "bytes": sum(map(len, artifact["files"].values()))},
            "smoke": {"http_status": 200, "namespace": "setae/v1"}, "maintenance": False, "database_restored": False}


class ConnectionTests(unittest.TestCase):
    def test_connection_is_fixed_user_and_windows_paths_only(self):
        self.assertEqual(local.validate_connection(CONNECTION), CONNECTION)
        invalid = [dict(CONNECTION, user="root"), dict(CONNECTION, port=True), dict(CONNECTION, schema_version=True),
                   dict(CONNECTION, host="host;command"), dict(CONNECTION, key_file="relative"),
                   dict(CONNECTION, key_file=r"\\host\share\key"), dict(CONNECTION, key_file=r"C:\key:stream"),
                   dict(CONNECTION, known_hosts_file=r"C:\pins\%h"), dict(CONNECTION, known_hosts_file=CONNECTION["key_file"])]
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(local.LocalReleaseError):
                local.validate_connection(value)

    def test_existing_ssh_safety_options_are_reused_with_windows_null(self):
        with mock.patch.object(local.os, "devnull", "nul"):
            args = local.windows_ssh_arguments(CONNECTION)
        self.assertEqual(args[0], local.WINDOWS_SSH)
        self.assertEqual(args[args.index("-F") + 1], "nul")
        self.assertIn("GlobalKnownHostsFile=nul", args)
        self.assertNotIn("/dev/null", args)
        self.assertIn('UserKnownHostsFile="C:/Users/Fixture User/.ssh/known_hosts"', args)
        self.assertEqual(args[args.index("-i") + 1], CONNECTION["key_file"])
        self.assertEqual(args[args.index("-l") + 1], "setae-deploy")
        for value in ("BatchMode=yes", "IdentitiesOnly=yes", "IdentityAgent=none", "StrictHostKeyChecking=yes",
                      "ForwardAgent=no", "ClearAllForwardings=yes", "ProxyCommand=none", "ProxyJump=none"):
            self.assertIn(value, args)
        self.assertEqual(args[-1], "/usr/bin/sudo -n -u www-data -- /usr/local/sbin/setae-deploy")

    def test_acl_uses_fixed_noninterpolated_read_only_command(self):
        runner = mock.Mock(return_value=types.SimpleNamespace(returncode=0, stdout=b'{"ok":true}'))
        with mock.patch.object(local, "require_windows"):
            result = local.check_windows_acl(CONNECTION["key_file"], CONNECTION["known_hosts_file"], r"C:\safe\connection.json", runner)
        args, kwargs = runner.call_args
        self.assertEqual(args[0][0], local.WINDOWS_POWERSHELL)
        self.assertEqual(args[0][-1], local.ACL_SCRIPT)
        self.assertNotIn(CONNECTION["key_file"], args[0][-1])
        self.assertEqual(kwargs["env"]["SETAE_ACL_KEY"], CONNECTION["key_file"])
        self.assertEqual(kwargs["env"]["ProgramData"], r"C:\ProgramData")
        self.assertEqual(kwargs["stderr"], subprocess.DEVNULL)
        self.assertIn("Get-Acl -LiteralPath", local.ACL_SCRIPT)
        self.assertIn("$rules.Count -eq 0", local.ACL_SCRIPT)
        self.assertNotRegex(local.ACL_SCRIPT, r"Get-Content|ReadAllText|ReadAllBytes|Invoke-Expression|Set-Acl")
        self.assertEqual(result["status"], "VERIFIED")

    def test_acl_failure_never_exposes_private_stderr(self):
        runner = mock.Mock(return_value=types.SimpleNamespace(returncode=1, stdout=b'{"ok":false}', stderr=b"PRIVATE_DIAGNOSTIC"))
        with mock.patch.object(local, "require_windows"), self.assertRaises(local.LocalReleaseError) as caught:
            local.check_windows_acl(CONNECTION["key_file"], runner=runner)
        self.assertNotIn("PRIVATE_DIAGNOSTIC", str(caught.exception))
        self.assertEqual(caught.exception.remote_outcome, "NOT_RUN")


class ProvenanceTests(unittest.TestCase):
    def reader(self, tree=None, commit_value=None):
        return mock.Mock(side_effect=[commit_value or {"sha": COMMIT, "tree": {"sha": TREE}}, tree or public_tree(FILES)])

    def test_exact_first_party_git_blobs_are_verified_without_claiming_ci_policy(self):
        reader = self.reader()
        result = local.verify_commit_provenance({"files": FILES}, COMMIT, reader)
        self.assertEqual(result["status"], "VERIFIED")
        self.assertEqual(result["first_party_files"], 2)
        self.assertEqual(result["branch_ancestry_and_tag_protection"], "NOT_RUN")
        self.assertEqual(reader.call_args_list, [mock.call(local.GITHUB_ROOT + "commits/" + COMMIT),
                                                mock.call(local.GITHUB_ROOT + "trees/" + TREE + "?recursive=1")])

    def test_missing_extra_changed_link_unknown_mode_and_incomplete_tree_stop(self):
        original = public_tree(FILES)
        variants = []
        changed = copy.deepcopy(original); changed["tree"][-1]["sha"] = "0" * 40; variants.append(changed)
        missing = copy.deepcopy(original); missing["tree"].pop(); variants.append(missing)
        extra = copy.deepcopy(original); extra["tree"].append({"path": "plugins/setae-core/extra.php", "type": "blob", "mode": "100644", "sha": "e" * 40}); variants.append(extra)
        for mode, kind in (("120000", "blob"), ("160000", "commit"), ("100664", "blob")):
            value = copy.deepcopy(original); value["tree"][-1].update(mode=mode, type=kind); variants.append(value)
        duplicate = copy.deepcopy(original); duplicate["tree"].append(copy.deepcopy(duplicate["tree"][-1])); variants.append(duplicate)
        variants.extend([dict(original, truncated=True), dict(original, sha="0" * 40)])
        for index, tree in enumerate(variants):
            with self.subTest(index=index), self.assertRaises(local.LocalReleaseError):
                local.verify_commit_provenance({"files": FILES}, COMMIT, self.reader(tree=tree))
        with self.assertRaises(local.LocalReleaseError):
            local.verify_commit_provenance({"files": FILES}, COMMIT, self.reader(commit_value={"sha": "0" * 40, "tree": {"sha": TREE}}))

    def test_http_reader_refuses_other_urls_and_uses_tls_no_proxy_no_redirect(self):
        response = io.BytesIO(b'{"sha":"fixture"}')
        response.status = 200
        opener = mock.Mock()
        opener.open.return_value = response
        with mock.patch.object(local.urllib.request, "build_opener", return_value=opener) as build:
            self.assertEqual(local.read_github_json(local.GITHUB_ROOT + "commits/" + COMMIT), {"sha": "fixture"})
        handlers = build.call_args.args
        self.assertEqual(handlers[0].proxies, {})
        self.assertIsInstance(handlers[1], local.NoRedirects)
        self.assertIsNone(handlers[1].redirect_request(None))
        self.assertEqual(handlers[2]._context.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(handlers[2]._context.check_hostname)
        self.assertEqual(opener.open.call_args.kwargs["timeout"], 20)
        for url in ("http://api.github.com/", local.GITHUB_ROOT + "commits/../../x", "https://example.invalid/"):
            with self.subTest(url=url), mock.patch.object(local.urllib.request, "build_opener") as build, self.assertRaises(local.LocalReleaseError):
                local.read_github_json(url)
            build.assert_not_called()

    def test_json_limits_duplicates_and_constants_are_not_accepted(self):
        for body in (b'{"x":1,"x":2}', b'{"x":NaN}', b"[]", b"x" * 17):
            with self.subTest(body=body), self.assertRaises(local.LocalReleaseError):
                local.parse_json(body, 16, "test_invalid")


class LocalFlowTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="setae-local-release-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.archive = self.root / "candidate.zip"
        self.archive.write_bytes(zip_bytes(FILES))
        self.artifact = release.inspect_archive(self.archive)
        self.plugin = release.extract_verified(self.artifact, self.root / "source")
        self.declaration = release.declaration_for(self.artifact, "1.0.251")
        review = self.declaration["review"]
        review.update(code_only=True, approved_by="Offline automated test reviewer")
        for check in review["checks"].values():
            check.update(status="PASS", evidence="fixture://synthetic-not-production")
        review["production_only_acknowledgment"].update(accepted=True, reason="Offline fixture authorization only",
                                                       approved_by="Offline test reviewer", initial_manual_verification_evidence="fixture://synthetic-readiness")
        self.declaration_path = self.root / "review.json"
        self.save_declaration()
        self.reader = mock.Mock(side_effect=[{"sha": COMMIT, "tree": {"sha": TREE}}, public_tree(FILES)])
        self.acl = mock.Mock(return_value={"status": "VERIFIED", "scope": "synthetic Windows boundary"})
        self.ssh = mock.Mock(side_effect=self.fake_ssh)

    def save_declaration(self):
        self.declaration_path.write_text(json.dumps(self.declaration), encoding="utf-8")

    def fake_ssh(self, connection, payload):
        line, body = payload.split(b"\n", 1)
        manifest = json.loads(line)
        self.assertEqual(body, self.archive.read_bytes())
        self.assertEqual(manifest, release.manifest_for(self.declaration, self.artifact, COMMIT))
        return deploy_receipt(manifest, self.artifact)

    def send(self):
        return local.send(CONNECTION, self.archive, self.declaration_path, self.plugin, COMMIT,
                          acl_checker=self.acl, reader=self.reader, ssh_runner=self.ssh)

    def test_success_uses_all_admission_gates_and_one_exact_wire_frame(self):
        result = self.send()
        self.assertEqual(result["remote_outcome"], "CONFIRMED")
        self.assertEqual(result["source_provenance"]["status"], "VERIFIED")
        self.ssh.assert_called_once()
        self.acl.assert_called_once()

    def test_failed_review_stops_before_acl_api_or_ssh(self):
        self.declaration["review"]["checks"]["performance_budget"]["status"] = "FAIL"
        self.save_declaration()
        with self.assertRaises(local.LocalReleaseError):
            self.send()
        self.acl.assert_not_called(); self.reader.assert_not_called(); self.ssh.assert_not_called()

    def test_commit_read_failure_stops_before_ssh(self):
        self.reader.side_effect = local.LocalReleaseError("github_read_failed", "Synthetic API boundary failure")
        with self.assertRaises(local.LocalReleaseError) as caught:
            self.send()
        self.assertEqual(caught.exception.remote_outcome, "NOT_RUN")
        self.ssh.assert_not_called()

    def test_archive_mutation_after_git_verification_stops_before_ssh(self):
        def reader(url):
            if "/commits/" in url:
                return {"sha": COMMIT, "tree": {"sha": TREE}}
            self.archive.write_bytes(self.archive.read_bytes() + b"changed")
            return public_tree(FILES)
        self.reader.side_effect = reader
        with self.assertRaises(local.LocalReleaseError) as caught:
            self.send()
        self.assertEqual(caught.exception.code, "artifact_changed")
        self.ssh.assert_not_called()

    def test_strict_receipt_rejects_wrong_hash_commit_version_fields_and_types(self):
        manifest = release.manifest_for(self.declaration, self.artifact, COMMIT)
        receipt = deploy_receipt(manifest, self.artifact)
        variants = [dict(receipt, sha256="0" * 64), dict(receipt, source_commit="0" * 40), dict(receipt, version="1.0.999"),
                    dict(receipt, extra="unexpected"), dict(receipt, maintenance=0),
                    dict(receipt, installed_code={"files": float(self.artifact["file_count"]), "bytes": sum(map(len, FILES.values()))}),
                    dict(receipt, smoke={"http_status": 200, "namespace": "wrong"})]
        for value in variants:
            with self.subTest(value=value), self.assertRaises(local.LocalReleaseError) as caught:
                local.validate_deploy_receipt(value, manifest, self.artifact)
            self.assertEqual(caught.exception.remote_outcome, "UNKNOWN")

    def test_preflight_is_separate_and_never_claims_a_plugin_update(self):
        ssh = mock.Mock(return_value=preflight_receipt())
        result = local.preflight(CONNECTION, acl_checker=self.acl, ssh_runner=ssh)
        ssh.assert_called_once_with(CONNECTION, b'{"protocol_version":1,"operation":"preflight"}\n')
        self.assertIs(result["deployment_ready"], False)
        self.assertEqual(result["plugin_update"], "NOT_RUN")
        self.reader.assert_not_called()

    def test_timeout_and_private_diagnostics_never_trigger_retry_or_logging(self):
        cases = [subprocess.TimeoutExpired("fixed-ssh", 1, stderr=b"PRIVATE_DIAGNOSTIC"),
                 types.SimpleNamespace(returncode=255, stdout=b"PRIVATE_PAYLOAD", stderr=b"PRIVATE_DIAGNOSTIC")]
        for case in cases:
            runner = mock.Mock(side_effect=case if isinstance(case, Exception) else None, return_value=case)
            with self.subTest(case=type(case).__name__), mock.patch.object(local, "require_windows"), self.assertRaises(local.LocalReleaseError) as caught:
                local.run_ssh(CONNECTION, b"fixture", runner)
            self.assertEqual(caught.exception.remote_outcome, "UNKNOWN")
            self.assertNotIn("PRIVATE_DIAGNOSTIC", str(caught.exception))
            self.assertNotIn("PRIVATE_PAYLOAD", str(caught.exception))
            runner.assert_called_once()
            self.assertEqual(runner.call_args.kwargs["stderr"], subprocess.DEVNULL)

    def test_main_refuses_existing_report_before_reading_connection(self):
        report = self.root / "existing-report.json"
        report.write_text("immutable", encoding="utf-8")
        with mock.patch.object(local, "load_connection") as load, contextlib.redirect_stdout(io.StringIO()):
            code = local.main(["preflight", "--connection", "unused.json", "--report", str(report)])
        self.assertEqual(code, 1)
        self.assertEqual(report.read_text(), "immutable")
        load.assert_not_called()

    def test_main_saves_safe_unknown_result_without_remote_payload(self):
        connection_file = self.root / "connection.json"
        connection_file.write_text(json.dumps(CONNECTION), encoding="utf-8")
        report = self.root / "new-report.json"
        failure = local.LocalReleaseError("ssh_timeout", "Inspect the journal before retrying.", "UNKNOWN")
        stdout = io.StringIO()
        with mock.patch.object(local, "preflight", side_effect=failure) as operation, contextlib.redirect_stdout(stdout):
            code = local.main(["preflight", "--connection", str(connection_file), "--report", str(report)])
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(report.read_text())["remote_outcome"], "UNKNOWN")
        self.assertNotIn(CONNECTION["key_file"], stdout.getvalue())
        operation.assert_called_once()
