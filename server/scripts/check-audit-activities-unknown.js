const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const UserActivityLog = require('../models/general/UserActivityLog');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  console.log('✅ Connected to MongoDB\n');
  
  // Check for activities with audit endpoints but Unknown or wrong module
  const auditEndpointActivities = await UserActivityLog.find({
    endpoint: { $regex: /\/audit/i }
  })
  .sort({ timestamp: -1 })
  .limit(50)
  .populate('userId', 'firstName lastName email');

  console.log(`📊 Found ${auditEndpointActivities.length} activities with audit endpoints:\n`);
  
  if (auditEndpointActivities.length > 0) {
    auditEndpointActivities.forEach((log, index) => {
      console.log(`${index + 1}. Endpoint: ${log.endpoint}`);
      console.log(`   Module: ${log.module || 'NULL'} ${log.module === 'Unknown' ? '⚠️' : log.module?.includes('Audit') ? '✅' : '❌'}`);
      console.log(`   Action: ${log.actionType} | User: ${log.userId?.email || log.email}`);
      console.log(`   Time: ${log.timestamp.toLocaleString()}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No activities found with audit endpoints');
    console.log('   This means either:');
    console.log('   1. No one has accessed audit routes yet');
    console.log('   2. Audit routes are being skipped by activityLogger');
    console.log('   3. There\'s an issue with the middleware\n');
  }

  mongoose.disconnect();
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});


