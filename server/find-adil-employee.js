const mongoose = require('mongoose');
require('./models/hr/Employee'); // Register Employee model

async function findAdilEmployee() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    const Employee = mongoose.model('Employee');
    
    // Search for Adil Aamir with different variations
    console.log('\n=== SEARCHING FOR ADIL AAMIR IN EMPLOYEE TABLE ===');
    
    // Search by exact name
    const exactMatch = await Employee.findOne({
      firstName: 'Adil',
      lastName: 'Aamir'
    });
    
    if (exactMatch) {
      console.log('✅ EXACT MATCH FOUND!');
      console.log('MongoDB ID:', exactMatch._id);
      console.log('Employee ID:', exactMatch.employeeId);
      console.log('Name:', exactMatch.firstName, exactMatch.lastName);
      console.log('Email:', exactMatch.email || 'N/A');
      console.log('Phone:', exactMatch.phone || 'N/A');
      console.log('Department:', exactMatch.department || 'N/A');
      console.log('Position:', exactMatch.position || 'N/A');
      
      // Check salary structure
      if (exactMatch.salary) {
        console.log('\n=== SALARY STRUCTURE ===');
        console.log('Gross Salary:', exactMatch.salary.gross || 'N/A');
        console.log('Basic Salary:', exactMatch.salary.basic || 'N/A');
      }
      
      // Check allowances
      if (exactMatch.allowances) {
        console.log('\n=== ALLOWANCES STRUCTURE ===');
        console.log(JSON.stringify(exactMatch.allowances, null, 2));
        
        console.log('\n=== INDIVIDUAL ALLOWANCES ===');
        console.log('Conveyance:', exactMatch.allowances.conveyance?.isActive ? exactMatch.allowances.conveyance.amount : 'Inactive');
        console.log('Food:', exactMatch.allowances.food?.isActive ? exactMatch.allowances.food.amount : 'Inactive');
        console.log('Vehicle & Fuel:', exactMatch.allowances.vehicleFuel?.isActive ? exactMatch.allowances.vehicleFuel.amount : 'Inactive');
        console.log('Medical:', exactMatch.allowances.medical?.isActive ? exactMatch.allowances.medical.amount : 'Inactive');
        console.log('Special:', exactMatch.allowances.special?.isActive ? exactMatch.allowances.special.amount : 'Inactive');
        console.log('Other:', exactMatch.allowances.other?.isActive ? exactMatch.allowances.other.amount : 'Inactive');
      } else {
        console.log('\n❌ NO ALLOWANCES FOUND');
      }
      
    } else {
      console.log('❌ No exact match found');
    }
    
    // Search by partial name
    console.log('\n=== SEARCHING BY PARTIAL NAMES ===');
    const partialMatches = await Employee.find({
      $or: [
        { firstName: { $regex: 'Adil', $options: 'i' } },
        { lastName: { $regex: 'Aamir', $options: 'i' } }
      ]
    }).select('firstName lastName employeeId _id email phone department position');
    
    if (partialMatches.length > 0) {
      console.log(`Found ${partialMatches.length} partial matches:`);
      partialMatches.forEach(emp => {
        console.log(`\n- ${emp.firstName} ${emp.lastName}`);
        console.log(`  Employee ID: ${emp.employeeId}`);
        console.log(`  MongoDB ID: ${emp._id}`);
        console.log(`  Email: ${emp.email || 'N/A'}`);
        console.log(`  Phone: ${emp.phone || 'N/A'}`);
        console.log(`  Department: ${emp.department || 'N/A'}`);
        console.log(`  Position: ${emp.position || 'N/A'}`);
      });
    }
    
    // Search for employee ID 06377 specifically
    console.log('\n=== SEARCHING FOR EMPLOYEE ID 06377 ===');
    const id06377 = await Employee.findOne({ employeeId: '06377' });
    
    if (id06377) {
      console.log('✅ EMPLOYEE ID 06377 FOUND!');
      console.log('Name:', id06377.firstName, id06377.lastName);
      console.log('MongoDB ID:', id06377._id);
      console.log('Email:', id06377.email || 'N/A');
      console.log('Phone:', id06377.phone || 'N/A');
      
      if (id06377.allowances) {
        console.log('\n=== ALLOWANCES FOR 06377 ===');
        console.log(JSON.stringify(id06377.allowances, null, 2));
      }
    } else {
      console.log('❌ Employee ID 06377 not found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

findAdilEmployee();
