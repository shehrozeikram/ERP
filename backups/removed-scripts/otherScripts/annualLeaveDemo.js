/**
 * Annual Leave System Demo
 * 
 * This script demonstrates the annual leave system logic
 * for employee 6387 (hire date: 2021-10-21) without requiring
 * database connection.
 */

class AnnualLeaveDemo {
  constructor() {
    this.employee = {
      id: '6387',
      firstName: 'Test',
      lastName: 'Employee',
      hireDate: new Date('2021-10-21')
    };
    
    this.balances = [];
    this.transactions = [];
  }
  
  /**
   * Calculate work year based on hire date and current date
   */
  calculateWorkYear(hireDate, currentDate = new Date()) {
    const years = currentDate.getFullYear() - hireDate.getFullYear();
    const months = currentDate.getMonth() - hireDate.getMonth();
    
    if (months < 0 || (months === 0 && currentDate.getDate() < hireDate.getDate())) {
      return years; // Haven't reached anniversary yet
    }
    return years + 1; // Completed this many work years
  }
  
  /**
   * Process anniversary allocation for a specific year
   */
  processAnniversary(year) {
    const hireDate = this.employee.hireDate;
    const workYear = this.calculateWorkYear(hireDate, new Date(year, 9, 21)); // October 21st
    
    console.log(`\n📅 YEAR ${year} - Work Year ${workYear}`);
    
    if (workYear < 1) {
      console.log('❌ Employee hasn\'t completed 1 year yet - No allocation');
      return;
    }
    
    // Get previous year's balance for carry forward
    const previousBalance = this.balances.find(b => b.year === year - 1);
    const carryForward = previousBalance ? previousBalance.remaining : 0;
    
    // New allocation (20 days for completed year)
    const newAllocation = 20;
    const totalBeforeCap = newAllocation + carryForward;
    
    // Apply 40-leave cap
    const totalAfterCap = Math.min(totalBeforeCap, 40);
    const removedDays = totalBeforeCap - totalAfterCap;
    
    // Create new balance
    const newBalance = {
      year,
      workYear,
      allocated: newAllocation,
      used: 0,
      remaining: newAllocation,
      carryForward,
      total: totalAfterCap,
      anniversaryDate: new Date(year, 9, 21) // October 21st
    };
    
    this.balances.push(newBalance);
    
    // Log allocation transaction
    this.transactions.push({
      type: 'ALLOCATION',
      year,
      amount: newAllocation,
      description: `Annual leave allocation of ${newAllocation} days on anniversary`,
      date: new Date(year, 9, 21)
    });
    
    // Log carry forward transaction if applicable
    if (carryForward > 0) {
      this.transactions.push({
        type: 'CARRY_FORWARD',
        year,
        amount: carryForward,
        description: `Carry forward of ${carryForward} days from previous year`,
        date: new Date(year, 9, 21)
      });
    }
    
    // Log cap enforcement if applicable
    if (removedDays > 0) {
      this.transactions.push({
        type: 'CAP_ENFORCEMENT',
        year,
        amount: removedDays,
        description: `Cap enforcement: removed ${removedDays} days to maintain 40-day limit`,
        date: new Date(year, 9, 21)
      });
    }
    
    console.log(`✅ Allocated: ${newAllocation} days`);
    if (carryForward > 0) {
      console.log(`📦 Carry Forward: ${carryForward} days`);
    }
    console.log(`📊 Total Before Cap: ${totalBeforeCap} days`);
    if (removedDays > 0) {
      console.log(`⚠️ Cap Enforcement: Removed ${removedDays} days`);
    }
    console.log(`🎯 Final Total: ${totalAfterCap} days`);
  }
  
  /**
   * Simulate leave usage for a specific year
   */
  useLeaves(year, days, description) {
    const balance = this.balances.find(b => b.year === year);
    if (!balance) {
      console.log(`❌ No balance found for year ${year}`);
      return;
    }
    
    if (balance.remaining < days) {
      console.log(`❌ Insufficient leaves. Available: ${balance.remaining}, Requested: ${days}`);
      return;
    }
    
    // Deduct using oldest-first rule (carry forward first, then allocated)
    let remainingToDeduct = days;
    
    if (balance.carryForward > 0) {
      const deductFromCarryForward = Math.min(remainingToDeduct, balance.carryForward);
      balance.carryForward -= deductFromCarryForward;
      remainingToDeduct -= deductFromCarryForward;
    }
    
    if (remainingToDeduct > 0 && balance.allocated > 0) {
      const deductFromAllocated = Math.min(remainingToDeduct, balance.allocated);
      balance.allocated -= deductFromAllocated;
      remainingToDeduct -= deductFromAllocated;
    }
    
    balance.used += days;
    balance.remaining = balance.allocated + balance.carryForward - balance.used;
    
    // Log usage transaction
    this.transactions.push({
      type: 'USAGE',
      year,
      amount: days,
      description: description || `Leave usage of ${days} days`,
      date: new Date(year, 5, 15) // Mid-year usage
    });
    
    console.log(`📝 Used: ${days} days - ${description}`);
    console.log(`📊 Remaining: ${balance.remaining} days`);
  }
  
  /**
   * Run the complete workflow demonstration
   */
  runDemo() {
    console.log('🎯 ANNUAL LEAVE SYSTEM DEMO');
    console.log('=' .repeat(50));
    console.log(`👤 Employee: ${this.employee.firstName} ${this.employee.lastName} (${this.employee.id})`);
    console.log(`📅 Hire Date: ${this.employee.hireDate.toDateString()}`);
    console.log('📋 Testing years: 2021-2029\n');
    
    // Year 1 (2021-2022): No leaves yet
    this.processAnniversary(2021);
    
    // Year 2 (2022-2023): First allocation
    this.processAnniversary(2022);
    this.useLeaves(2022, 5, 'Used 5 days during 2022-2023');
    
    // Year 3 (2023-2024): Carry forward + new allocation
    this.processAnniversary(2023);
    
    // Year 4 (2024-2025): Cap enforcement
    this.useLeaves(2023, 5, 'Used 5 days during 2023-2024');
    this.processAnniversary(2024);
    
    // Year 5 (2025-2026): Leave usage and allocation
    this.useLeaves(2024, 15, 'Used 15 days during 2024-2025');
    this.processAnniversary(2025);
    
    // Year 6 (2026-2027): More cap enforcement
    this.useLeaves(2025, 10, 'Used 10 days during 2025-2026');
    this.processAnniversary(2026);
    
    // Year 7 (2027-2028): Partial bucket removal
    this.useLeaves(2026, 5, 'Used 5 days during 2026-2027');
    this.processAnniversary(2027);
    
    // Year 8 (2028-2029): Full bucket removal
    this.processAnniversary(2028);
    
    // Generate final report
    this.generateReport();
  }
  
  /**
   * Generate final report
   */
  generateReport() {
    console.log('\n📊 FINAL REPORT');
    console.log('=' .repeat(50));
    
    const totalAllocated = this.balances.reduce((sum, b) => sum + b.allocated, 0);
    const totalUsed = this.balances.reduce((sum, b) => sum + b.used, 0);
    const totalRemaining = this.balances.reduce((sum, b) => sum + b.remaining, 0);
    const totalCarryForward = this.balances.reduce((sum, b) => sum + b.carryForward, 0);
    const totalLeaves = this.balances.reduce((sum, b) => sum + b.total, 0);
    
    console.log('\n📈 SUMMARY:');
    console.log(`Total Allocated: ${totalAllocated} days`);
    console.log(`Total Used: ${totalUsed} days`);
    console.log(`Total Remaining: ${totalRemaining} days`);
    console.log(`Total Carry Forward: ${totalCarryForward} days`);
    console.log(`Total Leaves: ${totalLeaves} days`);
    console.log(`At Cap: ${totalLeaves >= 40 ? 'Yes' : 'No'}`);
    
    console.log('\n📋 YEAR-BY-YEAR BREAKDOWN:');
    this.balances.forEach(balance => {
      console.log(`Year ${balance.year}: Allocated=${balance.allocated}, Used=${balance.used}, Remaining=${balance.remaining}, CarryForward=${balance.carryForward}, Total=${balance.total}`);
    });
    
    console.log('\n📜 TRANSACTION HISTORY:');
    this.transactions.forEach(transaction => {
      console.log(`${transaction.date.toDateString()}: ${transaction.type} - ${transaction.description} (${transaction.amount} days)`);
    });
    
    console.log('\n🎉 Demo completed successfully!');
  }
}

// Run the demo
const demo = new AnnualLeaveDemo();
demo.runDemo();
