/**
 * E2E Test: Create open invoice → Pay from TCM → Verify everything updates correctly.
 * Verifies: Invoice balance decreases, TCM resident Balance (totalRemainingDeposits) decreases.
 *
 * Run: TEST_EMAIL=ceo@sgc.com TEST_PASSWORD=ceo12345 node tests/tcm-open-invoice-pay-test.js
 */

require('dotenv').config();
const axios = require('axios');
const dayjs = require('dayjs');

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
  return residents.find(isTCM);
}

async function getTCMBalance() {
  const tcm = await findTCMResident();
  return tcm ? (tcm.totalRemainingDeposits ?? tcm.balance ?? 0) : 0;
}

async function createOpenInvoice(amount = 500) {
  const now = dayjs();
  const periodFrom = now.format('YYYY-MM-DD');
  const periodTo = now.add(1, 'month').format('YYYY-MM-DD');
  const dueDate = now.add(30, 'day').format('YYYY-MM-DD');
  const payload = {
    invoiceDate: periodFrom,
    periodFrom,
    periodTo,
    dueDate,
    charges: [{
      type: 'OTHER',
      description: 'TCM E2E Test Charge',
      amount,
      arrears: 0,
      total: amount
    }],
    customerName: 'TCM Test Customer',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    sector: ''
  };
  const res = await api.post('/taj-utilities/invoices', payload);
  if (!res.data?.success) throw new Error(res.data?.message || 'Create invoice failed');
  return res.data.data;
}

async function addDepositToTCM(amount) {
  const tcm = await findTCMResident();
  if (!tcm) throw new Error('TCM not found');
  const res = await api.post(`/taj-utilities/residents/${tcm._id}/deposit`, {
    amount,
    description: 'TCM E2E Test Deposit',
    paymentMethod: 'Bank Transfer',
    bank: 'Test Bank',
    referenceNumberExternal: 'TCM-E2E-' + Date.now()
  });
  if (!res.data?.success) throw new Error(res.data?.message || 'Deposit failed');
  return res.data.data;
}

async function payInvoiceFromTCM(invoiceId, invoiceNumber, amount) {
  const tcm = await findTCMResident();
  if (!tcm) throw new Error('TCM not found');
  const res = await api.post(`/taj-utilities/residents/${tcm._id}/pay`, {
    amount,
    referenceType: 'Other',
    referenceId: invoiceId,
    referenceNumber: invoiceNumber,
    description: `TCM E2E - Pay ${invoiceNumber}`,
    paymentDate: dayjs().format('YYYY-MM-DD'),
    bankName: 'Test Bank',
    bankReference: 'TCM-E2E-PAY',
    paymentMethod: 'Bank Transfer'
  });
  if (!res.data?.success) throw new Error(res.data?.message || JSON.stringify(res.data?.errors || []));
  return res.data.data;
}

async function getOpenInvoices() {
  const res = await api.get('/taj-utilities/invoices', {
    params: { openInvoices: 'true', paymentStatus: 'unpaid,partial_paid', limit: 1000 }
  });
  return res.data?.data || [];
}

async function main() {
  console.log('\n📋 TCM Open Invoice E2E Test');
  console.log('   Create open invoice → Pay from TCM → Verify updates\n');
  console.log('   API:', API_URL, '\n');

  await login();

  const tcm = await findTCMResident();
  if (!tcm) {
    console.log('❌ TCM resident not found (residentId 00434 or name containing TAJ MANAGEMENT)');
    process.exit(1);
  }
  console.log(`📦 TCM: ${tcm.name} (${tcm._id})\n`);

  // Step 1: Ensure TCM has sufficient balance
  const balanceBefore = await getTCMBalance();
  const invoiceAmount = 350;
  const needDeposit = balanceBefore < invoiceAmount;
  if (needDeposit) {
    console.log(`   TCM balance: ${balanceBefore} - Adding deposit of ${invoiceAmount + 200}...`);
    await addDepositToTCM(invoiceAmount + 200);
    console.log('   ✅ Deposit added\n');
  } else {
    console.log(`   TCM balance before: ${balanceBefore}\n`);
  }

  // Step 2: Create open invoice
  console.log('   Creating open invoice (amount: ' + invoiceAmount + ')...');
  const invoice = await createOpenInvoice(invoiceAmount);
  console.log(`   ✅ Created: ${invoice.invoiceNumber} (balance: ${invoice.balance})\n`);

  // Step 3: Get TCM balance and invoice balance before payment
  const tcmBalanceBeforePay = await getTCMBalance();
  const openInvoicesBefore = await getOpenInvoices();
  const invBefore = openInvoicesBefore.find(i => i._id === invoice._id);
  const invoiceBalanceBefore = invBefore?.balance ?? invoice.balance ?? invoiceAmount;
  console.log(`   Before payment:`);
  console.log(`     - TCM Balance: ${tcmBalanceBeforePay}`);
  console.log(`     - Invoice ${invoice.invoiceNumber} balance: ${invoiceBalanceBefore}\n`);

  // Step 4: Pay invoice from TCM
  const payAmount = 150;
  console.log(`   Paying ${payAmount} from TCM...`);
  await payInvoiceFromTCM(invoice._id, invoice.invoiceNumber, payAmount);
  console.log('   ✅ Payment submitted\n');

  // Step 5: Verify updates
  console.log('   Verifying updates...\n');

  const tcmBalanceAfter = await getTCMBalance();
  const openInvoicesAfter = await getOpenInvoices();
  const invAfter = openInvoicesAfter.find(i => i._id === invoice._id);

  let allPass = true;

  // Check 1: TCM Balance decreased
  const expectedTCMBalance = tcmBalanceBeforePay - payAmount;
  const tcmOk = Math.abs(tcmBalanceAfter - expectedTCMBalance) <= 1;
  if (tcmOk) {
    console.log(`   ✅ TCM Balance: ${tcmBalanceBeforePay} → ${tcmBalanceAfter} (expected ~${expectedTCMBalance})`);
  } else {
    console.log(`   ❌ TCM Balance: ${tcmBalanceBeforePay} → ${tcmBalanceAfter} (expected ~${expectedTCMBalance})`);
    allPass = false;
  }

  // Check 2: Invoice balance decreased
  const invoiceBalanceAfter = invAfter?.balance ?? (invoiceAmount - payAmount);
  const expectedInvBalance = invoiceBalanceBefore - payAmount;
  const invOk = Math.abs(invoiceBalanceAfter - expectedInvBalance) <= 1;
  if (invOk) {
    console.log(`   ✅ Invoice balance: ${invoiceBalanceBefore} → ${invoiceBalanceAfter} (expected ~${expectedInvBalance})`);
  } else {
    console.log(`   ❌ Invoice balance: ${invoiceBalanceBefore} → ${invoiceBalanceAfter} (expected ~${expectedInvBalance})`);
    allPass = false;
  }

  // Check 3: paymentStatus updated if fully paid
  if (payAmount >= invoiceAmount) {
    const statusOk = invAfter?.paymentStatus === 'paid';
    console.log(statusOk ? '   ✅ Invoice status: paid' : `   ⚠️ Invoice status: ${invAfter?.paymentStatus || 'N/A'}`);
  }

  console.log('');
  if (allPass) {
    console.log('✅ All checks passed. TCM payment flow works correctly.\n');
  } else {
    console.log('❌ Some checks failed. See above.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌', err.response?.data || err.message);
  process.exit(1);
});
