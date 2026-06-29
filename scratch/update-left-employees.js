const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../server/.env') });

// Load Employee model
const Employee = require('../server/models/hr/Employee');

const run = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('Connected to database.');

    const filePath = path.join(__dirname, '../docs/Left Employees Jan 2026 to June 2026.xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    let currentMonthStr = null;
    let validRows = [];

    // Parse Excel
    for (let row of data) {
      if (row.length === 1 && typeof row[0] === 'string' && row[0].startsWith('Left Employees ')) {
        currentMonthStr = row[0].replace('Left Employees ', '').trim();
      }
      
      // Valid row starts with a number in column 0 (Sr No) and has an ID in column 1
      if (typeof row[0] === 'number' && row[1]) {
        validRows.push({
          monthGroup: currentMonthStr,
          srNo: row[0],
          employeeId: row[1],
          name: row[2],
          remarks: row[7] || ''
        });
      }
    }

    console.log(`Found ${validRows.length} valid leavers in Excel.`);

    let updatedCount = 0;
    let notFoundCount = 0;

    for (const record of validRows) {
      const emp = await Employee.findOne({ employeeId: String(record.employeeId).trim() });
      if (!emp) {
        // console.log(`Employee not found: ID ${record.employeeId} - ${record.name}`);
        notFoundCount++;
        continue;
      }

      // Calculate exact termination date (last day of the month)
      // Example monthGroup: "June 2025"
      let terminationDate = null;
      if (record.monthGroup) {
        const dateStr = `1 ${record.monthGroup}`; // "1 June 2025"
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          // Move to next month, day 0 (which is last day of current month)
          terminationDate = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        }
      }

      // Map remarks to employment status
      const remarksLower = record.remarks.toLowerCase();
      let newStatus = 'Terminated';
      if (remarksLower.includes('resign')) {
        newStatus = 'Resigned';
      }

      // Update employee
      emp.employmentStatus = newStatus;
      emp.isActive = false;
      if (terminationDate) {
        emp.terminationDate = terminationDate;
      }
      emp.terminationReason = record.remarks;
      
      await emp.save();
      updatedCount++;
    }

    console.log(`\nUpdate Complete!`);
    console.log(`- Successfully updated: ${updatedCount}`);
    console.log(`- Employees not found in DB (skipped): ${notFoundCount}`);
    console.log(`- Total processed: ${validRows.length}`);

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    mongoose.connection.close();
  }
};

run();
