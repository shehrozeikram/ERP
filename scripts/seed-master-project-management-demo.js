/**
 * Script to create a Main/Master Construction Project with Sub-Projects
 * and populate all Project Management features (BOQ, Tasks, Expenses, DPR, Milestones).
 *
 * Usage:
 *   node scripts/seed-master-project-management-demo.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../server/config/database');

const ConstructionProject = require('../server/models/projectManagement/ConstructionProject');
const ProjectBOQ = require('../server/models/projectManagement/ProjectBOQ');
const BOQItem = require('../server/models/projectManagement/BOQItem');
const ProjectTask = require('../server/models/projectManagement/ProjectTask');
const ProjectExpense = require('../server/models/projectManagement/ProjectExpense');
const DailyProgressReport = require('../server/models/projectManagement/DailyProgressReport');
const User = require('../server/models/User');

async function seedProjectManagementDemo() {
  const { uri } = getMongoUri();
  const options = getMongooseClientOptions();

  console.log(`Connecting to MongoDB (${uri})...`);
  await mongoose.connect(uri, options);
  console.log('Connected to MongoDB successfully.\n');

  try {
    // 1. Get an active user to assign as Project Manager / Creator
    let user = await User.findOne({ isActive: true });
    if (!user) {
      user = await User.findOne({});
    }
    const userId = user ? user._id : new mongoose.Types.ObjectId();
    const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Project Admin';

    console.log(`Using User for assignments: ${userName} (${userId})`);

    // Cleanup previous demo projects with same title if re-run
    const existingMaster = await ConstructionProject.findOne({ name: 'Taj Heights Mega Complex' });
    if (existingMaster) {
      console.log('Cleaning up previous demo project run...');
      const subProjects = await ConstructionProject.find({ parentProject: existingMaster._id });
      const subProjectIds = subProjects.map(p => p._id);
      const allProjectIds = [existingMaster._id, ...subProjectIds];

      await DailyProgressReport.deleteMany({ project: { $in: allProjectIds } });
      await ProjectExpense.deleteMany({ project: { $in: allProjectIds } });
      await ProjectTask.deleteMany({ project: { $in: allProjectIds } });
      await BOQItem.deleteMany({ project: { $in: allProjectIds } });
      await ProjectBOQ.deleteMany({ project: { $in: allProjectIds } });
      await ConstructionProject.deleteMany({ _id: { $in: allProjectIds } });
      console.log('Previous demo records cleaned up.\n');
    }

    // -------------------------------------------------------------
    // 2. CREATE MAIN / MASTER PROJECT
    // -------------------------------------------------------------
    console.log('--------------------------------------------------');
    console.log('Creating Main/Master Project...');
    const masterProject = new ConstructionProject({
      name: 'Taj Heights Mega Complex',
      description: 'Master Commercial & Residential Mixed-Use Development Project consisting of Residential Towers and Commercial Plaza.',
      projectType: 'Commercial Building',
      status: 'Active',
      isMasterProject: true,
      parentProject: null,
      society: 'Taj Residencia',
      sector: 'Sector A',
      address: 'Main Boulevard, Taj Residencia, Islamabad',
      clientName: 'Sardar Group of Companies',
      clientContact: '+92 51 111 111 742',
      projectManager: userId,
      startDate: new Date('2025-01-01'),
      expectedEndDate: new Date('2027-12-31'),
      contractValue: 1250000000, // 1.25 Billion PKR
      notes: 'Master development tracking overall progress, master BOQ rollup, and unified budget management.',
      createdBy: userId,
      updatedBy: userId
    });
    await masterProject.save();
    console.log(`✓ Master Project Created: ${masterProject.name} (${masterProject.projectNumber}) [ID: ${masterProject._id}]`);

    // -------------------------------------------------------------
    // 3. CREATE SUB-PROJECT 1: Residential Tower A
    // -------------------------------------------------------------
    console.log('\nCreating Sub-Project 1: Taj Heights - Tower A (Residential)...');
    const subProject1 = new ConstructionProject({
      name: 'Taj Heights - Tower A (Residential)',
      description: '18-Story Luxury Residential Apartment Tower featuring 120 Units, Executive Suites, and Penthouse.',
      projectType: 'Apartment',
      status: 'Active',
      isMasterProject: false,
      parentProject: masterProject._id,
      society: 'Taj Residencia',
      sector: 'Sector A',
      plotNumber: 'Plot 101-105',
      clientName: 'Sardar Group of Companies',
      clientContact: '+92 51 111 111 742',
      projectManager: userId,
      startDate: new Date('2025-01-15'),
      expectedEndDate: new Date('2027-06-30'),
      contractValue: 750000000,
      overallProgress: 35,
      budgetCategories: [
        { category: 'Civil Works', estimatedAmount: 250000000, approvedAmount: 245000000 },
        { category: 'Finishes', estimatedAmount: 180000000, approvedAmount: 175000000 },
        { category: 'Electrical', estimatedAmount: 75000000, approvedAmount: 70000000 },
        { category: 'Plumbing', estimatedAmount: 50000000, approvedAmount: 48000000 },
        { category: 'HVAC System', estimatedAmount: 65000000, approvedAmount: 62000000 },
        { category: 'Labor', estimatedAmount: 80000000, approvedAmount: 78000000 },
        { category: 'Materials', estimatedAmount: 30000000, approvedAmount: 30000000 },
        { category: 'Contingency', estimatedAmount: 20000000, approvedAmount: 15000000 }
      ],
      milestones: [
        { title: 'Excavation & Piling', description: 'Deep excavation & 120 foundation piles', plannedDate: new Date('2025-03-31'), actualDate: new Date('2025-03-25'), status: 'Completed', completionPercentage: 100, billingTrigger: true, billingPercentage: 15 },
        { title: 'Basement & Raft Concreting', description: 'Double basement slab & raft foundation', plannedDate: new Date('2025-07-31'), actualDate: new Date('2025-08-05'), status: 'Completed', completionPercentage: 100, billingTrigger: true, billingPercentage: 20 },
        { title: 'Superstructure (Floors 1-10)', description: 'RCC Frame structure up to 10th floor', plannedDate: new Date('2026-02-28'), status: 'In Progress', completionPercentage: 55, billingTrigger: true, billingPercentage: 25 },
        { title: 'MEP & Interior Finishes', description: 'Plumbing, Wiring, Tile Work & Elevator install', plannedDate: new Date('2026-11-30'), status: 'Pending', completionPercentage: 0, billingTrigger: true, billingPercentage: 25 },
        { title: 'Final Handover & Snagging', description: 'Building commissioning and client unit delivery', plannedDate: new Date('2027-06-30'), status: 'Pending', completionPercentage: 0, billingTrigger: true, billingPercentage: 15 }
      ],
      createdBy: userId,
      updatedBy: userId
    });
    await subProject1.save();
    console.log(`✓ Sub-Project 1 Created: ${subProject1.name} (${subProject1.projectNumber}) [ID: ${subProject1._id}]`);

    // -------------------------------------------------------------
    // 4. CREATE SUB-PROJECT 2: Commercial Plaza & Retail
    // -------------------------------------------------------------
    console.log('\nCreating Sub-Project 2: Taj Heights - Commercial Plaza & Retail...');
    const subProject2 = new ConstructionProject({
      name: 'Taj Heights - Commercial Plaza & Retail',
      description: '4-Story Modern Commercial Shopping Mall, Food Court, and Corporate Offices Complex.',
      projectType: 'Commercial Building',
      status: 'Active',
      isMasterProject: false,
      parentProject: masterProject._id,
      society: 'Taj Residencia',
      sector: 'Sector A',
      plotNumber: 'Plot 106-108',
      clientName: 'Sardar Group of Companies',
      clientContact: '+92 51 111 111 742',
      projectManager: userId,
      startDate: new Date('2025-02-01'),
      expectedEndDate: new Date('2026-12-31'),
      contractValue: 500000000,
      overallProgress: 45,
      budgetCategories: [
        { category: 'Civil Works', estimatedAmount: 160000000, approvedAmount: 155000000 },
        { category: 'Finishes', estimatedAmount: 120000000, approvedAmount: 118000000 },
        { category: 'Electrical', estimatedAmount: 60000000, approvedAmount: 58000000 },
        { category: 'Plumbing', estimatedAmount: 35000000, approvedAmount: 34000000 },
        { category: 'HVAC System', estimatedAmount: 55000000, approvedAmount: 52000000 },
        { category: 'Labor', estimatedAmount: 50000000, approvedAmount: 48000000 },
        { category: 'Materials', estimatedAmount: 12000000, approvedAmount: 10000000 },
        { category: 'Contingency', estimatedAmount: 8000000, approvedAmount: 7500000 }
      ],
      milestones: [
        { title: 'Sub-structure & Ground Slab', description: 'Foundation and Ground Floor Slab', plannedDate: new Date('2025-05-31'), actualDate: new Date('2025-05-20'), status: 'Completed', completionPercentage: 100, billingTrigger: true, billingPercentage: 25 },
        { title: 'Structure Completion (4 Floors)', description: 'RCC Columns, Beams and Slabs', plannedDate: new Date('2025-11-30'), actualDate: new Date('2025-12-10'), status: 'Completed', completionPercentage: 100, billingTrigger: true, billingPercentage: 30 },
        { title: 'Facade Glass & Escalators', description: 'Structural glazing and escalator installation', plannedDate: new Date('2026-06-30'), status: 'In Progress', completionPercentage: 40, billingTrigger: true, billingPercentage: 25 },
        { title: 'Commercial Mall Launch', description: 'Retail shops handover and public opening', plannedDate: new Date('2026-12-31'), status: 'Pending', completionPercentage: 0, billingTrigger: true, billingPercentage: 20 }
      ],
      createdBy: userId,
      updatedBy: userId
    });
    await subProject2.save();
    console.log(`✓ Sub-Project 2 Created: ${subProject2.name} (${subProject2.projectNumber}) [ID: ${subProject2._id}]`);

    // Update Master Project rollup totals from children
    await masterProject.save();

    // -------------------------------------------------------------
    // 5. CREATE BOQ & BOQ ITEMS FOR SUB-PROJECT 1
    // -------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('Populating BOQ (Bill of Quantities)...');

    const boq1 = new ProjectBOQ({
      project: subProject1._id,
      title: 'Tower A Main Civil & Structural BOQ',
      description: 'Master Bill of Quantities for Tower A RCC frame, rebar, masonry, and finishes.',
      status: 'Approved',
      version: '1.0',
      createdBy: userId
    });
    await boq1.save();

    const boqItemsSub1 = [
      {
        project: subProject1._id,
        boqHeader: boq1._id,
        phase: 'Structure',
        category: 'Civil Works',
        cbsCategory: 'Materials',
        itemCode: 'BOQ-TA-001',
        title: 'Ready Mix Concrete (Grade 40)',
        description: 'High strength Ready Mix Concrete 40 MPa for columns and raft foundation',
        unit: 'Cu.M',
        estimatedQuantity: 4500,
        estimatedUnitPrice: 18000,
        estimatedTotalCost: 81000000,
        netEstimatedCost: 81000000,
        orderedQuantity: 2800,
        receivedQuantity: 2800,
        usedQuantity: 2650,
        actualUnitPrice: 17800,
        actualTotalCost: 49840000
      },
      {
        project: subProject1._id,
        boqHeader: boq1._id,
        phase: 'Structure',
        category: 'Civil Works',
        cbsCategory: 'Materials',
        itemCode: 'BOQ-TA-002',
        title: 'Deformed Steel Rebar (Grade 60)',
        description: 'High yield deformed steel reinforcement bars for structural RCC members',
        unit: 'Ton',
        estimatedQuantity: 650,
        estimatedUnitPrice: 260000,
        estimatedTotalCost: 169000000,
        netEstimatedCost: 169000000,
        orderedQuantity: 400,
        receivedQuantity: 400,
        usedQuantity: 380,
        actualUnitPrice: 255000,
        actualTotalCost: 102000000
      },
      {
        project: subProject1._id,
        boqHeader: boq1._id,
        phase: 'Finishes',
        category: 'Finishes',
        cbsCategory: 'Materials',
        itemCode: 'BOQ-TA-003',
        title: 'Porcelain Floor Tiles (60x60 cm)',
        description: 'Imported polished porcelain floor tiles for luxury apartment living rooms',
        unit: 'Sq.M',
        estimatedQuantity: 14000,
        estimatedUnitPrice: 3200,
        estimatedTotalCost: 44800000,
        netEstimatedCost: 44800000,
        orderedQuantity: 5000,
        receivedQuantity: 5000,
        usedQuantity: 1200,
        actualUnitPrice: 3100,
        actualTotalCost: 15500000
      }
    ];

    for (const itemData of boqItemsSub1) {
      const boqItem = new BOQItem(itemData);
      await boqItem.save();
    }
    console.log(`✓ Created BOQ "${boq1.title}" with ${boqItemsSub1.length} Items for Sub-Project 1`);

    // -------------------------------------------------------------
    // 6. CREATE WORK BREAKDOWN STRUCTURE (TASKS) FOR SUB-PROJECT 1 & 2
    // -------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('Populating Work Breakdown Structure (Tasks)...');

    // Sub-Project 1 Phase 1: Substructure
    const phase1Sub1 = new ProjectTask({
      project: subProject1._id,
      title: 'Phase 1: Substructure & Foundation',
      description: 'Excavation, piling work, raft foundation and basement structure',
      level: 0,
      orderIndex: 1,
      plannedStartDate: new Date('2025-01-15'),
      plannedEndDate: new Date('2025-07-31'),
      actualStartDate: new Date('2025-01-15'),
      actualEndDate: new Date('2025-08-05'),
      status: 'Completed',
      progressPercent: 100,
      assignedTo: 'Engr. Kamran Khan (Site PM)',
      estimatedLaborCost: 25000000,
      actualLaborCost: 24200000,
      isPhysicallyVerified: true,
      verifiedAt: new Date('2025-08-06'),
      verifiedBy: 'Superintending Engineer - Audit Dept',
      verificationNotes: 'Raft concrete test cubes passed 28-day 40MPa strength specs.'
    });
    await phase1Sub1.save();

    // Subtask 1 under Phase 1
    const task1_1 = new ProjectTask({
      project: subProject1._id,
      parentTask: phase1Sub1._id,
      title: 'Piling Work & Load Testing',
      description: 'Bored cast-in-situ concrete piles (1200mm dia)',
      level: 1,
      orderIndex: 1,
      plannedStartDate: new Date('2025-01-15'),
      plannedEndDate: new Date('2025-03-31'),
      actualStartDate: new Date('2025-01-15'),
      actualEndDate: new Date('2025-03-25'),
      status: 'Completed',
      progressPercent: 100,
      assignedTo: 'Specialist Piling Subcontractor',
      estimatedLaborCost: 12000000,
      actualLaborCost: 11800000,
      isPhysicallyVerified: true,
      verifiedBy: 'Quality Assurance Inspector'
    });
    await task1_1.save();

    // Sub-Project 1 Phase 2: Superstructure
    const phase2Sub1 = new ProjectTask({
      project: subProject1._id,
      title: 'Phase 2: Superstructure RCC Frame',
      description: 'Columns, Shear Walls, Beams and Slab casting up to 18th Floor',
      level: 0,
      orderIndex: 2,
      plannedStartDate: new Date('2025-08-01'),
      plannedEndDate: new Date('2026-05-31'),
      actualStartDate: new Date('2025-08-06'),
      status: 'In Progress',
      progressPercent: 55,
      assignedTo: 'Engr. Tariq Mahmood (Structure Lead)',
      estimatedLaborCost: 45000000,
      actualLaborCost: 24500000
    });
    await phase2Sub1.save();

    const task2_1 = new ProjectTask({
      project: subProject1._id,
      parentTask: phase2Sub1._id,
      title: 'Floors 1 to 8 Concrete Slab Casting',
      description: 'RCC Frame up to 8th story slab completed',
      level: 1,
      orderIndex: 1,
      plannedStartDate: new Date('2025-08-06'),
      plannedEndDate: new Date('2025-12-31'),
      actualStartDate: new Date('2025-08-06'),
      actualEndDate: new Date('2025-12-28'),
      status: 'Completed',
      progressPercent: 100,
      assignedTo: 'Formwork & Concrete Team A',
      estimatedLaborCost: 20000000,
      actualLaborCost: 19800000,
      isPhysicallyVerified: true,
      verifiedBy: 'Consultant Structural Engineer'
    });
    await task2_1.save();

    const task2_2 = new ProjectTask({
      project: subProject1._id,
      parentTask: phase2Sub1._id,
      title: 'Floors 9 to 14 Frame Construction',
      description: 'Reinforcement binding and shuttering for floors 9 to 14',
      level: 1,
      orderIndex: 2,
      plannedStartDate: new Date('2026-01-01'),
      plannedEndDate: new Date('2026-03-31'),
      actualStartDate: new Date('2026-01-02'),
      status: 'In Progress',
      progressPercent: 45,
      assignedTo: 'Formwork & Concrete Team B',
      estimatedLaborCost: 15000000,
      actualLaborCost: 4700000
    });
    await task2_2.save();

    console.log(`✓ Created WBS Tasks & Hierarchy for Sub-Projects`);

    // -------------------------------------------------------------
    // 7. RECORD PROJECT EXPENSES FOR SUB-PROJECTS
    // -------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('Recording Project Expenses...');

    const expense1 = new ProjectExpense({
      project: subProject1._id,
      task: task1_1._id,
      category: 'Civil Works',
      description: 'Advance payment for Heavy Piling Rig Mobilization & Test Pile Execution',
      amount: 4500000,
      expenseDate: new Date('2025-01-20'),
      vendor: 'National Piling & Foundation Co.',
      invoiceNumber: 'INV-NPF-2025-089',
      paymentStatus: 'Paid',
      paymentDate: new Date('2025-01-25'),
      paymentMethod: 'Bank Transfer',
      approvedBy: userId,
      approvedAt: new Date('2025-01-22'),
      notes: 'Verified against signed mobilization certificate.',
      createdBy: userId
    });
    await expense1.save();

    const expense2 = new ProjectExpense({
      project: subProject1._id,
      task: task2_1._id,
      category: 'Materials',
      description: 'Supply of 500 Tons Deformed Steel Reinforcement Bars (60 Grade)',
      amount: 127500000,
      expenseDate: new Date('2025-09-10'),
      vendor: 'Mughal Steel Rebar Mills Ltd',
      invoiceNumber: 'INV-MSR-8841',
      paymentStatus: 'Paid',
      paymentDate: new Date('2025-09-15'),
      paymentMethod: 'Bank Transfer',
      approvedBy: userId,
      approvedAt: new Date('2025-09-12'),
      notes: 'Mill test certificates attached & verified by Quality Control.',
      createdBy: userId
    });
    await expense2.save();

    const expense3 = new ProjectExpense({
      project: subProject2._id,
      category: 'Civil Works',
      description: 'Ready Mix Concrete supply for Commercial Plaza 2nd Floor Slab',
      amount: 14200000,
      expenseDate: new Date('2025-11-05'),
      vendor: 'Bestway Concrete Solutions',
      invoiceNumber: 'INV-BCS-4412',
      paymentStatus: 'Paid',
      paymentDate: new Date('2025-11-10'),
      paymentMethod: 'Bank Transfer',
      approvedBy: userId,
      approvedAt: new Date('2025-11-07'),
      notes: 'Pour completed smoothly in 14 hours.',
      createdBy: userId
    });
    await expense3.save();

    console.log(`✓ Recorded 3 Project Expenses total PKR ${(4500000 + 127500000 + 14200000).toLocaleString()}`);

    // Update financial actuals on sub-projects
    subProject1.totalActualSpent = 4500000 + 127500000;
    subProject1.totalCommitted = 200000000;
    await subProject1.save();

    subProject2.totalActualSpent = 14200000;
    subProject2.totalCommitted = 90000000;
    await subProject2.save();

    // -------------------------------------------------------------
    // 8. RECORD DAILY PROGRESS REPORT (DPR)
    // -------------------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log('Recording Daily Progress Reports (DPR)...');

    // DPR Photo Data URIs (Guarantee 100% reliable image loading in any environment)
    const photoUri1 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="bg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#0f172a"/></linearGradient></defs><rect width="600" height="400" fill="url(#bg1)"/><g stroke="#38bdf8" stroke-width="2" opacity="0.4"><line x1="0" y1="300" x2="600" y2="300"/><line x1="0" y1="250" x2="600" y2="250"/><line x1="100" y1="100" x2="100" y2="400"/><line x1="200" y1="100" x2="200" y2="400"/><line x1="300" y1="100" x2="300" y2="400"/><line x1="400" y1="100" x2="400" y2="400"/><line x1="500" y1="100" x2="500" y2="400"/></g><rect x="80" y="140" width="440" height="200" fill="#334155" rx="8"/><path d="M120 140 L120 80 L350 80 L350 140" stroke="#f59e0b" stroke-width="6" fill="none"/><circle cx="350" cy="80" r="12" fill="#f59e0b"/><text x="300" y="230" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">🏗️ CONCRETE SLAB &amp; REBAR</text><text x="300" y="265" font-family="sans-serif" font-size="14" fill="#38bdf8" text-anchor="middle">Tower A - 10th Floor Slab Shuttering</text></svg>');
    const photoUri2 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#312e81"/><stop offset="100%" stop-color="#1e1b4b"/></linearGradient></defs><rect width="600" height="400" fill="url(#bg2)"/><g stroke="#818cf8" stroke-width="4"><line x1="100" y1="80" x2="100" y2="360"/><line x1="250" y1="80" x2="250" y2="360"/><line x1="400" y1="80" x2="400" y2="360"/><line x1="550" y1="80" x2="550" y2="360"/><line x1="100" y1="150" x2="550" y2="150"/><line x1="100" y1="280" x2="550" y2="280"/><line x1="100" y1="150" x2="250" y2="280"/><line x1="250" y1="150" x2="400" y2="280"/><line x1="400" y1="150" x2="550" y2="280"/></g><circle cx="320" cy="150" r="16" fill="#fbbf24"/><text x="300" y="220" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">⚡ STRUCTURAL STEEL WELDING</text><text x="300" y="255" font-family="sans-serif" font-size="14" fill="#a5b4fc" text-anchor="middle">Commercial Plaza - Beam Erection</text></svg>');
    const photoUri3 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#065f46"/><stop offset="100%" stop-color="#022c22"/></linearGradient></defs><rect width="600" height="400" fill="url(#bg3)"/><g fill="#34d399" opacity="0.3"><rect x="120" y="60" width="80" height="100" rx="4"/><rect x="220" y="60" width="80" height="100" rx="4"/><rect x="320" y="60" width="80" height="100" rx="4"/><rect x="420" y="60" width="80" height="100" rx="4"/><rect x="120" y="180" width="80" height="100" rx="4"/><rect x="220" y="180" width="80" height="100" rx="4"/><rect x="320" y="180" width="80" height="100" rx="4"/><rect x="420" y="180" width="80" height="100" rx="4"/></g><text x="300" y="320" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">🏢 CURTAIN WALL GLASS FACADE</text><text x="300" y="355" font-family="sans-serif" font-size="14" fill="#6ee7b7" text-anchor="middle">Commercial Plaza - Glazing Panel Install</text></svg>');
    const photoUri4 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="bg4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#78350f"/><stop offset="100%" stop-color="#451a03"/></linearGradient></defs><rect width="600" height="400" fill="url(#bg4)"/><path d="M50 320 Q200 240 350 300 T600 280 L600 400 L50 400 Z" fill="#92400e"/><rect x="150" y="140" width="160" height="100" fill="#f59e0b" rx="6"/><circle cx="200" cy="270" r="30" fill="#1e293b"/><circle cx="280" cy="270" r="30" fill="#1e293b"/><text x="300" y="100" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">🚜 RAFT CONCRETING &amp; FOUNDATION</text><text x="300" y="135" font-family="sans-serif" font-size="14" fill="#fde68a" text-anchor="middle">Tower A - Core Wall Pouring</text></svg>');

    const dpr1 = new DailyProgressReport({
      project: subProject1._id,
      reportDate: new Date(),
      weather: 'Clear / Sunny',
      temperature: '28°C',
      workforceCivil: 45,
      workforceElectrical: 12,
      workforcePlumbing: 8,
      workforceSupervisors: 4,
      workforceTotal: 69,
      workDone: [
        {
          task: task2_2._id,
          taskTitle: 'Floors 9 to 14 Frame Construction',
          description: 'Casting of 10th Floor Columns (Grid A1 to D6) completed. Shuttering for 10th floor beam slab in progress.',
          progressToday: 5
        }
      ],
      materialsUsed: [
        { description: 'Ready Mix Concrete C40', quantity: 140, unit: 'Cu.M' },
        { description: 'Deformed Steel Rebar 16mm & 20mm', quantity: 18, unit: 'Ton' }
      ],
      photos: [
        {
          url: photoUri1,
          caption: '10th Floor Slab Shuttering & Rebar Binding in Progress',
          latitude: 33.6844,
          longitude: 73.0479,
          isVerifiedLocation: true
        }
      ],
      summary: 'Productive day on site with 69 workers active. Concrete pour scheduled for tomorrow morning at 07:00 AM.',
      nextDayPlan: 'Execute 10th floor beam & slab concrete pour.',
      submittedBy: userId
    });
    await dpr1.save();

    const dpr2 = new DailyProgressReport({
      project: subProject2._id,
      reportDate: new Date(Date.now() - 86400000), // Yesterday
      weather: 'Sunny',
      temperature: '30°C',
      workforceCivil: 38,
      workforceElectrical: 15,
      workforcePlumbing: 6,
      workforceSupervisors: 3,
      workforceTotal: 62,
      workDone: [
        {
          description: 'Erection of structural steel beams for 3rd floor retail atrium.',
          progressToday: 8
        }
      ],
      photos: [
        {
          url: photoUri2,
          caption: 'Structural Steel Beam Welding & Atrium Erection',
          latitude: 33.6850,
          longitude: 73.0485,
          isVerifiedLocation: true
        }
      ],
      summary: 'Atrium structural steel frame erection 80% complete.',
      submittedBy: userId
    });
    await dpr2.save();

    const dpr3 = new DailyProgressReport({
      project: subProject1._id,
      reportDate: new Date(Date.now() - 172800000), // 2 days ago
      weather: 'Partly Cloudy',
      temperature: '26°C',
      workforceCivil: 50,
      workforceElectrical: 8,
      workforcePlumbing: 5,
      workforceSupervisors: 4,
      workforceTotal: 67,
      photos: [
        {
          url: photoUri4,
          caption: 'Ready Mix Concrete Core Wall Pouring',
          latitude: 33.6846,
          longitude: 73.0481,
          isVerifiedLocation: true
        }
      ],
      summary: 'Lift core wall concreting completed for 9th floor.',
      submittedBy: userId
    });
    await dpr3.save();

    const dpr4 = new DailyProgressReport({
      project: subProject2._id,
      reportDate: new Date(Date.now() - 259200000), // 3 days ago
      weather: 'Clear',
      temperature: '29°C',
      workforceCivil: 30,
      workforceElectrical: 20,
      workforcePlumbing: 10,
      workforceSupervisors: 3,
      workforceTotal: 63,
      photos: [
        {
          url: photoUri3,
          caption: 'Double Glazed Curtain Wall Glass Facade Installation',
          latitude: 33.6852,
          longitude: 73.0488,
          isVerifiedLocation: true
        }
      ],
      summary: 'Plaza front elevation glass panels installed up to 2nd floor.',
      submittedBy: userId
    });
    await dpr4.save();

    console.log(`✓ Created 4 DPR Reports with 4 Geotagged Visual Verification Photos`);

    // Re-sync Master Project Rollup
    await masterProject.save();

    // Fetch refreshed documents to display summary
    const refreshedMaster = await ConstructionProject.findById(masterProject._id);
    const refreshedSub1 = await ConstructionProject.findById(subProject1._id);
    const refreshedSub2 = await ConstructionProject.findById(subProject2._id);

    console.log('\n==================================================');
    console.log('       DEMO PROJECT MANAGEMENT DATA CREATED       ');
    console.log('==================================================');
    console.log(`MASTER PROJECT:`);
    console.log(`  - Name:               ${refreshedMaster.name}`);
    console.log(`  - Project Code:       ${refreshedMaster.projectNumber}`);
    console.log(`  - Contract Value:     PKR ${refreshedMaster.contractValue.toLocaleString()}`);
    console.log(`  - Total Estimated:    PKR ${refreshedMaster.totalEstimatedCost.toLocaleString()}`);
    console.log(`  - Total Approved:     PKR ${refreshedMaster.totalApprovedBudget.toLocaleString()}`);
    console.log(`  - Master Project ID:  ${refreshedMaster._id}`);
    console.log(`\nSUB-PROJECTS LINKED (2):`);
    console.log(`  1) ${refreshedSub1.name} (${refreshedSub1.projectNumber})`);
    console.log(`     - Type: ${refreshedSub1.projectType} | Status: ${refreshedSub1.status} | Progress: ${refreshedSub1.overallProgress}%`);
    console.log(`     - Estimated Cost:  PKR ${refreshedSub1.totalEstimatedCost.toLocaleString()}`);
    console.log(`     - Approved Budget: PKR ${refreshedSub1.totalApprovedBudget.toLocaleString()}`);
    console.log(`     - Actual Spent:    PKR ${refreshedSub1.totalActualSpent.toLocaleString()}`);
    console.log(`     - ID:              ${refreshedSub1._id}`);
    console.log(`  2) ${refreshedSub2.name} (${refreshedSub2.projectNumber})`);
    console.log(`     - Type: ${refreshedSub2.projectType} | Status: ${refreshedSub2.status} | Progress: ${refreshedSub2.overallProgress}%`);
    console.log(`     - Estimated Cost:  PKR ${refreshedSub2.totalEstimatedCost.toLocaleString()}`);
    console.log(`     - Approved Budget: PKR ${refreshedSub2.totalApprovedBudget.toLocaleString()}`);
    console.log(`     - Actual Spent:    PKR ${refreshedSub2.totalActualSpent.toLocaleString()}`);
    console.log(`     - ID:              ${refreshedSub2._id}`);
    console.log(`\nASSOCIATED DATA ADDED:`);
    console.log(`  - BOQ & Items:        ${boqItemsSub1.length} Items under BOQ #${boq1.boqNumber}`);
    console.log(`  - WBS Tasks:          5 Tasks across Substructure & Superstructure`);
    console.log(`  - Recorded Expenses:  3 Paid Expenses totaling PKR ${(4500000 + 127500000 + 14200000).toLocaleString()}`);
    console.log(`  - Daily Progress:     1 Geotagged DPR with 69 workers & site photo`);
    console.log('==================================================\n');

  } catch (err) {
    console.error('Error seeding Project Management demo data:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

seedProjectManagementDemo();
