import time

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
    print(out[-3000:] if out else "(empty)", flush=True)
    return out


# MySQL reachability from core2
run(
    "python3 - <<'P'\n"
    "from pathlib import Path\n"
    "import subprocess\n"
    "env={}\n"
    "for line in Path('/opt/bendoudoudounai/secrets/bendoudou.env').read_text().splitlines():\n"
    "  line=line.strip()\n"
    "  if not line or line.startswith('#') or '=' not in line: continue\n"
    "  k,v=line.split('=',1); env[k]=v\n"
    "url=env['SPRING_DATASOURCE_URL'].split('?',1)[0].replace('jdbc:mysql://','')\n"
    "hostport,db=url.split('/',1); host,port=hostport.split(':')\n"
    "r=subprocess.run(['mysql','-h',host,'-P',port,'-u',env['SPRING_DATASOURCE_USERNAME'],"
    "f\"-p{env['SPRING_DATASOURCE_PASSWORD']}\",'--protocol=TCP',db,'-N','-e','SELECT 1'],"
    "capture_output=True,text=True)\n"
    "print('mysql_ok', r.returncode==0, 'out', r.stdout.strip(), 'err', r.stderr[-200:])\n"
    "P"
)

run("echo 'xp123!' | sudo -S -p '' systemctl restart bendoudoudounai")
time.sleep(18)
run("systemctl is-active bendoudoudounai")
run("curl -sS -m 10 -o /dev/null -w 'local_api:%{http_code}\\n' http://127.0.0.1:8882/api/guestbook")
run("curl -sS -m 15 -o /dev/null -w 'public_api:%{http_code}\\n' https://api.bendoudoudounai.com/api/guestbook || true")
run("curl -sS -m 15 -o /dev/null -w 'public_web:%{http_code}\\n' https://bendoudoudounai.com/ || true")
run(
    "journalctl -u bendoudoudounai --since '1 min ago' --no-pager "
    "| grep -iE 'Started Bendoudou|ERROR|Exception|Hikari' | tail -20 || true"
)
ssh.close()
