import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  Button,
  Paper,
  Alert,
  Skeleton,
  Card,
  CardContent,
  Chip,
  Stack
} from '@mui/material';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts';
import salesService from '../../services/salesService';

const chartColors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#7B5FFF'];

const SalesReports = () => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: ''
  });

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await salesService.getReports(filters);
      setReportData(response.data.data);
    } catch (err) {
      console.error('Failed to load sales reports', err);
      setError(err.response?.data?.message || 'Failed to load sales reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleApplyFilters = () => {
    fetchReports();
  };

  const LoadingSkeleton = () => (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="text" width={260} height={48} />
      <Skeleton variant="text" width={360} height={24} sx={{ mb: 3 }} />
      <Skeleton variant="rounded" height={120} sx={{ mb: 3 }} />
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Skeleton variant="rounded" height={320} />
        </Grid>
        <Grid item xs={12} md={6}>
          <Skeleton variant="rounded" height={320} />
        </Grid>
      </Grid>
    </Box>
  );

  if (loading && !reportData) {
    return <LoadingSkeleton />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Sales Reports
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Analyze revenue performance, pipeline stages and top customers.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              label="Start Date"
              type="date"
              value={filters.startDate}
              onChange={handleFilterChange('startDate')}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="End Date"
              type="date"
              value={filters.endDate}
              onChange={handleFilterChange('endDate')}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={4} display="flex" alignItems="center">
            <Button variant="contained" onClick={handleApplyFilters}>
              Apply Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {reportData && (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Revenue
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    PKR {(reportData.summary?.totalRevenue || 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Average Deal Size
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    PKR {(reportData.summary?.averageDealSize || 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Deals
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {reportData.summary?.deals || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Taxes Collected
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    PKR {(reportData.summary?.taxes || 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: 360 }}>
                <Typography variant="h6" gutterBottom>
                  Pipeline by Stage
                </Typography>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reportData.byStage || []}
                      dataKey="count"
                      nameKey="_id"
                      label
                    >
                      {(reportData.byStage || []).map((entry, index) => (
                        <Cell key={entry._id} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: 360 }}>
                <Typography variant="h6" gutterBottom>
                  Revenue by Status
                </Typography>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.byStatus || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="_id" />
                    <YAxis />
                    <Tooltip formatter={(value) => `PKR ${Number(value).toLocaleString()}`} />
                    <Bar dataKey="revenue" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Top Customers
                </Typography>
                <Stack spacing={2}>
                  {(reportData.topCustomers || []).map((customer) => (
                    <Paper key={customer._id} variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="subtitle2">{customer.customer?.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {customer.customer?.company}
                        </Typography>
                      </Box>
                      <Chip
                        label={`PKR ${Number(customer.revenue || 0).toLocaleString()}`}
                        color="primary"
                      />
                    </Paper>
                  ))}
                  {(reportData.topCustomers || []).length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No customer data available for the selected period.
                    </Typography>
                  )}
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default SalesReports;

