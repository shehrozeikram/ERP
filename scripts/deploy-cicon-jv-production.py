import paramiko
import sys
import os

HOST = "68.183.215.177"
USER = "root"
PASS = "sardar1Sahab"
REMOTE_DIR = "/var/www/sgc-erp"

def main():
    file_arg = sys.argv[1] if len(sys.argv) > 1 else "docs/CICON data import year 2025-26.xlsx"
    company_arg = sys.argv[2] if len(sys.argv) > 2 else "CICON"
    mode_arg = "--apply" if "--apply" in sys.argv else "--dry-run"

    print(f"Connecting to production server {USER}@{HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS, timeout=20)
    sftp = ssh.open_sftp()

    print("Uploading script import-cicon-jv.js...")
    sftp.put("scripts/import-cicon-jv.js", f"{REMOTE_DIR}/scripts/import-cicon-jv.js")

    local_excel = os.path.join(os.getcwd(), file_arg)
    remote_excel = f"{REMOTE_DIR}/{file_arg}"
    remote_excel_dir = os.path.dirname(remote_excel)

    stdin, stdout, stderr = ssh.exec_command(f"mkdir -p '{remote_excel_dir}'")
    stdout.read()

    print(f"Uploading Excel file {file_arg} to production...")
    sftp.put(local_excel, remote_excel)
    sftp.close()
    print("Upload completed successfully!")

    cmd = f"cd {REMOTE_DIR} && node scripts/import-cicon-jv.js --file='{file_arg}' --company='{company_arg}' {mode_arg}"
    print(f"\nExecuting on droplet: {cmd}\n")
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)

    while True:
        line = stdout.readline()
        if not line:
            break
        print(line, end="")

    rc = stdout.channel.recv_exit_status()
    ssh.close()
    if rc != 0:
        print(f"\nExecution failed with code {rc}")
        sys.exit(rc)
    else:
        print("\nDroplet execution finished successfully!")

if __name__ == "__main__":
    main()
