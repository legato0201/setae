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
the first manual confirmation, automatic-release opt-in and mandatory executable
gates. They do not verify GitHub's actual environment reviewer settings.

CI should require the complete discovered deployment test suite and the selected
release gates. A missing interpreter, a skipped required check, an incomplete
report, or a mismatched ZIP/source/evidence hash must not become a PASS.
