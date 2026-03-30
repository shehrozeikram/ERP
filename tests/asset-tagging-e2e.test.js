/**
 * Simple E2E: login → fixed asset → issue tag → resolve → log scan → dashboard.
 * Run: npm run test:asset-tagging-e2e
 * Requires: API (e.g. localhost:5001/api), MongoDB, ceo@sgc.com / ceo12345
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');

const BASE = process.env.E2E_API_URL || 'http://localhost:5001/api';

const log = (ok, msg, extra) => {
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${msg}`, extra !== undefined ? extra : '');
};

async function main() {
  const results = { pass: 0, fail: 0 };
  const api = axios.create({
    baseURL: BASE,
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000,
    validateStatus: () => true
  });

  const loginRes = await api.post('/auth/login', {
    email: 'ceo@sgc.com',
    password: 'ceo12345'
  });
  if (loginRes.status !== 200 || !loginRes.data?.success || !loginRes.data?.data?.token) {
    log(false, 'Login failed', loginRes.data);
    process.exit(1);
  }
  api.defaults.headers.Authorization = `Bearer ${loginRes.data.data.token}`;
  log(true, 'Login (ceo@sgc.com)');
  results.pass++;

  const stamp = Date.now();

  // Dashboard (empty ok)
  const dash = await api.get('/asset-tagging/dashboard-stats');
  if (!dash.data?.success) {
    log(false, 'Dashboard stats failed', dash.data);
    results.fail++;
    process.exit(1);
  }
  log(true, 'Dashboard stats', { activeAssets: dash.data.data?.activeAssets, tagged: dash.data.data?.taggedActive });
  results.pass++;

  // Fixed asset: use first active or create one
  let faRes = await api.get('/finance/fixed-assets', { params: { status: 'active' } });
  let assets = faRes.data?.data || [];
  let asset = assets[0];

  if (!asset) {
    const today = new Date().toISOString().split('T')[0];
    const createRes = await api.post('/finance/fixed-assets', {
      name: `E2E Tag ${stamp}`,
      purchaseDate: today,
      purchaseCost: 5000,
      category: 'equipment',
      location: 'E2E Lab',
      assignedTo: 'E2E Test',
      depreciationMethod: 'straight_line',
      usefulLifeYears: 5,
      residualValue: 0
    });
    if (createRes.status !== 201 || !createRes.data?.success) {
      log(false, 'Create fixed asset failed', createRes.data);
      process.exit(1);
    }
    asset = createRes.data.data;
    log(true, `Created fixed asset ${asset.assetNumber}`, { name: asset.name });
    results.pass++;
  } else {
    log(true, `Using existing asset ${asset.assetNumber}`, { name: asset.name });
    results.pass++;
  }

  const assetId = asset._id;

  // Void existing tag if any (clean run)
  const tagStatus = await api.get(`/asset-tagging/assets/${assetId}`);
  const current = tagStatus.data?.data?.currentTag;
  if (current) {
    const voidRes = await api.post(`/asset-tagging/assets/${assetId}/void-tag`, {
      reason: 'E2E test reset'
    });
    if (voidRes.status !== 200 || !voidRes.data?.success) {
      log(false, 'Void tag (optional) failed', voidRes.data);
      results.fail++;
    } else {
      log(true, 'Voided previous tag for clean test');
      results.pass++;
    }
  }

  // Issue tag
  const issueRes = await api.post(`/asset-tagging/assets/${assetId}/issue-tag`, { note: 'E2E issue' });
  if (issueRes.status !== 201 || !issueRes.data?.success) {
    log(false, 'Issue tag failed', issueRes.data);
    results.fail++;
    process.exit(1);
  }
  const tagCode = issueRes.data.data.tag.tagCode;
  log(true, `Tag issued`, { tagCode, scanUrl: issueRes.data.data.scanUrl });
  results.pass++;

  // Resolve by tag
  const enc = encodeURIComponent(tagCode);
  const resolveRes = await api.get(`/asset-tagging/resolve/${enc}`);
  if (resolveRes.status !== 200 || !resolveRes.data?.success) {
    log(false, 'Resolve tag failed', resolveRes.data);
    results.fail++;
    process.exit(1);
  }
  log(true, 'Resolve tag → asset', { assetNumber: resolveRes.data.data?.asset?.assetNumber });
  results.pass++;

  // Log scan
  const scanRes = await api.post('/asset-tagging/scan', { tagCode, note: 'E2E scan' });
  if (scanRes.status !== 200 || !scanRes.data?.success) {
    log(false, 'Scan log failed', scanRes.data);
    results.fail++;
    process.exit(1);
  }
  log(true, 'Scan event recorded');
  results.pass++;

  // Custody update
  const putRes = await api.put(`/asset-tagging/assets/${assetId}/custody`, {
    location: 'E2E Lab — verified',
    assignedTo: 'E2E Test',
    note: 'E2E transfer'
  });
  if (putRes.status !== 200 || !putRes.data?.success) {
    log(false, 'Custody update failed', putRes.data);
    results.fail++;
    process.exit(1);
  }
  log(true, 'Location / custodian updated');
  results.pass++;

  // Events list
  const evRes = await api.get('/asset-tagging/events', { params: { limit: 10 } });
  if (!evRes.data?.success) {
    log(false, 'Events list failed', evRes.data);
    results.fail++;
    process.exit(1);
  }
  const evCount = (evRes.data.data || []).length;
  log(true, `Recent tag events (${evCount} rows in last fetch)`);
  results.pass++;

  // QR payload (optional)
  const qrRes = await api.get(`/asset-tagging/label-qr/${enc}`);
  if (qrRes.status !== 200 || !qrRes.data?.data?.dataUrl) {
    log(false, 'Label QR failed', qrRes.data);
    results.fail++;
    process.exit(1);
  }
  log(true, 'Label QR generated (data URL)');
  results.pass++;

  console.log('\n--- Asset Tagging E2E ---');
  console.log(`Passed: ${results.pass}, Failed: ${results.fail}`);
  console.log('Module check: login → FA → issue tag → resolve → scan → custody → events → QR — all OK.');
  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
