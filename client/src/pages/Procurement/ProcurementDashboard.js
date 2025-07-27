import React from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent } from '@mui/material';
import { ShoppingCart, Inventory, LocalShipping, Assessment } from '@mui/icons-material';

const ProcurementDashboard = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Procurement Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Manage procurement processes and supplier relationships
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ShoppingCart sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4">89</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Purchase Orders
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Inventory sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4">1,234</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Inventory Items
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <LocalShipping sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4">45</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Suppliers
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Assessment sx={{ fontSize: 40, color: 'info.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4">$890K</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Spend
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Procurement Module Features
        </Typography>
        <Typography variant="body1" color="text.secondary">
          This module will include purchase order management, vendor management, 
          inventory tracking, supplier evaluation, and more. The full implementation is coming soon.
        </Typography>
      </Paper>
    </Box>
  );
};

export default ProcurementDashboard; 