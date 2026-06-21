const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Employee = require('../server/models/hr/Employee');

async function countEmployees() {
  const uri = process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local';
  console.log(`🔌 Connecting to: ${uri}`);
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    const totalCount = await Employee.countDocuments({});
    console.log(`📊 Total documents in Employee collection: ${totalCount}`);

    const activeCount = await Employee.countDocuments({ isDeleted: false, isActive: true });
    console.log(`🟢 Active, non-deleted employees: ${activeCount}`);

    const inactiveNonDeleted = await Employee.countDocuments({ isDeleted: false, isActive: false });
    console.log(`🔴 Inactive, non-deleted employees: ${inactiveNonDeleted}`);

    const deletedCount = await Employee.countDocuments({ isDeleted: true });
    console.log(`🗑️ Deleted (isDeleted: true) employees: ${deletedCount}`);

    // Group by status
    const statusGroups = await Employee.aggregate([
      { $group: { _id: { status: '$employmentStatus', deleted: '$isDeleted' }, count: { $sum: 1 } } }
    ]);
    console.log('\n🔍 Breakdown by employmentStatus and isDeleted:');
    statusGroups.forEach(g => {
      console.log(`   - Status: ${g._id.status || '(unset)'}, deleted: ${g._id.deleted ?? false} => Count: ${g.count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Connection closed');
  }
}

countEmployees();
