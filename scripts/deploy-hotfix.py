import paramiko
import sys
import os

HOST = "68.183.215.177"
USER = "root"
PASS = "sardar1Sahab"
REPO = "/var/www/sgc-erp"

LOCAL_FILE = os.path.join(
    os.path.dirname(__file__),
    "..", "server", "utils", "financeHelper.js"
)
REMOTE_FILE = f"{REPO}/server/utils/financeHelper.js"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)

print(f"Uploading {LOCAL_FILE} to {REMOTE_FILE}...")
sftp = ssh.open_sftp()
sftp.put(LOCAL_FILE, REMOTE_FILE)
sftp.close()

print("Restarting pm2...")
stdin, stdout, stderr = ssh.exec_command("pm2 restart sgc-erp-backend")
print(stdout.read().decode())

ssh.close()
print("Done!")
