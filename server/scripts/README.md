# Payroll Cleanup Scripts

This directory contains scripts to safely remove all payroll records from the SGC ERP system.

## ⚠️ WARNING

**These scripts will permanently delete ALL payroll records from your database. This action cannot be undone.**

**Always create a backup before running these scripts.**

## 📁 Available Scripts

### 1. `clear-all-payrolls.js` (Auto-confirm)
- **Purpose**: Removes all payroll records with automatic confirmation
- **Use Case**: For automated/CI environments or when you're absolutely sure
- **Risk Level**: HIGH (no user confirmation)

### 2. `clear-all-payrolls-safe.js` (Interactive)
- **Purpose**: Removes all payroll records with multiple user confirmations
- **Use Case**: For manual cleanup when you want to be extra careful
- **Risk Level**: MEDIUM (requires user confirmation)

### 3. `run-clear-payrolls.bat` (Windows)
- **Purpose**: Windows batch file to run the safe cleanup script
- **Use Case**: Easy execution on Windows systems

### 4. `run-clear-payrolls.sh` (Unix/Linux/Mac)
- **Purpose**: Unix shell script to run the safe cleanup script
- **Use Case**: Easy execution on Unix-based systems

## 🚀 How to Use

### Option 1: Direct Node.js Execution
```bash
# Navigate to the scripts directory
cd server/scripts

# Run the safe version (recommended)
node clear-all-payrolls-safe.js

# Or run the auto-confirm version
node clear-all-payrolls.js
```

### Option 2: Using Batch/Shell Scripts
```bash
# On Windows
run-clear-payrolls.bat

# On Unix/Linux/Mac
./run-clear-payrolls.sh
```

## 🔒 Safety Features

The **safe version** (`clear-all-payrolls-safe.js`) includes:

1. **First Confirmation**: "Are you sure you want to continue? (yes/no)"
2. **Second Confirmation**: Type the exact number of payrolls to confirm count
3. **Final Confirmation**: Type "DELETE" to proceed
4. **Sample Preview**: Shows first 5 payrolls that will be deleted
5. **Count Verification**: Shows total count before and after deletion

## 📊 What the Script Does

1. Connects to MongoDB database
2. Counts total payroll records
3. Shows sample payrolls for verification
4. Requests user confirmation (safe version only)
5. Deletes all payroll records
6. Verifies deletion was successful
7. Provides summary report
8. Closes database connection

## 🛡️ Safety Recommendations

1. **Always backup your database first**
2. **Test on a development/staging environment first**
3. **Use the safe version for production systems**
4. **Verify the script output before proceeding**
5. **Have a rollback plan ready**

## 🔧 Prerequisites

- Node.js installed
- MongoDB connection string in `.env` file
- Proper database permissions
- Access to the server/scripts directory

## 📝 Environment Variables

Make sure your `.env` file contains:
```env
MONGODB_URI=mongodb://localhost:27017/sgc_erp
```

## 🚨 Emergency Stop

If you need to stop the script:
- Press `Ctrl+C` to interrupt execution
- The script will safely close database connections

## 📞 Support

If you encounter issues:
1. Check the console output for error messages
2. Verify database connectivity
3. Ensure proper permissions
4. Check the script logs for details
