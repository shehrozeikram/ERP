/**
 * Light isolation checks for Executive Approvals Inbox.
 * Run: node server/scripts/verifyExecutiveInboxIsolation.js
 */
const {
  isDesignatedCeoApprover,
  hasCeoSecretariatAccess,
  hasCeoSecretariatCoordinatorAccess,
  userMatchesText,
  sameUserId
} = require('../utils/executiveAccess');

let passed = 0;
let failed = 0;

const assert = (name, cond) => {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
};

const fahad = {
  _id: 'fahad-id-001',
  firstName: 'Fahad',
  lastName: 'Farid',
  email: 'fahad@sgc.example',
  role: 'higher_management'
};

const ahmed = {
  _id: 'ahmed-id-002',
  firstName: 'Ahmed',
  lastName: 'Tasnim',
  email: 'ahmed@sgc.example',
  role: 'higher_management'
};

const ceoUser = {
  _id: 'ceo-id-003',
  firstName: 'CEO',
  lastName: 'User',
  email: 'ceo@sgc.example',
  role: 'ceo'
};

const admin = {
  _id: 'admin-id',
  email: 'admin@sgc.example',
  role: 'admin'
};

console.log('\n1) Designated CEO vs higher_management');
assert('Fahad is not designated CEO by role alone', !isDesignatedCeoApprover(fahad));
assert('Ahmed is not designated CEO by role alone', !isDesignatedCeoApprover(ahmed));
assert('role=ceo is designated', isDesignatedCeoApprover(ceoUser));
assert('admin override is designated', isDesignatedCeoApprover(admin));

console.log('\n2) Env-based CEO designate (temporary)');
const prevIds = process.env.CEO_USER_IDS;
const prevEmails = process.env.CEO_USER_EMAILS;
process.env.CEO_USER_IDS = 'fahad-id-001';
process.env.CEO_USER_EMAILS = '';
// Re-require would cache; call with mutated env — module reads env at call time
assert('Fahad is CEO when CEO_USER_IDS matches', isDesignatedCeoApprover(fahad));
assert('Ahmed still not CEO when only Fahad in CEO_USER_IDS', !isDesignatedCeoApprover(ahmed));
process.env.CEO_USER_IDS = '';
process.env.CEO_USER_EMAILS = 'ceo@sgc.example';
assert('Email designate works for CEO user', isDesignatedCeoApprover(ceoUser));
assert('Fahad not CEO after env cleared of his id', !isDesignatedCeoApprover(fahad));
if (prevIds === undefined) delete process.env.CEO_USER_IDS;
else process.env.CEO_USER_IDS = prevIds;
if (prevEmails === undefined) delete process.env.CEO_USER_EMAILS;
else process.env.CEO_USER_EMAILS = prevEmails;

console.log('\n3) CEO secretariat access narrowed');
assert('HM alone does NOT get secretariat list access', !hasCeoSecretariatAccess(fahad));
assert('HM alone is not coordinator', !hasCeoSecretariatCoordinatorAccess(fahad));
assert('CEO designate gets secretariat access', hasCeoSecretariatAccess(ceoUser));
assert('admin gets secretariat access', hasCeoSecretariatAccess(admin));

console.log('\n4) Active-approver matching helpers');
assert('sameUserId matches ObjectId strings', sameUserId(fahad._id, 'fahad-id-001'));
assert('sameUserId rejects cross-user', !sameUserId(fahad._id, ahmed._id));
assert('userMatchesText matches Fahad Farid', userMatchesText(fahad, 'Fahad Farid'));
assert('userMatchesText rejects Ahmed for Fahad name', !userMatchesText(fahad, 'Ahmed Tasnim'));

console.log('\n5) Forwarded-to-CEO inbox rule (simulated)');
const simulateCeoStepVisible = (user, status) => {
  if (status !== 'Forwarded to CEO') return false;
  return isDesignatedCeoApprover(user);
};
assert('Forwarded to CEO visible to CEO', simulateCeoStepVisible(ceoUser, 'Forwarded to CEO'));
assert('Forwarded to CEO hidden from Fahad', !simulateCeoStepVisible(fahad, 'Forwarded to CEO'));
assert('Forwarded to CEO hidden from Ahmed', !simulateCeoStepVisible(ahmed, 'Forwarded to CEO'));

console.log('\n6) Pending AVP assignment (simulated)');
const simulateAvpVisible = (user, doc) =>
  doc.workflowStatus === 'Pending AVP' && sameUserId(doc.assignedAvp, user._id);
const avpDoc = { workflowStatus: 'Pending AVP', assignedAvp: 'fahad-id-001' };
assert('Pending AVP assigned Fahad → Fahad only', simulateAvpVisible(fahad, avpDoc));
assert('Pending AVP assigned Fahad → not Ahmed', !simulateAvpVisible(ahmed, avpDoc));
assert('Pending AVP assigned Fahad → not CEO by assignment', !simulateAvpVisible(ceoUser, avpDoc));

console.log('\n7) Indent approvalChain pending (simulated)');
const simulateIndentVisible = (user, chain) =>
  (chain || []).some(
    (s) => String(s.status).toLowerCase() === 'pending' && sameUserId(s.approver, user._id)
  );
const chain = [
  { approver: 'ahmed-id-002', status: 'pending' },
  { approver: 'fahad-id-001', status: 'approved' }
];
assert('Indent pending Ahmed → Ahmed', simulateIndentVisible(ahmed, chain));
assert('Indent pending Ahmed → not Fahad', !simulateIndentVisible(fahad, chain));

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
