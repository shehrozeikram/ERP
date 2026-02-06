/**
 * Create an open invoice for January 2026.
 *
 * Run: TEST_EMAIL=... TEST_PASSWORD=... node tests/create-open-invoice-jan2026.js
 *
 * Optional env vars:
 *   MONTH=1, YEAR=2026 (default)
 *   AMOUNT=1000 - charge amount (default 0)
 *   DESCRIPTION="Rent" - charge description
 */

require('dotenv').config();
const axios = require('axios');
const moment = require('moment');

const API_URL = process.env.TEST_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
const MONTH = parseInt(process.env.MONTH || '1', 10);
const YEAR = parseInt(process.env.YEAR || '2026', 10);
const AMOUNT = parseFloat(process.env.AMOUNT || '0');
const DESCRIPTION = process.env.DESCRIPTION || 'Open Invoice Charge';

const PERIOD_FROM = `${YEAR}-${String(MONTH).padStart(2, '0')}-01`;
const lastDay = moment(`${YEAR}-${String(MONTH).padStart(2, '0')}`, 'YYYY-MM').endOf('month').date();
const PERIOD_TO = `${YEAR}-${String(MONTH).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
const DUE_DATE = moment(PERIOD_TO).add(15, 'days').format('YYYY-MM-DD');
const INVOICE_DATE = PERIOD_FROM;

let authToken = null;
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000
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

async function createOpenInvoice() {
  // Use period month/year for invoice number to avoid duplicates (INV-YYYY-MM-0001)
  const invoiceNum = `INV-${YEAR}-${String(MONTH).padStart(2, '0')}-0001`;
  const payload = {
    invoiceNumber: invoiceNum,
    invoiceDate: INVOICE_DATE,
    periodFrom: PERIOD_FROM,
    periodTo: PERIOD_TO,
    dueDate: DUE_DATE,
    charges: [{
      type: 'OTHER',
      description: DESCRIPTION,
      amount: AMOUNT,
      arrears: 0,
      total: AMOUNT
    }],
    customerName: 'Test Customer',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    sector: ''
  };

  const res = await api.post('/taj-utilities/invoices', payload);
  if (!res.data?.success) throw new Error(res.data?.message || 'Create failed');
  return res.data.data;
}

async function main() {
  const monthName = moment(PERIOD_FROM).format('MMMM YYYY');
  console.log(`\n📄 Creating Open Invoice for ${monthName}\n`);
  console.log(`   Period: ${PERIOD_FROM} - ${PERIOD_TO}`);
  console.log(`   Due Date: ${DUE_DATE}`);
  console.log(`   Amount: ${AMOUNT}\n`);

  await login();
  const invoice = await createOpenInvoice();

  console.log('✅ Invoice created successfully');
  console.log(`   Invoice Number: ${invoice.invoiceNumber}`);
  console.log(`   ID: ${invoice._id}`);
  console.log(`   Grand Total: ${invoice.grandTotal}\n`);
}

main().catch((err) => {
  console.error('❌', err.response?.data?.message || err.message);
  process.exit(1);
});
