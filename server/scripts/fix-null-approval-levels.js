const mongoose = require('mongoose');
require('dotenv').config();

const EvaluationDocument = require('../models/hr/EvaluationDocument');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('✅ Connected to MongoDB');

  try {
    // Find documents that are submitted but have null currentApprovalLevel
    // and have Level 0 in their approvalLevels
    const docsToFix = await EvaluationDocument.find({
      status: 'submitted',
      approvalStatus: { $in: ['pending', 'in_progress'] },
      currentApprovalLevel: null,
      'approvalLevels.level': 0
    });

    console.log(`\n🔍 Found ${docsToFix.length} documents with null currentApprovalLevel but Level 0 exists`);

    let fixedCount = 0;
    for (const doc of docsToFix) {
      // Check if Level 0 is pending
      const level0 = doc.approvalLevels.find(l => l.level === 0);
      if (level0 && level0.status === 'pending') {
        doc.currentApprovalLevel = 0;
        await doc.save();
        fixedCount++;
        console.log(`✅ Fixed doc ${doc._id} - set currentApprovalLevel to 0`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Fixed: ${fixedCount} documents`);
    console.log(`   ⏭️  Skipped: ${docsToFix.length - fixedCount} documents (Level 0 not pending)`);

    // Also check documents that have no approvalLevels at all
    const docsWithoutLevels = await EvaluationDocument.find({
      status: 'submitted',
      approvalStatus: { $in: ['pending', 'in_progress'] },
      $or: [
        { approvalLevels: { $exists: false } },
        { approvalLevels: { $size: 0 } }
      ]
    });

    console.log(`\n🔍 Found ${docsWithoutLevels.length} documents without approvalLevels`);
    console.log(`   ⚠️  These need to be re-saved to trigger the pre-save middleware`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
};

run();























