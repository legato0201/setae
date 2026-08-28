"""Gate orchestration tests. Interpreter subprocesses are synthetic, not plugin QA."""
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "release"))
import check_plugin


class GateTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="setae-gate-test-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.plugin = self.root / "plugin"
        (self.plugin / "tests").mkdir(parents=True)
        (self.plugin / "setae-core.php").write_text("<?php // fixture")
        (self.plugin / "tests/a-unit.php").write_text("<?php // fixture")
        (self.plugin / "tests/b-unit.js").write_text("// fixture")
        self.report = self.root / "report.json"
        self.calls = []
        self.mode = "pass"

    def process(self, command, **kwargs):
        if self.mode == "missing":
            raise FileNotFoundError("synthetic missing interpreter")
        if command[-1] == "--version":
            output = "PHP 8.3.0" if command[0] == "fixture-php" else "v22.0.0"
        else:
            self.calls.append((command, kwargs))
            output = "SKIP: synthetic dependency missing" if self.mode == "skip" and len(command) == 2 else "ok"
        return types.SimpleNamespace(returncode=0, stdout=output, stderr="")

    def run_gate(self):
        arguments = ["--plugin", str(self.plugin), "--report", str(self.report), "--php", "fixture-php", "--node", "fixture-node"]
        with mock.patch.object(check_plugin.subprocess, "run", side_effect=self.process), contextlib.redirect_stdout(io.StringIO()):
            code = check_plugin.main(arguments)
        return code, json.loads(self.report.read_text(encoding="utf-8"))

    def test_php_bin_is_passed_to_every_syntax_and_unit_child(self):
        code, report = self.run_gate()
        self.assertEqual(code, 0)
        self.assertEqual(report["discovered_units"], 2)
        self.assertEqual(len(self.calls), 5)
        self.assertTrue(all(kwargs["env"]["PHP_BIN"] == "fixture-php" for command, kwargs in self.calls))

    def test_missing_runtime_is_not_run_and_fail(self):
        self.mode = "missing"
        code, report = self.run_gate()
        self.assertNotEqual(code, 0)
        self.assertGreater(report["counts"]["NOT_RUN"], 0)
        self.assertEqual(self.calls, [])

    def test_skip_output_is_not_a_success(self):
        self.mode = "skip"
        code, report = self.run_gate()
        self.assertNotEqual(code, 0)
        self.assertGreater(report["counts"]["NOT_RUN"], 0)

    def test_empty_unit_discovery_blocks_execution(self):
        (self.plugin / "tests/a-unit.php").unlink()
        (self.plugin / "tests/b-unit.js").unlink()
        code, report = self.run_gate()
        self.assertNotEqual(code, 0)
        self.assertEqual(report["discovered_units"], 0)
        self.assertEqual(self.calls, [])
