const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const User = require('../models/User');
const UserActivityLog = require('../models/general/UserActivityLog');
const { extractModule } = require('../middleware/activityLogger');

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

// Import the extractModule function logic
const MODULE_MAP = {
  'hr': 'HR',
  'hr/employees': 'HR - Employees',
  'finance': 'Finance',
  'audit': 'Audit',
  'audit/findings': 'Audit - Findings',
  'audit/corrective-actions': 'Audit - Corrective Actions',
  'audit/trail': 'Audit - Trail',
  'audit/reports': 'Audit - Reports',
  'audit/schedules': 'Audit - Schedules'
};

function extractModuleTest(endpoint) {
  if (!endpoint || endpoint === '/' || endpoint === '') return 'Dashboard';
  const cleanPath = endpoint.replace(/^\/api\//, '').replace(/^\//, '').replace(/\/$/, '');
  const parts = cleanPath.split('/').filter(p => p);
  if (parts.length === 0) return 'Dashboard';
  
  if (parts.length >= 2) {
    const twoPartPath = `${parts[0]}/${parts[1]}`;
    if (MODULE_MAP[twoPartPath]) return MODULE_MAP[twoPartPath];
  }
  
  if (parts.length >= 1) {
    if (MODULE_MAP[parts[0]]) return MODULE_MAP[parts[0]];
    return parts[0].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  
  return 'Dashboard';
}

async function testAuditTracking() {
  try {
    console.log('\n🧪 Testing Audit Module Activity Tracking\n');
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

    // Test paths that would be used in audit module
    const testPaths = [
      '/api/audit',
      '/api/audit/findings',
      '/api/audit/findings/123',
      '/api/audit/corrective-actions',
      '/api/audit/trail',
      '/api/audit/reports',
      '/api/audit/schedules'
    ];

    console.log('🔍 Testing Module Extraction for Audit Routes:\n');
    testPaths.forEach(path => {
      const module = extractModuleTest(path);
      console.log(`   ${path.padEnd(35)} → Module: ${module}`);
    });

    // Check existing audit activities
    console.log('\n📊 Checking Existing Audit Activities in Database:\n');
    const existingAuditActivities = await UserActivityLog.find({
      $or: [
        { endpoint: { $regex: /\/audit/i } },
        { module: { $regex: /audit/i } }
      ]
    })
    .sort({ timestamp: -1 })
    .limit(20)
    .populate('userId', 'firstName lastName email');

    if (existingAuditActivities.length === 0) {
      console.log('⚠️  No audit activities found in database');
    } else {
      console.log(`✅ Found ${existingAuditActivities.length} audit activities:\n`);
      existingAuditActivities.forEach((log, index) => {
        console.log(`${index + 1}. Endpoint: ${log.endpoint}`);
        console.log(`   Module: ${log.module || 'NULL'} ${log.module === 'Unknown' ? '❌' : log.module?.includes('Audit') ? '✅' : '⚠️'}`);
        console.log(`   User: ${log.userId?.email || log.email}`);
        console.log(`   Time: ${log.timestamp.toLocaleString()}`);
        console.log('');
      });
    }

    // Check for user's recent activities to see what modules are being tracked
    console.log('📋 User\'s Recent Activities (Last 24 hours):\n');
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const userRecentActivities = await UserActivityLog.find({
      userId: user._id,
      timestamp: { $gte: last24h }
    })
    .sort({ timestamp: -1 })
    .limit(30);

    if (userRecentActivities.length > 0) {
      const byModule = {};
      userRecentActivities.forEach(log => {
        const module = log.module || 'Unknown';
        if (!byModule[module]) {
          byModule[module] = [];
        }
        byModule[module].push(log);
      });

      Object.keys(byModule).forEach(module => {
        const count = byModule[module].length;
        const hasAudit = module.toLowerCase().includes('audit');
        console.log(`   ${module.padEnd(30)} ${count} activities ${hasAudit ? '✅' : ''}`);
      });
    } else {
      console.log('   No recent activities found');
    }

    // Check if there are any activities with "Unknown" module that should be audit
    console.log('\n🔍 Checking for Misclassified Audit Activities:\n');
    const unknownButAuditEndpoint = await UserActivityLog.find({
      module: { $in: ['Unknown', null] },
      endpoint: { $regex: /\/audit/i }
    })
    .sort({ timestamp: -1 })
    .limit(10);

    if (unknownButAuditEndpoint.length > 0) {
      console.log(`⚠️  Found ${unknownButAuditEndpoint.length} activities with audit endpoints but Unknown/NULL module:\n`);
      unknownButAuditEndpoint.forEach((log, index) => {
        const expectedModule = extractModuleTest(log.endpoint);
        console.log(`${index + 1}. Endpoint: ${log.endpoint}`);
        console.log(`   Current Module: ${log.module || 'NULL'}`);
        console.log(`   Expected Module: ${expectedModule}`);
        console.log(`   User: ${log.email}`);
        console.log('');
      });
    } else {
      console.log('✅ No misclassified audit activities found');
    }

    // Summary and recommendations
    console.log('\n' + '='.repeat(80));
    console.log('📊 Summary:\n');
    
    const totalAuditByEndpoint = await UserActivityLog.countDocuments({
      endpoint: { $regex: /\/audit/i }
    });
    
    const totalAuditByModule = await UserActivityLog.countDocuments({
      module: { $regex: /audit/i }
    });

    console.log(`   Activities with audit endpoints: ${totalAuditByEndpoint}`);
    console.log(`   Activities with audit module: ${totalAuditByModule}`);
    console.log(`   Misclassified (Unknown but audit endpoint): ${unknownButAuditEndpoint.length}`);

    if (totalAuditByEndpoint === 0) {
      console.log('\n⚠️  ISSUE FOUND: No audit activities exist in database');
      console.log('   This means audit routes are either:');
      console.log('   1. Not being accessed');
      console.log('   2. Not being tracked by activityLogger middleware');
      console.log('   3. Being skipped for some reason\n');
    } else if (unknownButAuditEndpoint.length > 0) {
      console.log('\n⚠️  ISSUE FOUND: Audit activities exist but are misclassified');
      console.log('   The module extraction logic may not be working correctly');
      console.log('   Check if server has been restarted with latest code\n');
    } else if (totalAuditByEndpoint !== totalAuditByModule) {
      console.log('\n⚠️  DISCREPANCY: Different counts for endpoint vs module');
      console.log('   Some audit activities may not have correct module names\n');
    } else {
      console.log('\n✅ All audit activities are correctly classified!\n');
    }

    console.log('='.repeat(80));
    console.log('✅ Test Complete!\n');

  } catch (error) {
    console.error('❌ Error during test:', error);
    console.error('Stack:', error.stack);
  } finally {
    mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

