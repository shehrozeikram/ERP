const mongoose = require('mongoose');
require('./models/hr/Employee');

async function findEmployee06377() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    const Employee = mongoose.model('Employee');
    
    console.log('\n🔍 SEARCHING FOR EMPLOYEE ID 06377');
    console.log('=' .repeat(80));
    
    // Search for exact employee ID 06377
    const employee06377 = await Employee.findOne({ employeeId: '06377' });
    
    if (employee06377) {
      console.log('✅ EMPLOYEE ID 06377 FOUND!');
      console.log('\n📋 BASIC INFORMATION:');
      console.log('MongoDB ID:', employee06377._id);
      console.log('Name:', employee06377.firstName, employee06377.lastName);
      console.log('Email:', employee06377.email || 'N/A');
      console.log('Phone:', employee06377.phone || 'N/A');
      console.log('Date of Birth:', employee06377.dateOfBirth ? employee06377.dateOfBirth.toLocaleDateString() : 'N/A');
      console.log('Gender:', employee06377.gender || 'N/A');
      console.log('ID Card:', employee06377.idCard || 'N/A');
      console.log('Nationality:', employee06377.nationality || 'N/A');
      console.log('Religion:', employee06377.religion || 'N/A');
      console.log('Marital Status:', employee06377.maritalStatus || 'N/A');
      
      console.log('\n🏢 EMPLOYMENT DETAILS:');
      console.log('Department:', employee06377.department || 'N/A');
      console.log('Position:', employee06377.position || 'N/A');
      console.log('Employment Type:', employee06377.employmentType || 'N/A');
      console.log('Employment Status:', employee06377.employmentStatus || 'N/A');
      console.log('Hire Date:', employee06377.hireDate ? employee06377.hireDate.toLocaleDateString() : 'N/A');
      console.log('Appointment Date:', employee06377.appointmentDate ? employee06377.appointmentDate.toLocaleDateString() : 'N/A');
      console.log('Probation Period:', employee06377.probationPeriodMonths || 'N/A', 'months');
      console.log('End of Probation:', employee06377.endOfProbationDate ? employee06377.endOfProbationDate.toLocaleDateString() : 'N/A');
      console.log('Confirmation Date:', employee06377.confirmationDate ? employee06377.confirmationDate.toLocaleDateString() : 'N/A');
      console.log('Is Active:', employee06377.isActive);
      console.log('Is Deleted:', employee06377.isDeleted);
      
      console.log('\n💰 SALARY & ALLOWANCES:');
      if (employee06377.salary) {
        console.log('Salary Structure:', employee06377.salaryStructure || 'N/A');
        console.log('Gross Salary:', employee06377.salary.gross || 'N/A');
        console.log('Basic Salary:', employee06377.salary.basic || 'N/A');
        console.log('House Rent:', employee06377.salary.houseRent || 'N/A');
        console.log('Medical:', employee06377.salary.medical || 'N/A');
      } else {
        console.log('❌ No salary information found');
      }
      
      if (employee06377.allowances) {
        console.log('\n📋 ALLOWANCES:');
        console.log('Conveyance:', employee06377.allowances.conveyance?.isActive ? `${employee06377.allowances.conveyance.amount} PKR` : 'Inactive');
        console.log('Food:', employee06377.allowances.food?.isActive ? `${employee06377.allowances.food.amount} PKR` : 'Inactive');
        console.log('Vehicle & Fuel:', employee06377.allowances.vehicleFuel?.isActive ? `${employee06377.allowances.vehicleFuel.amount} PKR` : 'Inactive');
        console.log('Medical:', employee06377.allowances.medical?.isActive ? `${employee06377.allowances.medical.amount} PKR` : 'Inactive');
        console.log('Special:', employee06377.allowances.special?.isActive ? `${employee06377.allowances.special.amount} PKR` : 'Inactive');
        console.log('Other:', employee06377.allowances.other?.isActive ? `${employee06377.allowances.other.amount} PKR` : 'Inactive');
      } else {
        console.log('\n❌ No allowances information found');
      }
      
      console.log('\n🏦 BANK & BENEFITS:');
      console.log('Bank Name:', employee06377.bankName || 'N/A');
      console.log('Currency:', employee06377.currency || 'N/A');
      console.log('Tax Exemption:', employee06377.taxExemption || 'N/A');
      console.log('Tax Exemption Amount:', employee06377.taxExemptionAmount || 'N/A');
      
      console.log('\n📅 TIMESTAMPS:');
      console.log('Created At:', employee06377.createdAt ? employee06377.createdAt.toLocaleString() : 'N/A');
      console.log('Updated At:', employee06377.updatedAt ? employee06377.updatedAt.toLocaleString() : 'N/A');
      
      console.log('\n🔗 REFERENCES:');
      console.log('Candidate ID:', employee06377.candidateId || 'N/A');
      console.log('Approval ID:', employee06377.approvalId || 'N/A');
      console.log('Onboarding ID:', employee06377.onboardingId || 'N/A');
      
      // Show full allowances object if it exists
      if (employee06377.allowances) {
        console.log('\n📋 COMPLETE ALLOWANCES OBJECT:');
        console.log(JSON.stringify(employee06377.allowances, null, 2));
      }
      
    } else {
      console.log('❌ Employee ID 06377 not found');
      
      // Search for similar IDs
      console.log('\n🔍 SEARCHING FOR SIMILAR IDs...');
      const similarIds = await Employee.find({
        employeeId: { $regex: '063' }
      }).select('employeeId firstName lastName email');
      
      if (similarIds.length > 0) {
        console.log('Found employees with similar IDs:');
        similarIds.forEach(emp => {
          console.log(`- ${emp.firstName} ${emp.lastName} (ID: ${emp.employeeId}, Email: ${emp.email})`);
        });
      } else {
        console.log('No employees found with IDs containing "063"');
      }
      
      // Also search for employees with "637" in their ID
      console.log('\n🔍 SEARCHING FOR EMPLOYEES WITH "637" IN ID...');
      const employeesWith637 = await Employee.find({
        employeeId: { $regex: '637' }
      }).select('employeeId firstName lastName email');
      
      if (employeesWith637.length > 0) {
        console.log('Found employees with "637" in ID:');
        employeesWith637.forEach(emp => {
          console.log(`- ${emp.firstName} ${emp.lastName} (ID: ${emp.employeeId}, Email: ${emp.email})`);
        });
      } else {
        console.log('No employees found with "637" in ID');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

findEmployee06377();
