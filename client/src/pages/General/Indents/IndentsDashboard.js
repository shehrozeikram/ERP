import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Button,
  Paper
} from '@mui/material';
import {
  Assignment,
  CheckCircle,
  Schedule,
  Error,
  Visibility,
  Add,
  PendingActions
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import indentService from '../../../services/indentService';
import dayjs from 'dayjs';

// Stat Card Component
const StatCard = ({ title, value, subtitle, icon, color, onClick }) => (
  <Card 
    sx={{ 
      height: '100%', 
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': onClick ? {
        transform: 'translateY(-4px)',
        boxShadow: 4
      } : {}
    }}
    onClick={onClick}
  >
    <CardContent>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Avatar sx={{ bgcolor: color, color: 'white', width: 56, height: 56 }}>
          {icon}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const IndentsDashboard = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentIndents, setRecentIndents] = useState([]);
  const [myIndents, setMyIndents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await indentService.getDashboardStats();
      const data = response.data;
      
      setStats(data.stats);
      setRecentIndents(data.recentIndents || []);
      setMyIndents(data.myIndents || []);

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'default',
      'Submitted': 'info',
      'Under Review': 'warning',
      'Approved': 'success',
      'Rejected': 'error',
      'Partially Fulfilled': 'info',
      'Fulfilled': 'success',
      'Cancelled': 'default'
    };
    return colors[status] || 'default';
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    const colors = {
      'Low': 'default',
      'Medium': 'info',
      'High': 'warning',
      'Urgent': 'error'
    };
    return colors[priority] || 'default';
  };

  // Format currency
  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 0
    }).format(value || 0);

  // Format date
  const formatDate = (date) => {
    if (!date) return '—';
    return dayjs(date).format('DD-MMM-YYYY');
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Indents Dashboard
          </Typography>
          <Typography color="text.secondary">
            Overview of indent management and tracking
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Tooltip title="View All Indents">
            <IconButton 
              color="primary" 
              onClick={() => navigate('/general/indents')}
              sx={{ bgcolor: 'primary.50', '&:hover': { bgcolor: 'primary.100' } }}
            >
              <Visibility />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/general/indents/create')}
          >
            Create Indent
          </Button>
        </Stack>
      </Stack>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Indents"
            value={stats?.total || 0}
            subtitle={`${stats?.myIndents || 0} my indents`}
            icon={<Assignment />}
            color="primary.main"
            onClick={() => navigate('/general/indents')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending Approval"
            value={stats?.pendingApproval || 0}
            subtitle="Awaiting review"
            icon={<PendingActions />}
            color="warning.main"
            onClick={() => navigate('/general/indents?status=Submitted')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Approved"
            value={stats?.byStatus?.Approved || 0}
            subtitle={`${stats?.byStatus?.['Partially Fulfilled'] || 0} partially fulfilled`}
            icon={<CheckCircle />}
            color="success.main"
            onClick={() => navigate('/general/indents?status=Approved')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Estimated Cost"
            value={formatCurrency(stats?.totalEstimatedCost || 0)}
            subtitle="All indents"
            icon={<Schedule />}
            color="info.main"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Indents */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  Recent Indents
                </Typography>
                <Button size="small" onClick={() => navigate('/general/indents')}>
                  View All
                </Button>
              </Stack>
              {recentIndents.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  No indents found
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Indent #</strong></TableCell>
                        <TableCell><strong>Title</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell><strong>Date</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentIndents.map((indent) => (
                        <TableRow 
                          key={indent._id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/general/indents/${indent._id}`)}
                        >
                          <TableCell>{indent.indentNumber}</TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {indent.title}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={indent.status} 
                              size="small" 
                              color={getStatusColor(indent.status)}
                            />
                          </TableCell>
                          <TableCell>{formatDate(indent.requestedDate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* My Indents */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  My Indents
                </Typography>
                <Button size="small" onClick={() => navigate('/general/indents?myIndents=true')}>
                  View All
                </Button>
              </Stack>
              {myIndents.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  No indents found
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Indent #</strong></TableCell>
                        <TableCell><strong>Title</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell><strong>Priority</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {myIndents.map((indent) => (
                        <TableRow 
                          key={indent._id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/general/indents/${indent._id}`)}
                        >
                          <TableCell>{indent.indentNumber}</TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {indent.title}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={indent.status} 
                              size="small" 
                              color={getStatusColor(indent.status)}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={indent.priority} 
                              size="small" 
                              color={getPriorityColor(indent.priority)}
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Status Distribution */}
      {stats && (
        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Status Distribution
                </Typography>
                <Stack spacing={1}>
                  {Object.entries(stats.byStatus || {}).map(([status, count]) => (
                    count > 0 && (
                      <Stack key={status} direction="row" justifyContent="space-between" alignItems="center">
                        <Chip label={status} size="small" color={getStatusColor(status)} />
                        <Typography variant="body2" fontWeight={600}>
                          {count}
                        </Typography>
                      </Stack>
                    )
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Priority Distribution
                </Typography>
                <Stack spacing={1}>
                  {Object.entries(stats.byPriority || {}).map(([priority, count]) => (
                    count > 0 && (
                      <Stack key={priority} direction="row" justifyContent="space-between" alignItems="center">
                        <Chip 
                          label={priority} 
                          size="small" 
                          color={getPriorityColor(priority)}
                          variant="outlined"
                        />
                        <Typography variant="body2" fontWeight={600}>
                          {count}
                        </Typography>
                      </Stack>
                    )
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default IndentsDashboard;

