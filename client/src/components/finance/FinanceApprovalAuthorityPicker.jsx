import React from 'react';
import { Autocomplete, Grid, TextField, Typography } from '@mui/material';
import { userOptionLabel, userOptionSecondary } from '../../services/financeApprovalAuthorityService';

/**
 * Pick Sr Manager Accounts + GM Finance for AP settlement vouchers.
 * Accounts Officer / AM is always the logged-in preparer (not selectable).
 */
const FinanceApprovalAuthorityPicker = ({
  finAuth,
  onChange,
  candidateUsers = [],
  preparerName = '',
  disabled = false,
  title = 'Finance voucher signatures (required)'
}) => (
  <>
    <Grid item xs={12}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        Accounts Officer / AM: <strong>{preparerName || 'You (preparer)'}</strong> — assigned automatically when you submit.
        Choose Sr Manager and GM Finance below; these apply to this bill payment / advance voucher only.
      </Typography>
    </Grid>
    <Grid item xs={12} md={6}>
      <Autocomplete
        disabled={disabled}
        options={candidateUsers}
        value={finAuth?.accountsManagerUser || null}
        onChange={(_, v) => onChange({ ...finAuth, accountsManagerUser: v })}
        getOptionLabel={userOptionLabel}
        isOptionEqualToValue={(a, b) => String(a?._id || a?.id) === String(b?._id || b?.id)}
        noOptionsText={candidateUsers.length ? 'No match' : 'No finance users loaded — refresh or check User Management'}
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
            label="Sr Manager Accounts *"
            size="small"
            required
            helperText={candidateUsers.length ? `${candidateUsers.length} user(s)` : 'Loading users…'}
          />
        )}
      />
    </Grid>
    <Grid item xs={12} md={6}>
      <Autocomplete
        disabled={disabled}
        options={candidateUsers}
        value={finAuth?.financeControllerUser || null}
        onChange={(_, v) => onChange({ ...finAuth, financeControllerUser: v })}
        getOptionLabel={userOptionLabel}
        isOptionEqualToValue={(a, b) => String(a?._id || a?.id) === String(b?._id || b?.id)}
        noOptionsText={candidateUsers.length ? 'No match' : 'No finance users loaded — refresh or check User Management'}
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
          <TextField {...params} label="GM Finance *" size="small" required />
        )}
      />
    </Grid>
  </>
);

export default FinanceApprovalAuthorityPicker;
