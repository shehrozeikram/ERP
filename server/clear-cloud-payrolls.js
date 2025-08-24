const mongoose = require('mongoose');

async function clearCloudPayrolls() {
  try {
    console.log('☁️ Clearing Payrolls from MongoDB Atlas (Cloud Database)');
    console.log('---');
    
    // Connect to the cloud database that the frontend is using
    const MONGODB_URI = 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority';
    
    console.log('🔗 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = mongoose.connection.db;
    
    console.log('📊 Database Name:', db.databaseName);
    console.log('📊 Host:', mongoose.connection.host);
    
    // Check payrolls collection
    const payrollCount = await db.collection('payrolls').countDocuments();
    console.log('📊 Payrolls Collection:', payrollCount + ' records');
    
    // Check payslips collection
    const payslipCount = await db.collection('payslips').countDocuments();
    console.log('📊 Payslips Collection:', payslipCount + ' records');
    
    if (payrollCount === 0 && payslipCount === 0) {
      console.log('✅ Cloud database is already clean');
      return;
    }
    
    console.log('---');
    console.log('🗑️ Clearing all payroll data...');
    
    // Clear payrolls
    if (payrollCount > 0) {
      const payrollResult = await db.collection('payrolls').deleteMany({});
      console.log(`✅ Deleted ${payrollResult.deletedCount} payroll records`);
    }
    
    // Clear payslips
    if (payslipCount > 0) {
      const payslipResult = await db.collection('payslips').deleteMany({});
      console.log(`✅ Deleted ${payslipResult.deletedCount} payslip records`);
    }
    
    console.log('---');
    console.log('🎯 All monthly payroll data cleared from cloud database!');
    console.log('🔄 Frontend should now show empty payroll summary');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB Atlas');
  }
}

// Run the script
clearCloudPayrolls();
