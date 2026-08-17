require('dotenv').config({ path: './server/.env' });
const mongoose = require('mongoose');

async function sync() {
  const sourceUri = 'mongodb://127.0.0.1:27017/sgc_erp_local';
  const targetUri = 'mongodb://127.0.0.1:27017/sgc-erp-backend';

  console.log('Connecting to Source DB:', sourceUri);
  const srcConn = await mongoose.createConnection(sourceUri).asPromise();
  const SrcEmployee = srcConn.model('Employee', require('../models/hr/Employee').schema);
  const SrcLoan = srcConn.model('Loan', require('../models/hr/Loan').schema);
  const SrcUser = srcConn.model('User', require('../models/User').schema);

  console.log('Connecting to Target DB:', targetUri);
  const tgtConn = await mongoose.createConnection(targetUri).asPromise();
  const TgtEmployee = tgtConn.model('Employee', require('../models/hr/Employee').schema);
  const TgtLoan = tgtConn.model('Loan', require('../models/hr/Loan').schema);
  const TgtUser = tgtConn.model('User', require('../models/User').schema);

  // 1. Find Attique Ur Rehman from Source DB
  const srcEmp = await SrcEmployee.findOne({
    $or: [
      { employeeId: '00026' },
      { employeeId: '26' },
      { firstName: 'Attique', lastName: 'Ur Rehman' }
    ]
  }).lean();

  if (!srcEmp) {
    console.error('❌ Attique Ur Rehman not found in source database:', sourceUri);
    await srcConn.close();
    await tgtConn.close();
    return;
  }

  console.log(`Found Source Employee: ${srcEmp.firstName} ${srcEmp.lastName} (_id: ${srcEmp._id})`);

  // 2. Ensure Employee exists in Target DB (sgc-erp-backend)
  let tgtEmp = await TgtEmployee.findById(srcEmp._id);
  if (!tgtEmp) {
    console.log('Copying Employee record to target database...');
    tgtEmp = await TgtEmployee.create(srcEmp);
    console.log('✅ Employee copied to target database.');
  } else {
    console.log('Employee already exists in target database.');
  }

  // 3. Find Loan from Source DB
  const srcLoan = await SrcLoan.findOne({ employee: srcEmp._id }).lean();
  if (!srcLoan) {
    console.error('❌ Loan not found in source DB for employee.');
    await srcConn.close();
    await tgtConn.close();
    return;
  }

  console.log(`Found Source Loan: ${srcLoan.loanNumber}, Amount: ${srcLoan.loanAmount}`);

  // 4. Ensure Loan exists in Target DB
  let tgtLoan = await TgtLoan.findById(srcLoan._id);
  if (!tgtLoan) {
    console.log('Copying Loan record to target database (sgc-erp-backend)...');
    tgtLoan = await TgtLoan.create(srcLoan);
    console.log(`✅ Loan record created in target database (_id: ${tgtLoan._id})`);
  } else {
    console.log('Updating Loan record in target database...');
    await TgtLoan.findByIdAndUpdate(srcLoan._id, srcLoan, { overwrite: true });
    console.log('✅ Loan record updated in target database.');
  }

  // Also sync all employees from sgc_erp_local to sgc-erp-backend if sgc-erp-backend is empty
  const tgtEmpCount = await TgtEmployee.countDocuments();
  if (tgtEmpCount <= 1) {
    console.log('Syncing full employee collection from sgc_erp_local to sgc-erp-backend...');
    const allSrcEmps = await SrcEmployee.find().lean();
    for (const emp of allSrcEmps) {
      await TgtEmployee.updateOne({ _id: emp._id }, { $set: emp }, { upsert: true });
    }
    console.log(`✅ Synced ${allSrcEmps.length} employees to sgc-erp-backend.`);
  }

  await srcConn.close();
  await tgtConn.close();
  console.log('🎉 Sync complete!');
}

sync().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
