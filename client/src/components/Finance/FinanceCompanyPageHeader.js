import React from 'react';
import { Stack, Typography } from '@mui/material';
import FinanceCompanySelector from './FinanceCompanySelector';

/** Page title row + finance company selector — reuse on all company-scoped finance pages. */
export default function FinanceCompanyPageHeader({
  title,
  icon: Icon,
  children,
  sx,
  selectorMinWidth = 220,
  showSelectorHelper = false
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', md: 'center' }}
      gap={2}
      mb={3}
      sx={sx}
      className="print-hide-toolbar"
    >
      <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1}>
        {Icon ? <Icon color="primary" /> : null}
        {title}
      </Typography>
      <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <FinanceCompanySelector showHelper={showSelectorHelper} minWidth={selectorMinWidth} />
        {children}
      </Stack>
    </Stack>
  );
}
