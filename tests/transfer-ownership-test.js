/**
 * Test property ownership transfer for srNo 1001
 * Run: node tests/transfer-ownership-test.js
 * Or: TEST_EMAIL=ceo@sgc.com TEST_PASSWORD=ceo12345 node tests/transfer-ownership-test.js
 */

require('dotenv').config();
const axios = require('axios');

const BASE = process.env.API_BASE_URL || 'http://localhost:5001/api';
const EMAIL = process.env.TEST_EMAIL || 'ceo@sgc.com';
const PASSWORD = process.env.TEST_PASSWORD || 'ceo12345';

// Property srNo 1001 _id (from earlier query)
const PROPERTY_ID = '695387635e337f03e88c72b6';
const NEW_OWNER = 'Test New Owner Transferred';
const NEW_CONTACT = '0300-1234567';
const NEW_TENANT = 'Test New Tenant';

async function login() {
  const res = await axios.post(`${BASE}/auth/login`, { email: EMAIL, password: PASSWORD }, {
    headers: { 'Content-Type': 'application/json' },
    validateStatus: () => true
  });
  if (res.status !== 200) throw new Error(`Login failed: ${res.status} - ${JSON.stringify(res.data)}`);
  const token = res.data?.data?.token || res.data?.token;
  if (!token) throw new Error('No token from login: ' + JSON.stringify(res.data));
  return token;
}

async function main() {
  console.log('1. Logging in...');
  const token = await login();
  const headers = { Authorization: `Bearer ${token}` };

  console.log('2. Fetching property before transfer...');
  const beforeRes = await axios.get(`${BASE}/taj-utilities/properties/${PROPERTY_ID}`, { headers });
  const before = beforeRes.data?.data || beforeRes.data;
  console.log('   Owner:', before.ownerName);
  console.log('   Contact:', before.contactNumber);
  console.log('   Tenant:', before.tenantName);
  console.log('   ownershipHistory count:', before.ownershipHistory?.length || 0);

  console.log('3. Transferring ownership...');
  const transferRes = await axios.post(
    `${BASE}/taj-utilities/properties/${PROPERTY_ID}/transfer-ownership`,
    {
      newOwnerName: NEW_OWNER,
      newContact: NEW_CONTACT,
      newTenantName: NEW_TENANT,
      notes: 'Automated test transfer'
    },
    { headers }
  );

  const updated = transferRes.data?.data || transferRes.data;
  console.log('   Response success:', !!transferRes.data?.success);

  console.log('4. Verifying property after transfer...');
  const afterRes = await axios.get(`${BASE}/taj-utilities/properties/${PROPERTY_ID}`, { headers });
  const after = afterRes.data?.data || afterRes.data;

  console.log('   Owner:', after.ownerName, after.ownerName === NEW_OWNER ? '✓' : '✗');
  console.log('   Contact:', after.contactNumber, after.contactNumber === NEW_CONTACT ? '✓' : '✗');
  console.log('   Tenant:', after.tenantName, after.tenantName === NEW_TENANT ? '✓' : '✗');
  console.log('   ownershipHistory count:', after.ownershipHistory?.length || 0);

  const lastEntry = after.ownershipHistory?.[after.ownershipHistory.length - 1];
  if (lastEntry) {
    console.log('   Last history entry:');
    console.log('     Previous Owner:', lastEntry.previousOwnerName);
    console.log('     New Owner:', lastEntry.newOwnerName);
    console.log('     Previous Tenant:', lastEntry.previousTenantName);
    console.log('     New Tenant:', lastEntry.newTenantName);
    console.log('     Effective Date:', lastEntry.effectiveDate);
  }

  const ok =
    after.ownerName === NEW_OWNER &&
    after.contactNumber === NEW_CONTACT &&
    after.tenantName === NEW_TENANT &&
    Array.isArray(after.ownershipHistory) &&
    after.ownershipHistory.length >= 1;

  console.log(ok ? '\n✅ Transfer test PASSED' : '\n❌ Transfer test FAILED');
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});
