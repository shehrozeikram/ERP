/**
 * Recalculate remaining loan term and pending schedule when EMI is adjusted.
 */

const round = (n) => Math.round(Number(n) || 0);

/**
 * Months required to clear balance at fixed EMI (amortization).
 */
const calculateRemainingMonths = (outstandingPrincipal, emi, annualInterestRate) => {
  const balance = Math.max(0, Number(outstandingPrincipal));
  const payment = Number(emi);

  if (balance <= 0) return 0;
  if (!payment || payment <= 0) {
    throw new Error('EMI must be greater than zero');
  }

  const monthlyRate = (Number(annualInterestRate) || 0) / 100 / 12;

  if (monthlyRate === 0) {
    return Math.max(1, Math.ceil(balance / payment));
  }

  const minPayment = balance * monthlyRate;
  if (payment <= minPayment) {
    throw new Error(
      `EMI must exceed monthly interest (Rs ${Math.ceil(minPayment).toLocaleString()})`
    );
  }

  const months =
    -Math.log(1 - (balance * monthlyRate) / payment) / Math.log(1 + monthlyRate);

  return Math.max(1, Math.ceil(months));
};

const getRemainingPrincipal = (loan) => {
  const schedule = loan.loanSchedule || [];
  const active = schedule.filter((i) => ['Paid', 'Partial', 'Overdue'].includes(i.status));

  if (active.length > 0) {
    const last = active.reduce((a, b) => (a.installmentNumber > b.installmentNumber ? a : b));
    if (last.status === 'Partial') {
      return Math.max(0, last.balance ?? (last.amount - (last.paidAmount || 0)));
    }
    if (typeof last.balance === 'number') {
      return Math.max(0, last.balance);
    }
  }

  return Math.max(
    0,
    loan.outstandingBalance ?? ((loan.totalPayable || 0) - (loan.totalPaid || 0))
  );
};

const getNextDueDate = (loan, keptSchedule) => {
  if (keptSchedule.length > 0) {
    const last = keptSchedule.reduce((a, b) =>
      (a.installmentNumber > b.installmentNumber ? a : b)
    );
    const next = new Date(last.dueDate);
    next.setMonth(next.getMonth() + 1);
    return next;
  }

  const base = new Date(loan.disbursementDate || loan.applicationDate || Date.now());
  base.setMonth(base.getMonth() + 1);
  return base;
};

/**
 * Build pending installment rows from remaining principal at new EMI.
 */
const buildPendingSchedule = ({
  principal,
  emi,
  interestRate,
  months,
  startInstallmentNumber,
  startDueDate
}) => {
  const schedule = [];
  const monthlyRate = (Number(interestRate) || 0) / 100 / 12;
  let balance = Math.max(0, Number(principal));
  const payment = Number(emi);

  for (let i = 0; i < months; i++) {
    const installmentNumber = startInstallmentNumber + i;
    const dueDate = new Date(startDueDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    const interest = balance * monthlyRate;
    let amount = payment;
    let principalPart = payment - interest;

    if (i === months - 1 || principalPart >= balance) {
      amount = round(balance + interest);
      principalPart = balance;
      balance = 0;
    } else {
      principalPart = Math.max(0, principalPart);
      balance = Math.max(0, balance - principalPart);
    }

    schedule.push({
      installmentNumber,
      dueDate,
      amount: round(amount),
      principal: round(principalPart),
      interest: round(interest),
      balance: round(balance),
      status: 'Pending'
    });

    if (balance <= 0) break;
  }

  return schedule;
};

const sumUnpaidScheduleAmount = (schedule = []) =>
  schedule
    .filter((i) => ['Pending', 'Overdue', 'Partial', 'Paused'].includes(i.status))
    .reduce((sum, i) => {
      if (i.status === 'Partial') {
        return sum + Math.max(0, i.amount - (i.paidAmount || 0));
      }
      return sum + (i.amount || 0);
    }, 0);

module.exports = {
  calculateRemainingMonths,
  getRemainingPrincipal,
  getNextDueDate,
  buildPendingSchedule,
  sumUnpaidScheduleAmount
};
