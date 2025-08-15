const axios = require('axios');
const mongoose = require('mongoose');

class LinkedInService {
  constructor() {
    this.isRunning = false;
    this.accessToken = null;
    this.apiBaseUrl = 'https://api.linkedin.com/v2';
    this.clientId = process.env.LINKEDIN_CLIENT_ID;
    this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    this.redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  }

  async start() {
    if (this.isRunning) {
      console.log('LinkedIn Service is already running');
      return;
    }

    try {
      console.log('🚀 Starting LinkedIn Service...');
      
      // Initialize LinkedIn connection
      await this.initializeLinkedIn();
      
      this.isRunning = true;
      console.log('✅ LinkedIn Service started successfully');
      
    } catch (error) {
      console.error('❌ Error starting LinkedIn Service:', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      console.log('LinkedIn Service is not running');
      return;
    }

    try {
      console.log('🛑 Stopping LinkedIn Service...');
      
      this.isRunning = false;
      this.accessToken = null;
      
      console.log('✅ LinkedIn Service stopped successfully');
      
    } catch (error) {
      console.error('❌ Error stopping LinkedIn Service:', error);
      throw error;
    }
  }

  async initializeLinkedIn() {
    try {
      console.log('🔗 Initializing LinkedIn connection...');
      
      // Check if we have stored access token
      const storedToken = await this.getStoredAccessToken();
      
      if (storedToken && !this.isTokenExpired(storedToken)) {
        this.accessToken = storedToken.token;
        console.log('✅ Using stored LinkedIn access token');
      } else {
        console.log('⚠️ No valid access token found, need to authenticate');
      }
      
    } catch (error) {
      console.error('❌ Error initializing LinkedIn:', error);
      throw error;
    }
  }

  async getStoredAccessToken() {
    try {
      // This would typically retrieve from database or secure storage
      // For now, return null to indicate no stored token
      return null;
    } catch (error) {
      console.error('❌ Error retrieving stored access token:', error);
      return null;
    }
  }

  isTokenExpired(token) {
    try {
      // Check if token is expired
      // This would typically decode JWT or check expiration timestamp
      return false;
    } catch (error) {
      console.error('❌ Error checking token expiration:', error);
      return true;
    }
  }

  async authenticate(code) {
    try {
      console.log('🔐 Authenticating with LinkedIn...');
      
      const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', {
        grant_type: 'authorization_code',
        code: code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri
      });

      if (tokenResponse.data.access_token) {
        this.accessToken = tokenResponse.data.access_token;
        
        // Store the token securely
        await this.storeAccessToken(tokenResponse.data);
        
        console.log('✅ LinkedIn authentication successful');
        return true;
      } else {
        throw new Error('No access token received');
      }
      
    } catch (error) {
      console.error('❌ LinkedIn authentication failed:', error);
      throw error;
    }
  }

  async storeAccessToken(tokenData) {
    try {
      // Store token securely in database or secure storage
      console.log('💾 Storing LinkedIn access token');
      
    } catch (error) {
      console.error('❌ Error storing access token:', error);
    }
  }

  async getAuthorizationUrl() {
    try {
      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
        `response_type=code&` +
        `client_id=${this.clientId}&` +
        `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
        `scope=r_liteprofile%20r_emailaddress%20w_member_social`;

      return authUrl;
      
    } catch (error) {
      console.error('❌ Error generating authorization URL:', error);
      throw error;
    }
  }

  async getProfile() {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      const response = await axios.get(`${this.apiBaseUrl}/me`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
      
    } catch (error) {
      console.error('❌ Error fetching LinkedIn profile:', error);
      throw error;
    }
  }

  async searchJobs(keywords, location, limit = 10) {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      const response = await axios.get(`${this.apiBaseUrl}/jobSearch`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          keywords: keywords,
          location: location,
          limit: limit
        }
      });

      return response.data;
      
    } catch (error) {
      console.error('❌ Error searching LinkedIn jobs:', error);
      throw error;
    }
  }

  async postJobUpdate(jobPosting) {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      const postData = {
        author: `urn:li:person:${await this.getProfileId()}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: `We're hiring! ${jobPosting.title} at ${jobPosting.company}`
            },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      };

      const response = await axios.post(`${this.apiBaseUrl}/ugcPosts`, postData, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Job update posted to LinkedIn successfully');
      return response.data;
      
    } catch (error) {
      console.error('❌ Error posting job update to LinkedIn:', error);
      throw error;
    }
  }

  async getProfileId() {
    try {
      const profile = await this.getProfile();
      return profile.id;
    } catch (error) {
      console.error('❌ Error getting profile ID:', error);
      throw error;
    }
  }

  async syncJobPostings() {
    try {
      console.log('🔄 Syncing job postings with LinkedIn...');
      
      // Get active job postings from database
      const JobPosting = mongoose.model('JobPosting');
      const activePostings = await JobPosting.find({ 
        status: 'Active',
        isPublic: true 
      });

      console.log(`📋 Found ${activePostings.length} active job postings to sync`);

      for (const posting of activePostings) {
        try {
          // Check if already posted to LinkedIn
          if (!posting.linkedInPostId) {
            await this.postJobUpdate(posting);
            
            // Update posting with LinkedIn post ID
            posting.linkedInPostId = 'posted'; // This would be the actual post ID
            posting.linkedInPostedAt = new Date();
            await posting.save();
            
            console.log(`✅ Job posting "${posting.title}" synced to LinkedIn`);
          }
        } catch (error) {
          console.error(`❌ Error syncing job posting "${posting.title}":`, error);
        }
      }
      
      console.log('✅ Job postings sync completed');
      
    } catch (error) {
      console.error('❌ Error syncing job postings:', error);
    }
  }

  async getAnalytics() {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      // Get analytics data from LinkedIn
      const response = await axios.get(`${this.apiBaseUrl}/analytics`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
      
    } catch (error) {
      console.error('❌ Error fetching LinkedIn analytics:', error);
      throw error;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isAuthenticated: !!this.accessToken,
      serviceName: 'LinkedIn Service'
    };
  }
}

module.exports = new LinkedInService();
