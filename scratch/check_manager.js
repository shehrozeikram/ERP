const mongoose = require('mongoose');
const Employee = require('../server/models/hr/Employee');

const checkManager = async () => {
  await mongoose.connect('mongodb://localhost:27017/sgc_erp_local');
  const emp = await Employee.findOne({ firstName: /Mansoor/i }).populate('manager');
  if (emp) {
    console.log(`Employee: ${emp.firstName} ${emp.lastName}`);
    console.log(`Manager: ${emp.manager ? emp.manager.firstName + ' ' + emp.manager.lastName : 'NONE'}`);
    if (emp.manager) {
      console.log(`Manager User ID: ${emp.manager.user || 'NONE'}`);
    }
  } else {
    console.log('Employee Mansoor not found');
  }
  process.exit(0);
};
checkManager();
