const mongoose = require('mongoose');
require('./models/hr/Employee');

async function findEmployee6035() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    const Employee = mongoose.model('Employee');
    
    console.log('\n🔍 SEARCHING FOR EMPLOYEE ID 6035');
    console.log('=' .repeat(80));
    
    // Search for exact employee ID 6035
    const employee6035 = await Employee.findOne({ employeeId: '6035' });
    
    if (employee6035) {
      console.log('✅ EMPLOYEE ID 6035 FOUND!');
      console.log('\n📋 BASIC INFORMATION:');
      console.log('MongoDB ID:', employee6035._id);
      console.log('Name:', employee6035.firstName, employee6035.lastName);
      console.log('Email:', employee6035.email || 'N/A');
      console.log('Phone:', employee6035.phone || 'N/A');
      console.log('Date of Birth:', employee6035.dateOfBirth ? employee6035.dateOfBirth.toLocaleDateString() : 'N/A');
      console.log('Gender:', employee6035.gender || 'N/A');
      console.log('ID Card:', employee6035.idCard || 'N/A');
      console.log('Nationality:', employee6035.nationality || 'N/A');
      console.log('Religion:', employee6035.religion || 'N/A');
      console.log('Marital Status:', employee6035.maritalStatus || 'N/A');
      
      console.log('\n🏢 EMPLOYMENT DETAILS:');
      console.log('Department:', employee6035.department || 'N/A');
      console.log('Position:', employee6035.position || 'N/A');
      console.log('Employment Type:', employee6035.employmentType || 'N/A');
      console.log('Employment Status:', employee6035.employmentStatus || 'N/A');
      console.log('Hire Date:', employee6035.hireDate ? employee6035.hireDate.toLocaleDateString() : 'N/A');
      console.log('Appointment Date:', employee6035.appointmentDate ? employee6035.appointmentDate.toLocaleDateString() : 'N/A');
      console.log('Probation Period:', employee6035.probationPeriodMonths || 'N/A', 'months');
      console.log('End of Probation:', employee6035.endOfProbationDate ? employee6035.endOfProbationDate.toLocaleDateString() : 'N/A');
      console.log('Confirmation Date:', employee6035.confirmationDate ? employee6035.confirmationDate.toLocaleDateString() : 'N/A');
      console.log('Is Active:', employee6035.isActive);
      console.log('Is Deleted:', employee6035.isDeleted);
      
      console.log('\n💰 SALARY & ALLOWANCES:');
      if (employee6035.salary) {
        console.log('Salary Structure:', employee6035.salaryStructure || 'N/A');
        console.log('Gross Salary:', employee6035.salary.gross || 'N/A');
        console.log('Basic Salary:', employee6035.salary.basic || 'N/A');
        console.log('House Rent:', employee6035.salary.houseRent || 'N/A');
        console.log('Medical:', employee6035.salary.medical || 'N/A');
      } else {
        console.log('❌ No salary information found');
      }
      
      if (employee6035.allowances) {
        console.log('\n📋 ALLOWANCES:');
        console.log('Conveyance:', employee6035.allowances.conveyance?.isActive ? `${employee6035.allowances.conveyance.amount} PKR` : 'Inactive');
        console.log('Food:', employee6035.allowances.food?.isActive ? `${employee6035.allowances.food.amount} PKR` : 'Inactive');
        console.log('Vehicle & Fuel:', employee6035.allowances.vehicleFuel?.isActive ? `${employee6035.allowances.vehicleFuel.amount} PKR` : 'Inactive');
        console.log('Medical:', employee6035.allowances.medical?.isActive ? `${employee6035.allowances.medical.amount} PKR` : 'Inactive');
        console.log('Special:', employee6035.allowances.special?.isActive ? `${employee6035.allowances.special.amount} PKR` : 'Inactive');
        console.log('Other:', employee6035.allowances.other?.isActive ? `${employee6035.allowances.other.amount} PKR` : 'Inactive');
      } else {
        console.log('\n❌ No allowances information found');
      }
      
      console.log('\n🏦 BANK & BENEFITS:');
      console.log('Bank Name:', employee6035.bankName || 'N/A');
      console.log('Currency:', employee6035.currency || 'N/A');
      console.log('Tax Exemption:', employee6035.taxExemption || 'N/A');
      console.log('Tax Exemption Amount:', employee6035.taxExemptionAmount || 'N/A');
      
      console.log('\n📅 TIMESTAMPS:');
      console.log('Created At:', employee6035.createdAt ? employee6035.createdAt.toLocaleString() : 'N/A');
      console.log('Updated At:', employee6035.updatedAt ? employee6035.updatedAt.toLocaleString() : 'N/A');
      
      console.log('\n🔗 REFERENCES:');
      console.log('Candidate ID:', employee6035.candidateId || 'N/A');
      console.log('Approval ID:', employee6035.approvalId || 'N/A');
      console.log('Onboarding ID:', employee6035.onboardingId || 'N/A');
      
      // Show full allowances object if it exists
      if (employee6035.allowances) {
        console.log('\n📋 COMPLETE ALLOWANCES OBJECT:');
        console.log(JSON.stringify(employee6035.allowances, null, 2));
      }
      
    } else {
      console.log('❌ Employee ID 6035 not found');
      
      // Search for similar IDs
      console.log('\n🔍 SEARCHING FOR SIMILAR IDs...');
      const similarIds = await Employee.find({
        employeeId: { $regex: '603' }
      }).select('employeeId firstName lastName email');
      
      if (similarIds.length > 0) {
        console.log('Found employees with similar IDs:');
        similarIds.forEach(emp => {
          console.log(`- ${emp.firstName} ${emp.lastName} (ID: ${emp.employeeId}, Email: ${emp.email})`);
        });
      } else {
        console.log('No employees found with IDs containing "603"');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

findEmployee6035();
