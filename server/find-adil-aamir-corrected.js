const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' }); // Load .env from parent directory
require('./models/hr/Employee');

async function findAdilAamirCorrected() {
  try {
    // Use the correct MongoDB Atlas connection string
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority';
    
    console.log('🔌 Connecting to MongoDB Atlas...');
    console.log('Host: erp.fss65hf.mongodb.net');
    console.log('Database: sgc_erp');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      ssl: true,
      sslValidate: true,
      retryWrites: true,
      w: 'majority',
      connectTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
    });
    
    console.log('✅ Connected to MongoDB Atlas successfully!');
    
    const Employee = mongoose.model('Employee');
    
    console.log('\n🔍 SEARCHING FOR ADIL AAMIR IN CORRECT DATABASE');
    console.log('=' .repeat(80));
    
    // Search for Adil Aamir by name
    console.log('\n📋 1. SEARCHING BY NAME: "Adil Aamir"');
    console.log('-'.repeat(40));
    
    const adilByName = await Employee.find({
      $or: [
        { firstName: 'Adil', lastName: 'Aamir' },
        { firstName: { $regex: 'Adil', $options: 'i' } },
        { lastName: { $regex: 'Aamir', $options: 'i' } }
      ]
    });
    
    if (adilByName.length > 0) {
      console.log(`✅ Found ${adilByName.length} employee(s) with name "Adil Aamir":`);
      adilByName.forEach((emp, index) => {
        console.log(`\n${index + 1}. ${emp.firstName} ${emp.lastName}`);
        console.log(`   🆔 Employee ID: ${emp.employeeId}`);
        console.log(`   📧 Email: ${emp.email}`);
        console.log(`   📱 Phone: ${emp.phone}`);
        console.log(`   🆔 MongoDB ID: ${emp._id}`);
        console.log(`   📊 Status: ${emp.employmentStatus || 'N/A'}`);
        console.log(`   📅 Hire Date: ${emp.hireDate ? emp.hireDate.toLocaleDateString() : 'N/A'}`);
      });
    } else {
      console.log('❌ No employees found with name "Adil Aamir"');
    }
    
    // Search for employee ID 6377
    console.log('\n📋 2. SEARCHING BY EMPLOYEE ID: "6377"');
    console.log('-'.repeat(40));
    
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
    }
    
    // Search for employee ID 06377
    console.log('\n📋 3. SEARCHING BY EMPLOYEE ID: "06377"');
    console.log('-'.repeat(40));
    
    const employee06377 = await Employee.findOne({ employeeId: '06377' });
    
    if (employee06377) {
      console.log('✅ EMPLOYEE ID 06377 FOUND!');
      console.log('Name:', employee06377.firstName, employee06377.lastName);
      console.log('Email:', employee06377.email);
      console.log('MongoDB ID:', employee06377._id);
    } else {
      console.log('❌ Employee ID 06377 not found');
    }
    
    // Show total employee count
    console.log('\n📋 4. DATABASE OVERVIEW');
    console.log('-'.repeat(40));
    
    const totalEmployees = await Employee.countDocuments();
    console.log(`Total employees in database: ${totalEmployees}`);
    
    // Show some sample employees
    const sampleEmployees = await Employee.find().limit(5).select('employeeId firstName lastName email');
    console.log('\nSample employees:');
    sampleEmployees.forEach((emp, index) => {
      console.log(`${index + 1}. ${emp.firstName} ${emp.lastName} (ID: ${emp.employeeId}, Email: ${emp.email})`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('🔍 SEARCH COMPLETED IN CORRECT DATABASE');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.name === 'MongoNetworkError') {
      console.error('🔌 Network Error: Check your internet connection and MongoDB Atlas access');
    } else if (error.name === 'MongoServerSelectionError') {
      console.error('🔌 Server Selection Error: Check your connection string and credentials');
    }
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

findAdilAamirCorrected();
