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
    _, o, e = ssh.exec_command(cmd)
    out = (o.read() + e.read()).decode("utf-8", "replace")
    print(out[-5000:] if out else "(empty)")
    return out


print("=== recent errors ===")
run(
    "journalctl -u bendoudoudounai --since '6 hours ago' --no-pager "
    "| grep -iE 'ERROR|Exception|add-to-playlist|playlist|discover|NoSuchMethod|NoHandler|Ambiguous|Required request' "
    "| tail -80"
)
print("=== mappings in jar (sample) ===")
run(
    "python3 - <<'P'\n"
    "import zipfile\n"
    "z=zipfile.ZipFile('/opt/bendoudoudounai/bin/bendoudou-server.jar')\n"
    "names=[n for n in z.namelist() if n.endswith('MusicController.class') or 'AddTrack' in n or 'Discover' in n]\n"
    "print('\\n'.join(names[:40]))\n"
    "P"
)
ssh.close()
