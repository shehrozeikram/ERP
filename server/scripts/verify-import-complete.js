const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const Employee = require('../models/hr/Employee');
const LeaveType = require('../models/hr/LeaveType');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

async function verifyImportComplete() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get current database count
    const dbCount = await LeaveRequest.countDocuments({ isActive: true });
    console.log(`📊 Database records: ${dbCount}`);

    // Load the formatted data
    const dataPath = path.join(__dirname, 'leave-data-formatted.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);

    const allLeaves = data.allLeaves || [];
    console.log(`📋 File records: ${allLeaves.length}`);

    // Check if all records are imported
    if (dbCount >= allLeaves.length) {
      console.log('🎉 SUCCESS: All records are imported!');
      
      // Show detailed breakdown
      const recordsByYear = await LeaveRequest.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$leaveYear', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      console.log('\n📅 Records by year:');
      recordsByYear.forEach(item => console.log(`  - ${item._id}: ${item.count} records`));

      const statusBreakdown = await LeaveRequest.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      
      console.log('\n📈 Status breakdown:');
      statusBreakdown.forEach(item => console.log(`  - ${item._id}: ${item.count}`));

      // Test pagination with large dataset
      console.log('\n🧪 Testing pagination with large dataset...');
      
      const pageSize = 100;
      const totalPages = Math.ceil(dbCount / pageSize);
      console.log(`📄 Total pages with ${pageSize} records per page: ${totalPages}`);
      
      // Test first page
      const firstPage = await LeaveRequest.find({ isActive: true })
        .populate('employee', 'firstName lastName employeeId')
        .populate('leaveType', 'name code color')
        .sort({ appliedDate: -1 })
        .limit(pageSize);
      
      console.log(`✅ First page: ${firstPage.length} records`);
      
      // Test last page
      const skip = (totalPages - 1) * pageSize;
      const lastPage = await LeaveRequest.find({ isActive: true })
        .populate('employee', 'firstName lastName employeeId')
        .populate('leaveType', 'name code color')
        .sort({ appliedDate: -1 })
        .skip(skip)
        .limit(pageSize);
      
      console.log(`✅ Last page: ${lastPage.length} records`);
      
      console.log('\n🎯 Import verification complete!');
      console.log(`📊 Total imported: ${dbCount} records`);
      console.log(`📋 Expected: ${allLeaves.length} records`);
      console.log(`✅ Status: ${dbCount >= allLeaves.length ? 'COMPLETE' : 'INCOMPLETE'}`);
      
    } else {
      console.log(`⚠️  Still missing: ${allLeaves.length - dbCount} records`);
    }

  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

verifyImportComplete();

