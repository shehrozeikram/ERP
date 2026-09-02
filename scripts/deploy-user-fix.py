import paramiko, os

HOST = "68.183.215.177"
USER = "root"
PASS = "sardar1Sahab"
REPO = "/var/www/sgc-erp"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)
sftp = ssh.open_sftp()

local = os.path.join(os.path.dirname(__file__), "..", "server/models/User.js")
remote = f"{REPO}/server/models/User.js"
print("Uploading User.js...")
sftp.put(local, remote)

sftp.close()

print("Restarting pm2...")
stdin, stdout, stderr = ssh.exec_command("pm2 restart sgc-erp-backend")
print(stdout.read().decode())
ssh.close()
print("Done!")
