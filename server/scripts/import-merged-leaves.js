require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const LeaveRequest = require('../models/hr/LeaveRequest');
const Employee = require('../models/hr/Employee');
const LeaveType = require('../models/hr/LeaveType');
const User = require('../models/User');

function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  const dateOnly = dateStr.split(' ')[0];
  const parts = dateOnly.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

function parseDateTime(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) return new Date(dateStr);
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

async function importLeaves() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Delete all existing leave requests
    console.log('🗑️  Deleting all existing leave requests...');
    const deleteResult = await LeaveRequest.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} records\n`);

    // Read CSV
    const csvPath = path.join(__dirname, 'merged-leave-data.csv');
    console.log('📂 Reading CSV file...');
    const csvData = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => csvData.push(row))
        .on('end', resolve)
        .on('error', reject);
    });
    console.log(`✅ Found ${csvData.length} records\n`);

    // Load leave types
    const leaveTypes = await LeaveType.find({});
    const leaveTypeMap = {};
    leaveTypes.forEach(lt => {
      leaveTypeMap[lt.code?.toUpperCase()] = lt._id;
      leaveTypeMap[lt.name?.toUpperCase()] = lt._id;
    });

    // Create missing leave types
    const typesToCreate = {
      'CASUAL': { code: 'CL', name: 'Casual', days: 10, color: '#10B981' },
      'ANNUAL': { code: 'AL', name: 'Annual', days: 20, color: '#3B82F6' },
      'SICK': { code: 'SL', name: 'Sick', days: 10, color: '#EF4444' },
      'MEDICAL': { code: 'ML', name: 'Medical', days: 10, color: '#EF4444' },
      'COMPENSATORY': { code: 'CO', name: 'Compensatory', days: 0, color: '#F59E0B' },
      'COMPASSIONATE': { code: 'CP', name: 'Compassionate', days: 5, color: '#8B5CF6' },
      'BUSINESS TRIP': { code: 'BT', name: 'Business Trip', days: 0, color: '#6366F1' }
    };

    for (const [key, config] of Object.entries(typesToCreate)) {
      if (!leaveTypeMap[key] && !leaveTypeMap[config.code]) {
        const lt = new LeaveType({
          name: config.name,
          code: config.code,
          description: `${config.name} Leave`,
          daysPerYear: config.days,
          isPaid: true,
          requiresApproval: true,
          isActive: true,
          color: config.color
        });
        await lt.save();
        leaveTypeMap[key] = lt._id;
        leaveTypeMap[config.code] = lt._id;
      }
    }

    // Get default user
    const defaultUser = await User.findOne({ role: 'super_admin' }) || await User.findOne();
    if (!defaultUser) throw new Error('No user found');

    // Process records
    console.log('📊 Importing records...\n');
    let created = 0;
    let errors = 0;
    const employeeCache = {};

    for (let i = 0; i < csvData.length; i++) {
      try {
        const row = csvData[i];
        const employeeId = row['Employee ID']?.trim();
        if (!employeeId) {
          errors++;
          continue;
        }

        // Get employee
        let employee = employeeCache[employeeId];
        if (!employee) {
          employee = await Employee.findOne({ employeeId });
          if (!employee) {
            errors++;
            continue;
          }
          employeeCache[employeeId] = employee;
        }

        const hireDate = employee.hireDate || employee.joiningDate;
        if (!hireDate) {
          errors++;
          continue;
        }

        // Parse dates
        const startDate = parseDate(row['Start Date']);
        const endDate = parseDate(row['End Date']);
        if (!startDate || !endDate) {
          errors++;
          continue;
        }

        // Get leave type
        const leaveTypeName = row['Leave Type']?.toUpperCase().trim();
        let leaveTypeId = leaveTypeMap[leaveTypeName];
        if (!leaveTypeId) {
          // Map variations
          if (leaveTypeName.includes('COMPENSATORY')) leaveTypeId = leaveTypeMap['COMPENSATORY'];
          else if (leaveTypeName.includes('COMPASSIONATE')) leaveTypeId = leaveTypeMap['COMPASSIONATE'];
          else if (leaveTypeName.includes('BUSINESS')) leaveTypeId = leaveTypeMap['BUSINESS TRIP'];
          else if (leaveTypeName.includes('CASUAL')) leaveTypeId = leaveTypeMap['CASUAL'];
          else if (leaveTypeName.includes('ANNUAL')) leaveTypeId = leaveTypeMap['ANNUAL'];
          else if (leaveTypeName.includes('SICK')) leaveTypeId = leaveTypeMap['SICK'];
          else if (leaveTypeName.includes('MEDICAL')) leaveTypeId = leaveTypeMap['MEDICAL'];
        }

        if (!leaveTypeId) {
          errors++;
          continue;
        }

        // Calculate workYear
        const hireDateObj = new Date(hireDate);
        const hireYear = hireDateObj.getFullYear();
        const hireMonth = hireDateObj.getMonth();
        const hireDay = hireDateObj.getDate();
        const leaveStartYear = startDate.getFullYear();
        const leaveStartMonth = startDate.getMonth();
        const leaveStartDay = startDate.getDate();
        let yearsDiff = leaveStartYear - hireYear;
        if (leaveStartMonth < hireMonth || (leaveStartMonth === hireMonth && leaveStartDay < hireDay)) {
          yearsDiff--;
        }
        const workYear = Math.max(0, yearsDiff);
        const leaveYear = Math.max(hireYear + 1, hireYear + workYear + 1);

        // Check for duplicate before creating
        const existingLeave = await LeaveRequest.findOne({
          employee: employee._id,
          leaveType: leaveTypeId,
          startDate: startDate,
          endDate: endDate
        });

        if (existingLeave) {
          continue; // Skip duplicate
        }

        // Create leave request
        const leaveRequest = new LeaveRequest({
          employee: employee._id,
          leaveType: leaveTypeId,
          startDate: startDate,
          endDate: endDate,
          totalDays: parseFloat(row['Duration (Days)']) || 0,
          reason: row['Reason']?.trim() || 'Historical leave record',
          status: 'approved',
          appliedDate: parseDateTime(row['Enter Date']) || startDate || new Date(),
          approvedDate: parseDateTime(row['Enter Date']) || startDate || new Date(),
          approvedBy: defaultUser._id,
          leaveYear: leaveYear,
          workYear: workYear,
          createdBy: defaultUser._id,
          isActive: true
        });

        await leaveRequest.save();
        created++;

        if (created % 500 === 0) {
          console.log(`   Progress: ${created}/${csvData.length} (${((created / csvData.length) * 100).toFixed(1)}%)`);
        }
      } catch (error) {
        errors++;
      }
    }

    console.log(`\n✅ Import completed!`);
    console.log(`   Created: ${created}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total: ${csvData.length}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  importLeaves()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { importLeaves };
