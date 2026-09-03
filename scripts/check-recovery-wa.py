import paramiko

HOST = "68.183.215.177"
USER = "root"
PASS = "sardar1Sahab"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)

stdin, stdout, stderr = ssh.exec_command("cat /var/www/sgc-erp/server/utils/recoveryWhatsAppSend.js | grep -A 20 'template'")
print(stdout.read().decode())
ssh.close()
