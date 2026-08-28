"""Run the packaged plugin's syntax/unit suites; never label missing suites PASS."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def run_check(name, binary, arguments, cwd, timeout=120, environment=None):
    try:
        result = subprocess.run([binary, *arguments], cwd=cwd, capture_output=True, text=True,
                                encoding="utf-8", errors="replace", timeout=timeout,
                                env=environment,
                                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        output = result.stdout + result.stderr
        skipped = re.search(r"(?:^\s*(?:SKIP\b|NOT[_ ]RUN\b)|\b(?:checks|tests?)\s+skipped\b|^\s*#\s*skipped\s+[1-9]\d*\s*$)", output, re.IGNORECASE | re.MULTILINE)
        status = "FAIL" if result.returncode else ("NOT_RUN" if skipped else "PASS")
        return {"name": name, "status": status,
                "exit_code": result.returncode,
                "output": output[-12000:] if status != "PASS" else ""}
    except (OSError, subprocess.TimeoutExpired) as error:
        return {"name": name, "status": "NOT_RUN" if isinstance(error, OSError) else "FAIL",
                "output": str(error)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plugin", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--php", default="/usr/bin/php8.3")
    parser.add_argument("--node", default="node")
    parser.add_argument("--required-php-minor", default="8.3")
    args = parser.parse_args(argv)
    plugin = Path(args.plugin).resolve()
    report_file = Path(args.report)
    if report_file.exists():
        raise ValueError("refusing to overwrite test evidence")
    results = []
    runtimes = {}
    for name, binary in (("php", args.php), ("node", args.node)):
        try:
            probe = subprocess.run([binary, "--version"], capture_output=True, text=True,
                                   encoding="utf-8", errors="replace", timeout=15,
                                   creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            runtimes[name] = probe.stdout.strip()
            if probe.returncode != 0:
                raise OSError("runtime probe failed")
        except (OSError, subprocess.TimeoutExpired):
            results.append({"name": name + " runtime", "status": "NOT_RUN"})
    match = re.search(r"PHP (\d+\.\d+)\.", runtimes.get("php", ""))
    if not match or match.group(1) != args.required_php_minor:
        results.append({"name": "required PHP " + args.required_php_minor, "status": "NOT_RUN"})
    units = sorted(p for p in (plugin / "tests").glob("*-unit.*") if p.suffix in {".js", ".php"})
    syntax = sorted(p for p in plugin.rglob("*") if p.is_file() and p.suffix in {".php", ".js", ".cjs", ".mjs"}
                    and not any(part in {"vendor", "node_modules", ".git", "__pycache__"} for part in p.relative_to(plugin).parts))
    for suite, files in (("unit", units), ("syntax", syntax)):
        if not files or not any(p.suffix == ".php" for p in files) or not any(p.suffix != ".php" for p in files):
            results.append({"name": suite + " discovery", "status": "NOT_RUN"})
    if not results:
        environment = {**os.environ, "PHP_BIN": args.php}
        for path in syntax:
            is_php = path.suffix == ".php"
            results.append(run_check("syntax/" + path.relative_to(plugin).as_posix(), args.php if is_php else args.node,
                                     ["-l" if is_php else "--check", str(path)], str(plugin), timeout=30, environment=environment))
        for path in units:
            results.append(run_check("unit/" + path.name, args.php if path.suffix == ".php" else args.node, [str(path)], str(plugin), environment=environment))
    counts = {status: sum(r["status"] == status for r in results) for status in ("PASS", "FAIL", "NOT_RUN")}
    status = "PASS" if counts["PASS"] and not counts["FAIL"] and not counts["NOT_RUN"] else "FAIL"
    report = {"status": status, "generated_at": datetime.now(timezone.utc).isoformat(),
              "scope": "Packaged plugin: first-party syntax and *-unit.js/php only. No GUI, browser, performance, real WordPress/MySQL, SSH or deployment test.",
              "runtimes": runtimes, "required_php_minor": args.required_php_minor,
              "discovered_units": len(units), "discovered_syntax_files": len(syntax), "counts": counts, "results": results,
              "not_run": ["GUI", "browser", "performance", "real WordPress/MySQL", "backup restore", "production deployment"]}
    report_file.parent.mkdir(parents=True, exist_ok=True)
    with report_file.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    print(json.dumps({"status": status, "scope": report["scope"], "counts": counts,
                      "discovered_units": len(units), "discovered_syntax_files": len(syntax)}))
    return 0 if status == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
