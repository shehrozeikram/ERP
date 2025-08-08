#!/usr/bin/env node

/**
 * Fix Attendance Now Script
 * 
 * This script immediately processes all available biometric data
 * and saves it to the attendance database so it shows up in the Attendance module.
 * 
 * Usage: node server/scripts/fixAttendanceNow.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Employee = require('../models/hr/Employee');
const Attendance = require('../models/hr/Attendance');
const zktecoService = require('../services/zktecoService');

async function fixAttendanceNow() {
  try {
    console.log('🚀 Fixing attendance data - processing all biometric records...');
    console.log('📋 This will make your attendance data visible in the Attendance module');
    console.log('');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get ALL raw attendance data from ZKTeco device
    console.log('📥 Fetching ALL attendance data from ZKTeco device...');
    const rawData = await zktecoService.getAttendanceData();
    
    if (!rawData.success || !rawData.data || rawData.data.length === 0) {
      console.log('📭 No attendance data found on device');
      console.log('💡 This could mean:');
      console.log('   • Device has no attendance records');
      console.log('   • Device connectivity issues');
      console.log('   • Device configuration problems');
      process.exit(0);
    }

    console.log(`✅ Retrieved ${rawData.data.length} raw attendance records from device`);

    // Filter out invalid records
    const validData = rawData.data.filter(record => {
      const employeeId = record.uid || record.userId || record.deviceUserId;
      const timestamp = record.timestamp || record.recordTime;
      
      // Skip records with no employee ID or timestamp
      if (!employeeId || !timestamp || timestamp === undefined) {
        return false;
      }
      
      // Check if timestamp can be converted to valid date
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return false;
      }
      
      return true;
    });

    console.log(`📊 ${validData.length} records are valid for processing`);

    if (validData.length === 0) {
      console.log('⚠️ No valid records found to process');
      process.exit(0);
    }

    // Process each record
    let processed = 0;
    let created = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails = [];

    console.log('\n🔄 Processing records...');

    for (const record of validData) {
      try {
        const employeeId = record.uid || record.userId || record.deviceUserId;
        const timestamp = new Date(record.timestamp || record.recordTime);
        
        // Find employee by employeeId
        const employee = await Employee.findOne({ employeeId: employeeId.toString() });
        
        if (!employee) {
          errorDetails.push({
            employeeId,
            timestamp: record.timestamp,
            error: 'Employee not found in database'
          });
          errors++;
          
          // Special message for your employee ID
          if (employeeId === '6035') {
            console.log(`⚠️ Employee ID 6035 (your ID) not found in database!`);
          }
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
          
          // Special message for your employee ID
          if (employeeId === '6035') {
            console.log(`🎯 ✅ Created attendance record for Employee ID 6035 (${employee.firstName} ${employee.lastName}) - ${timestamp.toLocaleString()}`);
          }
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
            
            // Special message for your employee ID
            if (employeeId === '6035') {
              console.log(`🎯 🔄 Updated attendance record for Employee ID 6035 (${employee.firstName} ${employee.lastName}) - ${timestamp.toLocaleString()}`);
            }
          }
        }

        processed++;
        
        // Show progress every 100 records
        if (processed % 100 === 0) {
          console.log(`   📊 Processed ${processed}/${validData.length} records...`);
        }

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
    console.log('\n📊 Processing Complete!');
    console.log(`   🔄 Total processed: ${processed} records`);
    console.log(`   ➕ Created: ${created} new attendance records`);
    console.log(`   🔄 Updated: ${updated} existing records`);
    console.log(`   ❌ Errors: ${errors} errors`);

    if (created > 0 || updated > 0) {
      console.log('\n🎉 SUCCESS! Biometric data has been processed and saved!');
      console.log('✅ Your attendance data should now be visible in the Attendance Management module');
      console.log('🔄 Refresh your attendance page to see all the data');
      console.log('📅 This includes historical data from the biometric device');
      
      // Check if employee 6035 was processed
      const employee6035Error = errorDetails.find(e => e.employeeId === '6035');
      if (employee6035Error) {
        console.log('\n⚠️ IMPORTANT: Employee ID 6035 had processing errors:');
        console.log(`   Error: ${employee6035Error.error}`);
        console.log('💡 To fix this:');
        console.log('   1. Ensure employee with ID "6035" exists in your employee database');
        console.log('   2. Check the employee management section to verify the employee record');
        console.log('   3. Make sure the employeeId field matches exactly "6035"');
      } else {
        console.log('\n🎯 Employee ID 6035 data should now be visible in attendance!');
      }
    } else {
      console.log('\n📭 No new attendance records were created or updated');
      console.log('💡 This could mean:');
      console.log('   • All data has already been processed');
      console.log('   • No valid biometric records found');
      console.log('   • Employee mapping issues (check errors below)');
    }

    if (errorDetails.length > 0) {
      console.log('\n⚠️ Processing Errors:');
      const uniqueErrors = {};
      errorDetails.forEach(error => {
        if (!uniqueErrors[error.error]) {
          uniqueErrors[error.error] = [];
        }
        uniqueErrors[error.error].push(error.employeeId);
      });

      Object.entries(uniqueErrors).forEach(([error, employeeIds]) => {
        console.log(`   • ${error}: ${employeeIds.slice(0, 10).join(', ')}${employeeIds.length > 10 ? ` and ${employeeIds.length - 10} more` : ''}`);
      });
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

// Handle script interruption
process.on('SIGINT', async () => {
  console.log('\n⏹️ Script interrupted by user');
  await mongoose.disconnect();
  process.exit(0);
});

// Run the fix
fixAttendanceNow();