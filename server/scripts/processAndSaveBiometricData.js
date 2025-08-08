#!/usr/bin/env node

/**
 * Process and Save Biometric Data Script
 * 
 * This script fetches raw biometric data and processes it into the attendance database
 * so it appears in the Attendance Management module.
 * 
 * Usage: node server/scripts/processAndSaveBiometricData.js [days_back]
 * Example: node server/scripts/processAndSaveBiometricData.js 7  (process last 7 days)
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BiometricIntegration = require('../models/hr/BiometricIntegration');
const Employee = require('../models/hr/Employee');
const Attendance = require('../models/hr/Attendance');
const zktecoService = require('../services/zktecoService');

async function processAndSaveBiometricData(daysBack = 7) {
  try {
    console.log('🔄 Processing and saving biometric data to attendance database...');
    console.log(`📅 Processing last ${daysBack} day(s) of data`);
    console.log('');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get raw attendance data from ZKTeco device
    console.log('📥 Fetching raw attendance data from ZKTeco device...');
    const rawData = await zktecoService.getAttendanceData();
    
    if (!rawData.success || !rawData.data || rawData.data.length === 0) {
      console.log('📭 No attendance data found on device');
      process.exit(0);
    }

    console.log(`✅ Retrieved ${rawData.data.length} raw attendance records`);

    // Filter data by date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    const filteredData = rawData.data.filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= cutoffDate && !isNaN(recordDate.getTime());
    });

    console.log(`📊 Filtered to ${filteredData.length} records from last ${daysBack} day(s)`);

    // Process each record
    let processed = 0;
    let created = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails = [];

    for (const record of filteredData) {
      try {
        const employeeId = record.uid || record.userId;
        const timestamp = new Date(record.timestamp);
        
        if (!employeeId) {
          console.warn('⚠️ Skipping record with no employee ID:', record);
          continue;
        }

        // Find employee by employeeId
        const employee = await Employee.findOne({ employeeId: employeeId.toString() });
        
        if (!employee) {
          errorDetails.push({
            employeeId,
            timestamp: record.timestamp,
            error: 'Employee not found in database'
          });
          errors++;
          continue;
        }

        // Get date (without time) for grouping
        const attendanceDate = new Date(timestamp);
        attendanceDate.setHours(0, 0, 0, 0);

        // Find existing attendance record for this employee and date
        let attendance = await Attendance.findOne({
          employee: employee._id,
          date: {
            $gte: attendanceDate,
            $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000)
          },
          isActive: true
        });

        const isCheckIn = record.state === 1 || record.state === '1' || record.state === 'IN';
        
        if (!attendance) {
          // Create new attendance record
          attendance = new Attendance({
            employee: employee._id,
            date: attendanceDate,
            status: 'Present',
            isActive: true
          });

          // Set check-in or check-out
          if (isCheckIn) {
            attendance.checkIn = {
              time: timestamp,
              location: 'Biometric Device',
              method: 'Biometric'
            };
          } else {
            attendance.checkOut = {
              time: timestamp,
              location: 'Biometric Device',
              method: 'Biometric'
            };
          }

          await attendance.save();
          created++;
          console.log(`✅ Created attendance for ${employee.firstName} ${employee.lastName} (${employeeId}) - ${timestamp.toLocaleString()}`);
        } else {
          // Update existing attendance record
          let needsUpdate = false;

          if (isCheckIn) {
            if (!attendance.checkIn || !attendance.checkIn.time || timestamp < attendance.checkIn.time) {
              attendance.checkIn = {
                time: timestamp,
                location: 'Biometric Device',
                method: 'Biometric'
              };
              needsUpdate = true;
            }
          } else {
            if (!attendance.checkOut || !attendance.checkOut.time || timestamp > attendance.checkOut.time) {
              attendance.checkOut = {
                time: timestamp,
                location: 'Biometric Device',
                method: 'Biometric'
              };
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            await attendance.save();
            updated++;
            console.log(`🔄 Updated attendance for ${employee.firstName} ${employee.lastName} (${employeeId}) - ${timestamp.toLocaleString()}`);
          }
        }

        processed++;
      } catch (error) {
        console.error(`❌ Error processing record for employee ${record.uid || record.userId}:`, error.message);
        errorDetails.push({
          employeeId: record.uid || record.userId,
          timestamp: record.timestamp,
          error: error.message
        });
        errors++;
      }
    }

    // Summary
    console.log('\n📊 Processing Summary:');
    console.log(`   🔄 Total processed: ${processed} records`);
    console.log(`   ➕ Created: ${created} new attendance records`);
    console.log(`   🔄 Updated: ${updated} existing records`);
    console.log(`   ❌ Errors: ${errors} errors`);

    if (errorDetails.length > 0) {
      console.log('\n⚠️ Error Details:');
      errorDetails.slice(0, 10).forEach((error, index) => {
        console.log(`   ${index + 1}. Employee ${error.employeeId}: ${error.error}`);
      });
      if (errorDetails.length > 10) {
        console.log(`   ... and ${errorDetails.length - 10} more errors`);
      }
    }

    if (created > 0 || updated > 0) {
      console.log('\n🎉 Success! Biometric data has been processed and saved to the attendance database.');
      console.log('✅ Your attendance data should now be visible in the Attendance Management module.');
      console.log('🔄 Refresh your attendance page to see the latest data.');
      
      if (errorDetails.find(e => e.employeeId === '6035')) {
        console.log('\n⚠️ Note: Employee ID 6035 had processing errors. Check if this employee exists in the database.');
      } else {
        console.log('\n🎯 Employee ID 6035 should now be visible in attendance if they had check-ins in the selected date range.');
      }
    } else {
      console.log('\n📭 No new attendance records were created or updated.');
      console.log('💡 This could mean:');
      console.log('   • All data has already been processed');
      console.log('   • No valid check-ins found in the date range');
      console.log('   • Employee mapping issues (check error details above)');
    }

  } catch (error) {
    console.error('❌ Error processing biometric data:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure MongoDB is running and accessible');
    console.error('   2. Check ZKTeco device connectivity');
    console.error('   3. Verify employee records exist in the database');
    console.error('   4. Check employee ID mappings');
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Get command line argument for days back
const daysBack = parseInt(process.argv[2]) || 7;

// Handle script interruption
process.on('SIGINT', async () => {
  console.log('\n⏹️ Script interrupted by user');
  await mongoose.disconnect();
  process.exit(0);
});

// Run the processing
processAndSaveBiometricData(daysBack);