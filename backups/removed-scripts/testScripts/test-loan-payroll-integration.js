const mongoose = require('mongoose');
const Payroll = require('../models/hr/Payroll');
const Loan = require('../models/hr/Loan');
const Employee = require('../models/hr/Employee');
const LoanPayrollService = require('../services/loanPayrollService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testLoanPayrollIntegration = async () => {
  try {
    console.log('🚀 Testing Loan-Payroll Integration...');
    
    // Find Naila Bhatti and her loans
    const employee = await Employee.findOne({ employeeId: '06386' });
    if (!employee) {
      console.error('❌ Employee 06386 (Naila Bhatti) not found');
      return;
    }
    
    console.log(`👤 Found employee: ${employee.firstName} ${employee.lastName} (${employee.employeeId})`);
    
    // Get her active loans
    const activeLoans = await Loan.find({
      employee: employee._id,
      status: { $in: ['Active', 'Disbursed', 'Approved'] }
    });
    
    if (activeLoans.length === 0) {
      console.error('❌ No active loans found for employee');
      return;
    }
    
    console.log(`🏦 Found ${activeLoans.length} active loans:`);
    activeLoans.forEach(loan => {
      console.log(`   - ${loan.loanType}: Rs ${loan.loanAmount?.toLocaleString()}, EMI: Rs ${loan.monthlyInstallment?.toLocaleString()}, Balance: Rs ${loan.outstandingBalance?.toLocaleString()}, Progress: ${loan.progressPercentage}%`);
    });
    
    // Create a test payroll for demonstration
    const testPayroll = {
      employee: employee._id,
      month: 12, // December
      year: 2025,
      basicSalary: 100000,
      grossSalary: 150000,
      totalEarnings: 150000,
      loanDeductions: 41667, // From Naila's vehicle loan
      totalDeductions: 50000,
      netSalary: 100000,
      totalWorkingDays: 26,
      presentDays: 26,
      absentDays: 0,
      leaveDays: 0,
      status: 'Approved',
      createdBy: new mongoose.Types.ObjectId(),
      paymentMethod: 'Bank Transfer'
    };
    
    console.log('\n🏭 Creating test payroll record...');
    const payroll = new Payroll(testPayroll);
    await payroll.save();
    
    console.log(`✅ Test payroll created: ${payroll._id}`);
    console.log(`   Loan deductions: Rs ${payroll.loanDeductions?.toLocaleString()}`);
    
    // Test the loan payment processing
    console.log('\n🏦 Processing loan payments...');
    const result = await LoanPayrollService.processLoanPayments(payroll, 'paid');
    
    if (result.success) {
      console.log(`✅ Loan processing result:`);
      console.log(`   Processed loans: ${result.processedLoans}`);
      console.log(`   Total amount: Rs ${result.totalProcessed?.toLocaleString()}`);
      
      if (result.loanUpdates) {
        console.log(`\n📊 Loan updates:`);
        result.loanUpdates.forEach(update => {
          console.log(`   - ${update.loanType}: Paid Rs ${update.paymentAmount?.toLocaleString()}, New Balance: Rs ${update.newBalance?.toLocaleString()}, Status: ${update.status}`);
        });
      }
    } else {
      console.error(`❌ Loan processing failed: ${result.message}`);
    }
    
    // Check updated loan progress
    console.log('\n📈 Updated loan progress:');
    const updatedLoans = await Loan.find({
      employee: employee._id,
      status: { $in: ['Active', 'Disbursed', 'Approved', 'Completed'] }
    });
    
    updatedLoans.forEach(loan => {
      console.log(`   - ${loan.loanType}: Rs ${loan.outstandingBalance?.toLocaleString()} remaining, Progress: ${loan.progressPercentage}%`);
      
      // Show last few installments
      if (loan.loanSchedule && loan.loanSchedule.length > 0) {
        console.log(`     Recent installments:`);
        const recentInstallments = loan.loanSchedule.slice(-3);
        recentInstallments.forEach(inst => {
          console.log(`       #${inst.installmentNumber}: Rs ${inst.amount?.toLocaleString()}, Status: ${inst.status}, Paid: ${inst.paidAmount || 0}`);
        });
      }
    });
    
    // Clean up test payroll
    console.log('\n🧹 Cleaning up test payroll...');
    await Payroll.findByIdAndDelete(payroll._id);
    console.log('✅ Test payroll deleted');
    
    console.log('\n🎉 Loan-Payroll integration test completed!');
    console.log('The progress bar in Loan Management will now reflect the updated loan progress.');
    
  } catch (error) {
    console.error('❌ Error in test:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the test
if (require.main === module) {
  testLoanPayrollIntegration();
}

module.exports = { testLoanPayrollIntegration };
