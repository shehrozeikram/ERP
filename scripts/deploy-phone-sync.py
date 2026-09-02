import paramiko, os

HOST = "68.183.215.177"
USER = "root"
PASS = "sardar1Sahab"
REPO = "/var/www/sgc-erp"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)
sftp = ssh.open_sftp()

# Upload sync script
local = os.path.join(os.path.dirname(__file__), "..", "server/scripts/sync-employee-phones-to-users.js")
remote = f"{REPO}/server/scripts/sync-employee-phones-to-users.js"
print("Uploading sync script...")
sftp.put(local, remote)

# Also upload updated UserManagement.js (frontend build is needed, so just upload the route file instead - frontend runs via build)
# Upload auth.js is not needed since phone is already supported there

sftp.close()

print("Running sync script on production...")
cmd = f"cd {REPO} && NODE_ENV=production node server/scripts/sync-employee-phones-to-users.js 2>&1"
stdin, stdout, stderr = ssh.exec_command(cmd)
out = stdout.read().decode()
err = stderr.read().decode()
print(out)
if err:
    print("[stderr]", err)

ssh.close()
print("Done!")
