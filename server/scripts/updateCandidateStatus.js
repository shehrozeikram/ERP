const mongoose = require('mongoose');
const Candidate = require('../models/hr/Candidate');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected for status update'))
.catch(err => console.error('❌ MongoDB connection error:', err));

const updateCandidateStatus = async () => {
  try {
    console.log('\n🔄 Updating candidate status to "passed"...\n');

    // Find candidates with status other than 'passed'
    const candidates = await Candidate.find({ 
      status: { $nin: ['passed', 'approved', 'hired'] } 
    }).limit(5);

    if (candidates.length === 0) {
      console.log('❌ No candidates found to update.');
      return;
    }

    console.log(`Found ${candidates.length} candidates to update:`);
    candidates.forEach((candidate, index) => {
      console.log(`${index + 1}. ${candidate.firstName} ${candidate.lastName} - Current status: ${candidate.status}`);
    });

    // Update the first candidate to 'passed' status
    const candidateToUpdate = candidates[0];
    const oldStatus = candidateToUpdate.status;
    
    candidateToUpdate.status = 'passed';
    candidateToUpdate.updatedAt = new Date();
    
    await candidateToUpdate.save();
    
    console.log(`\n✅ Successfully updated candidate status:`);
    console.log(`   Name: ${candidateToUpdate.firstName} ${candidateToUpdate.lastName}`);
    console.log(`   Email: ${candidateToUpdate.email}`);
    console.log(`   Status: ${oldStatus} → passed`);
    console.log(`   Updated at: ${candidateToUpdate.updatedAt}`);

    console.log('\n🎉 Candidate status updated successfully!');
    console.log('You can now run the approval system test:');
    console.log('node testApprovalSystem.js');

  } catch (error) {
    console.error('❌ Error updating candidate status:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
};

// Run the update
updateCandidateStatus(); 