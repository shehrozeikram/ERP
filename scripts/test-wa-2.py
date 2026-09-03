import paramiko, os

HOST = "68.183.215.177"
USER = "root"
PASS = "sardar1Sahab"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)

sftp = ssh.open_sftp()
sftp.put(os.path.join(os.path.dirname(__file__), "..", "server/scripts/test-wa.js"), "/var/www/sgc-erp/server/scripts/test-wa.js")
sftp.close()

stdin, stdout, stderr = ssh.exec_command("cd /var/www/sgc-erp && NODE_ENV=production node server/scripts/test-wa.js 2>&1")
print(stdout.read().decode())
ssh.close()
