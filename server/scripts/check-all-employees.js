const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const checkAllEmployees = async () => {
  try {
    console.log('🔍 Checking all employees in database...');

    const allEmployees = await Employee.find({});
    const activeEmployees = await Employee.find({ isActive: true });
    const deletedEmployees = await Employee.find({ isDeleted: true });

    console.log(`Total employees: ${allEmployees.length}`);
    console.log(`Active employees: ${activeEmployees.length}`);
    console.log(`Deleted employees: ${deletedEmployees.length}`);

    if (allEmployees.length > 0) {
      console.log('\nFirst few employees:');
      allEmployees.slice(0, 5).forEach(emp => {
        console.log(`- ${emp.firstName} ${emp.lastName} (${emp.employeeId}) - Active: ${emp.isActive}, Deleted: ${emp.isDeleted}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking employees:', error);
  } finally {
    mongoose.connection.close();
  }
};

checkAllEmployees();
