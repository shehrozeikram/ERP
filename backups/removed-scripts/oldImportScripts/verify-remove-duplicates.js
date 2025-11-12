const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const Employee = require('../models/hr/Employee');

require('dotenv').config();

async function verifyAndRemoveDuplicates() {
  try {
    console.log('🔍 Finding and Removing Duplicate Leave Records');
    console.log('='.repeat(80));
    
    console.log('Connecting to MongoDB Cloud...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000
    });
    console.log('✅ Connected to MongoDB\n');
    
    // Find duplicates
    console.log('📋 Step 1: Finding duplicate records...');
    
    const duplicates = await LeaveRequest.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: {
            employee: '$employee',
            startDate: '$startDate',
            endDate: '$endDate',
            leaveType: '$leaveType'
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    console.log(`   Found ${duplicates.length} sets of duplicates\n`);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!\n');
      await mongoose.disconnect();
      return;
    }
    
    // Calculate total duplicates to remove
    let totalDuplicates = 0;
    duplicates.forEach(dup => {
      totalDuplicates += dup.count - 1;
    });
    
    console.log(`📊 Summary:`);
    console.log(`   Duplicate sets: ${duplicates.length}`);
    console.log(`   Total duplicate records to remove: ${totalDuplicates}\n`);
    
    // Show sample duplicates
    console.log('📋 Sample Duplicates (First 5):\n');
    
    for (let i = 0; i < Math.min(5, duplicates.length); i++) {
      const dup = duplicates[i];
      const employee = await Employee.findById(dup._id.employee);
      const sampleLeave = await LeaveRequest.findById(dup.ids[0]).populate('leaveType', 'name');
      
      console.log(`   ${i + 1}. ${employee?.firstName || 'Unknown'} ${employee?.lastName || ''} (ID: ${employee?.employeeId || 'N/A'})`);
      console.log(`      Leave: ${sampleLeave?.leaveType?.name || 'N/A'}`);
      console.log(`      Dates: ${new Date(dup._id.startDate).toLocaleDateString()} - ${new Date(dup._id.endDate).toLocaleDateString()}`);
      console.log(`      Duplicates: ${dup.count} records`);
      console.log('');
    }
    
    // Remove duplicates
    console.log('🗑️  Step 2: Removing duplicate records...\n');
    
    let removed = 0;
    let kept = 0;
    
    for (const dup of duplicates) {
      const idsToDelete = dup.ids.slice(1); // Keep first, delete rest
      
      const deleteResult = await LeaveRequest.deleteMany({
        _id: { $in: idsToDelete }
      });
      
      removed += deleteResult.deletedCount;
      kept += 1;
      
      if (removed % 50 === 0) {
        console.log(`   📊 Progress: ${removed} duplicates removed...`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 REMOVAL SUMMARY:\n');
    console.log(`   Duplicate sets processed: ${duplicates.length}`);
    console.log(`   Records removed: ${removed}`);
    console.log(`   Records kept: ${kept}`);
    
    const finalCount = await LeaveRequest.countDocuments({ isActive: true });
    console.log(`   Total records after cleanup: ${finalCount}\n`);
    
    // Verify no duplicates remain
    console.log('🔍 Step 3: Verifying no duplicates remain...\n');
    
    const remainingDuplicates = await LeaveRequest.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: {
            employee: '$employee',
            startDate: '$startDate',
            endDate: '$endDate',
            leaveType: '$leaveType'
          },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);
    
    if (remainingDuplicates.length === 0) {
      console.log('   ✅ No duplicates remain!\n');
    } else {
      console.log(`   ⚠️  Found ${remainingDuplicates.length} sets of duplicates still remaining\n`);
    }
    
    console.log('='.repeat(80));
    console.log('✅ Duplicate removal completed!\n');
    
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  verifyAndRemoveDuplicates()
    .then(() => {
      console.log('\n✨ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { verifyAndRemoveDuplicates };

