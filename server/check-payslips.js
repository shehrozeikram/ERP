const mongoose = require('mongoose');

async function checkPayslips() {
  try {
    console.log('🔍 Checking Payslips Collection...');
    
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    const db = mongoose.connection.db;
    
    const payslips = await db.collection('payslips').find({}).toArray();
    console.log('📊 Total Payslips:', payslips.length);
    
    if (payslips.length > 0) {
      console.log('---');
      console.log('📅 Payslips by Month:');
      
      const monthGroups = {};
      payslips.forEach(p => {
        const key = `${p.month}/${p.year}`;
        if (!monthGroups[key]) monthGroups[key] = [];
        monthGroups[key].push(p);
      });
      
      Object.keys(monthGroups).forEach(month => {
        console.log(`📅 ${month}: ${monthGroups[month].length} payslips`);
      });
      
      console.log('---');
      console.log('📋 Sample Payslip:');
      console.log('Month:', payslips[0].month);
      console.log('Year:', payslips[0].year);
      console.log('Employee:', payslips[0].employeeName);
      console.log('Status:', payslips[0].status);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkPayslips();
