const mongoose = require('mongoose');
require('dotenv').config();

// Import the Payroll model
const Payroll = require('../models/hr/Payroll');

/**
 * Quick script to delete all payroll records except August
 * Usage: node quick-delete-payrolls-except-august.js
 */

async function main() {
  try {
    console.log('🚀 Quick payroll cleanup - deleting all records except August...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
    
    // Count records before deletion
    const totalBefore = await Payroll.countDocuments();
    const augustBefore = await Payroll.countDocuments({ month: 8 });
    const toDelete = totalBefore - augustBefore;
    
    console.log(`📊 Before deletion:`);
    console.log(`   Total payroll records: ${totalBefore}`);
    console.log(`   August records: ${augustBefore}`);
    console.log(`   Records to delete: ${toDelete}`);
    
    if (toDelete === 0) {
      console.log('✅ No records to delete - all payroll records are already for August only');
      return;
    }
    
    // Delete all records except August
    const result = await Payroll.deleteMany({ month: { $ne: 8 } });
    
    console.log(`\n🗑️  Deletion completed:`);
    console.log(`   Records deleted: ${result.deletedCount}`);
    
    // Verify
    const totalAfter = await Payroll.countDocuments();
    const augustAfter = await Payroll.countDocuments({ month: 8 });
    
    console.log(`\n📊 After deletion:`);
    console.log(`   Total payroll records: ${totalAfter}`);
    console.log(`   August records: ${augustAfter}`);
    
    if (totalAfter === augustAfter) {
      console.log('✅ SUCCESS: Only August records remain!');
    } else {
      console.log('⚠️  WARNING: Some non-August records may still exist');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
}

main();
