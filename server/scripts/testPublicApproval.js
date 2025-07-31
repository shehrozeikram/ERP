const axios = require('axios');

async function testPublicApproval() {
  try {
    console.log('🔍 Testing public approval endpoint...');
    
    // First, get the approval ID from the latest approval
    const approvalId = '688b9e416f3b6c492a67872b'; // From the last test
    
    console.log(`📋 Testing approval ID: ${approvalId}`);
    
    // Test the public approval endpoint
    const approvalData = {
      comments: 'Test approval from external approver',
      signature: 'External Approver',
      approverEmail: 'assistant.hr@company.com'
    };
    
    console.log('🔄 Making public approval request...');
    console.log('Request data:', JSON.stringify(approvalData, null, 2));
    
    const response = await axios.post(`http://localhost:5001/api/candidate-approvals/public/${approvalId}/approve-public`, approvalData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Public approval successful!');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    console.log('\n🎉 Public approval endpoint is working!');
    console.log('\n📝 Now you can:');
    console.log('1. Check Mailtrap for the Level 2 email');
    console.log('2. Click the email link to test the frontend approval page');
    console.log('3. The approval should work without requiring login');
    
  } catch (error) {
    console.error('❌ Error during public approval test:', error);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error details:', error.message);
    }
  }
}

// Run the test
testPublicApproval(); 