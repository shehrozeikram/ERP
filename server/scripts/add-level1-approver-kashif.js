/**
 * Add Kashif Mahmood as Level 1 approver for Evaluation & Appraisal
 * (alongside existing Fahad Farid)
 * Run: node server/scripts/add-level1-approver-kashif.js
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const ApprovalLevelConfiguration = require('../models/hr/ApprovalLevelConfiguration');
const User = require('../models/User');
const Employee = require('../models/hr/Employee');

async function addLevel1Approver() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp');
    console.log('✅ Connected to database\n');

    // Find user "Kashif Mahmood"
    const findUser = async () => {
      // Try firstName + lastName
      let user = await User.findOne({
        firstName: { $regex: /^Kashif$/i },
        lastName: { $regex: /^Mahmood$/i }
      });
      if (user) return user;
      // Try full name in firstName
      user = await User.findOne({
        $or: [
          { firstName: { $regex: /Kashif\s*Mahmood/i } },
          { firstName: { $regex: /^Kashif$/i }, lastName: { $regex: /Mahmood/i } }
        ]
      });
      if (user) return user;
      // Try search by "Kashif" in firstName
      user = await User.findOne({ firstName: { $regex: /^Kashif$/i } });
      if (user) return user;
      return null;
    };

    const user = await findUser();
    if (!user) {
      console.error('❌ User "Kashif Mahmood" not found.');
      console.log('   Searched by firstName "Kashif", lastName "Mahmood".');
      console.log('   Ensure the user exists in the User collection.');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.email})\n`);

    // Check if already Level 1 for evaluation_appraisal
    const existing = await ApprovalLevelConfiguration.findOne({
      module: 'evaluation_appraisal',
      level: 1,
      assignedUser: user._id,
      isActive: true
    });
    if (existing) {
      console.log('ℹ️  Kashif Mahmood is already assigned to Level 1. No change made.');
      process.exit(0);
    }

    // Use same title as existing Level 1 (Fahad Farid)
    const existingLevel1 = await ApprovalLevelConfiguration.findOne({
      module: 'evaluation_appraisal',
      level: 1,
      isActive: true
    }).populate('assignedUser', 'firstName lastName');
    const title = existingLevel1 ? existingLevel1.title : 'Assistant Vice President / CHRO SGC';

    const employee = await Employee.findOne({ user: user._id });
    const config = new ApprovalLevelConfiguration({
      module: 'evaluation_appraisal',
      level: 1,
      title,
      assignedUser: user._id,
      assignedEmployee: employee ? employee._id : null,
      isActive: true
    });
    await config.save();

    console.log('✅ Kashif Mahmood added as Level 1 approver (Evaluation & Appraisal)');
    console.log(`   Title: ${title}`);
    console.log(`   Level 1 approvers: Fahad Farid, Kashif Mahmood (either can approve)\n`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

addLevel1Approver();
