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

async function importFirstEmployeeLeaves() {
  try {
    console.log('🔄 Starting import of leave data for first employee...\n');
    
    // Connect to MongoDB (cloud database)
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp');
    console.log('✅ Connected to MongoDB\n');
    
    // Read CSV file
    const csvPath = path.join(__dirname, 'leave-data-formatted.csv');
    console.log(`📂 Reading CSV file: ${csvPath}\n`);
    
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
    
    console.log(`📊 Found ${csvData.length} records in CSV file\n`);
    
    if (csvData.length === 0) {
      console.log('⚠️  No data found in CSV file');
      return;
    }
    
    // Get first employee's data
    const firstEmployeeRow = csvData[0];
    const firstEmployeeId = firstEmployeeRow['Employee ID'].trim();
    const firstEmployeeName = firstEmployeeRow['Employee Name'].trim();
    
    console.log(`👤 First Employee:`);
    console.log(`   Name: ${firstEmployeeName}`);
    console.log(`   ID: ${firstEmployeeId}\n`);
    
    // Find all leaves for this employee in CSV
    const employeeLeaves = csvData.filter(row => 
      row['Employee ID'].trim() === firstEmployeeId
    );
    
    console.log(`📋 Found ${employeeLeaves.length} leave records for ${firstEmployeeName}\n`);
    
    if (employeeLeaves.length === 0) {
      console.log('⚠️  No leave records found for first employee');
      return;
    }
    
    // Find or get employee
    let employee = await Employee.findOne({ 
      employeeId: firstEmployeeId 
    });
    
    if (!employee) {
      console.log(`⚠️  Employee not found with ID: ${firstEmployeeId}`);
      console.log('🔍 Searching by name...');
      
      // Try to find by name
      const firstName = firstEmployeeName.split(' ')[0];
      employee = await Employee.findOne({
        firstName: { $regex: new RegExp(`^${firstName}$`, 'i') }
      });
      
      if (!employee) {
        console.log(`❌ Employee not found. Please create employee first or check employee ID.`);
        return;
      }
      
      console.log(`✅ Found employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.employeeId})\n`);
    } else {
      console.log(`✅ Found employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.employeeId})\n`);
    }
    
    // Show employee's joining date
    const hireDate = employee.hireDate || employee.joiningDate;
    if (hireDate) {
      const hireDateObj = new Date(hireDate);
      console.log(`📅 Employee Joining Date: ${hireDateObj.toLocaleDateString()}`);
      console.log(`   (Leaves will be assigned to work years based on anniversary periods)\n`);
    } else {
      console.log(`⚠️  Warning: Employee does not have a joining date. Using calendar year for leaveYear.\n`);
    }
    
    // Delete existing leaves for this employee
    console.log(`🗑️  Deleting existing leaves for ${employee.firstName} ${employee.lastName}...`);
    const deleteResult = await LeaveRequest.deleteMany({ 
      employee: employee._id 
    });
    console.log(`✅ Deleted ${deleteResult.deletedCount} existing leave records\n`);
    
    // Get system user for createdBy field
    let systemUser = await User.findOne({ role: 'admin' });
    if (!systemUser) {
      systemUser = await User.findOne();
    }
    if (!systemUser) {
      systemUser = { _id: new mongoose.Types.ObjectId() };
    }
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const errorRecords = [];
    
    console.log(`🔄 Importing ${employeeLeaves.length} leave records...\n`);
    
    // Process each leave record
    for (let i = 0; i < employeeLeaves.length; i++) {
      const row = employeeLeaves[i];
      
      try {
        // Parse leave type
        const leaveTypeName = row['Leave Type'].trim();
        
        // Find or create leave type
        let leaveType = await LeaveType.findOne({ 
          $or: [
            { name: { $regex: new RegExp(`^${leaveTypeName}$`, 'i') } },
            { code: { $regex: new RegExp(`^${leaveTypeName}$`, 'i') } }
          ]
        });
        
        if (!leaveType) {
          console.log(`📝 Creating leave type: ${leaveTypeName}`);
          leaveType = new LeaveType({
            name: leaveTypeName,
            code: leaveTypeName.toUpperCase().replace(/\s+/g, '_'),
            description: `${leaveTypeName} Leave`,
            daysPerYear: leaveTypeName.toLowerCase() === 'annual' ? 20 : 10,
            color: leaveTypeName.toLowerCase() === 'annual' ? '#4CAF50' : '#2196F3',
            isActive: true
          });
          await leaveType.save();
        }
        
        // Parse dates
        const startDate = parseDate(row['Start Date']);
        const endDate = parseDateTime(row['End Date']) || parseDate(row['End Date']);
        const appliedDate = parseDateTime(row['Enter Date']) || parseDate(row['Enter Date']) || startDate;
        
        if (!startDate || !endDate) {
          console.log(`⚠️  Skipping record ${i + 1}: Invalid dates`);
          skipped++;
          continue;
        }
        
        // Parse duration
        const duration = parseFloat(row['Duration (Days)']) || 0;
        if (duration <= 0) {
          console.log(`⚠️  Skipping record ${i + 1}: Invalid duration`);
          skipped++;
          continue;
        }
        
        // Calculate workYear and leaveYear based on employee's joining date (anniversary-based)
        // Leave year system should be based on anniversary periods, not calendar year
        // Example: Employee joins Nov 01, 2023
        //   Work Year 0: Nov 01, 2023 - Nov 01, 2024 (leaveYear = 2024, the anniversary year)
        //   Work Year 1: Nov 01, 2024 - Nov 01, 2025 (leaveYear = 2025, the anniversary year)
        //   Work Year 2: Nov 01, 2025 - Nov 01, 2026 (leaveYear = 2026, the anniversary year)
        //
        // Rule: leaveYear = the calendar year when the work year period ends (anniversary year)
        
        let workYear = 0;
        let leaveYear = new Date(startDate).getFullYear(); // Default to calendar year if no hire date
        const hireDate = employee.hireDate || employee.joiningDate;
        
        if (hireDate) {
          const hireDateObj = new Date(hireDate);
          const hireYear = hireDateObj.getFullYear();
          const hireMonth = hireDateObj.getMonth();
          const hireDay = hireDateObj.getDate();
          
          const leaveStartYear = startDate.getFullYear();
          const leaveStartMonth = startDate.getMonth();
          const leaveStartDay = startDate.getDate();
          
          // Calculate which work year period this leave falls into
          // Compare leave date with anniversary dates
          let yearsDiff = leaveStartYear - hireYear;
          
          // Check if leave is before the anniversary date in the calculated year
          if (leaveStartMonth < hireMonth || 
              (leaveStartMonth === hireMonth && leaveStartDay < hireDay)) {
            // Leave is before anniversary, so it belongs to the previous work year
            yearsDiff = yearsDiff - 1;
          }
          
          // Ensure workYear is not negative
          workYear = Math.max(0, yearsDiff);
          
          // Calculate leaveYear: the calendar year when this work year's anniversary occurs
          // This is the year marking the end of the work year period
          // Work Year 0: Nov 01, 2023 - Nov 01, 2024 -> leaveYear = 2024
          // Work Year 1: Nov 01, 2024 - Nov 01, 2025 -> leaveYear = 2025
          // Formula: leaveYear = hireYear + workYear + 1
          leaveYear = hireYear + workYear + 1;
          
          // Ensure leaveYear is not before hire year
          leaveYear = Math.max(leaveYear, hireYear + 1);
          
          // Log calculation for debugging (only for first few records)
          if (i < 3) {
            const anniversaryDate = new Date(hireYear + workYear + 1, hireMonth, hireDay);
            console.log(`   📅 Record ${i + 1}: Leave ${startDate.toLocaleDateString()} -> Work Year ${workYear} (${hireDateObj.toLocaleDateString()} - ${anniversaryDate.toLocaleDateString()}), Leave Year ${leaveYear}`);
          }
        }
        
        // Parse reason
        const reason = row['Reason']?.trim() || `Historical leave record - ${leaveTypeName}`;
        
        // Create leave request
        const leaveRequest = new LeaveRequest({
          employee: employee._id,
          leaveType: leaveType._id,
          startDate: startDate,
          endDate: endDate,
          totalDays: duration,
          reason: reason,
          status: 'approved', // Historical leaves are already approved
          appliedDate: appliedDate,
          approvedDate: appliedDate,
          approvedBy: systemUser._id,
          approvalComments: 'Imported historical data',
          leaveYear: leaveYear, // Use calculated anniversary-based year, not CSV year
          workYear: workYear,
          createdBy: systemUser._id,
          isActive: true
        });
        
        await leaveRequest.save();
        imported++;
        
        if (imported % 10 === 0) {
          console.log(`   ✅ Imported ${imported}/${employeeLeaves.length} records...`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error importing record ${i + 1}:`, error.message);
        errors++;
        errorRecords.push({
          row: i + 1,
          employee: firstEmployeeName,
          error: error.message
        });
      }
    }
    
    console.log('\n📊 Import Summary:');
    console.log(`✅ Imported: ${imported}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📈 Total processed: ${imported + skipped + errors}`);
    
    if (errorRecords.length > 0) {
      console.log('\n❌ Error Records:');
      errorRecords.forEach(err => {
        console.log(`   Row ${err.row}: ${err.error}`);
      });
    }
    
    // Verify import
    console.log('\n🔍 Verifying import...');
    const importedCount = await LeaveRequest.countDocuments({ 
      employee: employee._id,
      isActive: true 
    });
    console.log(`✅ Found ${importedCount} leave records for ${employee.firstName} ${employee.lastName}`);
    
    // Show sample records with workYear and leaveYear info
    const sampleLeaves = await LeaveRequest.find({ 
      employee: employee._id,
      isActive: true 
    })
    .populate('leaveType', 'name')
    .sort({ startDate: 1 })
    .limit(5);
    
    console.log('\n📋 Sample imported records (with Work Year & Leave Year):');
    sampleLeaves.forEach((leave, idx) => {
      console.log(`   ${idx + 1}. ${leave.startDate.toLocaleDateString()} - ${leave.endDate.toLocaleDateString()} | ${leave.leaveType?.name} | ${leave.totalDays} days | Work Year: ${leave.workYear} | Leave Year: ${leave.leaveYear}`);
    });
    
    // Show breakdown by work year
    const workYearBreakdown = await LeaveRequest.aggregate([
      { $match: { employee: employee._id, isActive: true } },
      { $group: { _id: '$workYear', count: { $sum: 1 }, leaveYears: { $addToSet: '$leaveYear' } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log('\n📊 Breakdown by Work Year:');
    workYearBreakdown.forEach(item => {
      console.log(`   Work Year ${item._id}: ${item.count} leaves (Leave Years: ${item.leaveYears.sort().join(', ')})`);
    });
    
    console.log('\n✅ Import completed successfully!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the import
if (require.main === module) {
  importFirstEmployeeLeaves()
    .then(() => {
      console.log('\n✨ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { importFirstEmployeeLeaves };

