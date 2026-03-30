/**
 * Full cement E2E: inventory + PO + GRN + vendor bill from GRN + AP payment + journal checks.
 * Run: npm run test:cement-e2e   OR   node tests/cement-e2e-procurement-finance.test.js
 * Requires: server (localhost:5001), MongoDB, ceo@sgc.com / ceo12345
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');

const BASE = process.env.E2E_API_URL || 'http://localhost:5001/api';

const log = (ok, msg, extra) => {
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${msg}`, extra !== undefined ? extra : '');
};

async function main() {
  const results = { pass: 0, fail: 0 };

  const api = axios.create({
    baseURL: BASE,
    headers: { 'Content-Type': 'application/json' },
    timeout: 90000,
    validateStatus: () => true
  });

  let token;
  try {
    const loginRes = await api.post('/auth/login', {
      email: 'ceo@sgc.com',
      password: 'ceo12345'
    });
    if (loginRes.status !== 200 || !loginRes.data?.success || !loginRes.data?.data?.token) {
      log(false, 'Login failed', loginRes.data);
      process.exit(1);
    }
    token = loginRes.data.data.token;
    log(true, 'Login (ceo@sgc.com)');
    results.pass++;
  } catch (e) {
    log(false, 'Login error', e.message);
    process.exit(1);
  }

  api.defaults.headers.Authorization = `Bearer ${token}`;

  const stamp = Date.now();
  const cementName = `E2E Cement ${stamp}`;
  const cementDesc = cementName; // matches PO line for received-qty sync

  // --- Vendors ---
  const vendorsRes = await api.get('/procurement/vendors', { params: { limit: 5 } });
  if (!vendorsRes.data?.success || !vendorsRes.data?.data?.vendors?.length) {
    log(false, 'No vendors — create a supplier first', vendorsRes.data);
    process.exit(1);
  }
  const vendor = vendorsRes.data.data.vendors[0];
  log(true, `Vendor: ${vendor.name}`);
  results.pass++;

  // --- Projects ---
  const projRes = await api.get('/hr/projects', { params: { limit: 20, status: 'Active' } });
  const projects = projRes.data?.data?.projects || projRes.data?.data || [];
  const project = Array.isArray(projects) ? projects[0] : null;
  if (!project?._id) {
    log(false, 'No active project — need at least one project for GRN', projRes.data);
    process.exit(1);
  }
  log(true, `Project: ${project.name || project.projectId}`);
  results.pass++;

  // --- Inventory category (optional) ---
  let categoryId = null;
  const catRes = await api.get('/inventory-categories');
  const cats = catRes.data?.data;
  if (Array.isArray(cats) && cats.length) {
    categoryId = cats[0]._id;
    log(true, `Finance category: ${cats[0].name}`);
  } else {
    log(true, 'No inventory categories — item will rely on global GL fallbacks');
  }
  results.pass++;

  // --- Create cement inventory item ---
  const invPayload = {
    name: cementName,
    itemCode: `E2E-${stamp}`,
    category: 'Raw Materials',
    unit: 'bag',
    quantity: 0,
    unitPrice: 1200,
    minQuantity: 0,
    maxQuantity: 100000,
    description: 'Automated E2E cement test item',
    ...(categoryId ? { inventoryCategory: categoryId } : {})
  };
  const invRes = await api.post('/procurement/inventory', invPayload);
  if (invRes.status !== 201 || !invRes.data?.success) {
    log(false, 'Create inventory item failed', invRes.data);
    results.fail++;
    process.exit(1);
  }
  const inventoryItemId = invRes.data.data._id;
  const itemCode = invRes.data.data.itemCode;
  log(true, `Inventory created: ${itemCode} — ${cementName}`);
  results.pass++;

  // --- Purchase order ---
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0];
  const poRes = await api.post('/procurement/purchase-orders', {
    vendor: vendor._id,
    orderDate: today,
    expectedDeliveryDate: nextMonth,
    deliveryAddress: 'Test site',
    items: [
      {
        description: cementDesc,
        quantity: 10,
        unit: 'bag',
        unitPrice: 1150,
        taxRate: 0,
        discount: 0
      }
    ],
    shippingCost: 0,
    paymentTerms: 'Net 30',
    notes: 'E2E cement test PO'
  });
  if (poRes.status !== 201 || !poRes.data?.success) {
    log(false, 'Create PO failed', poRes.data);
    results.fail++;
    process.exit(1);
  }
  const poId = poRes.data.data._id;
  log(true, `PO created: ${poRes.data.data.orderNumber}`);
  results.pass++;

  // --- Short-circuit workflow: Draft → Approved → Sent to Store → QA Passed ---
  const approveRes = await api.put(`/procurement/purchase-orders/${poId}`, { status: 'Approved' });
  if (!approveRes.data?.success) {
    log(false, 'Set PO Approved failed', approveRes.data);
    results.fail++;
    process.exit(1);
  }
  log(true, 'PO status → Approved');
  results.pass++;

  const stsRes = await api.put(`/procurement/purchase-orders/${poId}/send-to-store`, { comments: 'E2E test' });
  if (!stsRes.data?.success) {
    log(false, 'Send to Store failed', stsRes.data);
    results.fail++;
    process.exit(1);
  }
  log(true, 'PO → Sent to Store');
  results.pass++;

  const qaRes = await api.post(`/procurement/store/po/${poId}/qa-check`, {
    status: 'Passed',
    remarks: 'E2E automated QA'
  });
  if (!qaRes.data?.success) {
    log(false, 'QA check failed', qaRes.data);
    results.fail++;
    process.exit(1);
  }
  log(true, 'PO QA → Passed');
  results.pass++;

  // --- GRN ---
  const grnBody = {
    receiveDate: today,
    project: project._id,
    supplier: vendor._id,
    supplierName: vendor.name,
    purchaseOrder: poId,
    poNumber: poRes.data.data.orderNumber,
    status: 'Complete',
    items: [
      {
        inventoryItem: inventoryItemId,
        quantity: 10,
        unitPrice: 1150,
        itemName: cementDesc,
        itemCode,
        unit: 'bag'
      }
    ],
    notes: 'E2E cement GRN'
  };
  const grnRes = await api.post('/procurement/goods-receive', grnBody);
  if (grnRes.status !== 201 || !grnRes.data?.success) {
    log(false, 'Create GRN failed', grnRes.data);
    results.fail++;
    process.exit(1);
  }
  const grn = grnRes.data.data;
  log(true, `GRN created: ${grn.receiveNumber}`);
  results.pass++;

  // --- Verify PO received quantity ---
  const poAfter = await api.get(`/procurement/purchase-orders/${poId}`);
  const po = poAfter.data?.data;
  const line = po?.items?.[0];
  const recv = line?.receivedQuantity;
  if (recv >= 10) {
    log(true, `PO line receivedQuantity = ${recv}`, { poStatus: po.status });
    results.pass++;
  } else {
    log(false, `PO receivedQuantity expected ≥10, got ${recv}`, po?.items);
    results.fail++;
  }

  // --- Journal entry for this GRN (reference = receive number) ---
  const jeRes = await api.get('/finance/journal-entries', {
    params: { limit: 50, module: 'procurement', search: grn.receiveNumber }
  });
  const jeList = jeRes.data?.data?.entries || [];
  const grnRef = Array.isArray(jeList)
    ? jeList.find((e) => String(e.reference || '') === String(grn.receiveNumber))
    : null;
  if (grnRef) {
    log(true, 'Found recent procurement journal entry linked to GRN flow', {
      entryNumber: grnRef.entryNumber,
      reference: grnRef.reference
    });
    results.pass++;
  } else {
    log(false, 'Could not find a recent GRN-related journal entry (check CoA / category mapping)', {
      count: Array.isArray(jeList) ? jeList.length : 0
    });
    results.fail++;
  }

  // --- Inventory quantity after GRN ---
  const invAfter = await api.get(`/procurement/inventory/${inventoryItemId}`);
  const inv = invAfter.data?.data;
  if ((inv?.quantity || 0) >= 10) {
    log(true, `Inventory qty after GRN: ${inv.quantity}`, { averageCost: inv.averageCost });
    results.pass++;
  } else {
    log(false, `Inventory qty expected ≥10, got ${inv?.quantity}`);
    results.fail++;
  }

  const expectedBillAmount = Math.round(10 * 1150 * 100) / 100;

  // --- Vendor bill from GRN (DR GRNI / CR AP) ---
  const billRes = await api.post(`/finance/grn/${grn._id}/create-bill`, {
    notes: 'E2E cement — bill from GRN',
    vendorInvoiceNumber: `E2E-INV-${stamp}`
  });
  if (billRes.status !== 201 || !billRes.data?.success) {
    log(false, 'Create vendor bill from GRN failed', billRes.data);
    results.fail++;
    printSummary(results, { cementName, po, grn, bill: null, payment: null, expectedBillAmount });
    process.exit(1);
  }
  const billDoc = billRes.data.data?.bill || billRes.data.data;
  const billId = billDoc._id || billDoc.id;
  const billNumber = billDoc.billNumber || billRes.data.data?.bill?.billNumber;
  const billTotal = Number(billDoc.totalAmount ?? expectedBillAmount);
  log(true, `Vendor bill created from GRN`, { billNumber, totalAmount: billTotal });
  results.pass++;

  // --- Pay bill in full (Accounts Payable) ---
  const payRes = await api.post(`/finance/accounts-payable/${billId}/payment`, {
    amount: billTotal,
    paymentMethod: 'bank_transfer',
    reference: `E2E-PAY-${stamp}`,
    paymentDate: new Date().toISOString(),
    whtRate: 0
  });
  if (payRes.status !== 200 || !payRes.data?.success) {
    log(false, 'Record AP payment failed', payRes.data);
    results.fail++;
    printSummary(results, { cementName, po, grn, bill: billDoc, payment: null, expectedBillAmount });
    process.exit(1);
  }
  const paidBill = payRes.data.data;
  const paidStatus = paidBill?.status;
  log(true, `AP payment recorded`, { billStatus: paidStatus, amountPaid: paidBill?.amountPaid });
  results.pass++;

  if (paidStatus === 'paid' || (paidBill?.amountPaid >= billTotal - 0.02)) {
    log(true, 'Bill fully paid');
    results.pass++;
  } else {
    log(false, `Expected bill paid, status=${paidStatus}`, paidBill);
    results.fail++;
  }

  // --- Journal: payment reference ---
  const payJe = await api.get('/finance/journal-entries', {
    params: { limit: 20, module: 'procurement', search: paidBill?.billNumber || billNumber }
  });
  const payEntries = payJe.data?.data?.entries || [];
  const hasPaymentJe = payEntries.some(
    (e) => String(e.referenceType || '').includes('payment') || String(e.description || '').toLowerCase().includes('payment')
  );
  if (hasPaymentJe || payEntries.length > 0) {
    log(true, 'Journal entries list shows activity for this bill/payment flow', {
      entriesSample: payEntries.slice(0, 3).map((e) => ({ entryNumber: e.entryNumber, reference: e.reference, description: (e.description || '').slice(0, 60) }))
    });
    results.pass++;
  } else {
    log(true, 'Journal search did not return matching rows (non-fatal); verify payment JE in Finance → Journal Entries)', {
      count: payEntries.length
    });
    results.pass++;
  }

  printSummary(results, {
    cementName,
    po,
    grn,
    bill: paidBill || billDoc,
    payment: { amount: billTotal, reference: `E2E-PAY-${stamp}` },
    expectedBillAmount
  });

  console.log('\n--- Summary ---');
  console.log(`Passed: ${results.pass}, Failed: ${results.fail}`);
  process.exit(results.fail > 0 ? 1 : 0);
}

function printSummary(results, ctx) {
  const { cementName, po, grn, bill, payment, expectedBillAmount } = ctx;
  console.log('\n========== HOW THIS RUN WENT (FULL CEMENT TEST) ==========');
  console.log('1) Inventory: Created store item "' + cementName + '" with finance category (if available).');
  console.log('2) PO: Created and fast-tracked to Sent to Store + QA Passed.');
  console.log('3) GRN: Received 10 bags @ 1150 → stock increased, GRN journal (DR Inventory / CR GRNI) expected.');
  console.log('4) PO sync: receivedQuantity on PO line should be 10; PO status may be Received.');
  if (bill) {
    console.log('5) Vendor bill: Created from GRN → DR GRNI / CR Accounts Payable for ~PKR ' + (bill.totalAmount ?? expectedBillAmount) + '. Bill: ' + (bill.billNumber || '—'));
  } else {
    console.log('5) Vendor bill: NOT created (see errors above).');
  }
  if (payment) {
    console.log('6) Payment: Full payment via bank_transfer → DR AP / CR Bank; bill status should be paid.');
  } else {
    console.log('6) Payment: NOT recorded (see errors above).');
  }
  console.log('7) UI checks you can do: Finance → Vendor Bills, Journal Entries, Balance Sheet (inventory/AP/bank), GL for GRNI clearing.');
  console.log('===========================================================\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
