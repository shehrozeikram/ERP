const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/database');
require('dotenv').config();

// Connect to MongoDB
connectDB()
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const Payroll = require('../models/hr/Payroll');

async function testPayrollData() {
  try {
    console.log('🔍 Testing Payroll Data Structure...\n');

    // Get all payrolls
    const payrolls = await Payroll.find()
      .populate('employee', 'firstName lastName employeeId')
      .sort({ createdAt: -1 })
      .limit(5);

    console.log(`📊 Found ${payrolls.length} payrolls:\n`);

    payrolls.forEach((payroll, index) => {
      console.log(`--- Payroll ${index + 1} ---`);
      console.log(`ID: ${payroll._id}`);
      console.log(`Employee: ${payroll.employee?.firstName} ${payroll.employee?.lastName}`);
      console.log(`Status: "${payroll.status}"`);
      console.log(`Month/Year: ${payroll.month}/${payroll.year}`);
      console.log(`Gross Salary: ${payroll.grossSalary}`);
      console.log(`Net Salary: ${payroll.netSalary}`);
      console.log(`EOBI: ${payroll.eobi}`);
      console.log(`Total Deductions: ${payroll.totalDeductions}`);
      console.log(`Created At: ${payroll.createdAt}`);
      console.log(`Updated At: ${payroll.updatedAt}`);
      console.log('');
    });

    // Check status distribution
    const statusCounts = await Payroll.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('📈 Status Distribution:');
    statusCounts.forEach(status => {
      console.log(`  ${status._id}: ${status.count}`);
    });

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing payroll data:', error);
  } finally {
    disconnectDB();
  }
}

testPayrollData(); 