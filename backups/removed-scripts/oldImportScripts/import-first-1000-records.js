const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Import models
const LeaveRequest = require('../models/hr/LeaveRequest');
const Employee = require('../models/hr/Employee');
const LeaveType = require('../models/hr/LeaveType');
const User = require('../models/User');

// Load environment variables
require('dotenv').config();

async function importFirst1000Records() {
  try {
    console.log('🔄 Starting import of first 1000 records...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp');
    console.log('✅ Connected to MongoDB');

    // Read the formatted data
    const dataPath = path.join(__dirname, 'leave-data-formatted.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    // Get first 1000 records only
    const importLeaves = data.allLeaves.slice(0, 1000);
    console.log(`📊 Importing first ${importLeaves.length} records...`);
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (let i = 0; i < importLeaves.length; i++) {
      const leaveData = importLeaves[i];
      try {
        if (i % 50 === 0) {
          console.log(`🔄 Processing record ${i + 1}/${importLeaves.length}...`);
        }
        
        // Find or create employee
        let employee = await Employee.findOne({ 
          $or: [
            { employeeId: leaveData.employeeId },
            { firstName: { $regex: new RegExp(leaveData.employeeName.split(' ')[0], 'i') } }
          ]
        });
        
        if (!employee) {
          employee = new Employee({
            employeeId: leaveData.employeeId,
            firstName: leaveData.employeeName.split(' ')[0] || 'Unknown',
            lastName: leaveData.employeeName.split(' ').slice(1).join(' ') || 'Employee',
            email: `${leaveData.employeeId}@company.com`,
            phone: '000-000-0000',
            dateOfBirth: new Date('1990-01-01'),
            gender: 'male',
            idCard: leaveData.employeeId,
            nationality: 'Pakistani',
            department: new mongoose.Types.ObjectId(),
            designation: new mongoose.Types.ObjectId(),
            joiningDate: new Date('2020-01-01'),
            status: 'active'
          });
          await employee.save();
        }
        
        // Find or create leave type
        let leaveType = await LeaveType.findOne({ 
          $or: [
            { name: leaveData.leaveType },
            { code: leaveData.leaveType }
          ]
        });
        
        if (!leaveType) {
          leaveType = new LeaveType({
            name: leaveData.leaveType,
            code: leaveData.leaveType.toUpperCase().replace(' ', '_'),
            description: `${leaveData.leaveType} Leave`,
            color: '#2196F3',
            isActive: true
          });
          await leaveType.save();
        }
        
        // Check for duplicate
        const existingLeave = await LeaveRequest.findOne({
          employee: employee._id,
          startDate: leaveData.startDateParsed,
          endDate: leaveData.endDateParsed,
          leaveType: leaveType._id,
          status: 'approved'
        });
        
        if (existingLeave) {
          skipped++;
          continue;
        }
        
        // Create leave request
        const leaveRequest = new LeaveRequest({
          employee: employee._id,
          leaveType: leaveType._id,
          startDate: leaveData.startDateParsed,
          endDate: leaveData.endDateParsed,
          totalDays: leaveData.duration || leaveData.totalDays,
          reason: `Historical leave record - ${leaveData.leaveType}`,
          status: 'approved',
          appliedDate: leaveData.enterDateParsed || leaveData.startDateParsed,
          approvedDate: leaveData.enterDateParsed || leaveData.startDateParsed,
          approvedBy: null,
          approvalComments: 'Imported historical data',
          leaveYear: leaveData.year,
          createdBy: new mongoose.Types.ObjectId(),
          isActive: true
        });
        
        await leaveRequest.save();
        imported++;
        
      } catch (error) {
        console.error(`❌ Error importing record ${i + 1} for ${leaveData.employeeName}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n📊 Import Summary:');
    console.log(`✅ Imported: ${imported}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📈 Total processed: ${imported + skipped + errors}`);
    
    // Verify final count
    const finalCount = await LeaveRequest.countDocuments({ isActive: true });
    console.log(`\n🎯 Final database count: ${finalCount} active leave requests`);
    
    // Show breakdown by year
    const years = await LeaveRequest.distinct('leaveYear', { isActive: true });
    console.log('\n📅 Records by year:');
    for (const year of years.sort()) {
      const yearCount = await LeaveRequest.countDocuments({ leaveYear: year, isActive: true });
      console.log(`  - ${year}: ${yearCount} records`);
    }
    
    // Show breakdown by status
    const approvedCount = await LeaveRequest.countDocuments({ status: 'approved', isActive: true });
    const pendingCount = await LeaveRequest.countDocuments({ status: 'pending', isActive: true });
    const rejectedCount = await LeaveRequest.countDocuments({ status: 'rejected', isActive: true });
    
    console.log(`\n📈 Status breakdown:`);
    console.log(`  - Approved: ${approvedCount}`);
    console.log(`  - Pending: ${pendingCount}`);
    console.log(`  - Rejected: ${rejectedCount}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the import
importFirst1000Records();

