/**
 * Pay Invoices from Deposit - CAM Invoice Test
 *
 * Tests paying 1000 PKR to invoice INV-CMC-2026-01-1169 (or specified invoice) using
 * Pay Invoices from Deposit flow, then verifies the payment reflects correctly in
 * CAM Charges (invoices for property).
 *
 * Run: TEST_EMAIL=admin@example.com TEST_PASSWORD=yourpassword node tests/deposit-payment-cam-invoice.test.js
 *
 * Optional: INVOICE_NUMBER=INV-CMC-2026-01-1169 PAY_AMOUNT=1000
 */

require('dotenv').config();
const axios = require('axios');
const moment = require('moment');

const API_URL = process.env.TEST_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
const INVOICE_NUMBER = process.env.INVOICE_NUMBER || 'INV-CMC-2026-01-1169';
const PAY_AMOUNT = parseFloat(process.env.PAY_AMOUNT || '1000');

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
    throw new Error('TEST_EMAIL and TEST_PASSWORD must be set in .env');
  }
  const res = await axios.post(`${API_URL}/auth/login`, { email, password });
  if (!res.data?.success || !res.data?.data?.token) {
    throw new Error('Login failed: ' + (res.data?.message || 'No token returned'));
  }
  authToken = res.data.data.token;
  console.log('✅ Logged in successfully');
}

async function findInvoiceByNumber(invoiceNumber) {
  const res = await api.get('/taj-utilities/invoices', {
    params: { search: invoiceNumber, limit: 10 }
  });
  if (!res.data?.success || !Array.isArray(res.data?.data)) {
    throw new Error('Failed to fetch invoices: ' + JSON.stringify(res.data));
  }
  const invoice = res.data.data.find(
    (inv) => inv.invoiceNumber && inv.invoiceNumber.toUpperCase() === invoiceNumber.toUpperCase()
  );
  return invoice || null;
}

async function getResidentForProperty(propertyId, invoiceWithProperty) {
  // If invoice already has property.resident populated, use it
  if (invoiceWithProperty?.property?.resident) {
    const r = invoiceWithProperty.property.resident;
    return r._id || r;
  }

  // Fetch property to get resident
  const res = await api.get(`/taj-utilities/properties/${propertyId}`);
  if (!res.data?.success || !res.data?.data) {
    throw new Error('Failed to fetch property: ' + propertyId);
  }
  const property = res.data.data;
  const residentId = property.resident?._id || property.resident;
  if (residentId) return residentId;

  // Fallback: find resident whose properties include this property
  const residentsRes = await api.get('/taj-utilities/residents', { params: { limit: 500 } });
  const residents = Array.isArray(residentsRes.data?.data)
    ? residentsRes.data.data
    : residentsRes.data?.data?.residents || [];
  const resident = residents.find((r) => {
    const props = r.properties || [];
    return props.some((p) => (typeof p === 'object' ? p._id : p).toString() === propertyId.toString());
  });
  return resident ? resident._id : null;
}

async function getLedger(residentId) {
  const res = await api.get('/taj-utilities/residents/ledger', {
    params: { residentId: residentId.toString() }
  });
  if (!res.data?.success || !res.data?.data) {
    throw new Error('Failed to fetch ledger: ' + JSON.stringify(res.data));
  }
  return res.data.data;
}

function buildDepositUsages(transactions, amountNeeded) {
  const deposits = (transactions || []).filter(
    (t) => t.transactionType === 'deposit' && (t.remainingAmount || 0) > 0
  );
  // Sort by createdAt (FIFO)
  deposits.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  const usages = [];
  let remaining = amountNeeded;
  for (const dep of deposits) {
    if (remaining <= 0) break;
    const avail = dep.remainingAmount || 0;
    const use = Math.min(avail, remaining);
    if (use > 0 && dep._id) {
      usages.push({ depositId: dep._id, amount: Math.round(use * 100) / 100 });
      remaining -= use;
    }
  }
  return usages;
}

async function payBill(residentId, payload) {
  const res = await api.post(`/taj-utilities/residents/${residentId}/pay`, payload);
  return res.data;
}

async function fetchInvoicesForProperty(propertyId) {
  const res = await api.get(`/taj-utilities/invoices/property/${propertyId}`);
  if (!res.data?.success) return [];
  return res.data?.data || [];
}

async function main() {
  console.log('\n📋 Pay Invoices from Deposit - CAM Invoice Test');
  console.log(`   Invoice: ${INVOICE_NUMBER}`);
  console.log(`   Amount: ${PAY_AMOUNT} PKR`);
  console.log('   API:', API_URL);
  console.log('');

  await login();

  // 1. Find invoice
  const invoice = await findInvoiceByNumber(INVOICE_NUMBER);
  if (!invoice) {
    console.log(`❌ Invoice ${INVOICE_NUMBER} not found`);
    process.exit(1);
  }
  const propertyId = invoice.property?._id || invoice.property;
  if (!propertyId) {
    console.log('❌ Invoice has no property');
    process.exit(1);
  }
  console.log(`✅ Found invoice: ${invoice.invoiceNumber}`);
  console.log(`   Property: ${invoice.property?.propertyName || propertyId}`);
  console.log(`   Balance before: ${invoice.balance}`);
  console.log(`   Total paid before: ${invoice.totalPaid}`);
  console.log('');

  // 2. Get resident for property
  const residentId = await getResidentForProperty(propertyId, invoice);
  if (!residentId) {
    console.log('❌ No resident assigned to this property. Assign a resident first.');
    process.exit(1);
  }
  console.log(`✅ Resident ID: ${residentId}`);
  console.log('');

  // 3. Get ledger and build deposit usages
  const ledger = await getLedger(residentId);
  const usages = buildDepositUsages(ledger.transactions || [], PAY_AMOUNT);
  const totalAvailable = (ledger.transactions || [])
    .filter((t) => t.transactionType === 'deposit')
    .reduce((sum, t) => sum + (t.remainingAmount || 0), 0);

  if (usages.length === 0 || usages.reduce((s, u) => s + u.amount, 0) < PAY_AMOUNT - 0.01) {
    console.log(`❌ Insufficient deposit balance. Available: ${totalAvailable}, Needed: ${PAY_AMOUNT}`);
    console.log('   Add a deposit to the resident first.');
    process.exit(1);
  }
  console.log(`✅ Deposit usages: ${usages.length} deposit(s), total ${usages.reduce((s, u) => s + u.amount, 0)}`);
  console.log('');

  // 4. Pay bill
  const refType = (invoice.chargeTypes && invoice.chargeTypes[0]) || 'CAM';
  const allowedTypes = ['CAM', 'Electricity', 'Water', 'RENT', 'ELECTRICITY', 'Other'];
  const referenceType = allowedTypes.includes(refType) ? refType : 'CAM';

  await payBill(residentId, {
    amount: PAY_AMOUNT,
    referenceType,
    referenceId: String(invoice._id),
    referenceNumber: invoice.invoiceNumber || '',
    description: `CAM - ${invoice.invoiceNumber} (Test from Deposit)`,
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Bank Transfer',
    depositUsages: usages
  });
  console.log('✅ Payment submitted');
  console.log('');

  // 5. Refetch invoices for property (as CAM Charges does)
  const invoicesAfter = await fetchInvoicesForProperty(propertyId);
  const updatedInv = invoicesAfter.find(
    (inv) => inv.invoiceNumber && inv.invoiceNumber.toUpperCase() === INVOICE_NUMBER.toUpperCase()
  );

  if (!updatedInv) {
    console.log('⚠️ Invoice not found in property invoices after payment (may be filtered if fully paid)');
    console.log('   Checking if invoice is paid...');
    const allInv = await findInvoiceByNumber(INVOICE_NUMBER);
    if (allInv) {
      console.log(`   Invoice totalPaid: ${allInv.totalPaid}, balance: ${allInv.balance}`);
      const paidIncreased = (allInv.totalPaid || 0) >= (invoice.totalPaid || 0) + PAY_AMOUNT - 0.01;
      if (paidIncreased) {
        console.log('✅ PASS: totalPaid increased by payment amount');
      } else {
        console.log('❌ FAIL: totalPaid did not increase as expected');
        process.exit(1);
      }
    }
    process.exit(0);
  }

  // 6. Verify
  const totalPaidBefore = Number(invoice.totalPaid) || 0;
  const totalPaidAfter = Number(updatedInv.totalPaid) || 0;
  const balanceBefore = Number(invoice.balance) || 0;
  const balanceAfter = Number(updatedInv.balance) || 0;
  const paymentsCount = (updatedInv.payments || []).length;

  console.log('--- Verification (CAM Charges / Property Invoices) ---');
  console.log(`   Invoice #: ${updatedInv.invoiceNumber}`);
  console.log(`   Total Paid: ${totalPaidBefore} → ${totalPaidAfter} (expected +${PAY_AMOUNT})`);
  console.log(`   Balance: ${balanceBefore} → ${balanceAfter} (expected -${PAY_AMOUNT})`);
  console.log(`   Payments count: ${paymentsCount}`);

  const paidOk = Math.abs(totalPaidAfter - (totalPaidBefore + PAY_AMOUNT)) < 0.02;
  const balanceOk = Math.abs(balanceAfter - (balanceBefore - PAY_AMOUNT)) < 0.02;

  if (paidOk && balanceOk) {
    console.log('\n✅ PASS: Payment reflects correctly in CAM Charges / invoice data');
  } else {
    console.log('\n❌ FAIL: Payment did not reflect correctly');
    if (!paidOk) console.log(`   totalPaid expected ~${totalPaidBefore + PAY_AMOUNT}, got ${totalPaidAfter}`);
    if (!balanceOk) console.log(`   balance expected ~${balanceBefore - PAY_AMOUNT}, got ${balanceAfter}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Test failed:', err.response?.data?.message || err.message);
  if (err.response?.data) {
    console.error('   Response:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
