export const isPayrollProrated = (payroll = {}) => {
  if (payroll?.proration?.isProrated) return true;
  return /prorated/i.test(payroll?.remarks || '');
};

export const getPayrollProrationTooltip = (payroll = {}) => {
  if (payroll?.proration?.reason) return payroll.proration.reason;
  const remarks = payroll?.remarks || '';
  const match = remarks.match(/\(Prorated[^)]+\)/i);
  if (match) return match[0].replace(/^\(|\)$/g, '');
  if (remarks) return remarks;
  return 'First month salary prorated from date of joining';
};

export const getPayrollProrationLabel = (payroll = {}) => {
  const proration = payroll?.proration;
  if (proration?.isProrated && proration.payableDays && proration.daysInMonth) {
    return `Prorated ${proration.payableDays}/${proration.daysInMonth}`;
  }
  const match = (payroll?.remarks || '').match(/Prorated\s+(\d+\/\d+)/i);
  if (match) return `Prorated ${match[1]}`;
  return 'Prorated';
};
