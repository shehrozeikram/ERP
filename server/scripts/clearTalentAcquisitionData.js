const mongoose = require('mongoose');
const JobPosting = require('../models/hr/JobPosting');
const Candidate = require('../models/hr/Candidate');
const Application = require('../models/hr/Application');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const clearTalentAcquisitionData = async () => {
  try {
    console.log('🧹 Clearing existing Talent Acquisition data...');
    
    // Clear all data
    await Promise.all([
      JobPosting.deleteMany({}),
      Candidate.deleteMany({}),
      Application.deleteMany({})
    ]);
    
    console.log('✅ Cleared all Talent Acquisition data successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing data:', error);
  } finally {
    mongoose.connection.close();
  }
};

clearTalentAcquisitionData(); 