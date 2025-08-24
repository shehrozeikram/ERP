const mongoose = require('mongoose');
require('./models/hr/Employee');

async function findEmployee6377() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    const Employee = mongoose.model('Employee');
    
    console.log('\n🔍 SEARCHING FOR EMPLOYEE ID 6377');
    console.log('=' .repeat(80));
    
    // Search for exact employee ID 6377
    const employee6377 = await Employee.findOne({ employeeId: '6377' });
    
    if (employee6377) {
      console.log('✅ EMPLOYEE ID 6377 FOUND!');
      console.log('\n📋 BASIC INFORMATION:');
      console.log('MongoDB ID:', employee6377._id);
      console.log('Name:', employee6377.firstName, employee6377.lastName);
      console.log('Email:', employee6377.email || 'N/A');
      console.log('Phone:', employee6377.phone || 'N/A');
      console.log('Date of Birth:', employee6377.dateOfBirth ? employee6377.dateOfBirth.toLocaleDateString() : 'N/A');
      console.log('Gender:', employee6377.gender || 'N/A');
      console.log('ID Card:', employee6377.idCard || 'N/A');
      console.log('Nationality:', employee6377.nationality || 'N/A');
      console.log('Religion:', employee6377.religion || 'N/A');
      console.log('Marital Status:', employee6377.maritalStatus || 'N/A');
      
      console.log('\n🏢 EMPLOYMENT DETAILS:');
      console.log('Department:', employee6377.department || 'N/A');
      console.log('Position:', employee6377.position || 'N/A');
      console.log('Employment Type:', employee6377.employmentType || 'N/A');
      console.log('Employment Status:', employee6377.employmentStatus || 'N/A');
      console.log('Hire Date:', employee6377.hireDate ? employee6377.hireDate.toLocaleDateString() : 'N/A');
      console.log('Appointment Date:', employee6377.appointmentDate ? employee6377.appointmentDate.toLocaleDateString() : 'N/A');
      console.log('Probation Period:', employee6377.probationPeriodMonths || 'N/A', 'months');
      console.log('End of Probation:', employee6377.endOfProbationDate ? employee6377.endOfProbationDate.toLocaleDateString() : 'N/A');
      console.log('Confirmation Date:', employee6377.confirmationDate ? employee6377.confirmationDate.toLocaleDateString() : 'N/A');
      console.log('Is Active:', employee6377.isActive);
      console.log('Is Deleted:', employee6377.isDeleted);
      
      console.log('\n💰 SALARY & ALLOWANCES:');
      if (employee6377.salary) {
        console.log('Salary Structure:', employee6377.salaryStructure || 'N/A');
        console.log('Gross Salary:', employee6377.salary.gross || 'N/A');
        console.log('Basic Salary:', employee6377.salary.basic || 'N/A');
        console.log('House Rent:', employee6377.salary.houseRent || 'N/A');
        console.log('Medical:', employee6377.salary.medical || 'N/A');
      } else {
        console.log('❌ No salary information found');
      }
      
      if (employee6377.allowances) {
        console.log('\n📋 ALLOWANCES:');
        console.log('Conveyance:', employee6377.allowances.conveyance?.isActive ? `${employee6377.allowances.conveyance.amount} PKR` : 'Inactive');
        console.log('Food:', employee6377.allowances.food?.isActive ? `${employee6377.allowances.food.amount} PKR` : 'Inactive');
        console.log('Vehicle & Fuel:', employee6377.allowances.vehicleFuel?.isActive ? `${employee6377.allowances.vehicleFuel.amount} PKR` : 'Inactive');
        console.log('Medical:', employee6377.allowances.medical?.isActive ? `${employee6377.allowances.medical.amount} PKR` : 'Inactive');
        console.log('Special:', employee6377.allowances.special?.isActive ? `${employee6377.allowances.special.amount} PKR` : 'Inactive');
        console.log('Other:', employee6377.allowances.other?.isActive ? `${employee6377.allowances.other.amount} PKR` : 'Inactive');
      } else {
        console.log('\n❌ No allowances information found');
      }
      
      console.log('\n🏦 BANK & BENEFITS:');
      console.log('Bank Name:', employee6377.bankName || 'N/A');
      console.log('Currency:', employee6377.currency || 'N/A');
      console.log('Tax Exemption:', employee6377.taxExemption || 'N/A');
      console.log('Tax Exemption Amount:', employee6377.taxExemptionAmount || 'N/A');
      
      console.log('\n📅 TIMESTAMPS:');
      console.log('Created At:', employee6377.createdAt ? employee6377.createdAt.toLocaleString() : 'N/A');
      console.log('Updated At:', employee6377.updatedAt ? employee6377.updatedAt.toLocaleString() : 'N/A');
      
      console.log('\n🔗 REFERENCES:');
      console.log('Candidate ID:', employee6377.candidateId || 'N/A');
      console.log('Approval ID:', employee6377.approvalId || 'N/A');
      console.log('Onboarding ID:', employee6377.onboardingId || 'N/A');
      
      // Show full allowances object if it exists
      if (employee6377.allowances) {
        console.log('\n📋 COMPLETE ALLOWANCES OBJECT:');
        console.log(JSON.stringify(employee6377.allowances, null, 2));
      }
      
    } else {
      console.log('❌ Employee ID 6377 not found');
      
      // Search for similar IDs
      console.log('\n🔍 SEARCHING FOR SIMILAR IDs...');
      const similarIds = await Employee.find({
        employeeId: { $regex: '637' }
      }).select('employeeId firstName lastName email');
      
      if (similarIds.length > 0) {
        console.log('Found employees with similar IDs:');
        similarIds.forEach(emp => {
          console.log(`- ${emp.firstName} ${emp.lastName} (ID: ${emp.employeeId}, Email: ${emp.email})`);
        });
      } else {
        console.log('No employees found with IDs containing "637"');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

findEmployee6377();
