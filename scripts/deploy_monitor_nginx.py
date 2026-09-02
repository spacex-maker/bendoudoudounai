#!/usr/bin/env python3
"""Configure nginx + Let's Encrypt for monitor.aimatex.com -> Beszel :18090."""
from __future__ import annotations

import base64
import os
import sys
import time

import paramiko

HOST = "175.27.255.29"
PASSWORD = os.environ.get("DEPLOY_SSH_PASSWORD", "")
DOMAIN = "monitor.aimatex.com"
UPSTREAM = "http://127.0.0.1:18090"

NGINX_HTTP = f"""server {{
    listen 80;
    server_name {DOMAIN};

    location ^~ /.well-known/acme-challenge/ {{
        default_type "text/plain";
        root /var/www/certbot;
    }}

    location / {{
        proxy_pass {UPSTREAM};
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

# Ensure map for websocket Connection header exists; append snippet if missing
MAP_SNIPPET = """
# websocket upgrade helper (aimatex monitor)
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
"""


def run(ssh: paramiko.SSHClient, cmd: str, check: bool = True) -> str:
    print(f"\n>>> {cmd[:140]}")
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

    run(ssh, "sudo mkdir -p /var/www/certbot/.well-known/acme-challenge && sudo chmod -R 755 /var/www/certbot")

    # Add websocket map once if missing
    check = run(
        ssh,
        "grep -q 'map \\$http_upgrade \\$connection_upgrade' /etc/nginx/nginx.conf && echo HAS_MAP || echo NO_MAP",
        check=False,
    )
    if "NO_MAP" in check:
        b64 = base64.b64encode(MAP_SNIPPET.encode()).decode()
        run(
            ssh,
            f"echo {b64} | base64 -d | sudo tee /etc/nginx/conf.d/websocket-upgrade.conf >/dev/null",
        )

    conf_b64 = base64.b64encode(NGINX_HTTP.encode()).decode()
    run(
        ssh,
        f"echo {conf_b64} | base64 -d | sudo tee /etc/nginx/sites-available/{DOMAIN} >/dev/null",
    )
    run(
        ssh,
        f"sudo ln -sfn /etc/nginx/sites-available/{DOMAIN} /etc/nginx/sites-enabled/{DOMAIN}",
    )
    run(ssh, "sudo nginx -t && sudo systemctl reload nginx")
    run(ssh, "sudo ufw allow 80/tcp || true; sudo ufw allow 443/tcp || true", check=False)

    # Wait briefly for DNS if needed
    for i in range(6):
        dig = run(ssh, f"dig +short {DOMAIN} A @8.8.8.8 || true", check=False)
        if "175.27.255.29" in dig:
            break
        print(f"DNS not ready yet ({i+1}/6), sleep 10s...")
        time.sleep(10)

    run(
        ssh,
        f"curl -sI -H 'Host: {DOMAIN}' http://127.0.0.1/ | head -12",
        check=False,
    )
    run(
        ssh,
        f"sudo certbot --nginx -d {DOMAIN} --non-interactive --agree-tos "
        f"--register-unsafely-without-email --redirect",
        check=False,
    )
    run(ssh, "sudo systemctl enable --now certbot.timer 2>/dev/null || true", check=False)
    run(ssh, "systemctl list-timers | grep -i cert || true", check=False)
    run(ssh, f"curl -sI https://{DOMAIN}/ | head -15", check=False)
    run(ssh, "sudo certbot certificates 2>&1 | grep -A6 monitor || true", check=False)

    ssh.close()
    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
