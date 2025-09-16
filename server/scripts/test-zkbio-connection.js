#!/usr/bin/env node

/**
 * ZKBio Time Connection Test Script
 * This script tests the connection to ZKBio Time from the production server
 * Run this on the production server to diagnose connection issues
 */

const axios = require('axios');
const WebSocket = require('ws');

// Configuration
const ZKBIO_BASE_URL = 'http://45.115.86.139:85';
const ZKBIO_WEBSOCKET_URL = 'ws://45.115.86.139:85/base/dashboard/realtime_punch/';
const USERNAME = 'superuser';
const PASSWORD = 'SGCit123456';

console.log('🧪 ZKBio Time Connection Test');
console.log('============================');
console.log(`🌐 Base URL: ${ZKBIO_BASE_URL}`);
console.log(`🔌 WebSocket URL: ${ZKBIO_WEBSOCKET_URL}`);
console.log(`👤 Username: ${USERNAME}`);
console.log('');

async function testHttpConnection() {
  console.log('1️⃣ Testing HTTP Connection...');
  try {
    const response = await axios.get(`${ZKBIO_BASE_URL}/login/`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    console.log(`✅ HTTP Connection: SUCCESS (Status: ${response.status})`);
    return true;
  } catch (error) {
    console.log(`❌ HTTP Connection: FAILED`);
    console.log(`   Error: ${error.message}`);
    if (error.code) {
      console.log(`   Code: ${error.code}`);
    }
    return false;
  }
}

async function testAuthentication() {
  console.log('\n2️⃣ Testing Authentication...');
  try {
    // Get login page to extract CSRF token
    const loginPageResponse = await axios.get(`${ZKBIO_BASE_URL}/login/`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    // Extract CSRF token
    const csrfMatch = loginPageResponse.data.match(/name=['"]csrfmiddlewaretoken['"] value=['"]([^'"]+)['"]/);
    if (!csrfMatch) {
      console.log('❌ Authentication: FAILED (No CSRF token found)');
      return false;
    }

    const csrfToken = csrfMatch[1];
    console.log(`✅ CSRF Token extracted: ${csrfToken.substring(0, 10)}...`);

    // Perform login
    const loginData = new URLSearchParams({
      'username': USERNAME,
      'password': PASSWORD,
      'csrfmiddlewaretoken': csrfToken
    });

    const loginResponse = await axios.post(`${ZKBIO_BASE_URL}/login/`, loginData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': `${ZKBIO_BASE_URL}/login/`,
        'Origin': ZKBIO_BASE_URL,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cookie': `csrftoken=${csrfToken}`
      },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });

    // Check if login was successful (should redirect to dashboard)
    const cookies = loginResponse.headers['set-cookie'];
    if (cookies && cookies.length > 0) {
      console.log('✅ Authentication: SUCCESS');
      console.log(`   Cookies received: ${cookies.length}`);
      return cookies;
    } else {
      console.log('❌ Authentication: FAILED (No cookies received)');
      return false;
    }
  } catch (error) {
    console.log(`❌ Authentication: FAILED`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testWebSocketConnection(cookies) {
  console.log('\n3️⃣ Testing WebSocket Connection...');
  
  return new Promise((resolve) => {
    const cookieString = cookies.map(cookie => cookie.split(';')[0]).join('; ');
    
    const ws = new WebSocket(ZKBIO_WEBSOCKET_URL, {
      headers: {
        'Origin': 'http://45.115.86.139:85',
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      handshakeTimeout: 10000
    });

    const timeout = setTimeout(() => {
      console.log('❌ WebSocket Connection: TIMEOUT');
      ws.close();
      resolve(false);
    }, 15000);

    ws.on('open', () => {
      console.log('✅ WebSocket Connection: SUCCESS');
      clearTimeout(timeout);
      ws.close();
      resolve(true);
    });

    ws.on('error', (error) => {
      console.log('❌ WebSocket Connection: FAILED');
      console.log(`   Error: ${error.message}`);
      if (error.code) {
        console.log(`   Code: ${error.code}`);
      }
      clearTimeout(timeout);
      resolve(false);
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
    });
  });
}

async function runTests() {
  console.log('Starting connection tests...\n');
  
  // Test 1: HTTP Connection
  const httpSuccess = await testHttpConnection();
  if (!httpSuccess) {
    console.log('\n❌ HTTP connection failed. Cannot proceed with other tests.');
    process.exit(1);
  }
  
  // Test 2: Authentication
  const cookies = await testAuthentication();
  if (!cookies) {
    console.log('\n❌ Authentication failed. Cannot proceed with WebSocket test.');
    process.exit(1);
  }
  
  // Test 3: WebSocket Connection
  const wsSuccess = await testWebSocketConnection(cookies);
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`HTTP Connection: ${httpSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Authentication: ${cookies ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`WebSocket Connection: ${wsSuccess ? '✅ PASS' : '❌ FAIL'}`);
  
  if (httpSuccess && cookies && wsSuccess) {
    console.log('\n🎉 All tests passed! ZKBio Time connection is working.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});