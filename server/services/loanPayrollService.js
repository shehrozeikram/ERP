const mongoose = require('mongoose');
const Loan = require('../models/hr/Loan');

/**
 * 🏦 Loan Payroll Integration Service
 * Handles automatic loan payment processing when payroll is approved/paid
 */

class LoanPayrollService {
  
  /**
   * Process loan payments from payroll deductions
   * Called when payroll is approved or marked as paid
   * @param {Object} payroll - Payroll document
   * @param {string} eventType - 'approved' or 'paid'
   */
  static async processLoanPayments(payroll, eventType = 'paid') {
    try {
      console.log(`🚀 Processing loan payments for payroll ${payroll._id} (Event: ${eventType})`);
      
      // Skip if no loan deductions or event is not payment-triggering
      if (!payroll.loanDeductions || payroll.loanDeductions <= 0 || eventType === 'approved') {
        console.log(`⏭️ No loan deductions or skipping for ${eventType}: ${payroll.loanDeductions || 0}`);
        return { success: true, message: 'No loan deductions to process', processedLoans: 0 };
      }
      
      console.log(`💰 Processing Rs ${payroll.loanDeductions} in loan deductions for employee ${payroll.employee}`);
      
      // Get all active loans for the employee
      const activeLoans = await Loan.find({
        employee: payroll.employee,
        status: { $in: ['Active', 'Disbursed', 'Approved'] }
      });
      
      if (activeLoans.length === 0) {
        console.log(`❌ No active loans found for employee ${payroll.employee}`);
        return { success: true, message: 'No active loans found', processedLoans: 0 };
      }
      
      console.log(`🔍 Found ${activeLoans.length} active loans for employee`);
      
      let processedLoans = 0;
      const loanUpdates = [];
      
      // Process each loan by distributing loan deductions proportionally
      const totalInstallments = activeLoans.reduce((sum, loan) => sum + (loan.monthlyInstallment || 0), 0);
      
      if (totalInstallments === 0) {
        console.log(`⚠️ Total monthly installments is 0, cannot process proportional payment`);
        return { success: true, message: 'No monthly installments found', processedLoans: 0 };
      }
      
      // Distribute loan deductions proportionally among active loans
      for (const loan of activeLoans) {
        const loanShare = (loan.monthlyInstallment / totalInstallments) * payroll.loanDeductions;
        
        if (loanShare > 0) {
          console.log(`💰 Processing Rs ${loanShare.toFixed(2)} payment for ${loan.loanType} loan ${loan._id}`);
          
          try {
            // Use the loan's processPayment method
            const paymentResult = loan.processPayment(loanShare, 'Salary Deduction');
            
            // Update loan totals
            loan.totalPaid += paymentResult.processedAmount;
            loan.outstandingBalance = paymentResult.newOutstandingBalance;
            
            // Update schedule with payment
            await this.updateLoanSchedule(loan, loanShare, payroll);
            
            // Mark loan as Active if it was Disbursed
            if (loan.status === 'Disbursed') {
              loan.status = 'Active';
            }
            
            // Check if loan is completed
            if (loan.outstandingBalance <= 0) {
              loan.status = 'Completed';
              loan.completionDate = new Date();
              console.log(`🎉 Loan ${loan._id} completed!`);
            }
            
            loan.updatedBy = new mongoose.Types.ObjectId();
            loan.updatedAt = new Date();
            
            await loan.save();
            
            loanUpdates.push({
              loanId: loan._id,
              loanType: loan.loanType,
              paymentAmount: paymentResult.processedAmount,
              newBalance: loan.outstandingBalance,
              status: loan.status
            });
            
            processedLoans++;
            console.log(`✅ Updated loan ${loan._id}: Remaining balance: Rs ${loan.outstandingBalance}`);
            
          } catch (loanError) {
            console.error(`❌ Error processing payment for loan ${loan._id}:`, loanError.message);
          }
        }
      }
      
      console.log(`🎉 Loan payment processing completed!`);
      console.log(`   Processed loans: ${processedLoans}`);
      console.log(`   Total amount processed: Rs ${payroll.loanDeductions}`);
      
      return {
        success: true,
        message: `Successfully processed ${processedLoans} loans`,
        processedLoans,
        loanUpdates,
        totalProcessed: payroll.loanDeductions
      };
      
    } catch (error) {
      console.error('❌ Error in processLoanPayments:', error);
      return {
        success: false,
        message: `Error processing loan payments: ${error.message}`,
        processedLoans: 0
      };
    }
  }
  
  /**
   * Update loan schedule with payment information
   * @param {Object} loan - Loan document
   * @param {number} paymentAmount - Payment amount
   * @param {Object} payroll - Payroll document
   */
  static async updateLoanSchedule(loan, paymentAmount, payroll) {
    try {
      if (!loan.loanSchedule || loan.loanSchedule.length === 0) {
        console.log(`⚠️ No loan schedule found for loan ${loan._id}, generating...`);
        loan.generateLoanSchedule();
      }
      
      let remainingPayment = paymentAmount;
      
      // Find the next unpaid installment
      const nextInstallment = loan.loanSchedule.find(installment => 
        ['Pending', 'Overdue', 'Partial'].includes(installment.status)
      );
      
      if (!nextInstallment) {
        console.log(`⚠️ No pending installments found for loan ${loan._id}`);
        
        // Create new installment if all are paid but balance remains
        if (loan.outstandingBalance > 0) {
          const currentMonth = payroll.month;
          const currentYear = payroll.year;
          
          const newInstallment = {
            installmentNumber: loan.loanSchedule.length + 1,
            dueDate: new Date(currentYear, currentMonth - 1, 1), // First day of current month
            amount: Math.min(paymentAmount, loan.outstandingBalance),
            principal: Math.min(paymentAmount, loan.outstandingBalance),
            interest: 0, // This is a principal payment
            balance: Math.max(0, loan.outstandingBalance - paymentAmount),
            status: 'Paid',
            paymentDate: new Date(),
            paymentMethod: 'Salary Deduction',
            paymentReference: `Payroll-${payroll._id}`
          };
          
          loan.loanSchedule.push(newInstallment);
          console.log(`➕ Added new installment for principal payment`);
        }
        
        return;
      }
      
      // Update next installment
      const currentPaid = nextInstallment.paidAmount || 0;
      const newPaidAmount = Math.min(currentPaid + remainingPayment, nextInstallment.amount);
      
      nextInstallment.paidAmount = newPaidAmount;
      nextInstallment.paymentDate = new Date();
      nextInstallment.paymentMethod = 'Salary Deduction';
      nextInstallment.paymentReference = `Payroll-${payroll._id}`;
      
      if (newPaidAmount >= nextInstallment.amount) {
        nextInstallment.status = 'Paid';
        console.log(`✅ Installment ${nextInstallment.installmentNumber} completed`);
      } else {
        nextInstallment.status = 'Partial';
        console.log(`🔄 Installment ${nextInstallment.installmentNumber} partial payment: Rs ${newPaidAmount}/${nextInstallment.amount}`);
      }
      
      remainingPayment -= (newPaidAmount - currentPaid);
      
      // Handle case if there's remaining payment for next installment
      if (remainingPayment > 0) {
        await this.updateLoanSchedule(loan, remainingPayment, payroll);
      }
      
    } catch (error) {
      console.error(`❌ Error updating loan schedule for loan ${loan._id}:`, error);
    }
  }
  
  /**
   * Get loan summary for employee (used for reporting)
   * @param {string} employeeId - Employee ObjectId
   * @returns {Object} Loan summary
   */
  static async getLoanSummary(employeeId) {
    try {
      const loans = await Loan.find({ employee: employeeId });
      
      const activeLoans = loans.filter(loan => 
        ['Active', 'Disbursed', 'Approved'].includes(loan.status)
      );
      
      const totalOutstanding = activeLoans.reduce((sum, loan) => 
        sum + (loan.outstandingBalance || 0), 0
      );
      
      const totalMonthlyDeduction = activeLoans.reduce((sum, loan) => 
        sum + (loan.monthlyInstallment || 0), 0
      );
      
      const totalPaid = loans.reduce((sum, loan) => 
        sum + (loan.totalPaid || 0), 0
      );
      
      return {
        totalLoans: loans.length,
        activeLoans: activeLoans.length,
        totalOutstanding,
        totalMonthlyDeduction,
        totalPaid,
        loans: activeLoans.map(loan => ({
          id: loan._id,
          loanType: loan.loanType,
          loanAmount: loan.loanAmount,
          monthlyInstallment: loan.monthlyInstallment,
          outstandingBalance: loan.outstandingBalance,
          totalPaid: loan.totalPaid,
          status: loan.status,
          progressPercentage: loan.progressPercentage
        }))
      };
      
    } catch (error) {
      console.error('❌ Error getting loan summary:', error);
      return {
        totalLoans: 0,
        activeLoans: 0,
        totalOutstanding: 0,
        totalMonthlyDeduction: 0,
        totalPaid: 0,
        loans: []
      };
    }
  }
}

module.exports = LoanPayrollService;
