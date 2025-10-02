const mongoose = require('mongoose');
const Payroll = require('../models/hr/Payroll');
const Loan = require('../models/hr/Loan');
const Employee = require('../models/hr/Employee');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Helper function to calculate loan deductions from active loans
const calculateLoanDeductions = async (employeeId) => {
  try {
    const activeLoans = await Loan.find({
      employee: employeeId,
      status: { $in: ['Active', 'Disbursed', 'Approved'] }
    });
    
    console.log(`🔍 Found ${activeLoans.length} active loans for employee ${employeeId}`);
    activeLoans.forEach(loan => {
      console.log(`   - ${loan.loanType} Loan: ${loan.status} status, EMI: ${loan.monthlyInstallment}`);
    });
    
    const totalDeductions = activeLoans.reduce((total, loan) => {
      return total + (loan.monthlyInstallment || 0);
    }, 0);
    
    console.log(`💰 Total loan deductions calculated: ${totalDeductions}`);
    return totalDeductions;
  } catch (error) {
    console.error('Error calculating loan deductions:', error);
    return 0;
  }
};

// Update loan deductions for all payrolls
const updateLoanDeductions = async () => {
  try {
    console.log('🚀 Starting loan deductions update for all payrolls...');
    
    // Get all payrolls
    const payrolls = await Payroll.find({})
      .populate('employee', 'employeeId firstName lastName')
      .sort({ year: -1, month: -1 });
    
    console.log(`📊 Found ${payrolls.length} payroll records to update`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const payroll of payrolls) {
      try {
        console.log(`\n🔄 Processing payroll for ${payroll.employee?.firstName} ${payroll.employee?.lastName} (${payroll.employee?.employeeId}) - ${payroll.month}/${payroll.year}`);
        
        // Calculate new loan deductions
        const newLoanDeductions = await calculateLoanDeductions(payroll.employee._id);
        
        // Get old loan deductions
        const oldLoanDeductions = payroll.loanDeductions || 0;
        
        console.log(`   Old loan deductions: ${oldLoanDeductions}`);
        console.log(`   New loan deductions: ${newLoanDeductions}`);
        
        if (oldLoanDeductions !== newLoanDeductions) {
          // Update loan deductions
          payroll.loanDeductions = newLoanDeductions;
          
          // Recalculate total deductions
          payroll.totalDeductions = (payroll.incomeTax || 0) + 
            (payroll.eobi || 370) + 
            (payroll.healthInsurance || 0) + 
            (payroll.loanDeductions || 0) + 
            (payroll.attendanceDeduction || 0) + 
            (payroll.leaveDeduction || 0) + 
            (payroll.otherDeductions || 0);
          
          // Recalculate net salary
          payroll.netSalary = payroll.totalEarnings - payroll.totalDeductions;
          
          // Save the updated payroll
          await payroll.save();
          
          console.log(`   ✅ Updated! Total deductions: ${payroll.totalDeductions}, Net salary: ${payroll.netSalary}`);
          updatedCount++;
        } else {
          console.log(`   ⏭️ No change needed`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error updating payroll ${payroll._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 Update completed!`);
    console.log(`   ✅ Updated: ${updatedCount} payrolls`);
    console.log(`   ❌ Errors: ${errorCount} payrolls`);
    console.log(`   📊 Total processed: ${payrolls.length} payrolls`);
    
  } catch (error) {
    console.error('❌ Error in updateLoanDeductions:', error);
  }
};

// Update loan deductions for specific employee
const updateEmployeeLoanDeductions = async (employeeId) => {
  try {
    console.log(`🚀 Starting loan deductions update for employee: ${employeeId}`);
    
    // Find employee by employeeId or ObjectId
    let employee = await Employee.findOne({ employeeId: employeeId });
    if (!employee && mongoose.Types.ObjectId.isValid(employeeId)) {
      employee = await Employee.findById(employeeId);
    }
    
    if (!employee) {
      console.error(`❌ Employee not found: ${employeeId}`);
      return;
    }
    
    console.log(`👤 Found employee: ${employee.firstName} ${employee.lastName} (${employee.employeeId})`);
    
    // Get all payrolls for this employee
    const payrolls = await Payroll.find({ employee: employee._id })
      .sort({ year: -1, month: -1 });
    
    console.log(`📊 Found ${payrolls.length} payroll records for this employee`);
    
    let updatedCount = 0;
    
    for (const payroll of payrolls) {
      try {
        console.log(`\n🔄 Processing payroll for ${payroll.month}/${payroll.year}`);
        
        // Calculate new loan deductions
        const newLoanDeductions = await calculateLoanDeductions(employee._id);
        
        // Get old loan deductions
        const oldLoanDeductions = payroll.loanDeductions || 0;
        
        console.log(`   Old loan deductions: ${oldLoanDeductions}`);
        console.log(`   New loan deductions: ${newLoanDeductions}`);
        
        if (oldLoanDeductions !== newLoanDeductions) {
          // Update loan deductions
          payroll.loanDeductions = newLoanDeductions;
          
          // Recalculate total deductions
          payroll.totalDeductions = (payroll.incomeTax || 0) + 
            (payroll.eobi || 370) + 
            (payroll.healthInsurance || 0) + 
            (payroll.loanDeductions || 0) + 
            (payroll.attendanceDeduction || 0) + 
            (payroll.leaveDeduction || 0) + 
            (payroll.otherDeductions || 0);
          
          // Recalculate net salary
          payroll.netSalary = payroll.totalEarnings - payroll.totalDeductions;
          
          // Save the updated payroll
          await payroll.save();
          
          console.log(`   ✅ Updated! Total deductions: ${payroll.totalDeductions}, Net salary: ${payroll.netSalary}`);
          updatedCount++;
        } else {
          console.log(`   ⏭️ No change needed`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error updating payroll ${payroll._id}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Update completed for employee ${employee.employeeId}!`);
    console.log(`   ✅ Updated: ${updatedCount} payrolls`);
    
  } catch (error) {
    console.error('❌ Error in updateEmployeeLoanDeductions:', error);
  }
};

// Main execution
const main = async () => {
  try {
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
      // Update specific employee
      const employeeId = args[0];
      await updateEmployeeLoanDeductions(employeeId);
    } else {
      // Update all employees
      await updateLoanDeductions();
    }
    
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

module.exports = {
  updateLoanDeductions,
  updateEmployeeLoanDeductions,
  calculateLoanDeductions
};
