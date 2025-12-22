const mongoose = require('mongoose');
require('dotenv').config();

const ApprovalLevelConfiguration = require('../models/hr/ApprovalLevelConfiguration');
const EvaluationDocument = require('../models/hr/EvaluationDocument');
const User = require('../models/User');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('✅ Connected to MongoDB');

  try {
    const user = await User.findOne({ email: 'mattcronje@tovus.net' });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`\n👤 User: ${user.firstName} ${user.lastName} (${user._id})`);

    // Check assigned levels
    const configs = await ApprovalLevelConfiguration.find({
      module: 'evaluation_appraisal',
      assignedUser: user._id,
      isActive: true
    });
    
    console.log(`\n📋 Assigned Levels:`, configs.map(c => `Level ${c.level} (${c.title})`));

    // Check documents at Level 0
    const docsAtLevel0 = await EvaluationDocument.countDocuments({
      status: 'submitted',
      approvalStatus: { $in: ['pending', 'in_progress'] },
      currentApprovalLevel: 0
    });
    
    console.log(`\n📄 Documents at Level 0: ${docsAtLevel0}`);

    // Check sample documents
    const sampleDocs = await EvaluationDocument.find({
      status: 'submitted',
      approvalStatus: { $in: ['pending', 'in_progress'] }
    })
      .limit(5)
      .select('_id currentApprovalLevel status approvalStatus name');
    
    console.log(`\n📋 Sample submitted documents:`);
    sampleDocs.forEach(d => {
      console.log(`  - Doc ${d._id}: currentLevel=${d.currentApprovalLevel}, status=${d.status}, name=${d.name || 'N/A'}`);
    });

    // Check if documents have Level 0 in approvalLevels
    const docsWithLevel0 = await EvaluationDocument.find({
      status: 'submitted',
      approvalStatus: { $in: ['pending', 'in_progress'] },
      'approvalLevels.level': 0
    })
      .limit(5)
      .select('_id currentApprovalLevel approvalLevels');
    
    console.log(`\n📋 Documents with Level 0 in approvalLevels: ${docsWithLevel0.length}`);
    docsWithLevel0.forEach(d => {
      const level0 = d.approvalLevels.find(l => l.level === 0);
      console.log(`  - Doc ${d._id}: currentLevel=${d.currentApprovalLevel}, level0Status=${level0?.status || 'N/A'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
};

run();





















