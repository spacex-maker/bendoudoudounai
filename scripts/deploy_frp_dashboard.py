#!/usr/bin/env python3
"""Configure frps dashboard + nginx/SSL for frp.aimatex.com on 175.27.255.29."""
from __future__ import annotations

import base64
import os
import sys
import time

import paramiko

HOST = "175.27.255.29"
PASSWORD = os.environ.get("DEPLOY_SSH_PASSWORD", "")
DOMAIN = "frp.aimatex.com"
FRP_DIR = "/home/ubuntu/frp_0.61.2_linux_amd64"
DASH_PORT = 7500
DASH_USER = os.environ.get("FRP_DASH_USER", "admin")
DASH_PASS = os.environ.get("FRP_DASH_PASSWORD", "")
FRP_TOKEN = os.environ.get("FRP_AUTH_TOKEN", "")

FRPS_TOML = f"""bindPort = 17400
vhostHTTPPort = 19090

[auth]
method = "token"
token = "{FRP_TOKEN}"

[webServer]
addr = "127.0.0.1"
port = {DASH_PORT}
user = "{DASH_USER}"
password = "{DASH_PASS}"
"""

WRAPPER = f"""#!/bin/bash
exec {FRP_DIR}/frps -c {FRP_DIR}/frps.toml
"""

UNIT = f"""[Unit]
Description=frps (aimatex)
After=network.target

[Service]
Type=simple
WorkingDirectory={FRP_DIR}
ExecStart={FRP_DIR}/start-frps.sh
Restart=always
RestartSec=3
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
"""

NGINX = f"""server {{
    listen 80;
    server_name {DOMAIN};

    location ^~ /.well-known/acme-challenge/ {{
        default_type "text/plain";
        root /var/www/certbot;
    }}

    location / {{
        proxy_pass http://127.0.0.1:{DASH_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }}
}}
"""


def run(ssh: paramiko.SSHClient, cmd: str, check: bool = True) -> str:
    print(f"\n>>> {cmd[:160]}")
    _, stdout, _ = ssh.exec_command(cmd, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    print(out[-4000:] if len(out) > 4000 else out)
    if check and code != 0:
        raise RuntimeError(f"failed ({code}): {cmd}")
    return out


def main() -> int:
    if not PASSWORD:
        print("Set DEPLOY_SSH_PASSWORD", file=sys.stderr)
        return 1
    if not DASH_PASS or not FRP_TOKEN:
        print("Set FRP_DASH_PASSWORD and FRP_AUTH_TOKEN", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        HOST,
        username="ubuntu",
        password=PASSWORD,
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )

    run(ssh, f"cp -a {FRP_DIR}/frps.toml {FRP_DIR}/frps.toml.bak-$(date +%Y%m%d%H%M%S) || true", check=False)
    sftp = ssh.open_sftp()
    with sftp.file(f"{FRP_DIR}/frps.toml", "w") as f:
        f.write(FRPS_TOML)
    with sftp.file(f"{FRP_DIR}/start-frps.sh", "w") as f:
        f.write(WRAPPER)
    sftp.close()
    run(ssh, f"chmod +x {FRP_DIR}/start-frps.sh")

    unit_b64 = base64.b64encode(UNIT.encode()).decode()
    run(ssh, f"echo {unit_b64} | base64 -d | sudo tee /etc/systemd/system/frps.service >/dev/null")
    run(ssh, "sudo systemctl daemon-reload && sudo systemctl enable frps && sudo systemctl restart frps")
    time.sleep(4)
    run(ssh, "sudo systemctl is-active frps")
    run(ssh, f"ss -lntp | grep -E ':{DASH_PORT}|:17400' || true", check=False)

    run(ssh, "sudo mkdir -p /var/www/certbot/.well-known/acme-challenge && sudo chmod -R 755 /var/www/certbot")
    if "NO_MAP" in run(
        ssh,
        "test -f /etc/nginx/conf.d/websocket-upgrade.conf && echo HAS_MAP || echo NO_MAP",
        check=False,
    ):
        map_snip = "map $http_upgrade $connection_upgrade { default upgrade; '' close; }\n"
        run(
            ssh,
            f"echo {base64.b64encode(map_snip.encode()).decode()} | base64 -d | sudo tee /etc/nginx/conf.d/websocket-upgrade.conf >/dev/null",
        )

    conf_b64 = base64.b64encode(NGINX.encode()).decode()
    run(ssh, f"echo {conf_b64} | base64 -d | sudo tee /etc/nginx/sites-available/{DOMAIN} >/dev/null")
    run(ssh, f"sudo ln -sfn /etc/nginx/sites-available/{DOMAIN} /etc/nginx/sites-enabled/{DOMAIN}")
    run(ssh, "sudo nginx -t && sudo systemctl reload nginx")
    run(
        ssh,
        f"sudo certbot --nginx -d {DOMAIN} --non-interactive --agree-tos "
        f"--register-unsafely-without-email --redirect",
        check=False,
    )
    run(ssh, "sudo systemctl enable --now certbot.timer 2>/dev/null || true", check=False)
    run(ssh, f"curl -sI -u '{DASH_USER}:{DASH_PASS}' https://{DOMAIN}/static/ | head -12", check=False)

    ssh.close()
    print(f"\nURL: https://{DOMAIN}/")
    print(f"Dashboard port: {DASH_PORT} (localhost only)")
    print(f"Auth: {DASH_USER} / (shared server password)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
