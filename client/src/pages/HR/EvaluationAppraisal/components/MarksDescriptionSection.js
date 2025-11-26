import React from 'react';
import { Box, Typography, Grid, Card } from '@mui/material';

const marksDescription = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Average' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Very Good' },
  { value: 5, label: 'Outstanding' }
];

const MarksDescriptionSection = () => {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
        Marks Description (1-5)
      </Typography>
      <Grid container spacing={2}>
        {marksDescription.map((mark) => (
          <Grid item xs={12} sm={6} md={2.4} key={mark.value}>
            <Card variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: 'grey.50' }}>
              <Typography variant="h6" color="primary.main" sx={{ fontWeight: 700 }}>
                {mark.value}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {mark.label}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default MarksDescriptionSection;

