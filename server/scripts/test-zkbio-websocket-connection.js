/**
 * Test: WebSocket Connection to ZKBio Time
 * This test verifies if our server can connect to ZKBio Time WebSocket
 */

const WebSocket = require('ws');
const axios = require('axios');

console.log('🔍 Testing WebSocket Connection to ZKBio Time...\n');

class ZKBioTimeConnectionTester {
  constructor() {
    this.baseURL = 'http://45.115.86.139:85';
    this.wsURL = 'ws://45.115.86.139:85/base/dashboard/realtime_punch/';
    this.sessionCookies = null;
    this.ws = null;
  }

  async authenticate() {
    console.log('🔐 Step 1: Authenticating with ZKBio Time...');
    
    try {
      // Get CSRF token
      const csrfResponse = await axios.get(`${this.baseURL}/login/`, {
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: (status) => status < 400
      });

      const csrfToken = csrfResponse.data.match(/name=['"]csrfmiddlewaretoken['"] value=['"]([^'"]+)['"]/);
      if (!csrfToken) {
        throw new Error('CSRF token not found');
      }

      console.log('✅ CSRF token obtained');

      // Login
      const loginResponse = await axios.post(`${this.baseURL}/login/`, 
        `username=superuser&password=SGCit123456&csrfmiddlewaretoken=${csrfToken[1]}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': `${this.baseURL}/login/`,
            'X-CSRFToken': csrfToken[1]
          },
          timeout: 10000,
          maxRedirects: 0,
          validateStatus: (status) => status < 400
        }
      );

      const cookies = loginResponse.headers['set-cookie'];
      if (cookies && cookies.length > 0) {
        this.sessionCookies = cookies.join('; ');
        console.log('✅ Authentication successful');
        console.log('🍪 Cookies:', this.sessionCookies.substring(0, 100) + '...');
        return true;
      }
      
      throw new Error('No cookies received');
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      return false;
    }
  }

  async connectWebSocket() {
    console.log('\n🔌 Step 2: Connecting to ZKBio Time WebSocket...');
    console.log('🌐 WebSocket URL:', this.wsURL);
    
    try {
      this.ws = new WebSocket(this.wsURL, {
        headers: {
          'Origin': this.baseURL,
          'Cookie': this.sessionCookies,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      return new Promise((resolve, reject) => {
        this.ws.on('open', () => {
          console.log('✅ WebSocket connected successfully');
          console.log('🔍 WebSocket ready state:', this.ws.readyState);
          resolve(true);
        });

        this.ws.on('error', (error) => {
          console.error('❌ WebSocket connection error:', error.message);
          console.error('❌ Error code:', error.code);
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
        });

        this.ws.on('message', (data) => {
          console.log('\n📊 Step 3: Received WebSocket Message!');
          console.log('=' .repeat(60));
          console.log('📦 Raw message length:', data.length);
          console.log('📦 Raw message (first 200 chars):', data.toString().substring(0, 200));
          
          try {
            const message = JSON.parse(data.toString());
            console.log('📊 Parsed message type:', message.type);
            console.log('📊 Message data length:', message.data ? message.data.length : 'no data');
            
            if (message.type === 'punch_data' && message.data && message.data.length > 0) {
              console.log(`🎉 SUCCESS! Received ${message.data.length} attendance events`);
              
              const firstEvent = message.data[0];
              console.log('🔍 First event structure:');
              console.log('   ID:', firstEvent[0]);
              console.log('   Employee Code:', firstEvent[1]);
              console.log('   Name:', firstEvent[2]);
              console.log('   Time:', firstEvent[3]);
              console.log('   State:', firstEvent[4]);
              console.log('   Image Path:', firstEvent[5]);
              console.log('   Photo Path:', firstEvent[6]);
              console.log('   Location:', firstEvent[7]);
              
              if (firstEvent[5] || firstEvent[6]) {
                console.log('✅ IMAGE DATA FOUND!');
                console.log('   Image Path:', firstEvent[5]);
                console.log('   Photo Path:', firstEvent[6]);
              } else {
                console.log('❌ No image data in this event');
              }
            }
          } catch (parseError) {
            console.error('❌ Error parsing message:', parseError.message);
          }
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('\n⏰ Timeout reached - no messages received');
            console.log('   This could mean:');
            console.log('   1. No one is currently using the attendance system');
            console.log('   2. WebSocket is connected but not receiving data');
            console.log('   3. ZKBio Time is not sending real-time events');
            this.ws.close();
          }
        }, 30000);
      });
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error.message);
      return false;
    }
  }

  async runTest() {
    console.log('🚀 Starting WebSocket connection test...\n');
    
    const authSuccess = await this.authenticate();
    if (!authSuccess) {
      console.log('❌ Test failed at authentication step');
      return false;
    }

    const wsSuccess = await this.connectWebSocket();
    if (!wsSuccess) {
      console.log('❌ Test failed at WebSocket connection step');
      return false;
    }

    console.log('\n⏳ Waiting for real-time attendance data...');
    console.log('   (Try using the ZKBio Time attendance system now)');
    
    return true;
  }
}

// Run the test
const tester = new ZKBioTimeConnectionTester();
tester.runTest().then(success => {
  if (success) {
    console.log('\n🎉 WebSocket connection test completed!');
    console.log('\n📱 NEXT STEPS:');
    console.log('1. If you see "✅ IMAGE DATA FOUND!" - images are available');
    console.log('2. If you see "❌ No image data" - ZKBio Time doesn\'t send images');
    console.log('3. If you see no messages - no one is using attendance system');
    console.log('4. Check your Dashboard console for similar messages');
  } else {
    console.log('\n❌ Test failed - check the error messages above');
  }
}).catch(error => {
  console.error('\n💥 Test crashed:', error.message);
});
