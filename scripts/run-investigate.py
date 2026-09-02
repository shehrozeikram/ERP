import paramiko, os

HOST = "68.183.215.177"
USER = "root"
PASS = "sardar1Sahab"
REPO = "/var/www/sgc-erp"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)
sftp = ssh.open_sftp()
sftp.put(os.path.join(os.path.dirname(__file__), "..", "server/scripts/investigate-link.js"), f"{REPO}/server/scripts/investigate-link.js")
sftp.close()

stdin, stdout, stderr = ssh.exec_command(f"cd {REPO} && NODE_ENV=production node server/scripts/investigate-link.js 2>&1")
print(stdout.read().decode())
ssh.close()
