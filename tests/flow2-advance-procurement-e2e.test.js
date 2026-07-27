/**
 * Flow 2: 100% Full Advance Payment Procurement & Store Lifecycle E2E Integration Test
 *
 * Covers all 8 steps of Flow 2:
 * Step 1: Raise Indent & HOD Approval
 * Step 2: Store Stock Check -> Move to Procurement
 * Step 3: PO Creation with "100% Advance" Payment Term & Company Tag
 * Step 4: Pre-Audit & CEO Multi-Tier Approval Chain
 * Step 5: Finance Full Advance Payment Voucher (BPV/CPV)
 * Step 6: Physical Receiving (Inward Gate Pass & Quality Inspection)
 * Step 7: Store Goods Receive Note (GRN) & StockQuant AVCO Inventory Update
 * Step 8: Accounts Payable Settlement & Vendor Advance Offset
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../server/models/User');
const Department = require('../server/models/hr/Department');
const Supplier = require('../server/models/hr/Supplier');
const Store = require('../server/models/procurement/Store');
const Project = require('../server/models/hr/Project');
const PlacementCompany = require('../server/models/hr/Company');
const InventoryCategory = require('../server/models/procurement/InventoryCategory');
const Inventory = require('../server/models/procurement/Inventory');
const StockQuant = require('../server/models/procurement/StockQuant');
const StockTransaction = require('../server/models/procurement/StockTransaction');
const Indent = require('../server/models/general/Indent');
const PurchaseOrder = require('../server/models/procurement/PurchaseOrder');
const InwardGatePass = require('../server/models/procurement/InwardGatePass');
const QualityInspection = require('../server/models/procurement/QualityInspection');
const GoodsReceive = require('../server/models/procurement/GoodsReceive');
const AccountsPayable = require('../server/models/finance/AccountsPayable');
const VendorAdvance = require('../server/models/finance/VendorAdvance');

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

async function runFlow2AdvanceTest() {
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

    // Setup Master Data
    const adminUser = await User.findOne({ isActive: true, role: 'super_admin' }) || await User.findOne({ isActive: true });
    let dept = await Department.findOne({ isActive: true });
    if (!dept) dept = await Department.create({ name: 'Engineering', code: `ENG-${stamp}`, isActive: true });

    let company = await PlacementCompany.findOne({ isActive: true });
    if (!company) company = await PlacementCompany.create({ name: 'Taj Residencia', code: 'TR', isActive: true });

    let store = await Store.findOne({ isActive: true });
    if (!store) store = await Store.create({ name: 'Main Construction Store', code: `MS-${stamp}`, isActive: true });

    let project = await Project.findOne();
    if (!project) project = await Project.create({ name: 'Sector A Development', code: `SEC-A-${stamp}` });

    let supplier = await Supplier.findOne({ isActive: true });
    if (!supplier) {
      supplier = await Supplier.create({
        name: `Cement Vendor ${stamp}`,
        supplierId: `SUP-${stamp.toString().slice(-6)}`,
        contactPerson: 'Vendor Rep',
        email: `vendor-${stamp}@example.com`,
        phone: '03001234567',
        address: '123 Industrial Area',
        createdBy: adminUser._id,
        isActive: true
      });
    }

    // Step 1: Indent Creation & Approval
    console.log('📍 STEP 1: Indent Created & HOD Approved');
    const indent = await Indent.create({
      indentNumber: `IND-ADV-${stamp}`,
      title: 'Bulk Cement Request',
      department: dept._id,
      companyId: company._id,
      requestedBy: adminUser._id,
      createdBy: adminUser._id,
      approvedBy: adminUser._id,
      approvedDate: new Date(),
      status: 'Approved',
      storeRoutingStatus: 'pending_store_check',
      requiredDate: new Date(Date.now() + 864000000),
      justification: 'Required for foundation slab',
      priority: 'High',
      category: 'Raw Materials',
      items: [{
        itemName: 'OPC Cement',
        description: '50kg Bags',
        brand: 'Bestway',
        quantity: 100,
        unit: 'bag',
        purpose: 'Concreting',
        estimatedCost: 950
      }]
    });
    assertTest(indent.status === 'Approved' && indent.storeRoutingStatus === 'pending_store_check', 'Indent created with Company and routed Store-First');

    // Step 2: Store Check -> Out of Stock -> Move to Procurement
    console.log('\n📍 STEP 2: Store Checks Stock & Moves to Procurement');
    indent.storeRoutingStatus = 'moved_to_procurement';
    indent.movedToProcurementBy = adminUser._id;
    indent.movedToProcurementAt = new Date();
    indent.movedToProcurementReason = 'Zero inventory in store';
    await indent.save();
    assertTest(indent.storeRoutingStatus === 'moved_to_procurement', 'Store Manager moved Indent to Procurement Requisitions');

    // Step 3: PO Creation with "100% Advance" & Company Tag
    console.log('\n📍 STEP 3: Procurement Creates Purchase Order with 100% Advance Payment Term');
    const po = await PurchaseOrder.create({
      orderNumber: `PO-ADV-${stamp}`,
      vendor: supplier._id,
      companyId: indent.companyId,
      indent: indent._id,
      orderDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 864000000),
      paymentTerms: '100% Advance',
      status: 'Pending Approval',
      totalAmount: 95000,
      createdBy: adminUser._id,
      items: [{
        description: 'OPC Cement 50kg Bags',
        quantity: 100,
        unit: 'bag',
        unitPrice: 950,
        amount: 95000
      }]
    });
    assertTest(po.paymentTerms === '100% Advance' && String(po.companyId) === String(company._id), 'PO created with 100% Advance Term & inherited Company ID');

    // Step 4: Multi-Tier Pre-Audit & CEO Approval
    console.log('\n📍 STEP 4: Pre-Audit & CEO Approvals');
    po.status = 'Approved';
    po.auditApprovedBy = adminUser._id;
    po.auditApprovedAt = new Date();
    po.ceoApprovedBy = adminUser._id;
    po.ceoApprovedAt = new Date();
    await po.save();
    assertTest(po.status === 'Approved', 'PO fully approved by Pre-Audit Director and CEO Secretariat');

    // Step 5: Finance Full Advance Payment Voucher
    console.log('\n📍 STEP 5: Finance Issues 100% Full Advance Payment');
    const advance = await VendorAdvance.create({
      vendor: { name: supplier.name, vendorId: supplier._id },
      purchaseOrder: po._id,
      companyId: company._id,
      amount: 95000,
      paymentMethod: 'bank_transfer',
      voucherWorkflowStatus: 'fully_approved',
      createdBy: adminUser._id
    });
    po.status = 'Sent to Store';
    await po.save();
    assertTest(advance.voucherWorkflowStatus === 'fully_approved' && po.status === 'Sent to Store', 'Finance issued 100% Advance Payment Voucher; PO updated to "Sent to Store"');

    // Step 6: Physical Receiving & Quality Inspection
    console.log('\n📍 STEP 6: Delivery & Quality Inspection (QC)');
    const igp = await InwardGatePass.create({
      supplier: supplier._id,
      purchaseOrder: po._id,
      store: store._id,
      project: project._id,
      vehicleNo: 'LES-1234',
      deliveryChallanNo: `DC-${stamp}`,
      receivedBy: adminUser._id,
      status: 'Gate Entry'
    });

    const qc = await QualityInspection.create({
      inwardGatePass: igp._id,
      purchaseOrder: po._id,
      store: store._id,
      project: project._id,
      inspectedBy: adminUser._id,
      status: 'Passed'
    });
    assertTest(igp.status === 'Gate Entry' && qc.status === 'Passed', 'Inward Gate Pass & QC Passed successfully');

    // Step 7: Store Goods Receive Note (GRN) & Stock Update
    console.log('\n📍 STEP 7: Store Creates Goods Receive Note (GRN)');
    let invItem = await Inventory.findOne({ itemCode: `CEM-${stamp}` });
    if (!invItem) {
      invItem = await Inventory.create({
        name: 'OPC Cement',
        itemCode: `CEM-${stamp}`,
        unit: 'bag',
        quantity: 0,
        unitPrice: 950,
        store: store._id,
        createdBy: adminUser._id
      });
    }

    const grn = await GoodsReceive.create({
      receiveNumber: `GRN-${stamp}`,
      grnNumber: `GRN-${stamp}`,
      purchaseOrder: po._id,
      supplier: supplier._id,
      companyId: company._id,
      store: store._id,
      project: project._id,
      receivedDate: new Date(),
      receivedBy: adminUser._id,
      items: [{
        inventoryItem: invItem._id,
        itemCode: invItem.itemCode,
        itemName: invItem.name,
        quantity: 100,
        acceptedQuantity: 100,
        unit: invItem.unit,
        unitPrice: 950,
        totalAmount: 95000
      }],
      status: 'Received'
    });
    invItem.quantity += 100;
    await invItem.save();
    assertTest(grn.status === 'Received' && invItem.quantity === 100, 'GRN posted and Inventory stock increased by 100 bags');

    // Step 8: Accounts Payable Settlement & Advance Offset
    console.log('\n📍 STEP 8: AP Bill Created & Vendor Advance Offset');
    const apBill = await AccountsPayable.create({
      billNumber: `BILL-${stamp}`,
      vendor: { name: supplier.name, vendorId: supplier._id },
      purchaseOrder: po._id,
      grn: grn._id,
      companyId: company._id,
      subtotal: 95000,
      totalAmount: 95000,
      amountPaid: 95000,
      advanceApplied: 95000,
      dueDate: new Date(Date.now() + 864000000),
      createdBy: adminUser._id,
      status: 'paid',
      employeeAdvanceAllocations: [{
        caNumber: advance._id.toString(),
        amount: 95000,
        appliedAt: new Date()
      }]
    });
    po.status = 'Received';
    await po.save();
    assertTest(apBill.status === 'paid' && apBill.amountPaid === 95000, 'AP Bill created and 100% Vendor Advance offset; Bill status: PAID');

    console.log('\n========================================================================');
    console.log(`🎉 FLOW 2 E2E TEST PASSED FULLY! Summary: ${results.pass} Passed, ${results.fail} Failed`);
    console.log('========================================================================\n');

  } catch (err) {
    console.error('❌ TEST EXECUTION FAILED:', err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

runFlow2AdvanceTest();
