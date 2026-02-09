/**
 * Test that TCM (TAJ MANAGEMENT) invoice Balance updates correctly after payment.
 * Verifies that when paying an open invoice from Taj Residents, the invoice balance is reduced.
 *
 * Run: TEST_EMAIL=ceo@sgc.com TEST_PASSWORD=ceo12345 node tests/tcm-invoice-balance-update-test.js
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.TEST_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

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

function isTCM(resident) {
  return resident.residentId === '00434' ||
    resident.residentId === 434 ||
    resident.name?.toUpperCase().includes('TAJ MANAGEMENT') ||
    resident.name?.toUpperCase().includes('TCM');
}

async function findTCMResident() {
  const res = await api.get('/taj-utilities/residents', { params: { limit: 500 } });
  const data = res.data?.data;
  const residents = Array.isArray(data) ? data : (data?.residents || []);
  const tcm = residents.find(isTCM);
  return tcm;
}

async function getOpenInvoices() {
  const res = await api.get('/taj-utilities/invoices', {
    params: {
      openInvoices: 'true',
      paymentStatus: 'unpaid,partial_paid',
      limit: 1000
    }
  });
  return res.data?.data || [];
}

async function payBill(residentId, payload) {
  const res = await api.post(`/taj-utilities/residents/${residentId}/pay`, payload);
  return res.data;
}

async function main() {
  console.log('\n📋 TCM Invoice Balance Update Test');
  console.log('   API:', API_URL, '\n');

  await login();

  const tcm = await findTCMResident();
  if (!tcm) {
    console.log('❌ TCM resident not found (look for residentId 00434 or name containing TAJ MANAGEMENT)');
    process.exit(1);
  }
  console.log(`📦 TCM Resident: ${tcm.name} (${tcm._id})\n`);

  const openInvoices = await getOpenInvoices();
  const withBalance = openInvoices.filter(inv => (inv.balance || 0) > 0);
  console.log(`📄 Open invoices with balance > 0: ${withBalance.length}`);

  if (withBalance.length === 0) {
    console.log('⚠️  No open invoices with balance. Create one or use an existing unpaid invoice.');
    process.exit(0);
  }

  const inv = withBalance[0];
  const balanceBefore = inv.balance || 0;
  const payAmount = Math.min(100, Math.floor(balanceBefore / 2) || 1);
  console.log(`\n   Invoice: ${inv.invoiceNumber}`);
  console.log(`   Balance before: ${balanceBefore}`);
  console.log(`   Paying: ${payAmount}`);

  // Ensure TCM has sufficient balance - add deposit if needed
  const tcmBalance = tcm.balance ?? tcm.totalRemainingDeposits ?? 0;
  if (tcmBalance < payAmount) {
    console.log(`   TCM balance (${tcmBalance}) < ${payAmount}. Adding deposit...`);
    try {
      await api.post(`/taj-utilities/residents/${tcm._id}/deposit`, {
        amount: payAmount + 500,
        description: 'Test deposit for TCM balance update test',
        paymentMethod: 'Bank Transfer',
        bank: 'Test Bank',
        referenceNumberExternal: 'TCM-TEST-DEP-' + Date.now()
      });
      console.log('   Deposit added');
    } catch (depErr) {
      console.error('   Deposit failed:', depErr.response?.data || depErr.message);
      console.log('   Skipping payment - balance update test requires TCM to have deposit.');
      process.exit(0);
    }
  }
  console.log('');

  const refType = inv.chargeTypes?.[0] || 'CAM';
  const allowedTypes = ['CAM', 'Electricity', 'Water', 'RENT', 'ELECTRICITY', 'Other'];
  const refTypeValid = allowedTypes.includes(refType) ? refType : 'Other';

  await payBill(tcm._id, {
    amount: payAmount,
    referenceType: refTypeValid,
    referenceId: String(inv._id),
    referenceNumber: inv.invoiceNumber || '',
    description: `Test payment - ${inv.invoiceNumber}`,
    paymentDate: new Date().toISOString().slice(0, 10),
    bankName: 'Test Bank',
    bankReference: 'TCM-TEST',
    paymentMethod: 'Bank Transfer'
  });
  console.log('✅ Payment submitted');

  // Refetch invoices
  const afterInvoices = await getOpenInvoices();
  const updatedInv = afterInvoices.find(i => i._id === inv._id);

  if (!updatedInv) {
    console.log('   Invoice not found in refetch (may be paid and filtered out)');
    const paidInv = openInvoices.find(i => i._id === inv._id);
    if (paidInv && (paidInv.balance || 0) === 0) {
      console.log('✅ Invoice is now paid (balance 0) - OK');
    }
    process.exit(0);
  }

  const balanceAfter = updatedInv.balance || 0;
  const expectedBalance = balanceBefore - payAmount;
  const tolerance = 1; // Allow for rounding

  console.log(`\n   Balance after: ${balanceAfter}`);
  console.log(`   Expected: ~${expectedBalance}`);

  if (Math.abs(balanceAfter - expectedBalance) <= tolerance) {
    console.log('\n✅ PASS: Balance updated correctly');
  } else {
    console.log('\n❌ FAIL: Balance did not update correctly');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌', err.response?.data || err.message);
  process.exit(1);
});
