require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('nonemployeerecords');
  const docs = await col.find({ employees: { $exists: false } }).toArray();
  const empty = await col.find({ employees: { $size: 0 } }).toArray();
  console.log('missing employees array:', docs.length);
  for (const d of docs) {
    console.log(JSON.stringify({
      recordNumber: d.recordNumber,
      status: d.workflowStatus,
      keys: Object.keys(d).filter((k) => !['_id', '__v'].includes(k)),
      sample: {
        firstName: d.firstName,
        lastName: d.lastName,
        name: d.name,
        cnic: d.cnic,
        designation: d.designation,
        role: d.role,
        departmentSubject: d.departmentSubject,
        department: d.department,
        project: d.project,
        location: d.location,
        currentPackageMonthly: d.currentPackageMonthly,
        expectedWages: d.expectedWages,
        tentativeDoj: d.tentativeDoj,
        remark: d.remark,
        justification: d.justification
      }
    }, null, 2));
  }
  console.log('empty employees array:', empty.length);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
