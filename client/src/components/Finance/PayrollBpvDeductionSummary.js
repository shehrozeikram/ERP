import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import { formatPKR } from '../../utils/currency';
import { buildPayrollDeductionSummary } from '../../utils/payrollFinanceSummaryReport';

const PayrollBpvDeductionSummary = ({
  breakdown,
  periodLabel = '',
  companyName = '',
  employeeCount = null,
  compact = false,
  embedded = false
}) => {
  const summary = useMemo(() => buildPayrollDeductionSummary(breakdown), [breakdown]);

  if (!summary?.grossSalary && !summary?.hasAllowances && !summary?.hasDeductions && !summary?.netPayable) {
    return null;
  }

  const table = (
    <Table size="small" sx={embedded ? { mb: 2 } : undefined}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 700 }}>Particulars</TableCell>
          <TableCell align="right" sx={{ fontWeight: 700 }}>Amount (PKR)</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {summary.hasAllowances ? (
          <>
            <TableRow>
              <TableCell colSpan={2} sx={{ fontWeight: 600, pt: 1, pb: 0.5, bgcolor: embedded ? 'grey.50' : undefined }}>
                Earnings &amp; Allowances
              </TableCell>
            </TableRow>
            {summary.allowances.map((row) => (
              <TableRow key={row.key}>
                <TableCell sx={{ pl: 3 }}>{row.label}</TableCell>
                <TableCell align="right">{formatPKR(row.amount)}</TableCell>
              </TableRow>
            ))}
          </>
        ) : null}
        <TableRow>
          <TableCell sx={{ fontWeight: 600 }}>Gross Salary Payable</TableCell>
          <TableCell align="right" sx={{ fontWeight: 600 }}>{formatPKR(summary.grossSalary)}</TableCell>
        </TableRow>
        {summary.hasDeductions ? (
          <>
            <TableRow>
              <TableCell colSpan={2} sx={{ fontWeight: 600, pt: 1.5, pb: 0.5, bgcolor: embedded ? 'grey.50' : undefined }}>
                Deductions
              </TableCell>
            </TableRow>
            {summary.deductions.map((row) => (
              <TableRow key={row.key}>
                <TableCell sx={{ pl: 3 }}>Less: {row.label}</TableCell>
                <TableCell align="right">{formatPKR(row.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Total Deductions</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>{formatPKR(summary.totalDeductions)}</TableCell>
            </TableRow>
          </>
        ) : null}
        <TableRow>
          <TableCell sx={{ fontWeight: 700 }}>Net Bank Payment</TableCell>
          <TableCell align="right" sx={{ fontWeight: 700 }}>{formatPKR(summary.netPayable)}</TableCell>
        </TableRow>
        {summary.eobiEmployerExpense > 0 ? (
          <TableRow>
            <TableCell sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
              EOBI Expense (separate BPV debit)
            </TableCell>
            <TableCell align="right" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
              {formatPKR(summary.eobiEmployerExpense)}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );

  if (embedded) {
    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
          Salary Schedule
        </Typography>
        {(companyName || periodLabel || employeeCount != null) ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {companyName ? <strong>{companyName}</strong> : null}
            {periodLabel ? `${companyName ? ' · ' : ''}${periodLabel}` : null}
            {employeeCount != null ? ` · ${employeeCount} employee${employeeCount === 1 ? '' : 's'}` : null}
          </Typography>
        ) : null}
        {table}
      </Box>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: compact ? 1.5 : 2, mb: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
        Payroll Summary
      </Typography>
      {(companyName || periodLabel || employeeCount != null) ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {companyName ? <strong>{companyName}</strong> : null}
          {periodLabel ? `${companyName ? ' · ' : ''}${periodLabel}` : null}
          {employeeCount != null ? ` · ${employeeCount} employee${employeeCount === 1 ? '' : 's'}` : null}
        </Typography>
      ) : null}
      {table}
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Schedule shows gross, allowances, and deductions. These were accrued at payroll approval; the BPV pays net bank only.
        </Typography>
      </Box>
    </Paper>
  );
};

export default PayrollBpvDeductionSummary;
