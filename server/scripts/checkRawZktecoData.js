#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const zktecoService = require('../services/zktecoService');

async function checkRawZktecoData() {
  try {
    console.log('🔍 CHECKING RAW ZKTECO DATA...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Connect to ZKTeco device
    console.log('\n🔗 Connecting to ZKTeco device...');
    await zktecoService.connect();
    console.log('✅ Connected to ZKTeco device');
    
    // Get attendance data
    console.log('\n📊 Getting attendance data...');
    const attendanceData = await zktecoService.getAttendanceData();
    
    if (!attendanceData.success || !attendanceData.data) {
      throw new Error('No attendance data received from ZKTeco device');
    }
    
    console.log(`✅ Found ${attendanceData.data.length} attendance records`);
    
    // Show first 5 records with detailed analysis
    console.log('\n📋 DETAILED TIME ANALYSIS:');
    console.log('='.repeat(80));
    
    attendanceData.data.slice(0, 5).forEach((record, index) => {
      console.log(`\nRecord ${index + 1}:`);
      console.log(`  Raw record:`, JSON.stringify(record, null, 2));
      
      const recordTime = new Date(record.timestamp || record.recordTime);
      console.log(`  Parsed time: ${recordTime.toISOString()}`);
      console.log(`  Local time: ${recordTime.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
      console.log(`  UTC time: ${recordTime.toLocaleString('en-US', {timeZone: 'UTC'})}`);
      
      // Test different conversions
      const pakistanTime1 = new Date(recordTime.getTime() + (5 * 60 * 60 * 1000));
      const pakistanTime2 = new Date(recordTime.getTime() - (5 * 60 * 60 * 1000));
      const pakistanTime3 = new Date(recordTime.getTime());
      
      console.log(`  Pakistan time (+5h): ${pakistanTime1.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
      console.log(`  Pakistan time (-5h): ${pakistanTime2.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
      console.log(`  Pakistan time (no conversion): ${pakistanTime3.toLocaleString('en-US', {timeZone: 'Asia/Karachi'})}`);
      
      // Check what the actual time should be
      const hours = recordTime.getUTCHours();
      const minutes = recordTime.getUTCMinutes();
      const seconds = recordTime.getUTCSeconds();
      
      console.log(`  Raw hours: ${hours}, minutes: ${minutes}, seconds: ${seconds}`);
      console.log(`  Expected Pakistan time: ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    });
    
    // Disconnect
    await zktecoService.disconnect();
    console.log('\n🔌 Disconnected from ZKTeco device');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkRawZktecoData(); 