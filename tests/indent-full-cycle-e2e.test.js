/**
 * Full E2E: Indent -> Store stock check -> Procurement -> Audit -> CEO -> Finance
 * -> Store (QA + GRN) -> Post-GRN Audit -> Sent to Finance -> AP Bill -> AP Payment.
 *
 * Run:
 *   node tests/indent-full-cycle-e2e.test.js
 *
 * Requires:
 *   - API running at E2E_API_URL (or default http://localhost:5001/api)
 *   - Credentials: ceo@sgc.com / ceo12345
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');

const BASE = process.env.E2E_API_URL || 'http://localhost:5001/api';

const state = {
  indent: null,
  quotation: null,
  po: null,
  grn: null,
  bill: null,
  payment: null
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
  console.log('\n--- Full Indent Cycle Summary ---');
  console.log(`Passed: ${results.pass}, Failed: ${results.fail}`);
  console.log('Artifacts:', {
    indentNumber: state.indent?.indentNumber,
    quotationNumber: state.quotation?.quotationNumber,
    poNumber: state.po?.orderNumber,
    grnNumber: state.grn?.receiveNumber,
    billNumber: state.bill?.billNumber,
    paymentRef: state.payment?.reference
  });
}

async function main() {
  const api = axios.create({
    baseURL: BASE,
    headers: { 'Content-Type': 'application/json' },
    timeout: 120000,
    validateStatus: () => true
  });

  // 1) Login
  const loginRes = await api.post('/auth/login', {
    email: 'ceo@sgc.com',
    password: 'ceo12345'
  });
  if (loginRes.status !== 200 || !loginRes.data?.success || !loginRes.data?.data?.token) {
    die('Login failed', loginRes.data);
  }
  api.defaults.headers.Authorization = `Bearer ${loginRes.data.data.token}`;
  log(true, 'Login OK (ceo@sgc.com)');

  const stamp = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0];

  // 2) Lookup master data
  const deptRes = await api.get('/indents/departments');
  const departments = Array.isArray(deptRes.data?.data) ? deptRes.data.data : [];
  const department = departments[0];
  if (!department?._id) die('No department found for indent', deptRes.data);
  log(true, `Department selected: ${department.name || department.code || department._id}`);

  const vendorRes = await api.get('/procurement/vendors', { params: { limit: 20 } });
  const vendors = vendorRes.data?.data?.vendors || [];
  const vendor = vendors[0];
  if (!vendor?._id) die('No vendor found (create one first)', vendorRes.data);
  log(true, `Vendor selected: ${vendor.name}`);

  const projectRes = await api.get('/hr/projects', { params: { limit: 20, status: 'Active' } });
  const projects = projectRes.data?.data?.projects || projectRes.data?.data || [];
  const project = Array.isArray(projects) ? projects[0] : null;
  if (!project?._id) die('No active project found (required for GRN)', projectRes.data);
  log(true, `Project selected: ${project.name || project.projectId || project._id}`);

  const invCatRes = await api.get('/inventory-categories');
  const invCategories = Array.isArray(invCatRes.data?.data) ? invCatRes.data.data : [];
  const invCategory = invCategories[0] || null;
  log(true, `Finance category ${invCategory ? 'selected' : 'not selected'} (fallback allowed)`, invCategory?.name);

  // 3) Create inventory item (qty 0 so store routes indent to procurement)
  const itemName = `E2E OPC Cement 50kg ${stamp}`;
  const itemCode = `E2E-CEM-${stamp}`;
  const invPayload = {
    name: itemName,
    itemCode,
    category: 'Raw Materials',
    unit: 'bag',
    quantity: 0,
    unitPrice: 850,
    minQuantity: 0,
    maxQuantity: 100000,
    description: 'E2E item for full indent cycle',
    ...(invCategory ? { inventoryCategory: invCategory._id } : {})
  };
  const invCreate = await api.post('/procurement/inventory', invPayload);
  if (invCreate.status !== 201 || !invCreate.data?.success) {
    die('Inventory creation failed', invCreate.data);
  }
  const inv = invCreate.data.data;
  log(true, `Inventory item created: ${inv.itemCode}`);

  // 4) Create indent
  const indentPayload = {
    title: `E2E Full Cycle Cement ${stamp}`,
    description: 'Indent for full procurement-store-audit-ceo-finance flow',
    department: department._id,
    requiredDate: nextMonth,
    justification: 'Testing full cycle automation end-to-end',
    priority: 'High',
    category: 'Raw Materials',
    items: [
      {
        itemName,
        description: itemName,
        brand: 'Lucky',
        quantity: 100,
        unit: 'bag',
        purpose: 'Site work',
        estimatedCost: 850
      }
    ]
  };
  const indentCreate = await api.post('/indents', indentPayload);
  if (indentCreate.status !== 201 || !indentCreate.data?.success) {
    die('Indent creation failed', indentCreate.data);
  }
  state.indent = indentCreate.data.data;
  log(true, `Indent created: ${state.indent.indentNumber}`);

  // 5) Submit + approve indent
  const submitIndent = await api.post(`/indents/${state.indent._id}/submit`);
  if (submitIndent.status !== 200 || !submitIndent.data?.success) {
    die('Indent submit failed', submitIndent.data);
  }
  log(true, 'Indent submitted');

  const approveIndent = await api.post(`/indents/${state.indent._id}/approve`);
  if (approveIndent.status !== 200 || !approveIndent.data?.success) {
    die('Indent approve failed', approveIndent.data);
  }
  log(true, 'Indent approved (pending store check)');

  // 6) Store stock-check route -> move to procurement
  const pendingIndents = await api.get('/procurement/store/pending-indents');
  if (!pendingIndents.data?.success) {
    die('Fetch pending indents failed', pendingIndents.data);
  }
  const inPending = (pendingIndents.data.data || []).find((i) => i._id === state.indent._id);
  if (!inPending) {
    die('Approved indent not found in store pending-indents list');
  }
  log(true, 'Indent visible in Store pending list');

  const moveIndent = await api.post(`/indents/${state.indent._id}/move-to-procurement`, {
    reason: 'No stock available in store for requested quantity'
  });
  if (moveIndent.status !== 200 || !moveIndent.data?.success) {
    die('Move indent to procurement failed', moveIndent.data);
  }
  log(true, 'Indent moved to Procurement Requisitions');

  // 7) Create quotation for this indent
  const quotationPayload = {
    indent: state.indent._id,
    vendor: vendor._id,
    quotationDate: today,
    expiryDate: nextMonth,
    status: 'Received',
    validityDays: 30,
    deliveryTime: '7 days',
    paymentTerms: 'Partial advance 20%',
    notes: 'E2E quotation',
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
  if (quoteCreate.status !== 201 || !quoteCreate.data?.success) {
    die('Quotation creation failed', quoteCreate.data);
  }
  state.quotation = quoteCreate.data.data;
  log(true, `Quotation created: ${state.quotation.quotationNumber}`);

  const quoteFinalize = await api.put(`/procurement/quotations/${state.quotation._id}`, {
    status: 'Finalized'
  });
  if (quoteFinalize.status !== 200 || !quoteFinalize.data?.success) {
    die('Quotation finalize failed', quoteFinalize.data);
  }
  log(true, 'Quotation finalized');

  // 8) Create PO from quotation
  const poCreate = await api.post(`/procurement/quotations/${state.quotation._id}/create-po`);
  if (poCreate.status !== 201 || !poCreate.data?.success) {
    die('Create PO from quotation failed', poCreate.data);
  }
  state.po = poCreate.data.data;
  log(true, `PO created from quotation: ${state.po.orderNumber}`);

  // 9) Pre-GRN audit + CEO + finance approval
  const sendToAudit = await api.put(`/procurement/purchase-orders/${state.po._id}/send-to-audit`, {});
  if (sendToAudit.status !== 200 || !sendToAudit.data?.success) {
    die('Send PO to audit failed', sendToAudit.data);
  }
  log(true, 'PO sent to Audit (Pending Audit)');

  const auditApprove = await api.put(`/procurement/purchase-orders/${state.po._id}/audit-approve`, {
    approvalComments: 'E2E audit approved'
  });
  if (auditApprove.status !== 200 || !auditApprove.data?.success) {
    die('Audit approve failed', auditApprove.data);
  }
  log(true, 'Audit approved PO (Send to CEO Office)');

  const forwardToCEO = await api.put(`/procurement/purchase-orders/${state.po._id}/forward-to-ceo`, {
    comments: 'E2E forward to CEO'
  });
  if (forwardToCEO.status !== 200 || !forwardToCEO.data?.success) {
    die('Forward to CEO failed', forwardToCEO.data);
  }
  log(true, 'PO forwarded to CEO');

  const ceoApprove = await api.put(`/procurement/purchase-orders/${state.po._id}/ceo-approve`, {
    approvalComments: 'E2E CEO approved',
    digitalSignature: 'CEO-E2E'
  });
  if (ceoApprove.status !== 200 || !ceoApprove.data?.success) {
    die('CEO approve failed', ceoApprove.data);
  }
  log(true, 'CEO approved PO', { sentToFinance: !!ceoApprove.data?.sentToFinance });

  // If payment terms triggered Pending Finance, finish via finance-approve.
  if (ceoApprove.data?.sentToFinance) {
    const finApprove = await api.put(`/procurement/purchase-orders/${state.po._id}/finance-approve`, {
      approvalComments: 'E2E finance approved'
    });
    if (finApprove.status !== 200 || !finApprove.data?.success) {
      die('Finance approve failed after CEO sent to finance', finApprove.data);
    }
    log(true, 'Finance approved PO (status Approved)');
  }

  // 10) Store flow: send to store -> QA pass -> GRN
  const sendToStore = await api.put(`/procurement/purchase-orders/${state.po._id}/send-to-store`, {
    comments: 'E2E send to store'
  });
  if (sendToStore.status !== 200 || !sendToStore.data?.success) {
    die('Send PO to Store failed', sendToStore.data);
  }
  log(true, 'PO sent to Store');

  const qaPass = await api.post(`/procurement/store/po/${state.po._id}/qa-check`, {
    status: 'Passed',
    remarks: 'E2E QA passed'
  });
  if (qaPass.status !== 200 || !qaPass.data?.success) {
    die('QA pass failed', qaPass.data);
  }
  log(true, 'Store QA passed');

  const grnCreate = await api.post('/procurement/goods-receive', {
    receiveDate: today,
    project: project._id,
    supplier: vendor._id,
    supplierName: vendor.name,
    purchaseOrder: state.po._id,
    poNumber: state.po.orderNumber,
    status: 'Complete',
    notes: 'E2E full cycle GRN',
    items: [
      {
        inventoryItem: inv._id,
        quantity: 100,
        unitPrice: 840,
        itemName,
        itemCode: inv.itemCode,
        unit: 'bag'
      }
    ]
  });
  if (grnCreate.status !== 201 || !grnCreate.data?.success) {
    die('Create GRN failed', grnCreate.data);
  }
  state.grn = grnCreate.data.data;
  log(true, `GRN created: ${state.grn.receiveNumber}`);

  // 11) Post-GRN governance and finance billing.
  // Some environments go through:
  //   GRN Created -> Sent to Procurement -> Sent to Audit -> Sent to Finance -> Bill from PO
  // Others may not expose that exact transition after GRN, so we fallback to:
  //   Bill directly from GRN.
  let billedVia = 'po';
  const sendPoToProcurement = await api.post(`/procurement/store/po/${state.po._id}/send-to-procurement`);
  if (sendPoToProcurement.status === 200 && sendPoToProcurement.data?.success) {
    log(true, 'PO with GRN sent to Procurement');

    const sendPostGrnAudit = await api.post(`/procurement/store/po/${state.po._id}/send-to-audit`, {
      comments: 'E2E post-GRN audit request'
    });
    if (sendPostGrnAudit.status !== 200 || !sendPostGrnAudit.data?.success) {
      die('Send PO to post-GRN Audit failed', sendPostGrnAudit.data);
    }
    log(true, 'PO sent to post-GRN Audit');

    const sendToFinance = await api.post(`/procurement/store/po/${state.po._id}/send-to-finance`, {
      comments: 'E2E audit reviewed, sent to finance'
    });
    if (sendToFinance.status !== 200 || !sendToFinance.data?.success) {
      die('Send PO from Audit to Finance failed', sendToFinance.data);
    }
    log(true, 'PO sent to Finance for billing');

    const billCreate = await api.post('/finance/accounts-payable/create-from-po', {
      purchaseOrderId: state.po._id,
      billNumber: `E2E-BILL-${state.po.orderNumber}-${stamp}`
    });
    if (billCreate.status !== 201 || !billCreate.data?.success) {
      die('Create AP bill from PO failed', billCreate.data);
    }
    state.bill = billCreate.data.data;
    log(true, `AP bill created from PO: ${state.bill.billNumber}`);
  } else {
    billedVia = 'grn';
    log(true, 'PO post-GRN transition not available here; using GRN -> Bill flow', sendPoToProcurement.data?.message);
    const billFromGrn = await api.post(`/finance/grn/${state.grn._id}/create-bill`, {
      notes: 'E2E fallback billing from GRN',
      vendorInvoiceNumber: `E2E-INV-${stamp}`
    });
    if (billFromGrn.status !== 201 || !billFromGrn.data?.success) {
      die('Create AP bill from GRN failed', billFromGrn.data);
    }
    state.bill = billFromGrn.data?.data?.bill || billFromGrn.data?.data;
    log(true, `AP bill created from GRN: ${state.bill.billNumber}`);
  }

  const amount = Number(state.bill.totalAmount || 0);
  if (!(amount > 0)) {
    die('AP bill amount is invalid', state.bill);
  }

  const paymentRef = `E2E-PAY-${stamp}`;
  const billPay = await api.post(`/finance/accounts-payable/${state.bill._id}/payment`, {
    amount,
    paymentMethod: 'bank_transfer',
    reference: paymentRef,
    paymentDate: new Date().toISOString(),
    whtRate: 0
  });
  if (billPay.status !== 200 || !billPay.data?.success) {
    die('AP payment failed', billPay.data);
  }
  state.payment = { reference: paymentRef, amount };
  log(true, `AP payment recorded (${billedVia.toUpperCase()} billing path)`, {
    status: billPay.data.data?.status,
    amountPaid: billPay.data.data?.amountPaid
  });

  // 13) Sanity checks in finance journals
  const jeForGrn = await api.get('/finance/journal-entries', {
    params: { limit: 50, search: state.grn.receiveNumber, module: 'procurement' }
  });
  const grnEntries = jeForGrn.data?.data?.entries || [];
  if (grnEntries.length > 0) {
    log(true, 'Finance journals include GRN-linked activity', { count: grnEntries.length });
  } else {
    log(false, 'Could not find GRN-linked journal entries', jeForGrn.data);
  }

  const jeForBill = await api.get('/finance/journal-entries', {
    params: { limit: 50, search: state.bill.billNumber, module: 'procurement' }
  });
  const billEntries = jeForBill.data?.data?.entries || [];
  if (billEntries.length > 0) {
    log(true, 'Finance journals include bill/payment activity', { count: billEntries.length });
  } else {
    log(false, 'Could not find bill/payment journal entries', jeForBill.data);
  }

  printSummary();
  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  printSummary();
  process.exit(1);
});

