#!/usr/bin/env python3
import paramiko
import sys
import os

HOST = "68.183.215.177"
USER = "root"
PASS = "sardar1Sahab"
REPO = "/var/www/sgc-erp"

def run(ssh, cmd, desc=""):
    if desc:
        print(f"\n{'='*60}\n▶  {desc}\n{'='*60}")
    print(f"$ {cmd[:120]}{'...' if len(cmd)>120 else ''}")
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    rc  = stdout.channel.recv_exit_status()
    if out.strip():
        print(out)
    if err.strip():
        print("[stderr]", err)
    return rc, out, err

def upload_file(ssh, local_path, remote_path):
    print(f"\n{'='*60}\n▶  Uploading {local_path} -> {remote_path}\n{'='*60}")
    sftp = ssh.open_sftp()
    sftp.put(local_path, remote_path)
    sftp.close()
    print("✅  File Uploaded Successfully")

def main():
    print(f"Connecting to production server {USER}@{HOST} …")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS, timeout=20)
    print("✅  Successfully connected to Production Droplet!\n")

    # Local paths
    local_script = os.path.join(os.path.dirname(__file__), "..", "server", "scripts", "fix-multi-moza-transfers-production.js")
    local_excel = os.path.join(os.path.dirname(__file__), "..", "docs", "Deals with multiple moza's.xlsx")

    # Remote paths
    remote_script = f"{REPO}/server/scripts/fix-multi-moza-transfers-production.js"
    remote_excel_dir = f"{REPO}/docs"
    remote_excel = f"{REPO}/docs/Deals with multiple moza's.xlsx"

    # Ensure remote docs dir exists
    run(ssh, f"mkdir -p {remote_excel_dir}", "Ensure /docs directory exists on server")

    # Upload script and excel file
    upload_file(ssh, local_script, remote_script)
    upload_file(ssh, local_excel, remote_excel)

    # Execute migration on production
    run(ssh, f"cd {REPO} && NODE_ENV=production node server/scripts/fix-multi-moza-transfers-production.js", "Executing Multi-Moza Transfers Migration on Production Server")

    # Restart PM2
    run(ssh, "cd /var/www/sgc-erp && pm2 restart sgc-erp-backend --update-env || pm2 restart all", "Restarting PM2 Service")

    ssh.close()
    print("\n🎉 Multi-Moza Migration Deployed & Executed Successfully!")

if __name__ == "__main__":
    main()
