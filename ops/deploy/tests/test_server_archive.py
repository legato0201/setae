"""Offline tests of the real deployment parser and archive validator."""

import hashlib
import io
import json
from pathlib import Path
import stat
import sys
import tempfile
import unittest
import warnings
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))
import setae_deploy as server


VERSION = "1.0.251.1"
PLUGIN = b"<?php\n/* Plugin Name: SETAE Core\nVersion: 1.0.251.1\n*/\ndefine('SETAE_VERSION', '1.0.251.1');\n"


def manifest_for(data):
    return {
        "protocol_version": 1,
        "operation": "deploy",
        "version": VERSION,
        "expected_current_version": "1.0.251",
        "sha256": hashlib.sha256(data).hexdigest(),
        "bytes": len(data),
        "source_commit": "a" * 40,
        "code_only": True,
        "release_id": "r20260828-qa01",
    }


def archive_bytes(entries=None):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, body in entries if entries is not None else [("setae-core/setae-core.php", PLUGIN)]:
            archive.writestr(name, body)
    return buffer.getvalue()


class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.manifest = manifest_for(archive_bytes())

    def parse(self, value):
        return server.parse_manifest((json.dumps(value) + "\n").encode("utf-8"))

    def test_deploy_and_preflight_positive(self):
        self.assertEqual(self.parse(self.manifest), self.manifest)
        value = {"protocol_version": 1, "operation": "preflight"}
        self.assertEqual(self.parse(value), value)

    def test_preflight_cannot_carry_deployment_fields(self):
        value = {"protocol_version": 1, "operation": "preflight", "code_only": True}
        with self.assertRaises(server.DeployError):
            self.parse(value)

    def test_missing_and_extra_keys_are_rejected(self):
        for key in self.manifest:
            candidate = dict(self.manifest)
            del candidate[key]
            with self.subTest(missing=key), self.assertRaises(server.DeployError):
                self.parse(candidate)
        with self.assertRaises(server.DeployError):
            self.parse({**self.manifest, "command": "ignored-shell-command"})

    def test_wire_format_and_duplicate_keys_are_rejected(self):
        valid = json.dumps(self.manifest).encode("utf-8")
        invalid = [valid, valid + b"\nextra", b"[]\n", b"null\n", b"\xff\n",
                   b"{\"protocol_version\":2," + valid[1:] + b"\n", b" " * 4097 + b"\n"]
        for wire in invalid:
            with self.subTest(size=len(wire)), self.assertRaises(server.DeployError):
                server.parse_manifest(wire)

    def test_typed_fields_and_identifiers_fail_closed(self):
        invalid = {"protocol_version": [True, "1", 2], "bytes": [True, "100", 0, -1, 2 ** 63, float("nan"), float("inf")],
                   "code_only": [False, 1, "true"], "sha256": ["a" * 63, "g" * 64],
                   "source_commit": ["../commit", "g" * 40], "release_id": ["../escape", "a;id", "x" * 65],
                   "operation": ["apply", "deploy;id"]}
        for key, values in invalid.items():
            for value in values:
                with self.subTest(key=key, value=value), self.assertRaises(server.DeployError):
                    self.parse({**self.manifest, key: value})


class ReceiveTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="setae-receive-test-")
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "incoming.zip"
        self.data = archive_bytes()
        self.manifest = manifest_for(self.data)

    def test_exact_snapshot_is_written_once(self):
        result = server.receive_archive(io.BytesIO(self.data), self.manifest, self.path)
        self.assertEqual(result, self.path)
        self.assertEqual(self.path.read_bytes(), self.data)
        with self.assertRaises(server.DeployError):
            server.receive_archive(io.BytesIO(b"changed"), self.manifest, self.path)
        self.assertEqual(self.path.read_bytes(), self.data)


    def test_truncated_trailing_and_wrong_digest_leave_no_snapshot(self):
        for data in (self.data[:-1], self.data + b"extra", b"X" + self.data[1:]):
            with self.subTest(size=len(data)), self.assertRaises(server.DeployError):
                server.receive_archive(io.BytesIO(data), self.manifest, self.path)
            self.assertFalse(self.path.exists())


class VersionTests(unittest.TestCase):
    def test_current_four_part_and_three_part_versions(self):
        self.assertEqual(server.parse_version(VERSION), (1, 0, 251, 1))
        self.assertEqual(server.parse_version("1.0.251"), (1, 0, 251, 0))

    def test_version_cannot_be_a_path_or_shell_fragment(self):
        for value in ("", "01.0.251", "../1.0.251", "/1.0.251", "1.0.251;id", "1.0.251\n", "1.0.251.1.9"):
            with self.subTest(value=value), self.assertRaises(server.DeployError):
                server.parse_version(value)


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="setae-deploy-zip-")
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "release.zip"

    def validate(self, entries):
        self.path.write_bytes(archive_bytes(entries))
        return server.validate_zip(self.path, VERSION)

    def test_valid_single_plugin_archive(self):
        self.assertIsInstance(self.validate(None), dict)

    def test_unsafe_member_paths_are_rejected(self):
        names = ["../outside.php", "/setae-core/evil.php", "setae-core/../../outside.php",
                 "setae-core\\..\\outside.php", "C:/setae-core/evil.php",
                 "setae-core//evil.php", "setae-core/./evil.php", "other-plugin/evil.php"]
        for name in names:
            with self.subTest(name=name), self.assertRaises(server.DeployError):
                self.validate([("setae-core/setae-core.php", PLUGIN), (name, b"unsafe")])
        self.assertEqual(list(Path(self.directory.name).iterdir()), [self.path])

    def test_duplicate_members_are_rejected(self):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with self.assertRaises(server.DeployError):
                self.validate([("setae-core/setae-core.php", PLUGIN)] * 2)

    def test_case_aliases_are_rejected(self):
        with self.assertRaises(server.DeployError):
            self.validate([("setae-core/setae-core.php", PLUGIN), ("setae-core/SETAE-CORE.php", PLUGIN)])

    def test_links_and_special_files_are_rejected(self):
        for file_type in (stat.S_IFLNK, stat.S_IFIFO, stat.S_IFCHR, stat.S_IFBLK, stat.S_IFSOCK):
            info = zipfile.ZipInfo("setae-core/unsafe-entry")
            info.create_system = 3
            info.external_attr = (file_type | 0o777) << 16
            with self.subTest(file_type=file_type), self.assertRaises(server.DeployError):
                self.validate([("setae-core/setae-core.php", PLUGIN), (info, b"unsafe")])

    def test_missing_plugin_entry_and_empty_archive_are_rejected(self):
        for entries in ([], [("setae-core/readme.txt", b"not a plugin")]):
            with self.subTest(entries=entries), self.assertRaises(server.DeployError):
                self.validate(entries)

    def test_plugin_version_must_match_manifest(self):
        with self.assertRaises(server.DeployError):
            self.validate([("setae-core/setae-core.php", PLUGIN.replace(b"1.0.251.1", b"1.0.250"))])

    def test_not_a_zip_is_rejected(self):
        self.path.write_bytes(b"not a zip archive")
        with self.assertRaises(server.DeployError):
            server.validate_zip(self.path, VERSION)

    def test_nul_byte_in_original_member_name_is_rejected(self):
        data = archive_bytes([("setae-core/setae-core.php", PLUGIN), ("setae-core/badX.php", b"unsafe")])
        self.path.write_bytes(data.replace(b"setae-core/badX.php", b"setae-core/bad\x00.php"))
        with self.assertRaises(server.DeployError):
            server.validate_zip(self.path, VERSION)
