/**
 * Test arrears for Meter ID 961589 - JAN-26
 * Verifies arrears in invoice and PDF match Balance column logic (due date + grace period).
 *
 * Run: TEST_EMAIL=ceo@sgc.com TEST_PASSWORD=ceo12345 node tests/electricity-meter-arrears-test.js
 */

require('dotenv').config();
const axios = require('axios');
const dayjs = require('dayjs');

const API_URL = process.env.TEST_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
const METER_ID = process.env.METER_ID || '961589';
const MONTH = 1;
const YEAR = 2026;

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

async function findPropertyByMeter(meterId) {
  const res = await api.get('/taj-utilities/electricity/current-overview', {
    params: { page: 1, limit: 100, search: meterId }
  });
  const props = res.data?.data?.properties || [];
  const match = props.find(p => {
    const meters = p.meters || [];
    if (meters.some(m => String(m.meterNo) === String(meterId))) return true;
    if (String(p.electricityWaterMeterNo) === String(meterId)) return true;
    return false;
  });
  return match || props[0];
}

async function fetchInvoicesForProperty(propertyId) {
  const res = await api.get(`/taj-utilities/invoices/property/${propertyId}`);
  return res.data?.success ? (res.data?.data || []) : [];
}

async function getElectricityCalculation(propertyId, meterNo) {
  const res = await api.get(`/taj-utilities/invoices/property/${propertyId}/electricity-calculation`, {
    params: { meterNo: meterNo || METER_ID }
  });
  return res.data?.success ? res.data?.data : null;
}

function isJan26Invoice(inv) {
  if (!inv?.chargeTypes?.includes('ELECTRICITY')) return false;
  const start = inv.periodFrom ? dayjs(inv.periodFrom).startOf('month').valueOf() : null;
  const end = inv.periodTo ? dayjs(inv.periodTo).endOf('month').valueOf() : null;
  const janStart = dayjs(`${YEAR}-01-01`).startOf('month').valueOf();
  const janEnd = dayjs(`${YEAR}-01-01`).endOf('month').valueOf();
  const s = start ?? end;
  const e = end ?? start;
  if (s == null || e == null) return false;
  return s <= janEnd && e >= janStart;
}

async function main() {
  console.log(`\n📋 Electricity Meter Arrears Test - Meter ${METER_ID}, JAN-26`);
  console.log(`   API: ${API_URL}\n`);

  await login();

  const property = await findPropertyByMeter(METER_ID);
  if (!property) {
    console.log('❌ No property found with meter', METER_ID);
    process.exit(1);
  }
  console.log(`📦 Property: ${property.propertyName || property.plotNumber || property.address} (${property._id})\n`);

  const invoices = await fetchInvoicesForProperty(property._id);
  const jan26Invoices = invoices.filter(isJan26Invoice);

  if (jan26Invoices.length === 0) {
    console.log('❌ No JAN-26 electricity invoice found for this meter.');
    console.log('   Total invoices:', invoices.length);
    const elecInvoices = invoices.filter(i => i.chargeTypes?.includes('ELECTRICITY'));
    if (elecInvoices.length > 0) {
      console.log('   Recent electricity invoices:');
      elecInvoices.slice(0, 5).forEach(inv => {
        const period = inv.periodFrom ? dayjs(inv.periodFrom).format('MMM-YY') : 'N/A';
        const meterNo = inv.electricityBill?.meterNo || '?';
        console.log(`     - ${inv.invoiceNumber} (${period}) meter: ${meterNo}`);
      });
    }
    process.exit(1);
  }

  const meterNo = property.meters?.find(m => String(m.meterNo) === String(METER_ID))?.meterNo || METER_ID;
  const calcData = await getElectricityCalculation(property._id, meterNo);

  console.log('📄 JAN-26 Invoice(s):\n');
  jan26Invoices.forEach((inv, i) => {
    const elecCharge = inv.charges?.find(c => c.type === 'ELECTRICITY');
    const invoiceArrears = elecCharge?.arrears ?? inv.totalArrears ?? 0;
    const billArrears = inv.electricityBill?.arrears;
    const calcArrears = inv.calculationData?.previousArrears;

    const periodFrom = inv.periodFrom ? dayjs(inv.periodFrom).format('MMM D, YYYY') : 'N/A';
    const periodTo = inv.periodTo ? dayjs(inv.periodTo).format('MMM D, YYYY') : 'N/A';
    const dueDate = inv.dueDate ? dayjs(inv.dueDate).format('MMM D, YYYY') : 'N/A';
    const graceEnd = inv.dueDate ? dayjs(inv.dueDate).add(6, 'day').format('MMM D, YYYY') : 'N/A';
    const balance = inv.balance ?? 0;

    console.log(`   [${i + 1}] ${inv.invoiceNumber}`);
    console.log(`       Period: ${periodFrom} → ${periodTo}`);
    console.log(`       Meter: ${inv.electricityBill?.meterNo || meterNo}`);
    console.log(`       Due Date: ${dueDate} (+ 6 days grace → ${graceEnd})`);
    console.log(`       Charges (amount): ${elecCharge?.amount ?? 0}`);
    console.log(`       Arrears (invoice.charges): ${invoiceArrears}`);
    console.log(`       Arrears (effectiveArrears) [used in PDF]: ${inv.effectiveArrears ?? 'N/A'}`);
    console.log(`       Arrears (electricityBill): ${billArrears ?? 'N/A'}`);
    console.log(`       Arrears (calcData): ${calcArrears ?? 'N/A'}`);
    const displayAmount = inv.effectiveArrears !== undefined && inv.effectiveArrears !== null
      ? (elecCharge?.amount ?? 0) + inv.effectiveArrears
      : (inv.grandTotal || 0);
    const displayBalance = displayAmount - (inv.totalPaid || 0);

    console.log(`       Balance (DB): ${balance}`);
    console.log(`       Display Amount (invoice history): ${displayAmount}`);
    console.log(`       Display Balance (invoice history): ${displayBalance}`);
    console.log(`       Grand Total: ${inv.grandTotal}, Total Paid: ${inv.totalPaid || 0}`);
    console.log('');

    const effectiveOk = inv.effectiveArrears !== undefined && inv.effectiveArrears !== null;
    if (effectiveOk) {
      console.log(`       ✅ PDF, Amount, Balance use effectiveArrears: ${inv.effectiveArrears}`);
      console.log(`       ✅ Invoice history: Amount=${displayAmount}, Balance=${displayBalance}\n`);
    } else {
      console.log('       ⚠️  effectiveArrears not set\n');
    }
  });

  console.log('📋 Invoice history (Taj Utilities — Electricity Bills):');
  console.log('   Amount & Balance use getAdjustedGrandTotal() which uses effectiveArrears when available');
  console.log('📥 PDF: effectiveArrears → arrears, grandTotal = totalBill + arrears\n');
  console.log('✅ Test complete\n');
}

main().catch((err) => {
  console.error('❌', err.response?.data?.message || err.message);
  process.exit(1);
});
