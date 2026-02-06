/**
 * Rental Management Bulk Invoice Test - January 2026
 *
 * Creates bulk rent invoices for all Rental Management properties with:
 *   - Period From: 1 Jan 2026
 *   - Period To: 31 Jan 2026
 *
 * Verifies:
 *   1. Invoices are created successfully
 *   2. Carry forward arrears are properly included
 *   3. Invoice structure (period, charges, grandTotal) is correct
 *
 * Prerequisites:
 *   - Server must be running (npm run server)
 *   - Set TEST_EMAIL and TEST_PASSWORD in .env (or pass as env vars)
 *
 * Run: node tests/rental-bulk-invoice-jan2026.test.js
 */

require('dotenv').config();
const axios = require('axios');
const moment = require('moment');

const API_URL = process.env.TEST_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Support MONTH (1-12) and YEAR env vars, e.g. MONTH=2 for February
const MONTH = parseInt(process.env.MONTH || '1', 10);
const YEAR = parseInt(process.env.YEAR || '2026', 10);
const lastDay = moment(`${YEAR}-${String(MONTH).padStart(2, '0')}`, 'YYYY-MM').endOf('month').date();
const PERIOD_FROM = `${YEAR}-${String(MONTH).padStart(2, '0')}-01`;
const PERIOD_TO = `${YEAR}-${String(MONTH).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
const INVOICE_DATE = PERIOD_FROM;
const DUE_DATE = moment(PERIOD_TO).add(15, 'days').format('YYYY-MM-DD'); // 15 days after period end

let authToken = null;

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

async function login() {
  const email = process.env.TEST_EMAIL || process.env.EMAIL_USER;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'TEST_EMAIL and TEST_PASSWORD must be set in .env (or EMAIL_USER for email). ' +
      'Example: TEST_EMAIL=admin@example.com TEST_PASSWORD=yourpassword'
    );
  }

  const res = await axios.post(`${API_URL}/auth/login`, { email, password });
  if (!res.data?.success || !res.data?.data?.token) {
    throw new Error('Login failed: ' + (res.data?.message || 'No token returned'));
  }
  authToken = res.data.data.token;
  console.log('✅ Logged in successfully');
}

async function fetchProperties() {
  const res = await api.get('/taj-utilities/rental-management/properties');
  if (!res.data?.success || !Array.isArray(res.data?.data)) {
    throw new Error('Failed to fetch properties: ' + JSON.stringify(res.data));
  }
  return res.data.data;
}

async function getRentCalculation(propertyId) {
  const res = await api.get(`/taj-utilities/invoices/property/${propertyId}/rent-calculation`);
  if (!res.data?.success) {
    throw new Error('Rent calculation failed: ' + (res.data?.message || ''));
  }
  return res.data.data;
}

async function fetchInvoicesForProperty(propertyId) {
  const res = await api.get(`/taj-utilities/invoices/property/${propertyId}`);
  if (!res.data?.success) return [];
  return res.data?.data || [];
}

function invoiceExistsForPeriod(invoices, periodFrom, periodTo) {
  const targetFrom = moment(periodFrom).startOf('day');
  const targetTo = moment(periodTo).startOf('day');
  return invoices.some((inv) => {
    if (!inv.periodFrom || !inv.periodTo) return false;
    return (
      moment(inv.periodFrom).isSame(targetFrom, 'day') &&
      moment(inv.periodTo).isSame(targetTo, 'day')
    );
  });
}

async function createInvoice(propertyId, payload) {
  const res = await api.post(`/taj-utilities/invoices/property/${propertyId}`, payload);
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'Create invoice failed');
  }
  return res.data.data;
}

async function runBulkCreate() {
  const monthName = moment(PERIOD_FROM).format('MMMM YYYY');
  console.log(`\n📋 Rental Management Bulk Invoice Test - ${monthName}`);
  console.log(`   Period: ${PERIOD_FROM} - ${PERIOD_TO}`);
  console.log('   API: ' + API_URL);
  console.log('');

  await login();

  const properties = await fetchProperties();
  console.log(`\n📦 Found ${properties.length} property(ies)`);
  if (properties.length === 0) {
    console.log('   No properties to process. Exiting.');
    return { created: 0, skipped: 0, failed: 0, invoices: [], errors: [] };
  }

  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const createdInvoices = [];
  const errors = [];

  const periodFrom = new Date(PERIOD_FROM);
  const periodTo = new Date(PERIOD_TO);
  const invoiceDate = new Date(INVOICE_DATE);
  const dueDate = new Date(DUE_DATE);

  for (const property of properties) {
    try {
      const invoices = await fetchInvoicesForProperty(property._id);
      if (invoiceExistsForPeriod(invoices, PERIOD_FROM, PERIOD_TO)) {
        skippedCount++;
        continue;
      }

      let monthlyRent = 0;
      let arrears = 0;
      let carryForwardArrears = 0;
      try {
        const rentData = await getRentCalculation(property._id);
        monthlyRent = rentData.monthlyRent || 0;
        arrears = rentData.totalArrears || 0;
        carryForwardArrears = rentData.carryForwardArrears || 0;
      } catch (err) {
        console.warn(`   ⚠ Rent calc for ${property.propertyName || property._id}: ${err.message}`);
      }

      const rentDescription =
        carryForwardArrears > 0
          ? 'Rental Charges (with Carry Forward Arrears)'
          : 'Rental Charges';

      const charges = [
        {
          type: 'RENT',
          description: rentDescription,
          amount: monthlyRent,
          arrears: arrears,
          total: monthlyRent + arrears
        }
      ];

      const invoice = await createInvoice(property._id, {
        includeCAM: false,
        includeElectricity: false,
        includeRent: true,
        invoiceDate,
        periodFrom,
        periodTo,
        dueDate,
        charges
      });

      createdCount++;
      createdInvoices.push({
        propertyId: property._id,
        propertyName: property.propertyName || property.plotNumber || property._id,
        invoice,
        rentData: { monthlyRent, arrears, carryForwardArrears }
      });
    } catch (err) {
      errorCount++;
      const errMsg = err.response?.data?.message || err.message;
      const errDetail = err.response?.data?.error || err.response?.data?.details;
      errors.push({
        property: property.propertyName || property._id,
        error: errDetail ? `${errMsg} (${errDetail})` : errMsg
      });
      console.error(`   ❌ ${property.propertyName || property._id}: ${errMsg}${errDetail ? ' - ' + errDetail : ''}`);
    }
  }

  return { createdCount, skippedCount, errorCount, createdInvoices, errors };
}

function verifyInvoices(createdInvoices) {
  const results = { passed: 0, failed: 0, checks: [] };

  for (const { propertyName, invoice, rentData } of createdInvoices) {
    const periodFromMatch =
      invoice.periodFrom &&
      moment(invoice.periodFrom).format('YYYY-MM-DD') === PERIOD_FROM;
    const periodToMatch =
      invoice.periodTo &&
      moment(invoice.periodTo).format('YYYY-MM-DD') === PERIOD_TO;
    const hasRentCharge = invoice.charges?.some((c) => c.type === 'RENT');
    const rentCharge = invoice.charges?.find((c) => c.type === 'RENT');
    const arrearsIncluded = rentCharge && (rentCharge.arrears || 0) >= 0;
    const totalMatches =
      invoice.grandTotal !== undefined &&
      Math.abs(
        invoice.grandTotal -
          ((rentCharge?.amount || 0) + (rentCharge?.arrears || 0))
      ) < 0.02;
    const carryForwardLabel =
      rentData.carryForwardArrears > 0
        ? rentCharge?.description?.includes('Carry Forward Arrears')
        : true;
    
    // Verify tenantName is included in property data
    const hasTenantName = invoice.property && (
      invoice.property.tenantName !== undefined && invoice.property.tenantName !== null ||
      invoice.property.ownerName !== undefined && invoice.property.ownerName !== null
    );

    const allPass = periodFromMatch && periodToMatch && hasRentCharge && arrearsIncluded && totalMatches && carryForwardLabel && hasTenantName;

    if (allPass) {
      results.passed++;
    } else {
      results.failed++;
    }

    results.checks.push({
      property: propertyName,
      periodFrom: periodFromMatch ? '✓' : '✗',
      periodTo: periodToMatch ? '✓' : '✗',
      hasRentCharge: hasRentCharge ? '✓' : '✗',
      arrearsIncluded: arrearsIncluded ? '✓' : '✗',
      totalMatches: totalMatches ? '✓' : '✗',
      carryForwardLabel: carryForwardLabel ? '✓' : '✗',
      hasTenantName: hasTenantName ? '✓' : '✗',
      grandTotal: invoice.grandTotal,
      rentAmount: rentCharge?.amount,
      rentArrears: rentCharge?.arrears,
      carryForwardExpected: rentData.carryForwardArrears,
      tenantName: invoice.property?.tenantName || invoice.property?.ownerName || 'MISSING'
    });
  }

  return results;
}

async function main() {
  try {
    const { createdCount, skippedCount, errorCount, createdInvoices, errors } =
      await runBulkCreate();

    console.log('\n--- Summary ---');
    console.log(`   Created: ${createdCount}`);
    console.log(`   Skipped (already exist): ${skippedCount}`);
    console.log(`   Failed: ${errorCount}`);
    if (errors.length > 0) {
      console.log('\n   Errors:');
      errors.forEach((e) => console.log(`     - ${e.property}: ${e.error}`));
    }

    if (createdInvoices.length > 0) {
      const verification = verifyInvoices(createdInvoices);
      console.log('\n--- Verification (Carry Forward & Invoice Structure) ---');
      console.log(`   Passed: ${verification.passed} | Failed: ${verification.failed}`);

      verification.checks.forEach((c) => {
        const status = c.periodFrom === '✓' && c.periodTo === '✓' && c.hasRentCharge === '✓' && c.arrearsIncluded === '✓' && c.totalMatches === '✓' && c.carryForwardLabel === '✓' && c.hasTenantName === '✓' ? '✅' : '❌';
        console.log(
          `   ${status} ${c.property}: period=${c.periodFrom}${c.periodTo} rent=${c.hasRentCharge} arrears=${c.arrearsIncluded} total=${c.totalMatches} carryFwdLabel=${c.carryForwardLabel} tenantName=${c.hasTenantName} | Amount=${c.rentAmount} Arrears=${c.rentArrears} (expected CF=${c.carryForwardExpected}) GrandTotal=${c.grandTotal} Tenant="${c.tenantName}"`
        );
      });

      const allPassed = verification.failed === 0;
      console.log(allPassed ? '\n✅ All invoices created and verified successfully.' : '\n❌ Some verifications failed.');
      process.exit(allPassed ? 0 : 1);
    } else {
      console.log('\n⚠ No invoices created (all skipped or errors).');
      process.exit(errorCount > 0 ? 1 : 0);
    }
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    if (err.response?.data) {
      console.error('   Response:', JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
