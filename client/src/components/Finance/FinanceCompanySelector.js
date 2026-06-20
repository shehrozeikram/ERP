import React from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography
} from '@mui/material';
import { useFinanceCompany } from '../../context/FinanceCompanyContext';

export default function FinanceCompanySelector({
  sx = {},
  size = 'small',
  minWidth = 280,
  showHelper = true,
  required = true
}) {
  const {
    companies,
    selectedCompany,
    selectedCompanyId,
    loading,
    setSelectedCompanyId
  } = useFinanceCompany();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ...sx }}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">Loading companies…</Typography>
      </Box>
    );
  }

  if (!companies.length) {
    return (
      <Alert severity="warning" sx={sx}>
        No active legal companies found. Add companies under Finance → Companies first.
      </Alert>
    );
  }

  return (
    <Box sx={sx}>
      <FormControl size={size} sx={{ minWidth }} required={required}>
        <InputLabel id="finance-company-selector-label">Finance Company</InputLabel>
        <Select
          labelId="finance-company-selector-label"
          value={selectedCompanyId || ''}
          label="Finance Company"
          onChange={(e) => setSelectedCompanyId(e.target.value)}
        >
          {companies.map((company) => (
            <MenuItem key={company._id} value={company._id}>
              {company.name}
              {company.companyCode ? ` (${company.companyCode})` : ''}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {showHelper && selectedCompany ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
          Finance data is scoped to {selectedCompany.name}
          {selectedCompany.accountCount != null ? ` · ${selectedCompany.accountCount} COA account(s)` : ''}
        </Typography>
      ) : null}
    </Box>
  );
}
