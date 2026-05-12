/**
 * Seeds a full procurement chain with payment terms "Full Advance" and stops when the PO
 * reaches Finance queue (status: Pending Finance). Does NOT record vendor advance or
 * finance-approve the PO.
 *
 * Flow implemented (matches current API / two-step audit / CEO Office):
 *   Indent → submit → approve → move to procurement → assign requisition (to bootstrap user)
 *   Quotation (Full Advance) → Shortlisted
 *   Comparative approvers (single user = bootstrap account) → submit → approve → quotations Finalized
 *   Create PO → link indent + quotation → send to audit
 *   Pre-audit initial approve → PUT /pre-audit/:poId/forward → Audit Director final approve → Send to CEO Office
 *   CEO Secretariat forward to CEO → CEO approve → Pending Finance
 *
 * Prerequisites:
 *   - API running (default http://localhost:5001/api)
 *   - E2E_EMAIL / E2E_PASSWORD — bootstrap user (indent + procurement through CEO); must have needed roles
 *   - Local/demo single-user path: set E2E_BYPASS_INDENT_APPROVAL=true in .env, restart API with NODE_ENV≠production.
 *     Server then allows submit with no HoD + self-approve (real rules unchanged in production).
 *   - Otherwise: E2E_INDENT_APPROVER_EMAIL / E2E_INDENT_APPROVER_PASSWORD — a different active user as sole HoD
 *     (submit + POST /indents/:id/approve as that user).
 *   - Vendor: must exist in Procurement (default name AJAB KHAN BROTHERS). Override with E2E_SEED_VENDOR_NAME.
 *
 * Run from project root:
 *   node server/scripts/seed-full-advance-po-pending-finance.js
 *
 * Writes server/scripts/last-full-advance-demo.json for cleanup (see clear-full-advance-demo.js).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE = process.env.E2E_API_URL || 'http://localhost:5001/api';
const EMAIL = process.env.E2E_EMAIL || 'ceo@sgc.com';
const PASSWORD = process.env.E2E_PASSWORD || 'ceo12345';
const INDENT_APPROVER_EMAIL = process.env.E2E_INDENT_APPROVER_EMAIL || '';
const INDENT_APPROVER_PASSWORD = process.env.E2E_INDENT_APPROVER_PASSWORD || '';
const SEED_VENDOR_NAME = (process.env.E2E_SEED_VENDOR_NAME || 'AJAB KHAN BROTHERS').trim();

const STATE_FILE = path.join(__dirname, 'last-full-advance-demo.json');

function isIndentE2EBypassEnv() {
  const v = process.env.E2E_BYPASS_INDENT_APPROVAL;
  return v === '1' || String(v).toLowerCase() === 'true';
}

function fail(msg, extra) {
  console.error(`✗ ${msg}`, extra != null ? extra : '');
  process.exit(1);
}
function ok(msg, extra) {
  console.log(`✓ ${msg}`, extra != null ? extra : '');
}

async function loginClient(email, password) {
  const client = axios.create({ baseURL: BASE, timeout: 120000, validateStatus: () => true });
  const res = await client.post('/auth/login', { email, password });
  if (!res.data?.data?.token) {
    fail(`Login failed for ${email}`, res.data);
  }
  client.defaults.headers.common.Authorization = `Bearer ${res.data.data.token}`;
  const userId = res.data.data.user?._id || res.data.data.user?.id;
  if (!userId) fail('Login response missing user id', res.data);
  return { client, userId };
}

async function main() {
  const indentBypass = isIndentE2EBypassEnv();

  if (!indentBypass && (!INDENT_APPROVER_EMAIL || !INDENT_APPROVER_PASSWORD)) {
    fail(
      'Either set E2E_BYPASS_INDENT_APPROVAL=true (and restart API with NODE_ENV≠production) for single-user demo,\n' +
        '  or set E2E_INDENT_APPROVER_EMAIL / E2E_INDENT_APPROVER_PASSWORD to a different HoD user.'
    );
  }

  const { client: api, userId } = await loginClient(EMAIL, PASSWORD);
  ok(`Logged in as ${EMAIL}${indentBypass ? ' (E2E indent bypass)' : ''}`);

  let apiApprover = api;
  let approverUserId = userId;
  if (!indentBypass) {
    const logged = await loginClient(INDENT_APPROVER_EMAIL, INDENT_APPROVER_PASSWORD);
    apiApprover = logged.client;
    approverUserId = logged.userId;
    ok(`Logged in as indent approver ${INDENT_APPROVER_EMAIL}`);
    if (String(approverUserId) === String(userId)) {
      fail('E2E_INDENT_APPROVER_EMAIL must be a different user than E2E_EMAIL (unless E2E_BYPASS_INDENT_APPROVAL is on).');
    }
  }

  const stamp = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0];
  const qty = 50;
  const unitPrice = 1000;
  const title = `FA-DEMO-${stamp}`;

  const dep = (await api.get('/indents/departments')).data?.data?.[0];
  const venSearch = await api.get('/procurement/vendors', {
    params: { search: SEED_VENDOR_NAME, limit: 50, page: 1 }
  });
  const venList = venSearch.data?.data?.vendors || [];
  const needle = SEED_VENDOR_NAME.toLowerCase();
  const ven =
    venList.find((v) => String(v.name || '').toLowerCase().includes(needle)) || venList[0];
  if (!ven?._id) {
    fail(
      `Vendor not found matching "${SEED_VENDOR_NAME}". Add it under Procurement → Vendors or set E2E_SEED_VENDOR_NAME.`,
      venSearch.data
    );
  }
  ok('Vendor', `${ven.name} (${ven._id})`);
  if (!dep?._id) fail('Need at least one department', { dep: !!dep?._id });

  ok('Creating indent…');
  const indentPayload = {
    title,
    description: 'Full advance demo — stop at Pending Finance',
    department: dep._id,
    requiredDate: nextMonth,
    justification: 'seed-full-advance-po-pending-finance',
    priority: 'High',
    category: 'Raw Materials',
    items: [
      {
        itemName: `FA-DEMO Item ${stamp}`,
        description: 'Demo line',
        brand: 'Demo',
        quantity: qty,
        unit: 'unit',
        purpose: 'site',
        estimatedCost: unitPrice
      }
    ]
  };
  if (!indentBypass) {
    indentPayload.draftApproverIds = [approverUserId];
  }
  const indentRes = await api.post('/indents', indentPayload);
  if (!indentRes.data?.success) fail('Indent create failed', indentRes.data);
  const indentId = indentRes.data.data._id;
  ok(indentBypass ? 'Indent created' : 'Indent created (draft HoD approver set)', indentId);

  const subm = await api.post(`/indents/${indentId}/submit`, {});
  if (!subm.data?.success) fail('Indent submit failed', subm.data);
  ok('Indent submitted');

  const appr = await apiApprover.post(`/indents/${indentId}/approve`, {});
  if (!appr.data?.success) {
    fail(
      indentBypass
        ? 'Indent approve failed — is the API running with E2E_BYPASS_INDENT_APPROVAL=true and NODE_ENV≠production?'
        : 'Indent approve failed (is the approver user allowed to approve?)',
      appr.data
    );
  }
  ok(indentBypass ? 'Indent approved (E2E bypass)' : 'Indent approved by HoD');

  const move = await api.post(`/indents/${indentId}/move-to-procurement`, { reason: 'no stock' });
  if (!move.data?.success) fail('Move to procurement failed', move.data);
  ok('Indent in procurement');

  const assignRes = await api.put(`/procurement/requisitions/${indentId}/assign`, {
    assigneeId: userId,
    note: 'seed-full-advance-po-pending-finance'
  });
  if (!assignRes.data?.success) {
    fail(
      'Assign requisition failed (need super_admin / admin / procurement_manager or assignment permission)',
      assignRes.data
    );
  }
  ok('Requisition assigned (required before quotations)');

  ok('Creating quotation (Full Advance)…');
  const quoteRes = await api.post('/procurement/quotations', {
    indent: indentId,
    vendor: ven._id,
    quotationDate: today,
    expiryDate: nextMonth,
    status: 'Received',
    paymentTerms: 'Full Advance',
    items: [
      {
        description: `FA-DEMO Item ${stamp}`,
        quantity: qty,
        unit: 'unit',
        unitPrice,
        taxRate: 0,
        discount: 0
      }
    ]
  });
  if (!quoteRes.data?.success) fail('Quotation create failed', quoteRes.data);
  const quoteId = quoteRes.data.data._id;
  ok('Quotation created', quoteId);

  const qShort = await api.put(`/procurement/quotations/${quoteId}`, {
    status: 'Shortlisted',
    paymentTerms: 'Full Advance'
  });
  if (!qShort.data?.success) fail('Quotation Shortlisted update failed', qShort.data);
  ok('Quotation Shortlisted + Full Advance');

  const cap = await api.put(`/procurement/requisitions/${indentId}/comparative-approvers`, {
    approverIds: [userId]
  });
  if (!cap.data?.success) fail('Configure comparative approvers failed', cap.data);
  const sub = await api.post(`/procurement/requisitions/${indentId}/comparative-submit`, {});
  if (!sub.data?.success) fail('Comparative submit failed', sub.data);
  const apr = await api.post(`/procurement/requisitions/${indentId}/comparative-approve`, {});
  if (!apr.data?.success) fail('Comparative approve failed', apr.data);
  if (apr.data?.data?.comparativeApproval?.status !== 'approved') {
    fail('Comparative statement not fully approved', apr.data?.data?.comparativeApproval);
  }
  ok('Comparative statement approved (quotations should be Finalized)');

  const poRes = await api.post(`/procurement/quotations/${quoteId}/create-po`);
  if (!poRes.data?.success) fail('Create PO failed', poRes.data);
  const poId = poRes.data.data._id;
  const poNo = poRes.data.data.orderNumber || poRes.data.data.poNumber;
  ok('PO created', { poId, poNo });

  const link = await api.put(`/procurement/purchase-orders/${poId}`, {
    indent: indentId,
    quotation: quoteId
  });
  if (!link.data?.success) fail('Link indent/quotation on PO failed', link.data);
  ok('PO linked to indent + quotation');

  const sta = await api.put(`/procurement/purchase-orders/${poId}/send-to-audit`, {});
  if (!sta.data?.success) fail('Send to audit failed', sta.data);
  ok('PO → Pending Audit');

  const a1 = await api.put(`/procurement/purchase-orders/${poId}/audit-approve`, { approvalComments: 'initial pre-audit ok' });
  if (!a1.data?.success) fail('Initial audit approve failed', a1.data);
  ok('Initial pre-audit recorded');

  const fwdDir = await api.put(`/pre-audit/${poId}/forward`, { forwardComments: 'Forward to Audit Director' });
  if (!fwdDir.data?.success) fail('Forward to Audit Director failed', fwdDir.data);
  ok('PO → Forwarded to Audit Director');

  const a2 = await api.put(`/procurement/purchase-orders/${poId}/audit-approve`, { approvalComments: 'director final ok' });
  if (!a2.data?.success) fail('Final audit approve failed', a2.data);
  ok('PO → Send to CEO Office');

  const fceo = await api.put(`/procurement/purchase-orders/${poId}/forward-to-ceo`, { comments: 'CEO Secretariat → CEO' });
  if (!fceo.data?.success) fail('Forward to CEO failed', fceo.data);
  ok('PO → Forwarded to CEO');

  const ceo = await api.put(`/procurement/purchase-orders/${poId}/ceo-approve`, {
    approvalComments: 'CEO approved (Full Advance → Finance)',
    digitalSignature: 'CEO'
  });
  if (!ceo.data?.success) fail('CEO approve failed', ceo.data);
  if (!ceo.data?.sentToFinance) fail('Expected sentToFinance true for Full Advance', ceo.data);
  const poAfter = ceo.data.data;
  if (poAfter.status !== 'Pending Finance') {
    fail(`Expected PO status Pending Finance, got ${poAfter.status}`);
  }

  ok('PO is Pending Finance — continue in Finance (vendor advance / auto-approve per your process)', {
    orderNumber: poNo,
    paymentTerms: poAfter.paymentTerms,
    status: poAfter.status
  });

  const state = {
    createdAt: new Date().toISOString(),
    apiBase: BASE,
    loginEmail: EMAIL,
    stamp,
    title,
    indentId,
    quotationId: quoteId,
    purchaseOrderId: poId,
    vendorId: ven._id,
    orderNumber: poNo
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  console.log(`\nSaved demo IDs → ${STATE_FILE}`);
  console.log('Cleanup: npm run demo:clear-full-advance   (or node server/scripts/clear-full-advance-demo.js)\n');
}

main().catch((e) => fail(e.message, e.response?.data || e.stack));
