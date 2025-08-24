const mongoose = require('mongoose');
const Payroll = require('./models/hr/Payroll');

async function checkPayrollMonths() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    // Get all payrolls with month and year
    const payrolls = await Payroll.find({}).select('month year employee').populate('employee', 'employeeId firstName lastName');
    
    if (payrolls.length > 0) {
      console.log(`\n=== FOUND ${payrolls.length} PAYROLLS ===`);
      
      // Group by month/year
      const grouped = {};
      payrolls.forEach(p => {
        const key = `${p.year}-${p.month.toString().padStart(2, '0')}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(p);
      });
      
      // Display grouped payrolls
      Object.keys(grouped).sort().forEach(key => {
        console.log(`\n--- ${key} (${grouped[key].length} payrolls) ---`);
        grouped[key].forEach(p => {
          console.log(`  Employee ${p.employee?.employeeId}: ${p.employee?.firstName} ${p.employee?.lastName}`);
        });
      });
      
      // Check for employee 6377 specifically
      const employee6377Payrolls = payrolls.filter(p => p.employee && p.employee.employeeId === '6377');
      if (employee6377Payrolls.length > 0) {
        console.log('\n=== EMPLOYEE 6377 PAYROLLS ===');
        employee6377Payrolls.forEach(p => {
          console.log(`Month: ${p.month}, Year: ${p.year}`);
        });
      } else {
        console.log('\nNo payrolls found for employee 6377');
      }
      
    } else {
      console.log('No payrolls found in the system');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

checkPayrollMonths();
