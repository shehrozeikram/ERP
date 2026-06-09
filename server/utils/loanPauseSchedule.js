const { sumUnpaidScheduleAmount } = require('./loanEmiRecalculation');

const round = (n) => Math.round(Number(n) || 0);

const matchesMonthYear = (date, month, year) => {
  const d = new Date(date);
  return d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year);
};

const addMonths = (date, count = 1) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + count);
  return d;
};

const sortPauses = (pauses = []) =>
  [...pauses].sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));

const getLatestDueDate = (schedule) => {
  if (!schedule.length) return new Date();
  return schedule.reduce((latest, item) => {
    const d = new Date(item.dueDate);
    return d > latest ? d : latest;
  }, new Date(schedule[0].dueDate));
};

const getBalanceBeforeInstallment = (installment) => {
  if (installment == null) return 0;
  if (typeof installment.balance === 'number' && typeof installment.principal === 'number') {
    return installment.balance + installment.principal;
  }
  return installment.amount || 0;
};

const getBalanceForExtension = (schedule) => {
  const base = schedule
    .filter((i) => !i.isPauseExtension)
    .sort((a, b) => a.installmentNumber - b.installmentNumber);

  for (let i = base.length - 1; i >= 0; i--) {
    const item = base[i];
    if (item.status === 'Paid') return Math.max(0, item.balance ?? 0);
    if (item.status === 'Partial') {
      return Math.max(0, item.balance ?? getBalanceBeforeInstallment(item) - (item.paidAmount || 0));
    }
  }

  const firstPending = base.find((i) => ['Pending', 'Overdue', 'Paused'].includes(i.status));
  if (firstPending) return getBalanceBeforeInstallment(firstPending);

  return 0;
};

const buildExtensionInstallment = (loan, schedule, installmentNumber, dueDate, pauseMonth, pauseYear) => {
  const emi = loan.monthlyInstallment || 0;
  const monthlyRate = (loan.interestRate || 0) / 100 / 12;
  let balance = getBalanceForExtension(schedule);

  if (balance <= 0) {
    balance = Math.max(0, loan.outstandingBalance || 0);
  }

  const interest = balance * monthlyRate;
  const amount = round(Math.min(emi, balance + interest));
  const principal = round(Math.max(0, amount - interest));
  const newBalance = round(Math.max(0, balance - principal));

  return {
    installmentNumber,
    dueDate: new Date(dueDate),
    amount,
    principal,
    interest: round(interest),
    balance: newBalance,
    status: 'Pending',
    isPauseExtension: true,
    pauseMonth: Number(pauseMonth),
    pauseYear: Number(pauseYear)
  };
};

const cloneScheduleItem = (item) => {
  const plain = item.toObject ? item.toObject() : { ...item };
  delete plain._id;
  return plain;
};

/**
 * Rebuild schedule pause markers + extension installments from loan.pausedMonths.
 * - Paused calendar months: matching pending installments marked Paused (no payroll that month).
 * - Each paused month appends one installment at the end of the schedule.
 */
const reconcileScheduleWithPauses = (loan) => {
  const pauses = sortPauses(loan.pausedMonths || []);
  let schedule = (loan.loanSchedule || []).map(cloneScheduleItem);

  schedule = schedule.filter((i) => !i.isPauseExtension);

  schedule = schedule.map((item) => {
    if (item.status === 'Paused') {
      return {
        ...item,
        status: 'Pending',
        pauseCalendarMonth: undefined,
        pauseCalendarYear: undefined
      };
    }
    return item;
  });

  for (const pause of pauses) {
    const { month, year } = pause;

    const target = schedule.find(
      (i) =>
        ['Pending', 'Overdue', 'Partial'].includes(i.status) &&
        matchesMonthYear(i.dueDate, month, year)
    );

    if (target) {
      target.status = 'Paused';
      target.pauseCalendarMonth = month;
      target.pauseCalendarYear = year;
    }

    const maxNumber = schedule.reduce((m, i) => Math.max(m, i.installmentNumber || 0), 0);
    const extensionDue = addMonths(getLatestDueDate(schedule), 1);

    schedule.push(
      buildExtensionInstallment(loan, schedule, maxNumber + 1, extensionDue, month, year)
    );
  }

  loan.loanSchedule = schedule;
  loan.loanTerm = schedule.length;
  loan.outstandingBalance = sumUnpaidScheduleAmount(schedule);
  loan.totalPayable = (loan.totalPaid || 0) + loan.outstandingBalance;

  return {
    pausedCount: pauses.length,
    totalInstallments: schedule.length,
    outstandingBalance: loan.outstandingBalance
  };
};

const assertPauseAllowed = (loan, month, year) => {
  const alreadyPaid = (loan.loanSchedule || []).some(
    (i) => i.status === 'Paid' && matchesMonthYear(i.dueDate, month, year)
  );
  if (alreadyPaid) {
    throw new Error(`Cannot pause ${month}/${year} — installment already paid for that month`);
  }
};

module.exports = {
  reconcileScheduleWithPauses,
  assertPauseAllowed,
  matchesMonthYear
};
