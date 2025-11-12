require('dotenv').config();
const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');

async function removeDuplicateLeaves() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    console.log('🔍 Finding duplicate leave records...\n');

    // Find all leave requests grouped by employee, leaveType, startDate, endDate
    const duplicates = await LeaveRequest.aggregate([
      {
        $group: {
          _id: {
            employee: '$employee',
            leaveType: '$leaveType',
            startDate: '$startDate',
            endDate: '$endDate'
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log(`📊 Found ${duplicates.length} sets of duplicates\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!\n');
      return;
    }

    let totalRemoved = 0;

    for (const dup of duplicates) {
      // Keep the first one (oldest created), delete the rest
      const idsToDelete = dup.ids.slice(1);
      
      const deleteResult = await LeaveRequest.deleteMany({
        _id: { $in: idsToDelete }
      });

      totalRemoved += deleteResult.deletedCount;
      console.log(`   Removed ${deleteResult.deletedCount} duplicate(s) for employee ${dup._id.employee}, ${dup.count} total duplicates`);
    }

    console.log(`\n✅ Removed ${totalRemoved} duplicate records`);
    console.log(`📊 Kept ${duplicates.length} unique records\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  removeDuplicateLeaves()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { removeDuplicateLeaves };
