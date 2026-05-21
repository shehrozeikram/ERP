/**
 * Repair CAM invoice arrears chain for one property (by srNo or propertyId).
 *
 * Usage:
 *   node server/scripts/repair-cam-invoice-chain.js --srNo 1076
 *   node server/scripts/repair-cam-invoice-chain.js --propertyId <mongoId>
 *   node server/scripts/repair-cam-invoice-chain.js --srNo 1076 --dryRun
 *   node server/scripts/repair-cam-invoice-chain.js --srNo 1076 --from INV-CMC-2026-04-1076
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const TajProperty = require('../models/tajResidencia/TajProperty');
const { repairCamInvoiceChain } = require('../utils/camInvoiceArrears');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = { dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--srNo') out.srNo = Number(args[++i]);
    else if (args[i] === '--propertyId') out.propertyId = args[++i];
    else if (args[i] === '--from') out.fromInvoiceNumber = args[++i];
    else if (args[i] === '--dryRun') out.dryRun = true;
  }
  return out;
};

(async () => {
  const { srNo, propertyId, fromInvoiceNumber, dryRun } = parseArgs();
  if (!srNo && !propertyId) {
    console.error('Provide --srNo or --propertyId');
    process.exit(1);
  }

  // Local dev: uses MONGODB_URI_LOCAL (see server/config/database.js). Never production unless NODE_ENV=production.
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
  await connectDB();
  let pid = propertyId;
  if (srNo) {
    const property = await TajProperty.findOne({ srNo }).select('_id srNo ownerName').lean();
    if (!property) {
      console.error(`Property srNo ${srNo} not found`);
      process.exit(1);
    }
    pid = property._id;
    console.log(`Property: ${property.ownerName} (srNo ${property.srNo})`);
  }

  const result = await repairCamInvoiceChain(pid, { fromInvoiceNumber, dryRun });
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
