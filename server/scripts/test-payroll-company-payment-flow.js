/**
 * Smoke test: company-wise payroll payment with Iftikhar auto-approve + GM voucher approval.
 * Usage: node server/scripts/test-payroll-company-payment-flow.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
require('../models/hr/Company');
const Payroll = require('../models/hr/Payroll');
const User = require('../models/User');
const {
  submitPayrollPeriodPayment,
  populateApplication,
  recordAuthorityApproval,
  recordAuthorityRejection,
  resolveIftikharAccountsManager
} = require('../utils/payrollPeriodPayment');
const { PAYROLL_FINAL_APPROVED_STATUSES } = require('../utils/payrollAuthorityPayrollStatus');

const run = async () => {
  const { uri, isLocal } = getMongoUri();
  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));

  const iftikhar = await resolveIftikharAccountsManager();
  console.log('Iftikhar:', iftikhar.firstName, iftikhar.lastName, iftikhar._id);

  const gm = await User.findOne({
    _id: { $ne: iftikhar._id },
    isActive: { $ne: false },
    role: { $in: ['admin', 'finance_manager', 'super_admin'] }
  }).select('_id firstName lastName role');

  if (!gm) throw new Error('No GM Finance test user found');
  console.log('GM user:', gm.firstName, gm.lastName, gm._id);

  const PayrollPeriodPaymentApplication = require('../models/finance/PayrollPeriodPaymentApplication');

  const pendingPayrolls = await Payroll.find({ status: { $in: PAYROLL_FINAL_APPROVED_STATUSES } })
    .populate({
      path: 'employee',
      select: 'placementCompany',
      populate: { path: 'placementCompany', select: 'name' }
    });

  if (!pendingPayrolls.length) throw new Error('No pending payroll found for test');

  let sample = null;
  for (const row of pendingPayrolls) {
    const companyName = row.employee?.placementCompany?.name || 'Unassigned';
    const existingPending = await PayrollPeriodPaymentApplication.findOne({
      month: row.month,
      year: row.year,
      companyName,
      workflowStatus: 'pending_authority'
    });
    if (!existingPending) {
      sample = row;
      break;
    }
  }

  if (!sample) {
    await PayrollPeriodPaymentApplication.deleteMany({
      reference: /^TEST-PAYROLL-/,
      workflowStatus: 'pending_authority'
    });
    sample = pendingPayrolls[0];
  }
  const companyName = sample.employee?.placementCompany?.name || 'Unassigned';
  const month = sample.month;
  const year = sample.year;

  await PayrollPeriodPaymentApplication.deleteMany({
    month,
    year,
    companyName,
    workflowStatus: 'pending_authority',
    'paymentMeta.reference': { $regex: /^TEST-PAYROLL-/ }
  });
  console.log('Testing period:', month, year, 'company:', companyName);

  const submit = await submitPayrollPeriodPayment(month, year, {
    companyName,
    paymentMethod: 'bank_transfer',
    reference: `TEST-PAYROLL-${Date.now()}`,
    financeControllerUser: gm._id,
    createdBy: iftikhar._id
  });

  const app = await populateApplication({ _id: submit.application._id });
  const approvals = app.financeAuthorityApprovals.map((a) => `${a.authorityKey}:${a.decision}`);
  console.log('Submitted BPV:', submit.journalEntry.entryNumber || submit.journalEntry._id);
  console.log('Auto approvals:', approvals.join(', '));

  const officerApproved = app.financeAuthorityApprovals.some(
    (a) => a.authorityKey === 'accountsOfficerUser'
  );
  if (officerApproved) throw new Error('Payroll BPV should not include Accounts Officer / AM');

  const amApproved = app.financeAuthorityApprovals.some(
    (a) => a.authorityKey === 'accountsManagerUser' && a.decision === 'approved'
  );
  if (!amApproved) throw new Error('Expected Sr Manager Accounts auto-approval');

  const gmPendingBefore = app.financeAuthorityApprovals.some(
    (a) => a.authorityKey === 'financeControllerUser'
  );
  if (gmPendingBefore) throw new Error('GM should still be pending before voucher approval');

  const approveResult = await recordAuthorityApproval(
    await populateApplication({ _id: app._id }),
    { _id: gm._id, id: gm._id },
    'GM test approval'
  );
  console.log('GM approve result:', approveResult);

  const finalized = await populateApplication({ _id: app._id });
  if (finalized.workflowStatus !== 'fully_approved') {
    throw new Error(`Expected fully_approved, got ${finalized.workflowStatus}`);
  }

  const paidCount = await Payroll.countDocuments({
    _id: { $in: finalized.payrollIds },
    status: 'Paid'
  });
  console.log('Paid payroll rows:', paidCount, '/', finalized.payrollIds.length);

  // Rejection path on a second company if available
  const second = await Payroll.findOne({
    status: { $in: PAYROLL_FINAL_APPROVED_STATUSES },
    month,
    year
  })
    .populate({
      path: 'employee',
      select: 'placementCompany',
      populate: { path: 'placementCompany', select: 'name' }
    });

  if (second) {
    const secondCompany = second.employee?.placementCompany?.name || 'Unassigned';
    if (secondCompany !== companyName) {
      const rejectSubmit = await submitPayrollPeriodPayment(month, year, {
        companyName: secondCompany,
        financeControllerUser: gm._id,
        createdBy: iftikhar._id
      });
      const rejectApp = await populateApplication({ _id: rejectSubmit.application._id });
      await recordAuthorityRejection(rejectApp, gm, 'Test rejection observation');
      const rejected = await populateApplication({ _id: rejectApp._id });
      if (rejected.workflowStatus !== 'rejected') throw new Error('Expected rejected workflow');
      if (!rejected.rejectionObservation) throw new Error('Expected rejection observation saved');
      console.log('Rejection path OK for', secondCompany);
    }
  }

  console.log('\nAll payroll company payment tests passed.');
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('TEST FAILED:', err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
