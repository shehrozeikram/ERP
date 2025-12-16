const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Employee = require('../models/hr/Employee');
const ApprovalLevelConfiguration = require('../models/hr/ApprovalLevelConfiguration');
const EvaluationDocument = require('../models/hr/EvaluationDocument');

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Test Level 1 approval setup
async function testLevel1Approval() {
  try {
    console.log('\n🔍 Testing Level 1 Approval Setup for Fahad Farid\n');
    console.log('='.repeat(60));

    // 1. Find Fahad Farid user
    console.log('\n1️⃣ Finding Fahad Farid user...');
    const fahadUser = await User.findOne({
      $or: [
        { firstName: { $regex: /fahad/i } },
        { email: { $regex: /fahad/i } }
      ]
    }).select('_id firstName lastName email role');

    if (!fahadUser) {
      console.log('❌ Fahad Farid user not found!');
      console.log('\n📋 Available users with "fahad" in name or email:');
      const similarUsers = await User.find({
        $or: [
          { firstName: { $regex: /fahad/i } },
          { lastName: { $regex: /fahad/i } },
          { email: { $regex: /fahad/i } }
        ]
      }).select('_id firstName lastName email role').limit(10);
      similarUsers.forEach(u => console.log(`   - ${u.firstName} ${u.lastName} (${u.email}) - ID: ${u._id}`));
      return;
    }

    console.log('✅ Found user:');
    console.log(`   Name: ${fahadUser.firstName} ${fahadUser.lastName}`);
    console.log(`   Email: ${fahadUser.email}`);
    console.log(`   Role: ${fahadUser.role}`);
    console.log(`   User ID: ${fahadUser._id}`);

    // 2. Check ApprovalLevelConfiguration for Level 1
    console.log('\n2️⃣ Checking ApprovalLevelConfiguration for Level 1...');
    const level1Config = await ApprovalLevelConfiguration.find({
      module: 'evaluation_appraisal',
      level: 1,
      isActive: true
    })
    .populate('assignedUser', 'firstName lastName email')
    .populate('assignedEmployee', 'firstName lastName employeeId');

    console.log(`\n   Found ${level1Config.length} Level 1 configuration(s):`);
    level1Config.forEach((config, index) => {
      console.log(`\n   Config ${index + 1}:`);
      console.log(`   - Level: ${config.level}`);
      console.log(`   - Title: ${config.title}`);
      console.log(`   - Assigned User: ${config.assignedUser ? `${config.assignedUser.firstName} ${config.assignedUser.lastName} (${config.assignedUser.email})` : 'None'}`);
      console.log(`   - Assigned User ID: ${config.assignedUser ? config.assignedUser._id : 'None'}`);
      console.log(`   - Is Active: ${config.isActive}`);
      console.log(`   - Matches Fahad: ${config.assignedUser && config.assignedUser._id.toString() === fahadUser._id.toString() ? '✅ YES' : '❌ NO'}`);
    });

    // Check if Fahad is assigned to Level 1
    const fahadAssignedToLevel1 = level1Config.some(config => 
      config.assignedUser && config.assignedUser._id.toString() === fahadUser._id.toString()
    );

    if (!fahadAssignedToLevel1) {
      console.log('\n❌ Fahad Farid is NOT assigned to Level 1 in ApprovalLevelConfiguration!');
      console.log('   This is the problem - the user needs to be assigned to Level 1.');
    } else {
      console.log('\n✅ Fahad Farid IS assigned to Level 1 in ApprovalLevelConfiguration');
    }

    // 3. Test the API endpoint logic
    console.log('\n3️⃣ Testing API endpoint logic (getAssignedApprovalLevels)...');
    const assignedLevels = await ApprovalLevelConfiguration.find({
      module: 'evaluation_appraisal',
      assignedUser: fahadUser._id,
      isActive: true
    })
    .populate('assignedUser', 'firstName lastName email role')
    .sort({ level: 1 });

    console.log(`\n   Found ${assignedLevels.length} assigned level(s) for Fahad Farid:`);
    assignedLevels.forEach(level => {
      console.log(`   - Level ${level.level}: ${level.title}`);
    });

    if (assignedLevels.length === 0) {
      console.log('\n❌ No assigned levels found for Fahad Farid!');
      console.log('   This means the API will return an empty array for assignedApprovalLevels.');
    } else {
      const level1Assigned = assignedLevels.some(l => l.level === 1);
      if (level1Assigned) {
        console.log('\n✅ Level 1 is in the assigned levels list');
      } else {
        console.log('\n❌ Level 1 is NOT in the assigned levels list');
      }
    }

    // 4. Check documents at Level 1
    console.log('\n4️⃣ Checking documents at Level 1...');
    const level1Docs = await EvaluationDocument.find({
      status: 'submitted',
      currentApprovalLevel: 1,
      $or: [
        { approvalStatus: 'pending' },
        { approvalStatus: 'in_progress' }
      ]
    })
    .populate('employee', 'firstName lastName employeeId')
    .populate('approvalLevels.assignedUserId', 'firstName lastName email')
    .limit(5)
    .sort({ createdAt: -1 });

    console.log(`\n   Found ${level1Docs.length} document(s) at Level 1:`);
    level1Docs.forEach((doc, index) => {
      console.log(`\n   Document ${index + 1}:`);
      console.log(`   - ID: ${doc._id}`);
      console.log(`   - Employee: ${doc.employee ? `${doc.employee.firstName} ${doc.employee.lastName} (${doc.employee.employeeId})` : 'None'}`);
      console.log(`   - Status: ${doc.status}`);
      console.log(`   - Approval Status: ${doc.approvalStatus}`);
      console.log(`   - Current Approval Level: ${doc.currentApprovalLevel}`);
      console.log(`   - Level 0 Approval Status: ${doc.level0ApprovalStatus || 'N/A'}`);
      console.log(`   - Approval Levels Array: ${doc.approvalLevels ? doc.approvalLevels.length : 0} entries`);
      
      if (doc.approvalLevels && doc.approvalLevels.length > 0) {
        const level1Entry = doc.approvalLevels.find(l => l.level === 1);
        if (level1Entry) {
          console.log(`   - Level 1 Entry Status: ${level1Entry.status}`);
          console.log(`   - Level 1 Assigned User ID: ${level1Entry.assignedUserId ? level1Entry.assignedUserId._id || level1Entry.assignedUserId : 'None'}`);
          console.log(`   - Matches Fahad: ${level1Entry.assignedUserId && 
            (level1Entry.assignedUserId._id ? level1Entry.assignedUserId._id.toString() : level1Entry.assignedUserId.toString()) === fahadUser._id.toString() 
            ? '✅ YES' : '❌ NO'}`);
        } else {
          console.log(`   - ❌ Level 1 entry NOT FOUND in approvalLevels array!`);
        }
      } else {
        console.log(`   - ❌ approvalLevels array is EMPTY or MISSING!`);
      }
    });

    // 5. Simulate canApprove logic
    console.log('\n5️⃣ Simulating canApprove logic for Level 1 documents...');
    const assignedLevelNumbers = assignedLevels.map(l => l.level);
    console.log(`   assignedApprovalLevels: [${assignedLevelNumbers.join(', ')}]`);

    level1Docs.forEach((doc, index) => {
      console.log(`\n   Document ${index + 1} (${doc.employee ? doc.employee.firstName : 'Unknown'}):`);
      
      // Check basic status
      const basicStatusOK = doc.status === 'submitted' && 
                           doc.approvalStatus !== 'rejected' && 
                           doc.approvalStatus !== 'approved' &&
                           (doc.approvalStatus === 'pending' || doc.approvalStatus === 'in_progress');
      console.log(`   - Basic status check: ${basicStatusOK ? '✅ PASS' : '❌ FAIL'}`);
      
      // Check current level
      const currentLevel = doc.currentApprovalLevel;
      const levelValid = currentLevel >= 1 && currentLevel <= 4;
      console.log(`   - Current level valid (1-4): ${levelValid ? '✅ PASS' : '❌ FAIL'} (${currentLevel})`);
      
      // Check user assignment
      const isUserAssigned = assignedLevelNumbers.length === 0 || assignedLevelNumbers.includes(currentLevel);
      console.log(`   - User assigned check: ${isUserAssigned ? '✅ PASS' : '❌ FAIL'}`);
      
      // Check approvalLevels array
      const hasApprovalLevels = doc.approvalLevels && Array.isArray(doc.approvalLevels) && doc.approvalLevels.length > 0;
      console.log(`   - Has approvalLevels array: ${hasApprovalLevels ? '✅ PASS' : '❌ FAIL'}`);
      
      if (hasApprovalLevels) {
        const levelEntry = doc.approvalLevels.find(l => l.level === currentLevel);
        console.log(`   - Level entry exists: ${levelEntry ? '✅ PASS' : '❌ FAIL'}`);
        if (levelEntry) {
          console.log(`   - Level entry status: ${levelEntry.status === 'pending' ? '✅ PASS (pending)' : `❌ FAIL (${levelEntry.status})`}`);
        }
      }
      
      // Final result
      let canApprove = false;
      if (basicStatusOK && levelValid) {
        if (!hasApprovalLevels) {
          canApprove = isUserAssigned; // Trust dashboard if approvalLevels missing
        } else {
          const levelEntry = doc.approvalLevels.find(l => l.level === currentLevel);
          if (!levelEntry) {
            canApprove = isUserAssigned; // Trust dashboard if level entry missing
          } else {
            canApprove = isUserAssigned && levelEntry.status === 'pending';
          }
        }
      }
      
      console.log(`   - 🎯 FINAL RESULT: ${canApprove ? '✅ CAN APPROVE' : '❌ CANNOT APPROVE'}`);
    });

    // 6. Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 SUMMARY:\n');
    
    if (!fahadAssignedToLevel1) {
      console.log('❌ ISSUE FOUND: Fahad Farid is NOT assigned to Level 1 in ApprovalLevelConfiguration');
      console.log('   SOLUTION: Assign Fahad Farid to Level 1 in the Approval Level Configuration');
    } else if (assignedLevels.length === 0) {
      console.log('❌ ISSUE FOUND: No assigned levels returned for Fahad Farid');
      console.log('   SOLUTION: Check why ApprovalLevelConfiguration query is not finding the assignment');
    } else if (!assignedLevels.some(l => l.level === 1)) {
      console.log('❌ ISSUE FOUND: Level 1 is not in the assigned levels list');
      console.log('   SOLUTION: Verify the ApprovalLevelConfiguration record is active and correct');
    } else {
      console.log('✅ User assignment looks correct');
      console.log('   Checking document structure...');
      
      const docsWithIssues = level1Docs.filter(doc => {
        if (!doc.approvalLevels || doc.approvalLevels.length === 0) {
          return true;
        }
        const level1Entry = doc.approvalLevels.find(l => l.level === 1);
        return !level1Entry || level1Entry.status !== 'pending';
      });
      
      if (docsWithIssues.length > 0) {
        console.log(`❌ ISSUE FOUND: ${docsWithIssues.length} document(s) have issues with approvalLevels structure`);
        console.log('   SOLUTION: Documents may need approvalLevels array initialized or Level 1 entry created');
      } else {
        console.log('✅ Document structure looks correct');
        console.log('   The issue might be in the frontend canApprove function logic');
      }
    }

  } catch (error) {
    console.error('\n❌ Error during test:', error);
    console.error(error.stack);
  }
}

// Run the test
async function run() {
  await connectDB();
  await testLevel1Approval();
  await mongoose.connection.close();
  console.log('\n✅ Test completed. Database connection closed.');
  process.exit(0);
}

run();

