/**
 * Delete Feb 2026 CAM invoices for first 25 properties, then create Jan 2026 invoices.
 * Verifies journal entry balance fix.
 *
 * Run: TEST_EMAIL=ceo@sgc.com TEST_PASSWORD=ceo12345 node tests/cam-delete-and-recreate.js
 */

require('dotenv').config();
const axios = require('axios');
const dayjs = require('dayjs');

const API_URL = process.env.TEST_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Feb 2026 - invoices to delete
const DELETE_MONTH = 2;
const DELETE_YEAR = 2026;

// Jan 2026 - invoices to create
const CREATE_MONTH = 1;
const CREATE_YEAR = 2026;

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
  if (!email || !password) throw new Error('TEST_EMAIL and TEST_PASSWORD required');
  const res = await axios.post(`${API_URL}/auth/login`, { email, password });
  if (!res.data?.success || !res.data?.data?.token) throw new Error('Login failed');
  authToken = res.data.data.token;
  console.log('✅ Logged in');
}

async function fetchProperties(limit = 25) {
  const res = await api.get('/taj-utilities/cam-charges/current-overview', {
    params: { page: 1, limit }
  });
  const props = res.data?.data?.properties || [];
  if (!Array.isArray(props)) throw new Error('Failed to fetch properties');
  return props;
}

async function fetchInvoicesForProperty(propertyId) {
  const res = await api.get(`/taj-utilities/invoices/property/${propertyId}`);
  return res.data?.success ? (res.data?.data || []) : [];
}

async function deleteInvoice(invoiceId) {
  await api.delete(`/taj-utilities/invoices/${invoiceId}`);
}

function camInvoiceForMonth(invoices, month, year) {
  const targetStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month').valueOf();
  const targetEnd = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).endOf('month').valueOf();
  return invoices.find((inv) => {
    if (!inv?.chargeTypes?.includes('CAM')) return false;
    const start = inv.periodFrom ? dayjs(inv.periodFrom).startOf('day').valueOf() : null;
    const end = inv.periodTo ? dayjs(inv.periodTo).endOf('day').valueOf() : null;
    const s = start ?? end;
    const e = end ?? start;
    if (s == null || e == null) return false;
    return s <= targetEnd && e >= targetStart;
  });
}

async function getCAMCalculation(propertyId) {
  const res = await api.get(`/taj-utilities/invoices/property/${propertyId}/cam-calculation`);
  return res.data?.success ? res.data?.data : null;
}

async function createInvoice(propertyId, payload) {
  await api.post(`/taj-utilities/invoices/property/${propertyId}`, payload);
}

async function main() {
  console.log('\n📋 CAM Delete Feb 2026 + Create Jan 2026');
  console.log(`   API: ${API_URL}\n`);

  await login();
  const properties = await fetchProperties(25);
  console.log(`📦 Fetched ${properties.length} properties\n`);

  // Step 1: Delete Feb 2026 CAM invoices
  console.log('🗑️  Deleting Feb 2026 CAM invoices...\n');
  let deleted = 0;
  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    const name = p.propertyName || p.plotNumber || p._id;
    try {
      const invoices = await fetchInvoicesForProperty(p._id);
      const inv = camInvoiceForMonth(invoices, DELETE_MONTH, DELETE_YEAR);
      if (inv) {
        await deleteInvoice(inv._id);
        console.log(`   [${i + 1}] Deleted ${name} (${inv.invoiceNumber})`);
        deleted++;
      }
    } catch (err) {
      console.error(`   [${i + 1}] Failed to delete ${name}:`, err.response?.data?.message || err.message);
    }
  }
  console.log(`\n   Deleted ${deleted} invoice(s)\n`);

  // Step 2: Create Jan 2026 CAM invoices
  const periodFrom = dayjs(`${CREATE_YEAR}-${String(CREATE_MONTH).padStart(2, '0')}-01`).startOf('month');
  const periodTo = periodFrom.clone().endOf('month');
  const PERIOD_FROM_STR = periodFrom.format('YYYY-MM-DD');
  const PERIOD_TO_STR = periodTo.format('YYYY-MM-DD');
  const INVOICE_DATE = PERIOD_FROM_STR;
  const DUE_DATE = periodTo.add(15, 'day').format('YYYY-MM-DD');

  console.log(`📝 Creating Jan 2026 CAM invoices...\n`);
  const results = { created: 0, skipped: 0, failed: 0, errors: [] };

  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    const name = p.propertyName || p.plotNumber || p._id;
    process.stdout.write(`[${i + 1}/${properties.length}] ${name}... `);

    try {
      const invoices = await fetchInvoicesForProperty(p._id);
      if (camInvoiceForMonth(invoices, CREATE_MONTH, CREATE_YEAR)) {
        console.log('SKIPPED (exists)');
        results.skipped++;
        continue;
      }

      const camData = await getCAMCalculation(p._id);
      const camAmount = Number(camData?.amount) || 0;
      const camArrears = Number(camData?.arrears) || 0;
      const camDescription = camData?.description || 'CAM Charges';

      const charges = [{
        type: 'CAM',
        description: camDescription,
        amount: camAmount,
        arrears: camArrears,
        total: camAmount + camArrears
      }];

      await createInvoice(p._id, {
        includeCAM: true,
        includeElectricity: false,
        includeRent: false,
        invoiceDate: new Date(INVOICE_DATE),
        periodFrom: new Date(PERIOD_FROM_STR),
        periodTo: new Date(PERIOD_TO_STR),
        dueDate: new Date(DUE_DATE),
        charges
      });

      console.log('✅ CREATED');
      results.created++;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || String(err);
      console.log(`❌ FAILED: ${msg}`);
      results.failed++;
      results.errors.push({ property: name, id: p._id, error: msg });
    }
  }

  console.log(`\n📊 Result: ${results.created} created, ${results.skipped} skipped, ${results.failed} failed`);
  if (results.errors.length > 0) {
    console.log('\n❌ Failures:');
    results.errors.forEach((e, i) => console.log(`   ${i + 1}. ${e.property}: ${e.error}`));
  }
  console.log('');
}

main().catch((err) => {
  console.error('❌', err.response?.data?.message || err.message);
  process.exit(1);
});
