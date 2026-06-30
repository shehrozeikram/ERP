const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Employee = require('../server/models/hr/Employee');

const employeesToAdd = [
  { employeeId: '5390', name: 'Waqar Ali' },
  { employeeId: '6008', name: 'Waqar Ahmed Chugtai' },
  { employeeId: '6279', name: 'Muhammad Waqar' },
  { employeeId: '6382', name: 'Waqar Hassan Shahab' },
  { employeeId: '6468', name: 'Waqar Younas' }
];

async function addEmployees() {
  // Try to use the production URI from the commented out string in .env
  // From the user's .env: MONGODB_URI=mongodb://shehroze:Cricket%23007@ac-pqbby5q-shard-00-00.fss65hf.mongodb.net:27017,ac-pqbby5q-shard-00-01.fss65hf.mongodb.net:27017,ac-pqbby5q-shard-00-02.fss65hf.mongodb.net:27017/sgc_erp?retryWrites=true&w=majority&ssl=true&authSource=admin
  const uri = process.env.MONGODB_URI || 'mongodb://shehroze:Cricket%23007@ac-pqbby5q-shard-00-00.fss65hf.mongodb.net:27017,ac-pqbby5q-shard-00-01.fss65hf.mongodb.net:27017,ac-pqbby5q-shard-00-02.fss65hf.mongodb.net:27017/sgc_erp?retryWrites=true&w=majority&ssl=true&authSource=admin';
  
  console.log(`🔌 Connecting to: ${uri}`);
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    for (const emp of employeesToAdd) {
      const nameParts = emp.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      const newEmp = new Employee({
        employeeId: emp.employeeId,
        firstName: firstName,
        lastName: lastName,
        phone: '0000000000',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        idCard: `00000-0000000-${emp.employeeId}`, // Must be unique
        nationality: 'Pakistani',
        probationPeriodMonths: 3,
        appointmentDate: new Date(),
        qualification: 'N/A',
        emergencyContact: {
          name: 'N/A',
          relationship: 'N/A',
          phone: '0000000000'
        },
        address: {
          street: 'N/A',
          city: 'N/A',
          state: 'N/A',
          country: 'Pakistan'
        },
        // Optional but might be good to have to avoid issues in UI
        employmentStatus: 'Active',
        isActive: true
      });

      try {
        const savedEmp = await newEmp.save();
        console.log(`✅ Added ${emp.name} (ID: ${emp.employeeId})`);
      } catch (err) {
        if (err.code === 11000) {
          console.log(`⚠️ Employee ${emp.employeeId} (${emp.name}) already exists or has duplicate fields.`);
        } else {
          console.error(`❌ Error adding ${emp.name} (ID: ${emp.employeeId}):`, err.message);
        }
      }
    }

  } catch (error) {
    console.error('❌ Database connection error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Connection closed');
  }
}

addEmployees();
