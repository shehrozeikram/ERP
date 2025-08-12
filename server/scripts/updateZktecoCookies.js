#!/usr/bin/env node

/**
 * Script to update ZKTeco device cookies
 * Run this script when cookies expire to update the configuration
 * 
 * Usage: node scripts/updateZktecoCookies.js
 */

const { updateCookies, ZKTECO_CONFIG } = require('../config/zktecoConfig');

console.log('🍪 ZKTeco Cookie Update Script');
console.log('================================\n');

// Example of how to update cookies
const newCookies = {
  // Update these values with your new cookies
  account_info: 'eyJ1c2VybmFtZSI6ICJhZGlsLmFhbWlyIiwgInBhc3N3b3JkIjogIlBhazEyMzQ1NiIsICJlbXBOYW1lIjogIiIsICJlbXBQd2QiOiAiIiwgInJlbWVtYmVyX21lX2FkbWluIjogImNoZWNrZWQiLCAicmVtZW1iZXJfbWVfZW1wbG95ZWUiOiAiIn0=',
  csrftoken: '38aYpXDoBu4Rmk1fBMKTM1YfdmYCWXzx',
  django_language: 'en',
  sessionid: '4h3w6ffodvp4df9l51f9vkqjvjvvmtf2'
};

console.log('Current cookies:');
Object.entries(ZKTECO_CONFIG.cookies).forEach(([key, value]) => {
  console.log(`  ${key}: ${value.substring(0, 50)}...`);
});

console.log('\nTo update cookies:');
console.log('1. Get new cookies from your browser (F12 → Application → Cookies)');
console.log('2. Update the newCookies object in this script');
console.log('3. Run: node scripts/updateZktecoCookies.js');
console.log('4. Restart your server');

console.log('\nExample cookie update:');
console.log('updateCookies({');
console.log('  csrftoken: "your_new_csrf_token",');
console.log('  sessionid: "your_new_session_id"');
console.log('});');

// Uncomment the line below to actually update cookies
// updateCookies(newCookies);

console.log('\n✅ Cookie update script completed!');
console.log('⚠️  Remember to restart your server after updating cookies');
