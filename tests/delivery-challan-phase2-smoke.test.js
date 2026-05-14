/**
 * Smoke test for Phase 2 delivery challan APIs + PO grnRequiresDeliveryChallan flag.
 * Run: node tests/delivery-challan-phase2-smoke.test.js
 * Requires: API (e.g. localhost:5001), MongoDB, ceo@sgc.com / ceo12345
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');

const BASE = process.env.E2E_API_URL || 'http://localhost:5001/api';

function fail(msg, extra) {
  // eslint-disable-next-line no-console
  console.error(`✗ ${msg}`, extra || '');
  process.exit(1);
}
function ok(msg, extra) {
  // eslint-disable-next-line no-console
  console.log(`✓ ${msg}`, extra || '');
}

async function run() {
  const api = axios.create({ baseURL: BASE, timeout: 60000, validateStatus: () => true });
  const login = await api.post('/auth/login', { email: 'ceo@sgc.com', password: 'ceo12345' });
  if (!login.data?.data?.token) fail('Login failed', login.data);
  api.defaults.headers.Authorization = `Bearer ${login.data.data.token}`;
  ok('Login OK');

  const list = await api.get('/procurement/delivery-challans', { params: { limit: 5, page: 1 } });
  if (list.status !== 200 || !list.data?.success) fail('GET /delivery-challans failed', list.data);
  ok('GET /procurement/delivery-challans', { total: list.data?.data?.pagination?.totalItems });

  const posRes = await api.get('/procurement/purchase-orders', { params: { limit: 1, page: 1 } });
  const po = posRes.data?.data?.purchaseOrders?.[0];
  if (!po?._id) {
    ok('SKIP GET /purchase-orders/:id (no PO in list)');
    ok('TEST PASS (delivery challan smoke)');
    return;
  }

  const one = await api.get(`/procurement/purchase-orders/${po._id}`);
  if (one.status !== 200 || !one.data?.success || !one.data?.data) fail('GET /purchase-orders/:id failed', one.data);
  if (!Object.prototype.hasOwnProperty.call(one.data.data, 'grnRequiresDeliveryChallan')) {
    fail('PO detail missing grnRequiresDeliveryChallan', Object.keys(one.data.data).slice(0, 20));
  }
  if (!one.data.data.grnDcEligibility) fail('PO detail missing grnDcEligibility', one.data.data);
  ok('GET /purchase-orders/:id includes grnRequiresDeliveryChallan', {
    value: one.data.data.grnRequiresDeliveryChallan,
    orderNumber: one.data.data.orderNumber,
    counted: one.data.data.grnDcEligibility.countedAdvanceTotal,
    poTotal: one.data.data.grnDcEligibility.poTotal
  });

  ok('TEST PASS (delivery challan smoke)');
}

run().catch((e) => fail(e.message, e.response?.data || e.stack));
