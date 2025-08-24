const mongoose = require('mongoose');

async function clearAllPayslips() {
  try {
    console.log('🗑️ Clearing All Payslips (Monthly Payroll Data)');
    console.log('---');
    
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    const db = mongoose.connection.db;
    
    // Count existing payslips
    const count = await db.collection('payslips').countDocuments();
    console.log(`📊 Found ${count} payslip records`);
    
    if (count === 0) {
      console.log('✅ No payslip records to delete');
      return;
    }
    
    // Delete all payslips
    const result = await db.collection('payslips').deleteMany({});
    
    console.log('---');
    console.log(`✅ Successfully deleted ${result.deletedCount} payslip records`);
    console.log('🎯 All monthly payroll data (payslips) have been removed');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the script
clearAllPayslips();
