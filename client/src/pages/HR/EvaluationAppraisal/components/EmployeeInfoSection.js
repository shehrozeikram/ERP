import React from 'react';
import { Box, Typography, TextField, Grid, Divider } from '@mui/material';

const EmployeeInfoSection = ({ formik }) => {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
        Employee Information
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Code"
            name="code"
            value={formik.values.code}
            onChange={formik.handleChange}
            error={formik.touched.code && Boolean(formik.errors.code)}
            helperText={formik.touched.code && formik.errors.code}
            size="small"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Date"
            name="date"
            type="date"
            value={formik.values.date}
            onChange={formik.handleChange}
            error={formik.touched.date && Boolean(formik.errors.date)}
            helperText={formik.touched.date && formik.errors.date}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Name"
            name="name"
            value={formik.values.name}
            onChange={formik.handleChange}
            error={formik.touched.name && Boolean(formik.errors.name)}
            helperText={formik.touched.name && formik.errors.name}
            size="small"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              fullWidth
              label="Review Period From"
              name="reviewPeriodFrom"
              type="date"
              value={formik.values.reviewPeriodFrom}
              onChange={formik.handleChange}
              error={formik.touched.reviewPeriodFrom && Boolean(formik.errors.reviewPeriodFrom)}
              helperText={formik.touched.reviewPeriodFrom && formik.errors.reviewPeriodFrom}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <Typography variant="body2" sx={{ mt: 1 }}>to</Typography>
            <TextField
              fullWidth
              label="Review Period To"
              name="reviewPeriodTo"
              type="date"
              value={formik.values.reviewPeriodTo}
              onChange={formik.handleChange}
              error={formik.touched.reviewPeriodTo && Boolean(formik.errors.reviewPeriodTo)}
              helperText={formik.touched.reviewPeriodTo && formik.errors.reviewPeriodTo}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Designation"
            name="designation"
            value={formik.values.designation}
            onChange={formik.handleChange}
            error={formik.touched.designation && Boolean(formik.errors.designation)}
            helperText={formik.touched.designation && formik.errors.designation}
            size="small"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Department/Section"
            name="department"
            value={formik.values.department}
            onChange={formik.handleChange}
            error={formik.touched.department && Boolean(formik.errors.department)}
            helperText={formik.touched.department && formik.errors.department}
            size="small"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Immediate Boss / Evaluator"
            name="immediateBoss"
            value={formik.values.immediateBoss}
            onChange={formik.handleChange}
            error={formik.touched.immediateBoss && Boolean(formik.errors.immediateBoss)}
            helperText={formik.touched.immediateBoss && formik.errors.immediateBoss}
            size="small"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Appraisal History"
            name="appraisalHistory"
            value={formik.values.appraisalHistory}
            onChange={formik.handleChange}
            multiline
            rows={2}
            size="small"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmployeeInfoSection;

