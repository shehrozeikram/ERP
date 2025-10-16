import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Divider
} from '@mui/material';
import {
  Computer,
  Security,
  Router,
  Business,
  Warning,
  CheckCircle,
  Error,
  TrendingUp,
  TrendingDown,
  Refresh,
  MoreVert,
  Assignment,
  Schedule,
  Person
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { toast } from 'react-hot-toast';

// Import API service
import { itService } from '../../services/itService';
import { DashboardSkeleton } from '../../components/IT/SkeletonLoader';

const StatCard = ({ title, value, icon, color, trend, subtitle, onClick }) => (
  <Card 
    sx={{ 
      cursor: onClick ? 'pointer' : 'default',
      '&:hover': onClick ? { boxShadow: 3 } : {},
      transition: 'box-shadow 0.2s'
    }}
    onClick={onClick}
  >
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography color="textSecondary" gutterBottom variant="body2">
            {title}
          </Typography>
          <Typography variant="h4" component="h2" color={color}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="textSecondary">
              {subtitle}
            </Typography>
          )}
          {trend && (
            <Box display="flex" alignItems="center" mt={1}>
              {trend > 0 ? (
                <TrendingUp color="success" fontSize="small" />
              ) : (
                <TrendingDown color="error" fontSize="small" />
              )}
              <Typography variant="caption" color={trend > 0 ? 'success.main' : 'error.main'}>
                {Math.abs(trend)}%
              </Typography>
            </Box>
          )}
        </Box>
        <Avatar sx={{ bgcolor: `${color}.light`, width: 56, height: 56 }}>
          {icon}
        </Avatar>
      </Box>
    </CardContent>
  </Card>
);

const StatusChip = ({ status, type = 'default' }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'Active':
      case 'Online':
      case 'Completed':
        return 'success';
      case 'In Progress':
      case 'Assigned':
        return 'warning';
      case 'Offline':
      case 'Error':
      case 'Critical':
        return 'error';
      case 'Expired':
      case 'Overdue':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Chip
      label={status}
      color={getStatusColor()}
      size="small"
      variant={type === 'outlined' ? 'outlined' : 'filled'}
    />
  );
};

const RecentActivity = ({ title, data, icon }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" component="h3">
          {title}
        </Typography>
        {icon}
      </Box>
      {data && data.length > 0 ? (
        <TableContainer>
          <Table size="small">
            <TableBody>
              {data.slice(0, 5).map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ width: 32, height: 32, mr: 1 }}>
                        <Person fontSize="small" />
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {item.title || item.name || item.softwareName || item.deviceName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {item.description || item.category || item.deviceType}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <StatusChip status={item.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography variant="body2" color="textSecondary" align="center" py={2}>
          No recent activity
        </Typography>
      )}
    </CardContent>
  </Card>
);

const ITDashboard = () => {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch dashboard data
  const { data: dashboardData, isLoading, error, refetch, isFetching } = useQuery(
    ['it-dashboard', refreshKey],
    itService.getDashboard,
    {
      refetchInterval: 30000, // Refresh every 30 seconds
      retry: 3,
      onError: (error) => {
        toast.error('Failed to load dashboard data');
        console.error('❌ Dashboard error:', error);
      }
    }
  );



  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
    toast.success('Dashboard refreshed');
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          IT Dashboard
        </Typography>
        <Alert severity="error">
          Failed to load dashboard data. Please try again.
        </Alert>
        <Button onClick={handleRefresh} sx={{ mt: 2 }}>
          <Refresh sx={{ mr: 1 }} />
          Retry
        </Button>
      </Box>
    );
  }

  // Fix: Access the nested data structure from axios response
  const data = dashboardData?.data?.data || {};
  const {
    assets = {},
    software = {},
    network = {},
    vendors = {},
    recentIncidents = [],
    expiringLicenses = [],
    upcomingMaintenance = []
  } = data;


  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          IT Dashboard
        </Typography>
        <Box>
          <Tooltip title="Refresh Dashboard">
            <IconButton onClick={handleRefresh}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>


      {/* Alerts */}
      {expiringLicenses.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">
            {expiringLicenses.length} software license(s) expiring soon
          </Typography>
        </Alert>
      )}

      {upcomingMaintenance.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">
            {upcomingMaintenance.length} maintenance task(s) scheduled
          </Typography>
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Assets"
            value={assets.overview?.totalAssets || 0}
            icon={<Computer />}
            color="primary"
            subtitle={`${assets.overview?.activeAssets || 0} active • ${assets.overview?.assignedAssets || 0} assigned`}
            onClick={() => navigate('/it/assets')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Software Licenses"
            value={software.overview?.totalSoftware || 0}
            icon={<Security />}
            color="secondary"
            subtitle={`${software.overview?.usedLicenses || 0} in use • ${expiringLicenses?.length || 0} expiring soon`}
            onClick={() => navigate('/it/software')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Network Devices"
            value={network.overview?.totalDevices || 0}
            icon={<Router />}
            color="success"
            subtitle={`${network.overview?.onlineDevices || 0} online • ${network.overview?.averageUptime || 0}% uptime`}
            onClick={() => navigate('/it/network')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="IT Vendors"
            value={vendors.overview?.totalVendors || 0}
            icon={<Business />}
            color="warning"
            subtitle={`${vendors.overview?.activeVendors || 0} active • ${vendors.overview?.contractsDue || 0} contracts due`}
            onClick={() => navigate('/it/vendors')}
          />
        </Grid>
      </Grid>

      {/* Asset Value and Assignment Overview */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Asset Value
              </Typography>
              <Typography variant="h4" color="primary.main">
                ${assets.overview?.totalValue ? (assets.overview.totalValue / 1000).toFixed(1) + 'K' : '0'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Average: ${assets.overview?.averageValue ? assets.overview.averageValue.toFixed(0) : '0'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Asset Assignments
              </Typography>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h4" color="success.main">
                  {assets.overview?.assignedAssets || 0}
                </Typography>
                <Assignment color="success" />
              </Box>
              <Typography variant="body2" color="textSecondary">
                {assets.overview?.totalAssets - (assets.overview?.assignedAssets || 0)} unassigned
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Software Licenses
              </Typography>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h4" color="secondary.main">
                  {software.overview?.totalSoftware || 0}
                </Typography>
                <Security color="secondary" />
              </Box>
              <Typography variant="body2" color="textSecondary">
                {software.overview?.expiredLicenses || 0} expired • {expiringLicenses?.length || 0} expiring soon
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Asset Utilization */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Asset Utilization
              </Typography>
              <Box display="flex" justifyContent="space-between" mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Assigned Assets
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {assets.overview?.assignedAssets || 0} / {assets.overview?.totalAssets || 0}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={assets.overview?.totalAssets > 0 
                  ? ((assets.overview?.assignedAssets || 0) / assets.overview?.totalAssets) * 100 
                  : 0
                }
                sx={{ mb: 2 }}
              />
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="textSecondary">
                  Unassigned: {assets.overview?.totalAssets - (assets.overview?.assignedAssets || 0)}
                </Typography>
                <Button 
                  size="small" 
                  onClick={() => navigate('/it/assets?assigned=false')}
                >
                  View Unassigned
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Network Health
              </Typography>
              <Box display="flex" justifyContent="space-between" mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Online Devices
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {network.overview?.onlineDevices || 0} / {network.overview?.totalDevices || 0}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={network.overview?.totalDevices > 0 
                  ? ((network.overview?.onlineDevices || 0) / network.overview?.totalDevices) * 100 
                  : 0
                }
                sx={{ mb: 2 }}
              />
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="textSecondary">
                  Uptime: {network.overview?.averageUptime || 0}%
                </Typography>
                <Button 
                  size="small" 
                  onClick={() => navigate('/it/network')}
                >
                  View Devices
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <RecentActivity
            title="Recent Incidents"
            data={recentIncidents}
            icon={<Warning color="error" />}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <RecentActivity
            title="Expiring Licenses"
            data={expiringLicenses}
            icon={<Schedule color="warning" />}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <RecentActivity
            title="Upcoming Maintenance"
            data={upcomingMaintenance}
            icon={<Assignment color="info" />}
          />
        </Grid>
      </Grid>

      {/* Asset Category Breakdown */}
      {assets.byCategory && assets.byCategory.length > 0 && (
        <Grid container spacing={3} sx={{ mt: 3 }}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Assets by Category
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Count</TableCell>
                        <TableCell align="right">Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {assets.byCategory.slice(0, 5).map((category, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Box display="flex" alignItems="center">
                              <Computer sx={{ mr: 1, fontSize: 20 }} />
                              <Typography variant="body2">
                                {category._id}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {category.count}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              ${category.totalValue ? (category.totalValue / 1000).toFixed(1) + 'K' : '0'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Quick Actions */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<Computer />}
                onClick={() => navigate('/it/assets/add')}
              >
                Add Asset
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<Security />}
                onClick={() => navigate('/it/software/add')}
              >
                Add Software
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<Router />}
                onClick={() => navigate('/it/network/add')}
              >
                Add Device
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<Business />}
                onClick={() => navigate('/it/vendors/add')}
              >
                Add Vendor
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ITDashboard;
