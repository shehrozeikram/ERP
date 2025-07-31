const axios = require('axios');

class LinkedInService {
  constructor() {
    this.accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
    this.organizationId = process.env.LINKEDIN_ORGANIZATION_ID;
    this.apiVersion = 'v2';
    this.baseURL = `https://api.linkedin.com/${this.apiVersion}`;
  }

  // Post job to LinkedIn
  async postJob(jobPosting) {
    try {
      if (!this.accessToken || !this.organizationId) {
        throw new Error('LinkedIn API credentials not configured. Please set LINKEDIN_ACCESS_TOKEN and LINKEDIN_ORGANIZATION_ID in your environment variables.');
      }

      // Create LinkedIn job post content
      const postContent = this.createJobPostContent(jobPosting);
      
      // Post to LinkedIn
      const response = await axios.post(
        `${this.baseURL}/ugcPosts`,
        postContent,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        }
      );

      return {
        success: true,
        postId: response.data.id,
        postUrl: `https://www.linkedin.com/feed/update/${response.data.id}/`,
        message: 'Job posted to LinkedIn successfully'
      };

    } catch (error) {
      console.error('LinkedIn posting error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        message: 'Failed to post to LinkedIn'
      };
    }
  }

  // Create job post content for LinkedIn
  createJobPostContent(jobPosting) {
    const jobDescription = this.formatJobDescription(jobPosting);
    
    return {
      author: `urn:li:organization:${this.organizationId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: `🚀 We're hiring! ${jobPosting.title}\n\n${jobDescription}\n\n💼 Apply now: ${jobPosting.applicationLink}\n\n#hiring #jobopportunity #careers`
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };
  }

  // Format job description for LinkedIn
  formatJobDescription(jobPosting) {
    const lines = [];
    
    // Basic info
    lines.push(`📍 Location: ${jobPosting.location?.name || 'Not specified'}`);
    lines.push(`💼 Type: ${jobPosting.employmentTypeLabel}`);
    lines.push(`📚 Level: ${jobPosting.experienceLevelLabel}`);
    lines.push(`💰 Salary: ${jobPosting.formattedSalaryRange}`);
    
    // Key requirements (first 3)
    if (jobPosting.requirements) {
      const requirements = jobPosting.requirements.split('\n').slice(0, 3);
      lines.push(`\n🔍 Key Requirements:`);
      requirements.forEach(req => {
        if (req.trim()) lines.push(`• ${req.trim()}`);
      });
    }
    
    // Application deadline
    if (jobPosting.applicationDeadline) {
      const deadline = new Date(jobPosting.applicationDeadline).toLocaleDateString();
      lines.push(`\n⏰ Apply by: ${deadline}`);
    }
    
    return lines.join('\n');
  }

  // Get LinkedIn post status
  async getPostStatus(postId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/ugcPosts/${postId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0'
          }
        }
      );
      
      return {
        success: true,
        status: response.data.lifecycleState,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // Delete LinkedIn post
  async deletePost(postId) {
    try {
      await axios.delete(
        `${this.baseURL}/ugcPosts/${postId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0'
          }
        }
      );
      
      return {
        success: true,
        message: 'LinkedIn post deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
}

module.exports = new LinkedInService(); 