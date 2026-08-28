# SETAE release deployment

**Production-only deployment template, disabled by default. No separate staging
WordPress installation is required. Adding these files does not install a server
helper, configure SSH, approve a release or enable a workflow.**

This directory belongs to the existing `wp-content` Git repository, whose remote
is `legato0201/setae`. It is not included in the WordPress plugin ZIP.

## Components

| Path | Responsibility |
| --- | --- |
| `release/release.py` | Inspect an existing ZIP, compare every first-party file with the tagged source, create an unapproved declaration, enforce release review, send a bounded stdin frame over pinned SSH |
| `release/check_plugin.py` | Run packaged first-party PHP/JS syntax and unit suites; missing runtimes, missing suites and reported skips are not PASS |
| `release/ci_release.py` | Read GitHub policy/release metadata, download the exact reviewed release asset, verify the commit and bytes, prepare the actual adjacent theme for unit tests |
| `server/setae-deploy` | Fixed no-argument launcher, root owned, executed as `www-data` |
| `server/setae_deploy.py` | Fixed `setae-core` updater, private backup/journal, version/hash checks and failure stop |
| `server/config.example.json` | Root-managed configuration template; both enable flags are false |
| `workflows/release.yml.example` | Inert GitHub Actions template: verify → production environment approval; first run requires manual confirmation |
| `tests/` | Offline tests of the actual Python code with synthetic data and explicit runtime stubs |

## Release admission

Use a new, already-tested distributable ZIP. Do not recreate vendor from an
unlocked Composer update, repackage the previously delivered ZIP, or deploy the
same version again. Repository `vendor/` is currently ignored, so the reviewed
ZIP is the artifact of record. The workflow verifies it against the declared
SHA-256 and all non-vendor source files. Bundled vendor is retained without a
rebuild; vendor's own test suites are not executed by the plugin check runner.

From the repository root, the preparation command is:

```sh
python3 ops/deploy/release/release.py prepare \
  --archive /absolute/path/to/the-new-release.zip \
  --plugin-source plugins/setae-core \
  --expected-current INSTALLED_VERSION \
  --output /absolute/path/to/a-new-declaration.json
```

`INSTALLED_VERSION` is an instruction placeholder, not a supported literal value.
Preparation refuses identical/older versions and overwriting evidence. The new
schema-2 declaration deliberately sets every review check to `NOT_RUN`, no reviewer,
`code_only: false`, production-only acceptance to `false`, and no risk approvals.
It cannot deploy. Evidence references must describe the
same ZIP SHA-256 and the stated installed baseline. The tool verifies the recorded
values but cannot prove that a human's linked evidence is truthful.

The review has two separate decisions, neither inferred from a request to omit
staging:

- `production_only_acknowledgment` requires `accepted: true`, a `reason`, an
  `approved_by` identity, and `initial_manual_verification_evidence`. The evidence
  references actual initial server/readiness checks: fixed paths and active
  baseline, service-user permissions, PHP 8.3 CLI, authorization, backup readiness
  and web-cache/OPcache handling. It is not a claim that WordPress acceptance or
  a restore drill ran. This approval is tied to the declaration's artifact hash.
- `risk_acknowledgments` can name only `wordpress_mysql_acceptance` or
  `backup_restore_drill`, and only when the original check is `NOT_RUN`. Each entry
  contains exactly `check`, `status: "NOT_RUN"`, `reason` and `approved_by`.
  Reasons must explain the missing check and accepted risk. An unexecuted check's
  original `evidence` may remain empty; do not invent test evidence or change it
  to PASS. Empty, duplicate, mismatched or unknown approvals are rejected.

Every **FAIL still blocks deployment**, including a failed WordPress or restore
check. `performance_budget`, `gui_and_browser_regression`, and
`database_billing_permissions_compatibility` must have PASS with evidence; they
have no exception. CI's executable tool, syntax and unit checks also have no
exception. A risk acknowledgment does not authorize database/schema, billing,
permission or contract changes. The reviewed code-only requirement remains.

The `verify` command reports `ADMITTED` with the original review statuses, not a
test PASS. Schema-1 declarations are refused instead of silently converted.
Preparation never approves a candidate, and these policy changes do not approve
the currently installed version or any existing ZIP.

After the actual reviews/tests and any permitted explicit risk decisions, put the completed declaration at
`ops/deploy/releases/setae-vVERSION.json` in the reviewed commit. Use that commit's
protected `setae-vVERSION` tag and attach the exact named ZIP to its stable GitHub
release. Synchronizing source to the existing public repository is separate from
approving a release tag, publishing an artifact or installing it on WordPress.
Review public repository contents for secrets and private data before syncing.

There is no approved current release declaration here: production already reports
1.0.251.1; prior performance failures remain failures, and unexecuted real
WordPress/MySQL checks remain NOT_RUN. Omitting staging does not waive performance
criteria. The current ZIP must not be promoted again as a shortcut.

The initial repository synchronization anonymizes four historical static preview
fixtures (`public-care-share-preview.html`, `public-profile-preview.html`,
`ui-system-v4-collection-preview.html`, `ui-system-v4-specimen-preview.html`) and
the dependent `browser-public-profile-interaction-qa.cjs` expectations in
the public source copy. The previously delivered 1.0.251.1 ZIP and the operator's
original local source are not rewritten. These five public test files therefore do
not have the same bytes as that historical ZIP. Build and test the next version's
artifact from the reviewed public source; do not loosen `verify_source`, repackage
the delivered version, or treat source synchronization as release approval.

## CI and credentials

Do not move the template into `.github/workflows` or set
`SETAE_PIPELINE_ENABLED` to `true` until the protected-source sync, initial manual
server/readiness review and authorization setup are complete. A separate staging
job/environment is not used. Keep `SETAE_AUTOMATIC_RELEASES_ENABLED` unset or
`false` until the first manually confirmed production run and its follow-up
checks are complete. Neither flag is set automatically by this template.

The workflow requires protected `main` and an active tag ruleset matching
`refs/tags/setae-v*` (or all tags), with creation/update/deletion restrictions and
no exclusions. Only release administrators should have the necessary bypass to
create a release tag. Define environment protections separately; merely naming
an environment in YAML does not configure an approval gate.

Use GitHub-hosted Ubuntu runners. Never place a public repository's general
runner on the production WordPress server. Keep the production SSH private key
only in the **`setae-production` environment**. That environment needs:

- Variables: `SETAE_SSH_HOST`, `SETAE_SSH_PORT`.
- Secrets: `SETAE_SSH_PRIVATE_KEY`, `SETAE_SSH_KNOWN_HOSTS`.
- A dedicated remote user named `setae-deploy`, with an administrator-provisioned
  forced command and a no-argument sudoers rule running only as `www-data`.

The host key must be independently verified by the administrator. The transport
does not use `StrictHostKeyChecking=no`, ssh-agent, forwarded agents or inherited
SSH config. Passwords/private keys must not be pasted into a chat or committed.

Every production run requires a `setae-production` environment reviewer.
Restrict the environment to release tags and disable administrator bypass. For a
manual `workflow_dispatch`, select the **same tag** in “Use workflow from” and
the `release_tag` input, and explicitly check `confirm_production_only`; running
from `main` or leaving confirmation false is refused. Use this path for the first
run. A release publication stops until an administrator explicitly enables
`SETAE_AUTOMATIC_RELEASES_ENABLED` after that manual run. Later publication events
can start the same pipeline, with the production reviewer and release declaration
gates still required. This flag and the manual checkbox do not approve an artifact
whose declaration or executable checks fail.

## Failure and boundaries

- Server config is root owned; the helper never runs WordPress/PHP as root.
- `code_only` is an approval statement, not a PHP sandbox. Installed PHP can use
  WordPress DB credentials and other resources accessible to `www-data`.
- WP-CLI `--skip-plugins` does not disable MU plugins, drop-ins or wp-config PHP.
- The lock serializes this helper only. It does not lock WordPress admin updates,
  another updater, cron, PHP workers or webhook requests. Coordinate those paths.
- Backups and the durable block are private to the service UID, **not isolated
  from another compromised process using that same UID**. Keep independent,
  access-controlled external backups and test restoration.
- On update/verification failure the helper leaves a durable deployment block,
  requests maintenance again, and does not restore code or the DB automatically.
  WordPress maintenance can expire; this is not a permanent traffic/write fence.
- A connection timeout is an unknown result until the private server journal is
  checked. Do not blindly retry, delete the block, or import the saved DB.
- Public smoke checks and version checks do not replace authenticated acceptance,
  visual/performance, payment, concurrency, cache or physical device tests.
- Before enabling, verify FPM OPcache revalidation and exclude the REST index
  from caches. A PHP-CLI version/file hash and REST namespace cannot prove the
  PHP-FPM worker is executing fresh opcodes. CLI `opcache_reset` is not a fix for
  the separate FPM cache, and this helper does not restart PHP-FPM.
- Single-site, bounded ZIP/DB sizes and the confirmed target paths are required.
  Changes to database schema, billing, permissions or migration behavior use a
  separately reviewed deployment/recovery plan, not this automatic path.

## Validation commands

```sh
python3 ops/deploy/tests/run_tests.py --report /absolute/path/to/new-evidence.json
python3 ops/deploy/release/release.py inspect --archive /absolute/path/to/release.zip
```

The result reports distinguish offline assertions and the PHP 8.4 local plugin
run from any unexecuted PHP 8.3 GitHub/Ubuntu or production checks. Linux and real
WordPress behavior must not be described as verified by runtime stubs. A permitted
NOT_RUN acknowledgment records a missing check; it is not a passing test. No
offline PASS is an authorization to enable production.

## Official references

- [GitHub environment secrets and required reviewers](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [GitHub workflow and runner security](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub release asset download](https://cli.github.com/manual/gh_release_download)
- [WP-CLI plugin installation options](https://developer.wordpress.org/cli/commands/plugin/install/)
- [WP-CLI database export](https://developer.wordpress.org/cli/commands/db/export/)
- [OpenSSH authorized_keys restrictions](https://man.openbsd.org/sshd.8#AUTHORIZED_KEYS_FILE_FORMAT)
