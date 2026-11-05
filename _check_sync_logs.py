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

# wait a bit more for initial delay + sync
time.sleep(10)

_, o, e = ssh.exec_command(
    "journalctl -u bendoudoudounai --since '3 min ago' --no-pager"
)
text = (o.read() + e.read()).decode()
print("lines", len(text.splitlines()))
for line in text.splitlines():
    low = line.lower()
    if any(
        k in low
        for k in (
            "netease",
            "credential",
            "remote",
            "scheduled",
            "sync",
            "warn",
            "error",
            "exception",
        )
    ):
        print(line)

# dump beans via jmx? skip
# Check property binding by looking at yaml defaults in jar
_, o, e = ssh.exec_command(
    "python3 - <<'P'\n"
    "import zipfile\n"
    "z=zipfile.ZipFile('/opt/bendoudoudounai/bin/bendoudou-server.jar')\n"
    "data=z.read('BOOT-INF/classes/application.yml').decode('utf-8','replace')\n"
    "for i,line in enumerate(data.splitlines(),1):\n"
    "  if 'credential' in line or 'netease' in line.lower() or 'scheduling' in line.lower():\n"
    "    print(f'{i}:{line}')\n"
    "P"
)
print((o.read() + e.read()).decode())

# Check if NeteaseRemoteCredentialSync is referenced / SchedulingConfigurer
_, o, e = ssh.exec_command(
    "python3 - <<'P'\n"
    "import zipfile\n"
    "z=zipfile.ZipFile('/opt/bendoudoudounai/bin/bendoudou-server.jar')\n"
    "app=z.read('BOOT-INF/classes/com/bendoudou/server/BendoudouServerApplication.class')\n"
    "print('EnableScheduling marker in class bytes', b'EnableScheduling' in app or b'scheduling' in app.lower())\n"
    "print('class size', len(app))\n"
    "# also check NeteaseProperties fields in class constant pool-ish\n"
    "props=z.read('BOOT-INF/classes/com/bendoudou/server/music/netease/NeteaseProperties.class')\n"
    "for s in [b'credentialUrl', b'credentialApiKey', b'isRemoteCredentialConfigured', b'credential-url']:\n"
    "  print(s, s in props)\n"
    "sync=z.read('BOOT-INF/classes/com/bendoudou/server/music/netease/NeteaseRemoteCredentialSync.class')\n"
    "for s in [b'scheduledSync', b'ensureFresh', b'X-Internal-Api-Key', b'Netease credentials synced']:\n"
    "  print(s, s in sync)\n"
    "P"
)
print((o.read() + e.read()).decode())
ssh.close()
