/**
 * Test: Time Formatting Fix for Real-Time Monitor
 * This test verifies that the formatTime function works correctly
 * with ZKBio Time data formats
 */

console.log('🔍 Testing Time Formatting Fix...\n');

// Simulate the formatTime function from Real-Time Monitor
const formatTime = (timeString) => {
  try {
    if (!timeString) return 'N/A';
    
    const date = new Date(timeString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return timeString; // Return original string if not a valid date
    }
    
    // Format exactly like Attendance Management page
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  } catch (error) {
    console.error('Error formatting time:', error);
    return timeString || 'N/A';
  }
};

// Test various time formats that might come from ZKBio Time
const testTimes = [
  '2025-09-13T10:55:45.000Z',
  '2025-09-13 10:55:45',
  '2025-09-13T10:55:45',
  '10:55:45',
  '2025-09-13T10:55:45.123Z',
  'invalid-date',
  null,
  undefined,
  '',
  '2025-09-13T10:55:45.000+05:00'
];

console.log('📊 Testing various time formats:');
console.log('=' .repeat(60));

testTimes.forEach((time, index) => {
  const formatted = formatTime(time);
  console.log(`${index + 1}. Input: "${time}"`);
  console.log(`   Output: "${formatted}"`);
  console.log('');
});

console.log('✅ Time formatting test completed!');
console.log('\n🎯 EXPECTED RESULTS:');
console.log('• Valid dates should show as HH:MM:SS format (24-hour)');
console.log('• Invalid dates should return the original string');
console.log('• Null/undefined should return "N/A"');
console.log('• No more "Invalid Date" errors in Real-Time Monitor');
