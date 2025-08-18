const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Payroll = require('./models/hr/Payroll');

async function clearAllPayrolls() {
  try {
    console.log('🔍 Checking current payroll count...');
    
    // Count existing payrolls
    const totalPayrolls = await Payroll.countDocuments({});
    console.log(`📊 Found ${totalPayrolls} payroll records in database`);
    
    if (totalPayrolls === 0) {
      console.log('✅ No payroll records to delete');
      process.exit(0);
    }
    
    console.log('🗑️  Deleting all payroll records...');
    
    // Delete all payrolls
    const result = await Payroll.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.deletedCount} payroll records`);
    console.log('🎉 Database cleared! You can now create fresh payrolls.');
    
  } catch (error) {
    console.error('❌ Error clearing payrolls:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the script
clearAllPayrolls();
