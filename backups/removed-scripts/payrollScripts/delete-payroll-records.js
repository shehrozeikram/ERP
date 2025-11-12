const mongoose = require('mongoose');
const Payroll = require('../models/hr/Payroll');
const Employee = require('../models/hr/Employee');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const deletePayrollRecords = async (employeeId, months, year = 2025) => {
  try {
    if (employeeId === 'all') {
      console.log(`🚀 Starting payroll records deletion for ALL employees`);
      return await deleteAllPayrollRecords(months, year);
    }
    
    console.log(`🚀 Starting payroll records deletion for employee: ${employeeId}`);
    
    // Find employee by employeeId
    const employee = await Employee.findOne({ employeeId: employeeId });
    if (!employee) {
      console.error(`❌ Employee ${employeeId} not found`);
      return;
    }
    
    console.log(`👤 Found employee: ${employee.firstName} ${employee.lastName} (${employee.employeeId})`);
    
    let totalDeleted = 0;
    
    for (const month of months) {
      try {
        const result = await Payroll.deleteMany({ 
          employee: employee._id, 
          month: month, 
          year: year 
        });
        
        console.log(`✅ Deleted ${result.deletedCount} payrolls for ${month}/${year}`);
        totalDeleted += result.deletedCount;
        
      } catch (error) {
        console.error(`❌ Error deleting payrolls for ${month}/${year}:`, error.message);
      }
    }
    
    console.log(`🎉 Payroll record cleanup completed!`);
    console.log(`   Total deleted: ${totalDeleted} payroll records`);
    
  } catch (error) {
    console.error('❌ Error in deletePayrollRecords:', error);
  }
};

const deleteAllPayrollRecords = async (months, year = 2025) => {
  try {
    let totalDeleted = 0;
    
    for (const month of months) {
      try {
        console.log(`🗑️ Deleting all payroll records for ${month}/${year}...`);
        
        const result = await Payroll.deleteMany({ 
          month: month, 
          year: year 
        });
        
        console.log(`✅ Deleted ${result.deletedCount} payrolls for ${month}/${year}`);
        totalDeleted += result.deletedCount;
        
      } catch (error) {
        console.error(`❌ Error deleting payrolls for ${month}/${year}:`, error.message);
      }
    }
    
    console.log(`🎉 All payroll records cleanup completed!`);
    console.log(`   Total deleted: ${totalDeleted} payroll records across all employees`);
    
  } catch (error) {
    console.error('❌ Error in deleteAllPayrollRecords:', error);
  }
};

// Main execution
const main = async () => {
  try {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      console.log('Usage:');
      console.log('  Single employee: node delete-payroll-records.js <employeeId> <months...>');
      console.log('  All employees:   node delete-payroll-records.js all <months...>');
      console.log('');
      console.log('Examples:');
      console.log('  node delete-payroll-records.js 06386 9 10');
      console.log('  node delete-payroll-records.js all 9 10');
      return;
    }
    
    const employeeId = args[0];
    const months = args.slice(1).map(m => parseInt(m));
    
    await deletePayrollRecords(employeeId, months, 2025);
    
  } catch (error) {
    console.error('❌ Error in main:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { deletePayrollRecords };
