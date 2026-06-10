#!/usr/bin/env node
/**
 * Seed org chart from server/data/sgc-org-chart-default.json
 * Usage: node scripts/seed-org-chart.js [--force]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const OrgChartNode = require('../server/models/hr/OrgChartNode');
const { seedFromNestedTree, buildTreeFromFlat, countNodes } = require('../server/utils/orgChartTree');

const force = process.argv.includes('--force');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const count = await OrgChartNode.countDocuments();
  if (count > 0 && !force) {
    console.log(`Org chart already has ${count} nodes. Use --force to replace.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const tree = require('../server/data/sgc-org-chart-default.json');
  await seedFromNestedTree(tree, null);
  const flat = await OrgChartNode.find({ isActive: true }).lean();
  const built = buildTreeFromFlat(flat);
  console.log(`Seeded org chart: ${countNodes(built)} positions`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
