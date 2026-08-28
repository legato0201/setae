# Deployment helper tests

From the `wp-content` repository root:

```sh
python ops/deploy/tests/run_tests.py --report /absolute/path/to/new-evidence.json
```

The tests import the actual deployment helpers. Archives and filesystem state are
synthetic and confined to temporary directories. No test connects to SSH,
WordPress, GitHub, a production database, or a production filesystem.

The dedicated runner rejects zero discovered tests, skipped tests, failures and
expected failures. It refuses to overwrite an existing evidence report. Plain
`unittest discover` is useful interactively but is not the deployment gate.

Archive/parser tests are portable. Any Linux-only lock or ownership behavior
replaced by a stub must be identified in the test and in the execution report.
Passing stub tests does not demonstrate real SSH authorization, Linux locking,
WP-CLI installation, maintenance mode, database backup/restore, or HTTP health.

Schema 2 review tests keep acknowledged WordPress/MySQL and restore-drill checks
as `NOT_RUN`. They require a separate production-only acknowledgment and a reason
and reviewer for each unexecuted check. No `FAIL`, unexecuted performance check,
GUI check, or compatibility check can be waived. Synthetic attestations exist
only in temporary test data and do not approve a real release.

The actual `release.py` and `ci_release.py` admission paths are tested with real
temporary ZIP/source/declaration files. Git/GitHub command responses in the CI
tests are explicit stubs with no external fallback. Admission must say `ADMITTED`
and retain the raw check statuses; it does not mean runtime tests were executed.
Workflow-template checks are static: they verify the absence of a staging job,
the standing-authorization flow, pipeline enable switch and mandatory executable
gates. They do not verify GitHub's actual environment reviewer settings or change
existing protection settings.

Bootstrap tests exercise actual setup flow and temporary files while explicitly
stubbing Linux ownership, accounts, SSH configuration, sudo and WordPress reads.
They cover refusal of unknown existing state, pinned payloads, restricted keys,
disabled-before-verification ordering and disabling after a failed enable check.
They do not install accounts or sudo rules on the test host.

Local-client tests use actual synthetic ZIP/source/declaration data and explicit
GitHub, Windows ACL and SSH boundary stubs. They exercise commit/tree equality,
unchanged test gates, exact stdin bytes, receipt validation and uncertain-outcome
stops. Separate evidence is required for actual Windows ACL or public API checks;
none of these tests claims a production deployment or backup restore.

CI should require the complete discovered deployment test suite and the selected
release gates. A missing interpreter, a skipped required check, an incomplete
report, or a mismatched ZIP/source/evidence hash must not become a PASS.
