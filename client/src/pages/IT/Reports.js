import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import {
  Download,
  Refresh,
  Assessment,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  ShowChart
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { toast } from 'react-hot-toast';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { itService } from '../../services/itService';
import { ReportsSkeleton } from '../../components/IT/SkeletonLoader';

const TabPanel = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`report-tabpanel-${index}`}
      aria-labelledby={`report-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

// const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const Reports = () => {
  const [tabValue, setTabValue] = useState(0);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1),
    endDate: new Date(),
    category: '',
    department: '',
    vendorType: ''
  });

  // Fetch reports data
  const { refetch: refetchAsset, isLoading: assetLoading } = useQuery(
    ['asset-report', filters],
    () => itService.getAssetUtilizationReport({
      startDate: filters.startDate?.toISOString(),
      endDate: filters.endDate?.toISOString(),
      category: filters.category,
      department: filters.department
    }),
    {
      onError: (error) => {
        toast.error('Failed to load asset report');
        console.error('Asset report error:', error);
      }
    }
  );

  const { refetch: refetchSoftware, isLoading: softwareLoading } = useQuery(
    ['software-report', filters],
    () => itService.getLicenseExpiryReport({
      startDate: filters.startDate?.toISOString(),
      endDate: filters.endDate?.toISOString()
    }),
    {
      onError: (error) => {
        toast.error('Failed to load software report');
        console.error('Software report error:', error);
      }
    }
  );

  const { refetch: refetchNetwork, isLoading: networkLoading } = useQuery(
    ['network-report', filters],
    () => itService.getNetworkUptimeReport({
      startDate: filters.startDate?.toISOString(),
      endDate: filters.endDate?.toISOString()
    }),
    {
      onError: (error) => {
        toast.error('Failed to load network report');
        console.error('Network report error:', error);
      }
    }
  );

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Show skeleton if any report is loading
  if (assetLoading || softwareLoading || networkLoading) {
    return <ReportsSkeleton />;
  }

  const handleFilterChange = (filter, value) => {
    setFilters(prev => ({
      ...prev,
      [filter]: value
    }));
  };

  const handleRefresh = () => {
    refetchAsset();
    refetchSoftware();
    refetchNetwork();
    toast.success('Reports refreshed');
  };

  const handleExport = (type) => {
    // Implement export functionality
    toast.success(`${type} report exported successfully`);
  };

  // Sample data for charts (replace with actual data from API)
  const assetUtilizationData = [
    { name: 'Laptops', total: 120, assigned: 95, utilization: 79.2 },
    { name: 'Desktops', total: 80, assigned: 60, utilization: 75.0 },
    { name: 'Printers', total: 25, assigned: 20, utilization: 80.0 },
    { name: 'Monitors', total: 150, assigned: 120, utilization: 80.0 },
    { name: 'Servers', total: 15, assigned: 15, utilization: 100.0 },
    { name: 'Network Devices', total: 30, assigned: 28, utilization: 93.3 }
  ];

  const softwareExpiryData = [
    { name: 'Expired', value: 5, color: '#FF6B6B' },
    { name: 'Expiring in 30 days', value: 12, color: '#FFD93D' },
    { name: 'Expiring in 60 days', value: 8, color: '#6BCF7F' },
    { name: 'Valid', value: 75, color: '#4D96FF' }
  ];

  const networkUptimeData = [
    { name: 'Jan', uptime: 99.5, downtime: 0.5 },
    { name: 'Feb', uptime: 98.8, downtime: 1.2 },
    { name: 'Mar', uptime: 99.2, downtime: 0.8 },
    { name: 'Apr', uptime: 99.9, downtime: 0.1 },
    { name: 'May', uptime: 98.5, downtime: 1.5 },
    { name: 'Jun', uptime: 99.7, downtime: 0.3 }
  ];

  const vendorPerformanceData = [
    { name: 'TechCorp', rating: 4.5, contracts: 5, value: 125000 },
    { name: 'SoftWare Inc', rating: 4.2, contracts: 3, value: 85000 },
    { name: 'NetworkPro', rating: 4.8, contracts: 7, value: 150000 },
    { name: 'CloudMaster', rating: 4.1, contracts: 2, value: 65000 }
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            IT Reports & Analytics
          </Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={() => handleExport('All')}
            >
              Export All
            </Button>
          </Box>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <DatePicker
                  label="Start Date"
                  value={filters.startDate}
                  onChange={(newValue) => handleFilterChange('startDate', newValue)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <DatePicker
                  label="End Date"
                  value={filters.endDate}
                  onChange={(newValue) => handleFilterChange('endDate', newValue)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filters.category}
                    label="Category"
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    <MenuItem value="Laptop">Laptop</MenuItem>
                    <MenuItem value="Desktop">Desktop</MenuItem>
                    <MenuItem value="Server">Server</MenuItem>
                    <MenuItem value="Printer">Printer</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={filters.department}
                    label="Department"
                    onChange={(e) => handleFilterChange('department', e.target.value)}
                  >
                    <MenuItem value="">All Departments</MenuItem>
                    <MenuItem value="IT">IT</MenuItem>
                    <MenuItem value="HR">HR</MenuItem>
                    <MenuItem value="Finance">Finance</MenuItem>
                    <MenuItem value="Sales">Sales</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Vendor Type</InputLabel>
                  <Select
                    value={filters.vendorType}
                    label="Vendor Type"
                    onChange={(e) => handleFilterChange('vendorType', e.target.value)}
                  >
                    <MenuItem value="">All Types</MenuItem>
                    <MenuItem value="Hardware Supplier">Hardware Supplier</MenuItem>
                    <MenuItem value="Software Vendor">Software Vendor</MenuItem>
                    <MenuItem value="Service Provider">Service Provider</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="Asset Utilization" icon={<BarChartIcon />} />
              <Tab label="Software Licenses" icon={<PieChartIcon />} />
              <Tab label="Network Performance" icon={<ShowChart />} />
              <Tab label="Vendor Performance" icon={<Assessment />} />
            </Tabs>
          </Box>

          {/* Asset Utilization Tab */}
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              {/* Asset Utilization Chart */}
              <Grid item xs={12} md={8}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Asset Utilization by Category
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={assetUtilizationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="assigned" fill="#8884d8" name="Assigned" />
                      <Bar dataKey="total" fill="#82ca9d" name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              {/* Asset Statistics */}
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Asset Statistics
                  </Typography>
                  <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">Total Assets</Typography>
                      <Typography variant="body2" fontWeight="medium">420</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={100} color="primary" />
                  </Box>
                  <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">Assigned Assets</Typography>
                      <Typography variant="body2" fontWeight="medium">338</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={80.5} color="success" />
                  </Box>
                  <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">Available Assets</Typography>
                      <Typography variant="body2" fontWeight="medium">82</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={19.5} color="warning" />
                  </Box>
                </Paper>
              </Grid>

              {/* Asset Utilization Table */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Detailed Asset Utilization
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Category</TableCell>
                          <TableCell align="right">Total</TableCell>
                          <TableCell align="right">Assigned</TableCell>
                          <TableCell align="right">Available</TableCell>
                          <TableCell align="right">Utilization %</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {assetUtilizationData.map((row) => (
                          <TableRow key={row.name}>
                            <TableCell>{row.name}</TableCell>
                            <TableCell align="right">{row.total}</TableCell>
                            <TableCell align="right">{row.assigned}</TableCell>
                            <TableCell align="right">{row.total - row.assigned}</TableCell>
                            <TableCell align="right">
                              <Box display="flex" alignItems="center" justifyContent="flex-end">
                                <Typography variant="body2" mr={1}>
                                  {row.utilization}%
                                </Typography>
                                <LinearProgress
                                  variant="determinate"
                                  value={row.utilization}
                                  sx={{ width: 60, height: 6 }}
                                  color={row.utilization > 90 ? 'error' : row.utilization > 70 ? 'warning' : 'success'}
                                />
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Software Licenses Tab */}
          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              {/* License Expiry Chart */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    License Expiry Status
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={softwareExpiryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {softwareExpiryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              {/* License Details */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    License Details
                  </Typography>
                  {softwareExpiryData.map((item) => (
                    <Box key={item.name} mb={2}>
                      <Box display="flex" alignItems="center" mb={1}>
                        <Box
                          width={12}
                          height={12}
                          borderRadius="50%"
                          bgcolor={item.color}
                          mr={2}
                        />
                        <Typography variant="body2" flex={1}>
                          {item.name}
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {item.value} licenses
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(item.value / 100) * 100}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>
                  ))}
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Network Performance Tab */}
          <TabPanel value={tabValue} index={2}>
            <Grid container spacing={3}>
              {/* Network Uptime Chart */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Network Uptime Trend (Last 6 Months)
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={networkUptimeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="uptime"
                        stackId="1"
                        stroke="#8884d8"
                        fill="#8884d8"
                        name="Uptime %"
                      />
                      <Area
                        type="monotone"
                        dataKey="downtime"
                        stackId="1"
                        stroke="#ff7300"
                        fill="#ff7300"
                        name="Downtime %"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Vendor Performance Tab */}
          <TabPanel value={tabValue} index={3}>
            <Grid container spacing={3}>
              {/* Vendor Rating Chart */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Vendor Performance Rating
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={vendorPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip />
                      <Bar dataKey="rating" fill="#8884d8" name="Rating" />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              {/* Vendor Contracts Value */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Contract Values by Vendor
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={vendorPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip />
                      <Bar dataKey="value" fill="#82ca9d" name="Contract Value ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              {/* Vendor Performance Table */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Vendor Performance Summary
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Vendor</TableCell>
                          <TableCell align="right">Rating</TableCell>
                          <TableCell align="right">Contracts</TableCell>
                          <TableCell align="right">Total Value</TableCell>
                          <TableCell align="center">Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {vendorPerformanceData.map((vendor) => (
                          <TableRow key={vendor.name}>
                            <TableCell>{vendor.name}</TableCell>
                            <TableCell align="right">
                              <Box display="flex" alignItems="center" justifyContent="flex-end">
                                <Typography variant="body2" mr={1}>
                                  {vendor.rating}
                                </Typography>
                                <Chip
                                  label={vendor.rating >= 4.5 ? 'Excellent' : vendor.rating >= 4.0 ? 'Good' : 'Fair'}
                                  size="small"
                                  color={vendor.rating >= 4.5 ? 'success' : vendor.rating >= 4.0 ? 'warning' : 'default'}
                                />
                              </Box>
                            </TableCell>
                            <TableCell align="right">{vendor.contracts}</TableCell>
                            <TableCell align="right">
                              ${vendor.value.toLocaleString()}
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label="Active"
                                size="small"
                                color="success"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>
        </Card>
      </Box>
    </LocalizationProvider>
  );
};

export default Reports;
