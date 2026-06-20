/**
 * Parent GL account 1120 — Cash Advance to Staff.
 * Kept separate from financeHelper to avoid circular requires with employeeAdvanceAccount.
 */
const Account = require('../models/finance/Account');
const AccountResolver = require('./accountResolver');

const STAFF_ADVANCE_ACCOUNT_NUMBER = '1120';

const ensureStaffAdvanceAccount = async (createdBy, companyId = null) => {
  let acc = companyId
    ? await AccountResolver.resolveSystemAccount(companyId, STAFF_ADVANCE_ACCOUNT_NUMBER)
    : null;
  if (!acc) {
    const query = { accountNumber: STAFF_ADVANCE_ACCOUNT_NUMBER };
    if (companyId) query.companyId = companyId;
    acc = await Account.findOne(query);
  }
  if (!acc) {
    acc = await Account.create({
      accountNumber: STAFF_ADVANCE_ACCOUNT_NUMBER,
      name: 'Cash Advance to Staff',
      type: 'Asset',
      category: 'Current Asset',
      detailType: 'Other Current Assets',
      description:
        'Temporary cash advances issued to procurement / staff for cash purchases. Cleared on settlement.',
      isSystem: true,
      isActive: true,
      companyId: companyId || undefined,
      createdBy
    });
  }
  return acc;
};

module.exports = {
  STAFF_ADVANCE_ACCOUNT_NUMBER,
  ensureStaffAdvanceAccount
};
