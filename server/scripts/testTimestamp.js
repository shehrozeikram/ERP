#!/usr/bin/env node

/**
 * Test Timestamp Conversion
 * 
 * This script tests the timestamp conversion to understand the issue.
 */

const { processZKTecoTimestamp, formatLocalDateTime } = require('../utils/timezoneHelper');

// Test with a sample ZKTeco timestamp
const testTimestamp = "2025-08-08T05:47:08.000Z"; // This should be around 8:47 AM Pakistan time

console.log('🔍 Testing timestamp conversion...');
console.log(`Raw timestamp: ${testTimestamp}`);

// Test the current conversion
const convertedTime = processZKTecoTimestamp(testTimestamp);
console.log(`Converted time: ${convertedTime}`);
console.log(`Formatted time: ${formatLocalDateTime(convertedTime)}`);

// Test what it should be (assuming it's already in local time)
const localTime = new Date(testTimestamp);
console.log(`Direct local time: ${localTime}`);
console.log(`Direct formatted: ${formatLocalDateTime(localTime)}`);

// Test with Pakistan timezone specifically
const pakistanTime = new Date(testTimestamp).toLocaleString('en-US', { 
  timeZone: 'Asia/Karachi' 
});
console.log(`Pakistan time: ${pakistanTime}`);

// Test the issue - the timestamp might already be in local time
const utcTime = new Date(testTimestamp);
const pakistanOffset = 5 * 60 * 60 * 1000; // UTC+5
const correctedTime = new Date(utcTime.getTime() - pakistanOffset);
console.log(`Corrected time (subtracting offset): ${correctedTime}`);
console.log(`Corrected formatted: ${formatLocalDateTime(correctedTime)}`); 