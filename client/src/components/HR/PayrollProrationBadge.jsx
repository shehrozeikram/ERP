import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import {
  getPayrollProrationBadgeColor,
  getPayrollProrationLabel,
  getPayrollProrationTooltip,
  isPayrollProrated
} from '../../utils/payrollProrationUtils';

const PayrollProrationBadge = ({ payroll, size = 'small', sx }) => {
  if (!isPayrollProrated(payroll)) return null;

  return (
    <Tooltip title={getPayrollProrationTooltip(payroll)} arrow>
      <Chip
        label={getPayrollProrationLabel(payroll)}
        size={size}
        color={getPayrollProrationBadgeColor(payroll)}
        variant="outlined"
        sx={{ fontWeight: 600, ...sx }}
      />
    </Tooltip>
  );
};

export default PayrollProrationBadge;
