"""Windows client for reviewed local releases; no GitHub Actions setup required.

preflight contacts only the pinned server helper. send additionally requires the
existing schema-2 admission and exact public GitHub commit/tree content matching
the ZIP. That content check is not GitHub branch-ancestry or tag-policy approval.
Keys are passed to Windows OpenSSH by filename and are never read by Python.
All reports are new files. An uncertain SSH result must not be retried blindly.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PureWindowsPath
import re
import ssl
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile

import release


WINDOWS_SSH = r"C:\Windows\System32\OpenSSH\ssh.exe"
WINDOWS_POWERSHELL = r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
GITHUB_ROOT = "https://api.github.com/repos/" + release.REPOSITORY + "/git/"
MAX_CONNECTION_BYTES = 8192
MAX_RECEIPT_BYTES = 65536
MAX_GITHUB_BYTES = 8 * 1024 * 1024
SSH_TIMEOUT = 1800
CONNECTION_KEYS = {"schema_version", "host", "port", "key_file", "known_hosts_file"}


class LocalReleaseError(Exception):
    def __init__(self, code, message, remote_outcome="NOT_RUN"):
        super().__init__(message)
        self.code = code
        self.message = message
        self.remote_outcome = remote_outcome


def require(condition, code, message):
    if not condition:
        raise LocalReleaseError(code, message)


def parse_json(data, limit, code):
    def unique(pairs):
        result = {}
        for name, value in pairs:
            if name in result:
                raise ValueError("duplicate")
            result[name] = value
        return result
    def invalid_constant(unused):
        raise ValueError("constant")
    require(isinstance(data, bytes) and len(data) <= limit, code, "The bounded JSON response is invalid.")
    try:
        result = json.loads(data.decode("utf-8-sig"), object_pairs_hook=unique, parse_constant=invalid_constant)
    except (ValueError, UnicodeError):
        raise LocalReleaseError(code, "The bounded JSON response is invalid.") from None
    require(type(result) is dict, code, "A JSON object is required.")
    return result


def validate_connection(value):
    require(type(value) is dict and set(value) == CONNECTION_KEYS and type(value["schema_version"]) is int
            and value["schema_version"] == 1, "connection_invalid", "Connection schema 1 with the exact supported fields is required.")
    require(type(value["port"]) is int and 1 <= value["port"] <= 65535,
            "connection_invalid", "The SSH port must be an integer in range.")
    for name in ("key_file", "known_hosts_file"):
        path = value[name]
        require(isinstance(path, str) and 0 < len(path) <= 4096 and not any(ord(c) < 32 or ord(c) == 127 for c in path),
                "connection_invalid", "Connection paths must be absolute Windows file paths.")
        windows = PureWindowsPath(path)
        require(windows.is_absolute() and re.fullmatch(r"[A-Za-z]:", windows.drive) and ".." not in windows.parts
                and ":" not in path[2:] and not any(c in path for c in '"<>|?*%$'),
                "connection_invalid", "UNC, relative, stream and ambiguous paths are not accepted.")
    require(PureWindowsPath(value["key_file"]) != PureWindowsPath(value["known_hosts_file"]),
            "connection_invalid", "The identity and host-pin files must be separate.")
    try:
        release.ssh_arguments(value["host"], value["port"], value["key_file"], value["known_hosts_file"])
    except release.ReleaseError:
        raise LocalReleaseError("connection_invalid", "The SSH connection settings are invalid.") from None
    return dict(value)


def load_connection(path):
    try:
        path = Path(path)
        require(path.is_file() and not path.is_symlink(), "connection_invalid", "The connection must be a regular JSON file.")
        with path.open("rb") as stream:
            return validate_connection(parse_json(stream.read(MAX_CONNECTION_BYTES + 1), MAX_CONNECTION_BYTES, "connection_invalid"))
    except OSError:
        raise LocalReleaseError("connection_invalid", "The connection file could not be read.") from None


def windows_ssh_arguments(connection):
    connection = validate_connection(connection)
    # OpenSSH parses the -o value again. Quote its filename as data, including
    # spaces; the configuration validator forbids embedded double quotes.
    pins = '"' + PureWindowsPath(connection["known_hosts_file"]).as_posix() + '"'
    arguments = release.ssh_arguments(connection["host"], connection["port"], connection["key_file"], pins, ssh=WINDOWS_SSH)
    return [os.devnull if value == "/dev/null" else "GlobalKnownHostsFile=" + os.devnull
            if value == "GlobalKnownHostsFile=/dev/null" else value for value in arguments]


class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *unused, **kwargs):
        return None


def read_github_json(url):
    require(isinstance(url, str) and re.fullmatch(re.escape(GITHUB_ROOT) + r"(?:commits/[0-9a-f]{40}|trees/[0-9a-f]{40}\?recursive=1)", url),
            "github_request_invalid", "Only the fixed repository's commit and tree reads are permitted.")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirects(),
                                        urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "Setae-Local-Release/1"})
    try:
        with opener.open(request, timeout=20) as response:
            require(response.status == 200, "github_read_failed", "The public commit/tree read did not succeed.")
            data = response.read(MAX_GITHUB_BYTES + 1)
        return parse_json(data, MAX_GITHUB_BYTES, "github_read_failed")
    except (OSError, urllib.error.URLError, TimeoutError):
        raise LocalReleaseError("github_read_failed", "The public commit/tree read failed; no SSH update was sent.") from None


def git_blob_sha1(body):
    return hashlib.sha1(b"blob " + str(len(body)).encode("ascii") + b"\0" + body).hexdigest()


def verify_commit_provenance(artifact, commit, reader=read_github_json):
    require(isinstance(commit, str) and re.fullmatch(r"[0-9a-f]{40}", commit),
            "commit_invalid", "A full lowercase Git commit SHA is required.")
    value = reader(GITHUB_ROOT + "commits/" + commit)
    require(type(value) is dict and value.get("sha") == commit and type(value.get("tree")) is dict,
            "commit_mismatch", "The public commit does not match the requested source attribution.")
    tree_sha = value["tree"].get("sha")
    require(isinstance(tree_sha, str) and re.fullmatch(r"[0-9a-f]{40}", tree_sha),
            "commit_mismatch", "The public commit has no supported tree SHA.")
    tree = reader(GITHUB_ROOT + "trees/" + tree_sha + "?recursive=1")
    require(type(tree) is dict and tree.get("sha") == tree_sha and tree.get("truncated") is False and type(tree.get("tree")) is list,
            "tree_incomplete", "The complete matching public tree is required before sending.")
    expected = {name: git_blob_sha1(body) for name, body in artifact["files"].items() if not name.startswith("vendor/")}
    actual, seen = {}, set()
    roots = set()
    for entry in tree["tree"]:
        require(type(entry) is dict and isinstance(entry.get("path"), str), "tree_invalid", "The public tree contains an invalid entry.")
        path = entry["path"]
        if path in {"plugins", "plugins/setae-core"}:
            require(entry.get("type") == "tree" and entry.get("mode") == "040000" and path not in roots,
                    "tree_invalid", "The public plugin ancestry must be regular tree objects.")
            roots.add(path)
            continue
        if not path.startswith("plugins/setae-core/"):
            continue
        relative = path[len("plugins/setae-core/"):]
        require(relative and "\\" not in relative and ":" not in relative and not any(c in {"", ".", ".."} for c in relative.split("/"))
                and not any(ord(c) < 32 or ord(c) == 127 for c in relative) and relative.casefold() not in seen,
                "tree_invalid", "The public plugin tree contains ambiguous or duplicate paths.")
        seen.add(relative.casefold())
        kind, mode, digest = entry.get("type"), entry.get("mode"), entry.get("sha")
        require((kind == "tree" and mode == "040000") or (kind == "blob" and mode in {"100644", "100755"}),
                "tree_invalid", "Plugin links, submodules and unknown modes are not accepted.")
        require(isinstance(digest, str) and re.fullmatch(r"[0-9a-f]{40}", digest), "tree_invalid", "The public tree has an invalid object SHA.")
        if kind == "blob" and not relative.startswith("vendor/"):
            actual[relative] = digest
    require(roots == {"plugins", "plugins/setae-core"} and actual == expected,
            "source_commit_mismatch", "The ZIP's complete first-party source differs from the public Git commit.")
    return {"status": "VERIFIED", "repository": release.REPOSITORY, "source_commit": commit,
            "tree_sha": tree_sha, "first_party_files": len(actual),
            "scope": "Git object content only", "branch_ancestry_and_tag_protection": "NOT_RUN"}


# This command is constant. Paths are process-environment data consumed only by
# -LiteralPath; they are never inserted into or evaluated as PowerShell source.
ACL_SCRIPT = r"""
$ErrorActionPreference = 'Stop'
try {
    $allowed = @([System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value, 'S-1-5-18', 'S-1-5-32-544')
    $writeMask = [System.Security.AccessControl.FileSystemRights]::Write -bor [System.Security.AccessControl.FileSystemRights]::Delete -bor [System.Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor [System.Security.AccessControl.FileSystemRights]::ChangePermissions -bor [System.Security.AccessControl.FileSystemRights]::TakeOwnership
    function Assert-Acl([string]$path, [bool]$private) {
        $acl = Get-Acl -LiteralPath $path
        if ($allowed -notcontains $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value) { throw 'owner' }
        $rules = @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
        if ($rules.Count -eq 0) { throw 'acl' }
        foreach ($rule in $rules) {
            if ($rule.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow -and $allowed -notcontains $rule.IdentityReference.Value) {
                if ($private -or (($rule.FileSystemRights -band $writeMask) -ne 0)) { throw 'access' }
            }
        }
    }
    function Assert-File([string]$path, [bool]$private) {
        $item = Get-Item -LiteralPath $path -Force
        if ($item.PSIsContainer) { throw 'file' }
        Assert-Acl $item.FullName $private
        Assert-Acl $item.Directory.FullName $false
        $current = $item
        while ($null -ne $current) {
            if (($current.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'link' }
            if ($current.PSIsContainer) { $current = $current.Parent } else { $current = $current.Directory }
        }
    }
    Assert-File $env:SETAE_ACL_KEY $true
    if ($env:SETAE_ACL_PINS) { Assert-File $env:SETAE_ACL_PINS $false }
    if ($env:SETAE_ACL_CONNECTION) { Assert-File $env:SETAE_ACL_CONNECTION $false }
    '{"ok":true}'
} catch {
    '{"ok":false}'
    exit 1
}
"""


def windows_environment():
    # Native Windows OpenSSH requires ProgramData even for its offline -G mode.
    return {"SystemRoot": r"C:\Windows", "WINDIR": r"C:\Windows", "ProgramData": r"C:\ProgramData", "PATH": r"C:\Windows\System32"}


def require_windows():
    require(os.name == "nt", "windows_required", "The local transport requires Windows OpenSSH.")
    require(all(Path(name).is_file() and not Path(name).is_symlink() for name in (WINDOWS_SSH, WINDOWS_POWERSHELL)),
            "runtime_missing", "The fixed Windows OpenSSH and Windows PowerShell executables are required.")


def check_windows_acl(key_file, known_hosts_file=None, connection_path=None, runner=subprocess.run):
    """Read ACL metadata only. A key-only call does not validate connection pins."""
    require_windows()
    environment = windows_environment()
    environment.update(SETAE_ACL_KEY=str(key_file), SETAE_ACL_PINS=str(known_hosts_file or ""),
                       SETAE_ACL_CONNECTION=str(connection_path or ""))
    try:
        result = runner([WINDOWS_POWERSHELL, "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", ACL_SCRIPT],
                        stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                        timeout=30, cwd=r"C:\Windows\System32", env=environment)
        require(result.returncode == 0, "acl_unverified", "Required file ownership and ACL restrictions could not be verified.")
        result_json = parse_json(result.stdout, 1024, "acl_unverified")
        require(result_json == {"ok": True} and result_json["ok"] is True,
                "acl_unverified", "Required file ownership and ACL restrictions could not be verified.")
    except (OSError, subprocess.SubprocessError):
        raise LocalReleaseError("acl_unverified", "The fixed read-only Windows ACL check failed.") from None
    return {"status": "VERIFIED", "scope": "Windows ACL metadata; no key content read"}


def run_ssh(connection, payload, runner=subprocess.run):
    require_windows()
    try:
        result = runner(windows_ssh_arguments(connection), input=payload, stdout=subprocess.PIPE,
                        stderr=subprocess.DEVNULL, timeout=SSH_TIMEOUT, cwd=r"C:\Windows\System32", env=windows_environment())
    except subprocess.TimeoutExpired:
        raise LocalReleaseError("ssh_timeout", "Remote outcome is unknown. Inspect the server journal before any retry.", "UNKNOWN") from None
    except OSError:
        raise LocalReleaseError("ssh_start_failed", "Windows OpenSSH could not be started; no successful receipt is available.") from None
    require_bytes = isinstance(result.stdout, bytes) and len(result.stdout) <= MAX_RECEIPT_BYTES
    if result.returncode != 0 or not require_bytes:
        raise LocalReleaseError("ssh_unconfirmed", "Remote outcome is unconfirmed. Inspect the server journal before any retry.", "UNKNOWN")
    try:
        return parse_json(result.stdout, MAX_RECEIPT_BYTES, "receipt_invalid")
    except LocalReleaseError:
        raise LocalReleaseError("receipt_invalid", "Remote outcome is unconfirmed; the receipt was invalid. Do not retry blindly.", "UNKNOWN") from None


def validate_preflight_receipt(value):
    fields = {"status", "operation", "version", "wordpress_version", "php_version", "wp_cli_version", "php_cli_compatible",
              "tested_php_cli_minor", "enabled", "auth_ready", "deployment_ready", "manual_recovery_required", "maintenance_file_present"}
    try:
        release.version_tuple(value.get("version"))
        valid = (set(value) == fields and value["status"] == "success" and value["operation"] == "preflight"
                 and all(type(value[name]) is bool for name in ("php_cli_compatible", "enabled", "auth_ready", "deployment_ready", "manual_recovery_required", "maintenance_file_present"))
                 and all(isinstance(value[name], str) and re.fullmatch(r"[0-9]+(?:\.[0-9]+){1,3}(?:[-+._A-Za-z0-9]{0,48})", value[name])
                         for name in ("wordpress_version", "php_version", "wp_cli_version", "tested_php_cli_minor")))
        if valid and value["deployment_ready"]:
            valid = (value["enabled"] and value["auth_ready"] and value["php_cli_compatible"]
                     and not value["manual_recovery_required"] and not value["maintenance_file_present"])
    except (release.ReleaseError, AttributeError, TypeError):
        valid = False
    if not valid:
        raise LocalReleaseError("receipt_invalid", "The server did not return a supported preflight receipt.", "UNKNOWN")
    return value


def validate_deploy_receipt(value, manifest, artifact):
    fields = {"status", "operation", "version", "previous_version", "sha256", "source_commit", "release_id", "backup_id",
              "installed_code", "smoke", "maintenance", "database_restored"}
    expected_code = {"files": artifact["file_count"], "bytes": sum(len(body) for body in artifact["files"].values())}
    valid = (type(value) is dict and set(value) == fields and value["status"] == "success" and value["operation"] == "deploy"
             and all(value[name] == manifest[name] for name in ("version", "sha256", "source_commit", "release_id"))
             and value["previous_version"] == manifest["expected_current_version"]
             and isinstance(value["backup_id"], str) and re.fullmatch(r"[0-9]{8}T[0-9]{6}Z-[0-9a-f]{32}", value["backup_id"])
             and value["installed_code"] == expected_code and all(type(value["installed_code"].get(name)) is int for name in ("files", "bytes"))
             and value["smoke"] == {"http_status": 200, "namespace": "setae/v1"}
             and type(value["smoke"]["http_status"]) is int
             and value["maintenance"] is False and value["database_restored"] is False)
    if not valid:
        raise LocalReleaseError("receipt_invalid", "The receipt does not confirm the complete reviewed deployment. Do not retry blindly.", "UNKNOWN")
    return value


def preflight(connection, connection_path=None, acl_checker=check_windows_acl, ssh_runner=run_ssh):
    connection = validate_connection(connection)
    acl = acl_checker(connection["key_file"], connection["known_hosts_file"], connection_path)
    value = ssh_runner(connection, b'{"protocol_version":1,"operation":"preflight"}\n')
    receipt = validate_preflight_receipt(value)
    return {"status": "success", "operation": "preflight", "remote_outcome": "CONFIRMED",
            "deployment_ready": receipt["deployment_ready"], "acl": acl, "receipt": receipt, "plugin_update": "NOT_RUN"}


def send(connection, archive_path, declaration_path, plugin_source, commit, connection_path=None,
         acl_checker=check_windows_acl, reader=read_github_json, ssh_runner=run_ssh):
    connection = validate_connection(connection)
    try:
        artifact = release.inspect_archive(archive_path)
        release.verify_source(artifact, plugin_source)
        declaration = release.check_declaration(release.load_json(declaration_path), artifact)
        manifest = release.manifest_for(declaration, artifact, commit)
    except (release.ReleaseError, OSError, ValueError, zipfile.BadZipFile):
        raise LocalReleaseError("admission_failed", "The exact local artifact, source or schema-2 review did not pass admission.") from None
    acl = acl_checker(connection["key_file"], connection["known_hosts_file"], connection_path)
    provenance = verify_commit_provenance(artifact, commit, reader=reader)
    try:
        with Path(archive_path).open("rb") as stream:
            data = stream.read(release.MAX_ZIP_BYTES + 1)
    except OSError:
        raise LocalReleaseError("artifact_changed", "The archive could not be re-snapshotted before transmission.") from None
    require(len(data) == manifest["bytes"] and release.sha256(data) == manifest["sha256"],
            "artifact_changed", "The archive changed before transmission; no update was sent.")
    payload = json.dumps(manifest, separators=(",", ":")).encode("utf-8") + b"\n" + data
    receipt = validate_deploy_receipt(ssh_runner(connection, payload), manifest, artifact)
    return {"status": "success", "operation": "send", "remote_outcome": "CONFIRMED", "acl": acl,
            "source_provenance": provenance, "review_checks": {name: value["status"] for name, value in declaration["review"]["checks"].items()},
            "receipt": receipt}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    operations = parser.add_subparsers(dest="operation", required=True)
    for operation in ("preflight", "send"):
        command = operations.add_parser(operation)
        command.add_argument("--connection", required=True, help="Local schema-1 JSON; paths only, never key contents.")
        command.add_argument("--report", required=True, type=Path, help="New report filename; never overwrites existing evidence.")
        if operation == "send":
            command.add_argument("--archive", required=True)
            command.add_argument("--declaration", required=True)
            command.add_argument("--plugin-source", required=True)
            command.add_argument("--commit", required=True,
                                 help="Full Git SHA. Its public fixed-repository tree must match all ZIP first-party blobs; main ancestry/tag policy are not verified by this local route.")
    args = parser.parse_args(argv)
    try:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        # Reserve before any remote read or SSH attempt, including on failures.
        report_file = args.report.open("x", encoding="utf-8", newline="\n")
    except OSError:
        print('{"status":"error","code":"report_unavailable","remote_outcome":"NOT_RUN"}')
        return 1
    with report_file:
        try:
            connection = load_connection(args.connection)
            connection_path = Path(args.connection).resolve()
            if args.operation == "preflight":
                result = preflight(connection, connection_path)
            else:
                result = send(connection, args.archive, args.declaration, args.plugin_source, args.commit, connection_path)
            exit_code = 0
        except LocalReleaseError as error:
            result = {"status": "error", "operation": args.operation, "code": error.code,
                      "message": error.message, "remote_outcome": error.remote_outcome}
            exit_code = 1
        except Exception:
            # Never print raw exceptions, command stderr, authentication data or
            # server payloads. Unexpected failures cannot establish remote state.
            result = {"status": "error", "operation": args.operation, "code": "local_client_failed",
                      "message": "The client failed without a valid confirmation; inspect state before retrying.", "remote_outcome": "UNKNOWN"}
            exit_code = 1
        report_file.write(json.dumps({"schema_version": 1, **result}, ensure_ascii=True, indent=2) + "\n")
        report_file.flush()
        os.fsync(report_file.fileno())
    print(json.dumps(result, ensure_ascii=True, separators=(",", ":")))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
