"""Static checks of the real workflow template; not GitHub environment verification."""
from pathlib import Path
import re
import unittest


TEMPLATE = Path(__file__).resolve().parents[1] / "workflows" / "release.yml.example"


def jobs_from_template(source):
    """Extract top-level job blocks without pretending to be a general YAML parser."""
    jobs = source.split("\njobs:\n", 1)[1]
    matches = list(re.finditer(r"(?m)^  ([a-z][a-z0-9_-]*):\s*$", jobs))
    return {
        match.group(1): jobs[match.end():matches[index + 1].start() if index + 1 < len(matches) else len(jobs)]
        for index, match in enumerate(matches)
    }


class WorkflowReviewTests(unittest.TestCase):
    def setUp(self):
        self.source = TEMPLATE.read_text(encoding="utf-8")
        self.jobs = jobs_from_template(self.source)

    def test_production_depends_only_on_verify_without_a_staging_environment(self):
        self.assertEqual(set(self.jobs), {"verify", "production"})
        self.assertRegex(self.jobs["production"], r"(?m)^    needs: verify\s*$")
        self.assertRegex(self.jobs["production"], r"(?m)^    environment: setae-production\s*$")
        self.assertNotRegex(self.source, r"(?m)^\s*(?:environment|needs):[^\n]*staging")

    def test_standing_authorization_removes_manual_gates_but_retains_release_guards(self):
        self.assertIn("\n  workflow_dispatch:\n", self.source)
        self.assertIn("\n  release:\n    types: [published]\n", self.source)
        for removed in ("confirm_production_only", "MANUAL_CONFIRMATION", "SETAE_AUTOMATIC_RELEASES_ENABLED"):
            self.assertNotIn(removed, self.source)
        before_checkout = self.jobs["verify"].split("      - uses: actions/checkout@", 1)[0]
        self.assertIn("vars.SETAE_PIPELINE_ENABLED == 'true'", before_checkout)
        self.assertIn("github.repository == 'legato0201/setae'", before_checkout)
        self.assertIn("github.event.release.draft == false", before_checkout)
        self.assertIn("github.event.release.prerelease == false", before_checkout)
        self.assertIn('[[ "$WORKFLOW_REF" == "refs/tags/$RELEASE_TAG" ]]', before_checkout)
        self.assertIn('[[ "$RELEASE_TAG" =~ ^setae-v', before_checkout)
        self.assertIn("\npermissions:\n  contents: read\n", self.source)

    def test_required_executable_gates_run_before_production_without_ignore_failure(self):
        verify = self.jobs["verify"]
        self.assertIn("python3 ops/deploy/tests/run_tests.py --report", verify)
        self.assertIn("python3 ops/deploy/release/check_plugin.py", verify)
        self.assertIn('--plugin "$RUNNER_TEMP/setae-checked/wp-content/plugins/setae-core"', verify)
        self.assertIn("--php /usr/bin/php8.3 --node node", verify)
        self.assertIn("python3 ops/deploy/release/ci_release.py", verify)
        self.assertNotIn("continue-on-error:", verify)
        self.assertNotRegex(verify, r"\|\|\s*(?:true|:)(?:\s|$)")
        self.assertNotIn("SETAE_SSH_PRIVATE_KEY", verify)
        production = self.jobs["production"]
        self.assertIn("--expected-commit", production)
        self.assertIn("needs.verify.outputs.commit", production)
        self.assertIn("release.py send --archive", production)
        self.assertNotIn("continue-on-error:", production)
