/**
 * Delete Jan 2026 CAM invoices (Taj Utilities — CAM Charges) for first 25 properties.
 *
 * Run: TEST_EMAIL=ceo@sgc.com TEST_PASSWORD=ceo12345 node tests/cam-delete-and-recreate.js
 * Or: MONTH=1 YEAR=2026 node tests/cam-delete-and-recreate.js
 */

require('dotenv').config();
const axios = require('axios');
const dayjs = require('dayjs');

const API_URL = process.env.TEST_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Jan 2026 - invoices to delete (Taj Utilities CAM Charges)
const DELETE_MONTH = parseInt(process.env.MONTH || '1', 10);
const DELETE_YEAR = parseInt(process.env.YEAR || '2026', 10);

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

async function main() {
  const monthName = dayjs(`${DELETE_YEAR}-${String(DELETE_MONTH).padStart(2, '0')}-01`).format('MMMM YYYY');
  console.log(`\n📋 CAM Charges — Delete ${monthName} Invoices (Taj Utilities)`);
  console.log(`   API: ${API_URL}\n`);

  await login();
  const properties = await fetchProperties(25);
  console.log(`📦 Fetched ${properties.length} properties\n`);

  console.log(`🗑️  Deleting ${monthName} CAM invoices...\n`);
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
}

main().catch((err) => {
  console.error('❌', err.response?.data?.message || err.message);
  process.exit(1);
});
