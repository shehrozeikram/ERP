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

// Main function to clear August payrolls only
const clearAugustPayrolls = async () => {
  try {
    console.log('🚀 Starting August payroll cleanup...');
    
    // Get count before deletion for August
    const augustPayrolls = await Payroll.countDocuments({ month: 8 });
    console.log(`📊 Found ${augustPayrolls} August payroll records`);
    
    if (augustPayrolls === 0) {
      console.log('ℹ️  No August payroll records found');
      return;
    }
    
    console.log(`📊 August payroll records to delete: ${augustPayrolls}`);
    
    // Delete August payrolls only
    const result = await Payroll.deleteMany({ month: 8 });
    console.log(`🗑️  Deleted ${result.deletedCount} August payroll records`);
    
    console.log('\n✅ August payroll cleanup completed!');
    console.log(`📊 Total deleted: ${result.deletedCount} August payroll records`);
    
    // Verify deletion
    const remainingAugust = await Payroll.countDocuments({ month: 8 });
    const totalRemaining = await Payroll.countDocuments({});
    
    console.log(`📊 Remaining August payrolls: ${remainingAugust}`);
    console.log(`📊 Total remaining payrolls: ${totalRemaining}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
connectDB().then(clearAugustPayrolls);
