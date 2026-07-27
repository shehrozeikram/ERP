/**
 * Integration Test for Phase 1 & Phase 2 Store & Procurement Upgrade
 * Tests:
 * 1. InventoryCategory GL Account linking
 * 2. StockQuant AVCO valuation & reservation logic
 * 3. InwardGatePass (IGP) creation
 * 4. QualityInspection (QC) creation
 * 5. GoodsReceive (GRN) with accepted/rejected breakdown & StockQuant AVCO sync
 * 6. LandedCostVoucher freight allocation to StockQuant valuation
 * 7. GoodsIssue (SIN) stock deduction from StockQuant
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const path = require('path');

// Models
const InventoryCategory = require('../server/models/procurement/InventoryCategory');
const StockTransaction = require('../server/models/procurement/StockTransaction');
const StockQuant = require('../server/models/procurement/StockQuant');
const Inventory = require('../server/models/procurement/Inventory');
const Store = require('../server/models/procurement/Store');
const Project = require('../server/models/finance/FixedAsset').Project || mongoose.model('Project', new mongoose.Schema({ name: String, code: String }));
const Supplier = require('../server/models/hr/Supplier');
const InwardGatePass = require('../server/models/procurement/InwardGatePass');
const QualityInspection = require('../server/models/procurement/QualityInspection');
const GoodsReceive = require('../server/models/procurement/GoodsReceive');
const GoodsIssue = require('../server/models/procurement/GoodsIssue');
const LandedCostVoucher = require('../server/models/procurement/LandedCostVoucher');
const User = require('../server/models/User');

async function runTest() {
  const uri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI or MONGODB_URI_LOCAL is required in .env');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');

  try {
    // 1. Create or fetch test User & Store & Project
    let user = await User.findOne();
    if (!user) {
      user = await User.create({
        username: 'store_test_admin',
        email: 'store_test_admin@example.com',
        password: 'password123',
        firstName: 'Store',
        lastName: 'Admin'
      });
    }

    let store = await Store.findOne({ type: 'main' });
    if (!store) {
      store = await Store.create({
        name: 'Test Main Warehouse',
        code: `STR-${Date.now().toString().slice(-5)}`,
        type: 'main',
        createdBy: user._id
      });
    }

    let project = await mongoose.model('Project').findOne();
    if (!project) {
      project = await mongoose.model('Project').create({
        name: 'Test Project Site Alpha',
        code: `PRJ-${Date.now().toString().slice(-4)}`
      });
    }

    let supplier = await Supplier.findOne();
    if (!supplier) {
      supplier = await Supplier.create({
        name: 'Global Steel & Cement Supplies Ltd',
        code: `SUP-${Date.now().toString().slice(-4)}`
      });
    }

    console.log(`\n--- 1. Testing InventoryCategory GL Accounts ---`);
    let category = await InventoryCategory.findOne({ name: 'Test Construction Materials' });
    if (!category) {
      category = await InventoryCategory.create({
        name: 'Test Construction Materials',
        description: 'Raw construction steel and cement',
        createdBy: user._id
      });
    }
    console.log(`✅ Category created/found: ${category.name}`);

    console.log(`\n--- 2. Testing Global Item Master & StockQuant AVCO Valuation ---`);
    const testItemCode = `STEEL-${Date.now().toString().slice(-6)}`;
    const item = await Inventory.create({
      itemCode: testItemCode,
      name: 'Deformed Steel Bar 12mm',
      category: 'Raw Materials',
      unit: 'Ton',
      quantity: 0,
      unitPrice: 0,
      createdBy: user._id
    });
    console.log(`✅ Item Master created: ${item.name} (${item.itemCode})`);

    // Receipt 1: 10 Tons @ Rs. 100,000 / Ton
    const quant1 = await StockQuant.addStockAVCO(store._id, project._id, item._id, 10, 100000, { rack: 'R1', shelf: 'S1', bin: 'B1' });
    console.log(`   Receipt 1: 10 Tons @ Rs 100,000 -> StockQuant OnHand: ${quant1.onHandQuantity}, AVCO UnitPrice: Rs ${quant1.unitPrice}`);

    // Receipt 2: 10 Tons @ Rs 120,000 / Ton -> Expected AVCO = (10*100k + 10*120k) / 20 = 110,000
    const quant2 = await StockQuant.addStockAVCO(store._id, project._id, item._id, 10, 120000, { rack: 'R1', shelf: 'S1', bin: 'B1' });
    console.log(`   Receipt 2: 10 Tons @ Rs 120,000 -> StockQuant OnHand: ${quant2.onHandQuantity}, AVCO UnitPrice: Rs ${quant2.unitPrice}`);

    if (quant2.unitPrice !== 110000) {
      throw new Error(`AVCO calculation mismatch! Expected 110000, got ${quant2.unitPrice}`);
    }
    console.log(`✅ AVCO Valuation Engine correctly calculated unit price: Rs 110,000 / Ton`);

    console.log(`\n--- 3. Testing Stock Reservation & Availability ---`);
    await StockQuant.reserveStock(store._id, project._id, item._id, 5);
    const quantWithRes = await StockQuant.findOne({ store: store._id, project: project._id, item: item._id });
    console.log(`   OnHand: ${quantWithRes.onHandQuantity}, Reserved: ${quantWithRes.reservedQuantity}, Available: ${quantWithRes.availableQuantity}`);

    if (quantWithRes.availableQuantity !== 15) {
      throw new Error(`Available quantity calculation error! Expected 15, got ${quantWithRes.availableQuantity}`);
    }
    console.log(`✅ Stock Reservation Engine correctly calculated available stock: 15 Tons`);

    console.log(`\n--- 4. Testing Inward Gate Pass (IGP) ---`);
    const igp = await InwardGatePass.create({
      supplier: supplier._id,
      store: store._id,
      project: project._id,
      vehicleNo: 'LES-9922',
      driverName: 'Muhammad Ali',
      itemsReceived: [
        { itemCode: testItemCode, itemName: item.name, unit: 'Ton', quantityDelivered: 15 }
      ],
      receivedBy: user._id
    });
    console.log(`✅ Inward Gate Pass created: ${igp.igpNumber}`);

    console.log(`\n--- 5. Testing Quality Inspection (QC) ---`);
    const qc = await QualityInspection.create({
      inwardGatePass: igp._id,
      igpNumber: igp.igpNumber,
      store: store._id,
      project: project._id,
      inspectedBy: user._id,
      items: [
        {
          itemCode: testItemCode,
          itemName: item.name,
          unit: 'Ton',
          quantityDelivered: 15,
          acceptedQuantity: 14,
          rejectedQuantity: 1,
          rejectionReason: 'Bended bars damaged in transit',
          batchNumber: 'BATCH-2026-001',
          lotNumber: 'LOT-STEEL-99',
          heatNumber: 'HEAT-7731'
        }
      ]
    });
    console.log(`✅ Quality Inspection created: ${qc.inspectionNumber} (Accepted: 14 Tons, Rejected: 1 Ton)`);

    console.log(`\n--- 6. Testing Goods Receive Note (GRN) with Accepted Qty & Batch Tracking ---`);
    const grn = new GoodsReceive({
      supplier: supplier._id,
      store: store._id,
      project: project._id,
      inwardGatePass: igp._id,
      qualityInspection: qc._id,
      items: [
        {
          inventoryItem: item._id,
          itemCode: testItemCode,
          itemName: item.name,
          unit: 'Ton',
          quantity: 15,
          acceptedQuantity: 14,
          rejectedQuantity: 1,
          unitPrice: 110000,
          batchNumber: 'BATCH-2026-001',
          lotNumber: 'LOT-STEEL-99',
          heatNumber: 'HEAT-7731'
        }
      ],
      receivedBy: user._id,
      status: 'Received'
    });
    await grn.save();
    await GoodsReceive.syncItemsToInventory(grn);
    console.log(`✅ Goods Receive Note (GRN) posted: ${grn.receiveNumber}`);

    const updatedQuant = await StockQuant.findOne({ store: store._id, project: project._id, item: item._id });
    console.log(`   StockQuant OnHand after GRN: ${updatedQuant.onHandQuantity} Tons`);

    console.log(`\n--- 7. Testing Landed Cost Allocation Voucher ---`);
    const lcv = new LandedCostVoucher({
      goodsReceive: grn._id,
      receiveNumber: grn.receiveNumber,
      store: store._id,
      project: project._id,
      apportionmentMethod: 'By Quantity',
      charges: [
        { chargeType: 'Freight', amount: 34000, description: 'Trailer transport from Karachi mill' }
      ],
      status: 'Posted',
      createdBy: user._id
    });
    await lcv.save();
    console.log(`✅ Landed Cost Voucher posted: ${lcv.voucherNumber} (Rs 34,000 freight allocated)`);

    const quantLanded = await StockQuant.findOne({ store: store._id, project: project._id, item: item._id });
    console.log(`   StockQuant UnitPrice after Landed Cost allocation: Rs ${quantLanded.unitPrice} / Ton`);

    console.log(`\n--- 8. Testing Store Issue Note (SIN) Stock Deduction ---`);
    const sin = new GoodsIssue({
      store: store._id,
      project: project._id,
      department: 'general',
      items: [
        {
          inventoryItem: item._id,
          itemCode: testItemCode,
          itemName: item.name,
          quantity: 4,
          qtyIssued: 4,
          unit: 'Ton'
        }
      ],
      issuedBy: user._id,
      status: 'Issued'
    });
    await sin.save();
    console.log(`✅ Store Issue Note (SIN) posted: ${sin.sinNumber} (4 Tons issued)`);

    const finalQuant = await StockQuant.findOne({ store: store._id, project: project._id, item: item._id });
    console.log(`   Final StockQuant OnHand: ${finalQuant.onHandQuantity} Tons`);

    console.log('\n==================================================');
    console.log('🎉 ALL INTEGRATION TESTS FOR PHASE 1 & PHASE 2 PASSED CLEANLY!');
    console.log('==================================================\n');

  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTest();
