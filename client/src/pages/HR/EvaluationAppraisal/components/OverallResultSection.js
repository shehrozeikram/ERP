import React from 'react';
import { Box, Typography, Radio, RadioGroup, FormControlLabel, FormControl } from '@mui/material';

const overallResultOptions = [
  { value: 'poor', label: 'Poor', percentage: '50%-60%' },
  { value: 'average', label: 'Average', percentage: '61%-70%' },
  { value: 'good', label: 'Good', percentage: '71%-80%' },
  { value: 'very_good', label: 'Very Good', percentage: '81%-90%' },
  { value: 'outstanding', label: 'Outstanding', percentage: '91%-100%' }
];

const OverallResultSection = ({ formik }) => {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
        OVERALL RESULT (Description)
      </Typography>
      <FormControl component="fieldset" error={formik.touched.overallResult && Boolean(formik.errors.overallResult)}>
        <RadioGroup
          row
          name="overallResult"
          value={formik.values.overallResult}
          onChange={formik.handleChange}
        >
          {overallResultOptions.map((option) => (
            <FormControlLabel
              key={option.value}
              value={option.value}
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {option.label}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {option.percentage}
                  </Typography>
                </Box>
              }
            />
          ))}
        </RadioGroup>
      </FormControl>
    </Box>
  );
};

export default OverallResultSection;

