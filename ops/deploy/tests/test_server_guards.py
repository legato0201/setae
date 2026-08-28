"""Offline guard regressions; HTTP, WordPress and Linux host/locks are stubs."""
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from test_release import release
from test_server_archive import PLUGIN, archive_bytes, manifest_for, server
from test_server_flow import FakeWp


class Php84Wp(FakeWp):
    def respond(self, config, arguments, head):
        if head == ("cli", "info"):
            return json.dumps({"php_version": "8.4.25", "wp_cli_version": "2.12.0"})
        return super().respond(config, arguments, head)


class RuntimeGuardTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix="setae-runtime-guards-")
        self.addCleanup(directory.cleanup)
        root = Path(directory.name).resolve()
        self.config = server.Config(enabled=True, auth_ready=True, wp_root=root / "site",
                                    state_dir=root / "private", smoke_url="https://example.invalid/wp-json/")
        self.config.plugin_dir.mkdir(parents=True)
        self.config.state_dir.mkdir()
        self.header = self.config.plugin_dir / "setae-core.php"
        self.original_header = PLUGIN.replace(b"1.0.251.1", b"1.0.251")
        self.header.write_bytes(self.original_header)
        self.data = archive_bytes()
        self.archive = self.config.state_dir / "incoming.zip"
        self.archive.write_bytes(self.data)
        self.runner = Php84Wp()
        self.smoke = mock.Mock(side_effect=AssertionError("HTTP must not run on unsupported PHP"))
        patches = contextlib.ExitStack()
        self.addCleanup(patches.close)
        patches.enter_context(mock.patch.object(server, "validate_host"))
        patches.enter_context(mock.patch.object(server, "FileLock", side_effect=lambda path: contextlib.nullcontext()))
        self.backup = patches.enter_context(mock.patch.object(server, "_create_backup",
                                             side_effect=AssertionError("Backup must not start on unsupported PHP")))

    def assert_read_only(self):
        self.backup.assert_not_called()
        self.smoke.assert_not_called()
        self.assertEqual(self.runner.calls, [
            ("cli", "info", "--format=json"), ("core", "version"),
            ("eval", server.SINGLE_SITE_CHECK),
            ("plugin", "get", "setae-core", "--fields=name,status,version", "--format=json"),
        ])
        self.assertEqual(self.header.read_bytes(), self.original_header)
        self.assertEqual(self.archive.read_bytes(), self.data)
        self.assertEqual(list(self.config.state_dir.iterdir()), [self.archive])
        self.assertFalse((self.config.wp_root / ".maintenance").exists())

    def test_php84_deploy_stops_before_backup_or_mutation(self):
        with self.assertRaises(server.DeployError) as caught:
            server.deploy(self.config, manifest_for(self.data), self.archive,
                          runner=self.runner, smoke=self.smoke)
        self.assertEqual(caught.exception.code, "php_cli_unsupported")
        self.assert_read_only()

    def test_php84_preflight_reports_not_ready_without_mutation(self):
        result = server.preflight(self.config, runner=self.runner)
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["operation"], "preflight")
        self.assertEqual(result["php_version"], "8.4.25")
        self.assertEqual(result["tested_php_cli_minor"], "8.3")
        self.assertIs(result["php_cli_compatible"], False)
        self.assertIs(result["deployment_ready"], False)
        self.assert_read_only()


class DatabaseLimitTests(unittest.TestCase):
    def test_insufficient_or_untyped_free_space_is_rejected(self):
        boundary = server.DISK_SAFETY_BYTES + server.MIN_DATABASE_LIMIT
        for free in (None, True, "536870912", -1, 0, boundary - 1):
            with self.subTest(free=free), self.assertRaises(server.DeployError) as caught:
                server.database_file_limit(free)
            self.assertEqual(caught.exception.code, "disk_space")

    def test_database_limit_preserves_margin_and_enforces_cap(self):
        safety, minimum, maximum = server.DISK_SAFETY_BYTES, server.MIN_DATABASE_LIMIT, server.MAX_DATABASE_BYTES
        for free, expected in ((safety + minimum, minimum),
                               (safety + minimum + 4096, minimum + 4096),
                               (safety + maximum, maximum),
                               (safety + maximum + 4096, maximum)):
            with self.subTest(free=free):
                limit = server.database_file_limit(free)
                self.assertEqual(limit, expected)
                self.assertGreaterEqual(free - limit, safety)
                self.assertLessEqual(limit, maximum)


class FakeHttpResponse:
    def __init__(self, body, content_type):
        self.status = 200
        self.headers = {"Content-Type": content_type}
        self.body = io.BytesIO(body)
        self.read_limits = []

    def __enter__(self):
        return self

    def __exit__(self, *unused):
        self.body.close()

    def read(self, limit):
        self.read_limits.append(limit)
        return self.body.read(limit)


class SmokeGuardTests(unittest.TestCase):
    def setUp(self):
        self.config = server.Config(smoke_url="https://example.invalid/wp-json/")
        self.opener = mock.Mock(spec=["open"])
        patches = contextlib.ExitStack()
        self.addCleanup(patches.close)
        patches.enter_context(mock.patch.object(server.ssl, "create_default_context", return_value=None))
        patches.enter_context(mock.patch.object(server.urllib.request, "build_opener", return_value=self.opener))

    def test_http200_html_or_missing_namespace_is_not_success(self):
        cases = (("text/html", b"<html>Login required</html>"),
                 ("application/json", b'{"name":"Synthetic WordPress"}'),
                 ("application/json", b'{"namespaces":["wp/v2"]}'),
                 ("application/json", b'{"namespaces":["setae/v1",1]}'),
                 ("application/json", b"invalid JSON"))
        for content_type, body in cases:
            with self.subTest(content_type=content_type, body=body):
                self.opener.reset_mock()
                self.opener.open.return_value = FakeHttpResponse(body, content_type)
                with self.assertRaises(server.DeployError) as caught:
                    server.smoke_check(self.config)
                self.assertEqual(caught.exception.code, "smoke_failed")
                self.opener.open.assert_called_once()

    def test_valid_json_namespace_succeeds_through_fake_http_only(self):
        response = FakeHttpResponse(b'{"namespaces":["wp/v2","setae/v1"]}', "application/json; charset=UTF-8")
        self.opener.open.return_value = response
        result = server.smoke_check(self.config)
        self.assertEqual(result, {"http_status": 200, "namespace": "setae/v1"})
        self.opener.open.assert_called_once()
        request = self.opener.open.call_args.args[0]
        self.assertEqual(request.full_url, self.config.smoke_url)
        self.assertEqual(request.get_method(), "GET")
        self.assertIsNone(request.data)
        self.assertEqual(request.get_header("Accept"), "application/json")
        self.assertEqual(request.get_header("Cache-control"), "no-cache")
        self.assertEqual(self.opener.open.call_args.kwargs, {"timeout": server.SMOKE_TIMEOUT})
        self.assertEqual(response.read_limits, [server.MAX_REST_INDEX_BYTES + 1])


class SshArgumentGuardTests(unittest.TestCase):
    def test_ssh_uses_fixed_command_and_pinned_hostkey_options(self):
        host, key, hosts = "deploy.example.invalid", "/private/identity", "/private/known_hosts"
        arguments = release.ssh_arguments(host, 22, key, hosts)
        self.assertEqual(arguments[:4], ["ssh", "-F", "/dev/null", "-T"])
        self.assertEqual(arguments[-8:], ["-i", key, "-p", "22", "-l", "setae-deploy", host,
                                         "/usr/bin/sudo -n -u www-data -- /usr/local/sbin/setae-deploy"])
        options = [arguments[index + 1] for index, value in enumerate(arguments) if value == "-o"]
        for expected in ("BatchMode=yes", "IdentitiesOnly=yes", "IdentityAgent=none", "StrictHostKeyChecking=yes",
                         "UserKnownHostsFile=" + hosts, "GlobalKnownHostsFile=/dev/null", "ForwardAgent=no",
                         "ClearAllForwardings=yes", "ProxyCommand=none", "ProxyJump=none",
                         "ConnectionAttempts=1", "ConnectTimeout=15", "ServerAliveInterval=15", "ServerAliveCountMax=3"):
            self.assertIn(expected, options)
        self.assertNotIn("StrictHostKeyChecking=no", options)

    def test_host_and_port_injection_is_rejected_without_subprocess(self):
        hosts = ("-oProxyCommand=id", "example.invalid;id", "example.invalid\nid", "user@example.invalid", "example.invalid /bin/id")
        ports = ("22;id", "22 -oProxyCommand=id", "22\nid", "", "0", "65536", "-1", True)
        with mock.patch.object(release.subprocess, "run") as run:
            for host in hosts:
                with self.subTest(host=host), self.assertRaises(release.ReleaseError):
                    release.ssh_arguments(host, 22, "/identity", "/known_hosts")
            for port in ports:
                with self.subTest(port=port), self.assertRaises(release.ReleaseError):
                    release.ssh_arguments("example.invalid", port, "/identity", "/known_hosts")
            run.assert_not_called()
