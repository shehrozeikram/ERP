const axios = require('axios');
const WebSocket = require('ws');

/**
 * Comprehensive ZKBio Time Connection Diagnostic Script
 * Tests authentication, WebSocket connection, and real-time data flow
 */

class ZKBioTimeDiagnostic {
  constructor() {
    this.baseURL = 'http://182.180.55.96:85';
    this.websocketURL = 'ws://182.180.55.96:85/base/dashboard/realtime_punch/';
    this.credentials = {
      username: 'superuser',
      password: 'SGCit123456'
    };
    this.sessionCookies = null;
    this.ws = null;
  }

  async runDiagnostic() {
    console.log('🔍 Starting ZKBio Time Connection Diagnostic...\n');
    
    try {
      // Step 1: Test basic connectivity
      await this.testBasicConnectivity();
      
      // Step 2: Test authentication
      await this.testAuthentication();
      
      // Step 3: Test WebSocket connection
      await this.testWebSocketConnection();
      
      // Step 4: Monitor real-time data
      await this.monitorRealtimeData();
      
    } catch (error) {
      console.error('❌ Diagnostic failed:', error.message);
    }
  }

  async testBasicConnectivity() {
    console.log('📡 Step 1: Testing basic connectivity...');
    
    try {
      const response = await axios.get(this.baseURL, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      console.log(`✅ Basic connectivity OK - Status: ${response.status}`);
      console.log(`   Response headers: ${JSON.stringify(response.headers, null, 2)}`);
      
    } catch (error) {
      console.error('❌ Basic connectivity failed:', error.message);
      throw error;
    }
  }

  async testAuthentication() {
    console.log('\n🔐 Step 2: Testing authentication...');
    
    try {
      const response = await axios.get(this.baseURL, {
        auth: {
          username: this.credentials.username,
          password: this.credentials.password
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000
      });

      console.log(`✅ Authentication successful - Status: ${response.status}`);
      
      // Extract cookies
      const cookies = response.headers['set-cookie'];
      if (cookies && cookies.length > 0) {
        this.sessionCookies = cookies.join('; ');
        console.log(`✅ Session cookies obtained: ${cookies.length} cookies`);
        console.log(`   Cookie preview: ${this.sessionCookies.substring(0, 100)}...`);
      } else {
        console.log('⚠️  No cookies received - authentication might not be working properly');
      }
      
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      throw error;
    }
  }

  async testWebSocketConnection() {
    console.log('\n🔌 Step 3: Testing WebSocket connection...');
    
    if (!this.sessionCookies) {
      throw new Error('No session cookies available for WebSocket connection');
    }

    return new Promise((resolve, reject) => {
      try {
        console.log(`   Connecting to: ${this.websocketURL}`);
        console.log(`   Using cookies: ${this.sessionCookies.substring(0, 50)}...`);
        
        this.ws = new WebSocket(this.websocketURL, {
          headers: {
            'Origin': this.baseURL,
            'Cookie': this.sessionCookies,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });

        this.ws.on('open', () => {
          console.log('✅ WebSocket connection established successfully!');
          console.log('   Ready to receive real-time attendance data...');
          resolve();
        });

        this.ws.on('error', (error) => {
          console.error('❌ WebSocket connection error:', error.message);
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
        });

        // Set timeout for connection
        setTimeout(() => {
          if (this.ws.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);

      } catch (error) {
        console.error('❌ WebSocket connection failed:', error.message);
        reject(error);
      }
    });
  }

  async monitorRealtimeData() {
    console.log('\n📊 Step 4: Monitoring real-time data...');
    console.log('   Waiting for attendance events (will monitor for 60 seconds)...\n');
    
    let eventCount = 0;
    let lastEventTime = null;

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        eventCount++;
        lastEventTime = new Date();
        
        console.log(`📊 Event #${eventCount} received at ${lastEventTime.toLocaleTimeString()}`);
        
        if (message.data && message.data.length > 0) {
          console.log(`   📋 Processing ${message.data.length} attendance records:`);
          
          message.data.forEach((row, index) => {
            const event = {
              id: row[0],
              empCode: row[1],
              name: row[2],
              time: row[3],
              state: row[4],
              location: row[7]
            };
            
            console.log(`   ${index + 1}. ${event.name} (${event.empCode}) - ${event.state} at ${event.time}`);
            if (event.location) {
              console.log(`      📍 Location: ${event.location}`);
            }
          });
          
          console.log(`   ✅ Successfully processed ${message.data.length} events\n`);
        } else {
          console.log('   ⚠️  Empty data received\n');
        }
        
      } catch (error) {
        console.error('❌ Error processing message:', error.message);
        console.log('   Raw data:', data.toString().substring(0, 200) + '...');
      }
    });

    // Monitor for 60 seconds
    setTimeout(() => {
      console.log('\n📈 Monitoring Summary:');
      console.log(`   Total events received: ${eventCount}`);
      console.log(`   Last event time: ${lastEventTime ? lastEventTime.toLocaleTimeString() : 'None'}`);
      
      if (eventCount > 0) {
        console.log('✅ Real-time data flow is working correctly!');
        console.log('   The connection matches ZKBio Time system behavior.');
      } else {
        console.log('⚠️  No events received during monitoring period.');
        console.log('   This could mean:');
        console.log('   - No employees are currently punching in/out');
        console.log('   - The system is in idle state');
        console.log('   - There might be a data format issue');
      }
      
      this.cleanup();
    }, 60000);
  }

  cleanup() {
    if (this.ws) {
      this.ws.close();
      console.log('\n🔌 WebSocket connection closed');
    }
    console.log('\n✅ Diagnostic completed');
  }
}

// Run the diagnostic
const diagnostic = new ZKBioTimeDiagnostic();
diagnostic.runDiagnostic().catch(error => {
  console.error('❌ Diagnostic failed:', error.message);
  process.exit(1);
});
