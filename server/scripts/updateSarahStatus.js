const mongoose = require('mongoose');
const Candidate = require('../models/hr/Candidate');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function updateSarahStatus() {
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
    console.log(`   Current status: ${sarah.status}`);
    console.log(`   Email: ${sarah.email}`);
    
    // Update status to shortlisted
    console.log('\n🔄 Updating status to "shortlisted"...');
    sarah.status = 'shortlisted';
    await sarah.save();
    
    console.log(`✅ Status updated to: ${sarah.status}`);
    
    console.log('\n📝 Next steps:');
    console.log('1. Go to the frontend: http://localhost:3000');
    console.log('2. Login with admin@sgc.com / password123');
    console.log('3. Navigate to: HR Module → Talent Acquisition → Candidates');
    console.log('4. Find Sarah Ahmed in the list');
    console.log('5. Change her status from "Shortlisted" to "Passed Interview"');
    console.log('6. Configure the approval workflow in the dialog');
    console.log('7. Check Mailtrap for the 5 approval emails');
    
  } catch (error) {
    console.error('❌ Error updating Sarah status:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the update
updateSarahStatus(); 