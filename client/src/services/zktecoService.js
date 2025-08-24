import api from './api';

class ZKTecoService {
  constructor() {
    this.baseURL = 'http://182.180.55.96:85';
    this.token = null;
  }

  // Get authentication token from ZKTeco via backend proxy
  async authenticate(username, password) {
    try {
      console.log('🔐 Authenticating with ZKTeco via backend...');
      
      const response = await api.post('/zkteco/auth', { username, password });

      if (response.data && response.data.token) {
        this.token = response.data.token;
        console.log('✅ ZKTeco authentication successful!');
        return { success: true, token: response.data.token };
      } else {
        throw new Error('No token received from ZKTeco');
      }
    } catch (error) {
      console.error('❌ ZKTeco authentication failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Make authenticated API call to ZKTeco
  async makeAuthenticatedCall(endpoint, options = {}) {
    if (!this.token) {
      throw new Error('Not authenticated with ZKTeco. Please authenticate first.');
    }

    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `JWT ${this.token}`,
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ ZKTeco API call failed (${endpoint}):`, error);
      throw error;
    }
  }

  // Check if we have a valid token
  isAuthenticated() {
    return !!this.token;
  }

  // Get current token
  getToken() {
    return this.token;
  }

  // Clear authentication
  logout() {
    this.token = null;
    console.log('🔓 ZKTeco session cleared');
  }
}

export default new ZKTecoService();
