const axios = require('axios');

async function testPublicApprovalPage() {
  try {
    console.log('🔍 Testing public approval page...');
    
    // Get the approval ID from the latest approval
    const approvalId = '688ba5390f7d98c37c6b54af'; // From the last test
    
    console.log(`📋 Testing approval ID: ${approvalId}`);
    
    // Test the public GET endpoint
    console.log('🔄 Making GET request to public approval endpoint...');
    
    const response = await axios.get(`http://localhost:5001/api/public-approvals/${approvalId}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Public approval page data retrieved successfully!');
    console.log('Response status:', response.status);
    
    const approval = response.data.data;
    console.log('\n📊 Approval Details:');
    console.log(`   Candidate: ${approval.candidate.firstName} ${approval.candidate.lastName}`);
    console.log(`   Job: ${approval.jobPosting.title}`);
    console.log(`   Status: ${approval.status}`);
    console.log(`   Current Level: ${approval.currentLevel}`);
    
    console.log('\n📋 Approval Levels:');
    approval.approvalLevels.forEach(level => {
      const levelNames = {
        1: 'Assistant Manager HR',
        2: 'Manager HR',
        3: 'HOD HR',
        4: 'Vice President',
        5: 'CEO'
      };
      console.log(`   Level ${level.level} (${levelNames[level.level]}): ${level.status}`);
    });
    
    console.log('\n🎉 Public approval page is working!');
    console.log('\n📝 Now you can:');
    console.log(`1. Visit: http://localhost:3000/public-approval/${approvalId}`);
    console.log('2. The page should load without requiring login');
    console.log('3. You should see the candidate information and approval buttons');
    console.log('4. Click "Review & Approve" to test the approval process');
    
  } catch (error) {
    console.error('❌ Error during public approval page test:', error);
    
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
testPublicApprovalPage(); 