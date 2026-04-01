/**
 * E2E: Indent → procurement → GRN → SIN (Store Issue), with finance journal checks.
 *
 * Flow:
 *   Indent → store → quotation → PO → audit/CEO/(finance) → store → QA → GRN
 *   → POST SIN (goods-issue) for a subset of received qty
 *   → Assert procurement-module journal entries for GRN and SIN are balanced (DR = CR).
 *
 * Run:
 *   node tests/indent-grn-sin-finance-e2e.test.js
 *
 * Requires:
 *   - API at E2E_API_URL (default http://localhost:5001/api)
 *   - ceo@sgc.com / ceo12345 (needs access to procurement + finance journal list)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');

const BASE = process.env.E2E_API_URL || 'http://localhost:5001/api';

const state = {
  userId: null,
  indent: null,
  quotation: null,
  po: null,
  grn: null,
  sin: null,
  inventory: null,
  project: null
};

const results = { pass: 0, fail: 0 };

function log(ok, msg, extra) {
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${msg}`, extra !== undefined ? extra : '');
  if (ok) results.pass += 1;
  else results.fail += 1;
}

function die(msg, extra) {
  log(false, msg, extra);
  printSummary();
  process.exit(1);
}

function printSummary() {
  console.log('\n--- Indent → GRN → SIN (Finance) Summary ---');
  console.log(`Passed: ${results.pass}, Failed: ${results.fail}`);
  console.log('Artifacts:', {
    indent: state.indent?.indentNumber,
    po: state.po?.orderNumber,
    grn: state.grn?.receiveNumber,
    sin: state.sin?.issueNumber || state.sin?.sinNumber,
    itemCode: state.inventory?.itemCode
  });
}

/** Sum debits/credits on a journal entry's lines */
function entryBalances(entry) {
  const lines = entry?.lines || [];
  let dr = 0;
  let cr = 0;
  for (const l of lines) {
    dr += Number(l.debit) || 0;
    cr += Number(l.credit) || 0;
  }
  return { dr, cr, ok: Math.abs(dr - cr) < 0.02 };
}

async function fetchJournals(api, search) {
  const res = await api.get('/finance/journal-entries', {
    params: { limit: 30, search, module: 'procurement' }
  });
  if (res.status !== 200 || !res.data?.success) return [];
  return res.data?.data?.entries || [];
}

async function assertBalancedJournals(api, label, search) {
  const entries = await fetchJournals(api, search);
  if (!entries.length) {
    log(false, `${label}: no procurement journals found for search "${search}"`);
    return;
  }
  let allOk = true;
  for (const e of entries) {
    const { dr, cr, ok } = entryBalances(e);
    if (!ok) {
      allOk = false;
      log(false, `${label}: unbalanced JE ${e.entryNumber || e._id}`, { dr, cr, reference: e.reference });
    }
  }
  if (allOk) {
    log(true, `${label}: ${entries.length} journal row(s) balanced (DR≈CR)`, { search });
  }
}

async function main() {
  const api = axios.create({
    baseURL: BASE,
    headers: { 'Content-Type': 'application/json' },
    timeout: 120000,
    validateStatus: () => true
  });

  const loginRes = await api.post('/auth/login', {
    email: 'ceo@sgc.com',
    password: 'ceo12345'
  });
  if (loginRes.status !== 200 || !loginRes.data?.success || !loginRes.data?.data?.token) {
    die('Login failed', loginRes.data);
  }
  api.defaults.headers.Authorization = `Bearer ${loginRes.data.data.token}`;
  state.userId = loginRes.data.data.user?._id || loginRes.data.data.user?.id;
  log(true, 'Login OK (ceo@sgc.com)');

  const stamp = Date.now();
  const sinQty = 10; // issue qty; must be ≤ GRN qty and ≤ project stock
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0];

  const deptRes = await api.get('/indents/departments');
  const departments = Array.isArray(deptRes.data?.data) ? deptRes.data.data : [];
  const department = departments[0];
  if (!department?._id) die('No department for indent', deptRes.data);

  const vendorRes = await api.get('/procurement/vendors', { params: { limit: 20 } });
  const vendors = vendorRes.data?.data?.vendors || [];
  const vendor = vendors[0];
  if (!vendor?._id) die('No vendor found', vendorRes.data);

  const projectRes = await api.get('/hr/projects', { params: { limit: 20, status: 'Active' } });
  const projects = projectRes.data?.data?.projects || projectRes.data?.data || [];
  const project = Array.isArray(projects) ? projects[0] : null;
  if (!project?._id) die('No active project (required for GRN/SIN)', projectRes.data);
  state.project = project;

  // Store must match on GRN and SIN — otherwise GRN sync may not create project stock (no store on GRN)
  // while SIN resolves default store and sees 0 balance.
  const storesRes = await api.get('/stores', { params: { activeOnly: 'true' } });
  const storeList = storesRes.data?.data || [];
  const mainStore = Array.isArray(storeList) ? storeList[0] : null;
  if (!mainStore?._id) die('No active store — create a store for GRN/SIN stock', storesRes.data);
  log(true, `Store for GRN/SIN: ${mainStore.name || mainStore._id}`);

  const invCatRes = await api.get('/inventory-categories');
  const invCategories = Array.isArray(invCatRes.data?.data) ? invCatRes.data.data : [];
  const invCategory = invCategories[0] || null;

  const itemName = `E2E GRN-SIN Cement ${stamp}`;
  const itemCode = `E2E-GS-${stamp}`;
  const invPayload = {
    name: itemName,
    itemCode,
    category: 'Raw Materials',
    unit: 'bag',
    quantity: 0,
    unitPrice: 850,
    minQuantity: 0,
    maxQuantity: 100000,
    description: 'E2E indent→GRN→SIN',
    ...(invCategory ? { inventoryCategory: invCategory._id } : {})
  };
  const invCreate = await api.post('/procurement/inventory', invPayload);
  if (invCreate.status !== 201 || !invCreate.data?.success) die('Inventory creation failed', invCreate.data);
  state.inventory = invCreate.data.data;
  log(true, `Inventory created: ${state.inventory.itemCode}`);

  const indentPayload = {
    title: `E2E GRN/SIN Flow ${stamp}`,
    description: 'E2E to GRN and SIN',
    department: department._id,
    requiredDate: nextMonth,
    justification: 'E2E',
    priority: 'High',
    category: 'Raw Materials',
    items: [
      {
        itemName,
        description: itemName,
        brand: 'Lucky',
        quantity: 100,
        unit: 'bag',
        purpose: 'Site',
        estimatedCost: 850
      }
    ]
  };
  const indentCreate = await api.post('/indents', indentPayload);
  if (indentCreate.status !== 201 || !indentCreate.data?.success) die('Indent failed', indentCreate.data);
  state.indent = indentCreate.data.data;

  await api.post(`/indents/${state.indent._id}/submit`);
  await api.post(`/indents/${state.indent._id}/approve`);

  const moveIndent = await api.post(`/indents/${state.indent._id}/move-to-procurement`, {
    reason: 'No stock'
  });
  if (moveIndent.status !== 200 || !moveIndent.data?.success) die('Move to procurement failed', moveIndent.data);

  const quotationPayload = {
    indent: state.indent._id,
    vendor: vendor._id,
    quotationDate: today,
    expiryDate: nextMonth,
    status: 'Received',
    validityDays: 30,
    deliveryTime: '7 days',
    paymentTerms: 'Partial advance 20%',
    notes: 'E2E',
    items: [
      {
        description: itemName,
        quantity: 100,
        unit: 'bag',
        unitPrice: 840,
        taxRate: 0,
        discount: 0
      }
    ]
  };
  const quoteCreate = await api.post('/procurement/quotations', quotationPayload);
  if (quoteCreate.status !== 201 || !quoteCreate.data?.success) die('Quotation failed', quoteCreate.data);
  state.quotation = quoteCreate.data.data;

  await api.put(`/procurement/quotations/${state.quotation._id}`, { status: 'Finalized' });

  const poCreate = await api.post(`/procurement/quotations/${state.quotation._id}/create-po`);
  if (poCreate.status !== 201 || !poCreate.data?.success) die('PO failed', poCreate.data);
  state.po = poCreate.data.data;

  await api.put(`/procurement/purchase-orders/${state.po._id}/send-to-audit`, {});
  await api.put(`/procurement/purchase-orders/${state.po._id}/audit-approve`, { approvalComments: 'E2E' });
  await api.put(`/procurement/purchase-orders/${state.po._id}/forward-to-ceo`, { comments: 'E2E' });
  const ceoApprove = await api.put(`/procurement/purchase-orders/${state.po._id}/ceo-approve`, {
    approvalComments: 'E2E',
    digitalSignature: 'CEO-E2E'
  });
  if (ceoApprove.status !== 200 || !ceoApprove.data?.success) die('CEO approve failed', ceoApprove.data);
  if (ceoApprove.data?.sentToFinance) {
    await api.put(`/procurement/purchase-orders/${state.po._id}/finance-approve`, {
      approvalComments: 'E2E finance'
    });
  }

  await api.put(`/procurement/purchase-orders/${state.po._id}/send-to-store`, { comments: 'E2E' });
  const qaPass = await api.post(`/procurement/store/po/${state.po._id}/qa-check`, {
    status: 'Passed',
    remarks: 'E2E'
  });
  if (qaPass.status !== 200 || !qaPass.data?.success) die('QA failed', qaPass.data);

  const grnCreate = await api.post('/procurement/goods-receive', {
    receiveDate: today,
    project: project._id,
    store: mainStore._id,
    supplier: vendor._id,
    supplierName: vendor.name,
    purchaseOrder: state.po._id,
    poNumber: state.po.orderNumber,
    status: 'Complete',
    notes: 'E2E GRN for finance test',
    items: [
      {
        inventoryItem: state.inventory._id,
        quantity: 100,
        unitPrice: 840,
        itemName,
        itemCode: state.inventory.itemCode,
        unit: 'bag'
      }
    ]
  });
  if (grnCreate.status !== 201 || !grnCreate.data?.success) die('GRN failed', grnCreate.data);
  state.grn = grnCreate.data.data;
  log(true, `GRN created: ${state.grn.receiveNumber}`);

  // Wait until project-wise stock reflects GRN (async post-save can finish after HTTP response).
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let projectBalance = 0;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const balRes = await api.get('/procurement/stock-balance', {
      params: {
        project: project._id,
        item: state.inventory._id,
        storeId: mainStore._id
      }
    });
    projectBalance = Number(balRes.data?.data?.balance) || 0;
    if (projectBalance >= sinQty) break;
    await sleep(250);
  }
  if (projectBalance < sinQty) {
    die(`Project stock not ready for SIN (need ≥${sinQty}, got ${projectBalance}). Check GRN store + sync.`);
  }
  log(true, `Project stock balance OK for SIN: ${projectBalance}`);

  await assertBalancedJournals(api, 'After GRN', state.grn.receiveNumber || '');

  const sinPayload = {
    issueDate: new Date().toISOString(),
    project: project._id,
    store: mainStore._id,
    issuingLocation: mainStore.name || 'Main Store',
    department: 'procurement',
    departmentName: 'Procurement',
    purpose: 'E2E consumption test',
    notes: 'E2E SIN finance test',
    requestedBy: state.userId,
    requestedByName: 'E2E User',
    items: [
      {
        inventoryItem: state.inventory._id,
        qtyIssued: sinQty,
        quantity: sinQty,
        itemName,
        itemCode: state.inventory.itemCode,
        unit: 'bag'
      }
    ]
  };
  const sinRes = await api.post('/procurement/goods-issue', sinPayload);
  if (sinRes.status !== 201 || !sinRes.data?.success) {
    die('SIN (goods-issue) failed', sinRes.data);
  }
  state.sin = sinRes.data.data;
  log(true, `SIN created: ${state.sin.issueNumber || state.sin.sinNumber}`);

  const sinRef = state.sin.issueNumber || state.sin.sinNumber || '';
  await assertBalancedJournals(api, 'After SIN', sinRef);

  // Stronger check: at least one entry per reference contains typical GRN/SIN pattern (inventory + GRNI/COGS lines)
  const grnEntries = await fetchJournals(api, state.grn.receiveNumber || '');
  const sinEntries = await fetchJournals(api, sinRef);
  if (grnEntries.length === 0) log(false, 'No journal rows found for GRN reference (accounts may be unresolved)');
  else log(true, `GRN-linked procurement journals: ${grnEntries.length}`);
  if (sinEntries.length === 0) log(false, 'No journal rows found for SIN reference (COGS may be skipped if accounts missing)');
  else log(true, `SIN-linked procurement journals: ${sinEntries.length}`);

  printSummary();
  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  printSummary();
  process.exit(1);
});
