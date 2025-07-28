const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Department = require('../models/hr/Department');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function checkDepartments() {
  try {
    const departments = await Department.find({ isActive: true });
    console.log('\n📋 Current Departments:');
    departments.forEach(dept => {
      console.log(`   - ${dept.name} (${dept.code})`);
    });
    console.log(`\nTotal: ${departments.length} departments`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkDepartments(); 