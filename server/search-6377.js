const mongoose = require('mongoose');
require('./models/hr/Employee'); // Register Employee model

async function search6377() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    const Employee = mongoose.model('Employee');
    
    console.log('\n=== SEARCHING FOR EMPLOYEE ID 6377 ===');
    
    // Search for exact employee ID 6377
    const employee6377 = await Employee.findOne({ employeeId: '6377' });
    
    if (employee6377) {
      console.log('✅ EMPLOYEE ID 6377 FOUND!');
      console.log('MongoDB ID:', employee6377._id);
      console.log('Name:', employee6377.firstName, employee6377.lastName);
      console.log('Email:', employee6377.email || 'N/A');
      console.log('Phone:', employee6377.phone || 'N/A');
      console.log('Department:', employee6377.department || 'N/A');
      console.log('Position:', employee6377.position || 'N/A');
      
      // Check salary structure
      if (employee6377.salary) {
        console.log('\n=== SALARY STRUCTURE ===');
        console.log('Gross Salary:', employee6377.salary.gross || 'N/A');
        console.log('Basic Salary:', employee6377.salary.basic || 'N/A');
      }
      
      // Check allowances
      if (employee6377.allowances) {
        console.log('\n=== ALLOWANCES STRUCTURE ===');
        console.log(JSON.stringify(employee6377.allowances, null, 2));
        
        console.log('\n=== INDIVIDUAL ALLOWANCES ===');
        console.log('Conveyance:', employee6377.allowances.conveyance?.isActive ? employee6377.allowances.conveyance.amount : 'Inactive');
        console.log('Food:', employee6377.allowances.food?.isActive ? employee6377.allowances.food.amount : 'Inactive');
        console.log('Vehicle & Fuel:', employee6377.allowances.vehicleFuel?.isActive ? employee6377.allowances.vehicleFuel.amount : 'Inactive');
        console.log('Medical:', employee6377.allowances.medical?.isActive ? employee6377.allowances.medical.amount : 'Inactive');
        console.log('Special:', employee6377.allowances.special?.isActive ? employee6377.allowances.special.amount : 'Inactive');
        console.log('Other:', employee6377.allowances.other?.isActive ? employee6377.allowances.other.amount : 'Inactive');
      } else {
        console.log('\n❌ NO ALLOWANCES FOUND');
      }
      
    } else {
      console.log('❌ Employee ID 6377 not found');
      
      // Search for similar IDs
      console.log('\n=== SEARCHING FOR SIMILAR IDs ===');
      const similarIds = await Employee.find({
        employeeId: { $regex: '637' }
      }).select('employeeId firstName lastName');
      
      if (similarIds.length > 0) {
        console.log('Found employees with similar IDs:');
        similarIds.forEach(emp => {
          console.log(`- ${emp.firstName} ${emp.lastName} (ID: ${emp.employeeId})`);
        });
      } else {
        console.log('No employees found with IDs containing "637"');
      }
      
      // Search for employee ID 06377 (with leading zero)
      console.log('\n=== SEARCHING FOR EMPLOYEE ID 06377 ===');
      const employee06377 = await Employee.findOne({ employeeId: '06377' });
      
      if (employee06377) {
        console.log('✅ EMPLOYEE ID 06377 FOUND!');
        console.log('Name:', employee06377.firstName, employee06377.lastName);
        console.log('MongoDB ID:', employee06377._id);
        
        if (employee06377.allowances) {
          console.log('\n=== ALLOWANCES FOR 06377 ===');
          console.log(JSON.stringify(employee06377.allowances, null, 2));
        }
      } else {
        console.log('❌ Employee ID 06377 not found either');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

search6377();
