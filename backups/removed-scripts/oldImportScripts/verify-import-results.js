const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const Employee = require('../models/hr/Employee');

require('dotenv').config();

async function verifyImportResults() {
  try {
    console.log('🔍 Verifying Import Results\n');
    console.log('='.repeat(80));
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get total count
    const totalLeaves = await LeaveRequest.countDocuments({ isActive: true });
    console.log(`📊 Total Leave Requests: ${totalLeaves}\n`);
    
    // Get breakdown by work year
    const workYearBreakdown = await LeaveRequest.aggregate([
      { $match: { isActive: true } },
      { $group: { 
          _id: '$workYear', 
          count: { $sum: 1 },
          leaveYears: { $addToSet: '$leaveYear' }
        } 
      },
      { $sort: { _id: 1 } }
    ]);
    
    console.log('📋 Breakdown by Work Year:\n');
    workYearBreakdown.forEach(item => {
      const sortedYears = item.leaveYears.sort((a, b) => a - b);
      console.log(`   Work Year ${item._id}: ${item.count} leaves (Leave Years: ${sortedYears.join(', ')})`);
    });
    
    // Get breakdown by status
    const statusBreakdown = await LeaveRequest.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n📋 Breakdown by Status:\n');
    statusBreakdown.forEach(item => {
      console.log(`   ${item._id}: ${item.count} leaves`);
    });
    
    // Sample employees verification
    console.log('\n📋 Sample Employees Verification:\n');
    
    const sampleEmployees = ['26', '2120', '3', '7'];
    
    for (const empId of sampleEmployees) {
      const employee = await Employee.findOne({ employeeId: empId });
      if (!employee) {
        console.log(`   ⚠️  Employee ${empId} not found`);
        continue;
      }
      
      const hireDate = employee.hireDate || employee.joiningDate;
      const leaves = await LeaveRequest.find({
        employee: employee._id,
        isActive: true
      }).sort({ startDate: 1 }).limit(5);
      
      console.log(`   👤 ${employee.firstName} ${employee.lastName} (ID: ${empId})`);
      console.log(`      Date of Joining: ${new Date(hireDate).toLocaleDateString()}`);
      console.log(`      Total Leaves: ${await LeaveRequest.countDocuments({ employee: employee._id, isActive: true })}`);
      
      if (leaves.length > 0) {
        console.log(`      Sample Leaves:`);
        leaves.forEach((leave, idx) => {
          console.log(`         ${idx + 1}. ${leave.startDate.toLocaleDateString()} - ${leave.endDate.toLocaleDateString()} | Work Year: ${leave.workYear} | Leave Year: ${leave.leaveYear}`);
        });
      }
      console.log('');
    }
    
    // Check for any leaves with missing workYear or leaveYear
    const missingFields = await LeaveRequest.countDocuments({
      isActive: true,
      $or: [
        { workYear: { $exists: false } },
        { leaveYear: { $exists: false } }
      ]
    });
    
    if (missingFields > 0) {
      console.log(`⚠️  Found ${missingFields} leaves with missing workYear or leaveYear\n`);
    } else {
      console.log(`✅ All leaves have workYear and leaveYear fields\n`);
    }
    
    console.log('='.repeat(80));
    console.log('✅ Verification completed!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  verifyImportResults()
    .then(() => {
      console.log('\n✨ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyImportResults };

