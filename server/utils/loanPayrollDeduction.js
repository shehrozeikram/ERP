/**
 * Shared loan → payroll deduction rules.
 * Stops salary deduction once the loan principal/schedule is fully paid,
 * even if status was not flipped to Completed.
 */

const ACTIVE_LOAN_STATUSES = ['Active', 'Disbursed', 'Approved'];
const UNPAID_INSTALLMENT_STATUSES = ['Pending', 'Overdue', 'Partial'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Remaining amount still owed on a loan (schedule-aware). */
function getLoanRemainingBalance(loan) {
  if (!loan) return 0;

  let fromSchedule = null;
  if (Array.isArray(loan.loanSchedule) && loan.loanSchedule.length > 0) {
    fromSchedule = loan.loanSchedule.reduce((sum, inst) => {
      if (!UNPAID_INSTALLMENT_STATUSES.includes(inst.status)) return sum;
      const due = Number(inst.amount) || 0;
      const paid = Number(inst.paidAmount) || 0;
      return sum + Math.max(0, due - paid);
    }, 0);
    // All installments paid → nothing left to deduct
    if (fromSchedule <= 0.009) return 0;
  }

  const outstanding = Number(loan.outstandingBalance);
  if (Number.isFinite(outstanding) && outstanding <= 0.009) return 0;

  const totalPaid = Number(loan.totalPaid) || 0;
  const totalPayable = Number(loan.totalPayable) || Number(loan.loanAmount) || 0;
  const fromTotals = Math.max(0, round2(totalPayable - totalPaid));
  if (fromTotals <= 0.009) return 0;

  // Prefer the tighter of schedule remaining vs outstanding/totals
  const candidates = [fromTotals];
  if (Number.isFinite(outstanding) && outstanding > 0) candidates.push(outstanding);
  if (fromSchedule != null) candidates.push(fromSchedule);
  return round2(Math.max(0, Math.min(...candidates)));
}

function isLoanFullyPaid(loan) {
  if (!loan) return true;
  if (loan.status === 'Completed') return true;
  return getLoanRemainingBalance(loan) <= 0.009;
}

/**
 * Amount to deduct from payroll for this loan in month/year.
 * Returns 0 when paused, completed, or fully paid; otherwise EMI capped to remaining.
 */
function effectiveLoanDeductionForPayroll(loan, month, year) {
  if (!loan) return 0;
  if (!ACTIVE_LOAN_STATUSES.includes(loan.status)) return 0;

  const m = Number(month);
  const y = Number(year);
  if (
    Array.isArray(loan.pausedMonths) &&
    loan.pausedMonths.some((p) => Number(p.month) === m && Number(p.year) === y)
  ) {
    return 0;
  }

  const remaining = getLoanRemainingBalance(loan);
  if (remaining <= 0.009) return 0;

  const emi = Number(loan.monthlyInstallment) || 0;
  if (emi <= 0) return 0;

  return round2(Math.min(emi, remaining));
}

/** Mongo filter for loans that may still be deducted (status only — always check remaining in code). */
function activeLoanStatusFilter() {
  return { status: { $in: ACTIVE_LOAN_STATUSES } };
}

/**
 * If a loan looks fully paid but status is still Active/Disbursed, mark Completed.
 * Safe to call during payroll generation.
 */
async function markLoanCompletedIfPaid(loan) {
  if (!loan || loan.status === 'Completed') return false;
  if (!isLoanFullyPaid(loan)) return false;
  loan.status = 'Completed';
  loan.completionDate = loan.completionDate || new Date();
  loan.outstandingBalance = 0;
  await loan.save();
  return true;
}

module.exports = {
  ACTIVE_LOAN_STATUSES,
  getLoanRemainingBalance,
  isLoanFullyPaid,
  effectiveLoanDeductionForPayroll,
  activeLoanStatusFilter,
  markLoanCompletedIfPaid
};
