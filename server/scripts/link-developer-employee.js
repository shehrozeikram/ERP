/**
 * Link developer@tovus.net (Sardar Shehroze Ikram) to HR employee — safe to run on production (no password change).
 *
 *   npm run link:developer-employee
 *   NODE_ENV=production node server/scripts/link-developer-employee.js
 */

const path = require('path');
const fs = require('fs');

const repoRoot = path.join(__dirname, '..', '..');
for (const f of ['.env', '.env.local']) {
  const p = path.join(repoRoot, f);
  if (fs.existsSync(p)) require('dotenv').config({ path: p, override: f === '.env.local' });
}

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const { linkDeveloperShehrozeAccount } = require('../utils/employeeUserLink');

async function main() {
  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    console.error('No MongoDB URI. Set MONGODB_URI or MONGODB_URI_LOCAL.');
    process.exit(1);
  }
  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));
  const result = await linkDeveloperShehrozeAccount();
  console.log(result);
  await mongoose.disconnect();
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
