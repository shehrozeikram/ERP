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

def upload_text(ssh, content, remote_path):
    print(f"\n{'='*60}\n▶  Write {remote_path}\n{'='*60}")
    sftp = ssh.open_sftp()
    with sftp.open(remote_path, 'w') as f:
        f.write(content)
    sftp.close()
    print("✅  File Written")

def main():
    print(f"Connecting to production server {USER}@{HOST} …")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS, timeout=20)
    print("✅  Successfully connected to Production Droplet!\n")

    # Script to run directly on the droplet with production environment
    remote_loan_script = r"""
const path = require('path');
const fs = require('fs');
const envPath = path.join('/var/www/sgc-erp', '.env');
if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });

const mongoose = require('mongoose');

async function importLoan() {
  const possibleUris = [
    process.env.MONGODB_URI,
    process.env.MONGODB_URI_LOCAL,
    'mongodb://127.0.0.1:27017/sgc_erp',
    'mongodb://127.0.0.1:27017/sgc-erp-backend',
    'mongodb://127.0.0.1:27017/sgc_erp_local'
  ].filter(Boolean);

  // Remove duplicates
  const uris = [...new Set(possibleUris)];

  for (const uri of uris) {
    try {
      console.log('\n--------------------------------------------------');
      console.log('Connecting to Production DB URI:', uri);
      await mongoose.connect(uri);

      const Employee = mongoose.model('Employee', require('../models/hr/Employee').schema);
      const Loan = mongoose.model('Loan', require('../models/hr/Loan').schema);
      const User = mongoose.model('User', require('../models/User').schema);

      // Find Attique Ur Rehman
      const emp = await Employee.findOne({
        $or: [
          { employeeId: '00026' },
          { employeeId: '26' },
          { firstName: 'Attique', lastName: 'Ur Rehman' },
          { firstName: { $regex: 'Attique', $options: 'i' } }
        ]
      });

      if (!emp) {
        console.error('❌ Employee Attique Ur Rehman (00026) not found in:', uri);
        await mongoose.disconnect();
        continue;
      }

      console.log(`Found Employee: ${emp.firstName} ${emp.lastName} (ID: ${emp.employeeId}, ObjectId: ${emp._id})`);

      const adminUser = await User.findOne({ role: 'admin' }).select('_id');
      const createdById = adminUser ? adminUser._id : emp._id;

      // Build 43 schedule installments
      const schedule = [];
      let remainingBalance = 300000;
      const startDate = new Date(2024, 6, 1); // July 1, 2024

      for (let i = 1; i <= 43; i++) {
        const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + (i - 1), 1);
        const amount = (i === 43) ? 6000 : 7000;
        const principal = amount;
        const interest = 0;
        remainingBalance = Math.max(0, remainingBalance - principal);

        const isPaid = i <= 24;

        schedule.push({
          installmentNumber: i,
          dueDate: dueDate,
          amount: amount,
          principal: principal,
          interest: interest,
          balance: remainingBalance,
          status: isPaid ? 'Paid' : 'Pending',
          paidAmount: isPaid ? amount : 0,
          paymentDate: isPaid ? dueDate : undefined,
          paymentMethod: isPaid ? 'Salary Deduction' : undefined
        });
      }

      let loanDoc = await Loan.findOne({
        employee: emp._id,
        $or: [{ loanNumber: '02606' }, { loanAmount: 300000 }]
      });

      const loanPayload = {
        employee: emp._id,
        loanNumber: '02606',
        loanType: 'Personal',
        loanAmount: 300000,
        loanAdmissible: 300000,
        interestRate: 0,
        loanTerm: 43,
        monthlyInstallment: 7000,
        totalPayable: 300000,
        totalPaid: 168000,
        totalPrincipalPaid: 168000,
        totalInterestPaid: 0,
        outstandingBalance: 132000,
        status: 'Active',
        applicationDate: new Date('2024-07-01'),
        approvalDate: new Date('2024-07-01'),
        disbursementDate: new Date('2024-07-01'),
        purpose: 'Company Loan',
        emiManuallyAdjusted: true,
        loanSchedule: schedule,
        createdBy: createdById,
        updatedBy: createdById
      };

      if (loanDoc) {
        console.log(`Updating existing loan record (_id: ${loanDoc._id})...`);
        Object.assign(loanDoc, loanPayload);
        await loanDoc.save();
        console.log('✅ Loan record updated successfully!');
      } else {
        console.log('Creating new loan record...');
        loanDoc = await Loan.create(loanPayload);
        console.log(`✅ Loan record created successfully with _id: ${loanDoc._id}`);
      }

      console.log('--- Production Loan Summary ---');
      console.log(`Employee: ${emp.firstName} ${emp.lastName}`);
      console.log(`Loan Ref: ${loanDoc.loanNumber}`);
      console.log(`Loan Amount: PKR ${loanDoc.loanAmount}`);
      console.log(`Outstanding Balance: PKR ${loanDoc.outstandingBalance}`);
      console.log(`Paid Installments: ${loanDoc.loanSchedule.filter(s => s.status === 'Paid').length}`);
      console.log(`Pending Installments: ${loanDoc.loanSchedule.filter(s => s.status === 'Pending').length}`);

      await mongoose.disconnect();
    } catch (err) {
      console.error(`❌ Error updating DB ${uri}:`, err.message);
      try { await mongoose.disconnect(); } catch (e) {}
    }
  }
}

importLoan().then(() => {
  console.log('\n🎉 Production Loan Import Script Finished.');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
"""

    remote_file_path = f"{REPO}/server/scripts/_import_attique_prod.js"
    upload_text(ssh, remote_loan_script, remote_file_path)

    run(ssh, f"cd {REPO}/server && NODE_ENV=production node scripts/_import_attique_prod.js", "Import Attique Loan on Production Server")

    run(ssh, "cd /var/www/sgc-erp && pm2 restart sgc-erp-backend --update-env || pm2 restart all", "Restarting PM2 Production Service")

    run(ssh, f"rm -f {remote_file_path}", "Clean up temporary script")

    ssh.close()
    print("\n✅  All operations completed successfully!")

if __name__ == "__main__":
    main()
