/**
 * E2E: Procurement Vendor Billing with multi-GRN allocations
 * Covers:
 *  1) Partial billing for one GRN
 *  2) Single bill containing more than one GRN
 *  3) Full payment of all created bills
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');

const BASE = process.env.E2E_API_URL || 'http://localhost:5001/api';
const state = {};

function die(msg, extra) {
  console.error('✗', msg, extra || '');
  process.exit(1);
}
function ok(msg, extra) {
  console.log('✓', msg, extra || '');
}

async function login() {
  const res = await axios.post(`${BASE}/auth/login`, { email: 'ceo@sgc.com', password: 'ceo12345' });
  const token = res.data?.data?.token;
  if (!token) die('Login failed');
  return axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${token}` } });
}

async function firstOrCreate(api, url, createPayload, listPath, key) {
  const res = await api.get(url, { params: { limit: 20 } });
  const arr = listPath(res.data) || [];
  if (arr.length > 0) return arr[0];
  const c = await api.post(url, createPayload);
  return key ? c.data?.data?.[key] || c.data?.data : c.data?.data;
}

async function main() {
  const api = await login();

  // Accounts just to ensure finance settings exist
  const accRes = await api.get('/finance/accounts', { params: { limit: 5000 } });
  const accs = accRes.data?.data?.accounts || accRes.data?.data || [];
  const pick = (n) => accs.find((a) => a.accountNumber === n);
  const inventoryAcc = pick('1200') || pick('1100');
  const grniAcc = pick('2140') || pick('2100');
  const cogsAcc = pick('5000');
  if (!inventoryAcc || !grniAcc || !cogsAcc) die('Required accounts missing');

  const vendor = await firstOrCreate(
    api,
    '/procurement/vendors',
    { name: `E2E Vendor ${Date.now()}`, contactPerson: 'E2E', email: `e2e_${Date.now()}@mail.com`, phone: '03001234567', address: { street: 'X', city: 'Y', country: 'PK' } },
    (d) => d?.data?.vendors,
    'vendor'
  );
  const projectRes = await api.get('/hr/projects', { params: { limit: 1000, status: 'Active' } });
  let project = (projectRes.data?.data?.projects || [])[0];
  if (!project) {
    const anyProjectRes = await api.get('/hr/projects', { params: { limit: 1000 } });
    project = (anyProjectRes.data?.data?.projects || anyProjectRes.data?.data || [])[0];
  }
  if (!project) die('No project found');
  const storesRes = await api.get('/stores', { params: { limit: 100, type: 'main', isActive: true } });
  const mainStore = (storesRes.data?.data || storesRes.data?.stores || [])[0];
  if (!mainStore) die('No active main store');

  const stamp = Date.now();
  const itemName = `E2E-BILL-MULTI-${stamp}`;
  const invCreate = await api.post('/procurement/inventory', {
    name: itemName,
    category: 'Raw Materials',
    unit: 'bag',
    quantity: 0,
    unitPrice: 100,
    project: project._id,
    inventoryAccount: inventoryAcc._id,
    grniAccount: grniAcc._id,
    cogsAccount: cogsAcc._id
  });
  const inv = invCreate.data?.data;
  if (!inv?._id) die('Inventory create failed');
  ok('Inventory created', inv.itemCode);

  // Indent -> quotation -> PO flow
  const today = new Date().toISOString();
  const nextMonth = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  const deptRes = await api.get('/indents/departments');
  const departments = deptRes.data?.data || [];
  const departmentId = departments[0]?._id;
  if (!departmentId) die('No department found for indent');
  const indent = (await api.post('/indents', {
    title: `E2E Bill Multi ${stamp}`,
    description: 'E2E',
    department: departmentId,
    requiredDate: nextMonth,
    justification: 'E2E procurement test',
    priority: 'Medium',
    category: 'Raw Materials',
    items: [{ itemName, description: itemName, brand: 'E2E', quantity: 100, unit: 'bag', purpose: 'E2E', estimatedCost: 100 }]
  })).data?.data;
  await api.post(`/indents/${indent._id}/submit`);
  await api.post(`/indents/${indent._id}/approve`);
  await api.post(`/indents/${indent._id}/move-to-procurement`, { reason: 'E2E' });

  const quotation = (await api.post('/procurement/quotations', {
    indent: indent._id,
    vendor: vendor._id,
    quotationDate: today,
    expiryDate: nextMonth,
    status: 'Received',
    validityDays: 30,
    deliveryTime: '7 days',
    paymentTerms: 'Net 30',
    items: [{ description: itemName, quantity: 100, unit: 'bag', unitPrice: 100, taxRate: 0, discount: 0 }]
  })).data?.data;
  await api.put(`/procurement/quotations/${quotation._id}`, { status: 'Finalized' });
  const po = (await api.post(`/procurement/quotations/${quotation._id}/create-po`)).data?.data;
  await api.put(`/procurement/purchase-orders/${po._id}/send-to-audit`, {});
  await api.put(`/procurement/purchase-orders/${po._id}/audit-approve`, { approvalComments: 'E2E' });
  await api.put(`/procurement/purchase-orders/${po._id}/forward-to-ceo`, { comments: 'E2E' });
  const ceo = await api.put(`/procurement/purchase-orders/${po._id}/ceo-approve`, { approvalComments: 'E2E', digitalSignature: 'E2E' });
  if (ceo.data?.sentToFinance) await api.put(`/procurement/purchase-orders/${po._id}/finance-approve`, { approvalComments: 'E2E' });
  await api.put(`/procurement/purchase-orders/${po._id}/send-to-store`, { comments: 'E2E' });
  await api.post(`/procurement/store/po/${po._id}/qa-check`, { status: 'Passed', remarks: 'E2E' });

  // Create two GRNs against same PO/vendor
  const grn1 = (await api.post('/procurement/goods-receive', {
    receiveDate: today, project: project._id, store: mainStore._id, supplier: vendor._id, supplierName: vendor.name,
    purchaseOrder: po._id, poNumber: po.orderNumber, status: 'Partial',
    items: [{ inventoryItem: inv._id, quantity: 60, unitPrice: 100, itemName, itemCode: inv.itemCode, unit: 'bag' }]
  })).data?.data;
  const grn2 = (await api.post('/procurement/goods-receive', {
    receiveDate: today, project: project._id, store: mainStore._id, supplier: vendor._id, supplierName: vendor.name,
    purchaseOrder: po._id, poNumber: po.orderNumber, status: 'Complete',
    items: [{ inventoryItem: inv._id, quantity: 40, unitPrice: 100, itemName, itemCode: inv.itemCode, unit: 'bag' }]
  })).data?.data;
  ok('Two GRNs created', `${grn1.receiveNumber}, ${grn2.receiveNumber}`);

  const list1 = await api.get('/procurement/vendor-bills/billable-grns', { params: { vendorId: vendor._id } });
  const grnRows1 = list1.data?.data?.grns || [];
  const row1 = grnRows1.find((g) => String(g._id) === String(grn1._id));
  const row2 = grnRows1.find((g) => String(g._id) === String(grn2._id));
  if (!row1 || !row2) die('Billable GRNs missing initial rows', grnRows1);
  ok('Billable GRNs found for vendor');

  // Bill #1: partial amount for GRN1 only (3000 of 6000)
  const b1 = await api.post('/procurement/vendor-bills', {
    vendorId: vendor._id,
    grnAllocations: [{ grnId: grn1._id, amount: 3000 }],
    billDate: today,
    paymentTerms: 'net_30',
    vendorInvoiceNumber: `INV-P1-${stamp}`
  });
  if (b1.status !== 201 || !b1.data?.success) die('Partial bill create failed', b1.data);
  ok('Partial bill created', b1.data?.data?.billNumber);

  const list2 = await api.get('/procurement/vendor-bills/billable-grns', { params: { vendorId: vendor._id } });
  const grnRows2 = list2.data?.data?.grns || [];
  const row1After = grnRows2.find((g) => String(g._id) === String(grn1._id));
  if (!row1After || Math.abs((row1After.remainingAmount || 0) - 3000) > 0.02) {
    die('Remaining amount not updated after partial billing', row1After);
  }
  ok('Partial billing remaining validated', row1After.remainingAmount);

  // Bill #2: combine remaining of GRN1 + full GRN2
  const b2 = await api.post('/procurement/vendor-bills', {
    vendorId: vendor._id,
    grnAllocations: [
      { grnId: grn1._id, amount: 3000 },
      { grnId: grn2._id, amount: 4000 }
    ],
    billDate: today,
    paymentTerms: 'net_30',
    vendorInvoiceNumber: `INV-MULTI-${stamp}`
  });
  if (b2.status !== 201 || !b2.data?.success) die('Multi-GRN bill create failed', b2.data);
  ok('Multi-GRN bill created', b2.data?.data?.billNumber);

  const list3 = await api.get('/procurement/vendor-bills/billable-grns', { params: { vendorId: vendor._id } });
  const grnRows3 = list3.data?.data?.grns || [];
  if (grnRows3.find((g) => String(g._id) === String(grn1._id) || String(g._id) === String(grn2._id))) {
    die('Fully billed GRNs still shown as billable', grnRows3);
  }
  ok('Fully billed GRNs no longer billable');

  // Pay both bills fully (including one advanced GRN allocation payment)
  const apList = await api.get('/finance/accounts-payable', { params: { limit: 100, search: vendor.name } });
  const bills = apList.data?.data?.bills || [];
  const ourBills = bills.filter((b) => String(b.vendor?.vendorId || '') === String(vendor._id));
  if (ourBills.length < 2) die('Expected at least two AP bills for vendor', ourBills);

  const multiGrnBill = ourBills.find((b) => Array.isArray(b.linkedGRNs) && b.linkedGRNs.length > 1);
  if (multiGrnBill) {
    const outstandingMulti = Number(multiGrnBill.totalAmount || 0) - Number(multiGrnBill.amountPaid || 0) - Number(multiGrnBill.advanceApplied || 0);
    const allocs = (multiGrnBill.linkedGRNs || []).map((g) => ({ grnId: g.grnId, amount: Number(g.amount || 0) })).filter((a) => a.grnId && a.amount > 0);
    const allocSum = allocs.reduce((s, a) => s + a.amount, 0);
    if (Math.abs(allocSum - outstandingMulti) > 0.02) die('Advanced allocation sum mismatch', { allocSum, outstandingMulti, allocs });
    const payAlloc = await api.post(`/finance/accounts-payable/${multiGrnBill._id}/payment`, {
      amount: outstandingMulti,
      paymentMethod: 'bank_transfer',
      reference: `PAY-ALLOC-${multiGrnBill.billNumber}`,
      paymentDate: today,
      allocations: allocs
    });
    if (!payAlloc.data?.success) die('Advanced GRN allocation payment failed', payAlloc.data);
    ok('Advanced GRN allocation payment passed', multiGrnBill.billNumber);
  }

  for (const b of ourBills) {
    const latest = await api.get(`/finance/accounts-payable/${b._id}`);
    const billNow = latest.data?.data || b;
    const outstanding = Number(billNow.totalAmount || 0) - Number(billNow.amountPaid || 0) - Number(billNow.advanceApplied || 0);
    if (outstanding > 0.009) {
      const pay = await api.post(`/finance/accounts-payable/${b._id}/payment`, {
        amount: outstanding,
        paymentMethod: 'bank_transfer',
        reference: `PAY-${b.billNumber}`,
        paymentDate: today
      });
      if (!pay.data?.success) die('Bill payment failed', pay.data);
    }
  }
  ok('All AP bills paid');

  const apListAfter = await api.get('/finance/accounts-payable', { params: { limit: 100, search: vendor.name } });
  const afterBills = (apListAfter.data?.data?.bills || []).filter((b) => String(b.vendor?.vendorId || '') === String(vendor._id));
  const remaining = afterBills.reduce((s, b) => s + (Number(b.totalAmount || 0) - Number(b.amountPaid || 0) - Number(b.advanceApplied || 0)), 0);
  if (Math.abs(remaining) > 0.02) die('Outstanding remains after paying all bills', { remaining, bills: afterBills.map((b) => ({ billNumber: b.billNumber, total: b.totalAmount, paid: b.amountPaid })) });
  ok('Final outstanding is zero for all vendor bills');

  console.log('\n✅ PROCUREMENT VENDOR BILLING MULTI-GRN FLOW: PASS\n');
}

main().catch((e) => {
  console.error(e.response?.data || e.message || e);
  process.exit(1);
});

