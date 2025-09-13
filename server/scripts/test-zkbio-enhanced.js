const axios = require('axios');
const WebSocket = require('ws');

/**
 * Enhanced ZKBio Time Connection Diagnostic Script
 * Tests different authentication methods and WebSocket approaches
 */

class EnhancedZKBioTimeDiagnostic {
  constructor() {
    this.baseURL = 'http://182.180.55.96:85';
    this.websocketURL = 'ws://182.180.55.96:85/base/dashboard/realtime_punch/';
    this.credentials = {
      username: 'superuser',
      password: 'SGCit123456'
    };
    this.sessionCookies = null;
    this.csrfToken = null;
  }

  async runEnhancedDiagnostic() {
    console.log('🔍 Starting Enhanced ZKBio Time Connection Diagnostic...\n');
    
    try {
      // Step 1: Test basic connectivity
      await this.testBasicConnectivity();
      
      // Step 2: Test authentication and get proper session
      await this.testAuthenticationWithSession();
      
      // Step 3: Test different WebSocket approaches
      await this.testWebSocketApproaches();
      
    } catch (error) {
      console.error('❌ Enhanced diagnostic failed:', error.message);
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
      
    } catch (error) {
      console.error('❌ Basic connectivity failed:', error.message);
      throw error;
    }
  }

  async testAuthenticationWithSession() {
    console.log('\n🔐 Step 2: Testing authentication with proper session...');
    
    try {
      // First, get the login page to extract CSRF token
      const loginPageResponse = await axios.get(`${this.baseURL}/login/`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      // Extract CSRF token from the page
      const csrfMatch = loginPageResponse.data.match(/name="csrfmiddlewaretoken" value="([^"]+)"/);
      if (csrfMatch) {
        this.csrfToken = csrfMatch[1];
        console.log(`✅ CSRF token extracted: ${this.csrfToken.substring(0, 20)}...`);
      }

      // Now authenticate with proper form data
      const authResponse = await axios.post(`${this.baseURL}/login/`, 
        new URLSearchParams({
          username: this.credentials.username,
          password: this.credentials.password,
          csrfmiddlewaretoken: this.csrfToken
        }),
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': `${this.baseURL}/login/`,
            'Cookie': loginPageResponse.headers['set-cookie']?.join('; ') || ''
          },
          maxRedirects: 0,
          validateStatus: (status) => status < 400
        }
      );

      console.log(`✅ Authentication successful - Status: ${authResponse.status}`);
      
      // Extract cookies from authentication response
      const cookies = authResponse.headers['set-cookie'];
      if (cookies && cookies.length > 0) {
        this.sessionCookies = cookies.join('; ');
        console.log(`✅ Session cookies obtained: ${cookies.length} cookies`);
        console.log(`   Cookie preview: ${this.sessionCookies.substring(0, 100)}...`);
      }
      
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      throw error;
    }
  }

  async testWebSocketApproaches() {
    console.log('\n🔌 Step 3: Testing different WebSocket approaches...');
    
    if (!this.sessionCookies) {
      throw new Error('No session cookies available for WebSocket connection');
    }

    // Test Approach 1: Basic WebSocket with session cookies
    await this.testWebSocketApproach1();
    
    // Test Approach 2: WebSocket with additional headers
    await this.testWebSocketApproach2();
    
    // Test Approach 3: WebSocket with Django session
    await this.testWebSocketApproach3();
  }

  async testWebSocketApproach1() {
    console.log('\n   🔌 Approach 1: Basic WebSocket with session cookies...');
    
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(this.websocketURL, {
          headers: {
            'Origin': this.baseURL,
            'Cookie': this.sessionCookies,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });

        ws.on('open', () => {
          console.log('   ✅ Approach 1: WebSocket connection successful!');
          ws.close();
          resolve();
        });

        ws.on('error', (error) => {
          console.log(`   ❌ Approach 1 failed: ${error.message}`);
          resolve();
        });

        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.log('   ⏰ Approach 1: Connection timeout');
            ws.close();
            resolve();
          }
        }, 5000);

      } catch (error) {
        console.log(`   ❌ Approach 1 error: ${error.message}`);
        resolve();
      }
    });
  }

  async testWebSocketApproach2() {
    console.log('\n   🔌 Approach 2: WebSocket with additional headers...');
    
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(this.websocketURL, {
          headers: {
            'Origin': this.baseURL,
            'Cookie': this.sessionCookies,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
            'Sec-WebSocket-Protocol': 'chat, superchat'
          }
        });

        ws.on('open', () => {
          console.log('   ✅ Approach 2: WebSocket connection successful!');
          ws.close();
          resolve();
        });

        ws.on('error', (error) => {
          console.log(`   ❌ Approach 2 failed: ${error.message}`);
          resolve();
        });

        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.log('   ⏰ Approach 2: Connection timeout');
            ws.close();
            resolve();
          }
        }, 5000);

      } catch (error) {
        console.log(`   ❌ Approach 2 error: ${error.message}`);
        resolve();
      }
    });
  }

  async testWebSocketApproach3() {
    console.log('\n   🔌 Approach 3: WebSocket with Django session...');
    
    return new Promise((resolve) => {
      try {
        // Try to get a fresh session by visiting the dashboard
        axios.get(`${this.baseURL}/dashboard/`, {
          headers: {
            'Cookie': this.sessionCookies,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        }).then(response => {
          console.log(`   📊 Dashboard access: ${response.status}`);
          
          const ws = new WebSocket(this.websocketURL, {
            headers: {
              'Origin': this.baseURL,
              'Cookie': this.sessionCookies,
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Referer': `${this.baseURL}/dashboard/`
            }
          });

          ws.on('open', () => {
            console.log('   ✅ Approach 3: WebSocket connection successful!');
            ws.close();
            resolve();
          });

          ws.on('error', (error) => {
            console.log(`   ❌ Approach 3 failed: ${error.message}`);
            resolve();
          });

          setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
              console.log('   ⏰ Approach 3: Connection timeout');
              ws.close();
              resolve();
            }
          }, 5000);

        }).catch(error => {
          console.log(`   ❌ Approach 3 dashboard access failed: ${error.message}`);
          resolve();
        });

      } catch (error) {
        console.log(`   ❌ Approach 3 error: ${error.message}`);
        resolve();
      }
    });
  }
}

// Run the enhanced diagnostic
const diagnostic = new EnhancedZKBioTimeDiagnostic();
diagnostic.runEnhancedDiagnostic().catch(error => {
  console.error('❌ Enhanced diagnostic failed:', error.message);
  process.exit(1);
});
