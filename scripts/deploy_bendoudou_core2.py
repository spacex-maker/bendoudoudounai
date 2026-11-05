#!/usr/bin/env python3
"""Deploy bendoudoudounai personal site to 192.168.0.176 (server-core2).

Requires: built JAR at target/bendoudou-server-0.0.1-SNAPSHOT.jar
          frontend dist at frontend/dist
Env: DEPLOY_SSH_PASSWORD (xp user on core2), optional DEPLOY_SSH_USER (default xp)
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import paramiko

# Prefer frp SSH: LAN :22 from some workstations hangs.
HOST = os.environ.get("DEPLOY_SSH_HOST", "175.27.255.29")
PORT = int(os.environ.get("DEPLOY_SSH_PORT", "18176"))
USER = os.environ.get("DEPLOY_SSH_USER", "xp")
PASSWORD = os.environ.get("DEPLOY_SSH_PASSWORD", "")
REMOTE_ROOT = "/opt/bendoudoudounai"
LOCAL_WEB_PORT = 8090
LOCAL_API_PORT = 8882

ROOT = Path(__file__).resolve().parents[1]
JAR = ROOT / "target" / "bendoudou-server-0.0.1-SNAPSHOT.jar"
WEB_DIST = ROOT / "frontend" / "dist"


def run(ssh: paramiko.SSHClient, cmd: str, check: bool = True) -> str:
    print(f">>> {cmd[:160]}")
    _, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    out = (stdout.read() + stderr.read()).decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    print(out[-3000:] if len(out) > 3000 else out)
    if check and code != 0:
        raise RuntimeError(f"cmd failed ({code}): {cmd}")
    return out


def sudo(ssh: paramiko.SSHClient, cmd: str) -> str:
    return run(ssh, f"echo {PASSWORD!r} | sudo -S -p '' bash -lc {cmd!r}")


def sftp_put_dir(sftp: paramiko.SFTPClient, local: Path, remote: str) -> None:
    try:
        sftp.stat(remote)
    except FileNotFoundError:
        sftp.mkdir(remote)
    for path in local.rglob("*"):
        rel = path.relative_to(local).as_posix()
        rpath = f"{remote}/{rel}"
        if path.is_dir():
            try:
                sftp.stat(rpath)
            except FileNotFoundError:
                sftp.mkdir(rpath)
        else:
            print(f"put {rel}")
            sftp.put(str(path), rpath)


def main() -> int:
    if not PASSWORD:
        print("Set DEPLOY_SSH_PASSWORD", file=sys.stderr)
        return 2
    if not JAR.is_file():
        print(f"missing jar: {JAR}", file=sys.stderr)
        return 2
    if not WEB_DIST.is_dir():
        print(f"missing dist: {WEB_DIST}", file=sys.stderr)
        return 2

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting {USER}@{HOST}:{PORT} ...")
    ssh.connect(
        HOST,
        port=PORT,
        username=USER,
        password=PASSWORD,
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )

    sudo(ssh, f"mkdir -p {REMOTE_ROOT}/bin {REMOTE_ROOT}/web && chown -R {USER}:{USER} {REMOTE_ROOT}")
    sftp = ssh.open_sftp()
    sftp.put(str(JAR), f"{REMOTE_ROOT}/bin/bendoudou-server.jar")
    sftp_put_dir(sftp, WEB_DIST, f"{REMOTE_ROOT}/web")
    sftp.close()

    sudo(ssh, "systemctl restart bendoudoudounai")
    time.sleep(5)
    run(ssh, f"curl -sf -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{LOCAL_WEB_PORT}/")
    run(ssh, f"curl -sf -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{LOCAL_API_PORT}/api/guestbook || true", check=False)
    ssh.close()
    print("OK — https://bendoudoudounai.com / https://api.bendoudoudounai.com")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
