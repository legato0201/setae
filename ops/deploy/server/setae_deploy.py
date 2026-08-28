#!/usr/bin/python3
"""Fixed SETAE updater. Python stdlib only; no root execution and no shell commands.

Installation is separate from execution. A root-owned wrapper/config/module must
be installed by an administrator; routine execution is as the PHP service user.
This is NOT isolation from compromised PHP running under that same Unix UID.
Code-only is a reviewed-release attestation, not a sandbox preventing DB writes.
No database restoration or automatic code rollback is implemented.
"""

from __future__ import annotations

import contextlib
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import ssl
import stat
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from dataclasses import dataclass

try:
    import fcntl
    import pwd
    import resource
except ImportError:  # Pure validators remain importable by offline Windows tests.
    fcntl = None
    pwd = None
    resource = None

PLUGIN = "setae-core"
HEADER = "setae-core/setae-core.php"
CONFIG_PATH = Path("/etc/setae-deploy/config.json")
MODULE_PATH = Path("/usr/local/lib/setae-deploy/setae_deploy.py")
WRAPPER_PATH = Path("/usr/local/sbin/setae-deploy")
PYTHON_PATH = Path("/usr/bin/python3")
REMOTE_COMMAND = "/usr/bin/sudo -n -u www-data -- /usr/local/sbin/setae-deploy"
MAX_MANIFEST_BYTES = 4096
MAX_ARCHIVE_BYTES = 32 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 128 * 1024 * 1024
MAX_FILE_BYTES = 16 * 1024 * 1024
MAX_MEMBERS = 10000
MAX_COMPRESSION_RATIO = 200
MAX_DATABASE_BYTES = 2 * 1024 * 1024 * 1024
DISK_SAFETY_BYTES = 256 * 1024 * 1024
MIN_DATABASE_LIMIT = 16 * 1024 * 1024
MAX_REST_INDEX_BYTES = 4 * 1024 * 1024
REST_NAMESPACE = "setae/v1"
TESTED_PHP_CLI_MINOR = "8.3"
SINGLE_SITE_CHECK = "echo is_multisite() ? 'multisite' : 'single';"
INPUT_TIMEOUT = 120
COMMAND_TIMEOUT = 180
BACKUP_TIMEOUT = 900
SMOKE_TIMEOUT = 20
BLOCK_FILE = "deployment-blocked.json"
DEPLOY_KEYS = {"protocol_version", "operation", "version", "expected_current_version", "sha256", "bytes", "source_commit", "code_only", "release_id"}
CONFIG_KEYS = {"schema_version", "enabled", "auth_ready", "run_user", "wp_root", "php_path", "wp_cli_path", "state_dir", "smoke_url"}


class DeployError(Exception):
    def __init__(self, code: str, message: str, **details):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details


def fail(code: str, message: str):
    raise DeployError(code, message)


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            fail("duplicate_json_key", "Duplicate JSON keys are not accepted.")
        result[key] = value
    return result


def _json(text: str):
    try:
        return json.loads(text, object_pairs_hook=_unique_object,
                          parse_constant=lambda value: fail("invalid_json", "JSON constants must be finite."))
    except (ValueError, UnicodeError):
        fail("invalid_json", "The JSON document is invalid.")


def parse_version(value: str) -> tuple[int, int, int, int]:
    if not isinstance(value, str) or not re.fullmatch(r"(?:0|[1-9][0-9]{0,5})(?:\.(?:0|[1-9][0-9]{0,5})){2,3}", value):
        fail("invalid_version", "A numeric three- or four-component version is required.")
    parts = tuple(int(part) for part in value.split("."))
    return parts + (0,) * (4 - len(parts))


def parse_manifest(line: bytes) -> dict:
    if not isinstance(line, bytes) or len(line) > MAX_MANIFEST_BYTES or not line.endswith(b"\n") or line.count(b"\n") != 1:
        fail("invalid_manifest_frame", "Send one bounded JSON line ending in a newline.")
    try:
        data = _json(line.decode("utf-8"))
    except UnicodeError:
        fail("invalid_manifest_frame", "The manifest must be UTF-8.")
    if not isinstance(data, dict) or type(data.get("protocol_version")) is not int or data["protocol_version"] != 1:
        fail("invalid_protocol", "Protocol version 1 is required.")
    if data.get("operation") == "preflight":
        if set(data) != {"protocol_version", "operation"}:
            fail("invalid_manifest_keys", "Preflight accepts no deployment parameters.")
        return data
    if data.get("operation") != "deploy" or set(data) != DEPLOY_KEYS:
        fail("invalid_manifest_keys", "The deploy manifest has missing or unsupported fields.")
    parse_version(data["version"])
    parse_version(data["expected_current_version"])
    if parse_version(data["version"]) <= parse_version(data["expected_current_version"]):
        fail("version_not_increasing", "Reinstalling or downgrading a version is not allowed.")
    if type(data["bytes"]) is not int or not 0 < data["bytes"] <= MAX_ARCHIVE_BYTES:
        fail("archive_size", "The declared archive size is outside the limit.")
    for key, pattern in (("sha256", r"[0-9a-f]{64}"), ("source_commit", r"[0-9a-f]{40}"), ("release_id", r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}")):
        if not isinstance(data[key], str) or not re.fullmatch(pattern, data[key]):
            fail("invalid_manifest_value", "A release identifier, digest or source commit is invalid.")
    if data["code_only"] is not True:
        fail("approval_required", "Only an explicitly reviewed code-only release can use this updater.")
    return data


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def receive_archive(stream, manifest: dict, destination: Path) -> Path:
    """Snapshot exactly the declared bytes. Never overwrite or follow a destination link."""
    if type(manifest.get("bytes")) is not int or not 0 < manifest["bytes"] <= MAX_ARCHIVE_BYTES:
        fail("archive_size", "The declared archive size is outside the limit.")
    if not isinstance(manifest.get("sha256"), str) or not re.fullmatch(r"[0-9a-f]{64}", manifest["sha256"]):
        fail("archive_hash", "A SHA256 digest is required before receiving an archive.")
    destination = Path(destination)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(destination, flags, 0o600)
    except OSError:
        fail("snapshot_unavailable", "A private archive snapshot could not be created.")
    complete = False
    try:
        digest = hashlib.sha256()
        remaining = manifest["bytes"]
        with os.fdopen(fd, "wb") as target:
            while remaining:
                block = stream.read(min(65536, remaining))
                if not block:
                    fail("archive_truncated", "The archive ended before its declared size.")
                if len(block) > remaining:
                    fail("archive_trailing_data", "The archive stream exceeds its declared size.")
                target.write(block)
                digest.update(block)
                remaining -= len(block)
            if stream.read(1):
                fail("archive_trailing_data", "No data may follow the declared archive.")
            target.flush()
            os.fsync(target.fileno())
        if digest.hexdigest() != manifest["sha256"]:
            fail("archive_hash", "The received archive digest does not match the manifest.")
        os.chmod(destination, 0o400)
        complete = True
        return destination
    finally:
        if not complete:
            destination.unlink(missing_ok=True)


def _header_version(contents: bytes) -> str:
    # WordPress reads only this header window. Avoid splitting a UTF-8 comment
    # at its boundary, and accept both LF and CRLF without decoding PHP text.
    header = contents[:8192].removeprefix(b"\xef\xbb\xbf")
    match = re.search(rb"^[ \t/*#@]*Version:[ \t]*([0-9.]+)[ \t\r]*$", header, re.MULTILINE | re.IGNORECASE)
    if not match:
        fail("plugin_header", "The fixed plugin header has no supported version.")
    version = match.group(1).decode("ascii")
    parse_version(version)
    return version


def validate_zip(path: Path, expected_version: str) -> dict:
    """Inspect every member/CRC without extracting. ZIP names never become host paths."""
    parse_version(expected_version)
    total = 0
    seen = {}
    files = {}
    header = None
    try:
        with zipfile.ZipFile(path) as archive:
            members = archive.infolist()
            if not members or len(members) > MAX_MEMBERS:
                fail("zip_member_limit", "The archive member count is outside the limit.")
            for item in members:
                name = item.orig_filename
                if (name != item.filename or not name or "\\" in name or ":" in name or name.startswith("/")
                        or any(ord(char) < 32 or ord(char) == 127 for char in name)):
                    fail("zip_path", "Unsafe archive paths are not accepted.")
                parts = name.rstrip("/").split("/")
                if (parts[0] != PLUGIN or any(part in ("", ".", "..") for part in parts)
                        or len(name.encode("utf-8")) > 4096 or any(len(part.encode("utf-8")) > 255 for part in parts)):
                    fail("zip_path", "Every archive entry must be below the fixed plugin root.")
                mode = item.external_attr >> 16
                kind = stat.S_IFMT(mode)
                is_dir = item.is_dir()
                if mode & 0o7000 or kind not in (0, stat.S_IFREG, stat.S_IFDIR) or (kind == stat.S_IFDIR and not is_dir) or (kind == stat.S_IFREG and is_dir):
                    fail("zip_special_file", "Links and special archive entries are forbidden.")
                if len(parts) == 1 and not is_dir:
                    fail("zip_path", "The archive root must be a directory.")
                # Unix link-bearing extras are not needed by the release builder.
                extra = item.extra
                while extra:
                    if len(extra) < 4:
                        fail("zip_extra", "Malformed archive metadata is forbidden.")
                    tag = int.from_bytes(extra[:2], "little")
                    length = int.from_bytes(extra[2:4], "little")
                    if len(extra) < 4 + length or tag not in (0x0001, 0x000A, 0x5455, 0x7875):
                        fail("zip_extra", "Unsupported archive metadata is forbidden.")
                    extra = extra[4 + length:]
                key = "/".join(parts).casefold()
                if key in seen:
                    fail("zip_duplicate", "Duplicate or case-ambiguous archive paths are forbidden.")
                seen[key] = is_dir
                if item.flag_bits & 1 or item.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                    fail("zip_compression", "Encrypted or unsupported compression is forbidden.")
                total += item.file_size
                if (item.file_size > MAX_FILE_BYTES or total > MAX_UNCOMPRESSED_BYTES
                        or item.file_size > max(1, item.compress_size) * MAX_COMPRESSION_RATIO
                        or is_dir and item.file_size):
                    fail("zip_expansion_limit", "The archive expansion exceeds a safety limit.")
                size = 0
                digest = hashlib.sha256()
                content = bytearray() if name == HEADER and not is_dir else None
                with archive.open(item) as source:
                    for chunk in iter(lambda: source.read(65536), b""):
                        size += len(chunk)
                        digest.update(chunk)
                        if size > item.file_size or size > MAX_FILE_BYTES:
                            fail("zip_expansion_limit", "A member exceeds its declared size.")
                        if content is not None and len(content) < 8192:
                            content.extend(chunk[:8192 - len(content)])
                if size != item.file_size:
                    fail("zip_size", "An archive member has an inconsistent size.")
                if content is not None:
                    header = _header_version(bytes(content))
                if not is_dir:
                    files[name] = {"bytes": size, "sha256": digest.hexdigest()}
            for key in seen:
                parts = key.split("/")
                if any(seen.get("/".join(parts[:end])) is False for end in range(1, len(parts))):
                    fail("zip_path_conflict", "An archive file cannot also be a parent directory.")
    except (zipfile.BadZipFile, OSError, RuntimeError, EOFError, NotImplementedError):
        fail("invalid_zip", "The archive could not be fully verified.")
    if header != expected_version:
        fail("zip_version", "The fixed plugin header differs from the declared version.")
    return {"version": header, "members": len(seen), "uncompressed_bytes": total, "files": files}


@dataclass(frozen=True)
class Config:
    schema_version: int = 1
    enabled: bool = False
    auth_ready: bool = False
    run_user: str = "www-data"
    wp_root: Path = Path("/var/www/html/setae")
    php_path: Path = Path("/usr/bin/php")
    wp_cli_path: Path = Path("/usr/local/bin/wp")
    state_dir: Path = Path("/var/lib/setae-deploy")
    smoke_url: str = ""

    def __post_init__(self):
        for field in ("wp_root", "php_path", "wp_cli_path", "state_dir"):
            object.__setattr__(self, field, Path(getattr(self, field)))

    @property
    def plugin_dir(self):
        return self.wp_root / "wp-content" / "plugins" / PLUGIN


def verify_root_file(path: Path, executable: bool = False):
    """Root ownership is immutability, not the UID under which the file executes."""
    path = Path(path)
    if not path.is_absolute():
        fail("unsafe_dependency", "A trusted dependency must use an absolute path.")
    try:
        resolved = path.resolve(strict=True)
        pending = [path, resolved]
        checked = set()
        while pending:
            current = pending.pop()
            for candidate in (current, *current.parents):
                if candidate in checked:
                    continue
                checked.add(candidate)
                if len(checked) > 128:
                    fail("unsafe_dependency", "The trusted dependency has an unsupported link chain.")
                info = candidate.lstat()
                if info.st_uid != 0 or not stat.S_ISLNK(info.st_mode) and (info.st_mode & 0o022 or os.access(candidate, os.W_OK)):
                    fail("unsafe_dependency", "Root-managed dependencies must not be writable by deployment or PHP users.")
                if stat.S_ISLNK(info.st_mode):
                    target = Path(os.readlink(candidate))
                    pending.append(target if target.is_absolute() else candidate.parent / target)
        info = resolved.stat()
        if not stat.S_ISREG(info.st_mode) or os.access(resolved, os.W_OK) or executable and not os.access(resolved, os.X_OK):
            fail("unsafe_dependency", "A trusted dependency has unsafe ownership or permissions.")
    except OSError:
        fail("missing_dependency", "A required root-managed dependency is unavailable.")


def load_config(path: Path = CONFIG_PATH) -> Config:
    path = Path(path)
    verify_root_file(path)
    try:
        if path.stat().st_size > 8192:
            fail("invalid_config", "The configuration is too large.")
        data = _json(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError):
        fail("invalid_config", "The root-managed configuration could not be read.")
    if (not isinstance(data, dict) or set(data) != CONFIG_KEYS or type(data.get("schema_version")) is not int
            or data["schema_version"] != 1 or type(data.get("enabled")) is not bool or type(data.get("auth_ready")) is not bool):
        fail("invalid_config", "The root-managed configuration has missing or unsupported fields.")
    if any(not isinstance(data[key], str) for key in ("run_user", "wp_root", "php_path", "wp_cli_path", "state_dir", "smoke_url")):
        fail("invalid_config", "Configuration paths and identifiers must be strings.")
    if not re.fullmatch(r"[a-z_][a-z0-9_-]{0,31}", data["run_user"]) or data["run_user"] == "root":
        fail("invalid_config", "The execution user must be an explicitly configured service user.")
    for key in ("wp_root", "php_path", "wp_cli_path", "state_dir"):
        if not data[key].startswith("/") or "\x00" in data[key] or ".." in PurePosixPath(data[key]).parts:
            fail("invalid_config", "Configuration paths must be fixed absolute paths.")
    config = Config(**data)
    if config.smoke_url:
        _validate_smoke_url(config.smoke_url)
    return config


def _private_directory(path: Path, uid: int):
    try:
        info = path.lstat()
        if not stat.S_ISDIR(info.st_mode) or path.resolve() != path or info.st_uid != uid or info.st_mode & 0o077:
            fail("unsafe_state", "The state directory must be private, owned by the service user and not a symlink.")
        if not os.access(path, os.W_OK | os.X_OK):
            fail("unsafe_state", "The service user cannot use the private state directory.")
        for parent in path.parents:
            ancestor = parent.stat()
            if ancestor.st_uid != 0 or ancestor.st_mode & 0o022 or os.access(parent, os.W_OK):
                fail("unsafe_state", "The private state directory has an unsafe writable ancestor.")
    except OSError:
        fail("unsafe_state", "The administrator must provision the private state directory first.")


def validate_host(config: Config):
    if sys.platform != "linux" or fcntl is None or pwd is None or resource is None:
        fail("unsupported_platform", "Runtime deployment requires Linux with POSIX locking.")
    try:
        uid = pwd.getpwnam(config.run_user).pw_uid
    except KeyError:
        fail("execution_user", "The configured service user does not exist.")
    if uid == 0 or os.geteuid() != uid or os.getuid() != uid:
        fail("execution_user", "Run only as the configured PHP service user, never root.")
    for path, executable in ((WRAPPER_PATH, True), (MODULE_PATH, False), (CONFIG_PATH, False), (PYTHON_PATH, True), (config.php_path, True), (config.wp_cli_path, True)):
        verify_root_file(path, executable)
    for path in (config.wp_root, config.wp_root / "wp-content", config.wp_root / "wp-content/plugins", config.plugin_dir):
        if not path.is_dir() or path.resolve() != path or not os.access(path, os.R_OK | os.W_OK | os.X_OK):
            fail("wordpress_path", "The fixed WordPress/plugin paths must be real directories writable by the service user.")
    for name in ("wp-config.php", "wp-load.php"):
        if not (config.wp_root / name).is_file():
            fail("wordpress_path", "The configured path is not the expected WordPress installation.")
    _private_directory(config.state_dir, uid)
    if config.state_dir == config.wp_root or config.wp_root in config.state_dir.parents or config.state_dir in config.wp_root.parents:
        fail("unsafe_state", "The private state/backup directory must be outside the web root.")


class FileLock:
    def __init__(self, path: Path):
        self.path = path
        self.fd = None

    def __enter__(self):
        if fcntl is None:
            fail("unsupported_platform", "POSIX locking is required.")
        try:
            self.fd = os.open(self.path, os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
            info = os.fstat(self.fd)
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o077:
                fail("unsafe_lock", "The deployment lock is not a private regular file.")
            fcntl.flock(self.fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return self
        except BlockingIOError:
            self.__exit__(None, None, None)
            fail("deployment_busy", "Another deployment is already running.")
        except BaseException:
            self.__exit__(None, None, None)
            raise

    def __exit__(self, *unused):
        if self.fd is not None:
            os.close(self.fd)
            self.fd = None


def _wp_environment(config: Config) -> dict:
    return {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": "/nonexistent", "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8",
            "WP_CLI_CONFIG_PATH": "/dev/null", "WP_CLI_PACKAGES_DIR": "/nonexistent/setae-no-packages",
            "WP_CLI_CACHE_DIR": str(config.state_dir / "cache")}


def run_wp(config: Config, arguments: list[str], timeout: int = COMMAND_TIMEOUT, file_limit: int | None = None) -> str:
    command = [str(config.php_path), "-d", "auto_prepend_file=", "-d", "auto_append_file=", str(config.wp_cli_path),
               "--path=" + str(config.wp_root), "--skip-plugins", "--skip-themes", "--skip-packages", "--no-color", *arguments]
    child_setup = None
    if file_limit is not None:
        if resource is None or type(file_limit) is not int or not 0 < file_limit <= MAX_DATABASE_BYTES:
            fail("backup_limit", "A supported child-process database file limit is required.")
        hard = resource.getrlimit(resource.RLIMIT_FSIZE)[1]
        bounded = file_limit if hard == resource.RLIM_INFINITY else min(file_limit, hard)
        if bounded < MIN_DATABASE_LIMIT:
            fail("backup_limit", "The service process database file limit is too small.")
        def child_setup():
            resource.setrlimit(resource.RLIMIT_FSIZE, (bounded, bounded))
    try:
        with subprocess.Popen(command, cwd="/", env=_wp_environment(config), stdin=subprocess.DEVNULL,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True, preexec_fn=child_setup) as process:
            try:
                output, unused_error = process.communicate(timeout=timeout)
            except subprocess.TimeoutExpired:
                # mysqldump is a grandchild: stop the session, not only its PHP parent.
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
                fail("wp_cli_failed", "A fixed WP-CLI command timed out; its process group was stopped.")
            returncode = process.returncode
    except (OSError, subprocess.SubprocessError):
        fail("wp_cli_failed", "A fixed WP-CLI check failed or timed out; command output is withheld.")
    if returncode or len(output) > 4 * 1024 * 1024:
        fail("wp_cli_failed", "A fixed WP-CLI check failed; command output is withheld.")
    try:
        return output.decode("utf-8")
    except UnicodeError:
        fail("wp_cli_output", "WP-CLI returned an unreadable result.")


def _read_wp(config: Config, runner) -> dict:
    info = _json(runner(config, ["cli", "info", "--format=json"]))
    if not isinstance(info, dict) or not isinstance(info.get("php_version"), str) or not isinstance(info.get("wp_cli_version"), str):
        fail("wp_cli_output", "The PHP/WP-CLI version check returned an unexpected result.")
    if any(not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:[-+._A-Za-z0-9]{0,48})", info[key]) for key in ("php_version", "wp_cli_version")):
        fail("wp_cli_output", "PHP/WP-CLI returned an unsupported version identifier.")
    core = runner(config, ["core", "version"]).strip()
    if not re.fullmatch(r"[0-9]+(?:\.[0-9]+){1,3}", core):
        fail("wp_cli_output", "The WordPress version check returned an unexpected result.")
    if runner(config, ["eval", SINGLE_SITE_CHECK]).strip() != "single":
        fail("multisite_unsupported", "Automatic deployment supports only a confirmed single-site installation.")
    plugin = _json(runner(config, ["plugin", "get", PLUGIN, "--fields=name,status,version", "--format=json"]))
    if not isinstance(plugin, dict) or plugin.get("name") != PLUGIN or plugin.get("status") != "active":
        fail("plugin_not_active", "The fixed plugin must already be active on a single-site installation.")
    parse_version(plugin.get("version"))
    try:
        header_path = config.plugin_dir / "setae-core.php"
        if header_path.is_symlink() or not header_path.is_file():
            fail("plugin_header", "The installed plugin header must be a regular file.")
        with header_path.open("rb") as source:
            header = _header_version(source.read(8192))
    except OSError:
        fail("plugin_header", "The installed plugin header could not be read.")
    if header != plugin["version"]:
        fail("current_version_mismatch", "The installed plugin file and WordPress version disagree.")
    return {"version": header, "wordpress_version": core, "php_version": info["php_version"], "wp_cli_version": info["wp_cli_version"],
            "php_cli_compatible": info["php_version"].startswith(TESTED_PHP_CLI_MINOR + "."), "tested_php_cli_minor": TESTED_PHP_CLI_MINOR}


def preflight(config: Config, runner=run_wp) -> dict:
    validate_host(config)
    with FileLock(config.state_dir / "deploy.lock"):
        info = _read_wp(config, runner)
        blocked = os.path.lexists(config.state_dir / BLOCK_FILE)
        maintenance = os.path.lexists(config.wp_root / ".maintenance")
        return {"status": "success", "operation": "preflight", **info, "enabled": config.enabled, "auth_ready": config.auth_ready,
                "deployment_ready": bool(config.enabled and config.auth_ready and config.smoke_url and info["php_cli_compatible"] and not blocked and not maintenance),
                "manual_recovery_required": blocked, "maintenance_file_present": maintenance}


def _write_json(path: Path, value: dict):
    fd, temporary = tempfile.mkstemp(prefix=".setae-state-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as target:
            json.dump(value, target, ensure_ascii=True, sort_keys=True)
            target.write("\n")
            target.flush()
            os.fsync(target.fileno())
        os.replace(temporary, path)
        if os.name == "posix":
            parent_fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(parent_fd)
            finally:
                os.close(parent_fd)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def backup_code(config: Config, destination: Path, version: str) -> dict:
    total = count = 0
    try:
        with zipfile.ZipFile(destination, "x", compression=zipfile.ZIP_STORED, strict_timestamps=False) as archive:
            for base, directories, files in os.walk(config.plugin_dir, followlinks=False):
                directories.sort()
                files.sort()
                for name in directories + files:
                    path = Path(base) / name
                    before = path.lstat()
                    if not (stat.S_ISDIR(before.st_mode) or stat.S_ISREG(before.st_mode)):
                        fail("unsafe_current_code", "Current plugin links or special files need a manual deployment.")
                    count += 1
                    total += before.st_size if stat.S_ISREG(before.st_mode) else 0
                    if count > MAX_MEMBERS or total > MAX_UNCOMPRESSED_BYTES or stat.S_ISREG(before.st_mode) and before.st_size > MAX_FILE_BYTES:
                        fail("backup_limit", "The current plugin exceeds the automatic backup limits.")
                    archive.write(path, PLUGIN + "/" + path.relative_to(config.plugin_dir).as_posix())
                    after = path.lstat()
                    if (before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns):
                        fail("current_code_changed", "Current plugin files changed while creating the backup.")
        os.chmod(destination, 0o600)
        validate_zip(destination, version)
        with destination.open("r+b") as durable:
            os.fsync(durable.fileno())
        return {"file": destination.name, "bytes": destination.stat().st_size, "sha256": _sha256(destination)}
    except OSError:
        fail("backup_failed", "The current plugin could not be backed up.")


def verify_installed(config: Config, inspection: dict) -> dict:
    """Compare every installed regular file with the verified ZIP; reject extras."""
    expected = inspection["files"]
    found = set()
    count = total = 0
    try:
        root_before = config.plugin_dir.lstat()
        if not stat.S_ISDIR(root_before.st_mode) or config.plugin_dir.resolve() != config.plugin_dir:
            fail("installed_code_mismatch", "The installed plugin root is not a real directory.")
        def walk_error(unused):
            fail("installed_code_mismatch", "The complete installed plugin tree could not be inspected.")
        for base, directories, files in os.walk(config.plugin_dir, followlinks=False, onerror=walk_error):
            for name in directories + files:
                path = Path(base) / name
                before = path.lstat()
                count += 1
                if count > MAX_MEMBERS or not (stat.S_ISREG(before.st_mode) or stat.S_ISDIR(before.st_mode)):
                    fail("installed_code_mismatch", "The installed plugin contains unsupported files or links.")
                if stat.S_ISDIR(before.st_mode):
                    continue
                key = PLUGIN + "/" + path.relative_to(config.plugin_dir).as_posix()
                wanted = expected.get(key)
                if wanted is None or before.st_size != wanted["bytes"]:
                    fail("installed_code_mismatch", "Installed files differ from the verified release archive.")
                digest = hashlib.sha256()
                size = 0
                fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
                with os.fdopen(fd, "rb") as source:
                    opened = os.fstat(source.fileno())
                    if (before.st_dev, before.st_ino, before.st_size) != (opened.st_dev, opened.st_ino, opened.st_size):
                        fail("installed_code_mismatch", "An installed file changed while being opened.")
                    for chunk in iter(lambda: source.read(65536), b""):
                        size += len(chunk)
                        if size > wanted["bytes"]:
                            fail("installed_code_mismatch", "An installed file changed during verification.")
                        digest.update(chunk)
                after = path.lstat()
                if ((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_mode)
                        != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_mode)
                        or size != wanted["bytes"] or digest.hexdigest() != wanted["sha256"]):
                    fail("installed_code_mismatch", "Installed file bytes differ from the verified release archive.")
                found.add(key)
                total += size
        root_after = config.plugin_dir.lstat()
        if (root_before.st_dev, root_before.st_ino) != (root_after.st_dev, root_after.st_ino) or found != set(expected):
            fail("installed_code_mismatch", "The installed file set differs from the verified release archive.")
    except OSError:
        fail("installed_code_mismatch", "The complete installed plugin could not be verified.")
    return {"files": len(found), "bytes": total}


def database_file_limit(free_bytes: int) -> int:
    """A per-file child limit, not a reservation against other disk writers."""
    if type(free_bytes) is not int or free_bytes < DISK_SAFETY_BYTES + MIN_DATABASE_LIMIT:
        fail("disk_space", "The private backup filesystem lacks the required safety margin.")
    return min(MAX_DATABASE_BYTES, free_bytes - DISK_SAFETY_BYTES)


def _create_backup(config: Config, manifest: dict, current: dict, runner) -> tuple[Path, dict]:
    parent = config.state_dir / "backups"
    parent.mkdir(mode=0o700, exist_ok=True)
    if parent.is_symlink() or parent.resolve().parent != config.state_dir:
        fail("unsafe_state", "The backup parent is not the fixed private directory.")
    if os.name == "posix" and (parent.stat().st_uid != config.state_dir.stat().st_uid or parent.stat().st_mode & 0o077):
        fail("unsafe_state", "Backups require a private directory owned by the service user.")
    backup_id = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ-") + uuid.uuid4().hex
    directory = parent / backup_id
    directory.mkdir(mode=0o700)
    record = {"backup_id": backup_id, "manifest": manifest, "previous": current, "complete": False}
    _write_json(directory / "backup.json", record)
    record["code"] = backup_code(config, directory / "current-code.zip", current["version"])
    # A consistent online dump requires transactional tables; do not claim one for MyISAM.
    engines = runner(config, ["db", "query", "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'", "--skip-column-names"]).splitlines()
    if not engines or any(engine.strip().upper() != "INNODB" for engine in engines):
        fail("backup_engine", "All database tables must support a consistent transactional backup.")
    database = directory / "database.sql"
    file_limit = database_file_limit(shutil.disk_usage(directory).free)
    runner(config, ["db", "export", str(database), "--single-transaction", "--quick", "--skip-lock-tables", "--add-drop-table"],
           timeout=BACKUP_TIMEOUT, file_limit=file_limit)
    if database.is_symlink() or not database.is_file() or not 0 < database.stat().st_size <= file_limit:
        fail("database_backup_failed", "A nonempty regular SQL backup was not produced within the limit.")
    os.chmod(database, 0o600)
    with database.open("r+b") as durable:
        os.fsync(durable.fileno())
    record["database"] = {"file": database.name, "bytes": database.stat().st_size, "sha256": _sha256(database), "file_limit_bytes": file_limit}
    record["complete"] = True
    _write_json(directory / "backup.json", record)
    return directory, record


def _validate_smoke_url(url: str):
    if not isinstance(url, str) or any(ord(char) < 32 or ord(char) == 127 for char in url):
        fail("smoke_configuration", "The fixed smoke URL is invalid.")
    try:
        value = urllib.parse.urlsplit(url)
        if value.scheme != "https" or not value.hostname or value.username or value.password or value.fragment or value.port not in (None, 443):
            fail("smoke_configuration", "Configure one fixed HTTPS WordPress REST index without credentials.")
        path = urllib.parse.unquote(value.path, errors="strict")
        if "\\" in path or any(ord(char) < 32 or ord(char) == 127 for char in path) or any(part in (".", "..") for part in path.split("/")):
            fail("smoke_configuration", "The REST index path must not contain traversal or path aliases.")
        pretty_index = not value.query and path.endswith("/wp-json/")
        query_index = (path.endswith("/index.php") or path.endswith("/")) and urllib.parse.parse_qsl(value.query, keep_blank_values=True) == [("rest_route", "/")]
        if not (pretty_index or query_index):
            fail("smoke_configuration", "The smoke endpoint must be the WordPress REST index, not an application or login page.")
    except ValueError:
        fail("smoke_configuration", "The fixed smoke URL is invalid.")


class _NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *unused, **kwargs):
        return None


def smoke_check(config: Config) -> dict:
    _validate_smoke_url(config.smoke_url)
    request = urllib.request.Request(config.smoke_url, headers={"User-Agent": "Setae-Deploy/1", "Cache-Control": "no-cache", "Accept": "application/json"})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirects(), urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    try:
        with opener.open(request, timeout=SMOKE_TIMEOUT) as response:
            if response.status != 200:
                fail("smoke_failed", "The fixed HTTPS smoke endpoint did not return HTTP 200.")
            if response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
                fail("smoke_failed", "The WordPress REST index did not return JSON.")
            body = response.read(MAX_REST_INDEX_BYTES + 1)
            if len(body) > MAX_REST_INDEX_BYTES:
                fail("smoke_failed", "The WordPress REST index exceeds the response size limit.")
            try:
                index = _json(body.decode("utf-8-sig"))
            except (DeployError, UnicodeError):
                fail("smoke_failed", "The WordPress REST index is not a valid JSON document.")
            namespaces = index.get("namespaces") if isinstance(index, dict) else None
            if not isinstance(namespaces, list) or REST_NAMESPACE not in namespaces or not all(isinstance(item, str) for item in namespaces):
                fail("smoke_failed", "The WordPress REST index does not expose the required SETAE namespace.")
            return {"http_status": response.status, "namespace": REST_NAMESPACE}
    except (urllib.error.URLError, OSError, TimeoutError):
        fail("smoke_failed", "The fixed HTTPS smoke endpoint could not be verified.")


def deploy(config: Config, manifest: dict, archive: Path, runner=run_wp, smoke=smoke_check) -> dict:
    manifest = parse_manifest((json.dumps(manifest, separators=(",", ":")) + "\n").encode("utf-8"))
    if manifest["operation"] != "deploy":
        fail("invalid_operation", "This operation requires a deploy manifest.")
    validate_host(config)
    if not config.enabled or not config.auth_ready:
        fail("deployment_disabled", "An administrator must enable deployment after configuring SSH authorization.")
    _validate_smoke_url(config.smoke_url)
    archive = Path(archive)
    if archive.is_symlink() or not archive.is_file() or config.state_dir not in archive.resolve().parents:
        fail("unsafe_snapshot", "Use only a private received snapshot inside the state directory.")
    with FileLock(config.state_dir / "deploy.lock"):
        blocked_path = config.state_dir / BLOCK_FILE
        if os.path.lexists(blocked_path):
            fail("deployment_blocked", "A previous attempt needs manual recovery; automatic retries are blocked.")
        if os.path.lexists(config.wp_root / ".maintenance"):
            fail("maintenance_present", "An existing maintenance file requires administrator review.")
        current = _read_wp(config, runner)
        if not current["php_cli_compatible"]:
            fail("php_cli_unsupported", "The CLI PHP minor differs from the reviewed CI test environment; deployment is disabled.")
        if current["version"] != manifest["expected_current_version"]:
            fail("unexpected_current_version", "The current version does not match the reviewed release baseline.")
        if archive.stat().st_size != manifest["bytes"] or _sha256(archive) != manifest["sha256"]:
            fail("archive_hash", "The private snapshot no longer matches the release manifest.")
        inspection = validate_zip(archive, manifest["version"])
        if shutil.disk_usage(config.state_dir).free < 512 * 1024 * 1024:
            fail("disk_space", "At least 512 MiB of free backup space is required before proceeding.")
        directory, backup = _create_backup(config, manifest, current, runner)
        recovery = {"backup_id": backup["backup_id"], "manifest": manifest, "phase": "maintenance_start", "manual_recovery_required": True}
        _write_json(blocked_path, recovery)
        phase = "maintenance_start"
        try:
            runner(config, ["maintenance-mode", "activate"])
            if not (config.wp_root / ".maintenance").is_file() or (config.wp_root / ".maintenance").is_symlink():
                fail("maintenance_failed", "Maintenance activation could not be confirmed.")
            phase = "plugin_install"
            recovery["phase"] = phase
            _write_json(blocked_path, recovery)
            if _sha256(archive) != manifest["sha256"]:
                fail("archive_hash", "The candidate changed after validation.")
            runner(config, ["plugin", "install", str(archive), "--force"])
            phase = "post_update_verification"
            verified_code = verify_installed(config, inspection)
            updated = _read_wp(config, runner)
            if updated["version"] != manifest["version"] or not updated["php_cli_compatible"]:
                fail("updated_version_mismatch", "The updated plugin header/version could not be confirmed.")
            runner(config, ["maintenance-mode", "deactivate"])
            if os.path.lexists(config.wp_root / ".maintenance"):
                fail("maintenance_remaining", "Maintenance mode did not finish cleanly.")
            phase = "https_smoke"
            health = smoke(config)
            if not isinstance(health, dict) or health.get("http_status") != 200 or health.get("namespace") != REST_NAMESPACE:
                fail("smoke_failed", "The HTTPS smoke check did not confirm the SETAE REST namespace.")
            verify_installed(config, inspection)
            result = {"status": "success", "operation": "deploy", "version": manifest["version"], "previous_version": current["version"],
                      "sha256": manifest["sha256"], "source_commit": manifest["source_commit"], "release_id": manifest["release_id"],
                      "backup_id": backup["backup_id"], "installed_code": verified_code, "smoke": health, "maintenance": False, "database_restored": False}
            _write_json(directory / "result.json", result)
            blocked_path.unlink()
            return result
        except BaseException as error:
            # A WP upgrader may have removed .maintenance itself. Request it again;
            # WordPress can expire it after ~10 minutes, so the durable block is separate.
            maintenance_confirmed = False
            try:
                runner(config, ["maintenance-mode", "activate"])
                maintenance_confirmed = os.path.isfile(config.wp_root / ".maintenance")
            except BaseException:
                pass
            code = error.code if isinstance(error, DeployError) else "deployment_failed"
            recovery.update({"phase": phase, "code": code, "maintenance_requested": True, "maintenance_file_present": maintenance_confirmed,
                             "maintenance_auto_expires": True, "database_restored": False, "code_rolled_back": False})
            try:
                _write_json(blocked_path, recovery)
                _write_json(directory / "result.json", {"status": "error", **recovery})
            except BaseException:
                pass  # The pre-existing durable block must still prevent a new attempt.
            raise DeployError(code, "Update verification failed. Review the private backup and recover manually; no rollback was attempted.",
                              backup_id=backup["backup_id"], phase=phase, manual_recovery_required=True,
                              maintenance_file_present=maintenance_confirmed, maintenance_auto_expires=True) from None


def check_invocation(arguments: list[str], environment):
    if arguments:
        fail("arguments_forbidden", "The fixed helper takes no arguments.")
    original = environment.get("SSH_ORIGINAL_COMMAND", "")
    if original and original != REMOTE_COMMAND:
        fail("remote_command_forbidden", "The requested remote command is not supported.")


@contextlib.contextmanager
def input_deadline(seconds=INPUT_TIMEOUT):
    if not hasattr(signal, "SIGALRM"):
        fail("unsupported_platform", "The server requires a bounded POSIX stdin read.")
    previous = signal.signal(signal.SIGALRM, lambda *unused: fail("input_timeout", "The input stream timed out."))
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, previous)


def main() -> int:
    archive = None
    try:
        os.umask(0o077)
        check_invocation(sys.argv[1:], os.environ)
        config = load_config()
        validate_host(config)
        with input_deadline():
            manifest = parse_manifest(sys.stdin.buffer.readline(MAX_MANIFEST_BYTES + 1))
            if manifest["operation"] == "preflight":
                if sys.stdin.buffer.read(1):
                    fail("archive_trailing_data", "Preflight takes no archive payload.")
            else:
                if not config.enabled or not config.auth_ready:
                    fail("deployment_disabled", "Deployment is disabled until the administrator finishes authorization.")
                archive = config.state_dir / (".incoming-" + uuid.uuid4().hex + ".zip")
                receive_archive(sys.stdin.buffer, manifest, archive)
        result = preflight(config) if manifest["operation"] == "preflight" else deploy(config, manifest, archive)
        print(json.dumps(result, separators=(",", ":"), ensure_ascii=True))
        return 0
    except DeployError as error:
        print(json.dumps({"status": "error", "code": error.code, "message": error.message, **error.details}, separators=(",", ":"), ensure_ascii=True))
        return 1
    except BaseException:
        print('{"status":"error","code":"helper_failed","message":"The helper failed; diagnostic output is withheld."}')
        return 1
    finally:
        if archive is not None:
            try:
                archive.unlink(missing_ok=True)
            except OSError:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
