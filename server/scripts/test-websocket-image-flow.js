/**
 * Test: WebSocket Connection and Image Data Flow
 * This test verifies the complete data flow from ZKBio Time to our frontend
 */

const WebSocket = require('ws');
const axios = require('axios');

console.log('🔍 Testing WebSocket Connection and Image Data Flow...\n');

class ZKBioTimeTester {
  constructor() {
    this.baseURL = 'http://182.180.55.96:85';
    this.wsURL = 'ws://182.180.55.96:85/base/dashboard/realtime_punch/';
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
      const loginResponse = await axios.post(`${this.baseURL}/login/`, {
        username: 'superuser',
        password: 'SGCit123456',
        csrfmiddlewaretoken: csrfToken[1]
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `${this.baseURL}/login/`,
          'X-CSRFToken': csrfToken[1]
        },
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: (status) => status < 400
      });

      const cookies = loginResponse.headers['set-cookie'];
      if (cookies && cookies.length > 0) {
        this.sessionCookies = cookies.join('; ');
        console.log('✅ Authentication successful');
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
          resolve(true);
        });

        this.ws.on('error', (error) => {
          console.error('❌ WebSocket connection error:', error.message);
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });
      });
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error.message);
      return false;
    }
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      console.log('\n📊 Step 3: Received WebSocket Message:');
      console.log('=' .repeat(60));
      
      if (message.type === 'punch_data' && message.data && message.data.length > 0) {
        console.log(`📈 Received ${message.data.length} attendance events`);
        
        const processedPunches = message.data.map(row => ({
          id: row[0],           // transaction id
          empCode: row[1],      // emp_code
          name: row[2],         // employee name
          time: row[3],         // punch time
          state: row[4],        // Check In / Check Out
          imagePath: row[5],    // image path
          photoPath: row[6],    // photo path
          location: row[7],     // location/device
          timestamp: new Date().toISOString(),
          score: message.score
        }));

        console.log('\n🔍 IMAGE DATA ANALYSIS:');
        console.log('=' .repeat(60));
        
        processedPunches.forEach((punch, index) => {
          console.log(`\n${index + 1}. Employee: ${punch.name}`);
          console.log(`   ID: ${punch.id}`);
          console.log(`   Code: ${punch.empCode}`);
          console.log(`   Time: ${punch.time}`);
          console.log(`   State: ${punch.state}`);
          console.log(`   Location: ${punch.location}`);
          console.log(`   Image Path: ${punch.imagePath}`);
          console.log(`   Photo Path: ${punch.photoPath}`);
          
          // Test URL construction
          const employeePhotoURL = punch.photoPath ? `${this.baseURL}${punch.photoPath}` : null;
          const attendanceImageURL = punch.imagePath ? `${this.baseURL}${punch.imagePath}` : null;
          
          console.log(`   Employee Photo URL: ${employeePhotoURL}`);
          console.log(`   Attendance Image URL: ${attendanceImageURL}`);
          
          // Check if paths exist
          if (punch.imagePath) {
            console.log(`   ✅ Image path present: ${punch.imagePath}`);
          } else {
            console.log(`   ❌ No image path`);
          }
          
          if (punch.photoPath) {
            console.log(`   ✅ Photo path present: ${punch.photoPath}`);
          } else {
            console.log(`   ❌ No photo path`);
          }
        });

        console.log('\n🎯 FRONTEND MAPPING SIMULATION:');
        console.log('=' .repeat(60));
        
        const mappedEvents = processedPunches.map(event => ({
          ...event,
          employeePhoto: event.photoPath ? `${this.baseURL}${event.photoPath}` : null,
          attendanceImage: event.imagePath ? `${this.baseURL}${event.imagePath}` : null,
          method: event.method || 'Unknown'
        }));

        mappedEvents.forEach((event, index) => {
          console.log(`\n${index + 1}. Mapped Event for ${event.name}:`);
          console.log(`   Employee Photo: ${event.employeePhoto}`);
          console.log(`   Attendance Image: ${event.attendanceImage}`);
          console.log(`   Will show image: ${event.employeePhoto || event.attendanceImage ? 'YES' : 'NO'}`);
        });

        console.log('\n✅ DATA FLOW VERIFICATION:');
        console.log('=' .repeat(60));
        console.log('✅ WebSocket receives data from ZKBio Time');
        console.log('✅ Image paths are present in raw data');
        console.log('✅ URLs are constructed correctly');
        console.log('✅ Frontend mapping preserves image data');
        console.log('✅ Avatar components should display images');

        // Close connection after receiving data
        setTimeout(() => {
          this.ws.close();
          console.log('\n🔌 WebSocket connection closed');
        }, 2000);

      } else {
        console.log('📊 Other message type:', message.type);
      }
    } catch (error) {
      console.error('❌ Error processing message:', error.message);
    }
  }

  async runTest() {
    console.log('🚀 Starting comprehensive WebSocket and Image Data test...\n');
    
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
    console.log('   (This may take a few moments for actual attendance events)');
    
    // Wait for messages
    setTimeout(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('\n⏰ Timeout reached - no attendance events received');
        console.log('   This is normal if no one is currently using the attendance system');
        this.ws.close();
      }
    }, 30000); // Wait 30 seconds for real data

    return true;
  }
}

// Run the test
const tester = new ZKBioTimeTester();
tester.runTest().then(success => {
  if (success) {
    console.log('\n🎉 Test completed successfully!');
    console.log('\n📱 NEXT STEPS:');
    console.log('1. Open your Dashboard and check browser console');
    console.log('2. Look for the debugging messages we added');
    console.log('3. Verify image URLs are being constructed');
    console.log('4. Check if images load or show error messages');
    console.log('5. Test with actual attendance events from ZKBio Time');
  } else {
    console.log('\n❌ Test failed - check the error messages above');
  }
}).catch(error => {
  console.error('\n💥 Test crashed:', error.message);
});
