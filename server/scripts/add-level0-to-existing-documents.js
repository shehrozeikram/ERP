const mongoose = require('mongoose');
require('dotenv').config();

// Register models
require('../models/User');
const EvaluationDocument = require('../models/hr/EvaluationDocument');
const ApprovalLevelConfiguration = require('../models/hr/ApprovalLevelConfiguration');
const Employee = require('../models/hr/Employee');

async function addLevel0ToExistingDocuments() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Get Level 0 configuration
    const level0Config = await ApprovalLevelConfiguration.getByModuleAndLevel('evaluation_appraisal', 0);
    
    if (!level0Config || !level0Config.isActive) {
      console.error('❌ Level 0 configuration not found or not active');
      console.log('💡 Please create Level 0 configuration first using assign-level0-approver.js');
      process.exit(1);
    }

    console.log(`\n📋 Level 0 Configuration:`);
    console.log(`   Approver: ${level0Config.assignedUser.firstName} ${level0Config.assignedUser.lastName}`);
    console.log(`   Title: ${level0Config.title}`);
    console.log(`   Level: ${level0Config.level}`);

    // Find Level 0 approver's Employee record
    const level0Employee = await Employee.findOne({ user: level0Config.assignedUser._id });
    
    // Find all submitted documents that don't have Level 0
    const documents = await EvaluationDocument.find({
      status: { $in: ['submitted', 'in_progress'] },
      approvalStatus: { $in: ['pending', 'in_progress'] }
    });

    console.log(`\n🔍 Found ${documents.length} submitted documents to check`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of documents) {
      try {
        // Check if document already has Level 0
        const hasLevel0 = doc.approvalLevels && doc.approvalLevels.some(level => level.level === 0);
        
        if (hasLevel0) {
          skipped++;
          continue;
        }

        // Check if document has any approval levels
        if (!doc.approvalLevels || doc.approvalLevels.length === 0) {
          console.log(`⚠️  Document ${doc._id} has no approval levels - skipping (will be initialized on next save)`);
          skipped++;
          continue;
        }

        // Add Level 0 at the beginning
        doc.approvalLevels.unshift({
          level: 0,
          title: level0Config.title,
          approverName: level0Config.assignedUser 
            ? `${level0Config.assignedUser.firstName} ${level0Config.assignedUser.lastName}`
            : 'Unknown',
          approver: level0Employee ? level0Employee._id : null,
          assignedUserId: level0Config.assignedUser ? level0Config.assignedUser._id : null,
          status: 'pending'
        });

        // Update currentApprovalLevel to 0 if document is still pending/in_progress
        if (doc.approvalStatus === 'pending' || doc.approvalStatus === 'in_progress') {
          // Check if Level 0 is still pending (not already approved)
          const level0Entry = doc.approvalLevels.find(l => l.level === 0);
          if (level0Entry && level0Entry.status === 'pending') {
            doc.currentApprovalLevel = 0;
          }
        }

        await doc.save();
        updated++;
        
        console.log(`✅ Updated document ${doc._id} - Added Level 0, currentLevel: ${doc.currentApprovalLevel}`);
      } catch (error) {
        errors++;
        console.error(`❌ Error updating document ${doc._id}:`, error.message);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Updated: ${updated} documents`);
    console.log(`   ⏭️  Skipped: ${skipped} documents (already have Level 0 or no approval levels)`);
    console.log(`   ❌ Errors: ${errors} documents`);
    console.log(`\n🎉 Migration completed!`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
addLevel0ToExistingDocuments();

