const mongoose = require('mongoose');
const Candidate = require('../models/hr/Candidate');
const CandidateApproval = require('../models/hr/CandidateApproval');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function cleanupSarahApprovals() {
  try {
    console.log('🔍 Finding Sarah Ahmed...');
    
    const sarah = await Candidate.findOne({ 
      email: 'sarah.ahmed.nodejs@example.com' 
    });
    
    if (!sarah) {
      console.log('❌ Sarah Ahmed not found.');
      return;
    }
    
    console.log(`✅ Found Sarah Ahmed: ${sarah.firstName} ${sarah.lastName}`);
    console.log(`   Status: ${sarah.status}`);
    
    // Check for existing approval workflows
    console.log('\n🔍 Checking for existing approval workflows...');
    const existingApprovals = await CandidateApproval.find({ candidate: sarah._id });
    
    if (existingApprovals.length > 0) {
      console.log(`⚠️  Found ${existingApprovals.length} existing approval workflow(s) for Sarah`);
      
      // Delete existing approvals
      await CandidateApproval.deleteMany({ candidate: sarah._id });
      console.log('✅ Deleted existing approval workflows');
      
      // Reset Sarah's status to shortlisted if it was changed by approval process
      if (sarah.status === 'approval_pending' || sarah.status === 'approval_in_progress') {
        sarah.status = 'shortlisted';
        await sarah.save();
        console.log('✅ Reset Sarah status to shortlisted');
      }
    } else {
      console.log('✅ No existing approval workflows found');
    }
    
    console.log('\n🎉 Cleanup completed! Sarah is ready for testing.');
    console.log('\n📝 Ready to test the workflow:');
    console.log('1. Go to frontend: http://localhost:3000');
    console.log('2. Login with admin@sgc.com / password123');
    console.log('3. Navigate to: HR Module → Talent Acquisition → Candidates');
    console.log('4. Find Sarah Ahmed (status: shortlisted)');
    console.log('5. Change status to "Passed Interview"');
    console.log('6. Configure approval workflow');
    console.log('7. Check Mailtrap for 5 approval emails');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupSarahApprovals(); 