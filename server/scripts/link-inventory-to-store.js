/**
 * link-inventory-to-store.js
 *
 * Links all inventory items that have no store assigned to "Taj Store"
 * (looked up by name — not hardcoded ID).
 *
 * Usage:
 *   node server/scripts/link-inventory-to-store.js           # local  (uses MONGODB_URI_LOCAL)
 *   node server/scripts/link-inventory-to-store.js prod      # droplet (uses MONGODB_URI — requires SSH tunnel)
 *
 * Before running "prod", open the SSH tunnel in a separate terminal:
 *   ssh -L 27019:127.0.0.1:27017 root@68.183.215.177
 */

require('dotenv').config();
const mongoose = require('mongoose');

const isProduction = process.argv[2] === 'prod';
const MONGO_URI    = isProduction
  ? process.env.MONGODB_URI
  : (process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local');

if (!MONGO_URI) {
  console.error('ERROR: No MongoDB URI configured. Check your .env file.');
  process.exit(1);
}

async function run() {
  console.log(`\n=== Link Inventory → Taj Store ===`);
  console.log(`Target: ${isProduction ? 'PRODUCTION (droplet)' : 'LOCAL'} database`);
  console.log(`URI: ${MONGO_URI.replace(/\/\/.*@/, '//<credentials>@')}\n`);

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  require('../models/procurement/Store');
  require('../models/procurement/Inventory');
  const Store     = mongoose.model('Store');
  const Inventory = mongoose.model('Inventory');

  const tajStore = await Store.findOne({ name: 'Taj Store', isActive: true }).lean();
  if (!tajStore) {
    console.error('ERROR: "Taj Store" not found in the database. Create it first.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Found: "${tajStore.name}" (${tajStore.code}) — _id: ${tajStore._id}`);

  const result = await Inventory.updateMany(
    { $or: [{ store: { $exists: false } }, { store: null }] },
    { $set: { store: tajStore._id, storeSnapshot: tajStore.name } }
  );
  console.log(`Items linked: ${result.modifiedCount}`);

  const totalLinked = await Inventory.countDocuments({ store: tajStore._id });
  const total       = await Inventory.countDocuments();
  console.log(`Total items pointing to "${tajStore.name}": ${totalLinked} / ${total}`);

  await mongoose.disconnect();
  console.log('\nDone.\n');
}

run().catch(err => {
  console.error('FATAL:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
