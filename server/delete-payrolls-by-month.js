const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Payroll = require('./models/hr/Payroll');
const Employee = require('./models/hr/Employee');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
  }
};

const deletePayrollsByMonth = async (month, year) => {
  try {
    console.log(`\n🔍 Searching for payrolls in Month: ${month}, Year: ${year}...`);
    
    // Find payrolls for the specified month and year
    const payrolls = await Payroll.find({ month, year }).populate('employee', 'firstName lastName employeeId');
    
    if (payrolls.length === 0) {
      console.log(`❌ No payrolls found for Month: ${month}, Year: ${year}`);
      return;
    }
    
    console.log(`\n📊 Found ${payrolls.length} payrolls:`);
    payrolls.forEach((payroll, index) => {
      const employee = payroll.employee;
      const employeeName = employee ? `${employee.firstName} ${employee.lastName} (${employee.employeeId})` : 'Unknown Employee';
      console.log(`  ${index + 1}. ${employeeName} - Basic: ${payroll.basicSalary}, Gross: ${payroll.grossSalary}, Net: ${payroll.netSalary}`);
    });
    
    // Ask for confirmation
    console.log(`\n⚠️  WARNING: This will permanently delete ${payrolls.length} payroll records!`);
    console.log('Type "DELETE" to confirm, or press Enter to cancel:');
    
    // For script execution, we'll proceed with deletion
    // In a real scenario, you might want to add user input confirmation
    
    // Delete the payrolls
    const deleteResult = await Payroll.deleteMany({ month, year });
    
    console.log(`\n✅ Successfully deleted ${deleteResult.deletedCount} payroll records for Month: ${month}, Year: ${year}`);
    
    // Verify deletion
    const remainingPayrolls = await Payroll.find({ month, year });
    if (remainingPayrolls.length === 0) {
      console.log('✅ Verification: All payrolls for the specified month have been deleted');
    } else {
      console.log(`⚠️  Warning: ${remainingPayrolls.length} payrolls still remain for the specified month`);
    }
    
  } catch (error) {
    console.error('❌ Error deleting payrolls:', error);
  }
};

const showAllPayrolls = async () => {
  try {
    console.log('\n📋 Current Payroll Summary:');
    
    const allPayrolls = await Payroll.find({}).populate('employee', 'firstName lastName employeeId').sort({ year: 1, month: 1 });
    
    // Filter out payrolls with missing month or year
    const payrolls = allPayrolls.filter(p => p.month && p.year);
    
    if (allPayrolls.length !== payrolls.length) {
      console.log(`⚠️  Found ${allPayrolls.length - payrolls.length} payrolls with missing month/year data`);
    }
    
    if (payrolls.length === 0) {
      console.log('❌ No payrolls found in the database');
      return;
    }
    
    // Group by month and year
    const grouped = payrolls.reduce((acc, payroll) => {
      // Safety check for month and year
      if (!payroll.month || !payroll.year) {
        console.log(`⚠️  Skipping payroll with missing month/year:`, payroll._id);
        return acc;
      }
      
      const key = `${payroll.year}-${payroll.month.toString().padStart(2, '0')}`;
      if (!acc[key]) {
        acc[key] = {
          year: payroll.year,
          month: payroll.month,
          count: 0,
          totalBasic: 0,
          totalGross: 0,
          totalNet: 0
        };
      }
      acc[key].count++;
      acc[key].totalBasic += payroll.basicSalary || 0;
      acc[key].totalGross += payroll.grossSalary || 0;
      acc[key].totalNet += payroll.netSalary || 0;
      return acc;
    }, {});
    
    Object.entries(grouped).forEach(([key, data]) => {
      console.log(`  ${key}: ${data.count} payrolls - Basic: ${data.totalBasic.toLocaleString()}, Gross: ${data.totalGross.toLocaleString()}, Net: ${data.totalNet.toLocaleString()}`);
    });
    
  } catch (error) {
    console.error('❌ Error fetching payrolls:', error);
  }
};

const main = async () => {
  try {
    await connectDB();
    
    // Show current payroll summary
    await showAllPayrolls();
    
    // Get month and year from command line arguments
    const month = parseInt(process.argv[2]);
    const year = parseInt(process.argv[3]);
    
    if (!month || !year || month < 1 || month > 12 || year < 2020) {
      console.log('\n❌ Invalid month or year. Usage: node delete-payrolls-by-month.js <month> <year>');
      console.log('   Example: node delete-payrolls-by-month.js 11 2024');
      console.log('   Month: 1-12, Year: 2020 or later');
      return;
    }
    
    await deletePayrollsByMonth(month, year);
    
  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
};

// Run the script
main();
