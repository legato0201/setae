"""The CI wrapper must not turn empty or skipped suites into a green gate."""
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

import run_tests


class RunnerTests(unittest.TestCase):
    def test_empty_and_skipped_are_failures(self):
        result = unittest.TestResult()
        self.assertEqual(run_tests.summary(result)["status"], "FAIL")
        def skipped():
            raise unittest.SkipTest("synthetic skip")
        unittest.FunctionTestCase(skipped).run(result)
        self.assertEqual(result.testsRun, 1)
        self.assertEqual(run_tests.summary(result)["status"], "FAIL")

    def test_a_real_successful_case_is_required(self):
        result = unittest.TestResult()
        unittest.FunctionTestCase(lambda: None).run(result)
        self.assertEqual(run_tests.summary(result)["status"], "PASS")

    def test_failures_and_expected_failures_are_not_pass(self):
        def failed():
            raise AssertionError("synthetic failure")
        result = unittest.TestResult()
        unittest.FunctionTestCase(failed).run(result)
        self.assertEqual(run_tests.summary(result)["status"], "FAIL")
        result = unittest.TestResult()
        case = unittest.FunctionTestCase(lambda: None)
        case.run(result)
        result.addExpectedFailure(case, (AssertionError, AssertionError("synthetic xfail"), None))
        self.assertEqual(run_tests.summary(result)["status"], "FAIL")

    def test_main_rejects_empty_discovery_and_writes_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "evidence.json"
            with mock.patch.object(unittest.TestLoader, "discover", return_value=unittest.TestSuite()):
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    self.assertEqual(run_tests.main(["--report", str(path)]), 1)
            self.assertEqual(json.loads(path.read_text())["tests_run"], 0)
            original = path.read_bytes()
            with self.assertRaises(FileExistsError):
                run_tests.main(["--report", str(path)])
            self.assertEqual(path.read_bytes(), original)
