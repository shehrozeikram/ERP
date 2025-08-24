const mongoose = require('mongoose');

async function checkDatabase() {
  try {
    console.log('🔍 Checking Database Connection Details...');
    console.log('---');
    
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    
    console.log('📊 Database Connection Info:');
    console.log('Host:', mongoose.connection.host);
    console.log('Port:', mongoose.connection.port);
    console.log('Database Name:', mongoose.connection.name);
    console.log('Connection String:', mongoose.connection.client.s.url);
    
    console.log('---');
    console.log('📚 Collections in this database:');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    collections.forEach(col => {
      console.log('- ' + col.name);
    });
    
    console.log('---');
    console.log('📊 Payroll-related Collections Status:');
    
    // Check payrolls collection
    const payrollCount = await db.collection('payrolls').countDocuments();
    console.log('Payrolls Collection:', payrollCount + ' records');
    
    // Check payslips collection
    const payslipCount = await db.collection('payslips').countDocuments();
    console.log('Payslips Collection:', payslipCount + ' records');
    
    // Check if there are other payroll-related collections
    const payrollCollections = collections.filter(col => 
      col.name.toLowerCase().includes('payroll') || 
      col.name.toLowerCase().includes('payslip') ||
      col.name.toLowerCase().includes('salary')
    );
    
    if (payrollCollections.length > 0) {
      console.log('---');
      console.log('🔍 Other Payroll-related Collections:');
      payrollCollections.forEach(col => {
        console.log('- ' + col.name);
      });
    }
    
    console.log('---');
    console.log('✅ Database check complete');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the check
checkDatabase();
