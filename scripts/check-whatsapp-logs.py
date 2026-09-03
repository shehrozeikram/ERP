import paramiko, os

HOST = "68.183.215.177"
USER = "root"
PASS = "sardar1Sahab"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)

stdin, stdout, stderr = ssh.exec_command("pm2 logs sgc-erp-backend --lines 50 --nostream")
print(stdout.read().decode())
ssh.close()
