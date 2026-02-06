/**
 * Delete February 2026 rent invoices for Rental Management properties.
 * Use before re-running bulk create to test fresh invoice creation.
 *
 * Run: TEST_EMAIL=... TEST_PASSWORD=... MONTH=2 node tests/rental-delete-feb-invoices.js
 */

require('dotenv').config();
const axios = require('axios');
const moment = require('moment');

const API_URL = process.env.TEST_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
const MONTH = parseInt(process.env.MONTH || '2', 10);
const YEAR = parseInt(process.env.YEAR || '2026', 10);
const PERIOD_FROM = `${YEAR}-${String(MONTH).padStart(2, '0')}-01`;
const PERIOD_TO = moment(`${YEAR}-${String(MONTH).padStart(2, '0')}`, 'YYYY-MM').endOf('month').format('YYYY-MM-DD');

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
}

async function fetchProperties() {
  const res = await api.get('/taj-utilities/rental-management/properties');
  if (!res.data?.success || !Array.isArray(res.data?.data)) throw new Error('Failed to fetch properties');
  return res.data.data;
}

async function fetchInvoicesForProperty(propertyId) {
  const res = await api.get(`/taj-utilities/invoices/property/${propertyId}`);
  return res.data?.success ? (res.data?.data || []) : [];
}

async function deleteInvoice(invoiceId) {
  await api.delete(`/taj-utilities/invoices/${invoiceId}`);
}

function isFebInvoice(inv) {
  if (!inv.periodFrom || !inv.periodTo) return false;
  return (
    moment(inv.periodFrom).format('YYYY-MM-DD') === PERIOD_FROM &&
    moment(inv.periodTo).format('YYYY-MM-DD') === PERIOD_TO
  );
}

async function main() {
  console.log(`\n🗑 Deleting ${moment(PERIOD_FROM).format('MMMM YYYY')} invoices (${PERIOD_FROM} - ${PERIOD_TO})\n`);
  await login();
  const properties = await fetchProperties();
  let deleted = 0;
  for (const p of properties) {
    const invoices = await fetchInvoicesForProperty(p._id);
    const toDelete = invoices.filter(isFebInvoice);
    for (const inv of toDelete) {
      await deleteInvoice(inv._id);
      deleted++;
      console.log(`   Deleted: ${p.propertyName || p._id} - ${inv.invoiceNumber || inv._id}`);
    }
  }
  console.log(`\n✅ Deleted ${deleted} invoice(s)\n`);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
