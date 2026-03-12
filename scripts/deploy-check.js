#!/usr/bin/env node
/**
 * Production deployment check – validates required env vars.
 * Run: NODE_ENV=production node scripts/deploy-check.js
 */
require('dotenv').config();

const required = ['NODE_ENV', 'MONGODB_URI', 'JWT_SECRET', 'FRONTEND_URL'];
const optional = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'SMTP_PASS'];

let failed = false;

if (process.env.NODE_ENV !== 'production') {
  console.log('⚠️  Not in production. Set NODE_ENV=production to run this check.');
  process.exit(1);
}

for (const key of required) {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    console.error(`❌ Missing required: ${key}`);
    failed = true;
  } else {
    console.log(`✅ ${key}`);
  }
}

for (const key of optional) {
  const val = process.env[key];
  console.log(val ? `✅ ${key}` : `⚠️  ${key} (optional, not set)`);
}

if (failed) {
  console.error('\n❌ Fix missing variables and try again.');
  process.exit(1);
}

console.log('\n✅ All required variables are set. Ready for deployment.');
process.exit(0);
