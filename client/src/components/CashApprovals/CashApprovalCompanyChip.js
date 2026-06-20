import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { Business as BusinessIcon } from '@mui/icons-material';
import { getCashApprovalCompanyLabel } from './cashApprovalGeneralDocumentUtils';

/** Read-only chip — which legal company's books this CA posts to. */
export default function CashApprovalCompanyChip({ ca, size = 'small', sx, className }) {
  const label = getCashApprovalCompanyLabel(ca);
  if (!label) return null;

  return (
    <Tooltip title="Finance company — vouchers and advances post to this company's books">
      <Chip
        className={className}
        icon={<BusinessIcon fontSize="small" />}
        label={`Finance: ${label}`}
        size={size}
        color="info"
        variant="outlined"
        sx={sx}
      />
    </Tooltip>
  );
}
