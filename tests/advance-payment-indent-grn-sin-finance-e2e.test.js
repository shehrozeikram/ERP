require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');

const BASE = process.env.E2E_API_URL || 'http://localhost:5001/api';
const GL = { INVENTORY: '1100', ADVANCE: '1110', AP: '2001', GRNI: '2100', COGS: '5000', CASH: '1001', BANK: '1002' };

function fail(msg, extra) {
  // eslint-disable-next-line no-console
  console.error(`✗ ${msg}`, extra || '');
  process.exit(1);
}
function ok(msg, extra) {
  // eslint-disable-next-line no-console
  console.log(`✓ ${msg}`, extra || '');
}
function lineNum(l) { return typeof l?.account === 'object' ? String(l.account.accountNumber || '') : ''; }
function balanced(e) {
  const t = (e.lines || []).reduce((s, l) => ({ dr: s.dr + (Number(l.debit) || 0), cr: s.cr + (Number(l.credit) || 0) }), { dr: 0, cr: 0 });
  return Math.abs(t.dr - t.cr) < 0.02;
}
async function journals(api, search) {
  const r = await api.get('/finance/journal-entries', { params: { limit: 40, module: 'procurement', search } });
  return r.data?.data?.entries || [];
}

async function run() {
  const api = axios.create({ baseURL: BASE, timeout: 120000, validateStatus: () => true });
  const login = await api.post('/auth/login', { email: 'ceo@sgc.com', password: 'ceo12345' });
  if (!login.data?.data?.token) fail('Login failed', login.data);
  api.defaults.headers.Authorization = `Bearer ${login.data.data.token}`;
  const userId = login.data.data.user?._id || login.data.data.user?.id;

  const ensure = await api.post('/finance/accounts/ensure-defaults');
  if (!ensure.data?.success) fail('ensure-defaults failed', ensure.data);
  const acc = ensure.data.data || [];
  const has = (n) => acc.find((a) => a.accountNumber === n)?._id;
  ['1100', '2001', '2100', '5000'].forEach((n) => { if (!has(n)) fail(`Missing account ${n}`); });
  ok('Accounts available: 1100/2001/2100/5000');

  const stamp = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0];
  const grnQty = 100; const sinQty = 10; const advanceAmt = 20000;

  const dep = (await api.get('/indents/departments')).data?.data?.[0];
  const venList = (await api.get('/procurement/vendors', { params: { limit: 20 } })).data?.data?.vendors || [];
  let ven = venList[0];
  if (!ven?._id) {
    const venCreate = await api.post('/procurement/vendors', {
      name: `E2E Vendor ${stamp}`,
      email: `e2e-vendor-${stamp}@example.com`,
      phone: '03001234567',
      address: 'E2E Address'
    });
    if (venCreate.data?.success) ven = venCreate.data.data;
  }
  let projects = (await api.get('/hr/projects', { params: { limit: 20, status: 'Active' } })).data?.data?.projects || [];
  if (!projects.length) projects = (await api.get('/hr/projects', { params: { limit: 20 } })).data?.data?.projects || [];
  let prj = projects[0];
  if (!prj?._id) {
    const prjCreate = await api.post('/hr/projects', { name: `E2E Project ${stamp}`, description: 'Auto-created for advance E2E' });
    if (prjCreate.data?.success) prj = prjCreate.data.data;
  }
  let stores = (await api.get('/stores', { params: { activeOnly: 'true' } })).data?.data || [];
  if (!stores.length) stores = (await api.get('/stores')).data?.data || [];
  const store = stores[0];
  if (!dep?._id || !ven?._id || !prj?._id || !store?._id) fail('Missing master data', { dep: !!dep?._id, ven: !!ven?._id, prj: !!prj?._id, store: !!store?._id });

  const cat = ((await api.get('/inventory-categories')).data?.data || [])[0];
  const invCreate = await api.post('/procurement/inventory', {
    name: `E2E ADV Item ${stamp}`, itemCode: `E2E-ADV-${stamp}`, category: 'Raw Materials', unit: 'bag',
    quantity: 0, unitPrice: 850, minQuantity: 0, maxQuantity: 999999, ...(cat ? { inventoryCategory: cat._id } : {})
  });
  if (!invCreate.data?.success) fail('Inventory create failed', invCreate.data);
  const invId = invCreate.data.data._id;
  await api.put(`/procurement/inventory/${invId}`, { inventoryAccount: has('1100'), grniAccount: has('2100'), cogsAccount: has('5000') });

  const indent = await api.post('/indents', {
    title: `E2E ADV ${stamp}`, description: 'Advance payment flow', department: dep._id, requiredDate: nextMonth,
    justification: 'e2e', priority: 'High', category: 'Raw Materials',
    items: [{ itemName: `E2E ADV Item ${stamp}`, description: 'x', brand: 'Lucky', quantity: grnQty, unit: 'bag', purpose: 'site', estimatedCost: 850 }]
  });
  if (!indent.data?.success) fail('Indent create failed', indent.data);
  const indentId = indent.data.data._id;
  await api.post(`/indents/${indentId}/submit`); await api.post(`/indents/${indentId}/approve`);
  await api.post(`/indents/${indentId}/move-to-procurement`, { reason: 'no stock' });

  const quote = await api.post('/procurement/quotations', {
    indent: indentId, vendor: ven._id, quotationDate: today, expiryDate: nextMonth, status: 'Received',
    items: [{ description: 'x', quantity: grnQty, unit: 'bag', unitPrice: 840, taxRate: 0, discount: 0 }]
  });
  if (!quote.data?.success) fail('Quotation create failed', quote.data);
  const quoteId = quote.data.data._id;
  await api.put(`/procurement/quotations/${quoteId}`, { status: 'Finalized' });
  const po = await api.post(`/procurement/quotations/${quoteId}/create-po`);
  if (!po.data?.success) fail('PO create failed', po.data);
  const poId = po.data.data._id;
  const poNo = po.data.data.orderNumber;
  await api.put(`/procurement/purchase-orders/${poId}/send-to-audit`, {});
  await api.put(`/procurement/purchase-orders/${poId}/audit-approve`, { approvalComments: 'ok' });
  await api.put(`/procurement/purchase-orders/${poId}/forward-to-ceo`, { comments: 'ok' });
  const ceoApprove = await api.put(`/procurement/purchase-orders/${poId}/ceo-approve`, { approvalComments: 'ok', digitalSignature: 'CEO' });
  if (!ceoApprove.data?.success) fail('CEO approve failed', ceoApprove.data);
  if (ceoApprove.data?.sentToFinance) await api.put(`/procurement/purchase-orders/${poId}/finance-approve`, { approvalComments: 'ok' });

  // Step 2: advance payment before GRN/bill adjustment
  const advRef = `E2E-ADV-${stamp}`;
  const adv = await api.post('/finance/accounts-payable/advance-payment', {
    vendorName: ven.name, vendorEmail: ven.email || '', vendorId: ven._id, amount: advanceAmt,
    paymentMethod: 'bank_transfer', reference: advRef, paymentDate: new Date().toISOString(), referenceType: 'purchase_order', referenceId: poId
  });
  if (!adv.data?.success) fail('Advance payment failed', adv.data);
  ok('Advance payment created', { reference: advRef, amount: advanceAmt });
  const advJ = await journals(api, advRef);
  const advPattern = advJ.some((e) => balanced(e) && (e.lines || []).some((l) => Number(l.debit) > 0 && lineNum(l) === GL.ADVANCE) && (e.lines || []).some((l) => Number(l.credit) > 0 && [GL.CASH, GL.BANK].includes(lineNum(l))));
  if (!advPattern) fail('Advance journal pattern mismatch', advJ.map((e) => e.entryNumber));
  ok('Advance JE: DR 1110 / CR 1001|1002');

  // Continue operational flow
  await api.put(`/procurement/purchase-orders/${poId}/send-to-store`, { comments: 'ok' });
  await api.post(`/procurement/store/po/${poId}/qa-check`, { status: 'Passed', remarks: 'ok' });
  const grn = await api.post('/procurement/goods-receive', {
    receiveDate: today, project: prj._id, store: store._id, supplier: ven._id, supplierName: ven.name,
    purchaseOrder: poId, poNumber: poNo, status: 'Complete',
    items: [{ inventoryItem: invId, quantity: grnQty, unitPrice: 840, itemName: `E2E ADV Item ${stamp}`, itemCode: `E2E-ADV-${stamp}`, unit: 'bag' }]
  });
  if (!grn.data?.success) fail('GRN failed', grn.data);
  const grnNo = grn.data.data.receiveNumber;

  // Wait stock ready
  for (let i = 0; i < 40; i += 1) {
    const b = await api.get('/procurement/stock-balance', { params: { project: prj._id, item: invId, storeId: store._id } });
    if ((Number(b.data?.data?.balance) || 0) >= sinQty) break;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 250));
  }
  const sin = await api.post('/procurement/goods-issue', {
    issueDate: new Date().toISOString(), project: prj._id, store: store._id, issuingLocation: store.name || 'Main Store',
    department: 'procurement', departmentName: 'Procurement', requestedBy: userId, requestedByName: 'E2E',
    purpose: 'E2E', notes: 'E2E',
    items: [{ inventoryItem: invId, qtyIssued: sinQty, quantity: sinQty, itemName: `E2E ADV Item ${stamp}`, itemCode: `E2E-ADV-${stamp}`, unit: 'bag' }]
  });
  if (!sin.data?.success) fail('SIN failed', sin.data);
  const sinNo = sin.data.data.issueNumber || sin.data.data.sinNumber;

  // Apply advance to AP bill
  const apList = await api.get('/finance/accounts-payable', { params: { search: poNo, limit: 20 } });
  const bills = apList.data?.data?.bills || [];
  const bill = bills.find((b) => String(b.billNumber || '').includes(poNo)) || bills[0];
  if (!bill?._id) fail('AP bill not found', apList.data);
  const apply = await api.post(`/finance/accounts-payable/${bill._id}/apply-advance`, { amount: advanceAmt });
  if (!apply.data?.success) fail('Apply advance failed', apply.data);
  ok('Advance applied to bill', apply.data.data);

  const afterApply = await api.get(`/finance/accounts-payable/${bill._id}`);
  const billAfter = afterApply.data?.data;
  const outstanding = Math.round(((billAfter.totalAmount || 0) - (billAfter.amountPaid || 0) - (billAfter.advanceApplied || 0)) * 100) / 100;
  if (!(billAfter.advanceApplied > 0 && outstanding >= 0)) fail('Bill advance not reflected', { advanceApplied: billAfter.advanceApplied, outstanding });

  // Pay remaining
  if (outstanding > 0.01) {
    const pay = await api.post(`/finance/accounts-payable/${bill._id}/payment`, {
      amount: outstanding, paymentMethod: 'bank_transfer', reference: `E2E-FINALPAY-${stamp}`, paymentDate: new Date().toISOString()
    });
    if (!pay.data?.success) fail('Final payment failed', pay.data);
  }
  const billEnd = (await api.get(`/finance/accounts-payable/${bill._id}`)).data?.data;
  const rem = Math.round(((billEnd.totalAmount || 0) - (billEnd.amountPaid || 0) - (billEnd.advanceApplied || 0)) * 100) / 100;
  if (Math.abs(rem) > 0.02) fail('Bill not fully settled', { remaining: rem, bill: billEnd.billNumber });
  ok('Bill fully settled with advance + payment');

  // Report health checks
  const asOf = new Date().toISOString().split('T')[0];
  const tb = await api.get('/finance/reports/trial-balance-v2', { params: { asOfDate: asOf } });
  const bs = await api.get('/finance/reports/balance-sheet', { params: { asOfDate: asOf } });
  const pl = await api.get('/finance/reports/profit-loss', { params: { fromDate: '2026-01-01', toDate: asOf } });
  const glGrn = await api.get('/finance/general-ledger', { params: { module: 'procurement', search: grnNo, limit: 10 } });
  const glSin = await api.get('/finance/general-ledger', { params: { module: 'procurement', search: sinNo, limit: 10 } });
  if (!tb.data?.data?.totals?.isBalanced) fail('Trial balance not balanced', tb.data?.data?.totals);
  if (!bs.data?.data?.totals?.isBalanced) fail('Balance sheet not balanced', bs.data?.data?.totals);
  if ((glGrn.data?.data?.pagination?.totalCount || 0) <= 0 || (glSin.data?.data?.pagination?.totalCount || 0) <= 0) fail('GL refs missing');
  if ((pl.data?.data?.expenses?.rows || []).length <= 0) fail('P&L has no expense rows');
  ok('TB/BS/GL/P&L checks OK');

  ok('Advance-payment full cycle E2E PASSED', { poNo, grnNo, sinNo, billNo: billEnd.billNumber, outstanding: rem });
}

run().catch((e) => fail(e.message, e.response?.data || e.stack));
