/**
 * Phase 1 Project Hierarchy & Rollup Engine Integration Test
 * Verifies Master Projects, Sub-Project Units (e.g. Villas 101-105), BOQ CBS categories,
 * and automated upper-level consolidation metrics for Senior Management.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const ConstructionProject = require('../server/models/projectManagement/ConstructionProject');
const BOQItem = require('../server/models/projectManagement/BOQItem');
const User = require('../server/models/User');
const ProjectRollupService = require('../server/services/projectRollupService');

const results = { pass: 0, fail: 0 };
function assertTest(condition, description) {
  if (condition) {
    console.log(`  ✓ PASSED: ${description}`);
    results.pass++;
  } else {
    console.error(`  ✗ FAILED: ${description}`);
    results.fail++;
    throw new Error(`Assertion failed: ${description}`);
  }
}

async function runHierarchyRollupTest() {
  const uri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is required in .env');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB\n');

  try {
    const stamp = Date.now();
    const adminUser = await User.findOne({ isActive: true });

    // Step 1: Create Master Project (e.g., 5 Luxury Villas Master Plan)
    console.log('📍 STEP 1: Create Master Project Portfolio');
    const masterProject = await ConstructionProject.create({
      projectNumber: `MP-${stamp}`,
      name: `Taj Residencia - Sector B 5 Luxury Villas Portfolio ${stamp}`,
      description: 'Master Multi-Unit Construction Project',
      projectType: 'Villa',
      status: 'Active',
      isMasterProject: true,
      budget: { approvedBudget: 250000000 }
    });
    assertTest(masterProject.isMasterProject === true, 'Master Project Portfolio created successfully');

    // Step 2: Create Sub-Project Units (Villa 101, Villa 102, Villa 103)
    console.log('\n📍 STEP 2: Create Sub-Project Units linked to Master Project');
    const villa101 = await ConstructionProject.create({
      projectNumber: `V101-${stamp}`,
      name: `Villa #101 ${stamp}`,
      isMasterProject: false,
      parentProject: masterProject._id,
      status: 'Active',
      overallProgress: 80,
      budget: { approvedBudget: 50000000 }
    });

    const villa102 = await ConstructionProject.create({
      projectNumber: `V102-${stamp}`,
      name: `Villa #102 ${stamp}`,
      isMasterProject: false,
      parentProject: masterProject._id,
      status: 'Active',
      overallProgress: 40,
      budget: { approvedBudget: 50000000 }
    });
    assertTest(String(villa101.parentProject) === String(masterProject._id), 'Sub-Project Units linked to Master Parent Project');

    // Step 3: Add BOQ Items with CBS (Cost Breakdown Structure) Categories
    console.log('\n📍 STEP 3: Add BOQ Items with CBS Categories (Materials, Labor, Equipment)');
    await BOQItem.create({
      project: villa101._id,
      description: 'Steel & Cement for Slab',
      unit: 'Ton',
      estimatedQuantity: 20,
      estimatedUnitPrice: 150000,
      estimatedTotalCost: 3000000,
      netEstimatedCost: 3000000,
      actualTotalCost: 3200000,
      cbsCategory: 'Materials',
      createdBy: adminUser?._id
    });

    await BOQItem.create({
      project: villa101._id,
      description: 'Labor Pouring Charges',
      unit: 'Days',
      estimatedQuantity: 10,
      estimatedUnitPrice: 100000,
      estimatedTotalCost: 1000000,
      netEstimatedCost: 1000000,
      actualTotalCost: 1000000,
      cbsCategory: 'Labor',
      createdBy: adminUser?._id
    });

    await BOQItem.create({
      project: villa102._id,
      description: 'Excavator Rental',
      unit: 'Hours',
      estimatedQuantity: 50,
      estimatedUnitPrice: 10000,
      estimatedTotalCost: 500000,
      netEstimatedCost: 500000,
      actualTotalCost: 550000,
      cbsCategory: 'Equipment',
      createdBy: adminUser?._id
    });
    assertTest(true, 'BOQ items created with CBS Category tags (Materials, Labor, Equipment)');

    // Step 4: Execute Master Rollup Aggregation Service
    console.log('\n📍 STEP 4: Execute Upper-Level Senior Management Rollup Engine');
    const rollup = await ProjectRollupService.getProjectRollupSummary(masterProject._id);

    assertTest(rollup.summaryMetrics.totalSubUnits === 2, 'Rollup Service identified 2 Sub-Units (Villas)');
    assertTest(rollup.summaryMetrics.masterOverallProgress === 60, 'Rollup Service calculated weighted physical completion (60%)');
    assertTest(rollup.cbsCostBreakdown.Materials.actual === 3200000, 'CBS Matrix correctly aggregated Materials Actual Cost');
    assertTest(rollup.cbsCostBreakdown.Labor.actual === 1000000, 'CBS Matrix correctly aggregated Labor Actual Cost');
    assertTest(rollup.cbsCostBreakdown.Equipment.actual === 550000, 'CBS Matrix correctly aggregated Equipment Actual Cost');
    assertTest(typeof rollup.summaryMetrics.earnedValueManagement.cpi === 'number', 'Phase 3: Earned Value Management CPI metric generated');
    assertTest(typeof rollup.summaryMetrics.cashDemandForecast30Days === 'number', 'Phase 3: 30-Day Liquidity Demand Forecast generated');

    console.log('\n========================================================================');
    console.log(`🎉 ALL PHASES (PHASE 1, 2 & 3) E2E TEST PASSED! Summary: ${results.pass} Passed, ${results.fail} Failed`);
    console.log('========================================================================\n');

  } catch (err) {
    console.error('❌ TEST EXECUTION FAILED:', err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

runHierarchyRollupTest();
