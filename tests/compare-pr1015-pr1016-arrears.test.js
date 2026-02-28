/**
 * Arrears Comparison Test: PR-1015 vs PR-1016
 *
 * PR-1015: single-property tenant  — invoice arrears expected to be correct.
 * PR-1016: multi-property tenant   — previous invoices were generating wrong arrears.
 *
 * What this test does:
 *   1. Finds PR-1015 and PR-1016 by srNo.
 *   2. Calls /rent-calculation for each — logs all arrears components.
 *   3. Creates a fresh test invoice for each for the test period (default: March 2026).
 *   4. Verifies the invoice's arrears matches what rent-calculation reported.
 *   5. Checks that the new invoice for PR-1016 uses only its OWN property's overdue
 *      invoices for arrears (not other properties of the same tenant).
 *   6. Deletes the test invoices so the test is repeatable.
 *
 * Run:
 *   MONTH=3 YEAR=2026 node tests/compare-pr1015-pr1016-arrears.test.js
 *
 * Prerequisites:
 *   - Server must be running (npm run server)
 *   - TEST_EMAIL and TEST_PASSWORD set in .env
 */

require('dotenv').config();
const axios = require('axios');
const moment = require('moment');

const API_URL =
  process.env.TEST_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:5001/api';

const MONTH = parseInt(process.env.MONTH || '3', 10);
const YEAR  = parseInt(process.env.YEAR  || '2026', 10);
const lastDay    = moment(`${YEAR}-${String(MONTH).padStart(2, '0')}`, 'YYYY-MM').endOf('month').date();
const PERIOD_FROM = `${YEAR}-${String(MONTH).padStart(2, '0')}-01`;
const PERIOD_TO   = `${YEAR}-${String(MONTH).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
const DUE_DATE    = moment(PERIOD_TO).add(15, 'days').format('YYYY-MM-DD');

// Target property serial numbers
const PR_1015_SRNO = 1015;
const PR_1016_SRNO = 1016;

let authToken = null;

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60_000
});

api.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});

// ─── helpers ────────────────────────────────────────────────────────────────

async function login() {
  const email    = process.env.TEST_EMAIL || process.env.EMAIL_USER;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password)
    throw new Error('Set TEST_EMAIL and TEST_PASSWORD in .env');
  const res = await axios.post(`${API_URL}/auth/login`, { email, password });
  if (!res.data?.success || !res.data?.data?.token)
    throw new Error('Login failed: ' + (res.data?.message || 'no token'));
  authToken = res.data.data.token;
}

async function fetchAllRentalProperties() {
  const res = await api.get('/taj-utilities/rental-management/properties');
  if (!res.data?.success || !Array.isArray(res.data?.data))
    throw new Error('Failed to fetch rental properties: ' + JSON.stringify(res.data));
  return res.data.data;
}

async function getRentCalculation(propertyId) {
  const res = await api.get(`/taj-utilities/invoices/property/${propertyId}/rent-calculation`);
  if (!res.data?.success)
    throw new Error('Rent calculation failed: ' + (res.data?.message || ''));
  return res.data.data;
}

async function fetchInvoicesForProperty(propertyId) {
  const res = await api.get(`/taj-utilities/invoices/property/${propertyId}`);
  return res.data?.success ? (res.data?.data || []) : [];
}

async function createInvoice(propertyId, rentData) {
  const { monthlyRent, totalArrears, carryForwardArrears } = rentData;
  const desc = carryForwardArrears > 0
    ? 'Rental Charges (with Carry Forward Arrears)'
    : 'Rental Charges';
  const payload = {
    includeCAM: false,
    includeElectricity: false,
    includeRent: true,
    invoiceDate: PERIOD_FROM,
    periodFrom:  PERIOD_FROM,
    periodTo:    PERIOD_TO,
    dueDate:     DUE_DATE,
    charges: [{
      type: 'RENT',
      description: desc,
      amount: monthlyRent,
      arrears: totalArrears,
      total: monthlyRent + totalArrears
    }]
  };
  const res = await api.post(`/taj-utilities/invoices/property/${propertyId}`, payload);
  if (!res.data?.success)
    throw new Error(res.data?.message || 'Create invoice failed');
  return res.data.data;
}

async function deleteInvoice(invoiceId) {
  await api.delete(`/taj-utilities/invoices/${invoiceId}`);
}

// ─── per-property analysis ───────────────────────────────────────────────────

function analyseInvoice(label, property, rentCalc, invoice) {
  const rentCharge = invoice.charges?.find((c) => c.type === 'RENT');
  const cfExpected  = rentCalc.carryForwardArrears || 0;
  const cfOnInvoice = rentCharge?.arrears || 0;

  // The invoice arrears should equal totalArrears from rent-calculation
  const arrearsMatch = Math.abs(cfOnInvoice - (rentCalc.totalArrears || 0)) < 0.01;
  const gtExpected   = (rentCharge?.amount || 0) + cfOnInvoice;
  const gtMatch      = Math.abs((invoice.grandTotal || 0) - gtExpected) < 0.01;
  // Invoice number must not contain double-dash
  const noDoubleDash = !(invoice.invoiceNumber || '').includes('--');

  const pass = arrearsMatch && gtMatch && noDoubleDash;

  console.log(`\n  ── ${label} (srNo ${property.srNo}) ──────────────────`);
  console.log(`     Property    : ${property.propertyName || property.plotNumber}`);
  console.log(`     Tenant      : ${property.tenantName || '(none)'}`);
  console.log(`     Invoice No  : ${invoice.invoiceNumber || '(no number)'}`);
  console.log(`     Period      : ${PERIOD_FROM}  →  ${PERIOD_TO}`);
  console.log('');
  console.log('     Rent Calculation (from /rent-calculation):');
  console.log(`       monthlyRent          : ${rentCalc.monthlyRent}`);
  console.log(`       arrearsFromPayment   : ${rentCalc.arrearsFromPayment}`);
  console.log(`       carryForwardArrears  : ${rentCalc.carryForwardArrears}`);
  console.log(`       totalArrears         : ${rentCalc.totalArrears}`);
  console.log('');
  console.log('     Created Invoice:');
  console.log(`       charge.amount        : ${rentCharge?.amount}`);
  console.log(`       charge.arrears       : ${rentCharge?.arrears}   ${arrearsMatch ? '✓' : '✗  ← MISMATCH'}`);
  console.log(`       charge.total         : ${rentCharge?.total}`);
  console.log(`       grandTotal           : ${invoice.grandTotal}   ${gtMatch ? '✓' : '✗  ← WRONG GRAND TOTAL'}`);
  console.log(`       invoiceNumber format : ${noDoubleDash ? '✓ (clean)' : '✗  ← DOUBLE DASH IN NUMBER'}`);
  console.log(`       status               : ${invoice.paymentStatus || invoice.status}`);
  console.log(`       balance              : ${invoice.balance}`);
  console.log('');
  console.log(`     Result: ${pass ? '✅ PASS' : '❌ FAIL'}`);

  return { pass, label, invoice };
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const monthLabel = moment(PERIOD_FROM).format('MMMM YYYY');
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`  PR-1015 vs PR-1016 Arrears Comparison Test — ${monthLabel}`);
  console.log(`${'═'.repeat(65)}`);
  console.log(`  Period : ${PERIOD_FROM}  →  ${PERIOD_TO}`);
  console.log(`  API    : ${API_URL}`);

  await login();
  console.log('\n✅ Logged in');

  // 1. Find both properties by srNo
  const allProps = await fetchAllRentalProperties();
  const prop1015 = allProps.find((p) => p.srNo === PR_1015_SRNO);
  const prop1016 = allProps.find((p) => p.srNo === PR_1016_SRNO);

  if (!prop1015)
    throw new Error(`Property with srNo ${PR_1015_SRNO} not found in rental management properties`);
  if (!prop1016)
    throw new Error(`Property with srNo ${PR_1016_SRNO} not found in rental management properties`);

  console.log(`\n📦 Found PR-${PR_1015_SRNO}: ${prop1015.propertyName || prop1015.plotNumber}  (tenant: ${prop1015.tenantName || '—'})`);
  console.log(`📦 Found PR-${PR_1016_SRNO}: ${prop1016.propertyName || prop1016.plotNumber}  (tenant: ${prop1016.tenantName || '—'})`);

  // 2. Check whether the same tenant (Abdul Ghaffar) really does have both properties
  const tenantName1016 = (prop1016.tenantName || '').trim().toLowerCase();
  const otherPropsForSameTenant = allProps.filter(
    (p) =>
      p._id !== prop1016._id &&
      p.tenantName &&
      p.tenantName.trim().toLowerCase() === tenantName1016
  );
  if (otherPropsForSameTenant.length > 0) {
    console.log(`\n⚠️  ${prop1016.tenantName} also occupies ${otherPropsForSameTenant.length} other property(ies):`);
    otherPropsForSameTenant.forEach((p) =>
      console.log(`     - srNo ${p.srNo}: ${p.propertyName || p.plotNumber}`)
    );
  } else {
    console.log(`\nℹ️  No other properties found for tenant "${prop1016.tenantName}" — may be stored under a different name/CNIC`);
  }

  // 3. Check for existing test-period invoices (skip if already exists)
  const existing1015 = await fetchInvoicesForProperty(prop1015._id);
  const existing1016 = await fetchInvoicesForProperty(prop1016._id);
  const hasExisting1015 = existing1015.some(
    (i) =>
      i.periodFrom && i.periodTo &&
      moment(i.periodFrom).isSame(moment(PERIOD_FROM), 'day') &&
      moment(i.periodTo).isSame(moment(PERIOD_TO), 'day')
  );
  const hasExisting1016 = existing1016.some(
    (i) =>
      i.periodFrom && i.periodTo &&
      moment(i.periodFrom).isSame(moment(PERIOD_FROM), 'day') &&
      moment(i.periodTo).isSame(moment(PERIOD_TO), 'day')
  );
  if (hasExisting1015 || hasExisting1016) {
    console.log('\n⚠️  An invoice already exists for one or both properties in this period.');
    console.log('   Delete existing test invoices first, then rerun.');
    console.log('   To delete: MONTH=' + MONTH + ' YEAR=' + YEAR + ' node tests/rental-delete-feb-invoices.js');
    process.exit(1);
  }

  // 4. Get rent calculation for both
  console.log('\n🔢 Fetching rent calculations...');
  const rentCalc1015 = await getRentCalculation(prop1015._id);
  const rentCalc1016 = await getRentCalculation(prop1016._id);

  // 5. Create invoices for both
  console.log('📝 Creating test invoices...');
  const invoice1015 = await createInvoice(prop1015._id, rentCalc1015);
  const invoice1016 = await createInvoice(prop1016._id, rentCalc1016);

  // 6. Analyse both
  console.log('\n📊 Invoice Analysis:');
  const result1015 = analyseInvoice('PR-1015 (single-property tenant)', prop1015, rentCalc1015, invoice1015);
  const result1016 = analyseInvoice('PR-1016 (multi-property tenant)', prop1016, rentCalc1016, invoice1016);

  // 7. Cross-property contamination check:
  //    Rebuild the same calculation as calculateOverdueArrears (including 10% late surcharge on base)
  //    and verify that the rent-calculation carry-forward matches PR-1016's OWN overdue invoices only.
  console.log('\n  ── Cross-property contamination check ──────────────────');
  const inv1016RentCharge = invoice1016.charges?.find((c) => c.type === 'RENT');
  const inv1016Arrears    = inv1016RentCharge?.arrears || 0;

  // Fetch all invoices for PR-1016 and replicate the new "last invoice only" logic
  const existing1016All = await fetchInvoicesForProperty(prop1016._id);

  // Unpaid RENT invoices for PR-1016, excluding the one we just created
  const unpaidRent1016 = existing1016All
    .filter(
      (i) =>
        i._id !== invoice1016._id &&
        (i.paymentStatus === 'unpaid' || i.paymentStatus === 'partial_paid') &&
        i.balance > 0 &&
        i.status !== 'Cancelled' &&
        (i.chargeTypes?.includes('RENT') || i.charges?.some((c) => c.type === 'RENT'))
    )
    .sort((a, b) => new Date(b.dueDate || 0) - new Date(a.dueDate || 0)); // most recent first

  // Replicate: arrears = balance of the single most-recent unpaid invoice (RENT proportion)
  let replicatedArrears = 0;
  if (unpaidRent1016.length > 0) {
    const lastInv       = unpaidRent1016[0];
    const totalBase     = (lastInv.charges || []).reduce((s, c) => s + (c.amount || 0), 0) || lastInv.subtotal || 0;
    const surcharge     = Math.max(Math.round(totalBase * 0.1), 0);
    const overdueAmt    = (lastInv.balance || 0) + surcharge;
    const rentBase      = (lastInv.charges || []).filter((c) => c.type === 'RENT').reduce((s, c) => s + (c.amount || 0), 0);
    const proportion    = totalBase > 0 ? rentBase / totalBase : 0;
    replicatedArrears   = Math.round(overdueAmt * proportion * 100) / 100;
  }

  const cfMatchesOwnProperty = Math.abs(rentCalc1016.carryForwardArrears - replicatedArrears) < 1;

  console.log(`     PR-1016 carryForwardArrears from rent-calc : ${rentCalc1016.carryForwardArrears}`);
  console.log(`     Replicated (last unpaid invoice balance)   : ${replicatedArrears.toFixed(2)}`);
  console.log(`     Arrears on new invoice                     : ${inv1016Arrears}`);
  console.log(`     Carry-forward = last invoice only (own)    : ${cfMatchesOwnProperty ? '✅ YES (correct)' : '❌ MISMATCH'}`);
  console.log('');
  console.log('     All unpaid RENT invoices for PR-1016 (newest first):');
  unpaidRent1016.forEach((inv, idx) => {
    const rc = inv.charges?.find((c) => c.type === 'RENT');
    console.log(`       ${idx === 0 ? '→ LAST (used for arrears)' : '  older (ignored)     '} ${inv.invoiceNumber || inv._id} | base=${rc?.amount || 0}  balance=${inv.balance}`);
  });
  if (unpaidRent1016.length === 0) {
    console.log('       (none — all invoices paid)');
  }

  // 8. Overall result
  const allPass = result1015.pass && result1016.pass;
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`  Overall: ${allPass ? '✅ ALL PASS' : '❌ FAILURES DETECTED'}`);
  console.log(`${'═'.repeat(65)}\n`);

  // 9. Cleanup — delete the test invoices we created
  console.log('🧹 Cleaning up test invoices...');
  const invoiceId1015 = invoice1015._id;
  const invoiceId1016 = invoice1016._id;
  try {
    await deleteInvoice(invoiceId1015);
    console.log(`   Deleted PR-1015 test invoice (${invoice1015.invoiceNumber || invoiceId1015})`);
  } catch (e) {
    console.warn(`   ⚠ Could not delete PR-1015 test invoice: ${e.message}`);
  }
  try {
    await deleteInvoice(invoiceId1016);
    console.log(`   Deleted PR-1016 test invoice (${invoice1016.invoiceNumber || invoiceId1016})`);
  } catch (e) {
    console.warn(`   ⚠ Could not delete PR-1016 test invoice: ${e.message}`);
  }

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('\n❌ Test error:', err.message);
  if (err.response?.data) {
    console.error('   API response:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
