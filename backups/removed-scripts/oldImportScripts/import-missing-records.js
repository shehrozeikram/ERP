const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const Employee = require('../models/hr/Employee');
const LeaveType = require('../models/hr/LeaveType');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

async function importMissingRecords() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get current count
    const currentCount = await LeaveRequest.countDocuments({ isActive: true });
    console.log(`📊 Current records in database: ${currentCount}`);

    // Load the formatted data
    const dataPath = path.join(__dirname, 'leave-data-formatted.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);

    const allLeaves = data.allLeaves || [];
    console.log(`📋 Total records in file: ${allLeaves.length}`);
    
    // Calculate how many records are missing
    const missingCount = allLeaves.length - currentCount;
    console.log(`🔄 Records missing: ${missingCount}`);

    if (missingCount <= 0) {
      console.log('✅ All records are already imported!');
      return;
    }

    // Import only the missing records (from the end of the file)
    const recordsToImport = allLeaves.slice(-missingCount);
    console.log(`📈 Processing ${recordsToImport.length} missing records...`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < recordsToImport.length; i++) {
      const leaveData = recordsToImport[i];
      
      try {
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

        if (i % 10 === 0) {
          console.log(`📊 Progress: ${i + 1}/${recordsToImport.length} (${((i + 1) / recordsToImport.length * 100).toFixed(1)}%)`);
        }

      } catch (error) {
        console.error(`❌ Error importing record for ${leaveData.employeeName}:`, error.message);
        errors++;
      }
    }

    console.log('\n🎉 Import Complete!');
    console.log(`✅ Imported: ${imported}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📈 Total processed: ${recordsToImport.length}`);

    // Final verification
    const finalCount = await LeaveRequest.countDocuments({ isActive: true });
    console.log(`\n🎯 Final database count: ${finalCount} active leave requests`);

    if (finalCount === allLeaves.length) {
      console.log('🎉 SUCCESS: All records imported!');
    } else {
      console.log(`⚠️  Still missing: ${allLeaves.length - finalCount} records`);
    }

    const recordsByYear = await LeaveRequest.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$leaveYear', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    console.log('\n📅 Records by year:');
    recordsByYear.forEach(item => console.log(`  - ${item._id}: ${item.count} records`));

  } catch (error) {
    console.error('❌ Error during import:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

importMissingRecords();

