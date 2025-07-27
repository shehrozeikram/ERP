import React from 'react';
import { Box, Typography, Paper, Avatar, Grid } from '@mui/material';

const Profile = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        User Profile
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Avatar sx={{ width: 120, height: 120, mx: 'auto', mb: 2 }} />
          </Grid>
          <Grid item xs={12} md={9}>
            <Typography variant="h6" gutterBottom>
              Profile Information
            </Typography>
            <Typography variant="body1">
              User profile management page - Coming soon!
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default Profile; 