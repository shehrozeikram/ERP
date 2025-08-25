const mongoose = require('mongoose');
const Payroll = require('../models/hr/Payroll');
require('dotenv').config();

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Main function to clear all payrolls
const clearAllPayrolls = async () => {
  try {
    console.log('🚀 Starting payroll cleanup...');
    
    // Get count before deletion
    const totalPayrolls = await Payroll.countDocuments({});
    
    if (totalPayrolls === 0) {
      console.log('ℹ️  No payroll records found');
      return;
    }
    
    console.log(`📊 Found ${totalPayrolls} payroll records to delete`);
    
    // Delete all payrolls
    const result = await Payroll.deleteMany({});
    
    console.log('\n✅ Payroll cleanup completed!');
    console.log(`📊 Deleted: ${result.deletedCount} payroll records`);
    
    // Verify deletion
    const remainingCount = await Payroll.countDocuments({});
    console.log(`📊 Remaining: ${remainingCount} payroll records`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
connectDB().then(clearAllPayrolls);
