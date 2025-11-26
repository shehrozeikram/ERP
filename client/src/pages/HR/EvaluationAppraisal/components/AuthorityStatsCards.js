import React from 'react';
import { Card, CardContent, Typography, Box, Grid } from '@mui/material';
import { Person as PersonIcon, Business as BusinessIcon } from '@mui/icons-material';

const AuthorityStatsCards = ({ employees, label }) => {
  const uniqueDepartments = new Set(
    employees.map(emp => emp.placementDepartment?.name || emp.placementDepartment || 'N/A')
  ).size;

  const activeCount = employees.filter(emp => emp.isActive !== false).length;

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PersonIcon color="primary" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {employees.length}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total {label}s
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <BusinessIcon color="primary" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {uniqueDepartments}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Departments
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PersonIcon color="primary" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {activeCount}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Active {label}s
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default AuthorityStatsCards;

