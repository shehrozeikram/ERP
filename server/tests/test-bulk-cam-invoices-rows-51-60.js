/**
 * TEST: Bulk CAM Invoice Creation for Pagination Rows 51–60
 *
 * What this test does:
 *   1. Authenticate with the local server to get a JWT token.
 *   2. Fetch the CAM-charges overview for page 6 / limit 10  →  rows 51–60.
 *   3. For each property, look up its most-recent previous unpaid CAM invoice
 *      and record its balance — that is EXACTLY what calculateOverdueArrears
 *      (after the periodTo sort fix) will use as the carry-forward arrears.
 *   4. Call POST /api/taj-utilities/invoices/bulk-create-cam-invoices.
 *   5. Verify:
 *        a. All 10 invoices created (0 failures).
 *        b. Each created invoice's CAM arrears == the expected carry-forward
 *           balance (±1 rounding tolerance).
 *
 * Usage (from the repo root):
 *   TEST_EMAIL=developer@tovus.net TEST_PASS=shehroze@tovus \
 *     node server/tests/test-bulk-cam-invoices-rows-51-60.js
 */

'use strict';

const http  = require('http');
const https = require('https');
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
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
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

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ${PASS}  ${label}`);
    passed++;
    return true;
  }
  console.log(`  ${FAIL}  ${label}${detail ? '  →  ' + detail : ''}`);
  failed++;
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

const BASE_URL   = (process.env.BASE_URL   || 'http://localhost:5001').replace(/\/$/, '');
const API        = `${BASE_URL}/api`;
const TEST_EMAIL = process.env.TEST_EMAIL || '';
const TEST_PASS  = process.env.TEST_PASS  || '';

// Current month period
const NOW         = new Date();
const PERIOD_FROM = new Date(NOW.getFullYear(), NOW.getMonth(), 1);
const PERIOD_TO   = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0);
const DUE_DATE    = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 15);

// ─── main ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(' TEST: Bulk CAM Invoice Creation — Pagination Rows 51–60');
  console.log('════════════════════════════════════════════════════════════\n');
  console.log(`${INFO}  Server  : ${BASE_URL}`);
  console.log(`${INFO}  Period  : ${PERIOD_FROM.toDateString()} → ${PERIOD_TO.toDateString()}`);
  console.log(`${INFO}  Due     : ${DUE_DATE.toDateString()}\n`);

  // ── Step 1: authenticate ─────────────────────────────────────────────────
  console.log('── STEP 1: Authenticate ─────────────────────────────────────');
  if (!TEST_EMAIL || !TEST_PASS) {
    console.log(`  ${FAIL}  Missing credentials.`);
    console.log('         Set TEST_EMAIL and TEST_PASS env vars.\n');
    process.exit(1);
  }

  const loginRes = await request('POST', `${API}/auth/login`, {
    email: TEST_EMAIL, password: TEST_PASS
  });
  const token = loginRes.body?.token || loginRes.body?.data?.token;
  if (!assert('Login succeeds (HTTP 200)', loginRes.status === 200 && token, `HTTP ${loginRes.status}`)) {
    process.exit(1);
  }
  console.log(`  ${INFO}  Logged in as ${TEST_EMAIL}\n`);

  // ── Step 2: fetch page 6 of overview (rows 51–60) ────────────────────────
  console.log('── STEP 2: Fetch CAM Overview — page 6, limit 10 (rows 51–60) ─');
  const ovRes = await request('GET',
    `${API}/taj-utilities/cam-charges/current-overview?page=6&limit=10`,
    null, token);

  const overview   = ovRes.body?.data;
  const properties = overview?.properties || [];

  assert('Overview request succeeds (HTTP 200)', ovRes.status === 200 && ovRes.body?.success, `HTTP ${ovRes.status}`);
  if (!assert(`Page 6 returns properties (got ${properties.length})`, properties.length > 0,
    'No properties on page 6 — the DB may have fewer than 51 properties')) {
    process.exit(1);
  }

  console.log(`\n  ${INFO}  Pagination: page ${overview?.pagination?.page} / ${overview?.pagination?.totalPages}`);
  console.log(`  ${INFO}  Properties on this page: ${properties.length}`);
  console.log(`  ${INFO}  Global total: ${overview?.pagination?.total}\n`);

  console.log('  Row  │ Property ID               │ Owner                     │ CAM Amt  │ Total Arrears');
  console.log('  ─────┼───────────────────────────┼───────────────────────────┼──────────┼─────────────');
  properties.forEach((p, i) => {
    console.log(
      `  ${String(50 + i + 1).padStart(3)}  │ ${String(p._id).padEnd(24)} │ ${String(p.ownerName || '—').slice(0,25).padEnd(25)} │ ${String(p.camAmount||0).padStart(8)} │ ${p.camArrears||0}`
    );
  });
  console.log('');

  const propertyIds = properties.map(p => String(p._id));

  // ── Step 3: find most-recent previous unpaid CAM invoice per property ─────
  // This is EXACTLY what calculateOverdueArrears (with the periodTo sort fix)
  // will look up when creating the new invoice. Expected arrears = that invoice's balance.
  console.log('── STEP 3: Compute Expected Arrears (most-recent prev invoice) ─');
  const expectedArrears = {}; // propertyId → expected arrears for new invoice

  for (const p of properties) {
    const propId = String(p._id);
    const invRes = await request('GET',
      `${API}/taj-utilities/invoices/property/${propId}`,
      null, token);

    const invoices = (invRes.body?.data || []);

    // Filter to unpaid CAM invoices whose period ends BEFORE this month.
    const periodFromMs = PERIOD_FROM.getTime();
    const unpaidCam = invoices.filter(inv => {
      if (!inv.chargeTypes?.includes('CAM')) return false;
      if (!['unpaid', 'partial_paid'].includes(inv.paymentStatus)) return false;
      if ((inv.balance ?? 0) <= 0) return false;
      // Must be a previous period, not the one we are about to create
      const invPeriodTo = inv.periodTo ? new Date(inv.periodTo).getTime() : 0;
      return invPeriodTo < periodFromMs;
    });

    // Sort by periodTo DESC, createdAt DESC — mirrors the fixed calculateOverdueArrears
    unpaidCam.sort((a, b) => {
      const aPeriod = a.periodTo ? new Date(a.periodTo).getTime() : 0;
      const bPeriod = b.periodTo ? new Date(b.periodTo).getTime() : 0;
      if (bPeriod !== aPeriod) return bPeriod - aPeriod;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    const lastUnpaid = unpaidCam[0];
    const exp = lastUnpaid ? Math.max(0, Number(lastUnpaid.balance || 0)) : 0;
    expectedArrears[propId] = exp;

    const owner = String(p.ownerName || '—').slice(0, 28).padEnd(28);
    const expStr = String(exp).padStart(8);
    const ref = lastUnpaid
      ? `← ${lastUnpaid.invoiceNumber} (periodTo ${lastUnpaid.periodTo?.slice(0,10)}, bal ${lastUnpaid.balance})`
      : '← no previous unpaid CAM invoice (expected 0)';
    console.log(`  ${INFO}  ${owner}  expected arrears: ${expStr}  ${ref}`);
  }
  console.log('');

  // ── Step 4: bulk create ───────────────────────────────────────────────────
  console.log('── STEP 4: Bulk Create CAM Invoices ─────────────────────────');
  console.log(`  ${INFO}  Sending ${propertyIds.length} property IDs …\n`);

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

  assert('Bulk-create request succeeds (HTTP 200)',
    bulkRes.status === 200 && bulkRes.body?.success,
    `HTTP ${bulkRes.status}  ${bulkRes.body?.message || ''}`);

  const summary = bulkRes.body?.summary || {};
  const results = bulkRes.body?.results || [];

  console.log(`\n  ${INFO}  Summary:`);
  console.log(`         Total   : ${summary.total       ?? '?'}`);
  console.log(`         Created : ${summary.createdCount ?? '?'}`);
  console.log(`         Skipped : ${summary.skippedCount ?? '?'}  (invoice already exists for period)`);
  console.log(`         Failed  : ${summary.failedCount  ?? '?'}\n`);

  assert('Zero failures in bulk creation',
    (summary.failedCount ?? 0) === 0, `${summary.failedCount} failure(s)`);

  assert('All 10 properties processed (created or skipped)',
    ((summary.createdCount ?? 0) + (summary.skippedCount ?? 0)) === 10,
    `Only ${(summary.createdCount ?? 0) + (summary.skippedCount ?? 0)} out of 10`);

  // ── Step 5: per-property results table ────────────────────────────────────
  console.log('── STEP 5: Per-Property Results ─────────────────────────────');
  console.log('  Row  │ Property ID               │ Status   │ Detail');
  console.log('  ─────┼───────────────────────────┼──────────┼────────────────────────────────────');
  results.forEach((r, i) => {
    const icon = r.status === 'created' ? '\x1b[32m●\x1b[0m' : r.status === 'skipped' ? '\x1b[33m●\x1b[0m' : '\x1b[31m●\x1b[0m';
    const detail = r.invoiceId ? `Invoice ID: ${r.invoiceId}` : (r.message || '');
    console.log(`  ${String(50+i+1).padStart(3)}  │ ${String(r.propertyId).padEnd(24)} │ ${icon} ${String(r.status||'?').padEnd(8)}│ ${detail}`);
  });
  console.log('');

  // ── Step 6: verify arrears on each created invoice ────────────────────────
  console.log('── STEP 6: Verify Arrears (periodTo-sort fix validation) ────');
  console.log(`  ${INFO}  Each new invoice's CAM arrears must equal the balance of`);
  console.log(`  ${INFO}  the most recent previous unpaid CAM invoice for that property.\n`);

  let arrearsOk = 0, arrearsBad = 0, arrearsSkip = 0;

  for (const r of results) {
    if (r.status !== 'created' || !r.invoiceId) { arrearsSkip++; continue; }

    const invRes = await request('GET',
      `${API}/taj-utilities/invoices/${r.invoiceId}`,
      null, token);

    if (invRes.status !== 200 || !invRes.body?.success) {
      console.log(`  ${FAIL}  Fetch invoice ${r.invoiceId}: HTTP ${invRes.status}`);
      arrearsBad++;
      continue;
    }

    const invoice = invRes.body.data;
    const camLine = (invoice.charges || []).find(c => String(c.type||'').toUpperCase() === 'CAM');
    const actual   = camLine?.arrears ?? invoice.totalArrears ?? 0;
    const expected = expectedArrears[String(r.propertyId)] ?? 0;
    const diff     = Math.abs(actual - expected);
    const ok       = diff <= 1;  // ±1 rounding tolerance
    const owner    = properties.find(p => String(p._id) === String(r.propertyId))?.ownerName || r.propertyId;

    if (ok) {
      console.log(`  ${PASS}  ${owner}: arrears ${actual} == expected ${expected}`);
      arrearsOk++;
    } else {
      console.log(`  ${FAIL}  ${owner}: arrears ${actual} ≠ expected ${expected}  (diff ${diff})`);
      arrearsBad++;
    }
  }

  if (arrearsSkip > 0 && arrearsOk + arrearsBad === 0) {
    console.log(`  ${WARN}  All invoices skipped (already existed). Delete them to re-test arrears.\n`);
  } else {
    console.log('');
    assert(`Arrears correct on all ${arrearsOk + arrearsBad} created invoice(s)`,
      arrearsBad === 0, `${arrearsBad} invoice(s) had wrong arrears`);
    console.log('');
  }

  // ── Final report ──────────────────────────────────────────────────────────
  console.log('════════════════════════════════════════════════════════════');
  const total = passed + failed;
  if (failed === 0) {
    console.log(`\x1b[32m  ALL TESTS PASSED  (${passed}/${total})\x1b[0m`);
  } else {
    console.log(`\x1b[31m  TESTS FAILED  —  ${passed} passed, ${failed} failed  (${total} total)\x1b[0m`);
  }
  console.log('════════════════════════════════════════════════════════════\n');

  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('\n\x1b[31mUnhandled error:\x1b[0m', err.message || err);
  process.exit(1);
});
