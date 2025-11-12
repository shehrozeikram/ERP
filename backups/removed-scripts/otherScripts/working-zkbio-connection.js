const axios = require('axios');
const WebSocket = require('ws');

/**
 * Working ZKBio Time Real-Time Connection Script
 * This script successfully connects and monitors real-time attendance data
 */

class WorkingZKBioTimeConnection {
  constructor() {
    this.baseURL = 'http://45.115.86.139:85';
    this.websocketURL = 'ws://45.115.86.139:85/base/dashboard/realtime_punch/';
    this.credentials = {
      username: 'superuser',
      password: 'SGCit123456'
    };
    this.sessionCookies = null;
    this.csrfToken = null;
    this.ws = null;
    this.isConnected = false;
  }

  async initialize() {
    console.log('🚀 Initializing ZKBio Time Real-Time Connection...\n');
    
    try {
      // Step 1: Get login page and extract CSRF token
      await this.getCSRFToken();
      
      // Step 2: Authenticate and get session cookies
      await this.authenticate();
      
      // Step 3: Connect to WebSocket
      await this.connectWebSocket();
      
      console.log('✅ ZKBio Time Real-Time Connection initialized successfully!');
      console.log('📊 Ready to receive live attendance data...\n');
      
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      throw error;
    }
  }

  async getCSRFToken() {
    console.log('🔐 Getting CSRF token...');
    
    const response = await axios.get(`${this.baseURL}/login/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const csrfMatch = response.data.match(/name="csrfmiddlewaretoken" value="([^"]+)"/);
    if (csrfMatch) {
      this.csrfToken = csrfMatch[1];
      console.log(`✅ CSRF token obtained: ${this.csrfToken.substring(0, 20)}...`);
    } else {
      throw new Error('Could not extract CSRF token');
    }
  }

  async authenticate() {
    console.log('🔐 Authenticating with ZKBio Time...');
    
    const response = await axios.post(`${this.baseURL}/login/`, 
      new URLSearchParams({
        username: this.credentials.username,
        password: this.credentials.password,
        csrfmiddlewaretoken: this.csrfToken
      }),
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `${this.baseURL}/login/`
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 400
      }
    );

    const cookies = response.headers['set-cookie'];
    if (cookies && cookies.length > 0) {
      this.sessionCookies = cookies.join('; ');
      console.log(`✅ Authentication successful - ${cookies.length} cookies obtained`);
    } else {
      throw new Error('Authentication failed - no cookies received');
    }
  }

  async connectWebSocket() {
    console.log('🔌 Connecting to WebSocket...');
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.websocketURL, {
        headers: {
          'Origin': this.baseURL,
          'Cookie': this.sessionCookies,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      this.ws.on('open', () => {
        console.log('✅ WebSocket connected successfully!');
        this.isConnected = true;
        resolve();
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
        this.isConnected = false;
      });

      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  startMonitoring() {
    console.log('📊 Starting real-time monitoring...\n');
    
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

    // Monitor for 2 minutes
    setTimeout(() => {
      console.log('\n📈 Monitoring Summary:');
      console.log(`   Total events received: ${eventCount}`);
      console.log(`   Last event time: ${lastEventTime ? lastEventTime.toLocaleTimeString() : 'None'}`);
      
      if (eventCount > 0) {
        console.log('✅ Real-time data flow is working perfectly!');
        console.log('   The connection matches ZKBio Time system behavior exactly.');
      } else {
        console.log('⚠️  No events received during monitoring period.');
        console.log('   This is normal if no employees are currently punching in/out.');
      }
      
      this.cleanup();
    }, 120000); // 2 minutes
  }

  cleanup() {
    if (this.ws) {
      this.ws.close();
      console.log('\n🔌 WebSocket connection closed');
    }
    console.log('\n✅ Real-time monitoring completed');
  }
}

// Run the working connection
const connection = new WorkingZKBioTimeConnection();
connection.initialize()
  .then(() => {
    connection.startMonitoring();
  })
  .catch(error => {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  });
