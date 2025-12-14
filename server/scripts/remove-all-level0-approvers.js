const mongoose = require('mongoose');
require('dotenv').config();

// Register models
require('../models/User');
const EvaluationDocument = require('../models/hr/EvaluationDocument');
const ApprovalLevelConfiguration = require('../models/hr/ApprovalLevelConfiguration');
const Employee = require('../models/hr/Employee');

async function removeAllLevel0Approvers() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Find all Level 0 configurations
    const level0Configs = await ApprovalLevelConfiguration.find({
      module: 'evaluation_appraisal',
      level: 0
    }).populate('assignedUser', 'firstName lastName email');

    console.log(`📋 Found ${level0Configs.length} Level 0 approver configuration(s):\n`);
    
    if (level0Configs.length > 0) {
      level0Configs.forEach((config, index) => {
        const user = config.assignedUser;
        console.log(`${index + 1}. ${config.title}`);
        console.log(`   User: ${user ? `${user.firstName} ${user.lastName} (${user.email})` : 'N/A'}`);
        console.log(`   Active: ${config.isActive}`);
        console.log(`   ID: ${config._id}`);
        console.log('');
      });
    } else {
      console.log('   No Level 0 configurations found.\n');
    }

    // Step 2: Find documents with Level 0 in approvalLevels
    const docsWithLevel0 = await EvaluationDocument.find({
      'approvalLevels.level': 0
    }).select('_id currentApprovalLevel status approvalStatus approvalLevels');

    console.log(`📄 Found ${docsWithLevel0.length} document(s) with Level 0 in approvalLevels:\n`);

    // Step 3: Find documents with currentApprovalLevel = 0
    const docsAtLevel0 = await EvaluationDocument.find({
      currentApprovalLevel: 0
    }).select('_id currentApprovalLevel status approvalStatus approvalLevels');

    console.log(`📄 Found ${docsAtLevel0.length} document(s) currently at Level 0:\n`);

    // Ask for confirmation
    const totalDocsToUpdate = docsWithLevel0.length + docsAtLevel0.length;
    const uniqueDocIds = new Set([
      ...docsWithLevel0.map(d => d._id.toString()),
      ...docsAtLevel0.map(d => d._id.toString())
    ]);

    console.log(`\n⚠️  SUMMARY:`);
    console.log(`   Level 0 Configurations to remove: ${level0Configs.length}`);
    console.log(`   Documents to update: ${uniqueDocIds.size}`);
    console.log(`\n🔄 This will:`);
    console.log(`   1. Delete all Level 0 ApprovalLevelConfiguration records`);
    console.log(`   2. Remove Level 0 entries from all documents' approvalLevels arrays`);
    console.log(`   3. Update documents with currentApprovalLevel = 0 to currentApprovalLevel = 1`);
    console.log(`\n⚠️  WARNING: This action cannot be undone!\n`);

    // Proceed with removal
    let removedConfigs = 0;
    let updatedDocs = 0;
    let errors = 0;

    // Remove Level 0 configurations
    if (level0Configs.length > 0) {
      console.log('🗑️  Removing Level 0 configurations...\n');
      for (const config of level0Configs) {
        try {
          await ApprovalLevelConfiguration.findByIdAndDelete(config._id);
          removedConfigs++;
          const user = config.assignedUser;
          console.log(`   ✅ Removed: ${config.title} - ${user ? `${user.firstName} ${user.lastName}` : 'N/A'}`);
        } catch (error) {
          errors++;
          console.error(`   ❌ Error removing config ${config._id}:`, error.message);
        }
      }
      console.log('');
    }

    // Update documents
    if (uniqueDocIds.size > 0) {
      console.log('📝 Updating documents...\n');
      
      for (const docId of uniqueDocIds) {
        try {
          const doc = await EvaluationDocument.findById(docId);
          if (!doc) continue;

          let needsUpdate = false;
          const updateData = {};

          // Remove Level 0 from approvalLevels
          if (doc.approvalLevels && doc.approvalLevels.length > 0) {
            const originalLength = doc.approvalLevels.length;
            doc.approvalLevels = doc.approvalLevels.filter(level => level.level !== 0);
            
            if (doc.approvalLevels.length < originalLength) {
              updateData.approvalLevels = doc.approvalLevels;
              needsUpdate = true;
            }
          }

          // Update currentApprovalLevel from 0 to 1
          if (doc.currentApprovalLevel === 0) {
            // Find the first level >= 1
            const nextLevel = doc.approvalLevels && doc.approvalLevels.length > 0
              ? doc.approvalLevels.find(l => l.level >= 1)?.level || 1
              : 1;
            
            updateData.currentApprovalLevel = nextLevel;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await EvaluationDocument.findByIdAndUpdate(docId, updateData);
            updatedDocs++;
            console.log(`   ✅ Updated document ${docId}`);
          }
        } catch (error) {
          errors++;
          console.error(`   ❌ Error updating document ${docId}:`, error.message);
        }
      }
      console.log('');
    }

    // Final summary
    console.log('\n✅ CLEANUP COMPLETE!\n');
    console.log('📊 Summary:');
    console.log(`   Level 0 configurations removed: ${removedConfigs}`);
    console.log(`   Documents updated: ${updatedDocs}`);
    console.log(`   Errors: ${errors}\n`);

    // Verify cleanup
    const remainingLevel0Configs = await ApprovalLevelConfiguration.countDocuments({
      module: 'evaluation_appraisal',
      level: 0
    });

    const remainingDocsWithLevel0 = await EvaluationDocument.countDocuments({
      'approvalLevels.level': 0
    });

    const remainingDocsAtLevel0 = await EvaluationDocument.countDocuments({
      currentApprovalLevel: 0
    });

    console.log('🔍 Verification:');
    console.log(`   Remaining Level 0 configurations: ${remainingLevel0Configs}`);
    console.log(`   Documents with Level 0 in approvalLevels: ${remainingDocsWithLevel0}`);
    console.log(`   Documents at currentApprovalLevel 0: ${remainingDocsAtLevel0}\n`);

    if (remainingLevel0Configs === 0 && remainingDocsWithLevel0 === 0 && remainingDocsAtLevel0 === 0) {
      console.log('✅ All Level 0 references have been successfully removed!\n');
    } else {
      console.log('⚠️  Some Level 0 references may still exist. Please review.\n');
    }

    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  removeAllLevel0Approvers()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = removeAllLevel0Approvers;

