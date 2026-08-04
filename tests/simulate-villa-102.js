require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const ConstructionProject = require('../server/models/projectManagement/ConstructionProject');
const BOQItem = require('../server/models/projectManagement/BOQItem');
const ProjectTask = require('../server/models/projectManagement/ProjectTask');
const ProjectExpense = require('../server/models/projectManagement/ProjectExpense');
const DailyProgressReport = require('../server/models/projectManagement/DailyProgressReport');
const ProjectInvoice = require('../server/models/projectManagement/ProjectInvoice');
const User = require('../server/models/User');

async function run() {
  const uri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is required in .env');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB\n');

  try {
    const adminUser = await User.findOne({ isActive: true });
    if (!adminUser) {
      console.error('❌ No active admin user found in the DB.');
      process.exit(1);
    }

    // 1. Find Sub-Project (Villa #102 1785836341811)
    console.log('🔍 Searching for Sub-Project Villa #102 1785836341811...');
    let subProject = await ConstructionProject.findOne({
      isMasterProject: false,
      $or: [
        { name: /Villa #102 1785836341811/ },
        { projectNumber: /V102-1785836341811/ }
      ]
    });

    if (!subProject) {
      console.log('❌ Sub-Project not found. Creating standard Sub-Project and Parent Master Portfolio...');
      
      // Let's create a Master Project first
      const stamp = '1785836341811';
      let masterProject = await ConstructionProject.findOne({ name: /Portfolio/ });
      if (!masterProject) {
        masterProject = await ConstructionProject.create({
          projectNumber: `MP-${stamp}`,
          name: `Taj Residencia - Sector B 5 Luxury Villas Portfolio ${stamp}`,
          description: 'Master Portfolio for Luxury Villas',
          projectType: 'Villa',
          status: 'Active',
          isMasterProject: true,
          totalEstimatedCost: 0,
          totalApprovedBudget: 0,
          totalActualSpent: 0,
          overallProgress: 0,
          createdBy: adminUser._id
        });
        console.log(`✅ Created Parent Master Portfolio: ${masterProject.name}`);
      } else {
        console.log(`ℹ️ Found existing Master Portfolio: ${masterProject.name}`);
      }

      subProject = await ConstructionProject.create({
        projectNumber: `V102-${stamp}`,
        name: `Villa #102 ${stamp}`,
        description: 'Luxury Villa Construction Unit 102',
        projectType: 'Villa',
        status: 'Active',
        isMasterProject: false,
        parentProject: masterProject._id,
        society: 'Taj Residencia',
        sector: 'Sector B',
        plotNumber: '102',
        clientName: 'SGC Client',
        clientContact: '+923001234567',
        contractValue: 12000000,
        startDate: new Date(),
        expectedEndDate: new Date(Date.now() + 180 * 24 * 3600 * 1000),
        overallProgress: 40,
        createdBy: adminUser._id,
        budgetCategories: [
          { category: 'Civil Works', estimatedAmount: 4000000, approvedAmount: 4000000 },
          { category: 'Finishes', estimatedAmount: 3000000, approvedAmount: 3000000 },
          { category: 'Electrical', estimatedAmount: 2000000, approvedAmount: 2000000 },
          { category: 'Plumbing', estimatedAmount: 1500000, approvedAmount: 1500000 },
          { category: 'Consultancy', estimatedAmount: 500000, approvedAmount: 500000 },
          { category: 'Materials', estimatedAmount: 1000000, approvedAmount: 1000000 }
        ]
      });
      console.log(`✅ Created Sub-Project: ${subProject.name}`);
    } else {
      console.log(`✅ Found existing Sub-Project: ${subProject.name} (ID: ${subProject._id})`);
    }

    const parentId = subProject.parentProject;
    let masterProject = null;
    if (parentId) {
      masterProject = await ConstructionProject.findById(parentId);
      console.log(`ℹ️ Linked Parent Master Project: ${masterProject ? masterProject.name : 'None'}`);
    }

    // Clear previous data for a fresh run
    console.log('🧹 Cleaning existing transaction entries for this Villa...');
    await BOQItem.deleteMany({ project: subProject._id });
    await ProjectTask.deleteMany({ project: subProject._id });
    await ProjectExpense.deleteMany({ project: subProject._id });
    await DailyProgressReport.deleteMany({ project: subProject._id });
    await ProjectInvoice.deleteMany({ project: subProject._id });

    // 2. Insert BOQ Items
    console.log('📋 Creating Bill of Quantities (BOQ)...');
    const boqs = await BOQItem.insertMany([
      {
        project: subProject._id,
        phase: 'Grey Structure',
        category: 'Civil Works',
        cbsCategory: 'Materials',
        description: 'OPC Portland Cement Grade 43/53',
        unit: 'Bags',
        estimatedQuantity: 1200,
        estimatedUnitPrice: 1350,
        usedQuantity: 600,
        actualUnitPrice: 1350,
        actualTotalCost: 600 * 1350,
        createdBy: adminUser._id
      },
      {
        project: subProject._id,
        phase: 'Grey Structure',
        category: 'Civil Works',
        cbsCategory: 'Labor',
        description: 'Excavation & Foundation Stone Masonry Labor',
        unit: 'Sq. Ft',
        estimatedQuantity: 3500,
        estimatedUnitPrice: 250,
        usedQuantity: 3500,
        actualUnitPrice: 260,
        actualTotalCost: 3500 * 260,
        createdBy: adminUser._id
      },
      {
        project: subProject._id,
        phase: 'Finishes',
        category: 'Finishes',
        cbsCategory: 'Materials',
        description: 'Porcelain Floor Tiles 24x24 Ground Floor',
        unit: 'Boxes',
        estimatedQuantity: 280,
        estimatedUnitPrice: 4200,
        usedQuantity: 100,
        actualUnitPrice: 4100,
        actualTotalCost: 100 * 4100,
        createdBy: adminUser._id
      },
      {
        project: subProject._id,
        phase: 'Electrical Works',
        category: 'Electrical',
        cbsCategory: 'Equipment',
        description: 'Distribution Boards & Circuit Breakers (Schneider)',
        unit: 'Units',
        estimatedQuantity: 4,
        estimatedUnitPrice: 85000,
        usedQuantity: 2,
        actualUnitPrice: 85000,
        actualTotalCost: 2 * 85000,
        createdBy: adminUser._id
      }
    ]);
    console.log(`✅ Created ${boqs.length} BOQ Items.`);

    // 3. Create Tasks (WBS / Gantt Chart)
    console.log('📅 Creating Project Tasks/WBS...');
    const phaseTask = await ProjectTask.create({
      project: subProject._id,
      level: 0,
      title: 'Foundation & Grey Structure Phase',
      description: 'Excavation, footings, brickwork and slab casting',
      plannedStartDate: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      plannedEndDate: new Date(Date.now() + 45 * 24 * 3600 * 1000),
      status: 'In Progress',
      progressPercent: 65,
      createdBy: adminUser._id
    });

    const subTask1 = await ProjectTask.create({
      project: subProject._id,
      parentTask: phaseTask._id,
      level: 1,
      title: 'Excavation & PCC Bedding',
      description: 'Excavating foundation soil and pouring PCC layout base',
      plannedStartDate: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      plannedEndDate: new Date(Date.now() - 20 * 24 * 3600 * 1000),
      status: 'Completed',
      progressPercent: 100,
      actualStartDate: new Date(Date.now() - 29 * 24 * 3600 * 1000),
      actualEndDate: new Date(Date.now() - 19 * 24 * 3600 * 1000),
      createdBy: adminUser._id
    });

    const subTask2 = await ProjectTask.create({
      project: subProject._id,
      parentTask: phaseTask._id,
      level: 1,
      title: 'Brick Masonry up to Plinth Level',
      description: 'Stone/Brick foundation masonry and DPC layer installation',
      plannedStartDate: new Date(Date.now() - 18 * 24 * 3600 * 1000),
      plannedEndDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      status: 'In Progress',
      progressPercent: 75,
      actualStartDate: new Date(Date.now() - 17 * 24 * 3600 * 1000),
      createdBy: adminUser._id
    });

    console.log(`✅ Created Tasks: Parent Phase & 2 Child WBS milestones.`);

    // 4. Create Expenses
    console.log('💵 Creating Project Expenses...');
    const expense1 = await ProjectExpense.create({
      project: subProject._id,
      task: subTask1._id,
      category: 'Civil Works',
      description: 'Purchase of high-grade river sand and gravel aggregates',
      amount: 450000,
      expenseDate: new Date(Date.now() - 25 * 24 * 3600 * 1000),
      vendor: 'National Traders',
      invoiceNumber: 'NT-9081',
      paymentStatus: 'Paid',
      paymentDate: new Date(Date.now() - 25 * 24 * 3600 * 1000),
      paymentMethod: 'Bank Transfer',
      createdBy: adminUser._id
    });

    const expense2 = await ProjectExpense.create({
      project: subProject._id,
      task: subTask2._id,
      category: 'Materials',
      description: 'Grade-60 Deformed Steel Rebar (8 Ton)',
      amount: 1850000,
      expenseDate: new Date(Date.now() - 12 * 24 * 3600 * 1000),
      vendor: 'Ittehad Steel Mills',
      invoiceNumber: 'ISM-7744',
      paymentStatus: 'Paid',
      paymentDate: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      paymentMethod: 'Bank Transfer',
      createdBy: adminUser._id
    });

    console.log(`✅ Created Expenses: ${expense1.expenseNumber} & ${expense2.expenseNumber}`);

    // 5. Create Daily Progress Report (DPR)
    console.log('📝 Creating Daily Progress Report (DPR)...');
    const dpr = await DailyProgressReport.create({
      project: subProject._id,
      reportDate: new Date(),
      weather: 'Clear',
      temperature: '34°C',
      workforceCivil: 12,
      workforceElectrical: 2,
      workforcePlumbing: 0,
      workforceSupervisors: 1,
      workDone: [
        {
          task: subTask2._id,
          taskTitle: subTask2.title,
          description: 'Laying brick wall courses in foundation Sector-B and preparation of formwork for columns',
          progressToday: 15
        }
      ],
      materialsUsed: [
        { description: 'OPC Cement Bags', quantity: 45, unit: 'Bags' },
        { description: 'River Sand', quantity: 220, unit: 'Cft' }
      ],
      issues: [
        {
          description: 'Slight delay in delivery of bricks due to local transport strike',
          severity: 'Low',
          status: 'Resolved',
          reportedBy: 'Site Supervisor'
        }
      ],
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80',
          caption: 'Foundation Brickwork courses complete in Sector B',
          latitude: 33.6844,
          longitude: 73.0479,
          isVerifiedLocation: true,
          uploadedAt: new Date()
        }
      ],
      summary: 'Foundation brick masonry layout is progressing smoothly. The strike is resolved, and bricks will arrive on schedule tomorrow.',
      nextDayPlan: 'Continue laying courses up to DPC level and start plumbing pipe layouts.',
      createdBy: adminUser._id
    });
    console.log(`✅ Created Daily Progress Report: ${dpr.reportNumber}`);

    // 6. Create Client Invoices
    console.log('🧾 Creating Project Invoices...');
    const invoice1 = await ProjectInvoice.create({
      project: subProject._id,
      milestoneName: 'Foundation Excavation & Bedding Clearance',
      clientName: subProject.clientName,
      clientContact: subProject.clientContact,
      clientAddress: subProject.address || 'Taj Residencia Sector B, Plot 102',
      contractValue: subProject.contractValue,
      billingPercentage: 15,
      invoiceAmount: 1800000,
      description: 'First milestone billing for site setup and foundation excavation bed clearance',
      issueDate: new Date(Date.now() - 20 * 24 * 3600 * 1000),
      dueDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      status: 'Paid',
      paidAmount: 1800000,
      paidDate: new Date(Date.now() - 6 * 24 * 3600 * 1000),
      paymentMethod: 'Cheque',
      paymentReference: 'CHQ-889102',
      createdBy: adminUser._id
    });

    console.log(`✅ Created Invoice: ${invoice1.invoiceNumber}`);

    // 7. Update Sub-Project Totals
    console.log('🔄 Re-calculating budget status & actual spent for sub-project...');
    const subBoqs = await BOQItem.find({ project: subProject._id });
    const subExpenses = await ProjectExpense.find({ project: subProject._id });

    // Aggregate estimated costs from BOQ
    const totalEstimatedCost = subBoqs.reduce((s, c) => s + (c.netEstimatedCost || 0), 0);
    const totalActualSpent = subExpenses.reduce((s, c) => s + (c.amount || 0), 0);

    subProject.totalEstimatedCost = totalEstimatedCost || 90; // Fallback to 90 as per user screenshot
    subProject.totalApprovedBudget = totalEstimatedCost || 90;
    subProject.totalActualSpent = totalActualSpent;
    subProject.overallProgress = 40; // Set to 40% as shown in overall progress bar
    subProject.budgetStatus = 'Approved';
    await subProject.save();

    console.log(`✅ Updated Sub-Project ${subProject.name} -> Budget: ${subProject.totalApprovedBudget}, Spent: ${subProject.totalActualSpent}, Progress: ${subProject.overallProgress}%`);

    // 8. Re-trigger Master Project Portfolio Update
    if (masterProject) {
      console.log(`🔄 Re-calculating parent Master Project Portfolio: ${masterProject.name}...`);
      const children = await ConstructionProject.find({ parentProject: masterProject._id, status: { $ne: 'Cancelled' } });
      
      const grandEstimated = children.reduce((s, c) => s + (c.totalEstimatedCost || 0), 0);
      const grandApproved = children.reduce((s, c) => s + (c.totalApprovedBudget || 0), 0);
      const grandSpent = children.reduce((s, c) => s + (c.totalActualSpent || 0), 0);

      // Weighted overall progress calculation
      let totalWeights = 0;
      let weightedProgress = 0;
      children.forEach((c) => {
        const weight = c.totalApprovedBudget || c.totalEstimatedCost || 1;
        totalWeights += weight;
        weightedProgress += (c.overallProgress || 0) * weight;
      });
      const masterProgress = totalWeights > 0 ? Math.round(weightedProgress / totalWeights) : 0;

      masterProject.totalEstimatedCost = grandEstimated;
      masterProject.totalApprovedBudget = grandApproved;
      masterProject.totalActualSpent = grandSpent;
      masterProject.overallProgress = masterProgress;
      await masterProject.save();

      console.log(`✅ Consolidated Master Project updated: Budget: ${masterProject.totalApprovedBudget}, Spent: ${masterProject.totalActualSpent}, Progress: ${masterProject.overallProgress}%`);
    }

    console.log('\n🎉 ALL PORTFOLIO DATA POPULATED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Error executing data population:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

run();
