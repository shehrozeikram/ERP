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

async function reimportHistoricalLeaves() {
  try {
    console.log('🔄 Starting reimport of historical leave data...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp');
    console.log('✅ Connected to MongoDB');

    // Read the formatted data
    const dataPath = path.join(__dirname, 'leave-data-formatted.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    console.log(`📊 Found ${data.metadata.totalRecords} records to import`);
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process each leave record from allLeaves array
    const allLeaves = data.allLeaves || [];
    console.log(`🔄 Processing ${allLeaves.length} leave records...`);
    
    for (const leaveData of allLeaves) {
      try {
        // Find or create employee
        let employee = await Employee.findOne({ 
          $or: [
            { employeeId: leaveData.employeeId },
            { firstName: { $regex: new RegExp(leaveData.employeeName.split(' ')[0], 'i') } }
          ]
        });
        
        if (!employee) {
          console.log(`👤 Creating employee: ${leaveData.employeeName} (ID: ${leaveData.employeeId})`);
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
          console.log(`📝 Creating leave type: ${leaveData.leaveType}`);
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
        
        if (imported % 100 === 0) {
          console.log(`✅ Imported ${imported} records...`);
        }
        
      } catch (error) {
        console.error(`❌ Error importing record for ${leaveData.employeeName}:`, error.message);
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
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the import
reimportHistoricalLeaves();
