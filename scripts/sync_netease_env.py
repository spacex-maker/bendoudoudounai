#!/usr/bin/env python3
"""Sync NetEase MUSIC_U/CSRF from chat transcript cookie dump -> local secrets + prod env."""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
SECRETS = ROOT / "secrets" / "bendoudou.env"
TRANSCRIPT = Path(
    r"C:\Users\1\.cursor\projects\f-dev-proj2-bendoudoudounai\agent-transcripts"
    r"\cbf74ba3-abfe-4bd1-bfc9-fead1ba4e05e\cbf74ba3-abfe-4bd1-bfc9-fead1ba4e05e.jsonl"
)
HOST = "139.155.130.167"
REMOTE_ENV = "/home/ubuntu/java/music/bendoudou.env"


def extract_from_transcript() -> tuple[str, str]:
    music_u = ""
    csrf = ""
    text = TRANSCRIPT.read_text(encoding="utf-8", errors="replace")
    for m in re.finditer(r"MUSIC_U=([^;\s\"\\]+)", text):
        cand = m.group(1).strip()
        if len(cand) > len(music_u):
            music_u = cand
    for m in re.finditer(r"__csrf=([^;\s\"\\]+)", text):
        cand = m.group(1).strip()
        if len(cand) > len(csrf):
            csrf = cand
    if not music_u:
        raise SystemExit("MUSIC_U not found in transcript")
    return music_u, csrf


def parse_env(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k] = v
    return out


def dump_env(env: dict[str, str]) -> str:
    # Stable-ish order: known keys first
    preferred = [
        "SPRING_DATASOURCE_URL",
        "SPRING_DATASOURCE_USERNAME",
        "SPRING_DATASOURCE_PASSWORD",
        "BENDOUDOU_JWT_SECRET",
        "TENCENTCLOUD_SECRET_ID",
        "TENCENTCLOUD_SECRET_KEY",
        "BENDOUDOU_NETEASE_MUSIC_U",
        "BENDOUDOU_NETEASE_CSRF",
        "BENDOUDOU_MUSIC_UPLOAD",
    ]
    lines = []
    seen = set()
    for k in preferred:
        if k in env:
            lines.append(f"{k}={env[k]}")
            seen.add(k)
    for k in sorted(env):
        if k not in seen:
            lines.append(f"{k}={env[k]}")
    return "\n".join(lines) + "\n"


def write_local(music_u: str, csrf: str) -> None:
    SECRETS.parent.mkdir(parents=True, exist_ok=True)
    env: dict[str, str] = {}
    if SECRETS.exists():
        env = parse_env(SECRETS.read_text(encoding="utf-8"))
    env["BENDOUDOU_NETEASE_MUSIC_U"] = music_u
    env["BENDOUDOU_NETEASE_CSRF"] = csrf
    # COS 仅从已有 secrets 或环境变量保留，不写死密钥
    if os.environ.get("TENCENTCLOUD_SECRET_ID"):
        env["TENCENTCLOUD_SECRET_ID"] = os.environ["TENCENTCLOUD_SECRET_ID"]
    if os.environ.get("TENCENTCLOUD_SECRET_KEY"):
        env["TENCENTCLOUD_SECRET_KEY"] = os.environ["TENCENTCLOUD_SECRET_KEY"]
    SECRETS.write_text(dump_env(env), encoding="utf-8")
    print(f"Wrote local secrets: {SECRETS} (MUSIC_U len={len(music_u)}, CSRF len={len(csrf)})")


def sync_prod(music_u: str, csrf: str) -> None:
    password = os.environ.get("DEPLOY_SSH_PASSWORD", "")
    if not password:
        raise SystemExit("Set DEPLOY_SSH_PASSWORD")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        HOST,
        username="ubuntu",
        password=password,
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = ssh.open_sftp()
    with sftp.file(REMOTE_ENV, "r") as f:
        remote_text = f.read().decode("utf-8")
    env = parse_env(remote_text)
    env["BENDOUDOU_NETEASE_MUSIC_U"] = music_u
    env["BENDOUDOU_NETEASE_CSRF"] = csrf
    body = dump_env(env)
    with sftp.file(REMOTE_ENV, "w") as f:
        f.write(body)
    sftp.close()
    _, stdout, _ = ssh.exec_command(
        f"chmod 600 {REMOTE_ENV} && sudo systemctl restart aimatex-music && sleep 3 && "
        "sudo systemctl is-active aimatex-music && "
        "python3 - <<'PY'\n"
        "env={}\n"
        f"for line in open('{REMOTE_ENV}', encoding='utf-8'):\n"
        "    line=line.strip()\n"
        "    if not line or line.startswith('#') or '=' not in line: continue\n"
        "    k,v=line.split('=',1); env[k]=v\n"
        "print('prod MUSIC_U set', bool(env.get('BENDOUDOU_NETEASE_MUSIC_U','').strip()), "
        "len(env.get('BENDOUDOU_NETEASE_MUSIC_U','')))\n"
        "print('prod CSRF set', bool(env.get('BENDOUDOU_NETEASE_CSRF','').strip()), "
        "len(env.get('BENDOUDOU_NETEASE_CSRF','')))\n"
        "PY",
        get_pty=True,
    )
    print(stdout.read().decode("utf-8", errors="replace"))
    ssh.close()


def main() -> int:
    music_u, csrf = extract_from_transcript()
    write_local(music_u, csrf)
    sync_prod(music_u, csrf)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
