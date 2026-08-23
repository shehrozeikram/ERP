const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Employee = require('../models/hr/Employee');
const LeaveBalance = require('../models/hr/LeaveBalance');

async function runDryRun() {
  console.log('🚀 Starting Dry-Run Leave Import Analysis...');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local');
    console.log('✅ Connected to MongoDB');

    const filePath = path.resolve(__dirname, '../../docs/Leave01.xlsx');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found at ${filePath}`);
    }

    console.log('📖 Reading Excel file...');
    const workbook = xlsx.readFile(filePath, { cellDates: true });
    const sheetName = workbook.SheetNames[1] || '20260725'; // Default to second sheet based on previous context
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error(`Sheet ${sheetName} not found!`);
    
    const rawData = xlsx.utils.sheet_to_json(sheet);
    console.log(`📊 Found ${rawData.length} rows in sheet ${sheetName}`);

    // Pre-fetch employees for mapping
    const employeesList = await Employee.find({ isDeleted: { $ne: true } })
      .select('_id employeeId biometricId firstName lastName department joiningDate hireDate createdAt leaveConfig');
      
    const empByIdMap = new Map();
    const empByNameMap = new Map();

    employeesList.forEach(emp => {
      if (emp.employeeId) empByIdMap.set(String(emp.employeeId).trim(), emp);
      if (emp.biometricId) empByIdMap.set(String(emp.biometricId).trim(), emp);
      const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim().toLowerCase();
      if (fullName) empByNameMap.set(fullName, emp);
      if (emp.firstName) empByNameMap.set(String(emp.firstName).trim().toLowerCase(), emp);
    });

    console.log(`✅ Loaded ${employeesList.length} active employees from DB`);

    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];
    const simulatedBalances = new Map();
    const missingEmployees = new Set();

    console.log('⚙️ Processing rows in memory...');

    for (let index = 0; index < rawData.length; index++) {
      const row = rawData[index];
      const rowNum = index + 2;

      const empIdInput = row['Employee ID'] !== undefined ? String(row['Employee ID']).trim() : null;
      const firstNameInput = row['First Name'] ? String(row['First Name']).trim() : '';
      const payCodeInput = row['Pay Code'] || 'Casual Leave';
      const startTimeRaw = row['Start Time'] || row['Start'];
      const endTimeRaw = row['End Time'] || row['End'];

      if (!startTimeRaw || !endTimeRaw) {
        skippedCount++;
        continue;
      }

      // Match Employee
      let employee = null;
      if (empIdInput && empByIdMap.has(empIdInput)) {
        employee = empByIdMap.get(empIdInput);
      } else if (firstNameInput && empByNameMap.has(firstNameInput.toLowerCase())) {
        employee = empByNameMap.get(firstNameInput.toLowerCase());
      }

      if (!employee) {
        skippedCount++;
        const identifier = empIdInput || firstNameInput;
        missingEmployees.add(identifier);
        if (errors.length < 50) {
          errors.push(`Row ${rowNum}: Employee "${identifier}" not found in system.`);
        }
        continue;
      }

      const startDate = new Date(startTimeRaw);
      const endDate = new Date(endTimeRaw);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        errorCount++;
        if (errors.length < 50) errors.push(`Row ${rowNum}: Invalid date format.`);
        continue;
      }

      // Calculate total days (using new exact logic)
      let totalDays = Number(row['No of Days '] || row['No of Days'] || row['Days']);
      if (!totalDays || isNaN(totalDays)) {
        const diffMs = Math.max(0, endDate.getTime() - startDate.getTime());
        totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
      }
      if (totalDays <= 0) totalDays = 1;

      // Warn for abnormally large leaves
      if (totalDays > 45 && errors.length < 50) {
        errors.push(`Row ${rowNum}: Abnormally large leave duration (${totalDays} days) for ${employee.firstName}.`);
      }

      // Calculate Work Year
      const joinDateObj = new Date(employee.joiningDate || employee.hireDate || employee.createdAt || '2023-01-01');
      const startYear = Math.max(2020, startDate.getFullYear());
      let workYearIndex = startYear - joinDateObj.getFullYear();
      const anniversaryThisYear = new Date(startYear, joinDateObj.getMonth(), joinDateObj.getDate());
      if (startDate < anniversaryThisYear) {
        workYearIndex -= 1;
      }
      workYearIndex = Math.max(0, workYearIndex);

      // Track aggregated used leaves per employee + workYear
      const balKey = `${employee._id.toString()}_wy_${workYearIndex}`;
      if (!simulatedBalances.has(balKey)) {
        const allocation = LeaveBalance.calculateAnniversaryAllocation(workYearIndex, employee.leaveConfig);
        simulatedBalances.set(balKey, {
          employee: employee,
          workYear: workYearIndex,
          annual: { used: 0, allocated: allocation.annual },
          sick: { used: 0, allocated: allocation.sick },
          casual: { used: 0, allocated: allocation.casual }
        });
      }

      const balance = simulatedBalances.get(balKey);
      const codeKey = String(payCodeInput).toUpperCase();
      
      if (codeKey.includes('ANNUAL') || codeKey === 'AL') {
        balance.annual.used += totalDays;
      } else if (codeKey.includes('SICK') || codeKey === 'SL' || codeKey.includes('MEDICAL')) {
        balance.sick.used += totalDays;
      } else {
        balance.casual.used += totalDays;
      }
    }

    // Post-processing analysis
    console.log('\n🔍 --- DRY RUN AUDIT REPORT --- 🔍');
    console.log(`Total Rows Analyzed: ${rawData.length}`);
    console.log(`Rows Skipped/Errors: ${skippedCount + errorCount}`);
    console.log(`Unique Missing Employees: ${missingEmployees.size}`);
    
    if (missingEmployees.size > 0) {
      console.log('⚠️ Sample Missing Employees (IDs/Names not found in DB):');
      console.log(Array.from(missingEmployees).slice(0, 10).join(', '));
    }

    let overdrawnCount = 0;
    const overdrawnExamples = [];

    // Analyze the simulated balances for limits
    for (const [balKey, balance] of simulatedBalances.entries()) {
      // For Annual, they could have carry forward, so checking against raw allocation might yield false positives,
      // but if it exceeds 40, it's definitely impossible (since 40 is max).
      if (balance.annual.used > 40 || balance.sick.used > 10 || balance.casual.used > 10) {
        overdrawnCount++;
        if (overdrawnExamples.length < 10) {
          overdrawnExamples.push(
            `${balance.employee.firstName} (Emp ${balance.employee.employeeId || '?'}) in WorkYear ${balance.workYear} ` +
            `used AL:${balance.annual.used}, SL:${balance.sick.used}, CL:${balance.casual.used}`
          );
        }
      }
    }

    if (overdrawnCount > 0) {
      console.log(`\n🚨 DANGER: Found ${overdrawnCount} instances where employees used more leaves than allowed in a single work year!`);
      console.log('⚠️ Examples:');
      overdrawnExamples.forEach(e => console.log('  - ' + e));
      console.log('Note: Annual leave limits assume max 40 (20 allocated + 20 carry forward). Sick/Casual cap is 10.');
    } else {
      console.log('\n✅ NO SEVERE OVERDRAWN BALANCES DETECTED.');
    }

    if (errors.length > 0) {
      console.log('\n⚠️ Sample Row Errors:');
      errors.slice(0, 15).forEach(e => console.log('  - ' + e));
    }

    console.log('\n✅ Dry-Run Completed. No data was modified.');

  } catch (error) {
    console.error('❌ Dry-Run Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

runDryRun();
