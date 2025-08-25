const mongoose = require('mongoose');
const Payroll = require('../models/hr/Payroll');
require('dotenv').config();

// Database connection to CLOUD database
const connectToCloudDB = async () => {
  try {
    // Use the cloud database connection string
    const cloudURI = process.env.MONGODB_CLOUD_URI || process.env.MONGODB_URI;
    
    if (!cloudURI) {
      console.error('❌ No cloud database URI found in environment variables');
      console.log('Please check your .env file for MONGODB_CLOUD_URI or MONGODB_URI');
      process.exit(1);
    }
    
    console.log('🔗 Connecting to CLOUD database...');
    console.log('📍 URI:', cloudURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
    
    await mongoose.connect(cloudURI);
    console.log('✅ Connected to CLOUD database successfully');
    
    // Show database info
    const dbName = mongoose.connection.db.databaseName;
    const host = mongoose.connection.host;
    console.log(`📊 Database: ${dbName}`);
    console.log(`🌐 Host: ${host}`);
    
  } catch (error) {
    console.error('❌ Failed to connect to CLOUD database:', error.message);
    process.exit(1);
  }
};

// Main function to clear all payrolls from cloud
const clearCloudPayrolls = async () => {
  try {
    console.log('\n🚀 Starting CLOUD payroll cleanup...');
    
    // Get count before deletion
    const totalPayrolls = await Payroll.countDocuments({});
    
    if (totalPayrolls === 0) {
      console.log('ℹ️  No payroll records found in CLOUD database');
      return;
    }
    
    console.log(`📊 Found ${totalPayrolls} payroll records to delete from CLOUD`);
    
    // Get sample payrolls for verification
    const samplePayrolls = await Payroll.find({})
      .populate('employee', 'firstName lastName employeeId')
      .limit(3);
    
    console.log('\n📋 Sample payrolls that will be deleted:');
    samplePayrolls.forEach((payroll, index) => {
      const employee = payroll.employee;
      console.log(`   ${index + 1}. ${employee?.firstName} ${employee?.lastName} (${employee?.employeeId}) - ${payroll.month}/${payroll.year}`);
    });
    
    if (totalPayrolls > 3) {
      console.log(`   ... and ${totalPayrolls - 3} more payrolls`);
    }
    
    // Confirmation
    console.log('\n⚠️  WARNING: This will delete ALL payrolls from CLOUD database!');
    console.log('   This action cannot be undone.');
    
    // Auto-confirm for immediate execution
    console.log('\n🗑️  Proceeding with deletion...');
    
    // Delete all payrolls from cloud
    const result = await Payroll.deleteMany({});
    
    console.log('\n✅ CLOUD payroll cleanup completed!');
    console.log(`📊 Summary:`);
    console.log(`   Total payrolls deleted: ${result.deletedCount}`);
    console.log(`   Original count: ${totalPayrolls}`);
    
    // Verify deletion
    const remainingCount = await Payroll.countDocuments({});
    console.log(`   Remaining payrolls: ${remainingCount}`);
    
    if (remainingCount === 0) {
      console.log('🎉 All payroll records have been successfully removed from CLOUD database!');
    } else {
      console.log('⚠️  Some payroll records may still exist in CLOUD database');
    }
    
  } catch (error) {
    console.error('❌ Error during CLOUD payroll cleanup:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 CLOUD database connection closed');
    process.exit(0);
  }
};

// Run the script
connectToCloudDB().then(clearCloudPayrolls);
