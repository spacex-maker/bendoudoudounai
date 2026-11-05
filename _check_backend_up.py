import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(
    "175.27.255.29",
    port=18176,
    username="xp",
    password="xp123!",
    timeout=30,
    allow_agent=False,
    look_for_keys=False,
)


def run(cmd: str) -> str:
    print(">>>", cmd[:180], flush=True)
    _, o, e = ssh.exec_command(cmd, get_pty=True)
    out = (o.read() + e.read()).decode("utf-8", "replace")
    print(out[-4500:] if out else "(empty)", flush=True)
    return out


run("systemctl is-active bendoudoudounai || true")
run("systemctl status bendoudoudounai --no-pager -l | head -40")
run("curl -sS -m 8 -o /dev/null -w 'guestbook:%{http_code}\\n' http://127.0.0.1:8882/api/guestbook || echo guestbook_fail")
run("curl -sS -m 8 -o /dev/null -w 'web:%{http_code}\\n' http://127.0.0.1:8090/ || echo web_fail")
run("journalctl -u bendoudoudounai -n 60 --no-pager")
ssh.close()
