/**
 * PRODUCTION TEST: Bulk CAM Invoice Creation — Properties srNo 1046 to 1055
 *
 * What this test does:
 *   1. Authenticate against the PRODUCTION API (https://api.tovus.net).
 *   2. Search the CAM overview for properties whose srNo is in [1046..1055].
 *   3. For each property found, fetch its existing invoices and compute the
 *      expected carry-forward arrears (balance of most-recent previous unpaid
 *      CAM invoice, sorted by periodTo DESC) — exactly what the fixed
 *      calculateOverdueArrears will use.
 *   4. Call POST /api/taj-utilities/invoices/bulk-create-cam-invoices for
 *      those properties.
 *   5. Report per-property:
 *        • created / skipped / failed
 *        • actual arrears on the created invoice vs. expected
 *        • PASS / FAIL verdict per property
 *   6. Final overall PASS / FAIL.
 *
 * Usage:
 *   TEST_EMAIL=developer@tovus.net TEST_PASS=shehroze@tovus \
 *     node server/tests/test-production-cam-srno-1046-1055.js
 */

'use strict';

const https = require('https');
const http  = require('http');
const path  = require('path');

// ─── helpers ────────────────────────────────────────────────────────────────

function request(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib     = isHttps ? https : http;
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method,
      // Allow self-signed / IP-only certs on production droplet
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }),
        ...(token  && { Authorization: `Bearer ${token}` })
      }
    };

    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

const PASS = '\x1b[32m✓ PASS\x1b[0m';
const FAIL = '\x1b[31m✗ FAIL\x1b[0m';
const WARN = '\x1b[33m⚠ WARN\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

let totalPassed = 0;
let totalFailed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ${PASS}  ${label}`);
    totalPassed++;
    return true;
  }
  console.log(`  ${FAIL}  ${label}${detail ? '  →  ' + detail : ''}`);
  totalFailed++;
  return false;
}

// ─── config ─────────────────────────────────────────────────────────────────

try {
  const fs = require('fs');
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
  }
} catch { /* ignore */ }

const BASE_URL   = (process.env.BASE_URL   || 'https://api.tovus.net').replace(/\/$/, '');
const API        = `${BASE_URL}/api`;
const TEST_EMAIL = process.env.TEST_EMAIL || '';
const TEST_PASS  = process.env.TEST_PASS  || '';

// Target srNo range (overridable via env vars)
const SR_FROM = parseInt(process.env.SR_FROM || '1046', 10);
const SR_TO   = parseInt(process.env.SR_TO   || '1055', 10);

// Period = current month
const NOW         = new Date();
const PERIOD_FROM = new Date(NOW.getFullYear(), NOW.getMonth(), 1);
const PERIOD_TO   = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0);
const DUE_DATE    = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 15);

// ─── main ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(` PRODUCTION TEST: Bulk CAM Invoices — Properties srNo ${SR_FROM}–${SR_TO}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log(`${INFO}  Server   : ${BASE_URL}`);
  console.log(`${INFO}  Target   : srNo ${SR_FROM} – ${SR_TO}`);
  console.log(`${INFO}  Period   : ${PERIOD_FROM.toDateString()} → ${PERIOD_TO.toDateString()}`);
  console.log(`${INFO}  Due Date : ${DUE_DATE.toDateString()}\n`);

  // ── Step 1: authenticate ──────────────────────────────────────────────────
  console.log('── STEP 1: Authenticate ─────────────────────────────────────────');
  if (!TEST_EMAIL || !TEST_PASS) {
    console.log(`  ${FAIL}  Set TEST_EMAIL and TEST_PASS env vars.\n`);
    process.exit(1);
  }

  const loginRes = await request('POST', `${API}/auth/login`, {
    email: TEST_EMAIL, password: TEST_PASS
  });
  const token = loginRes.body?.token || loginRes.body?.data?.token;
  if (!assert('Login succeeds (HTTP 200)', loginRes.status === 200 && !!token, `HTTP ${loginRes.status}`)) {
    process.exit(1);
  }
  console.log(`  ${INFO}  Authenticated as ${TEST_EMAIL}\n`);

  // ── Step 2: find the target properties by srNo ────────────────────────────
  // We search across pages (max 500 per page) until we've collected all 10.
  console.log(`── STEP 2: Find Properties srNo ${SR_FROM}–${SR_TO} ─────────────────────────`);

  let targetProperties = [];
  let page = 1;
  const pageSize = 100; // fetch in large chunks to minimize round trips

  console.log(`  ${INFO}  Scanning CAM overview pages (limit ${pageSize} per page)…`);

  while (true) {
    const r = await request('GET',
      `${API}/taj-utilities/cam-charges/current-overview?page=${page}&limit=${pageSize}`,
      null, token);

    if (r.status !== 200 || !r.body?.success) {
      console.log(`  ${FAIL}  Overview page ${page} failed: HTTP ${r.status}`);
      totalFailed++;
      break;
    }

    const props      = r.body.data?.properties || [];
    const pagination = r.body.data?.pagination  || {};

    // Collect properties whose srNo falls in [SR_FROM, SR_TO]
    const found = props.filter(p => p.srNo >= SR_FROM && p.srNo <= SR_TO);
    targetProperties.push(...found);

    process.stdout.write(`\r  ${INFO}  Page ${page}/${pagination.totalPages} — collected ${targetProperties.length} target properties so far…`);

    // Stop if we already have all 10 or if this is the last page
    if (targetProperties.length >= (SR_TO - SR_FROM + 1) || page >= (pagination.totalPages || 1)) break;
    page++;
  }
  console.log(''); // newline after \r

  // Deduplicate (shouldn't be needed but just in case) and sort by srNo
  const seen = new Set();
  targetProperties = targetProperties.filter(p => {
    if (seen.has(String(p._id))) return false;
    seen.add(String(p._id));
    return true;
  }).sort((a, b) => a.srNo - b.srNo);

  if (!assert(
    `Found ${targetProperties.length} properties with srNo ${SR_FROM}–${SR_TO}`,
    targetProperties.length > 0,
    'No matching properties — check DB or srNo range'
  )) { process.exit(1); }

  console.log(`\n  srNo  │ Property ID               │ Owner                     │ CAM Amt  │ Total Arrears (accum.) │ Pay Status`);
  console.log(`  ──────┼───────────────────────────┼───────────────────────────┼──────────┼────────────────────────┼──────────`);
  targetProperties.forEach(p => {
    console.log(
      `  ${String(p.srNo).padStart(4)}  │ ${String(p._id).padEnd(24)} │ ${String(p.ownerName||'—').slice(0,25).padEnd(25)} │ ${String(p.camAmount||0).padStart(8)} │ ${String(p.camArrears||0).padStart(22)} │ ${p.paymentStatus||'N/A'}`
    );
  });
  console.log('');

  const propertyIds = targetProperties.map(p => String(p._id));

  // ── Step 3: compute expected arrears for each property ────────────────────
  console.log('── STEP 3: Compute Expected Carry-Forward Arrears ───────────────');
  console.log(`  ${INFO}  Expected = balance of most-recent previous unpaid CAM invoice`);
  console.log(`  ${INFO}  (sorted periodTo DESC — mirrors the fixed calculateOverdueArrears)\n`);

  const expectedArrearsMap = {}; // propertyId → expected arrears
  const periodFromMs = PERIOD_FROM.getTime();

  for (const p of targetProperties) {
    const propId = String(p._id);
    const invRes = await request('GET',
      `${API}/taj-utilities/invoices/property/${propId}`,
      null, token);

    const invoices = invRes.body?.data || [];

    const unpaidCam = invoices.filter(inv =>
      inv.chargeTypes?.includes('CAM') &&
      ['unpaid', 'partial_paid'].includes(inv.paymentStatus) &&
      (inv.balance ?? 0) > 0 &&
      (inv.periodTo ? new Date(inv.periodTo).getTime() : 0) < periodFromMs
    );

    unpaidCam.sort((a, b) => {
      const ap = a.periodTo ? new Date(a.periodTo).getTime() : 0;
      const bp = b.periodTo ? new Date(b.periodTo).getTime() : 0;
      if (bp !== ap) return bp - ap;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    const lastUnpaid = unpaidCam[0];

    // Mirror calculateOverdueArrears logic exactly (including late-payment surcharge).
    // GRACE_PERIOD_DAYS = 6 (matches server-side constant).
    let exp = 0;
    let expNote = '← no previous unpaid CAM invoice (expected 0)';
    if (lastUnpaid) {
      const GRACE = 6;
      const baseBalance = Math.max(0, Number(lastUnpaid.balance || 0));
      // Base charges = sum of charge.amount only (not arrears) — same as server
      const baseChargesTotal = (lastUnpaid.charges || [])
        .reduce((s, c) => s + (c.amount || 0), 0) || (lastUnpaid.subtotal || 0);
      const dueDate = lastUnpaid.dueDate ? new Date(lastUnpaid.dueDate) : null;
      const dueWithGrace = dueDate ? new Date(dueDate) : null;
      if (dueWithGrace) dueWithGrace.setDate(dueWithGrace.getDate() + GRACE);
      const todayStart = new Date(NOW); todayStart.setHours(0, 0, 0, 0);
      const isOverdue = !!(dueWithGrace && todayStart > dueWithGrace);
      let overdueAmount = baseBalance;
      if (isOverdue && baseBalance > 0) {
        const lateSurcharge   = Math.max(Math.round(baseChargesTotal * 0.1), 0);
        const origGrandTotal  = Number(lastUnpaid.subtotal || 0) + Number(lastUnpaid.totalArrears || 0);
        const storedGrandTotal= Number(lastUnpaid.grandTotal || 0);
        const surchargeAlreadyIn = storedGrandTotal > origGrandTotal;
        overdueAmount = surchargeAlreadyIn ? baseBalance : (baseBalance + lateSurcharge);
      }
      // For pure CAM filter: proportion = 1 (only CAM charges in the invoice)
      exp = Math.round(overdueAmount * 100) / 100;
      const surchargeApplied = overdueAmount - baseBalance;
      expNote = `← ${lastUnpaid.invoiceNumber} (ends ${(lastUnpaid.periodTo||'').slice(0,10)}, bal ${baseBalance}${surchargeApplied > 0 ? ` +${surchargeApplied} late surcharge` : ''})`;
    }
    expectedArrearsMap[propId] = exp;

    const owner  = String(p.ownerName || '—').slice(0, 26).padEnd(26);
    const expStr = String(exp).padStart(8);
    console.log(`  ${INFO}  srNo ${String(p.srNo).padStart(4)} ${owner}  expected: ${expStr}  ${expNote}`);
  }
  console.log('');

  // ── Step 4: bulk create ───────────────────────────────────────────────────
  console.log('── STEP 4: Bulk Create CAM Invoices on PRODUCTION ───────────────');
  console.log(`  ${WARN}  Creating invoices on PRODUCTION for ${propertyIds.length} properties.\n`);

  const bulkRes = await request('POST',
    `${API}/taj-utilities/invoices/bulk-create-cam-invoices`,
    {
      propertyIds,
      periodFrom:  PERIOD_FROM.toISOString(),
      periodTo:    PERIOD_TO.toISOString(),
      dueDate:     DUE_DATE.toISOString(),
      invoiceDate: NOW.toISOString()
    },
    token);

  assert('Bulk-create request returns HTTP 200',
    bulkRes.status === 200 && bulkRes.body?.success,
    `HTTP ${bulkRes.status}  ${bulkRes.body?.message || ''}`);

  const summary = bulkRes.body?.summary || {};
  const results = bulkRes.body?.results || [];

  console.log(`\n  ${INFO}  SUMMARY`);
  console.log(`         Total   : ${summary.total         ?? '?'}`);
  console.log(`         Created : ${summary.createdCount  ?? '?'}`);
  console.log(`         Skipped : ${summary.skippedCount  ?? '?'}  (invoice already existed for this period)`);
  console.log(`         Failed  : ${summary.failedCount   ?? '?'}\n`);

  assert('Zero failures', (summary.failedCount ?? 0) === 0, `${summary.failedCount} failure(s)`);

  const processed = (summary.createdCount ?? 0) + (summary.skippedCount ?? 0);
  assert(`All ${propertyIds.length} properties processed (created or skipped)`,
    processed === propertyIds.length,
    `Only ${processed} out of ${propertyIds.length}`);

  // ── Step 5: per-property result table ─────────────────────────────────────
  console.log('── STEP 5: Per-Property Results ─────────────────────────────────');
  console.log(`  srNo  │ Status   │ Invoice ID                │ Owner`);
  console.log(`  ──────┼──────────┼───────────────────────────┼─────────────────────────`);
  results.forEach(r => {
    const prop   = targetProperties.find(p => String(p._id) === String(r.propertyId));
    const srNo   = String(prop?.srNo ?? '?').padStart(4);
    const icon   = r.status === 'created' ? '\x1b[32m●\x1b[0m' : r.status === 'skipped' ? '\x1b[33m●\x1b[0m' : '\x1b[31m●\x1b[0m';
    const invId  = (r.invoiceId || r.message || '').toString().slice(0, 24).padEnd(24);
    const owner  = String(prop?.ownerName || '—').slice(0, 25);
    console.log(`  ${srNo}  │ ${icon} ${String(r.status||'?').padEnd(7)}│ ${invId} │ ${owner}`);
  });
  console.log('');

  // ── Step 6: arrears verification ──────────────────────────────────────────
  console.log('── STEP 6: Arrears Verification (Fix Validation) ────────────────');
  console.log(`  ${INFO}  Confirming each invoice's arrears == most-recent previous balance.\n`);

  let arrearsOk = 0, arrearsBad = 0, arrearsSkip = 0;

  for (const r of results) {
    const prop   = targetProperties.find(p => String(p._id) === String(r.propertyId));
    const srNo   = prop?.srNo ?? '?';
    const owner  = String(prop?.ownerName || r.propertyId).slice(0, 26).padEnd(26);

    if (r.status !== 'created' || !r.invoiceId) {
      const reason = r.status === 'skipped' ? 'already existed' : (r.message || 'no invoice ID');
      console.log(`  ${WARN}  srNo ${srNo} ${owner}  SKIPPED  (${reason})`);
      arrearsSkip++;
      continue;
    }

    const invRes = await request('GET',
      `${API}/taj-utilities/invoices/${r.invoiceId}`,
      null, token);

    if (invRes.status !== 200 || !invRes.body?.success) {
      console.log(`  ${FAIL}  srNo ${srNo} ${owner}  Cannot fetch invoice ${r.invoiceId} — HTTP ${invRes.status}`);
      arrearsBad++;
      continue;
    }

    const invoice  = invRes.body.data;
    const camLine  = (invoice.charges || []).find(c => String(c.type||'').toUpperCase() === 'CAM');
    const actual   = camLine?.arrears ?? invoice.totalArrears ?? 0;
    const expected = expectedArrearsMap[String(r.propertyId)] ?? 0;
    const diff     = Math.abs(actual - expected);
    const ok       = diff <= 1;

    if (ok) {
      console.log(`  ${PASS}  srNo ${srNo} ${owner}  arrears ${actual} == expected ${expected}`);
      arrearsOk++;
    } else {
      console.log(`  ${FAIL}  srNo ${srNo} ${owner}  arrears ${actual} ≠ expected ${expected}  (diff ${diff})`);
      arrearsBad++;
    }
  }

  console.log('');

  if (arrearsSkip > 0 && arrearsOk + arrearsBad === 0) {
    console.log(`  ${WARN}  All invoices were skipped — arrears check not performed.`);
    console.log(`         Delete the existing invoices for this period and re-run to validate arrears.\n`);
  } else {
    assert(`Arrears correct on all ${arrearsOk + arrearsBad} created invoice(s)`,
      arrearsBad === 0, `${arrearsBad} invoice(s) had wrong arrears`);
    console.log('');
  }

  // ── Final verdict ─────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════════');
  const total = totalPassed + totalFailed;
  if (totalFailed === 0) {
    console.log(`\x1b[32m  ALL TESTS PASSED  (${totalPassed}/${total})\x1b[0m`);
  } else {
    console.log(`\x1b[31m  TESTS FAILED  —  ${totalPassed} passed, ${totalFailed} failed  (${total} total)\x1b[0m`);
  }
  console.log('═══════════════════════════════════════════════════════════════════\n');

  process.exit(totalFailed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('\n\x1b[31mUnhandled error:\x1b[0m', err.message || err);
  process.exit(1);
});
