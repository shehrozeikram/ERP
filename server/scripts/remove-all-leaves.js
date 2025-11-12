require('dotenv').config();
const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveTransaction = require('../models/hr/LeaveTransaction');
const AnnualLeaveBalance = require('../models/hr/AnnualLeaveBalance');

/**
 * Script to remove all leave records from the system
 * This will delete:
 * - All LeaveRequest records
 * - All LeaveBalance records
 * - All LeaveTransaction records
 * - All AnnualLeaveBalance records
 * 
 * WARNING: This action cannot be undone!
 */

async function removeAllLeaves() {
  try {
    console.log('🚀 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database');
    
    // Count existing records
    const leaveRequestCount = await LeaveRequest.countDocuments();
    const leaveBalanceCount = await LeaveBalance.countDocuments();
    const leaveTransactionCount = await LeaveTransaction.countDocuments();
    const annualLeaveBalanceCount = await AnnualLeaveBalance.countDocuments();
    
    console.log('\n📊 Current Leave Records:');
    console.log(`   Leave Requests: ${leaveRequestCount}`);
    console.log(`   Leave Balances: ${leaveBalanceCount}`);
    console.log(`   Leave Transactions: ${leaveTransactionCount}`);
    console.log(`   Annual Leave Balances: ${annualLeaveBalanceCount}`);
    console.log(`   Total Records: ${leaveRequestCount + leaveBalanceCount + leaveTransactionCount + annualLeaveBalanceCount}`);
    
    if (leaveRequestCount === 0 && leaveBalanceCount === 0 && leaveTransactionCount === 0 && annualLeaveBalanceCount === 0) {
      console.log('\n✅ No leave records found. Nothing to delete.');
      return;
    }
    
    console.log('\n⚠️  WARNING: This will permanently delete ALL leave records!');
    console.log('This action cannot be undone!');
    console.log('\n🔄 Proceeding with deletion...');
    
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Delete Leave Requests
        console.log('\n🗑️  Deleting Leave Requests...');
        const leaveRequestResult = await LeaveRequest.deleteMany({}).session(session);
        console.log(`   ✅ Deleted ${leaveRequestResult.deletedCount} leave requests`);
        
        // Delete Leave Balances
        console.log('\n🗑️  Deleting Leave Balances...');
        const leaveBalanceResult = await LeaveBalance.deleteMany({}).session(session);
        console.log(`   ✅ Deleted ${leaveBalanceResult.deletedCount} leave balances`);
        
        // Delete Leave Transactions
        console.log('\n🗑️  Deleting Leave Transactions...');
        const leaveTransactionResult = await LeaveTransaction.deleteMany({}).session(session);
        console.log(`   ✅ Deleted ${leaveTransactionResult.deletedCount} leave transactions`);
        
        // Delete Annual Leave Balances
        console.log('\n🗑️  Deleting Annual Leave Balances...');
        const annualLeaveBalanceResult = await AnnualLeaveBalance.deleteMany({}).session(session);
        console.log(`   ✅ Deleted ${annualLeaveBalanceResult.deletedCount} annual leave balances`);
        
        console.log('\n🎉 Successfully deleted all leave records!');
        console.log(`\n📊 Summary:`);
        console.log(`   Leave Requests: ${leaveRequestResult.deletedCount}`);
        console.log(`   Leave Balances: ${leaveBalanceResult.deletedCount}`);
        console.log(`   Leave Transactions: ${leaveTransactionResult.deletedCount}`);
        console.log(`   Annual Leave Balances: ${annualLeaveBalanceResult.deletedCount}`);
        console.log(`   Total Deleted: ${leaveRequestResult.deletedCount + leaveBalanceResult.deletedCount + leaveTransactionResult.deletedCount + annualLeaveBalanceResult.deletedCount}`);
      });
      
    } catch (error) {
      console.error('❌ Error during transaction:', error);
      throw error;
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the script
if (require.main === module) {
  removeAllLeaves()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = removeAllLeaves;

