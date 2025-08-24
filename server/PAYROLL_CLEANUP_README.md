# Payroll Cleanup Scripts

This directory contains scripts to safely remove all payroll and payslip records from the cloud database.

## ⚠️  IMPORTANT WARNING

**These scripts will permanently delete ALL payroll and payslip data from your cloud database. This operation cannot be undone!**

## 📋 What Will Be Deleted

- **Payroll Records**: All monthly payroll calculations including:
  - Basic salary information
  - Allowances (conveyance, food, vehicle fuel, medical, special, other)
  - House rent allowances
  - Tax calculations
  - Loan deductions
  - Overtime and bonus calculations

- **Payslip Records**: All employee payslips including:
  - Salary breakdowns
  - Deductions
  - Net pay calculations
  - Issue dates and payslip numbers

## 🚀 How to Use

### Step 1: Preview What Will Be Deleted

First, run the preview script to see exactly what records exist:

```bash
cd server
node preview-cloud-payrolls.js
```

This will show you:
- Total count of records
- Breakdown by month/year
- Sample records
- Financial summary
- What will be affected

### Step 2: Backup (Recommended)

Before proceeding, ensure you have:
- Database backups
- Exported data if needed
- Confirmation from stakeholders

### Step 3: Run the Deletion Script

**⚠️  CRITICAL: Edit the script first to enable deletion**

1. Open `clear-all-cloud-payrolls.js`
2. Find the line: `const confirmDeletion = false;`
3. Change it to: `const confirmDeletion = true;`
4. Save the file

Then run:

```bash
cd server
node clear-all-cloud-payrolls.js
```

## 🔒 Safety Features

The deletion script includes several safety measures:

1. **Confirmation Required**: Must manually set `confirmDeletion = true`
2. **Preview First**: Shows exactly what will be deleted
3. **Verification**: Confirms deletion was successful
4. **Error Handling**: Graceful error handling and rollback
5. **Logging**: Detailed logs of all operations

## 📊 Script Output

The scripts provide detailed output including:

- Connection status
- Record counts
- Sample data
- Deletion progress
- Verification results
- Timing information
- Error details (if any)

## 🛠️  Technical Details

### Models Affected
- `Payroll` - Monthly payroll calculations
- `Payslip` - Employee payslip records

### Deletion Order
1. Payslips are deleted first (they reference payroll data)
2. Payroll records are deleted second
3. Verification is performed on both

### Database Connection
- Uses the same connection configuration as your main application
- Connects to the cloud MongoDB Atlas database
- Proper connection cleanup and error handling

## 🚨 Recovery

**If you need to recover deleted data:**

1. **Database Backups**: Restore from your MongoDB Atlas backups
2. **Point-in-Time Recovery**: Use MongoDB Atlas point-in-time recovery if enabled
3. **Manual Recreation**: Recreate payroll records from source data

## 📞 Support

If you encounter any issues:

1. Check the console output for error messages
2. Verify your database connection settings
3. Ensure you have proper permissions
4. Check MongoDB Atlas logs if needed

## 🔄 Re-running

After deletion, you can:
- Run the preview script again to confirm all records are gone
- Start fresh with new payroll calculations
- Import data from other sources if needed

---

**Remember: This is a destructive operation. Use with extreme caution and only when you are absolutely certain you want to remove all payroll data.**
