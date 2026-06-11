import React from 'react';
import { Grid, Typography } from '@mui/material';
import { formatPKR } from '../utils/currency';
import { computeAutoSalaryBreakdown } from '../utils/salaryBreakdown';

const AutoCalculatedSalaryBreakdown = ({ gross = 0, dense = false }) => {
  const { basic, houseRent, medical, gross: total } = computeAutoSalaryBreakdown(gross);
  const variant = dense ? 'body2' : 'body2';

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={3}>
        <Typography variant={variant} color="text.secondary">
          Basic Salary (66.66%): {formatPKR(basic)}
        </Typography>
      </Grid>
      <Grid item xs={12} md={3}>
        <Typography variant={variant} color="text.secondary">
          House Rent (23.34%): {formatPKR(houseRent)}
        </Typography>
      </Grid>
      <Grid item xs={12} md={3}>
        <Typography variant={variant} color="text.secondary">
          Medical (10%): {formatPKR(medical)}
        </Typography>
      </Grid>
      <Grid item xs={12} md={3}>
        <Typography variant={variant} color="text.secondary">
          Total: {formatPKR(total)}
        </Typography>
      </Grid>
    </Grid>
  );
};

export default AutoCalculatedSalaryBreakdown;
