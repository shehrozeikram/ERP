import paramiko
import os

HOST = "68.183.215.177"
USER = "root"
PASS = "sardar1Sahab"
REPO = "/var/www/sgc-erp"

FILES = [
    "server/utils/approvalWhatsAppNotifier.js",
    "server/routes/procurement.js",
    "server/routes/indents.js",
    "server/routes/cashApprovals.js",
    "server/routes/financeAdvanced.js",
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)
sftp = ssh.open_sftp()

for f in FILES:
    local = os.path.join(os.path.dirname(__file__), "..", f)
    remote = f"{REPO}/{f}"
    print(f"Uploading {f}...")
    sftp.put(local, remote)

sftp.close()
print("Restarting pm2...")
stdin, stdout, stderr = ssh.exec_command("pm2 restart sgc-erp-backend")
print(stdout.read().decode())
ssh.close()
print("Done!")
