"""Require nonempty, complete, successful offline deployment tests."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import platform
import sys
import unittest


def summary(result):
    passed = result.testsRun > 0 and not result.skipped and not result.expectedFailures and result.wasSuccessful()
    return {
        "status": "PASS" if passed else "FAIL",
        "tests_run": result.testsRun,
        "skipped": [{"test": test.id(), "reason": reason} for test, reason in result.skipped],
        "failures": [{"test": test.id(), "traceback": detail} for test, detail in result.failures],
        "errors": [{"test": test.id(), "traceback": detail} for test, detail in result.errors],
        "unexpected_successes": [test.id() for test in result.unexpectedSuccesses],
        "expected_failures": [test.id() for test, detail in result.expectedFailures],
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args(argv)
    if args.report and args.report.exists():
        raise FileExistsError("Refusing to overwrite deployment test evidence")
    tests = Path(__file__).resolve().parent
    suite = unittest.TestLoader().discover(str(tests), pattern="test_*.py")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    report = summary(result)
    report.update(generated_at=datetime.now(timezone.utc).isoformat(), python=sys.version, platform=platform.platform(),
                  scope="Offline deployment helper and admission tests; not production verification.",
                  limitations=["Flow tests stub Linux host/lock checks and WP-CLI commands.",
                               "No SSH, WordPress, MySQL, live HTTP, real backup restore, or production deployment was performed."])
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        with args.report.open("x", encoding="utf-8", newline="\n") as output:
            json.dump(report, output, ensure_ascii=False, indent=2)
            output.write("\n")
    print(json.dumps({"status": report["status"], "tests_run": report["tests_run"], "skipped": len(report["skipped"])}))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as error:
        print("STOP: " + str(error), file=sys.stderr)
        raise SystemExit(2)
