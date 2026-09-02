#!/usr/bin/env python3
"""Deploy AIMATEX-MUSIC to 139.155.130.167 (Chengdu)."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import paramiko

HOST = "139.155.130.167"
USER = os.environ.get("DEPLOY_SSH_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_SSH_PASSWORD", "")
WEB_DOMAIN = "music.aimatex.com"
API_DOMAIN = "music-api.aimatex.com"
APP_PORT = 8882

ROOT = Path(__file__).resolve().parents[1]
JAR = ROOT / "target" / "bendoudou-server-0.0.1-SNAPSHOT.jar"
WEB_DIST = ROOT / "frontend" / "dist"

REMOTE_JAVA = "/home/ubuntu/java/music"
REMOTE_WEB = "/home/ubuntu/web/music"
REMOTE_JAR = f"{REMOTE_JAVA}/bendoudou-server.jar"
REMOTE_ENV = f"{REMOTE_JAVA}/bendoudou.env"

ENV_CONTENT = """SPRING_DATASOURCE_URL=jdbc:mysql://175.27.255.29:33306/bendoudoudounai?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true
SPRING_DATASOURCE_USERNAME={db_user}
SPRING_DATASOURCE_PASSWORD={db_password}
BENDOUDOU_JWT_SECRET={jwt_secret}
TENCENTCLOUD_SECRET_ID={cos_id}
TENCENTCLOUD_SECRET_KEY={cos_key}
BENDOUDOU_NETEASE_MUSIC_U={music_u}
BENDOUDOU_NETEASE_CSRF={csrf}
BENDOUDOU_MUSIC_UPLOAD={upload_dir}/uploads/music
SPRING_MAIL_USERNAME={mail_user}
SPRING_MAIL_PASSWORD={mail_password}
"""

SYSTEMD_UNIT = f"""[Unit]
Description=AIMATEX-MUSIC API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory={REMOTE_JAVA}
EnvironmentFile={REMOTE_ENV}
ExecStart=/usr/bin/java -Xms128m -Xmx512m -jar {REMOTE_JAR}
SuccessExitStatus=143
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""

NGINX_WEB = f"""server {{
    listen 80;
    server_name {WEB_DOMAIN};

    root {REMOTE_WEB};
    index index.html;
    client_max_body_size 130m;

    location ^~ /.well-known/acme-challenge/ {{
        default_type "text/plain";
        root /var/www/certbot;
    }}

    location / {{
        try_files $uri $uri/ /index.html;
    }}
}}
"""

NGINX_API = f"""server {{
    listen 80;
    server_name {API_DOMAIN};
    client_max_body_size 130m;

    location ^~ /.well-known/acme-challenge/ {{
        default_type "text/plain";
        root /var/www/certbot;
    }}

    location / {{
        proxy_pass http://127.0.0.1:{APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }}
}}
"""


def run(ssh: paramiko.SSHClient, cmd: str, check: bool = True) -> tuple[int, str]:
    print(f"\n>>> {cmd[:160]}")
    _, stdout, _ = ssh.exec_command(cmd, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    print(out[-4000:] if len(out) > 4000 else out)
    if check and code != 0:
        raise RuntimeError(f"cmd failed ({code}): {cmd}")
    return code, out


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


def load_local_secrets() -> dict[str, str]:
    path = ROOT / "secrets" / "bendoudou.env"
    if not path.exists():
        return {}
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def main() -> int:
    if not PASSWORD:
        print("Set DEPLOY_SSH_PASSWORD", file=sys.stderr)
        return 1
    frontend_only = os.environ.get("DEPLOY_FRONTEND_ONLY", "").strip() in ("1", "true", "yes")
    if not frontend_only and not JAR.exists():
        print(f"Missing JAR: {JAR}", file=sys.stderr)
        return 1
    if not WEB_DIST.exists():
        print(f"Missing frontend dist: {WEB_DIST}", file=sys.stderr)
        return 1

    local_secrets = load_local_secrets()

    db_user = os.environ.get("DEPLOY_DB_USER", "root")
    db_password = os.environ.get("DEPLOY_DB_PASSWORD", "")
    jwt_secret = os.environ.get("DEPLOY_JWT_SECRET", "")
    if not db_password or not jwt_secret:
        print("Set DEPLOY_DB_PASSWORD and DEPLOY_JWT_SECRET", file=sys.stderr)
        return 1
    cos_id = (
        os.environ.get("TENCENTCLOUD_SECRET_ID")
        or local_secrets.get("TENCENTCLOUD_SECRET_ID")
        or ""
    )
    cos_key = (
        os.environ.get("TENCENTCLOUD_SECRET_KEY")
        or local_secrets.get("TENCENTCLOUD_SECRET_KEY")
        or ""
    )
    music_u = (
        os.environ.get("BENDOUDOU_NETEASE_MUSIC_U")
        or local_secrets.get("BENDOUDOU_NETEASE_MUSIC_U")
        or ""
    )
    csrf = (
        os.environ.get("BENDOUDOU_NETEASE_CSRF")
        or local_secrets.get("BENDOUDOU_NETEASE_CSRF")
        or ""
    )
    mail_user = (
        os.environ.get("SPRING_MAIL_USERNAME")
        or local_secrets.get("SPRING_MAIL_USERNAME")
        or ""
    )
    mail_password = (
        os.environ.get("SPRING_MAIL_PASSWORD")
        or local_secrets.get("SPRING_MAIL_PASSWORD")
        or ""
    )
    if not music_u.strip():
        print("WARN: BENDOUDOU_NETEASE_MUSIC_U empty (secrets/bendoudou.env or env)", file=sys.stderr)
    else:
        print(f"NetEase MUSIC_U loaded (len={len(music_u)})")
    if not mail_password.strip():
        print("WARN: SPRING_MAIL_PASSWORD empty (注册/找回密码邮件将失败)", file=sys.stderr)

    env_body = ENV_CONTENT.format(
        db_user=db_user,
        db_password=db_password,
        jwt_secret=jwt_secret,
        cos_id=cos_id,
        cos_key=cos_key,
        music_u=music_u,
        csrf=csrf,
        upload_dir=REMOTE_JAVA,
        mail_user=mail_user,
        mail_password=mail_password,
    )

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting {USER}@{HOST} ...")
    ssh.connect(
        HOST,
        username=USER,
        password=PASSWORD,
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )

    if frontend_only:
        print("FRONTEND ONLY: skip JAR/env/systemd/certbot")
        sftp = ssh.open_sftp()
        print("Uploading frontend dist ...")
        run(ssh, f"rm -rf {REMOTE_WEB}/*")
        sftp_put_dir(sftp, WEB_DIST, REMOTE_WEB)
        sftp.close()
        run(ssh, f"chmod 755 /home/ubuntu /home/ubuntu/web {REMOTE_WEB}")
        run(ssh, "sudo nginx -t && sudo systemctl reload nginx")
        run(ssh, f"curl -sfI https://{WEB_DOMAIN}/ | head -8", check=False)
        ssh.close()
        print("\nFrontend deploy finished.")
        return 0

    run(
        ssh,
        "sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq openjdk-17-jre-headless nginx certbot python3-certbot-nginx",
    )
    run(ssh, f"mkdir -p {REMOTE_JAVA} {REMOTE_WEB} {REMOTE_JAVA}/uploads/music")
    run(ssh, "sudo mkdir -p /var/www/certbot/.well-known/acme-challenge && sudo chmod -R 755 /var/www/certbot")
    run(ssh, "sudo chmod 755 /home/ubuntu")

    # MySQL DB + user (works with sudo mysql on Ubuntu)
    sql = f"""CREATE DATABASE IF NOT EXISTS bendoudoudounai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '{db_user}'@'localhost' IDENTIFIED BY '{db_password}';
CREATE USER IF NOT EXISTS '{db_user}'@'127.0.0.1' IDENTIFIED BY '{db_password}';
GRANT ALL PRIVILEGES ON bendoudoudounai.* TO '{db_user}'@'localhost';
GRANT ALL PRIVILEGES ON bendoudoudounai.* TO '{db_user}'@'127.0.0.1';
FLUSH PRIVILEGES;
"""
    sftp = ssh.open_sftp()
    with sftp.file(f"{REMOTE_JAVA}/init-db.sql", "w") as f:
        f.write(sql)
    run(ssh, f"sudo mysql < {REMOTE_JAVA}/init-db.sql", check=False)
    run(ssh, f"rm -f {REMOTE_JAVA}/init-db.sql", check=False)

    print(f"Uploading JAR -> {REMOTE_JAR}")
    sftp.put(str(JAR), REMOTE_JAR)
    # Preserve existing prod env (DB) unless forced; always merge NetEase from local secrets when present
    env_exists = False
    try:
        sftp.stat(REMOTE_ENV)
        env_exists = True
    except FileNotFoundError:
        pass
    if env_exists and os.environ.get("DEPLOY_FORCE_ENV", "").strip() not in ("1", "true", "yes"):
        print(f"Keep existing env: {REMOTE_ENV}")
        with sftp.file(REMOTE_ENV, "r") as f:
            remote_text = f.read().decode("utf-8")
        merged: dict[str, str] = {}
        for line in remote_text.splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            merged[k] = v
        if music_u.strip():
            merged["BENDOUDOU_NETEASE_MUSIC_U"] = music_u
        if csrf.strip():
            merged["BENDOUDOU_NETEASE_CSRF"] = csrf
        if mail_user.strip():
            merged["SPRING_MAIL_USERNAME"] = mail_user
        if mail_password.strip():
            merged["SPRING_MAIL_PASSWORD"] = mail_password
        with sftp.file(REMOTE_ENV, "w") as f:
            f.write(
                "\n".join(f"{k}={v}" for k, v in merged.items()) + "\n"
            )
        print("Merged NetEase/mail into existing env")
    else:
        with sftp.file(REMOTE_ENV, "w") as f:
            f.write(env_body)
    print("Uploading frontend dist ...")
    # clear remote web first
    run(ssh, f"rm -rf {REMOTE_WEB}/*")
    sftp_put_dir(sftp, WEB_DIST, REMOTE_WEB)
    sftp.close()
    run(ssh, f"chmod 600 {REMOTE_ENV}")
    run(ssh, f"chmod 755 /home/ubuntu /home/ubuntu/web {REMOTE_WEB}")

    # systemd
    unit_b64 = __import__("base64").b64encode(SYSTEMD_UNIT.encode()).decode()
    run(
        ssh,
        f"echo {unit_b64} | base64 -d | sudo tee /etc/systemd/system/aimatex-music.service >/dev/null",
    )
    run(ssh, "sudo systemctl daemon-reload && sudo systemctl enable aimatex-music && sudo systemctl restart aimatex-music")

    # nginx sites
    web_b64 = __import__("base64").b64encode(NGINX_WEB.encode()).decode()
    api_b64 = __import__("base64").b64encode(NGINX_API.encode()).decode()
    run(
        ssh,
        f"echo {web_b64} | base64 -d | sudo tee /etc/nginx/sites-available/music.aimatex.com >/dev/null",
    )
    run(
        ssh,
        f"echo {api_b64} | base64 -d | sudo tee /etc/nginx/sites-available/music-api.aimatex.com >/dev/null",
    )
    run(
        ssh,
        "sudo ln -sfn /etc/nginx/sites-available/music.aimatex.com /etc/nginx/sites-enabled/music.aimatex.com && "
        "sudo ln -sfn /etc/nginx/sites-available/music-api.aimatex.com /etc/nginx/sites-enabled/music-api.aimatex.com",
    )
    run(ssh, "sudo nginx -t && sudo systemctl reload nginx")
    run(ssh, "sudo ufw allow OpenSSH || true; sudo ufw allow 80/tcp || true; sudo ufw allow 443/tcp || true", check=False)

    print("Waiting for backend ...")
    time.sleep(18)
    run(ssh, "sudo systemctl is-active aimatex-music")
    run(ssh, f"curl -sf -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{APP_PORT}/api/auth/me || true", check=False)
    run(ssh, f"curl -sfI http://127.0.0.1/ -H 'Host: {WEB_DOMAIN}' | head -8")
    run(ssh, f"curl -sf -o /dev/null -w '%{{http_code}}' http://127.0.0.1/api/auth/me -H 'Host: {API_DOMAIN}' || true", check=False)

    # SSL
    run(
        ssh,
        f"sudo certbot --nginx -d {WEB_DOMAIN} -d {API_DOMAIN} --non-interactive --agree-tos "
        f"--register-unsafely-without-email --redirect",
        check=False,
    )
    run(ssh, "sudo systemctl reload nginx", check=False)
    run(ssh, f"curl -sfI https://{WEB_DOMAIN}/ | head -8", check=False)
    run(ssh, f"curl -sf -o /dev/null -w '%{{http_code}}' https://{API_DOMAIN}/api/auth/me || true", check=False)

    run(ssh, "sudo systemctl enable --now certbot.timer 2>/dev/null || sudo systemctl enable --now snap.certbot.renew.timer 2>/dev/null || true", check=False)
    run(ssh, "systemctl list-timers | grep -i cert || true", check=False)

    ssh.close()
    print("\nDeploy finished.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
