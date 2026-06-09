import React from 'react';
import { Autocomplete, Grid, TextField, Typography } from '@mui/material';
import { userOptionLabel, userOptionSecondary } from '../../services/financeApprovalAuthorityService';

const PayrollApprovalAuthorityPicker = ({
  gmHrUser,
  onChange,
  candidateUsers = [],
  preparerName = '',
  disabled = false,
  title = 'Payroll approval authorities (required)'
}) => (
  <>
    <Grid item xs={12}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        Deputy Manager Payroll HR: <strong>{preparerName || 'You (preparer)'}</strong> — assigned automatically when you save.
        Select GM HR below.
      </Typography>
    </Grid>
    <Grid item xs={12} md={6}>
      <TextField
        fullWidth
        size="small"
        label="Deputy Manager Payroll HR"
        value={preparerName || 'You (preparer)'}
        disabled
        helperText="First approval authority (you)"
      />
    </Grid>
    <Grid item xs={12} md={6}>
      <Autocomplete
        disabled={disabled}
        options={candidateUsers}
        value={gmHrUser || null}
        onChange={(_, v) => onChange(v)}
        getOptionLabel={userOptionLabel}
        isOptionEqualToValue={(a, b) => String(a?._id || a?.id) === String(b?._id || b?.id)}
        noOptionsText={candidateUsers.length ? 'No match' : 'No users loaded'}
        renderOption={(props, option) => (
          <li {...props} key={option._id || option.id}>
            <Typography variant="body2">{userOptionLabel(option)}</Typography>
            {userOptionSecondary(option) ? (
              <Typography variant="caption" color="text.secondary" display="block">
                {userOptionSecondary(option)}
              </Typography>
            ) : null}
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="GM HR *"
            size="small"
            required
            helperText={candidateUsers.length ? `${candidateUsers.length} user(s)` : 'Loading users…'}
          />
        )}
      />
    </Grid>
  </>
);

export default PayrollApprovalAuthorityPicker;
