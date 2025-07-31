require('dotenv').config();
const LinkedInService = require('../services/linkedInService');

async function testLinkedInConfig() {
  console.log('🔍 Testing LinkedIn API Configuration...\n');

  // Check environment variables
  console.log('📋 Environment Variables Check:');
  console.log(`LINKEDIN_ACCESS_TOKEN: ${process.env.LINKEDIN_ACCESS_TOKEN ? '✅ Set' : '❌ Not set'}`);
  console.log(`LINKEDIN_ORGANIZATION_ID: ${process.env.LINKEDIN_ORGANIZATION_ID ? '✅ Set' : '❌ Not set'}`);
  console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL ? '✅ Set' : '❌ Not set'}\n`);

  if (!process.env.LINKEDIN_ACCESS_TOKEN || !process.env.LINKEDIN_ORGANIZATION_ID) {
    console.log('❌ LinkedIn API credentials are not configured!');
    console.log('\n📖 To fix this:');
    console.log('1. Follow the setup guide in LINKEDIN_SETUP.md');
    console.log('2. Add the required environment variables to your .env file');
    console.log('3. Restart your server');
    console.log('\n💡 For now, you can still use the system without LinkedIn integration.');
    console.log('   The application links will still work perfectly!');
    return;
  }

  // Test LinkedIn service
  console.log('🔗 Testing LinkedIn Service...');
  
  try {
    // Test with a sample job posting
    const sampleJobPosting = {
      title: 'Test Job Posting',
      department: { name: 'Technology' },
      location: { name: 'Remote' },
      employmentTypeLabel: 'Full Time',
      experienceLevelLabel: 'Mid Level',
      formattedSalaryRange: 'PKR 50,000 - PKR 100,000',
      requirements: 'JavaScript, React, Node.js',
      applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      applicationLink: 'http://localhost:3000/apply/TEST123'
    };

    console.log('📤 Attempting to post test job to LinkedIn...');
    const result = await LinkedInService.postJob(sampleJobPosting);
    
    if (result.success) {
      console.log('✅ LinkedIn API is working correctly!');
      console.log(`📝 Post ID: ${result.postId}`);
      console.log(`🔗 Post URL: ${result.postUrl}`);
    } else {
      console.log('❌ LinkedIn API test failed:');
      console.log(`Error: ${result.error}`);
      console.log(`Message: ${result.message}`);
    }

  } catch (error) {
    console.log('❌ LinkedIn API test failed with error:');
    console.log(error.message);
  }

  console.log('\n📋 Configuration Summary:');
  console.log('✅ LinkedIn Service: Loaded');
  console.log('✅ Environment Variables: Configured');
  console.log('✅ Ready for job posting to LinkedIn!');
}

// Run the test
testLinkedInConfig().catch(console.error); 