/**
 * Create electricity invoices for property 1001 (Shop No. 1) for January, February, and March.
 * Verifies arrears flow: Jan = 0, Feb = Jan balance, Mar = Feb balance.
 *
 * Run: TEST_EMAIL=ceo@sgc.com TEST_PASSWORD=ceo12345 node scripts/create-shop-1001-invoices.js
 * Or:  node scripts/create-shop-1001-invoices.js
 *
 * Env: TEST_EMAIL, TEST_PASSWORD (for API login)
 *      API_URL (default: http://localhost:5001/api)
 *      YEAR (default: 2026)
 *      UNITS_JAN, UNITS_FEB, UNITS_MAR (default: 100, 120, 110)
 *      DELETE_EXISTING (default: true - delete existing Jan/Feb/Mar invoices before creating)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');
const dayjs = require('dayjs');

const API_URL = process.env.TEST_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
const YEAR = parseInt(process.env.YEAR, 10) || 2026;
const UNITS_JAN = parseFloat(process.env.UNITS_JAN) || 100;
const UNITS_FEB = parseFloat(process.env.UNITS_FEB) || 120;
const UNITS_MAR = parseFloat(process.env.UNITS_MAR) || 110;
const DELETE_EXISTING = process.env.DELETE_EXISTING !== 'false';

let authToken = null;
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000
});

api.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});

async function login() {
  const email = process.env.TEST_EMAIL || process.env.EMAIL_USER;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD (or EMAIL_USER) required. Example: TEST_EMAIL=ceo@sgc.com TEST_PASSWORD=ceo12345');
  }
  const res = await axios.post(`${API_URL}/auth/login`, { email, password });
  if (!res.data?.success || !res.data?.data?.token) throw new Error('Login failed');
  authToken = res.data.data.token;
  console.log('✅ Logged in');
}

async function findProperty1001() {
  // Try search by srNo/propertyName
  const searches = ['1001', 'Shop No', 'Shop No. 1'];
  for (const q of searches) {
    const res = await api.get('/taj-utilities/properties', {
      params: { search: q, limit: 100 }
    });
    const properties = res.data?.data || [];
    const match = properties.find(p => 
      p.srNo === 1001 || 
      (p.propertyName || '').toLowerCase().includes('shop no') && (p.propertyName || '').includes('1') ||
      (p.plotNumber || '').includes('1001')
    );
    if (match) return match;
  }
  // Fallback: fetch first page and look for srNo 1001
  const res = await api.get('/taj-utilities/properties', { params: { limit: 500 } });
  const props = res.data?.data || [];
  const bySrNo = props.find(p => p.srNo === 1001);
  if (bySrNo) return bySrNo;
  const byName = props.find(p => (p.propertyName || '').toLowerCase().includes('shop no. 1'));
  if (byName) return byName;
  return null;
}

async function getElectricityCalculation(propertyId, { periodFrom, periodTo, unitsConsumed, meterNo }) {
  const params = { unitsConsumed, periodFrom, periodTo };
  if (meterNo) params.meterNo = meterNo;
  const res = await api.get(`/taj-utilities/invoices/property/${propertyId}/electricity-calculation`, { params });
  return res.data?.success ? res.data.data : null;
}

async function createInvoice(propertyId, payload) {
  const res = await api.post(`/taj-utilities/invoices/property/${propertyId}`, payload);
  return res.data?.success ? res.data.data : null;
}

async function fetchInvoicesForProperty(propertyId) {
  const res = await api.get(`/taj-utilities/invoices/property/${propertyId}`);
  return res.data?.success ? (res.data.data || []) : [];
}

async function deleteInvoice(invoiceId) {
  await api.delete(`/taj-utilities/invoices/${invoiceId}`);
}

function isMonthInvoice(inv, year, month) {
  if (!inv?.chargeTypes?.includes('ELECTRICITY')) return false;
  const start = inv.periodFrom ? dayjs(inv.periodFrom).valueOf() : null;
  const end = inv.periodTo ? dayjs(inv.periodTo).valueOf() : null;
  const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month').valueOf();
  const monthEnd = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).endOf('month').valueOf();
  if (start == null && end == null) return false;
  const s = start ?? end;
  const e = end ?? start;
  return s <= monthEnd && e >= monthStart;
}

async function main() {
  console.log('\n📋 Create Invoices: Property 1001 (Shop No. 1) – Jan, Feb & Mar', YEAR);
  console.log(`   API: ${API_URL}`);
  console.log(`   Units Jan: ${UNITS_JAN}, Feb: ${UNITS_FEB}, Mar: ${UNITS_MAR}`);
  console.log(`   Delete existing: ${DELETE_EXISTING}\n`);

  await login();

  const property = await findProperty1001();
  if (!property) {
    console.log('❌ Property 1001 / Shop No. 1 not found');
    process.exit(1);
  }
  console.log(`📦 Property: ${property.propertyName || property.plotNumber || 'N/A'} (srNo: ${property.srNo}, _id: ${property._id})\n`);

  const meterNo = property.meters?.[0]?.meterNo || property.electricityWaterMeterNo || property.meterNumber || '';

  // Optional: delete existing Jan, Feb & Mar invoices
  if (DELETE_EXISTING) {
    const existing = await fetchInvoicesForProperty(property._id);
    const toDelete = existing.filter(inv => 
      isMonthInvoice(inv, YEAR, 1) || isMonthInvoice(inv, YEAR, 2) || isMonthInvoice(inv, YEAR, 3)
    );
    for (const inv of toDelete) {
      await deleteInvoice(inv._id);
      console.log(`   🗑 Deleted ${inv.invoiceNumber} (${dayjs(inv.periodFrom).format('MMM-YY')})`);
    }
    if (toDelete.length > 0) console.log('');
  }

  // --- Create January invoice ---
  const janPeriodFrom = `${YEAR}-01-01`;
  const janPeriodTo = `${YEAR}-01-31`;
  const janCalc = await getElectricityCalculation(property._id, {
    periodFrom: janPeriodFrom,
    periodTo: janPeriodTo,
    unitsConsumed: UNITS_JAN,
    meterNo
  });
  if (!janCalc || !janCalc.charges) {
    console.log('❌ January electricity calculation failed');
    process.exit(1);
  }

  const janCharges = [{
    type: 'ELECTRICITY',
    description: janCalc.previousArrears > 0 ? 'Electricity Bill (with Carry Forward Arrears)' : 'Electricity Bill',
    amount: janCalc.charges?.withSurcharge ?? janCalc.charges?.totalBill ?? 0,
    arrears: janCalc.previousArrears ?? 0,
    total: (janCalc.charges?.withSurcharge ?? janCalc.charges?.totalBill ?? 0) + (janCalc.previousArrears ?? 0)
  }];

  const janPayload = {
    includeCAM: false,
    includeElectricity: true,
    includeRent: false,
    periodFrom: janPeriodFrom,
    periodTo: janPeriodTo,
    charges: janCharges,
    calculationData: {
      previousReading: janCalc.previousReading,
      currentReading: janCalc.currentReading,
      unitsConsumed: janCalc.unitsConsumed,
      slab: janCalc.slab,
      charges: janCalc.charges,
      previousArrears: janCalc.previousArrears
    }
  };

  const janInvoice = await createInvoice(property._id, janPayload);
  if (!janInvoice) {
    console.log('❌ January invoice creation failed');
    process.exit(1);
  }
  console.log(`✅ January invoice: ${janInvoice.invoiceNumber}`);
  console.log(`   Period: ${dayjs(janPeriodFrom).format('MMM D')} – ${dayjs(janPeriodTo).format('MMM D, YYYY')}`);
  console.log(`   Arrears: ${janCalc.previousArrears ?? 0} (expected 0 for first invoice)`);
  console.log(`   Charges: ${janCharges[0].amount}, Total: ${janCharges[0].total}, Balance: ${janInvoice.balance ?? janInvoice.grandTotal}\n`);

  // --- Create February invoice ---
  const febPeriodFrom = `${YEAR}-02-01`;
  const febPeriodTo = `${YEAR}-02-28`;
  const febCalc = await getElectricityCalculation(property._id, {
    periodFrom: febPeriodFrom,
    periodTo: febPeriodTo,
    unitsConsumed: UNITS_FEB,
    meterNo
  });
  if (!febCalc || !febCalc.charges) {
    console.log('❌ February electricity calculation failed');
    process.exit(1);
  }

  const febCharges = [{
    type: 'ELECTRICITY',
    description: febCalc.previousArrears > 0 ? 'Electricity Bill (with Carry Forward Arrears)' : 'Electricity Bill',
    amount: febCalc.charges?.withSurcharge ?? febCalc.charges?.totalBill ?? 0,
    arrears: febCalc.previousArrears ?? 0,
    total: (febCalc.charges?.withSurcharge ?? febCalc.charges?.totalBill ?? 0) + (febCalc.previousArrears ?? 0)
  }];

  const febPayload = {
    includeCAM: false,
    includeElectricity: true,
    includeRent: false,
    periodFrom: febPeriodFrom,
    periodTo: febPeriodTo,
    charges: febCharges,
    calculationData: {
      previousReading: febCalc.previousReading,
      currentReading: febCalc.currentReading,
      unitsConsumed: febCalc.unitsConsumed,
      slab: febCalc.slab,
      charges: febCalc.charges,
      previousArrears: febCalc.previousArrears
    }
  };

  const febInvoice = await createInvoice(property._id, febPayload);
  if (!febInvoice) {
    console.log('❌ February invoice creation failed');
    process.exit(1);
  }
  const janBalance = janInvoice.balance ?? janInvoice.grandTotal;
  const febArrears = febCalc.previousArrears ?? 0;
  const febBalance = febInvoice.balance ?? febInvoice.grandTotal;

  console.log(`✅ February invoice: ${febInvoice.invoiceNumber}`);
  console.log(`   Period: ${dayjs(febPeriodFrom).format('MMM D')} – ${dayjs(febPeriodTo).format('MMM D, YYYY')}`);
  console.log(`   Arrears: ${febArrears} (expected = Jan balance: ${janBalance})`);
  console.log(`   Charges: ${febCharges[0].amount}, Total: ${febCharges[0].total}, Balance: ${febBalance}\n`);

  // --- Create March invoice ---
  const marPeriodFrom = `${YEAR}-03-01`;
  const marPeriodTo = `${YEAR}-03-31`;
  const marCalc = await getElectricityCalculation(property._id, {
    periodFrom: marPeriodFrom,
    periodTo: marPeriodTo,
    unitsConsumed: UNITS_MAR,
    meterNo
  });
  if (!marCalc || !marCalc.charges) {
    console.log('❌ March electricity calculation failed');
    process.exit(1);
  }

  const marCharges = [{
    type: 'ELECTRICITY',
    description: marCalc.previousArrears > 0 ? 'Electricity Bill (with Carry Forward Arrears)' : 'Electricity Bill',
    amount: marCalc.charges?.withSurcharge ?? marCalc.charges?.totalBill ?? 0,
    arrears: marCalc.previousArrears ?? 0,
    total: (marCalc.charges?.withSurcharge ?? marCalc.charges?.totalBill ?? 0) + (marCalc.previousArrears ?? 0)
  }];

  const marPayload = {
    includeCAM: false,
    includeElectricity: true,
    includeRent: false,
    periodFrom: marPeriodFrom,
    periodTo: marPeriodTo,
    charges: marCharges,
    calculationData: {
      previousReading: marCalc.previousReading,
      currentReading: marCalc.currentReading,
      unitsConsumed: marCalc.unitsConsumed,
      slab: marCalc.slab,
      charges: marCalc.charges,
      previousArrears: marCalc.previousArrears
    }
  };

  const marInvoice = await createInvoice(property._id, marPayload);
  if (!marInvoice) {
    console.log('❌ March invoice creation failed');
    process.exit(1);
  }
  const marArrears = marCalc.previousArrears ?? 0;

  console.log(`✅ March invoice: ${marInvoice.invoiceNumber}`);
  console.log(`   Period: ${dayjs(marPeriodFrom).format('MMM D')} – ${dayjs(marPeriodTo).format('MMM D, YYYY')}`);
  console.log(`   Arrears: ${marArrears} (expected = Feb balance: ${febBalance})`);
  console.log(`   Charges: ${marCharges[0].amount}, Total: ${marCharges[0].total}, Balance: ${marInvoice.balance ?? marInvoice.grandTotal}\n`);

  // --- Verification ---
  const allInvoices = await fetchInvoicesForProperty(property._id);
  console.log('📋 Verification');
  console.log('   January arrears:', janCalc.previousArrears ?? 0, janCalc.previousArrears === 0 ? '✅ (expected 0)' : '⚠️');
  const febArrearsMatch = Math.abs((febArrears ?? 0) - (janBalance ?? 0)) < 1;
  console.log('   February arrears = Jan balance:', febArrearsMatch ? '✅' : `⚠️ (Feb arrears: ${febArrears}, Jan balance: ${janBalance})`);
  const marArrearsMatch = Math.abs((marArrears ?? 0) - (febBalance ?? 0)) < 1;
  console.log('   March arrears = Feb balance:', marArrearsMatch ? '✅' : `⚠️ (Mar arrears: ${marArrears}, Feb balance: ${febBalance})`);
  console.log('\n✅ Script complete. Jan, Feb & Mar invoices created for Shop No. 1.\n');
}

main().catch((err) => {
  console.error('❌', err.response?.data?.message || err.message);
  if (err.response?.data) console.error('   ', JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
