const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Import models
const LeaveRequest = require('../models/hr/LeaveRequest');
const Employee = require('../models/hr/Employee');
const LeaveType = require('../models/hr/LeaveType');
const User = require('../models/User');

// Load environment variables
require('dotenv').config();

/**
 * Parse date from DD/MM/YYYY format or DD/MM/YYYY HH:MM:SS format
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // Remove time part if present (e.g., "29/01/2024 23:59:00" -> "29/01/2024")
  const dateOnly = dateStr.split(' ')[0];
  const parts = dateOnly.split('/');
  
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
  const year = parseInt(parts[2], 10);
  
  return new Date(year, month, day);
}

/**
 * Parse date with time from DD/MM/YYYY HH:MM:SS format
 */
function parseDateTime(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  
  const parts = dateStr.split(' ');
  const datePart = parts[0];
  const timePart = parts[1] || '00:00:00';
  
  const dateParts = datePart.split('/');
  if (dateParts.length !== 3) return null;
  
  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const year = parseInt(dateParts[2], 10);
  
  const timeParts = timePart.split(':');
  const hours = parseInt(timeParts[0] || 0, 10);
  const minutes = parseInt(timeParts[1] || 0, 10);
  const seconds = parseInt(timeParts[2] || 0, 10);
  
  return new Date(year, month, day, hours, minutes, seconds);
}

async function importAllLeavesFromCSV() {
  try {
    console.log('🔄 Starting import of all leave data from CSV...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp');
    console.log('✅ Connected to MongoDB\n');
    
    // Step 1: Delete all existing leave requests
    console.log('🗑️  Step 1: Deleting all existing leave requests...\n');
    const deleteResult = await LeaveRequest.deleteMany({});
    console.log(`   ✅ Deleted ${deleteResult.deletedCount} existing leave requests\n`);
    
    // Step 2: Read CSV file
    const csvPath = path.join(__dirname, 'leave-data-formatted.csv');
    console.log(`📂 Step 2: Reading CSV file: ${csvPath}\n`);
    
    const csvData = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          csvData.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`   ✅ Found ${csvData.length} records in CSV file\n`);
    
    if (csvData.length === 0) {
      console.log('⚠️  No data found in CSV file');
      return;
    }
    
    // Step 3: Get all leave types
    console.log('📋 Step 3: Loading leave types...\n');
    const leaveTypes = await LeaveType.find({});
    const leaveTypeMap = {};
    leaveTypes.forEach(lt => {
      const code = lt.code?.toUpperCase();
      const name = lt.name?.toUpperCase();
      if (code) leaveTypeMap[code] = lt._id;
      if (name) leaveTypeMap[name] = lt._id;
    });
    
    console.log(`   ✅ Loaded ${leaveTypes.length} leave types\n`);
    
    // Step 4: Get a default user for createdBy (or find admin user)
    let defaultUser = await User.findOne({ role: 'super_admin' }) || await User.findOne();
    if (!defaultUser) {
      throw new Error('No user found in database. Please create at least one user.');
    }
    console.log(`   ✅ Using user: ${defaultUser.email || defaultUser._id} for createdBy\n`);
    
    // Step 5: Process all employees
    console.log('📊 Step 4: Processing leave records...\n');
    
    // Group by employee ID
    const employeeLeavesMap = {};
    csvData.forEach(row => {
      const empId = row['Employee ID']?.trim();
      if (empId) {
        if (!employeeLeavesMap[empId]) {
          employeeLeavesMap[empId] = [];
        }
        employeeLeavesMap[empId].push(row);
      }
    });
    
    console.log(`   📋 Found ${Object.keys(employeeLeavesMap).length} unique employees\n`);
    
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalErrors = 0;
    const errors = [];
    
    // Process each employee
    for (const [employeeId, leaves] of Object.entries(employeeLeavesMap)) {
      try {
        // Find employee
        const employee = await Employee.findOne({ employeeId: employeeId });
        
        if (!employee) {
          console.log(`   ⚠️  Employee ID ${employeeId} not found, skipping ${leaves.length} leaves`);
          totalErrors += leaves.length;
          errors.push(`Employee ${employeeId}: Not found (${leaves.length} leaves skipped)`);
          continue;
        }
        
        const hireDate = employee.hireDate || employee.joiningDate;
        if (!hireDate) {
          console.log(`   ⚠️  Employee ${employeeId} has no hire date, skipping ${leaves.length} leaves`);
          totalErrors += leaves.length;
          errors.push(`Employee ${employeeId}: No hire date (${leaves.length} leaves skipped)`);
          continue;
        }
        
        const hireDateObj = new Date(hireDate);
        const hireYear = hireDateObj.getFullYear();
        const hireMonth = hireDateObj.getMonth();
        const hireDay = hireDateObj.getDate();
        
        // Process each leave for this employee
        for (const leaveRow of leaves) {
          try {
            const startDate = parseDate(leaveRow['Start Date']);
            const endDate = parseDateTime(leaveRow['End Date']);
            const leaveTypeName = leaveRow['Leave Type']?.trim();
            const reason = leaveRow['Reason']?.trim() || 'Historical leave record';
            const appliedDate = parseDateTime(leaveRow['Enter Date']) || new Date();
            const durationDays = parseFloat(leaveRow['Duration (Days)']) || 0;
            
            if (!startDate || !endDate) {
              console.log(`   ⚠️  Invalid dates for employee ${employeeId}, skipping`);
              totalErrors++;
              continue;
            }
            
            // Find leave type
            const leaveTypeId = leaveTypeMap[leaveTypeName?.toUpperCase()];
            if (!leaveTypeId) {
              console.log(`   ⚠️  Leave type "${leaveTypeName}" not found for employee ${employeeId}, skipping`);
              totalErrors++;
              continue;
            }
            
            // Calculate workYear and leaveYear based on anniversary
            const leaveStartYear = startDate.getFullYear();
            const leaveStartMonth = startDate.getMonth();
            const leaveStartDay = startDate.getDate();
            
            // Calculate which work year period this leave falls into
            let yearsDiff = leaveStartYear - hireYear;
            
            // Check if leave is before the anniversary date in the calculated year
            if (leaveStartMonth < hireMonth || 
                (leaveStartMonth === hireMonth && leaveStartDay < hireDay)) {
              // Leave is before anniversary, so it belongs to the previous work year
              yearsDiff = yearsDiff - 1;
            }
            
            // Ensure workYear is not negative
            const workYear = Math.max(0, yearsDiff);
            
            // Calculate leaveYear: the calendar year when this work year's anniversary occurs
            // Work Year 0: Nov 01, 2023 - Nov 01, 2024 -> leaveYear = 2024
            // Work Year 1: Nov 01, 2024 - Nov 01, 2025 -> leaveYear = 2025
            // Formula: leaveYear = hireYear + workYear + 1
            let leaveYear = hireYear + workYear + 1;
            leaveYear = Math.max(leaveYear, hireYear + 1);
            
            // Create leave request
            const leaveRequest = new LeaveRequest({
              employee: employee._id,
              leaveType: leaveTypeId,
              startDate: startDate,
              endDate: endDate,
              totalDays: durationDays || 0,
              reason: reason,
              status: 'approved', // Historical records are approved
              appliedDate: appliedDate,
              approvedDate: appliedDate,
              approvedBy: defaultUser._id,
              leaveYear: leaveYear,
              workYear: workYear,
              createdBy: defaultUser._id,
              isActive: true
            });
            
            await leaveRequest.save();
            totalCreated++;
            
          } catch (error) {
            console.log(`   ⚠️  Error processing leave for employee ${employeeId}: ${error.message}`);
            totalErrors++;
            errors.push(`Employee ${employeeId}: ${error.message}`);
          }
        }
        
        totalProcessed += leaves.length;
        
        // Show progress every 100 employees
        if (totalProcessed % 100 === 0) {
          console.log(`   📊 Progress: ${totalProcessed} leaves processed, ${totalCreated} created, ${totalErrors} errors`);
        }
        
      } catch (error) {
        console.log(`   ⚠️  Error processing employee ${employeeId}: ${error.message}`);
        totalErrors += leaves.length;
        errors.push(`Employee ${employeeId}: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 IMPORT SUMMARY:\n');
    console.log(`   Total Records Processed: ${totalProcessed}`);
    console.log(`   Successfully Created: ${totalCreated}`);
    console.log(`   Errors: ${totalErrors}`);
    console.log(`   Success Rate: ${((totalCreated / totalProcessed) * 100).toFixed(1)}%\n`);
    
    if (errors.length > 0 && errors.length <= 20) {
      console.log('⚠️  Errors:\n');
      errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err}`);
      });
    } else if (errors.length > 20) {
      console.log(`⚠️  ${errors.length} errors occurred (showing first 20):\n`);
      errors.slice(0, 20).forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err}`);
      });
    }
    
    console.log('='.repeat(80));
    console.log('✅ Import completed!\n');
    
    // Step 6: Sync balances after import
    console.log('🔄 Step 5: Syncing leave balances...\n');
    const { fixAndVerifyAllEmployees } = require('./fix-verify-all-employees-leaves');
    await fixAndVerifyAllEmployees();
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run import
if (require.main === module) {
  importAllLeavesFromCSV()
    .then(() => {
      console.log('\n✨ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { importAllLeavesFromCSV };

