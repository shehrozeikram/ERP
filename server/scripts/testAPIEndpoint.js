const axios = require('axios');
const mongoose = require('mongoose');
const Candidate = require('../models/hr/Candidate');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function testAPIEndpoint() {
  try {
    console.log('🔍 Finding a candidate and user for API testing...');
    
    // Find Sarah Ahmed specifically
    const candidate = await Candidate.findOne({ 
      email: 'sarah.ahmed.nodejs@example.com' 
    });
    
    // Find a user (admin or hr_manager)
    const user = await User.findOne({ 
      role: { $in: ['admin', 'hr_manager'] } 
    });
    
    if (!candidate) {
      console.log('❌ No suitable candidate found.');
      return;
    }
    
    if (!user) {
      console.log('❌ No suitable user found.');
      return;
    }
    
    console.log(`✅ Found candidate: ${candidate.firstName} ${candidate.lastName}`);
    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.role})`);
    
    // First, get a token by logging in
    console.log('\n🔐 Getting authentication token...');
    
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: user.email,
      password: 'password123' // Assuming this is the default password
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Authentication successful');
    
    // Prepare the approval request data
    const approvalData = {
      candidateId: candidate._id.toString(),
      jobPostingId: '688a0e15e1a3b69572795558', // Valid Job Posting ID
      applicationId: '688b459a5961257b92c0202f', // Valid Application ID
      approverEmails: [
        'assistant.hr@company.com',
        'manager.hr@company.com',
        'hod.hr@company.com',
        'vp@company.com',
        'ceo@company.com'
      ],
      createdBy: user._id.toString()
    };
    
    console.log('\n📋 API request data:');
    console.log(JSON.stringify(approvalData, null, 2));
    
    // Make the API call to create approval
    console.log('\n🔄 Making API call to create approval...');
    
    const response = await axios.post('http://localhost:5001/api/candidate-approvals', approvalData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ API call successful!');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    console.log('\n🎉 API endpoint test completed successfully!');
    console.log('\n📝 The frontend should now be able to create approval workflows.');
    
  } catch (error) {
    console.error('❌ Error during API test:', error);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error details:', error.message);
    }
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testAPIEndpoint(); 