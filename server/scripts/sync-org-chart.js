/**
 * Sync org chart seed JSON → client import + optional MongoDB.
 *
 * Usage:
 *   node server/scripts/sync-org-chart.js              # sync client JS from JSON
 *   node server/scripts/sync-org-chart.js --db           # also replace MongoDB + auto-layout
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');

const SERVER_JSON = path.join(__dirname, '../data/sgc-org-chart-default.json');
const CLIENT_JS = path.join(__dirname, '../../client/src/data/sgcOrgChartData.js');

function syncClientFile() {
  const tree = JSON.parse(fs.readFileSync(SERVER_JSON, 'utf8'));
  const jsContent = `/**
 * SGC Organogram — built incrementally from official organogram.
 * Source of truth: server/data/sgc-org-chart-default.json
 */

export const SGC_ORG_CHART = ${JSON.stringify(tree, null, 2)};

export default SGC_ORG_CHART;
`;
  fs.writeFileSync(CLIENT_JS, jsContent);
  console.log('Synced client org chart data from seed JSON');
}

async function syncDatabase() {
  const mongoose = require('mongoose');
  const { seedFromNestedTree, buildTreeFromFlat, countNodes } = require('../utils/orgChartTree');
  const { computeLayoutFromTree, applyLayoutToDatabase } = require('../utils/orgChartLayout');

  const tree = JSON.parse(fs.readFileSync(SERVER_JSON, 'utf8'));
  const uri = process.env.NODE_ENV === 'production'
    ? process.env.MONGODB_URI
    : (process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI || process.env.MONGO_URI);

  if (!uri) throw new Error('No MongoDB URI configured');

  await mongoose.connect(uri);

  const layoutByLegacyId = computeLayoutFromTree(tree);
  await seedFromNestedTree(tree, null, layoutByLegacyId);

  const flat = await mongoose.model('OrgChartNode').find({ isActive: true }).lean();
  const built = buildTreeFromFlat(flat);
  await applyLayoutToDatabase(flat, built, null);

  console.log(`Database replaced with ${countNodes(built)} nodes. Auto-layout applied.`);
  await mongoose.disconnect();
}

async function main() {
  syncClientFile();
  if (process.argv.includes('--db')) {
    await syncDatabase();
  } else {
    console.log('Run with --db to apply to MongoDB.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
