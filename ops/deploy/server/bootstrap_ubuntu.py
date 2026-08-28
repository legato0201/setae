#!/usr/bin/python3
"""One-time, fail-closed provisioning for the fixed SETAE deploy helper.

This program does not install a plugin, export a database, or change sshd.
Run only the separately verified, pinned copy with /usr/bin/python3 -I.
The Host boundary and Paths root are injectable for offline tests, not CLI options.
"""
from __future__ import annotations

import argparse
import base64
import binascii
import contextlib
import glob
import hashlib
import json
import os
import re
import shlex
import signal
import stat
import struct
import subprocess
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qsl, unquote, urlsplit

try:
    import fcntl
    import grp
    import pwd
    import spwd
except ImportError:  # Importing the pure functions on Windows is supported.
    fcntl = grp = pwd = spwd = None


EXPECTED_SHA256 = {
    "setae-deploy": "1ba2415aae0d121dd37926475a0c012e985de28db3c3f416d6a371fa962077fa",
    "setae_deploy.py": "c0e4dbef71f7054c907f595533f971dbc0d0e71917f617f509efceedc5969d58",
}
DEPLOY_USER = "setae-deploy"
SERVICE_USER = "www-data"
SSH_HOME = "/var/lib/setae-deploy-ssh"
ACCOUNT_COMMENT = "SETAE fixed deployment account (bootstrap v1)"
NO_PASSWORD = "*NP*"
PYTHON = "/usr/bin/python3"
PHP = "/usr/bin/php"
WP_CLI = "/usr/local/bin/wp"
WP_ROOT = "/var/www/html/setae"
WRAPPER = "/usr/local/sbin/setae-deploy"
MODULE = "/usr/local/lib/setae-deploy/setae_deploy.py"
CONFIG = "/etc/setae-deploy/config.json"
RECEIPT = "/etc/setae-deploy/bootstrap.json"
STATE = "/var/lib/setae-deploy"
SUDOERS = "/etc/sudoers.d/setae-deploy"
FORCED_COMMAND = "/usr/bin/sudo -n -u www-data -- /usr/local/sbin/setae-deploy"
PREFLIGHT_INPUT = b'{"protocol_version":1,"operation":"preflight"}\n'
COMMAND_TIMEOUT = 180
MAX_OUTPUT = 1024 * 1024
CLEAN_ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "HOME": "/nonexistent",
             "LANG": "C", "LC_ALL": "C"}

# This constant is never interpolated with CLI input. All WP commands are reads.
REST_PROBE_CODE = """import dataclasses,json,runpy,sys
try:
    helper=runpy.run_path('/usr/local/lib/setae-deploy/setae_deploy.py')
    config=helper['load_config']()
    helper['validate_host'](config)
    url=helper['run_wp'](config,['eval','echo get_rest_url();']).strip()
    helper['_validate_smoke_url'](url)
    health=helper['smoke_check'](dataclasses.replace(config,smoke_url=url))
    print(json.dumps({'status':'success','smoke_url':url,'smoke':health},separators=(',',':')))
except BaseException:
    print('{"status":"error","code":"rest_probe_failed"}')
    sys.exit(1)
"""


class BootstrapError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def fail(code: str, message: str):
    raise BootstrapError(code, message)


def json_bytes(value: dict) -> bytes:
    return (json.dumps(value, sort_keys=True, indent=2, ensure_ascii=True) + "\n").encode("utf-8")


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def parse_public_key(value: str) -> tuple[str, str]:
    if not isinstance(value, str) or len(value) > 2048 or any(ord(c) < 32 and c != "\t" or ord(c) == 127 for c in value):
        fail("public_key_invalid", "Supply exactly one printable Ed25519 public key, without options or newlines.")
    match = re.fullmatch(r"ssh-ed25519[ \t]+([A-Za-z0-9+/]+={0,2})(?:[ \t]+[ -~]*)?", value.strip())
    if not match:
        fail("public_key_invalid", "Supply one OpenSSH Ed25519 public key; key options and private keys are not accepted.")
    encoded = match.group(1)
    try:
        blob = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        fail("public_key_invalid", "The public key encoding is invalid.")
    if (len(blob) != 51 or blob[:15] != struct.pack(">I", 11) + b"ssh-ed25519"
            or blob[15:19] != struct.pack(">I", 32) or not any(blob[19:])
            or base64.b64encode(blob).decode("ascii") != encoded):
        fail("public_key_invalid", "The public key wire format is not a canonical Ed25519 key.")
    fingerprint = "SHA256:" + base64.b64encode(hashlib.sha256(blob).digest()).decode("ascii").rstrip("=")
    return "ssh-ed25519 " + encoded, fingerprint


def authorized_key_line(key: str) -> bytes:
    normalized, unused_fingerprint = parse_public_key(key)
    return ('restrict,command="' + FORCED_COMMAND + '" ' + normalized + "\n").encode("ascii")


def sudoers_text() -> bytes:
    return (DEPLOY_USER + ' ALL=(www-data) NOPASSWD:NOSETENV: ' + WRAPPER + ' ""\n').encode("ascii")


def verified_payloads(source_dir: Path) -> dict[str, bytes]:
    source_dir = Path(source_dir)
    if source_dir.is_symlink() or not source_dir.is_dir():
        fail("source_directory", "The pinned source directory must be a real directory.")
    result = {}
    for name, expected in EXPECTED_SHA256.items():
        path = source_dir / name
        try:
            fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
            with os.fdopen(fd, "rb") as source:
                info = os.fstat(source.fileno())
                if not stat.S_ISREG(info.st_mode) or info.st_size > 256 * 1024 or path.is_symlink():
                    fail("source_file", "A pinned payload must be a bounded regular file, not a link.")
                data = source.read(256 * 1024 + 1)
        except OSError:
            fail("source_file", "A required pinned payload could not be read.")
        if digest(data) != expected:
            fail("source_hash", "A pinned payload SHA256 differs; no normalization or replacement is allowed.")
        result[name] = data
    return result


@dataclass(frozen=True)
class Paths:
    root: Path = Path("/")

    def at(self, fixed: str) -> Path:
        if not fixed.startswith("/") or ".." in Path(fixed).parts:
            fail("internal_path", "A bootstrap path is not a fixed absolute path.")
        return Path(self.root) / fixed.lstrip("/")


class Host:
    """Only this boundary invokes operating-system commands or account APIs."""
    def run(self, argv: list[str], *, input: bytes = b"", timeout: int = COMMAND_TIMEOUT):
        try:
            with subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                  cwd="/", env=CLEAN_ENV, start_new_session=True) as process:
                try:
                    output, error = process.communicate(input=input, timeout=timeout)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.communicate()
                    fail("command_timeout", "A fixed command timed out; its process group was stopped and output is withheld.")
                completed = subprocess.CompletedProcess(argv, process.returncode, output, error)
        except (OSError, subprocess.SubprocessError):
            fail("command_failed", "A fixed system command failed or timed out; command output is withheld.")
        if len(completed.stdout) > MAX_OUTPUT or len(completed.stderr) > MAX_OUTPUT:
            fail("command_output", "A fixed system command exceeded its output limit; output is withheld.")
        return completed

    def user(self, name: str):
        try:
            return pwd.getpwnam(name)
        except KeyError:
            return None

    def group(self, name: str):
        try:
            return grp.getgrnam(name)
        except KeyError:
            return None

    def user_groups(self, name: str) -> list[str]:
        return [entry.gr_name for entry in grp.getgrall() if name in entry.gr_mem]

    def shadow(self, name: str):
        try:
            return spwd.getspnam(name)
        except KeyError:
            return None

    def info(self, path: Path):
        return path.lstat()

    def ownership(self, path: Path, uid: int, gid: int, mode: int):
        os.chown(path, uid, gid, follow_symlinks=False)
        os.chmod(path, mode, follow_symlinks=False)

    def sync_directory(self, path: Path):
        fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)

    def check_platform(self):
        if sys.platform != "linux" or any(api is None for api in (fcntl, pwd, grp, spwd)):
            fail("unsupported_platform", "Run this bootstrap on Ubuntu 24.04 with the system Python, not Windows or pyenv.")
        if os.getuid() != 0 or os.geteuid() != 0:
            fail("root_required", "Run the verified bootstrap once through sudo as root.")
        if (sys.version_info < (3, 10) or not sys.flags.isolated
                or Path(sys.executable).resolve() != Path(PYTHON).resolve()):
            fail("python_runtime", "Use exactly /usr/bin/python3 -I with Python 3.10 or newer; pyenv is not supported.")

    @contextlib.contextmanager
    def lock(self, path: Path, paths: Paths):
        guard_parents(path, self, paths)
        try:
            fd = os.open(path, os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
            try:
                guard_file(path, self, paths, 0o600)
                if os.fstat(fd).st_size:
                    fail("bootstrap_lock", "The existing bootstrap lock is not the expected empty file.")
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                yield
            finally:
                os.close(fd)
        except BlockingIOError:
            fail("bootstrap_busy", "Another bootstrap is running; wait for it to finish.")
        except OSError:
            fail("bootstrap_lock", "The root-managed bootstrap lock could not be verified.")


def checked_run(host: Host, argv: list[str], *, input: bytes = b"", code: str = "command_failed") -> bytes:
    result = host.run(argv, input=input)
    if result.returncode:
        fail(code, "A required fixed command failed; stdout and stderr are withheld.")
    return result.stdout


def load_json(data: bytes, code: str) -> dict:
    def unique(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                fail(code, "A verification result contains duplicate fields; output is withheld.")
            value[key] = item
        return value
    try:
        value = json.loads(data.decode("utf-8"), object_pairs_hook=unique)
    except (ValueError, UnicodeError):
        fail(code, "A verification result is not valid JSON; output is withheld.")
    if not isinstance(value, dict):
        fail(code, "A verification result has an unexpected shape; output is withheld.")
    return value


def parse_preflight(data: bytes, expected_enabled: bool = False) -> dict:
    result = load_json(data, "preflight_failed")
    if result.get("status") != "success" or result.get("operation") != "preflight":
        fail("preflight_failed", "The www-data preflight did not succeed; output is withheld.")
    flags = ("enabled", "auth_ready", "deployment_ready", "php_cli_compatible",
             "manual_recovery_required", "maintenance_file_present")
    if any(type(result.get(key)) is not bool for key in flags):
        fail("preflight_shape", "The preflight did not return the required boolean checks.")
    if not result["php_cli_compatible"] or result.get("tested_php_cli_minor") != "8.3":
        fail("php_cli_incompatible", "The existing helper requires compatible CLI PHP 8.3; no update was enabled.")
    if result["manual_recovery_required"] or result["maintenance_file_present"]:
        fail("wordpress_not_ready", "WordPress has maintenance or unresolved deployment state; recover it manually first.")
    if any(result[key] is not expected_enabled for key in ("enabled", "auth_ready", "deployment_ready")):
        fail("preflight_flags", "The preflight readiness flags differ from the expected bootstrap phase.")
    for key in ("version", "wordpress_version", "php_version", "wp_cli_version"):
        if not isinstance(result.get(key), str) or not re.fullmatch(r"[0-9]+(?:\.[0-9]+){1,3}(?:[-+._A-Za-z0-9]{0,48})", result[key]):
            fail("preflight_version", "The preflight version result is invalid; output is withheld.")
    if not result["php_version"].startswith("8.3."):
        fail("php_cli_incompatible", "The fixed /usr/bin/php must resolve to CLI PHP 8.3.")
    return {key: result[key] for key in ("version", "wordpress_version", "php_version", "wp_cli_version", *flags)}


def validate_sshd_settings(settings: dict[str, list[str]]) -> None:
    def one(key: str) -> str:
        value = settings.get(key, [])
        return value[0] if len(value) == 1 else ""
    expected = {"pubkeyauthentication": "yes", "strictmodes": "yes", "forcecommand": "none",
                "chrootdirectory": "none", "authorizedkeyscommand": "none",
                "authorizedprincipalscommand": "none", "trustedusercakeys": "none",
                "permituserenvironment": "no", "hostbasedauthentication": "no",
                "gssapiauthentication": "no", "kerberosauthentication": "no",
                "kbdinteractiveauthentication": "no", "permittunnel": "no",
                "revokedkeys": "none"}
    for key, value in expected.items():
        if one(key) != value:
            fail("sshd_policy", "Existing SSH authentication or command policy is incompatible; review sshd manually without replacing it.")
    if one("authenticationmethods") not in ("any", "publickey"):
        fail("sshd_authentication", "Existing SSH multi-factor requirements need manual review; they will not be weakened.")
    if any(settings.get(key) for key in ("allowusers", "denyusers", "allowgroups", "denygroups")):
        fail("sshd_access_rules", "Existing SSH user/group access restrictions require manual approval for the new account.")
    environment = [word for line in settings.get("acceptenv", []) for word in line.split()]
    if settings.get("setenv") or any(word not in ("LANG", "TERM", "LC_*") and not re.fullmatch(r"LC_[A-Z_]+", word) for word in environment):
        fail("sshd_environment", "Existing SSH environment overrides require manual review; shell or loader variables must not bypass the forced command.")
    keyfiles = one("authorizedkeysfile").split()
    if keyfiles not in ([".ssh/authorized_keys"], [".ssh/authorized_keys", ".ssh/authorized_keys2"]):
        fail("sshd_key_files", "Existing AuthorizedKeysFile locations are not the supported root-managed home files.")
    algorithms = one("pubkeyacceptedalgorithms").split(",")
    if "ssh-ed25519" not in algorithms:
        fail("sshd_key_algorithm", "The existing SSH policy does not accept the dedicated Ed25519 key.")


def ancestors(path: Path, paths: Paths):
    boundary = Path(paths.root).absolute()
    path = path.absolute()
    if path != boundary and boundary not in path.parents:
        fail("path_boundary", "A managed path escaped the fixed filesystem boundary.")
    for candidate in (path, *path.parents):
        yield candidate
        if candidate == boundary:
            break


def guard_parents(path: Path, host: Host, paths: Paths):
    for parent in ancestors(path.parent, paths):
        try:
            info = host.info(parent)
        except OSError:
            fail("unsafe_parent", "A required root-managed parent directory is unavailable.")
        if not stat.S_ISDIR(info.st_mode) or parent.is_symlink() or info.st_uid != 0 or info.st_mode & 0o022:
            fail("unsafe_parent", "Managed parents must be real root-owned directories, without group or other write access.")


def guard_file(path: Path, host: Host, paths: Paths, mode: int | None = None):
    guard_parents(path, host, paths)
    try:
        info = host.info(path)
    except OSError:
        fail("managed_file", "A required managed file is unavailable.")
    if (not stat.S_ISREG(info.st_mode) or path.is_symlink() or info.st_uid != 0 or info.st_gid != 0
            or info.st_nlink != 1 or info.st_mode & 0o022 or mode is not None and stat.S_IMODE(info.st_mode) != mode):
        fail("managed_file", "An existing managed file has unsafe ownership, links, or permissions; it will not be overwritten.")


def guard_dependency(path: Path, host: Host, paths: Paths, *, executable: bool = True):
    """Allow only root-managed OS symlinks, checking both spelling and target."""
    try:
        pending = [path, path.resolve(strict=True)]
        seen = set()
        while pending:
            current = pending.pop()
            for candidate in ancestors(current, paths):
                if candidate in seen:
                    continue
                seen.add(candidate)
                if len(seen) > 128:
                    fail("dependency_link", "An OS dependency has an unsupported link chain.")
                info = host.info(candidate)
                if info.st_uid != 0 or not stat.S_ISLNK(info.st_mode) and info.st_mode & 0o022:
                    fail("unsafe_dependency", "An OS dependency or its parents are not immutable to service users.")
                if stat.S_ISLNK(info.st_mode):
                    target = Path(os.readlink(candidate))
                    pending.append(target if target.is_absolute() else candidate.parent / target)
        info = host.info(path.resolve(strict=True))
        if not stat.S_ISREG(info.st_mode) or executable and not info.st_mode & 0o111:
            fail("unsafe_dependency", "A required OS dependency is not a regular executable.")
    except OSError:
        fail("missing_dependency", "A required fixed OS dependency is missing; no packages are installed automatically.")


def ensure_directory(path: Path, host: Host, paths: Paths, *, uid: int = 0, gid: int = 0, mode: int = 0o755):
    guard_parents(path, host, paths)
    if not os.path.lexists(path):
        path.mkdir(mode=mode)
        host.ownership(path, uid, gid, mode)
    info = host.info(path)
    if (not stat.S_ISDIR(info.st_mode) or path.is_symlink() or info.st_uid != uid or info.st_gid != gid
            or stat.S_IMODE(info.st_mode) != mode):
        fail("managed_directory", "An existing managed directory differs in ownership, mode, or type; it will not be changed.")


def ensure_file(path: Path, content: bytes, host: Host, paths: Paths, mode: int) -> bool:
    guard_parents(path, host, paths)
    if os.path.lexists(path):
        guard_file(path, host, paths, mode)
        if path.read_bytes() != content:
            fail("existing_file_conflict", "An existing managed file differs from the pinned content; it will not be overwritten.")
        return False
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), mode)
    with os.fdopen(fd, "wb") as target:
        target.write(content)
        target.flush()
        os.fsync(target.fileno())
    host.ownership(path, 0, 0, mode)
    host.sync_directory(path.parent)
    guard_file(path, host, paths, mode)
    if path.read_bytes() != content:
        fail("copy_verification", "An installed managed file failed exact byte verification; setup stopped.")
    return True


def replace_owned_file(path: Path, before: bytes, after: bytes, host: Host, paths: Paths, mode: int):
    guard_file(path, host, paths, mode)
    if path.read_bytes() != before:
        fail("managed_file_changed", "A managed file changed during setup; no unknown content will be overwritten.")
    if before == after:
        return
    temporary = path.parent / ("." + path.name + "." + uuid.uuid4().hex)
    try:
        ensure_file(temporary, after, host, paths, mode)
        if path.read_bytes() != before:
            fail("managed_file_changed", "A managed file changed during setup; replacement was stopped.")
        os.replace(temporary, path)
        host.sync_directory(path.parent)
    finally:
        if temporary.exists() and not temporary.is_symlink() and temporary.read_bytes() == after:
            temporary.unlink()


def read_sshd_files(paths: Paths, host: Host) -> None:
    seen = set()
    base = paths.at("/etc/ssh")
    def visit(path: Path, depth: int):
        if depth > 8 or len(seen) >= 64 or path in seen:
            fail("sshd_include", "The SSH include graph needs manual review.")
        if path != base and base not in path.parents:
            fail("sshd_include", "SSH includes outside /etc/ssh require manual review; no SSH files are changed.")
        seen.add(path)
        guard_dependency(path, host, paths, executable=False)
        if path.stat().st_size > MAX_OUTPUT:
            fail("sshd_include", "An SSH configuration file is too large to verify safely.")
        for raw in path.read_text(encoding="utf-8").splitlines():
            raw = re.sub(r"^([ \t]*[A-Za-z]+)[ \t]*=[ \t]*", r"\1 ", raw)
            try:
                words = shlex.split(raw, comments=True)
            except ValueError:
                fail("sshd_config", "An existing SSH configuration line needs manual review.")
            if not words:
                continue
            directive = words[0].lower()
            if directive == "match" and [word.lower() for word in words[1:]] != ["all"]:
                fail("sshd_match", "Existing conditional SSH Match rules cannot be proved safe for a remote client here; review them manually.")
            if directive == "include":
                for pattern in words[1:]:
                    if any(char in pattern for char in ("~", "$", "%", "\\")) or ".." in Path(pattern).parts:
                        fail("sshd_include", "An SSH include uses unsupported expansion; manual review is required.")
                    expanded = paths.at(pattern) if pattern.startswith("/") else base / pattern
                    for child in sorted(glob.glob(str(expanded))):
                        visit(Path(child), depth + 1)
    visit(paths.at("/etc/ssh/sshd_config"), 0)
    for fixed in ("/etc/nologin", "/run/nologin", "/etc/ssh/sshrc"):
        if os.path.lexists(paths.at(fixed)):
            fail("ssh_login_policy", "An existing login block or system SSH rc file needs manual review; it will not be bypassed.")


def sshd_settings(paths: Paths, host: Host, *, account_exists: bool = False) -> dict[str, list[str]]:
    argv = ["/usr/sbin/sshd", "-T"]
    if account_exists:
        argv += ["-C", "user=setae-deploy,host=localhost,addr=127.0.0.1,laddr=127.0.0.1,lport=22"]
    raw = checked_run(host, argv, code="sshd_check")
    try:
        lines = raw.decode("utf-8").splitlines()
    except UnicodeError:
        fail("sshd_check", "The effective SSH configuration is unreadable; output is withheld.")
    settings = {}
    for line in lines:
        key, separator, value = line.partition(" ")
        if not separator or not re.fullmatch(r"[a-z0-9]+", key):
            fail("sshd_check", "The effective SSH configuration has an unsupported format.")
        settings.setdefault(key, []).append(value.strip())
    validate_sshd_settings(settings)
    return settings


def validate_environment(paths: Paths, host: Host):
    host.check_platform()
    release = paths.at("/etc/os-release")
    guard_dependency(release, host, paths, executable=False)
    values = {}
    for line in release.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator:
            values[key] = value.strip().strip('"')
    if values.get("ID") != "ubuntu" or values.get("VERSION_ID") != "24.04":
        fail("ubuntu_version", "This bootstrap supports Ubuntu 24.04 only; do not use it on another release.")
    for fixed in (PYTHON, PHP, WP_CLI, "/usr/bin/sudo", "/usr/sbin/visudo", "/usr/sbin/sshd",
                  "/usr/sbin/useradd", "/usr/sbin/runuser", "/bin/sh"):
        guard_dependency(paths.at(fixed), host, paths)
    checked_run(host, ["/usr/sbin/visudo", "-c"], code="existing_sudoers_invalid")
    read_sshd_files(paths, host)
    return sshd_settings(paths, host)


def config_value(smoke_url: str = "", enabled: bool = False) -> dict:
    return {"schema_version": 1, "enabled": enabled, "auth_ready": enabled, "run_user": SERVICE_USER,
            "wp_root": WP_ROOT, "php_path": PHP, "wp_cli_path": WP_CLI, "state_dir": STATE, "smoke_url": smoke_url}


def validate_rest_probe(data: bytes) -> tuple[str, dict]:
    result = load_json(data, "rest_probe_failed")
    if set(result) != {"status", "smoke_url", "smoke"} or result["status"] != "success":
        fail("rest_probe_failed", "The fixed www-data REST URL lookup or HTTPS namespace check failed; output is withheld.")
    url = result["smoke_url"]
    if not isinstance(url, str) or len(url) > 2048 or any(ord(c) < 32 or ord(c) == 127 for c in url):
        fail("rest_url", "WordPress did not return a supported HTTPS REST index URL.")
    try:
        parsed = urlsplit(url)
        path = unquote(parsed.path, errors="strict")
        valid_index = (not parsed.query and path.endswith("/wp-json/")) or (
            (path.endswith("/") or path.endswith("/index.php")) and parse_qsl(parsed.query, keep_blank_values=True) == [("rest_route", "/")])
        if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.fragment
                or parsed.port not in (None, 443) or "\\" in path or any(part in (".", "..") for part in path.split("/"))
                or any(ord(c) < 32 or ord(c) == 127 for c in path) or not valid_index):
            fail("rest_url", "WordPress must expose a fixed HTTPS REST index without credentials, aliases, or redirects.")
    except ValueError:
        fail("rest_url", "WordPress did not return a supported HTTPS REST index URL.")
    if result["smoke"] != {"http_status": 200, "namespace": "setae/v1"}:
        fail("rest_smoke", "The HTTPS check must confirm HTTP 200 JSON with the setae/v1 namespace.")
    return url, result["smoke"]


def receipt_value(fingerprint: str) -> dict:
    return {"schema_version": 1, "key_fingerprint": fingerprint, "payload_sha256": dict(EXPECTED_SHA256),
            "user_uid": None, "user_gid": None, "config_sha256": digest(json_bytes(config_value())), "phase": "prepared"}


def read_receipt(paths: Paths, host: Host, fingerprint: str) -> dict | None:
    path = paths.at(RECEIPT)
    if not os.path.lexists(path):
        return None
    guard_file(path, host, paths, 0o600)
    if path.stat().st_size > 8192:
        fail("existing_receipt", "An existing bootstrap receipt is not recognized.")
    value = load_json(path.read_bytes(), "existing_receipt")
    expected = receipt_value(fingerprint)
    if (set(value) != set(expected) or value["schema_version"] != 1
            or value["key_fingerprint"] != fingerprint or value["payload_sha256"] != EXPECTED_SHA256
            or value["phase"] not in ("prepared", "account_created", "verified", "enabled")
            or not isinstance(value["config_sha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", value["config_sha256"])):
        fail("existing_receipt", "An existing bootstrap belongs to different content or a different key; it will not be replaced.")
    if any(value[key] is not None and (type(value[key]) is not int or value[key] <= 0) for key in ("user_uid", "user_gid")):
        fail("existing_receipt", "The existing account receipt requires manual review.")
    return value


def validate_account(host: Host, receipt: dict) -> object:
    user = host.user(DEPLOY_USER)
    group = host.group(DEPLOY_USER)
    shadow = host.shadow(DEPLOY_USER) if user is not None else None
    if (user is None or group is None or shadow is None or receipt["user_uid"] is None
            or user.pw_uid != receipt["user_uid"] or user.pw_gid != receipt["user_gid"]
            or group.gr_gid != receipt["user_gid"] or user.pw_uid == 0 or user.pw_gid == 0
            or user.pw_dir != SSH_HOME or user.pw_shell != "/bin/sh" or user.pw_gecos != ACCOUNT_COMMENT
            or shadow.sp_pwdp != NO_PASSWORD or shadow.sp_expire != -1
            or any(name != DEPLOY_USER for name in group.gr_mem)
            or any(name != DEPLOY_USER for name in host.user_groups(DEPLOY_USER))):
        fail("existing_account", "The deployment account does not match this bootstrap receipt; no existing account is changed.")
    return user


def inspect_existing(paths: Paths, host: Host, payloads: dict[str, bytes], key: str,
                     receipt: dict | None) -> dict:
    fixed = ((WRAPPER, payloads["setae-deploy"], 0o755), (MODULE, payloads["setae_deploy.py"], 0o644),
             (SSH_HOME + "/.ssh/authorized_keys", authorized_key_line(key), 0o644), (SUDOERS, sudoers_text(), 0o440))
    for target, data, mode in fixed:
        path = paths.at(target)
        if os.path.lexists(path):
            guard_file(path, host, paths, mode)
            if path.read_bytes() != data:
                fail("existing_file_conflict", "An existing managed file differs; no unknown file or key will be overwritten.")
    allowed = {"/etc/setae-deploy": {"config.json", "bootstrap.json"},
               "/usr/local/lib/setae-deploy": {"setae_deploy.py"},
               SSH_HOME: {".ssh"}, SSH_HOME + "/.ssh": {"authorized_keys"}}
    for target, names in allowed.items():
        path = paths.at(target)
        if os.path.lexists(path):
            guard_parents(path, host, paths)
            info = host.info(path)
            if not stat.S_ISDIR(info.st_mode) or path.is_symlink() or info.st_uid != 0 or info.st_gid != 0 or stat.S_IMODE(info.st_mode) != 0o755:
                fail("existing_directory", "An existing managed directory has unknown ownership or permissions.")
            if any(child.name not in names for child in path.iterdir()):
                fail("existing_directory", "An existing managed directory contains unknown files; nothing will be removed.")
    config = config_value()
    path = paths.at(CONFIG)
    if os.path.lexists(path):
        guard_file(path, host, paths, 0o644)
        raw = path.read_bytes()
        if receipt is None:
            if raw != json_bytes(config):
                fail("existing_config", "An existing configuration has no matching bootstrap receipt.")
        else:
            config = load_json(raw, "existing_config")
            if (digest(raw) != receipt["config_sha256"] or set(config) != set(config_value())
                    or type(config.get("enabled")) is not bool or not isinstance(config.get("smoke_url"), str)
                    or config != config_value(config["smoke_url"], config["enabled"])):
                fail("existing_config", "The existing configuration differs from the bootstrap receipt.")
    elif receipt is not None and receipt["phase"] != "prepared":
        fail("existing_config", "A previously installed configuration is missing; review the partial setup manually.")
    user = host.user(DEPLOY_USER)
    group = host.group(DEPLOY_USER)
    if user is not None or group is not None:
        if receipt is None or receipt["user_uid"] is None:
            fail("existing_account", "The account or group already exists without a completed ownership receipt; it will not be reused.")
        validate_account(host, receipt)
    elif receipt is not None and receipt["user_uid"] is not None:
        fail("existing_account", "A previously created account is missing; no account is recreated automatically.")
    state = paths.at(STATE)
    if receipt is None and os.path.lexists(state) and (state.is_symlink() or not state.is_dir() or any(state.iterdir())):
        fail("existing_state", "The existing service state is unknown; it will not be inspected, deleted, or adopted.")
    return config


def verify_sudo_policy(paths: Paths, host: Host):
    raw = checked_run(host, ["/usr/bin/sudo", "-n", "-ll", "-U", DEPLOY_USER], code="sudo_policy")
    try:
        text = raw.decode("utf-8")
    except UnicodeError:
        fail("sudo_policy", "The local sudo policy format is not supported; output is withheld.")
    sections = text.split("Sudoers entry:")
    if len(sections) != 2:
        fail("sudo_policy", "The new account must have exactly one sudo rule; inherited or unknown privileges require manual review.")
    fields = {}; commands = []; reading_commands = False
    for line in sections[1].splitlines():
        value = line.strip()
        if not value:
            continue
        if value == "Commands:":
            reading_commands = True
        elif reading_commands:
            commands.append(value)
        elif ":" in value:
            key, content = value.split(":", 1)
            if key in fields:
                fail("sudo_policy", "The sudo policy contains duplicate or unsupported fields.")
            fields[key] = content.strip()
        else:
            fail("sudo_policy", "The local sudo policy needs manual review; output is withheld.")
    if (set(fields) != {"RunAsUsers", "Options"} or fields.get("RunAsUsers") != SERVICE_USER
            or {value.strip() for value in fields.get("Options", "").split(",")} != {"!authenticate", "!setenv"}
            or commands != [WRAPPER + ' ""']):
        fail("sudo_policy", "The account must be limited to the exact no-argument helper as www-data with NOPASSWD and NOSETENV.")
    base = ["/usr/bin/sudo", "-n", "-l", "-U", DEPLOY_USER]
    checked_run(host, base + ["-u", SERVICE_USER, "--", WRAPPER], code="sudo_policy")
    negatives = (["-u", SERVICE_USER, "--", WRAPPER, "unexpected-argument"],
                 ["-u", "root", "--", WRAPPER], ["-u", SERVICE_USER, "--", "/bin/sh"],
                 ["-u", "root", "--", "/bin/sh"])
    for suffix in negatives:
        if host.run(base + suffix).returncode == 0:
            fail("sudo_policy", "An argument, shell, or root execution is unexpectedly allowed; updates remain disabled.")


def public_host_fingerprints(settings: dict[str, list[str]], paths: Paths, host: Host) -> list[dict]:
    result = []
    for private_path in settings.get("hostkey", []):
        if not private_path.startswith("/") or ".." in Path(private_path).parts:
            fail("host_public_key", "A configured host-key path requires manual review.")
        public_path = paths.at(private_path + ".pub")
        if not public_path.is_file():
            continue
        guard_dependency(public_path, host, paths, executable=False)
        if public_path.stat().st_size > 16384:
            fail("host_public_key", "A host public-key file exceeds the supported size.")
        raw = public_path.read_text(encoding="ascii").strip()
        if raw.startswith("ssh-ed25519 "):
            unused_key, fingerprint = parse_public_key(raw)
            result.append({"algorithm": "ssh-ed25519", "fingerprint": fingerprint})
    if not result:
        fail("host_public_key", "No configured Ed25519 host public key could be read for independent fingerprint verification.")
    return result


def bootstrap(source_dir: Path, public_key: str, enable_updates: bool, *, paths: Paths | None = None,
              host: Host | None = None) -> dict:
    paths = Paths() if paths is None else paths
    host = Host() if host is None else host
    key, fingerprint = parse_public_key(public_key)
    payloads = verified_payloads(source_dir)
    if type(enable_updates) is not bool:
        fail("enable_flag", "The explicit update authorization must be a boolean flag.")
    settings = validate_environment(paths, host)
    service = host.user(SERVICE_USER)
    if service is None or service.pw_uid == 0 or service.pw_gid == 0:
        fail("service_user", "The existing non-root www-data service account is required.")
    with host.lock(paths.at("/run/setae-deploy-bootstrap.lock"), paths):
        receipt = read_receipt(paths, host, fingerprint)
        config = inspect_existing(paths, host, payloads, key, receipt)
        known_receipts = set()
        if receipt is not None:
            known_receipts.add(paths.at(RECEIPT).read_bytes())
        for fixed in ("/usr/local/lib/setae-deploy", "/etc/setae-deploy", SSH_HOME, SSH_HOME + "/.ssh"):
            ensure_directory(paths.at(fixed), host, paths)
        ensure_directory(paths.at(STATE), host, paths, uid=service.pw_uid, gid=service.pw_gid, mode=0o700)
        if receipt is None:
            receipt = receipt_value(fingerprint)
            ensure_file(paths.at(RECEIPT), json_bytes(receipt), host, paths, 0o600)
            known_receipts.add(json_bytes(receipt))
        ensure_file(paths.at(WRAPPER), payloads["setae-deploy"], host, paths, 0o755)
        ensure_file(paths.at(MODULE), payloads["setae_deploy.py"], host, paths, 0o644)
        if not os.path.lexists(paths.at(CONFIG)):
            ensure_file(paths.at(CONFIG), json_bytes(config), host, paths, 0o644)

        def write_receipt():
            raw = paths.at(RECEIPT).read_bytes()
            if raw not in known_receipts:
                fail("receipt_changed", "The bootstrap receipt changed unexpectedly; no unknown receipt is overwritten.")
            after = json_bytes(receipt)
            known_receipts.add(after)
            replace_owned_file(paths.at(RECEIPT), raw, after, host, paths, 0o600)

        def write_config(value: dict, phase: str):
            nonlocal config
            before, after = json_bytes(config), json_bytes(value)
            replace_owned_file(paths.at(CONFIG), before, after, host, paths, 0o644)
            config = value
            receipt["config_sha256"] = digest(after)
            receipt["phase"] = phase
            write_receipt()

        # Rechecks of our own completed setup fail closed while proof is renewed.
        write_config(config_value(config["smoke_url"]), "account_created" if receipt["user_uid"] else "prepared")
        enable_attempted = False
        try:
            if host.user(DEPLOY_USER) is None:
                checked_run(host, ["/usr/sbin/useradd", "--system", "--user-group", "--no-create-home", "--no-log-init",
                                   "--home-dir", SSH_HOME, "--shell", "/bin/sh", "--comment", ACCOUNT_COMMENT,
                                   "--password", NO_PASSWORD, "--expiredate", "", DEPLOY_USER], code="account_create")
                account = host.user(DEPLOY_USER)
                if account is None or account.pw_uid in (0, service.pw_uid) or account.pw_gid in (0, service.pw_gid):
                    fail("account_create", "The new account was not created as a separate unprivileged identity.")
                receipt["user_uid"], receipt["user_gid"] = account.pw_uid, account.pw_gid
                receipt["phase"] = "account_created"
                write_receipt()
            validate_account(host, receipt)
            settings = sshd_settings(paths, host, account_exists=True)
            host_keys = public_host_fingerprints(settings, paths, host)
            ensure_file(paths.at(SSH_HOME + "/.ssh/authorized_keys"), authorized_key_line(key), host, paths, 0o644)
            candidate = paths.at("/etc/setae-deploy/sudoers.candidate")
            if os.path.lexists(candidate):
                fail("sudoers_candidate", "An unfinished sudo candidate exists; review it manually before retrying.")
            try:
                ensure_file(candidate, sudoers_text(), host, paths, 0o600)
                checked_run(host, ["/usr/sbin/visudo", "-c", "-f", str(candidate)], code="sudoers_syntax")
                ensure_file(paths.at(SUDOERS), sudoers_text(), host, paths, 0o440)
                checked_run(host, ["/usr/sbin/visudo", "-c"], code="sudoers_syntax")
            finally:
                if candidate.is_file() and not candidate.is_symlink() and candidate.read_bytes() == sudoers_text():
                    guard_file(candidate, host, paths, 0o600)
                    candidate.unlink()
            verify_sudo_policy(paths, host)
            direct = ["/usr/sbin/runuser", "--user", SERVICE_USER, "--", WRAPPER]
            preflight = parse_preflight(checked_run(host, direct, input=PREFLIGHT_INPUT, code="preflight_failed"))
            probe = ["/usr/sbin/runuser", "--user", SERVICE_USER, "--", PYTHON, "-I", "-c", REST_PROBE_CODE]
            rest_url, smoke = validate_rest_probe(checked_run(host, probe, code="rest_probe_failed"))
            write_config(config_value(rest_url), "account_created")
            forced = ["/usr/sbin/runuser", "--user", DEPLOY_USER, "--", "/bin/sh", "-c", FORCED_COMMAND]
            preflight = parse_preflight(checked_run(host, forced, input=PREFLIGHT_INPUT, code="forced_command_failed"))
            preserve_env = ["/usr/sbin/runuser", "--user", DEPLOY_USER, "--", "/usr/bin/sudo", "-n", "-E", "-u", SERVICE_USER, "--", WRAPPER]
            if host.run(preserve_env, input=PREFLIGHT_INPUT).returncode == 0:
                fail("sudo_environment", "The new account can preserve an arbitrary environment; updates remain disabled.")
            write_config(config_value(rest_url), "verified")
            # Verify disk bytes again immediately before allowing future releases.
            ensure_file(paths.at(WRAPPER), payloads["setae-deploy"], host, paths, 0o755)
            ensure_file(paths.at(MODULE), payloads["setae_deploy.py"], host, paths, 0o644)
            ensure_file(paths.at(SSH_HOME + "/.ssh/authorized_keys"), authorized_key_line(key), host, paths, 0o644)
            ensure_file(paths.at(SUDOERS), sudoers_text(), host, paths, 0o440)
            if enable_updates:
                enable_attempted = True
                write_config(config_value(rest_url, True), "enabled")
                preflight = parse_preflight(checked_run(host, forced, input=PREFLIGHT_INPUT, code="enabled_preflight_failed"), expected_enabled=True)
            return {"status": "success", "operation": "bootstrap", "updates_enabled": enable_updates,
                    "deployment_user": DEPLOY_USER, "deployment_key_fingerprint": fingerprint,
                    "host_public_keys": host_keys, "preflight": preflight, "https_rest": smoke,
                    "local_forced_command_verified": True, "remote_ssh_authentication_verified": False,
                    "plugin_update_performed": False, "plugin_backup_performed": False,
                    "database_backup_performed": False, "database_write_requested": False,
                    "sshd_configuration_modified": False, "existing_user_modified": False}
        except BaseException:
            if enable_attempted:
                try:
                    raw = paths.at(CONFIG).read_bytes()
                    enabled = json_bytes(config_value(rest_url, True))
                    disabled = json_bytes(config_value(rest_url))
                    if raw not in (enabled, disabled):
                        fail("disable_failed", "The configuration changed during enable; manual root review is required.")
                    replace_owned_file(paths.at(CONFIG), raw, disabled, host, paths, 0o644)
                    config = config_value(rest_url)
                    receipt["config_sha256"] = digest(disabled)
                    receipt["phase"] = "verified"
                    write_receipt()
                except BaseException:
                    fail("disable_failed", "Automatic disable could not be confirmed; stop remote releases and review the root-managed configuration.")
            raise


class SafeArgumentParser(argparse.ArgumentParser):
    def error(self, unused_message):
        fail("arguments", "Supply only --source-dir, one --public-key value, and the optional explicit --enable-updates flag.")


def main(argv: list[str] | None = None) -> int:
    try:
        parser = SafeArgumentParser(description="Provision the fixed SETAE helper; never update a plugin during bootstrap.", allow_abbrev=False)
        parser.add_argument("--source-dir", type=Path, required=True)
        parser.add_argument("--public-key", required=True)
        parser.add_argument("--enable-updates", action="store_true")
        arguments = parser.parse_args(argv)
        os.umask(0o077)
        result = bootstrap(arguments.source_dir, arguments.public_key, arguments.enable_updates)
        print(json.dumps(result, sort_keys=True, separators=(",", ":"), ensure_ascii=True))
        return 0
    except BootstrapError as error:
        print(json.dumps({"status": "error", "operation": "bootstrap", "code": error.code, "message": error.message,
                          "updates_enabled": None, "plugin_update_performed": False,
                          "plugin_backup_performed": False, "database_backup_performed": False,
                          "database_write_requested": False}, separators=(",", ":"), ensure_ascii=True))
        return 1
    except (Exception, KeyboardInterrupt):
        print('{"status":"error","operation":"bootstrap","code":"bootstrap_failed","message":"Setup stopped; private diagnostic output is withheld. Review managed setup before retrying.","updates_enabled":null,"plugin_update_performed":false,"database_backup_performed":false,"database_write_requested":false}')
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
