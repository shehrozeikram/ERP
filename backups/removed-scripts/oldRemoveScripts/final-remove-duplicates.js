const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const Employee = require('../models/hr/Employee');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

async function verifyAndRemoveDuplicates() {
  const results = [];
  const log = (msg) => {
    const output = typeof msg === 'string' ? msg : JSON.stringify(msg);
    console.log(output);
    results.push(output);
  };
  
  try {
    log('🔍 Finding and Removing Duplicate Leave Records');
    log('='.repeat(80));
    
    log('Connecting to MongoDB Cloud...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000
    });
    log('✅ Connected to MongoDB');
    
    // Find duplicates
    log('📋 Step 1: Finding duplicate records...');
    
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
    
    log(`   Found ${duplicates.length} sets of duplicates`);
    
    if (duplicates.length === 0) {
      log('✅ No duplicates found!');
      await mongoose.disconnect();
      fs.writeFileSync(path.join(__dirname, 'duplicate-removal-results.txt'), results.join('\n'));
      return;
    }
    
    // Calculate total duplicates to remove
    let totalDuplicates = 0;
    duplicates.forEach(dup => {
      totalDuplicates += dup.count - 1;
    });
    
    log(`📊 Summary:`);
    log(`   Duplicate sets: ${duplicates.length}`);
    log(`   Total duplicate records to remove: ${totalDuplicates}`);
    
    // Show sample duplicates
    log('📋 Sample Duplicates (First 5):');
    
    for (let i = 0; i < Math.min(5, duplicates.length); i++) {
      const dup = duplicates[i];
      const employee = await Employee.findById(dup._id.employee);
      const sampleLeave = await LeaveRequest.findById(dup.ids[0]).populate('leaveType', 'name');
      
      log(`   ${i + 1}. ${employee?.firstName || 'Unknown'} ${employee?.lastName || ''} (ID: ${employee?.employeeId || 'N/A'})`);
      log(`      Leave: ${sampleLeave?.leaveType?.name || 'N/A'}`);
      log(`      Dates: ${new Date(dup._id.startDate).toLocaleDateString()} - ${new Date(dup._id.endDate).toLocaleDateString()}`);
      log(`      Duplicates: ${dup.count} records`);
    }
    
    // Remove duplicates
    log('🗑️  Step 2: Removing duplicate records...');
    
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
        log(`   📊 Progress: ${removed} duplicates removed...`);
      }
    }
    
    log('='.repeat(80));
    log('📊 REMOVAL SUMMARY:');
    log(`   Duplicate sets processed: ${duplicates.length}`);
    log(`   Records removed: ${removed}`);
    log(`   Records kept: ${kept}`);
    
    const finalCount = await LeaveRequest.countDocuments({ isActive: true });
    log(`   Total records after cleanup: ${finalCount}`);
    
    // Verify no duplicates remain
    log('🔍 Step 3: Verifying no duplicates remain...');
    
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
      log('   ✅ No duplicates remain!');
    } else {
      log(`   ⚠️  Found ${remainingDuplicates.length} sets of duplicates still remaining`);
    }
    
    log('='.repeat(80));
    log('✅ Duplicate removal completed!');
    
    await mongoose.disconnect();
    log('🔌 Disconnected from MongoDB');
    
    // Write results to file
    fs.writeFileSync(path.join(__dirname, 'duplicate-removal-results.txt'), results.join('\n'));
    log('\n📄 Results saved to duplicate-removal-results.txt');
    
  } catch (error) {
    const errorMsg = `❌ Error: ${error.message}`;
    console.error(errorMsg);
    if (error.stack) {
      console.error(error.stack);
    }
    results.push(errorMsg);
    fs.writeFileSync(path.join(__dirname, 'duplicate-removal-results.txt'), results.join('\n'));
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

