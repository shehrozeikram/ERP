const mongoose = require('mongoose');
require('./models/hr/Employee'); // Register Employee model
const Payroll = require('./models/hr/Payroll');

async function searchAdil() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    const Employee = mongoose.model('Employee');
    
    // Search for Adil Aamir with different ID variations
    const searchVariations = ['06377', '6377', '0637', '637'];
    
    console.log('\n=== SEARCHING FOR ADIL AAMIR ===');
    
    for (const id of searchVariations) {
      console.log(`\nSearching for employee ID: ${id}`);
      const employee = await Employee.findOne({ employeeId: id }).select('firstName lastName employeeId _id allowances');
      
      if (employee) {
        console.log('✅ FOUND!');
        console.log('MongoDB ID:', employee._id);
        console.log('Employee ID:', employee.employeeId);
        console.log('Name:', employee.firstName, employee.lastName);
        
        if (employee.allowances) {
          console.log('\n=== EMPLOYEE ALLOWANCES ===');
          console.log('Conveyance:', employee.allowances.conveyance?.isActive ? employee.allowances.conveyance.amount : 'Inactive');
          console.log('Food:', employee.allowances.food?.isActive ? employee.allowances.food.amount : 'Inactive');
          console.log('Vehicle & Fuel:', employee.allowances.vehicleFuel?.isActive ? employee.allowances.vehicleFuel.amount : 'Inactive');
          console.log('Medical:', employee.allowances.medical?.isActive ? employee.allowances.medical.amount : 'Inactive');
          console.log('Special:', employee.allowances.special?.isActive ? employee.allowances.special.amount : 'Inactive');
          console.log('Other:', employee.allowances.other?.isActive ? employee.allowances.other.amount : 'Inactive');
        }
        
        // Now check payrolls for this employee
        console.log('\n=== CHECKING PAYROLLS ===');
        const payrolls = await Payroll.find({}).populate('employee', 'firstName lastName employeeId');
        const employeePayrolls = payrolls.filter(p => p.employee && p.employee.employeeId === employee.employeeId);
        
        if (employeePayrolls.length > 0) {
          console.log(`Found ${employeePayrolls.length} payrolls:`);
          employeePayrolls.forEach(p => {
            console.log(`\n--- Month: ${p.month}, Year: ${p.year} ---`);
            console.log('Basic Salary:', p.basicSalary);
            console.log('Gross Salary:', p.grossSalary);
            
            if (p.allowances) {
              console.log('Vehicle & Fuel Allowance:', p.allowances.vehicleFuel?.isActive ? p.allowances.vehicleFuel.amount : 'Inactive');
            }
            console.log('Legacy fields - Other Allowance:', p.otherAllowance);
          });
        } else {
          console.log('No payrolls found for this employee');
        }
        break;
      } else {
        console.log('❌ Not found');
      }
    }
    
    // Also search by name
    console.log('\n=== SEARCHING BY NAME ===');
    const nameResults = await Employee.find({
      $or: [
        { firstName: { $regex: 'Adil', $options: 'i' } },
        { lastName: { $regex: 'Aamir', $options: 'i' } },
        { firstName: { $regex: 'Aamir', $options: 'i' } },
        { lastName: { $regex: 'Adil', $options: 'i' } }
      ]
    }).select('firstName lastName employeeId');
    
    if (nameResults.length > 0) {
      console.log('Found employees with similar names:');
      nameResults.forEach(emp => {
        console.log(`- ${emp.firstName} ${emp.lastName} (ID: ${emp.employeeId})`);
      });
    } else {
      console.log('No employees found with name containing "Adil" or "Aamir"');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

searchAdil();
