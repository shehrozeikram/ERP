#!/usr/bin/env python3
"""
Deploy and run fix-employee-ids-production.js on the production droplet.
Step 2: fix remaining 3 employees by uploading a targeted inline script.
"""
import paramiko
import sys
import os

HOST = "68.183.215.177"
USER = "root"
PASS = "sardar1Sahab"
REPO = "/var/www/sgc-erp"

LOCAL_SCRIPT = os.path.join(
    os.path.dirname(__file__),
    "..", "server", "scripts", "fix-employee-ids-production.js"
)
REMOTE_SCRIPT = f"{REPO}/server/scripts/fix-employee-ids-production.js"


def run(ssh, cmd, desc=""):
    if desc:
        print(f"\n{'='*60}\n▶  {desc}\n{'='*60}")
    print(f"$ {cmd[:120]}{'...' if len(cmd)>120 else ''}")
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=False)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    rc  = stdout.channel.recv_exit_status()
    if out.strip():
        print(out)
    if err.strip():
        print("[stderr]", err)
    return rc, out, err


def upload_text(ssh, content, remote_path):
    print(f"\n{'='*60}\n▶  Write {remote_path}\n{'='*60}")
    sftp = ssh.open_sftp()
    with sftp.open(remote_path, 'w') as f:
        f.write(content)
    sftp.close()
    print("✅  Written")


def main():
    print(f"Connecting to {USER}@{HOST} …")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS, timeout=20)
    print("✅  Connected\n")

    # Inline Node.js fix script — written as a file to avoid any shell-quoting issues
    fix_script = r"""
const path = require('path');
const fs = require('fs');
const envPath = path.join('/var/www/sgc-erp', '.env');
if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
const mongoose = require('mongoose');

const REMAINING = [
  { firstName: 'Muhammad Haris', lastName: 'Ali',         correctId: '04921' },
  { firstName: 'Muhammad Adnan', lastName: 'Khan',        correctId: '06453' },
  { firstName: 'Malik Zahid',    lastName: 'Mehmood',     correctId: '01630' },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('No MONGODB_URI'); process.exit(1); }
  await mongoose.connect(uri);
  const col = mongoose.connection.collection('employees');

  for (const { firstName, lastName, correctId } of REMAINING) {
    // Try all known wrong IDs plus correct one
    const possibleIds = {
      'Muhammad Haris': ['6606','06606','4921','04921'],
      'Muhammad Adnan': ['6610','06610','6453','06453'],
      'Malik Zahid':    ['6611','06611','1630','01630'],
    }[firstName] || [];

    let emp = null;

    // First try each wrong id
    for (const wid of possibleIds) {
      const candidate = await col.findOne({ employeeId: wid, isDeleted: { $ne: true } });
      if (candidate) {
        const fn = (candidate.firstName || '').toLowerCase();
        const ln = (candidate.lastName  || '').toLowerCase();
        const firstWord = firstName.split(' ').pop().toLowerCase();
        if (fn.includes(firstWord) || ln.includes(lastName.toLowerCase())) {
          emp = candidate;
          break;
        }
      }
    }

    // Fallback: find by name parts
    if (!emp) {
      const firstWord = firstName.split(' ').pop();
      emp = await col.findOne({
        firstName: { $regex: firstWord, $options: 'i' },
        lastName:  { $regex: lastName,  $options: 'i' },
        isDeleted: { $ne: true }
      });
    }

    if (!emp) {
      console.log('NOT FOUND: ' + firstName + ' ' + lastName);
      continue;
    }

    const current = emp.employeeId;
    if (current === correctId) {
      console.log('ALREADY OK: ' + correctId + ' — ' + emp.firstName + ' ' + emp.lastName);
      continue;
    }

    // Check conflict
    const conflict = await col.findOne({
      employeeId: correctId,
      isDeleted: { $ne: true },
      _id: { $ne: emp._id }
    });
    if (conflict) {
      console.log('CONFLICT: ' + correctId + ' taken by ' + conflict.firstName + ' ' + conflict.lastName);
      continue;
    }

    const result = await col.updateOne({ _id: emp._id }, { $set: { employeeId: correctId } });
    if (result.modifiedCount === 1) {
      console.log('FIXED: ' + emp.firstName + ' ' + emp.lastName + ' — ' + current + ' -> ' + correctId);
    } else {
      console.log('NO_CHANGE: ' + emp.firstName + ' ' + emp.lastName + ' current=' + current);
    }
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
"""

    upload_text(ssh, fix_script, f"{REPO}/server/scripts/_fix-remaining-ids.js")

    # ── Run remaining fix ──────────────────────────────────────────────────────
    run(ssh,
        f"cd {REPO} && NODE_ENV=production node server/scripts/_fix-remaining-ids.js 2>&1",
        "Fix remaining 3 employees")

    # ── Final verification: check all 7 ───────────────────────────────────────
    verify_script = """
const path = require('path');
const fs = require('fs');
const envPath = path.join('/var/www/sgc-erp', '.env');
if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const col = mongoose.connection.collection('employees');
  const checks = [
    ['02995','Abrar Ullah'],
    ['06187','Najeeb Abbasi'],
    ['04921','Muhammad Haris Ali'],
    ['03015','Wajahat Haleem'],
    ['05874','Zakir Hussain'],
    ['06453','Muhammad Adnan Khan'],
    ['01630','Malik Zahid Mehmood']
  ];
  for (const [id, name] of checks) {
    const e = await col.findOne({ employeeId: id, isDeleted: { $ne: true } });
    if (e) console.log('OK  ' + id + ' — ' + e.firstName + ' ' + e.lastName);
    else   console.log('BAD ' + id + ' — NOT FOUND  (expected: ' + name + ')');
  }
  await mongoose.disconnect();
}).catch(e => { console.error(e.message); process.exit(1); });
"""
    upload_text(ssh, verify_script, f"{REPO}/server/scripts/_verify-ids.js")
    run(ssh,
        f"cd {REPO} && NODE_ENV=production node server/scripts/_verify-ids.js 2>&1",
        "Final verification — all 7 employees")

    # ── Cleanup temp files ────────────────────────────────────────────────────
    run(ssh, f"rm -f {REPO}/server/scripts/_fix-remaining-ids.js {REPO}/server/scripts/_verify-ids.js")

    ssh.close()
    print("\n✅  All done.")


if __name__ == "__main__":
    main()
