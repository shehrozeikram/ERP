const mongoose = require('mongoose');
require('dotenv').config();

require('../models/User');
const EvaluationDocument = require('../models/hr/EvaluationDocument');

async function checkDocuments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    const docs = await EvaluationDocument.find({
      status: 'submitted',
      approvalStatus: { $in: ['pending', 'in_progress'] }
    }).limit(10).select('_id currentApprovalLevel approvalLevels');

    console.log(`\n📋 Checking ${docs.length} documents:\n`);

    docs.forEach(doc => {
      const hasLevel0 = doc.approvalLevels?.some(l => l.level === 0);
      const levels = doc.approvalLevels?.map(l => l.level).sort((a, b) => a - b) || [];
      console.log(`Doc ${doc._id}:`);
      console.log(`   currentLevel: ${doc.currentApprovalLevel}`);
      console.log(`   hasLevel0: ${hasLevel0}`);
      console.log(`   levels: [${levels.join(', ')}]`);
      console.log('');
    });

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkDocuments();



























