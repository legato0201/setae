"""Actual bootstrap logic; OS ownership, accounts, sudo, SSH and WP are stubs.

These tests do not establish that installation works on a real Ubuntu host.
"""
import base64
import contextlib
import hashlib
import io
import json
from pathlib import Path
import stat
import struct
import subprocess
import sys
import tempfile
import types
import unittest
from unittest import mock

SERVER = Path(__file__).resolve().parents[1] / "server"
sys.path.insert(0, str(SERVER))
import bootstrap_ubuntu as bootstrap


def ssh_string(value):
    return struct.pack(">I", len(value)) + value


KEY_WIRE = ssh_string(b"ssh-ed25519") + ssh_string(bytes(range(32)))
KEY = "ssh-ed25519 " + base64.b64encode(KEY_WIRE).decode("ascii")


class FakeHost(bootstrap.Host):
    """Real temporary files with synthetic Linux ownership and command results."""
    def __init__(self, paths):
        self.paths = paths
        self.metadata = {}
        self.ownership_calls = []
        self.sync_calls = []
        self.commands = []
        self.on_ownership = None
        self.deploy_user = None
        self.service_user = types.SimpleNamespace(pw_uid=33, pw_gid=33)
        self.ssh_settings = sshd_settings()
        self.ssh_settings["hostkey"] = ["/etc/ssh/ssh_host_ed25519_key"]
        self.fail_preflight = None
        self.preflight_states = []
        self.fail_rest = False
        self.allow_unsafe_sudo = False
        self.allow_preserved_environment = False
        self.busy = False
        self.platform_checks = 0

    def info(self, path):
        path = Path(path)
        actual = path.lstat()
        defaults = {
            "st_uid": 0, "st_gid": 0, "st_nlink": actual.st_nlink, "st_size": actual.st_size,
            "st_mode": stat.S_IFMT(actual.st_mode) | (0o755 if path.is_dir() else 0o644),
        }
        defaults.update(self.metadata.get(path, {}))
        return types.SimpleNamespace(**defaults)

    def ownership(self, path, uid, gid, mode):
        path = Path(path)
        kind = stat.S_IFMT(path.lstat().st_mode)
        self.metadata[path] = {"st_uid": uid, "st_gid": gid, "st_mode": kind | mode}
        self.ownership_calls.append((path, uid, gid, mode))
        if self.on_ownership:
            self.on_ownership(path)

    def sync_directory(self, path):
        self.sync_calls.append(Path(path))

    def check_platform(self):
        self.platform_checks += 1

    def user(self, name):
        if name == bootstrap.SERVICE_USER:
            return self.service_user
        if name == bootstrap.DEPLOY_USER:
            return self.deploy_user
        raise AssertionError("Unexpected account lookup: " + name)

    def group(self, name):
        if name != bootstrap.DEPLOY_USER:
            raise AssertionError("Unexpected group lookup: " + name)
        return None if self.deploy_user is None else types.SimpleNamespace(gr_gid=991, gr_mem=[])

    def user_groups(self, name):
        if name != bootstrap.DEPLOY_USER:
            raise AssertionError("Unexpected supplementary-group lookup")
        return []

    def shadow(self, name):
        if name != bootstrap.DEPLOY_USER:
            raise AssertionError("Unexpected shadow lookup")
        return None if self.deploy_user is None else types.SimpleNamespace(sp_pwdp=bootstrap.NO_PASSWORD, sp_expire=-1)

    @contextlib.contextmanager
    def lock(self, path, paths):
        if self.busy:
            raise bootstrap.BootstrapError("bootstrap_busy", "Synthetic busy lock")
        yield

    def make_account(self):
        self.deploy_user = types.SimpleNamespace(
            pw_uid=991, pw_gid=991, pw_dir=bootstrap.SSH_HOME,
            pw_shell="/bin/sh", pw_gecos=bootstrap.ACCOUNT_COMMENT)

    def run(self, argv, *, input=b"", timeout=bootstrap.COMMAND_TIMEOUT):
        """Enumerated simulated commands only: never delegates to subprocess."""
        self.commands.append((list(argv), input))
        output, error, code = b"", b"", 0
        if argv == ["/usr/sbin/visudo", "-c"]:
            pass
        elif argv[:4] == ["/usr/sbin/visudo", "-c", "-f", str(self.paths.at("/etc/setae-deploy/sudoers.candidate"))] and len(argv) == 4:
            assert Path(argv[3]).read_bytes() == bootstrap.sudoers_text()
        elif argv in (["/usr/sbin/sshd", "-T"], ["/usr/sbin/sshd", "-T", "-C", "user=setae-deploy,host=localhost,addr=127.0.0.1,laddr=127.0.0.1,lport=22"]):
            output = "\n".join(key + " " + value for key, values in self.ssh_settings.items() for value in values).encode()
        elif argv == ["/usr/sbin/useradd", "--system", "--user-group", "--no-create-home", "--no-log-init",
                      "--home-dir", bootstrap.SSH_HOME, "--shell", "/bin/sh", "--comment", bootstrap.ACCOUNT_COMMENT,
                      "--password", bootstrap.NO_PASSWORD, "--expiredate", "", bootstrap.DEPLOY_USER]:
            assert self.deploy_user is None
            self.make_account()
        elif argv == ["/usr/bin/sudo", "-n", "-ll", "-U", bootstrap.DEPLOY_USER]:
            output = ('Sudoers entry:\n RunAsUsers: www-data\n Options: !authenticate, !setenv\n Commands:\n ' + bootstrap.WRAPPER + ' ""\n').encode()
        elif argv[:5] == ["/usr/bin/sudo", "-n", "-l", "-U", bootstrap.DEPLOY_USER]:
            positive = ["-u", bootstrap.SERVICE_USER, "--", bootstrap.WRAPPER]
            negatives = [positive + ["unexpected-argument"], ["-u", "root", "--", bootstrap.WRAPPER],
                         ["-u", bootstrap.SERVICE_USER, "--", "/bin/sh"], ["-u", "root", "--", "/bin/sh"]]
            assert argv[5:] == positive or argv[5:] in negatives
            code = 0 if argv[5:] == positive or self.allow_unsafe_sudo else 1
        else:
            return self.run_service_command(argv, input)
        return subprocess.CompletedProcess(argv, code, output, error)

    def run_service_command(self, argv, input):
        direct = ["/usr/sbin/runuser", "--user", bootstrap.SERVICE_USER, "--", bootstrap.WRAPPER]
        forced = ["/usr/sbin/runuser", "--user", bootstrap.DEPLOY_USER, "--", "/bin/sh", "-c", bootstrap.FORCED_COMMAND]
        probe = ["/usr/sbin/runuser", "--user", bootstrap.SERVICE_USER, "--", bootstrap.PYTHON, "-I", "-c", bootstrap.REST_PROBE_CODE]
        preserve = ["/usr/sbin/runuser", "--user", bootstrap.DEPLOY_USER, "--", "/usr/bin/sudo", "-n", "-E", "-u", bootstrap.SERVICE_USER, "--", bootstrap.WRAPPER]
        if argv == preserve:
            assert input == bootstrap.PREFLIGHT_INPUT
            return subprocess.CompletedProcess(argv, 0 if self.allow_preserved_environment else 1, b"", b"")
        if argv in (direct, forced):
            assert input == bootstrap.PREFLIGHT_INPUT
            config = json.loads(self.paths.at(bootstrap.CONFIG).read_bytes())
            phase = "enabled" if config["enabled"] else "direct" if argv == direct else "forced"
            self.preflight_states.append((phase, config["enabled"]))
            if self.fail_preflight == phase:
                return subprocess.CompletedProcess(argv, 1, b"SYNTHETIC_PRIVATE_OUTPUT", b"SYNTHETIC_PRIVATE_STDERR")
            return subprocess.CompletedProcess(argv, 0, json.dumps(preflight_result(config["enabled"])).encode(), b"")
        if argv == probe:
            assert not input
            if self.fail_rest:
                return subprocess.CompletedProcess(argv, 1, b"", b"SYNTHETIC_PRIVATE_REST_ERROR")
            result = {"status": "success", "smoke_url": "https://example.invalid/index.php?rest_route=/",
                      "smoke": {"http_status": 200, "namespace": "setae/v1"}}
            return subprocess.CompletedProcess(argv, 0, json.dumps(result).encode(), b"")
        raise AssertionError("Unexpected external command (no fallback): " + repr(argv))


class BootstrapFilesystemTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="setae-bootstrap-fs-")
        self.addCleanup(self.directory.cleanup)
        self.paths = bootstrap.Paths(Path(self.directory.name).resolve())
        self.host = FakeHost(self.paths)
        self.file = self.paths.at(bootstrap.MODULE)
        self.file.parent.mkdir(parents=True)

    def test_root_payload_copy_is_exact_and_only_identical_existing_bytes_are_reused(self):
        payload = bootstrap.verified_payloads(SERVER)["setae_deploy.py"]
        self.assertTrue(bootstrap.ensure_file(self.file, payload, self.host, self.paths, 0o644))
        self.assertEqual(hashlib.sha256(self.file.read_bytes()).digest(), hashlib.sha256(payload).digest())
        self.assertIn((self.file, 0, 0, 0o644), self.host.ownership_calls)
        self.assertFalse(bootstrap.ensure_file(self.file, payload, self.host, self.paths, 0o644))

    def test_unknown_existing_file_is_never_overwritten(self):
        existing = b"unknown existing administrator file"
        self.file.write_bytes(existing)
        with self.assertRaises(bootstrap.BootstrapError) as caught:
            bootstrap.ensure_file(self.file, b"replacement", self.host, self.paths, 0o644)
        self.assertEqual(caught.exception.code, "existing_file_conflict")
        self.assertEqual(self.file.read_bytes(), existing)
        self.assertEqual(self.host.ownership_calls, [])

    def test_writable_nonroot_or_linked_existing_files_are_rejected(self):
        self.file.write_bytes(b"same")
        bad = ({"st_uid": 1000}, {"st_gid": 1000}, {"st_nlink": 2},
               {"st_mode": stat.S_IFREG | 0o666}, {"st_mode": stat.S_IFLNK | 0o777})
        for metadata in bad:
            self.host.metadata[self.file] = metadata
            with self.subTest(metadata=metadata), self.assertRaises(bootstrap.BootstrapError):
                bootstrap.ensure_file(self.file, b"same", self.host, self.paths, 0o644)
        self.assertEqual(self.host.ownership_calls, [])

    def test_unsafe_parent_and_escaped_path_stop_before_creation(self):
        self.host.metadata[self.file.parent] = {"st_uid": 1000}
        with self.assertRaises(bootstrap.BootstrapError):
            bootstrap.ensure_file(self.file, b"new", self.host, self.paths, 0o644)
        self.assertFalse(self.file.exists())
        with self.assertRaises(bootstrap.BootstrapError):
            list(bootstrap.ancestors(Path(self.directory.name).parent / "outside", self.paths))

    def test_replace_requires_the_current_owned_bytes(self):
        self.file.write_bytes(b"concurrent unknown bytes")
        with self.assertRaises(bootstrap.BootstrapError) as caught:
            bootstrap.replace_owned_file(self.file, b"expected old", b"new", self.host, self.paths, 0o644)
        self.assertEqual(caught.exception.code, "managed_file_changed")
        self.assertEqual(self.file.read_bytes(), b"concurrent unknown bytes")


class BootstrapFlowTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="setae-bootstrap-flow-")
        self.addCleanup(self.directory.cleanup)
        self.paths = bootstrap.Paths(Path(self.directory.name).resolve())
        self.host = FakeHost(self.paths)
        for directory in ("/usr/local/lib", "/usr/local/sbin", "/etc/sudoers.d", "/var/lib", "/run",
                          "/etc/ssh/sshd_config.d"):
            self.paths.at(directory).mkdir(parents=True, exist_ok=True)
        self.make_file("/etc/os-release", b'ID=ubuntu\nVERSION_ID="24.04"\n')
        self.make_file("/etc/ssh/sshd_config", b"Include /etc/ssh/sshd_config.d/*.conf\n")
        self.make_file("/etc/ssh/ssh_host_ed25519_key.pub", (KEY + "\n").encode())
        for fixed in (bootstrap.PYTHON, bootstrap.PHP, bootstrap.WP_CLI, "/usr/bin/sudo", "/usr/sbin/visudo",
                      "/usr/sbin/sshd", "/usr/sbin/useradd", "/usr/sbin/runuser", "/bin/sh"):
            self.make_file(fixed, b"synthetic non-executed OS dependency", 0o755)
        self.original_wp = {
            "wp-config.php": b"synthetic WordPress config; no credentials",
            "wp-load.php": b"synthetic WordPress loader",
            "wp-content/plugins/setae-core/setae-core.php": b"original plugin sentinel; never execute or replace",
        }
        for relative, content in self.original_wp.items():
            self.make_file(bootstrap.WP_ROOT + "/" + relative, content)

    def make_file(self, fixed, content, mode=0o644):
        path = self.paths.at(fixed)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        self.host.metadata[path] = {"st_uid": 0, "st_gid": 0, "st_mode": stat.S_IFREG | mode}
        return path

    def install(self, enable=False):
        return bootstrap.bootstrap(SERVER, KEY, enable, paths=self.paths, host=self.host)

    def config(self):
        return json.loads(self.paths.at(bootstrap.CONFIG).read_bytes())

    def assert_wordpress_unchanged(self):
        for relative, content in self.original_wp.items():
            self.assertEqual(self.paths.at(bootstrap.WP_ROOT + "/" + relative).read_bytes(), content)
        for argv, input_data in self.host.commands:
            if input_data:
                self.assertEqual(json.loads(input_data), {"protocol_version": 1, "operation": "preflight"})
            self.assertNotIn("--allow-root", argv)
            self.assertNotIn("install", argv)
            self.assertNotIn("update", argv)
            self.assertNotIn("import", argv)
            self.assertNotIn("export", argv)

    def test_first_setup_stays_disabled_without_updating_wordpress(self):
        result = self.install()
        self.assertEqual(result["status"], "success")
        self.assertIs(result["updates_enabled"], False)
        for key in ("plugin_update_performed", "plugin_backup_performed", "database_backup_performed",
                    "database_write_requested", "sshd_configuration_modified", "existing_user_modified",
                    "remote_ssh_authentication_verified"):
            self.assertIs(result[key], False)
        self.assertIs(self.config()["enabled"], False)
        self.assertIs(self.config()["auth_ready"], False)
        self.assertEqual(self.config()["php_path"], "/usr/bin/php")
        self.assertEqual(self.host.preflight_states, [("direct", False), ("forced", False)])
        self.assert_wordpress_unchanged()

    def test_copied_files_and_readable_root_managed_keys_have_exact_content_and_modes(self):
        self.install()
        expected = {
            bootstrap.WRAPPER: ((SERVER / "setae-deploy").read_bytes(), 0o755),
            bootstrap.MODULE: ((SERVER / "setae_deploy.py").read_bytes(), 0o644),
            bootstrap.SUDOERS: (bootstrap.sudoers_text(), 0o440),
            bootstrap.SSH_HOME + "/.ssh/authorized_keys": (bootstrap.authorized_key_line(KEY), 0o644),
        }
        for fixed, (content, mode) in expected.items():
            path = self.paths.at(fixed)
            self.assertEqual(hashlib.sha256(path.read_bytes()).digest(), hashlib.sha256(content).digest())
            info = self.host.info(path)
            self.assertEqual((info.st_uid, info.st_gid, stat.S_IMODE(info.st_mode)), (0, 0, mode))
        for fixed in (bootstrap.SSH_HOME, bootstrap.SSH_HOME + "/.ssh"):
            info = self.host.info(self.paths.at(fixed))
            self.assertEqual((info.st_uid, stat.S_IMODE(info.st_mode)), (0, 0o755))
        state = self.host.info(self.paths.at(bootstrap.STATE))
        self.assertEqual((state.st_uid, state.st_gid, stat.S_IMODE(state.st_mode)), (33, 33, 0o700))

    def test_explicit_enable_happens_after_both_disabled_preflights(self):
        result = self.install(True)
        self.assertIs(result["updates_enabled"], True)
        self.assertIs(self.config()["enabled"], True)
        self.assertEqual(self.host.preflight_states, [("direct", False), ("forced", False), ("enabled", True)])
        service_calls = [argv for argv, _ in self.host.commands if argv[0] == "/usr/sbin/runuser"]
        self.assertTrue(service_calls)
        for argv in service_calls:
            self.assertIn(argv[2], ("www-data", "setae-deploy"))
            if argv[2] == "setae-deploy":
                self.assertTrue(argv[-1] == bootstrap.WRAPPER or argv[-1] == bootstrap.FORCED_COMMAND)
        self.assert_wordpress_unchanged()

    def test_unrelated_denyusers_allows_setup_without_any_ssh_configuration_change(self):
        self.host.ssh_settings["denyusers"] = ["mail"]
        self.make_file("/etc/ssh/sshd_config", b"Include /etc/ssh/sshd_config.d/*.conf\nDenyUsers mail\n")
        self.make_file("/etc/ssh/sshd_config.d/10-existing.conf", b"# Existing administrator configuration\n")
        ssh_root = self.paths.at("/etc/ssh")
        before = {path.relative_to(ssh_root): path.read_bytes()
                  for path in ssh_root.rglob("*") if path.is_file()}
        settings_before = json.dumps(self.host.ssh_settings, sort_keys=True)

        result = self.install(True)

        self.assertEqual(result["status"], "success")
        self.assertIs(result["updates_enabled"], True)
        self.assertIs(result["sshd_configuration_modified"], False)
        self.assertEqual(self.host.preflight_states, [("direct", False), ("forced", False), ("enabled", True)])
        self.assertEqual({path.relative_to(ssh_root): path.read_bytes()
                          for path in ssh_root.rglob("*") if path.is_file()}, before)
        self.assertEqual(json.dumps(self.host.ssh_settings, sort_keys=True), settings_before)
        self.assertFalse(any(path == ssh_root or ssh_root in path.parents
                             for path, _, _, _ in self.host.ownership_calls))
        self.assertEqual(sum(argv[0] == "/usr/sbin/useradd" for argv, _ in self.host.commands), 1)
        self.assert_wordpress_unchanged()

    def test_denied_or_unsupported_access_rules_stop_before_managed_writes_or_accounts(self):
        cases = [
            {"denyusers": [bootstrap.DEPLOY_USER]},
            {"denyusers": ["mail", "backup " + bootstrap.DEPLOY_USER]},
            {"denyusers": ["mail", "backup*"]},
            {"denyusers": ["!mail"]},
            {"denyusers": ["mail@localhost"]},
            {"denyusers": ["1000"]},
            {"denyusers": [""]},
            {"denyusers": ["mail"], "allowusers": ["owner"]},
            {"denyusers": ["mail"], "allowgroups": ["ssh-users"]},
            {"denyusers": ["mail"], "denygroups": ["mail"]},
        ]
        directive_names = {"denyusers": "DenyUsers", "allowusers": "AllowUsers",
                           "allowgroups": "AllowGroups", "denygroups": "DenyGroups"}
        for rules in cases:
            with self.subTest(rules=rules):
                self.host.ssh_settings = {**sshd_settings(), "hostkey": ["/etc/ssh/ssh_host_ed25519_key"], **rules}
                self.host.commands.clear()
                content = "Include /etc/ssh/sshd_config.d/*.conf\n" + "".join(
                    directive_names[key] + " " + line + "\n" for key, lines in rules.items() for line in lines)
                self.make_file("/etc/ssh/sshd_config", content.encode("ascii"))
                before = {path.relative_to(self.paths.root): None if path.is_dir() else path.read_bytes()
                          for path in self.paths.root.rglob("*")}

                with self.assertRaises(bootstrap.BootstrapError) as caught:
                    self.install(True)

                self.assertEqual(caught.exception.code, "sshd_access_rules")
                self.assertEqual({path.relative_to(self.paths.root): None if path.is_dir() else path.read_bytes()
                                  for path in self.paths.root.rglob("*")}, before)
                for fixed in (bootstrap.WRAPPER, bootstrap.MODULE, bootstrap.CONFIG, bootstrap.RECEIPT,
                              bootstrap.SUDOERS, bootstrap.STATE, bootstrap.SSH_HOME):
                    self.assertFalse(self.paths.at(fixed).exists(), fixed)
                self.assertIsNone(self.host.deploy_user)
                self.assertEqual(self.host.ownership_calls, [])
                self.assertEqual(self.host.preflight_states, [])
                self.assertEqual([argv for argv, _ in self.host.commands],
                                 [["/usr/sbin/visudo", "-c"], ["/usr/sbin/sshd", "-T"]])
                self.assert_wordpress_unchanged()

    def test_unknown_existing_account_is_not_adopted_or_modified(self):
        self.host.make_account()
        original = vars(self.host.deploy_user).copy()
        with self.assertRaises(bootstrap.BootstrapError) as caught:
            self.install(True)
        self.assertEqual(caught.exception.code, "existing_account")
        self.assertEqual(vars(self.host.deploy_user), original)
        self.assertFalse(self.paths.at(bootstrap.RECEIPT).exists())
        self.assertFalse(any(argv[0] == "/usr/sbin/useradd" for argv, _ in self.host.commands))
        self.assert_wordpress_unchanged()

    def test_unknown_existing_config_is_not_replaced(self):
        unknown = b'{"enabled":true,"unrecognized":"administrator-owned"}\n'
        self.make_file(bootstrap.CONFIG, unknown)
        with self.assertRaises(bootstrap.BootstrapError) as caught:
            self.install(True)
        self.assertEqual(caught.exception.code, "existing_config")
        self.assertEqual(self.paths.at(bootstrap.CONFIG).read_bytes(), unknown)
        self.assertIsNone(self.host.deploy_user)

    def test_copy_readback_detects_altered_module_before_any_enable(self):
        module = self.paths.at(bootstrap.MODULE)
        def alter_copy(path):
            if path == module:
                path.write_bytes(path.read_bytes() + b"\n# injected after copy\n")
        self.host.on_ownership = alter_copy
        with self.assertRaises(bootstrap.BootstrapError) as caught:
            self.install(True)
        self.assertEqual(caught.exception.code, "copy_verification")
        self.assertFalse(self.paths.at(bootstrap.CONFIG).exists())
        self.assertEqual(self.host.preflight_states, [])
        self.assertIsNone(self.host.deploy_user)
        self.assert_wordpress_unchanged()

    def test_initial_preflight_failure_leaves_updates_disabled(self):
        self.host.fail_preflight = "direct"
        with self.assertRaises(bootstrap.BootstrapError) as caught:
            self.install(True)
        self.assertEqual(caught.exception.code, "preflight_failed")
        self.assertNotIn("SYNTHETIC_PRIVATE", str(caught.exception))
        self.assertIs(self.config()["enabled"], False)
        self.assertIs(self.config()["auth_ready"], False)
        self.assert_wordpress_unchanged()

    def test_forced_command_preflight_failure_never_enables_updates(self):
        self.host.fail_preflight = "forced"
        with self.assertRaises(bootstrap.BootstrapError) as caught:
            self.install(True)
        self.assertEqual(caught.exception.code, "forced_command_failed")
        self.assertIs(self.config()["enabled"], False)
        self.assertEqual(self.host.preflight_states, [("direct", False), ("forced", False)])

    def test_failed_enabled_recheck_restores_disabled_configuration(self):
        self.host.fail_preflight = "enabled"
        with self.assertRaises(bootstrap.BootstrapError) as caught:
            self.install(True)
        self.assertEqual(caught.exception.code, "enabled_preflight_failed")
        self.assertIs(self.config()["enabled"], False)
        self.assertIs(self.config()["auth_ready"], False)
        receipt = json.loads(self.paths.at(bootstrap.RECEIPT).read_bytes())
        self.assertEqual(receipt["phase"], "verified")
        self.assertEqual(receipt["config_sha256"], hashlib.sha256(self.paths.at(bootstrap.CONFIG).read_bytes()).hexdigest())
        self.assert_wordpress_unchanged()

    def test_rest_failure_remains_disabled_and_hides_diagnostics(self):
        self.host.fail_rest = True
        with self.assertRaises(bootstrap.BootstrapError) as caught:
            self.install(True)
        self.assertEqual(caught.exception.code, "rest_probe_failed")
        self.assertNotIn("SYNTHETIC_PRIVATE", str(caught.exception))
        self.assertIs(self.config()["enabled"], False)
        self.assert_wordpress_unchanged()

    def test_unexpected_sudo_privilege_is_not_accepted(self):
        self.host.allow_unsafe_sudo = True
        with self.assertRaises(bootstrap.BootstrapError) as caught:
            self.install(True)
        self.assertEqual(caught.exception.code, "sudo_policy")
        self.assertIs(self.config()["enabled"], False)
        self.assertEqual(self.host.preflight_states, [])

    def test_preserving_environment_is_denied_before_enable(self):
        self.host.allow_preserved_environment = True
        with self.assertRaises(bootstrap.BootstrapError) as caught:
            self.install(True)
        self.assertEqual(caught.exception.code, "sudo_environment")
        self.assertIs(self.config()["enabled"], False)
        self.assertEqual(self.host.preflight_states, [("direct", False), ("forced", False)])

    def test_known_complete_setup_rechecks_without_recreating_account(self):
        self.install(False)
        result = self.install(True)
        self.assertIs(result["updates_enabled"], True)
        self.assertEqual(sum(argv[0] == "/usr/sbin/useradd" for argv, _ in self.host.commands), 1)
        self.assert_wordpress_unchanged()

    def test_unsupported_os_or_conditional_sshd_rules_stop_before_managed_writes(self):
        self.make_file("/etc/os-release", b'ID=ubuntu\nVERSION_ID="22.04"\n')
        with self.assertRaises(bootstrap.BootstrapError) as caught:
            self.install(True)
        self.assertEqual(caught.exception.code, "ubuntu_version")
        self.assertEqual(self.host.commands, [])
        self.make_file("/etc/os-release", b'ID=ubuntu\nVERSION_ID="24.04"\n')
        self.make_file("/etc/ssh/sshd_config", b"Match User existing-admin\n PasswordAuthentication no\n")
        with self.assertRaises(bootstrap.BootstrapError) as caught:
            self.install(True)
        self.assertEqual(caught.exception.code, "sshd_match")
        self.assertFalse(self.paths.at(bootstrap.RECEIPT).exists())
        self.assertIsNone(self.host.deploy_user)


def preflight_result(enabled=False):
    return {
        "status": "success", "operation": "preflight", "version": "1.0.251.1",
        "wordpress_version": "6.8.0", "php_version": "8.3.0", "wp_cli_version": "2.12.0",
        "php_cli_compatible": True, "tested_php_cli_minor": "8.3",
        "enabled": enabled, "auth_ready": enabled, "deployment_ready": enabled,
        "manual_recovery_required": False, "maintenance_file_present": False,
    }


class BootstrapPreflightTests(unittest.TestCase):
    def test_disabled_preflight_succeeds_without_enabling_updates(self):
        value = preflight_result()
        result = bootstrap.parse_preflight(json.dumps(value).encode(), expected_enabled=False)
        self.assertIs(result["enabled"], False)
        self.assertIs(result["deployment_ready"], False)

    def test_enabled_preflight_requires_consistent_ready_state(self):
        value = preflight_result(True)
        result = bootstrap.parse_preflight(json.dumps(value).encode(), expected_enabled=True)
        self.assertIs(result["enabled"], True)
        self.assertIs(result["deployment_ready"], True)
        for key in ("enabled", "auth_ready", "deployment_ready"):
            invalid = {**value, key: False}
            with self.subTest(key=key), self.assertRaises(bootstrap.BootstrapError):
                bootstrap.parse_preflight(json.dumps(invalid).encode(), expected_enabled=True)

    def test_preflight_blocks_failures_incompatibility_and_recovery_conditions(self):
        invalid_fields = {
            "status": "error", "operation": "deploy", "php_cli_compatible": False,
            "manual_recovery_required": True, "maintenance_file_present": True,
            "enabled": True, "auth_ready": True, "deployment_ready": True,
        }
        for key, value in invalid_fields.items():
            invalid = {**preflight_result(), key: value}
            with self.subTest(key=key), self.assertRaises(bootstrap.BootstrapError):
                bootstrap.parse_preflight(json.dumps(invalid).encode(), expected_enabled=False)

    def test_malformed_preflight_does_not_expose_private_diagnostics(self):
        secret = "SYNTHETIC_PRIVATE_STDERR_DO_NOT_PRINT"
        for value in (b"not json", b"null", b"[]", b"{}", json.dumps({"status": "error", "message": secret}).encode()):
            with self.subTest(value=value), self.assertRaises(bootstrap.BootstrapError) as caught:
                bootstrap.parse_preflight(value)
            self.assertNotIn(secret, str(caught.exception))

    def test_preflight_booleans_and_php_minor_are_not_inferred(self):
        for key in ("enabled", "auth_ready", "deployment_ready", "php_cli_compatible",
                    "manual_recovery_required", "maintenance_file_present"):
            for invalid in (0, 1, "false", None):
                value = {**preflight_result(), key: invalid}
                with self.subTest(key=key, invalid=invalid), self.assertRaises(bootstrap.BootstrapError):
                    bootstrap.parse_preflight(json.dumps(value).encode())
        for key, invalid in (("tested_php_cli_minor", "8.4"), ("php_version", "8.4.0")):
            value = {**preflight_result(), key: invalid}
            with self.subTest(key=key), self.assertRaises(bootstrap.BootstrapError):
                bootstrap.parse_preflight(json.dumps(value).encode())


def sshd_settings():
    values = {
        "pubkeyauthentication": "yes", "strictmodes": "yes", "forcecommand": "none",
        "chrootdirectory": "none", "authorizedkeyscommand": "none",
        "authorizedprincipalscommand": "none", "trustedusercakeys": "none",
        "permituserenvironment": "no", "hostbasedauthentication": "no",
        "gssapiauthentication": "no", "kerberosauthentication": "no",
        "kbdinteractiveauthentication": "no", "authenticationmethods": "publickey",
        "permittunnel": "no", "revokedkeys": "none", "acceptenv": "LANG LC_*",
        "authorizedkeysfile": ".ssh/authorized_keys .ssh/authorized_keys2",
        "pubkeyacceptedalgorithms": "ssh-ed25519,rsa-sha2-512",
    }
    return {key: [value] for key, value in values.items()}


class BootstrapSshPolicyTests(unittest.TestCase):
    def test_supported_existing_ssh_policy_is_only_validated(self):
        settings = sshd_settings()
        before = json.dumps(settings, sort_keys=True)
        bootstrap.validate_sshd_settings(settings)
        self.assertEqual(json.dumps(settings, sort_keys=True), before)

    def test_unrelated_denyusers_mail_is_accepted_without_changing_settings(self):
        settings = {**sshd_settings(), "denyusers": ["mail"]}
        before = json.dumps(settings, sort_keys=True)
        bootstrap.validate_sshd_settings(settings)
        self.assertEqual(json.dumps(settings, sort_keys=True), before)

    def test_unrelated_literal_denyusers_support_multiple_tokens_and_lines(self):
        cases = [
            ["mail backup"],
            ["mail", "backup", "_service"],
            ["  mail\tbackup  ", "legacy.user old-service Service_2 machine$"],
            ["a" * 64, "b" * 64 + "$"],
        ]
        for lines in cases:
            settings = {**sshd_settings(), "denyusers": lines}
            before = json.dumps(settings, sort_keys=True)
            with self.subTest(lines=lines):
                bootstrap.validate_sshd_settings(settings)
                self.assertEqual(json.dumps(settings, sort_keys=True), before)

    def test_deployment_account_is_rejected_in_any_denyusers_position(self):
        cases = [
            [bootstrap.DEPLOY_USER],
            [bootstrap.DEPLOY_USER + " mail"],
            ["mail " + bootstrap.DEPLOY_USER + " backup"],
            ["mail backup " + bootstrap.DEPLOY_USER],
            ["mail", "backup", "\t" + bootstrap.DEPLOY_USER + "  "],
        ]
        for lines in cases:
            settings = {**sshd_settings(), "denyusers": lines}
            before = json.dumps(settings, sort_keys=True)
            with self.subTest(lines=lines):
                with self.assertRaises(bootstrap.BootstrapError) as caught:
                    bootstrap.validate_sshd_settings(settings)
                self.assertEqual(caught.exception.code, "sshd_access_rules")
                self.assertEqual(json.dumps(settings, sort_keys=True), before)

    def test_denyusers_patterns_and_unsupported_literals_are_rejected(self):
        names = [
            "*", "setae-*", "backup*", "setae-deplo?", "[s]etae-deploy",
            "!mail", "mail@localhost", "setae-deploy@*", "1000", "1mail",
            "-mail", ".mail", "$", "mail$$", "mail,backup", "mail/backup",
            "mail:backup", "mail;backup", '"mail"', "mail\\backup", "mail#comment",
            "m\u00e4il", "\u30e1\u30fc\u30eb", "mail\x00", "a" * 65,
        ]
        for name in names:
            settings = {**sshd_settings(), "denyusers": ["mail", name]}
            with self.subTest(name=name):
                with self.assertRaises(bootstrap.BootstrapError) as caught:
                    bootstrap.validate_sshd_settings(settings)
                self.assertEqual(caught.exception.code, "sshd_access_rules")

    def test_empty_denyusers_entries_are_not_treated_as_absent_rules(self):
        for lines in ([""], [" \t "], ["mail", ""], ["", "mail"]):
            with self.subTest(lines=lines):
                with self.assertRaises(bootstrap.BootstrapError) as caught:
                    bootstrap.validate_sshd_settings({**sshd_settings(), "denyusers": lines})
                self.assertEqual(caught.exception.code, "sshd_access_rules")

    def test_other_access_rules_still_require_review_with_unrelated_denyusers(self):
        for rule in ("allowusers", "allowgroups", "denygroups"):
            for value in ("mail", bootstrap.DEPLOY_USER + " mail"):
                settings = {**sshd_settings(), "denyusers": ["mail"], rule: [value]}
                before = json.dumps(settings, sort_keys=True)
                with self.subTest(rule=rule, value=value):
                    with self.assertRaises(bootstrap.BootstrapError) as caught:
                        bootstrap.validate_sshd_settings(settings)
                    self.assertEqual(caught.exception.code, "sshd_access_rules")
                    self.assertEqual(json.dumps(settings, sort_keys=True), before)

    def test_existing_mfa_access_rules_and_key_commands_are_not_weakened(self):
        overrides = {
            "authenticationmethods": ["publickey,password"], "allowusers": ["owner"],
            "denyusers": ["setae-deploy"], "allowgroups": ["ssh-users"],
            "denygroups": ["setae-deploy"], "authorizedkeyscommand": ["/tmp/lookup"],
            "forcecommand": ["/bin/sh"], "strictmodes": ["no"],
            "authorizedkeysfile": ["/tmp/authorized_keys"],
            "pubkeyacceptedalgorithms": ["rsa-sha2-512"],
            "permittunnel": ["yes"], "revokedkeys": ["/etc/ssh/revoked"],
            "acceptenv": ["LANG LC_* PATH LD_PRELOAD"], "setenv": ["PATH=/tmp"],
        }
        for key, value in overrides.items():
            settings = {**sshd_settings(), key: value}
            with self.subTest(key=key), self.assertRaises(bootstrap.BootstrapError):
                bootstrap.validate_sshd_settings(settings)


class BootstrapHostBoundaryTests(unittest.TestCase):
    @contextlib.contextmanager
    def synthetic_linux_root(self):
        # Only OS facts are replaced; the actual runtime validation executes.
        with contextlib.ExitStack() as stack:
            for name in ("fcntl", "pwd", "grp", "spwd"):
                stack.enter_context(mock.patch.object(bootstrap, name, object()))
            stack.enter_context(mock.patch.object(bootstrap.sys, "platform", "linux"))
            stack.enter_context(mock.patch.object(bootstrap.sys, "executable", "/usr/bin/python3"))
            stack.enter_context(mock.patch.object(bootstrap.sys, "version_info", (3, 12, 0)))
            stack.enter_context(mock.patch.object(bootstrap.sys, "flags", types.SimpleNamespace(isolated=1)))
            stack.enter_context(mock.patch.object(bootstrap.os, "getuid", return_value=0, create=True))
            stack.enter_context(mock.patch.object(bootstrap.os, "geteuid", return_value=0, create=True))
            yield

    def test_only_system_isolated_python_and_root_are_accepted(self):
        with self.synthetic_linux_root():
            bootstrap.Host().check_platform()
            for executable in ("/home/keeper/.pyenv/shims/python3", "/tmp/python3"):
                with mock.patch.object(bootstrap.sys, "executable", executable):
                    with self.subTest(executable=executable), self.assertRaises(bootstrap.BootstrapError) as caught:
                        bootstrap.Host().check_platform()
                    self.assertEqual(caught.exception.code, "python_runtime")
            with mock.patch.object(bootstrap.sys, "flags", types.SimpleNamespace(isolated=0)):
                with self.assertRaises(bootstrap.BootstrapError):
                    bootstrap.Host().check_platform()
            with mock.patch.object(bootstrap.os, "geteuid", return_value=1000):
                with self.assertRaises(bootstrap.BootstrapError) as caught:
                    bootstrap.Host().check_platform()
                self.assertEqual(caught.exception.code, "root_required")

    def test_command_failures_do_not_expose_private_output_or_use_a_shell(self):
        secret = b"SYNTHETIC_PRIVATE_STDERR_DO_NOT_PRINT"
        process = mock.MagicMock()
        process.__enter__.return_value = process
        process.returncode = 1
        process.communicate.return_value = (secret, secret)
        stdout, stderr = io.StringIO(), io.StringIO()
        with mock.patch.object(bootstrap.subprocess, "Popen", return_value=process) as runner, \
                mock.patch.object(bootstrap.subprocess, "run", side_effect=AssertionError("Unexpected command boundary")), \
                contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            with self.assertRaises(bootstrap.BootstrapError) as caught:
                bootstrap.checked_run(bootstrap.Host(), ["/usr/bin/true"])
        self.assertNotIn(secret.decode(), str(caught.exception))
        self.assertEqual(stdout.getvalue() + stderr.getvalue(), "")
        self.assertEqual(runner.call_args.kwargs["env"], bootstrap.CLEAN_ENV)
        self.assertFalse(runner.call_args.kwargs.get("shell", False))
        self.assertEqual(runner.call_args.kwargs["stderr"], subprocess.PIPE)
        self.assertIs(runner.call_args.kwargs["start_new_session"], True)

    def test_command_timeout_and_oversized_diagnostics_fail_closed(self):
        process = mock.MagicMock()
        process.__enter__.return_value = process
        process.returncode = 0
        process.pid = 12345
        process.communicate.side_effect = [subprocess.TimeoutExpired(["fixed"], 1), (b"", b"")]
        with mock.patch.object(bootstrap.subprocess, "Popen", return_value=process), \
                mock.patch.object(bootstrap.os, "killpg", create=True) as kill, \
                mock.patch.object(bootstrap.signal, "SIGKILL", 9, create=True):
            with self.assertRaises(bootstrap.BootstrapError) as caught:
                bootstrap.Host().run(["/usr/bin/true"])
            kill.assert_called_once_with(12345, 9)
        self.assertEqual(caught.exception.code, "command_timeout")
        process.communicate.side_effect = None
        process.communicate.return_value = (b"", b"x" * (bootstrap.MAX_OUTPUT + 1))
        with mock.patch.object(bootstrap.subprocess, "Popen", return_value=process):
            with self.assertRaises(bootstrap.BootstrapError) as caught:
                bootstrap.Host().run(["/usr/bin/true"])
        self.assertEqual(caught.exception.code, "command_output")


class BootstrapPureTests(unittest.TestCase):
    def test_raw_ed25519_key_has_a_stable_fingerprint(self):
        normalized, fingerprint = bootstrap.parse_public_key(KEY)
        self.assertEqual(normalized, KEY)
        expected = "SHA256:" + base64.b64encode(hashlib.sha256(KEY_WIRE).digest()).decode("ascii").rstrip("=")
        self.assertEqual(fingerprint, expected)

    def test_authorized_key_options_and_multiple_keys_are_rejected(self):
        bad_keys = ["", 'command="/bin/sh" ' + KEY, "restrict " + KEY,
                    'environment="PATH=/tmp" ' + KEY, KEY + "\n" + KEY,
                    KEY + "\x00", "-----BEGIN OPENSSH PRIVATE KEY-----"]
        for value in bad_keys:
            with self.subTest(value=value), self.assertRaises(bootstrap.BootstrapError):
                bootstrap.parse_public_key(value)

    def test_ed25519_wire_format_and_length_are_validated(self):
        for wire in (b"garbage", ssh_string(b"ssh-rsa") + ssh_string(bytes(32)),
                     ssh_string(b"ssh-ed25519") + ssh_string(bytes(31)),
                     ssh_string(b"ssh-ed25519") + ssh_string(bytes(33)), KEY_WIRE + b"trailing"):
            value = "ssh-ed25519 " + base64.b64encode(wire).decode("ascii")
            with self.subTest(wire=wire), self.assertRaises(bootstrap.BootstrapError):
                bootstrap.parse_public_key(value)
        with self.assertRaises(bootstrap.BootstrapError):
            bootstrap.parse_public_key("ssh-ed25519 !!!invalid-base64!!!")

    def test_forced_key_command_is_fixed_and_restricted(self):
        line = bootstrap.authorized_key_line(KEY).decode("ascii")
        self.assertIn('command="/usr/bin/sudo -n -u www-data -- /usr/local/sbin/setae-deploy"', line)
        self.assertIn("restrict", line.split(" ssh-ed25519 ", 1)[0])
        self.assertIn(" " + KEY, line)
        self.assertNotIn("/bin/sh", line)

    def test_sudoers_has_one_fixed_no_arguments_www_data_rule(self):
        text = bootstrap.sudoers_text().decode("ascii")
        rules = [line.strip() for line in text.splitlines() if line.strip().startswith("setae-deploy ")]
        self.assertEqual(len(rules), 1)
        self.assertRegex(rules[0], r'^setae-deploy\s+ALL=\(www-data\)\s+NOPASSWD:NOSETENV:\s*/usr/local/sbin/setae-deploy\s+""$')
        self.assertNotIn("*", rules[0])
        self.assertNotIn("(ALL)", text)

    def test_verified_payloads_match_the_actual_root_helper_sources(self):
        payloads = bootstrap.verified_payloads(SERVER)
        self.assertEqual(set(payloads), {"setae-deploy", "setae_deploy.py"})
        for name, data in payloads.items():
            self.assertEqual(data, (SERVER / name).read_bytes())
        self.assertIn(b"exec /usr/bin/python3 -I /usr/local/lib/setae-deploy/setae_deploy.py", payloads["setae-deploy"])
        self.assertNotIn(b"/usr/bin/env python", payloads["setae-deploy"])

    def test_payload_tampering_is_rejected_before_any_installation(self):
        for changed in ("setae-deploy", "setae_deploy.py"):
            with self.subTest(changed=changed), tempfile.TemporaryDirectory(prefix="setae-bootstrap-source-") as directory:
                source = Path(directory)
                for name in ("setae-deploy", "setae_deploy.py"):
                    data = (SERVER / name).read_bytes()
                    (source / name).write_bytes(data + (b"\n# altered\n" if name == changed else b""))
                with self.assertRaises(bootstrap.BootstrapError):
                    bootstrap.verified_payloads(source)
