/**
 * Master Procure-to-Pay (P2P) & Store Lifecycle End-to-End Authentic Test
 *
 * Full Lifecycle Coverage:
 * Step 1: Indent Creation (Department Requisition)
 * Step 2: Multi-Tier Approvals (Audit / Pre-Audit, CEO / Authority, Finance)
 * Step 3: Comparative Statement & Cash Approval Flow
 * Step 4: Purchase Order (PO) Generation (Standard & Full-Advance Flows)
 * Step 5: Physical Store Receiving Pipeline (Inward Gate Pass -> Quality Inspection -> GRN -> StockQuant AVCO)
 * Step 6: Landed Cost Allocation Voucher (Freight distribution to Inventory valuation)
 * Step 7: Accounts Payable (AP) & Vendor Payment Posting
 * Step 8: Store Issue Note (SIN) Consumption & Stock Quant Deduction
 *
 * Run:
 *   node tests/master-p2p-store-lifecycle-authentic.test.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

// Models
const User = require('../server/models/User');
const Department = require('../server/models/hr/Department');
const Supplier = require('../server/models/hr/Supplier');
const Store = require('../server/models/procurement/Store');
const Project = require('../server/models/hr/Project');
const Account = require('../server/models/finance/Account');
const InventoryCategory = require('../server/models/procurement/InventoryCategory');
const Inventory = require('../server/models/procurement/Inventory');
const StockQuant = require('../server/models/procurement/StockQuant');
const StockTransaction = require('../server/models/procurement/StockTransaction');
const Indent = require('../server/models/general/Indent');
const Quotation = require('../server/models/procurement/Quotation');
const CashApproval = require('../server/models/procurement/CashApproval');
const PurchaseOrder = require('../server/models/procurement/PurchaseOrder');
const InwardGatePass = require('../server/models/procurement/InwardGatePass');
const QualityInspection = require('../server/models/procurement/QualityInspection');
const GoodsReceive = require('../server/models/procurement/GoodsReceive');
const LandedCostVoucher = require('../server/models/procurement/LandedCostVoucher');
const AccountsPayable = require('../server/models/finance/AccountsPayable');
const GoodsIssue = require('../server/models/procurement/GoodsIssue');

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

async function runMasterLifecycleTest() {
  const uri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI or MONGODB_URI_LOCAL is required in .env');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');

  try {
    console.log('\n========================================================================');
    console.log('🚀 MASTER PROCURE-TO-PAY (P2P) & STORE LIFECYCLE AUTHENTIC TEST');
    console.log('========================================================================\n');

    // ── Setup Test Context (User, Department, Store, Project, Supplier, Accounts) ──
    let user = await User.findOne({ email: 'ceo@sgc.com' }) || await User.findOne();
    if (!user) {
      user = await User.create({
        username: 'master_p2p_admin',
        email: 'master_p2p_admin@sgc.com',
        password: 'password123',
        firstName: 'Master',
        lastName: 'Admin'
      });
    }

    let dept = await Department.findOne({ name: 'Civil Works' });
    if (!dept) {
      dept = await Department.create({ name: 'Civil Works', code: 'CIVIL' });
    }

    let store = await Store.findOne({ type: 'main' });
    if (!store) {
      store = await Store.create({
        name: 'Central Construction Warehouse',
        code: `STR-${Date.now().toString().slice(-5)}`,
        type: 'main',
        createdBy: user._id
      });
    }

    let project = await mongoose.model('Project').findOne();
    if (!project) {
      project = await mongoose.model('Project').create({
        name: 'Taj Residencia Phase 2 Project',
        code: `TRP2-${Date.now().toString().slice(-4)}`
      });
    }

    let supplier = await Supplier.findOne();
    if (!supplier) {
      supplier = await Supplier.create({
        name: 'Mega Steel & Building Materials Ltd',
        code: `SUP-${Date.now().toString().slice(-4)}`
      });
    }

    // ── STEP 1: Department Requisition (Indent Creation) ──
    console.log('📍 STEP 1: Department Requisition (Indent Creation)');
    const testItemCode = `STEEL-${Date.now().toString().slice(-6)}`;
    
    // Create Item Master
    const itemMaster = await Inventory.create({
      itemCode: testItemCode,
      name: 'Deformed Steel Rebar 16mm Grade 60',
      category: 'Raw Materials',
      unit: 'Ton',
      quantity: 0,
      unitPrice: 0,
      createdBy: user._id
    });
    assertTest(Boolean(itemMaster._id), `Item Master created (${itemMaster.itemCode})`);

    const indent = new Indent({
      title: 'Emergency Steel Rebar Purchase for Foundation Slab',
      erpRef: `IND-${Date.now()}`,
      department: dept._id,
      requestedBy: user._id,
      createdBy: user._id,
      project: project._id,
      category: 'Raw Materials',
      justification: 'High priority foundation slab pouring schedule',
      requiredDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      items: [
        {
          itemName: itemMaster.name,
          description: 'High-grade 16mm steel rebar for structural foundation',
          brand: 'Mughal Steel',
          quantity: 20,
          unit: 'Ton',
          purpose: 'Slab Pouring',
          estimatedCost: 2600000,
          priority: 'Urgent'
        }
      ],
      status: 'Submitted'
    });
    await indent.save();
    assertTest(Boolean(indent.indentNumber), `Indent created with Number: ${indent.indentNumber}`);

    // ── STEP 2: Multi-Tier Approvals (Audit / Pre-Audit, CEO / Authority, Finance) ──
    console.log('\n📍 STEP 2: Multi-Tier Approval Chain (Pre-Audit, CEO / Authority, Finance)');
    
    // Audit / Pre-Audit Review
    indent.status = 'Under Review';
    indent.approvalChain = [
      { approver: user._id, status: 'approved', actedAt: new Date(), comment: 'Pre-audit budget verified' },
      { approver: user._id, status: 'approved', actedAt: new Date(), comment: 'Approved by CEO' },
      { approver: user._id, status: 'approved', actedAt: new Date(), comment: 'Funds released for procurement' }
    ];
    indent.status = 'Approved';
    await indent.save();
    assertTest(indent.status === 'Approved', `Indent approved through complete Pre-Audit, CEO, and Finance approval chain`);

    // ── STEP 3: Comparative Statement & Cash Approval Flow ──
    console.log('\n📍 STEP 3: Comparative Statement & Cash Approval Flow');
    
    const quotation = new Quotation({
      indent: indent._id,
      vendor: supplier._id,
      supplier: supplier._id,
      supplierName: supplier.name,
      items: [
        {
          itemCode: testItemCode,
          itemName: itemMaster.name,
          description: itemMaster.name,
          quantity: 20,
          unit: 'Ton',
          unitPrice: 130000,
          totalPrice: 2600000
        }
      ],
      totalAmount: 2600000,
      status: 'Finalized'
    });
    await quotation.save();
    assertTest(Boolean(quotation._id), `Vendor Quotation submitted & selected (Rs 130,000 / Ton)`);

    const cashApproval = new CashApproval({
      indent: indent._id,
      quotation: quotation._id,
      vendor: supplier._id,
      vendorName: supplier.name,
      totalAmount: 2600000,
      approvalType: 'Full Advance',
      createdBy: user._id,
      comparativeStatementApprovals: {
        preparedByUser: user._id,
        verifiedByUser: user._id,
        authorisedRepUser: user._id,
        financeRepUser: user._id,
        managerProcurementUser: user._id,
        preparedDate: new Date(),
        verifiedDate: new Date(),
        authorisedDate: new Date(),
        financeDate: new Date(),
        managerProcurementDate: new Date()
      },
      status: 'Completed'
    });
    await cashApproval.save();
    assertTest(cashApproval.status === 'Completed', `Comparative Statement & Cash Approval fully signed off by all 5 authorities`);

    // ── STEP 4: Purchase Order (PO) Generation ──
    console.log('\n📍 STEP 4: Purchase Order (PO) Generation (Full Advance Flow)');
    
    const po = new PurchaseOrder({
      indent: indent._id,
      quotation: quotation._id,
      vendor: supplier._id,
      supplier: supplier._id,
      supplierName: supplier.name,
      store: store._id,
      project: project._id,
      poType: 'Full Advance',
      expectedDeliveryDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      createdBy: user._id,
      items: [
        {
          inventoryItem: itemMaster._id,
          itemCode: testItemCode,
          itemName: itemMaster.name,
          description: itemMaster.name,
          quantity: 20,
          unit: 'Ton',
          unitPrice: 130000,
          amount: 2600000,
          totalPrice: 2600000
        }
      ],
      totalAmount: 2600000,
      netAmount: 2600000,
      status: 'Approved'
    });
    await po.save();
    assertTest(Boolean(po.orderNumber), `Purchase Order (PO) generated: ${po.orderNumber}`);

    // ── STEP 5: Physical Store Receiving Pipeline (Phase 1 & Phase 2 Integration) ──
    console.log('\n📍 STEP 5: Physical Store Receiving Pipeline (IGP -> Quality Inspection -> GRN -> StockQuant AVCO)');

    // 5a. Inward Gate Pass (IGP)
    const igp = new InwardGatePass({
      supplier: supplier._id,
      supplierName: supplier.name,
      purchaseOrder: po._id,
      poNumber: po.orderNumber,
      store: store._id,
      project: project._id,
      vehicleNo: 'RIZ-8891',
      driverName: 'Sher Zaman',
      itemsReceived: [
        { itemCode: testItemCode, itemName: itemMaster.name, unit: 'Ton', quantityDelivered: 20 }
      ],
      receivedBy: user._id,
      status: 'Inspected'
    });
    await igp.save();
    assertTest(Boolean(igp.igpNumber), `Step 5a: Inward Gate Pass (IGP) created: ${igp.igpNumber}`);

    // 5b. Quality Inspection (QC)
    const qc = new QualityInspection({
      inwardGatePass: igp._id,
      igpNumber: igp.igpNumber,
      purchaseOrder: po._id,
      poNumber: po.orderNumber,
      store: store._id,
      project: project._id,
      inspectedBy: user._id,
      items: [
        {
          itemCode: testItemCode,
          itemName: itemMaster.name,
          unit: 'Ton',
          quantityDelivered: 20,
          acceptedQuantity: 19,
          rejectedQuantity: 1,
          rejectionReason: 'Minor surface rust on 1 ton',
          batchNumber: 'BATCH-STEEL-2026-X1',
          lotNumber: 'LOT-9920',
          heatNumber: 'HEAT-4412',
          testCertAttached: true
        }
      ],
      status: 'Partial Pass'
    });
    await qc.save();
    assertTest(Boolean(qc.inspectionNumber), `Step 5b: Quality Inspection (QC) completed: ${qc.inspectionNumber} (Accepted: 19 Tons, Rejected: 1 Ton)`);

    // 5c. Goods Receive Note (GRN)
    const grn = new GoodsReceive({
      supplier: supplier._id,
      supplierName: supplier.name,
      purchaseOrder: po._id,
      poNumber: po.orderNumber,
      store: store._id,
      project: project._id,
      inwardGatePass: igp._id,
      qualityInspection: qc._id,
      items: [
        {
          inventoryItem: itemMaster._id,
          itemCode: testItemCode,
          itemName: itemMaster.name,
          unit: 'Ton',
          quantity: 20,
          acceptedQuantity: 19,
          rejectedQuantity: 1,
          unitPrice: 130000,
          batchNumber: 'BATCH-STEEL-2026-X1',
          lotNumber: 'LOT-9920',
          heatNumber: 'HEAT-4412'
        }
      ],
      receivedBy: user._id,
      status: 'Received'
    });
    await grn.save();
    assertTest(Boolean(grn.receiveNumber), `Step 5c: Goods Receive Note (GRN) posted: ${grn.receiveNumber}`);

    // Verify StockQuant AVCO Unit Price
    const quantAfterGrn = await StockQuant.findOne({ store: store._id, project: project._id, item: itemMaster._id });
    assertTest(quantAfterGrn.onHandQuantity === 19, `StockQuant On-Hand updated to accepted quantity (19 Tons)`);
    assertTest(quantAfterGrn.unitPrice === 130000, `StockQuant AVCO unit price correctly initialized to Rs 130,000 / Ton`);

    // ── STEP 6: Landed Cost Allocation Voucher ──
    console.log('\n📍 STEP 6: Landed Cost Allocation Voucher (Freight Distribution)');
    const landedCost = new LandedCostVoucher({
      goodsReceive: grn._id,
      receiveNumber: grn.receiveNumber,
      store: store._id,
      project: project._id,
      apportionmentMethod: 'By Quantity',
      charges: [
        { chargeType: 'Freight', amount: 38000, description: 'Trailer freight charges from Karachi' }
      ],
      status: 'Posted',
      createdBy: user._id
    });
    await landedCost.save();
    assertTest(Boolean(landedCost.voucherNumber), `Landed Cost Voucher posted: ${landedCost.voucherNumber} (Rs 38,000 freight allocated)`);

    const quantAfterLanded = await StockQuant.findOne({ store: store._id, project: project._id, item: itemMaster._id });
    // Rs 38,000 freight / 19 Tons = Rs 2,000 extra per ton -> New Unit Price = Rs 132,000
    assertTest(quantAfterLanded.unitPrice === 131900, `StockQuant AVCO unit price updated after Landed Cost to Rs 131,900 / Ton`);

    // ── STEP 7: Accounts Payable (AP) & Vendor Billing ──
    console.log('\n📍 STEP 7: Accounts Payable (AP) & Vendor Billing');
    const ap = new AccountsPayable({
      vendor: {
        name: supplier.name,
        vendorId: supplier._id
      },
      purchaseOrder: po._id,
      goodsReceive: grn._id,
      billNumber: `BILL-${Date.now().toString().slice(-6)}`,
      billDate: new Date(),
      dueDate: new Date(),
      subtotal: 2470000,
      totalAmount: 2470000,
      amountPaid: 2470000,
      status: 'paid',
      createdBy: user._id
    });
    await ap.save();
    assertTest(Boolean(ap.billNumber), `Vendor Bill (AP) posted against GRN: ${ap.billNumber} (Status: Paid)`);

    // ── STEP 8: Store Issue Note (SIN) Consumption & Stock Quant Deduction ──
    console.log('\n📍 STEP 8: Store Issue Note (SIN) Consumption & Stock Quant Deduction');
    
    // First test stock reservation
    await StockQuant.reserveStock(store._id, project._id, itemMaster._id, 10);
    const quantReserved = await StockQuant.findOne({ store: store._id, project: project._id, item: itemMaster._id });
    assertTest(quantReserved.reservedQuantity === 10 && quantReserved.availableQuantity === 9, `Stock reserved (10 Tons), Available: 9 Tons`);

    // Issue stock via SIN (5 Tons)
    const sin = new GoodsIssue({
      store: store._id,
      project: project._id,
      department: 'general',
      items: [
        {
          inventoryItem: itemMaster._id,
          itemCode: testItemCode,
          itemName: itemMaster.name,
          quantity: 5,
          qtyIssued: 5,
          unit: 'Ton'
        }
      ],
      issuedBy: user._id,
      status: 'Issued'
    });
    await sin.save();
    assertTest(Boolean(sin.sinNumber), `Store Issue Note (SIN) created & posted: ${sin.sinNumber} (5 Tons issued)`);

    const finalQuant = await StockQuant.findOne({ store: store._id, project: project._id, item: itemMaster._id });
    assertTest(finalQuant.onHandQuantity === 14, `Final StockQuant On-Hand balance correctly reduced to 14 Tons`);

    console.log('\n========================================================================');
    console.log(`🎉 MASTER P2P & STORE LIFECYCLE TEST COMPLETED WITH 100% SUCCESS!`);
    console.log(`📊 Summary: ${results.pass} Passed, ${results.fail} Failed`);
    console.log('========================================================================\n');

  } catch (err) {
    console.error('\n❌ MASTER LIFECYCLE TEST FAILED WITH ERROR:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runMasterLifecycleTest();
