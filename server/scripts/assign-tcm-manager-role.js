/**
 * Script to assign TCM Manager role to specific users
 * Usage: node server/scripts/assign-tcm-manager-role.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { ROLES } = require('../config/permissions');

const TCM_MANAGER_EMAILS = [
  'husnaintahir@tovus.net',
  'muhammadusman@tovus.net'
];

async function assignTCMManagerRole() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Update users
    for (const email of TCM_MANAGER_EMAILS) {
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (!user) {
        console.log(`❌ User not found: ${email}`);
        continue;
      }

      // Update role
      user.role = ROLES.TCM_MANAGER;
      await user.save();
      
      console.log(`✅ Updated ${email} to TCM Manager role`);
    }

    console.log('\n✅ All users updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

assignTCMManagerRole();

