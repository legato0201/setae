# Fixed SETAE deployment helper

These files are a local installation template, not an enabled deployment. No
server configuration, SSH key, sudo permission or GitHub workflow is installed
by adding them to the repository. The example configuration has both `enabled`
and `auth_ready` set to `false` and has no smoke URL.

Standing operational authorization allows automatic plugin updates, including
the first deployment, without repeated human approval. It does not establish
SSH/sudo access, make server-readiness checks pass or override release quality
gates. Existing access controls and GitHub environment protections still apply.

## Execution boundary

An administrator must separately install the wrapper, Python module and JSON
configuration into their fixed locations:

| File | Fixed location | Owner |
| --- | --- | --- |
| `setae-deploy` | `/usr/local/sbin/setae-deploy` | root |
| `setae_deploy.py` | `/usr/local/lib/setae-deploy/setae_deploy.py` | root |
| configuration | `/etc/setae-deploy/config.json` | root |

Their parents and the configured PHP, WP-CLI and Python executables must also be
root managed and not writable by the service/deployment users. Preserve LF line
endings in the shell wrapper. Runtime execution must be as the configured PHP
service user, normally `www-data`, and never as root. Root ownership makes the
helper immutable to that user; it does not change its execution UID.

The administrator must create a private, service-owned mode `0700` state
directory outside the web root. Its ancestors must be root owned and not writable
by that user. Received ZIP snapshots, code/SQL backups and recovery state are all
stored below this directory. File staging here means a temporary archive working
area, not a separate staging WordPress installation; no root-only working
directory is required.

The Python runtime must be version 3.10 or newer. The wrapper uses the absolute
`/usr/bin/python3` with isolated mode, not an interactive user's pyenv Python.
Verify that exact system runtime; an interactive Python 3.8 does not satisfy or
identify the helper's runtime. This template's reviewed CI
environment uses **CLI PHP 8.3**. Preflight reports another minor but sets
`php_cli_compatible` and `deployment_ready` to `false`; deployment refuses it
before backup or installation. Changing this fixed minor requires a coordinated
review of both CI and the server helper. PHP-FPM/web PHP is a separate runtime
and must be checked during the initial production-readiness review, which may
be automated and must record actual evidence.

The SSH key must be restricted to the exact no-argument command, and sudoers must
permit only `(www-data)` execution of that helper with no arguments. The helper
rejects CLI arguments. If preserved by sudo, `SSH_ORIGINAL_COMMAND` is checked,
but that optional environment value is not an authentication mechanism.
`auth_ready` records completion of the authorized external SSH/sudo setup; the
flag alone cannot install or prove that configuration.

PHP code supplied by an approved release executes with the application's normal
filesystem, database and secret access. Compromised PHP already running as
`www-data` can also access service-owned state and backups. This design is not a
sandbox or a security boundary between processes sharing that UID.

## Stdin protocol

The helper accepts one UTF-8 JSON line ending in LF, at most 4096 bytes. JSON
objects cannot contain duplicate or unknown fields. It takes no command-line
path, URL, shell command or configuration override.

Preflight accepts only:

```json
{"protocol_version":1,"operation":"preflight"}
```

It runs the fixed path/UID/CLI/single-site checks even while deployment is
disabled, reports the installed version and readiness, and performs no install,
backup or maintenance command. A lock file can be created by this check.

Deployment requires exactly these nine fields:

```json
{"protocol_version":1,"operation":"deploy","version":"1.0.251.2","expected_current_version":"1.0.251.1","sha256":"<64 lowercase hexadecimal characters>","bytes":1234,"source_commit":"<40 lowercase hexadecimal characters>","code_only":true,"release_id":"setae-v1.0.251.2"}
```

Immediately follow the line with exactly `bytes` ZIP bytes and EOF. The example
digests are placeholders. Receipt is bounded by a 120-second input deadline.
Versions have three or four numeric components; the requested version must be
strictly higher than the expected baseline. The installed version must match
that baseline exactly. Reinstalling the same version is refused.

`code_only: true` is a release-review attestation. It does not prevent trusted
PHP or WordPress upgrade hooks from writing to the database. Releases requiring
database/schema, billing/contract or other operational migrations need a
separately approved procedure.

## Checks and update sequence

1. Validate root-controlled paths, non-root service UID and a private state
   directory. Take a nonblocking POSIX file lock. Refuse an existing maintenance
   file or unresolved deployment marker before invoking a new update.
2. Check PHP, WP-CLI, WordPress and the active `setae-core` version. Execute one
   fixed PHP expression through WP-CLI to reject multisite installations.
3. Verify the received snapshot's SHA256 and every ZIP entry, CRC, size and path.
   Only the `setae-core/` root is accepted. Traversal, backslashes, case aliases,
   duplicate names, file/directory conflicts, links and special files are refused.
4. Back up the complete current plugin and export the database. Every base table
   must report InnoDB; export uses a single transaction. The SQL backup must be a
   nonempty regular file, be flushed to disk, and have its size/hash recorded.
   No update starts if this step fails.
5. Persist a recovery marker, activate maintenance and invoke only the fixed
   local archive install for `setae-core`, with `--force`. PHP/WP-CLI runs from
   `/` with a clean environment and skips ordinary plugins, themes and packages.
6. Match every installed regular file's path, size and SHA256 to the ZIP and
   reject missing/extra files or links. Confirm the new header/version and active
   single-site state. Deactivate maintenance, then request the configured HTTPS
   WordPress REST index. HTTP 200, JSON and namespace `setae/v1` are all required.
   Repeat the file comparison after this request.
7. Save a JSON receipt and clear the recovery marker only after all checks pass.

The fixed smoke URL must be an HTTPS REST index such as
`https://example.invalid/wp-json/` or
`https://example.invalid/index.php?rest_route=/`. A WordPress subdirectory is
allowed. No credentials, arbitrary query fields, redirects, environment proxies
or unverified TLS are accepted. An application page or login page is not a
valid smoke endpoint.

## Limits and recovery

- Incoming ZIP: 32 MiB; expanded files: 128 MiB total; one file: 16 MiB; at most
  10,000 entries; maximum expansion ratio 200. Only stored/deflated ZIPs work.
- Database export: at most 2 GiB, further limited to current free backup space
  minus a 256 MiB safety margin. An available limit below 16 MiB stops the
  operation. A Linux `RLIMIT_FSIZE` limit is applied before the export child
  starts and is inherited by its database-dump process. Existing stricter hard
  limits are respected. Disk space is not reserved against other writers.
- CLI checks normally time out after 180 seconds; DB export after 900 seconds.
  A timed-out command's process group is stopped. Command stderr/stdout is never
  included in an error receipt because it can contain private information.
- Failed updates retain `deployment-blocked.json`, report a backup ID and attempt
  to reactivate maintenance. WordPress can expire its maintenance file after
  roughly ten minutes; the marker blocks another deployment, not public traffic.
- There is **no automatic database restore or code rollback**. Review the private
  backup and actual site state, recover under an approved procedure, and only
  then clear the marker. Code and SQL backups contain private data. Retention,
  capacity monitoring, off-host backup and recovery exercises are administrative
  responsibilities; this helper does not prune or transmit them.

## Verification status and limitations

Offline tests execute the parser, ZIP checks and actual deployment flow with
temporary files and explicit command/HTTP/Linux-boundary stubs. They do not
demonstrate real Linux ownership, flock or resource-limit enforcement, SSH/sudo
authorization, WP-CLI updates, MySQL backup/restore or production HTTP health.
Those real-host deployment checks remain unverified by this local evidence;
they must not be described as PASS. Run the deployment suite described in
`../tests/README.md` and record measured initial production readiness.
A separate staging WordPress installation is not required by this deployment
plan.

Client-side release admission uses declaration schema 2; the server's stdin wire
protocol above remains version 1. Schema 2 requires explicit production-only
acknowledgment, initial server-readiness evidence and review of the exact
artifact. An identified automated reviewer may provide `approved_by` under the
standing authorization. The existing `initial_manual_verification_evidence`
field name is retained for schema compatibility; it may refer to actual automated
readiness checks and does not require a human-run first deployment. Evidence
cannot be invented or replaced with the operational permission itself.
Only `wordpress_mysql_acceptance: NOT_RUN` and
`backup_restore_drill: NOT_RUN` may have individual risk acknowledgments with a
reason and approver. Their original results stay NOT_RUN. This is not evidence
that a backup was validated or restored successfully, and it does not waive the
server's mandatory backup creation/hash checks. All FAIL results still block
release admission; performance, GUI and compatibility checks have no exception.
See `../README.md` for the admission fields and operational authorization. Neither
omitting staging nor standing approval turns an unverified release into a passing
one, and neither bypasses the server's connection or integrity checks.

An active-plugin CLI check with `--skip-plugins` does not bootstrap ordinary
plugins. The REST smoke exercises the web path, but is not full application QA
or proof that PHP-FPM has loaded this exact version. Confirm OPcache invalidation
and REST-cache exclusion on the actual server. Must-use plugins still execute
in WP-CLI. Concurrent schema changes or writes by other processes are not blocked
by the helper's own file lock. A successful InnoDB SQL export and matching hash
do not prove restorability. An unexecuted restore exercise remains NOT_RUN with
its separately approved risk; it is not backup or recovery verification PASS.
If a restore exercise is attempted and fails, record FAIL and stop admission.
