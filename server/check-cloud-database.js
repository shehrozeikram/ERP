/**
 * Check cloud database status for payrolls and employees
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');

async function checkCloudDatabase() {
  try {
    console.log('🔍 Checking Cloud Database Status...');
    console.log('---');
    
    // Connect to cloud database
    await connectDB();
    
    console.log('📊 Database Connection Info:');
    console.log('Host:', mongoose.connection.host);
    console.log('Database Name:', mongoose.connection.name);
    
    console.log('---');
    console.log('📚 Collections in this database:');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    collections.forEach(col => {
      console.log('- ' + col.name);
    });
    
    console.log('---');
    console.log('📊 Payroll-related Collections Status:');
    
    // Check payrolls collection
    const payrollCount = await db.collection('payrolls').countDocuments();
    console.log('Payrolls Collection:', payrollCount + ' records');
    
    // Check payslips collection
    const payslipCount = await db.collection('payslips').countDocuments();
    console.log('Payslips Collection:', payslipCount + ' records');
    
    // Check employees collection
    const employeeCount = await db.collection('employees').countDocuments();
    console.log('Employees Collection:', employeeCount + ' records');
    
    // Check active employees with salary
    const activeEmployeesWithSalary = await db.collection('employees').countDocuments({
      employmentStatus: 'Active',
      'salary.gross': { $exists: true, $gt: 0 }
    });
    console.log('Active Employees with Salary:', activeEmployeesWithSalary + ' records');
    
    if (payrollCount > 0) {
      console.log('---');
      console.log('📋 Sample Payroll Records:');
      
      const samplePayrolls = await db.collection('payrolls').find({}).limit(3).toArray();
      samplePayrolls.forEach((payroll, index) => {
        console.log(`  ${index + 1}. Month/Year: ${payroll.month}/${payroll.year}`);
        console.log(`     Status: ${payroll.status || 'N/A'}`);
        console.log(`     Employee ID: ${payroll.employee || 'N/A'}`);
        console.log(`     Total Earnings: ${payroll.totalEarnings || 'N/A'}`);
        console.log('');
      });
    }
    
    if (activeEmployeesWithSalary > 0) {
      console.log('---');
      console.log('👥 Sample Active Employees with Salary:');
      
      const sampleEmployees = await db.collection('employees').find({
        employmentStatus: 'Active',
        'salary.gross': { $exists: true, $gt: 0 }
      }).limit(3).toArray();
      
      sampleEmployees.forEach((employee, index) => {
        console.log(`  ${index + 1}. Name: ${employee.firstName || 'N/A'} ${employee.lastName || 'N/A'}`);
        console.log(`     Employee ID: ${employee.employeeId || 'N/A'}`);
        console.log(`     Gross Salary: ${employee.salary?.gross || 'N/A'}`);
        console.log(`     Department: ${employee.department || 'N/A'}`);
        console.log('');
      });
    }
    
    console.log('---');
    console.log('✅ Cloud database check complete');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await disconnectDB();
  }
}

// Run the check
if (require.main === module) {
  checkCloudDatabase();
}

module.exports = { checkCloudDatabase };
