const mongoose = require('mongoose');
const NonEmployeeRecord = require('../models/hr/NonEmployeeRecord');

mongoose.connect('mongodb://127.0.0.1:27017/sgc_erp_local').then(async () => {
  console.log('Connected to MongoDB');
  
  const records = await NonEmployeeRecord.find();
  let migrated = 0;
  
  for (const record of records) {
    if (!record.employees || record.employees.length === 0) {
      if (record.firstName) {
        record.employees = [{
          firstName: record.firstName,
          lastName: record.lastName,
          cnic: record.cnic,
          phone: record.phone,
          address: record.address,
          role: record.role,
          expectedWages: record.expectedWages,
          justification: record.justification
        }];
        await record.save();
        migrated++;
      }
    }
  }
  
  console.log(`Migrated ${migrated} records`);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
