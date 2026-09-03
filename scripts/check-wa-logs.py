import paramiko, os

HOST = "68.183.215.177"
USER = "root"
PASS = "sardar1Sahab"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)

# Search all pm2 logs
stdin, stdout, stderr = ssh.exec_command("cat /root/.pm2/logs/*.log | grep 'ApprovalWA'")
print(stdout.read().decode())
ssh.close()
