const path = require('path');
const fsSync = require('fs');

const repoRoot = path.join(__dirname, '..', '..');

// Load environment variables properly
const envPath = path.join(repoRoot, '.env');
const localPath = path.join(repoRoot, '.env.local');
if (fsSync.existsSync(envPath)) require('dotenv').config({ path: envPath });
if (fsSync.existsSync(localPath)) require('dotenv').config({ path: localPath, override: true });

const { connectDB, disconnectDB } = require('../config/database');
const User = require('../models/User');
const { notifyChatApprovers } = require('../utils/approvalChatNotifier');

async function testChatNotification() {
  try {
    await connectDB();

    // Find the developer user to act as the receiver
    const user = await User.findOne({ email: 'developer@tovus.net' });
    if (!user) {
      console.log('User developer@tovus.net not found!');
      process.exit(1);
    }

    console.log('Sending chat notification to', user.email, '...');
    
    await notifyChatApprovers([user._id], {
      docType: 'Test Bill Payment',
      docNumber: 'TEST-9999',
      message: '[System Notification]\nYou have a new Test Bill Payment (TEST-9999) assigned for your review. (This is a test from the script!)'
    });

    console.log('Done! The message was created in the database.');
    console.log('Please refresh your internal chat in the app to see the message!');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

testChatNotification();
