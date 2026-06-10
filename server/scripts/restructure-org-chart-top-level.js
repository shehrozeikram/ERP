/**
 * Reset org chart to the three leadership nodes only:
 *   President → Patron-in-Chief (Education) + Steering Committee Chairman
 *
 * Usage:
 *   node server/scripts/restructure-org-chart-top-level.js           # JSON files only
 *   node server/scripts/restructure-org-chart-top-level.js --db        # replace MongoDB + auto-layout
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');

const MINIMAL_TREE = {
  id: 'president-sardar-tanveer-ilyas',
  title: 'President',
  name: 'Sardar Tanveer Ilyas',
  type: 'patron',
  isVacant: false,
  children: [
    {
      id: 'patron-in-chief-education',
      title: 'Patron-in-Chief (Education)',
      name: 'Admiral Abdul Aziz Mirza (Retd)',
      type: 'patron',
      isVacant: false,
      children: []
    },
    {
      id: 'president-steering-committee-chairman',
      title: 'President Steering Committee for Strategic Direction, Evaluation & Monitoring and Chairman of the Board',
      name: 'Vice Admiral Ahmad Tasnim (Retd)',
      type: 'patron',
      isVacant: false,
      children: []
    }
  ]
};

function updateJsonFiles() {
  const serverJsonPath = path.join(__dirname, '../data/sgc-org-chart-default.json');
  fs.writeFileSync(serverJsonPath, `${JSON.stringify(MINIMAL_TREE, null, 2)}\n`);

  const clientJsPath = path.join(__dirname, '../../client/src/data/sgcOrgChartData.js');
  const jsContent = `/**
 * SGC Organogram — leadership top level (built incrementally).
 */

export const SGC_ORG_CHART = ${JSON.stringify(MINIMAL_TREE, null, 2)};

export default SGC_ORG_CHART;
`;
  fs.writeFileSync(clientJsPath, jsContent);

  console.log('Org chart reset to 3 nodes in seed JSON and client data');
}

async function updateDatabase() {
  const mongoose = require('mongoose');
  const { seedFromNestedTree, buildTreeFromFlat, countNodes } = require('../utils/orgChartTree');
  const { computeLayoutFromTree, applyLayoutToDatabase } = require('../utils/orgChartLayout');

  const uri = process.env.NODE_ENV === 'production'
    ? process.env.MONGODB_URI
    : (process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI || process.env.MONGO_URI);

  if (!uri) throw new Error('No MongoDB URI configured');

  await mongoose.connect(uri);

  const layoutByLegacyId = computeLayoutFromTree(MINIMAL_TREE);
  await seedFromNestedTree(MINIMAL_TREE, null, layoutByLegacyId);

  const flat = await mongoose.model('OrgChartNode').find({ isActive: true }).lean();
  const tree = buildTreeFromFlat(flat);
  await applyLayoutToDatabase(flat, tree, null);

  console.log(`Database replaced with ${countNodes(tree)} nodes. Auto-layout applied.`);
  await mongoose.disconnect();
}

async function main() {
  updateJsonFiles();

  if (process.argv.includes('--db')) {
    await updateDatabase();
  } else {
    console.log('Run with --db to replace MongoDB with these 3 nodes only.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
