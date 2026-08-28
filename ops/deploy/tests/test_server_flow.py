"""Actual deployment flow and files; Linux host/lock and WP CLI are explicit stubs."""
import contextlib
from dataclasses import replace
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest import mock
import zipfile

from test_server_archive import server, archive_bytes, manifest_for, PLUGIN


class FakeWp:
    """Synthetic command responses, not a WordPress or MySQL execution."""
    def __init__(self, failure=None):
        self.calls = []
        self.failure = failure
        self.version = "1.0.251"
        self.site_type = "single"
        self.after_install = None

    def __call__(self, config, arguments, timeout=180, file_limit=None):
        self.calls.append(tuple(arguments))
        head = tuple(arguments[:2])
        if head == self.failure:
            raise server.DeployError("fixture_wp_failed", "Synthetic command failure")
        return self.respond(config, arguments, head)

    def respond(self, config, arguments, head):
        if head == ("cli", "info"):
            return json.dumps({"php_version": "8.3.0", "wp_cli_version": "2.12.0"})
        if head == ("core", "version"):
            return "6.8.0"
        if arguments == ["eval", "echo is_multisite() ? 'multisite' : 'single';"]:
            return self.site_type
        if head == ("plugin", "get"):
            return json.dumps({"name": "setae-core", "status": "active", "version": self.version})
        if head == ("db", "query"):
            return "InnoDB\n"
        if head == ("db", "export"):
            Path(arguments[2]).write_text("-- synthetic test backup; not a database dump\n", encoding="utf-8")
            return ""
        if head == ("maintenance-mode", "activate"):
            (config.wp_root / ".maintenance").write_text("synthetic maintenance")
            return ""
        if head == ("maintenance-mode", "deactivate"):
            (config.wp_root / ".maintenance").unlink(missing_ok=True)
            return ""
        if head == ("plugin", "install"):
            with zipfile.ZipFile(arguments[2]) as archive:
                for entry in archive.infolist():
                    if not entry.is_dir():
                        target = config.plugin_dir / entry.filename.removeprefix("setae-core/")
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_bytes(archive.read(entry))
            self.version = server._header_version((config.plugin_dir / "setae-core.php").read_bytes())
            if self.after_install:
                self.after_install(config)
            return ""
        raise AssertionError("Unexpected WP command: " + repr(arguments))


class FlowTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="setae-flow-test-")
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name).resolve()
        self.config = server.Config(enabled=True, auth_ready=True, wp_root=root / "site",
                                    state_dir=root / "private", smoke_url="https://example.invalid/wp-json/")
        self.config.plugin_dir.mkdir(parents=True)
        self.config.state_dir.mkdir()
        (self.config.plugin_dir / "setae-core.php").write_bytes(PLUGIN.replace(b"1.0.251.1", b"1.0.251"))
        self.archive = self.config.state_dir / "incoming.zip"
        self.data = archive_bytes()
        self.archive.write_bytes(self.data)
        self.manifest = manifest_for(self.data)
        self.runner = FakeWp()
        self.smoke = mock.Mock(return_value={"http_status": 200, "namespace": "setae/v1"})
        self.patches = contextlib.ExitStack()
        self.addCleanup(self.patches.close)
        # Windows does not establish Linux UID/ownership/flock guarantees.
        self.patches.enter_context(mock.patch.object(server, "validate_host"))
        self.patches.enter_context(mock.patch.object(server, "FileLock", side_effect=lambda path: contextlib.nullcontext()))
        self.patches.enter_context(mock.patch.object(server.shutil, "disk_usage", return_value=types.SimpleNamespace(free=4 * 1024 ** 3)))

    def deploy(self):
        return server.deploy(self.config, self.manifest, self.archive, runner=self.runner, smoke=self.smoke)

    def commands(self, first):
        return [call for call in self.runner.calls if call[0] == first]

    def test_disabled_or_unauthorized_does_not_invoke_wordpress(self):
        original = self.config
        for field in ("enabled", "auth_ready"):
            self.config = replace(original, **{field: False})
            with self.subTest(field=field), self.assertRaises(server.DeployError):
                self.deploy()
            self.assertEqual(self.runner.calls, [])
        self.smoke.assert_not_called()

    def test_busy_lock_stops_before_any_wordpress_command(self):
        with mock.patch.object(server, "FileLock", side_effect=server.DeployError("deployment_busy", "Synthetic busy lock")):
            with self.assertRaises(server.DeployError) as caught:
                self.deploy()
        self.assertEqual(caught.exception.code, "deployment_busy")
        self.assertEqual(self.runner.calls, [])

    def test_backup_failure_does_not_install_or_enter_maintenance(self):
        self.runner = FakeWp(failure=("db", "export"))
        with self.assertRaises(server.DeployError):
            self.deploy()
        self.assertNotIn(("plugin", "install"), [call[:2] for call in self.runner.calls])
        self.assertEqual(self.commands("maintenance-mode"), [])
        self.assertFalse((self.config.wp_root / ".maintenance").exists())

    def test_install_failure_keeps_block_and_refuses_retry(self):
        self.runner = FakeWp(failure=("plugin", "install"))
        with self.assertRaises(server.DeployError):
            self.deploy()
        recovery = json.loads((self.config.state_dir / server.BLOCK_FILE).read_text())
        self.assertIs(recovery["code_rolled_back"], False)
        self.assertIs(recovery["database_restored"], False)
        self.assertTrue((self.config.wp_root / ".maintenance").exists())
        self.assertNotIn(("maintenance-mode", "deactivate"), self.runner.calls)
        calls = list(self.runner.calls)
        with self.assertRaises(server.DeployError) as caught:
            self.deploy()
        self.assertEqual(caught.exception.code, "deployment_blocked")
        self.assertEqual(self.runner.calls, calls)

    def test_health_failure_reenters_maintenance_without_rollback(self):
        self.smoke.side_effect = server.DeployError("smoke_failed", "Synthetic HTTP failure")
        with self.assertRaises(server.DeployError):
            self.deploy()
        self.assertTrue((self.config.wp_root / ".maintenance").exists())
        self.assertTrue((self.config.state_dir / server.BLOCK_FILE).exists())
        self.assertEqual(self.runner.calls[-1], ("maintenance-mode", "activate"))
        self.assertEqual((self.config.plugin_dir / "setae-core.php").read_bytes(), PLUGIN)
        self.assertNotIn(("db", "import"), [call[:2] for call in self.runner.calls])

    def test_preflight_is_read_only_and_reports_disabled(self):
        result = server.preflight(replace(self.config, enabled=False, auth_ready=False), runner=self.runner)
        self.assertIs(result["deployment_ready"], False)
        self.assertEqual(self.commands("db"), [])
        self.assertEqual(self.commands("maintenance-mode"), [])
        self.assertNotIn(("plugin", "install"), [call[:2] for call in self.runner.calls])

    def test_multisite_is_rejected_before_backup(self):
        self.runner.site_type = "multisite"
        with self.assertRaises(server.DeployError):
            self.deploy()
        self.assertEqual(self.commands("db"), [])

    def test_installing_an_extra_file_is_not_success(self):
        self.runner.after_install = lambda config: (config.plugin_dir / "unexpected.php").write_bytes(b"extra")
        with self.assertRaises(server.DeployError):
            self.deploy()
        self.assertTrue((self.config.state_dir / server.BLOCK_FILE).exists())
        self.smoke.assert_not_called()

    def test_tampered_installed_bytes_are_not_success(self):
        self.runner.after_install = lambda config: (config.plugin_dir / "setae-core.php").write_bytes(PLUGIN + b"\n// extra")
        with self.assertRaises(server.DeployError):
            self.deploy()
        self.assertTrue((self.config.state_dir / server.BLOCK_FILE).exists())

    def test_success_has_real_backups_and_no_automatic_restore(self):
        result = self.deploy()
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["sha256"], self.manifest["sha256"])
        self.assertIs(result["database_restored"], False)
        self.assertFalse((self.config.state_dir / server.BLOCK_FILE).exists())
        self.assertFalse((self.config.wp_root / ".maintenance").exists())
        backup = self.config.state_dir / "backups" / result["backup_id"]
        record = json.loads((backup / "backup.json").read_text(encoding="utf-8"))
        self.assertIs(record["complete"], True)
        self.assertTrue((backup / "database.sql").read_bytes())
        with zipfile.ZipFile(backup / "current-code.zip") as archive:
            self.assertEqual(archive.read(server.HEADER), PLUGIN.replace(b"1.0.251.1", b"1.0.251"))
        self.assertEqual(self.archive.read_bytes(), self.data)
        heads = [call[:2] for call in self.runner.calls]
        self.assertLess(heads.index(("db", "export")), heads.index(("maintenance-mode", "activate")))
        self.assertLess(heads.index(("maintenance-mode", "activate")), heads.index(("plugin", "install")))
        self.smoke.assert_called_once_with(self.config)
