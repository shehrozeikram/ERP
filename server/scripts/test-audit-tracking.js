const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const User = require('../models/User');
const UserActivityLog = require('../models/general/UserActivityLog');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ Connected to MongoDB');
  testAuditTracking();
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

async function testAuditTracking() {
  try {
    console.log('\n🔍 Testing Audit Module Activity Tracking\n');
    console.log('='.repeat(80));

    // Find user
    const email = 'ceo@sgc.com';
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      mongoose.disconnect();
      return;
    }

    console.log(`✅ User Found: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`   User ID: ${user._id}\n`);

    // Check for audit-related activities
    console.log('📊 Checking Audit Module Activities:');
    console.log('='.repeat(80));
    
    // Get all audit-related activities
    const auditActivities = await UserActivityLog.find({
      userId: user._id,
      $or: [
        { module: { $regex: /audit/i } },
        { endpoint: { $regex: /\/audit/i } }
      ]
    })
    .sort({ timestamp: -1 })
    .limit(50);

    if (auditActivities.length === 0) {
      console.log('\n⚠️  No audit-related activities found for this user');
      console.log('   This could mean:');
      console.log('   1. User hasn\'t accessed audit module yet');
      console.log('   2. Audit activities are not being tracked');
      console.log('   3. Activities exist but don\'t match the search criteria\n');
    } else {
      console.log(`\n✅ Found ${auditActivities.length} audit-related activity/ies:\n`);
      
      // Group by module
      const byModule = {};
      auditActivities.forEach(log => {
        const module = log.module || 'Unknown';
        if (!byModule[module]) {
          byModule[module] = [];
        }
        byModule[module].push(log);
      });

      Object.keys(byModule).forEach(module => {
        console.log(`📁 Module: ${module} (${byModule[module].length} activities)`);
        byModule[module].slice(0, 10).forEach((log, index) => {
          console.log(`   ${index + 1}. ${log.actionType.toUpperCase()} ${log.endpoint}`);
          console.log(`      Time: ${log.timestamp.toISOString()} (${log.timestamp.toLocaleString()})`);
          console.log(`      Method: ${log.requestMethod} | IP: ${log.ipAddress}`);
          if (log.description) {
            console.log(`      Description: ${log.description}`);
          }
        });
        if (byModule[module].length > 10) {
          console.log(`   ... and ${byModule[module].length - 10} more`);
        }
        console.log('');
      });
    }

    // Check for recent activities (last 24 hours)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAuditActivities = await UserActivityLog.countDocuments({
      userId: user._id,
      timestamp: { $gte: last24h },
      $or: [
        { module: { $regex: /audit/i } },
        { endpoint: { $regex: /\/audit/i } }
      ]
    });

    console.log(`📈 Recent Activity (Last 24 hours):`);
    console.log(`   Audit-related activities: ${recentAuditActivities}`);

    // Check all recent activities to see what's being tracked
    console.log(`\n📋 All Recent Activities (Last 24 hours - Top 20):`);
    const allRecent = await UserActivityLog.find({
      userId: user._id,
      timestamp: { $gte: last24h }
    })
    .sort({ timestamp: -1 })
    .limit(20);

    if (allRecent.length > 0) {
      const byModuleAll = {};
      allRecent.forEach(log => {
        const module = log.module || 'Unknown';
        if (!byModuleAll[module]) {
          byModuleAll[module] = [];
        }
        byModuleAll[module].push(log);
      });

      Object.keys(byModuleAll).forEach(module => {
        console.log(`   ${module}: ${byModuleAll[module].length} activities`);
        byModuleAll[module].slice(0, 3).forEach(log => {
          console.log(`      - ${log.actionType.toUpperCase()} ${log.endpoint}`);
        });
      });
    } else {
      console.log('   No recent activities found');
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 Summary:`);
    const totalAuditActivities = await UserActivityLog.countDocuments({
      userId: user._id,
      $or: [
        { module: { $regex: /audit/i } },
        { endpoint: { $regex: /\/audit/i } }
      ]
    });
    console.log(`   Total audit-related activities: ${totalAuditActivities}`);
    console.log(`   Audit activities in last 24 hours: ${recentAuditActivities}`);
    
    if (totalAuditActivities === 0) {
      console.log(`\n⚠️  Recommendation: User should perform actions in audit module to test tracking`);
    } else {
      console.log(`\n✅ Audit activities are being tracked!`);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ Test Complete!\n`);

  } catch (error) {
    console.error('❌ Error during test:', error);
    console.error('Stack:', error.stack);
  } finally {
    mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

