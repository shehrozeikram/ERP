import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  Avatar,
  Paper,
  Skeleton,
  Alert
} from '@mui/material';
import {
  ShoppingCart,
  Group,
  Inventory2,
  MonetizationOn,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar
} from 'recharts';
import salesService from '../../services/salesService';

const StatCard = ({ title, value, subtitle, icon, color }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Avatar sx={{ bgcolor: color, color: 'white', width: 48, height: 48 }}>
          {icon}
        </Avatar>
        <Box>
          <Typography variant="subtitle2" color="textSecondary">
            {title}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const PipelineChip = ({ stage }) => {
  const colorMap = {
    lead: 'default',
    proposal: 'info',
    negotiation: 'warning',
    closed_won: 'success',
    closed_lost: 'error'
  };
  return (
    <Chip
      label={stage.replace('_', ' ')}
      color={colorMap[stage] || 'default'}
      size="small"
      sx={{ textTransform: 'capitalize' }}
    />
  );
};

const SalesDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const response = await salesService.getDashboard();
        setDashboard(response.data.data);
      } catch (err) {
        console.error('Failed to load sales dashboard:', err);
        setError(err.response?.data?.message || 'Failed to load sales dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const pipelineChartData = useMemo(() => {
    if (!dashboard?.pipeline) return [];
    return dashboard.pipeline.map((item) => ({
      name: item.stage.replace('_', ' '),
      deals: item.deals,
      value: Number(item.value?.toFixed(0) || 0)
    }));
  }, [dashboard]);

  const LoadingSkeleton = () => (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="text" width={320} height={48} />
      <Grid container spacing={3} sx={{ mt: 1 }}>
        {Array.from({ length: 4 }).map((_, idx) => (
          <Grid item xs={12} md={3} key={idx}>
            <Skeleton variant="rounded" height={120} />
          </Grid>
        ))}
        <Grid item xs={12} md={8}>
          <Skeleton variant="rounded" height={320} />
        </Grid>
        <Grid item xs={12} md={4}>
          <Skeleton variant="rounded" height={320} />
        </Grid>
        <Grid item xs={12} md={5}>
          <Skeleton variant="rounded" height={260} />
        </Grid>
        <Grid item xs={12} md={7}>
          <Skeleton variant="rounded" height={260} />
        </Grid>
      </Grid>
    </Box>
  );

  if (loading) {
    return <LoadingSkeleton />;
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
      <Typography variant="h4" gutterBottom>
        Sales Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Monitor performance metrics, pipeline trends and recent deals.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <StatCard
            title="Revenue"
            value={`PKR ${dashboard?.totals?.revenue?.toLocaleString() || 0}`}
            subtitle="Closed this quarter"
            icon={<MonetizationOn />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard
            title="Open Orders"
            value={dashboard?.totals?.orders || 0}
            subtitle={`${dashboard?.pipeline?.find(p => p.stage === 'proposal')?.deals || 0} in pipeline`}
            icon={<ShoppingCart />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard
            title="Active Customers"
            value={dashboard?.totals?.customers || 0}
            subtitle={`${dashboard?.totals?.newCustomers || 0} new this month`}
            icon={<Group />}
            color="info.main"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard
            title="Products"
            value={dashboard?.totals?.products || 0}
            subtitle="Available in catalog"
            icon={<Inventory2 />}
            color="warning.main"
          />
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Revenue Trend
              </Typography>
              <Box sx={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboard?.revenueTrend || []}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0088FE" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#0088FE" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => `PKR ${Number(value).toLocaleString()}`} />
                    <Area type="monotone" dataKey="amount" stroke="#0088FE" fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Pipeline Overview
              </Typography>
              <Box sx={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineChartData} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Products
              </Typography>
              <Stack spacing={2}>
                {(dashboard?.topProducts || []).map((product) => (
                  <Paper
                    key={product.name}
                    variant="outlined"
                    sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Box>
                      <Typography variant="subtitle2">{product.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {product.quantity} units sold
                      </Typography>
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      PKR {product.revenue.toLocaleString()}
                    </Typography>
                  </Paper>
                ))}
                {(!dashboard?.topProducts || dashboard.topProducts.length === 0) && (
                  <Typography variant="body2" color="text.secondary">
                    No products found in the selected period.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Orders
              </Typography>
              <Stack spacing={2}>
                {(dashboard?.recentOrders || []).map((order) => (
                  <Paper
                    key={order._id}
                    variant="outlined"
                    sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Box>
                      <Typography variant="subtitle2">{order.orderNumber}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {order.customer?.name || 'Unknown Customer'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PipelineChip stage={order.stage} />
                      <Chip
                        icon={
                          ['fulfilled', 'completed', 'closed_won'].includes(order.status)
                            ? <TrendingUp fontSize="small" />
                            : <TrendingDown fontSize="small" />
                        }
                        label={order.status}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        PKR {Number(order.totalAmount || 0).toLocaleString()}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
                {(!dashboard?.recentOrders || dashboard.recentOrders.length === 0) && (
                  <Typography variant="body2" color="text.secondary">
                    No recent orders available.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SalesDashboard;
