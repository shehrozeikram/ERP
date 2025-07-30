import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Alert,
  CircularProgress,
  Button
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import {
  ArrowBack as BackIcon,
  TrendingUp as TrendingUpIcon,
  AccountBalance as MoneyIcon,
  People as PeopleIcon,
  Schedule as TimeIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import finalSettlementService from '../../services/finalSettlementService';
import { formatPKR } from '../../utils/currency';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const FinalSettlementStatistics = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const response = await finalSettlementService.getSettlementStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading statistics:', error);
      setError('Error loading statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
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

  if (!stats) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">No statistics available</Alert>
      </Box>
    );
  }

  const { overview, recentSettlements, settlementsByType, settlementsByDepartment } = stats;

  // Prepare data for charts
  const statusData = [
    { name: 'Pending', value: overview.pendingSettlements, color: '#ff9800' },
    { name: 'Approved', value: overview.approvedSettlements, color: '#2196f3' },
    { name: 'Processed', value: overview.processedSettlements, color: '#9c27b0' },
    { name: 'Paid', value: overview.paidSettlements, color: '#4caf50' }
  ];

  const typeData = settlementsByType.map((item, index) => ({
    name: finalSettlementService.getSettlementTypeLabel(item._id),
    value: item.count,
    amount: item.totalAmount,
    color: COLORS[index % COLORS.length]
  }));

  const departmentData = settlementsByDepartment.map((item, index) => ({
    name: item._id,
    value: item.count,
    amount: item.totalAmount,
    color: COLORS[index % COLORS.length]
  }));

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Final Settlement Statistics
        </Typography>
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={() => navigate('/hr/settlements')}
        >
          Back to Settlements
        </Button>
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PeopleIcon sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {overview.totalSettlements}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Settlements
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <MoneyIcon sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {formatPKR(overview.totalAmount)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Amount
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUpIcon sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {formatPKR(overview.avgSettlementAmount)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Average Amount
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TimeIcon sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {overview.pendingSettlements}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Pending
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Status Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Settlement Status Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Count']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Settlement Types */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Settlements by Type
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={typeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [value, name === 'amount' ? 'Amount' : 'Count']}
                    labelFormatter={(label) => `Type: ${label}`}
                  />
                  <Bar dataKey="value" fill="#8884d8" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Department Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Settlements by Department
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={departmentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [value, name === 'amount' ? 'Amount' : 'Count']}
                    labelFormatter={(label) => `Department: ${label}`}
                  />
                  <Bar dataKey="value" fill="#82ca9d" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Amount Trend */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Settlement Amounts by Type
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={typeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [formatPKR(value), 'Amount']}
                    labelFormatter={(label) => `Type: ${label}`}
                  />
                  <Bar dataKey="amount" fill="#ffc658" name="Amount" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Settlements Table */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Settlements
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentSettlements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="textSecondary">
                        No recent settlements
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentSettlements.map((settlement) => (
                    <TableRow key={settlement._id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2">
                            {settlement.employeeName}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {String(settlement.employeeId || '')}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={finalSettlementService.getSettlementTypeLabel(settlement.settlementType)}
                          size="small"
                          sx={{
                            backgroundColor: finalSettlementService.getSettlementTypeColor(settlement.settlementType),
                            color: 'white'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={finalSettlementService.getStatusLabel(settlement.status)}
                          size="small"
                          sx={{
                            backgroundColor: finalSettlementService.getStatusColor(settlement.status),
                            color: 'white'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {formatPKR(settlement.netSettlementAmount)}
                      </TableCell>
                      <TableCell>
                        {new Date(settlement.settlementDate).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Detailed Statistics Tables */}
      <Grid container spacing={3}>
        {/* Settlements by Type */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Settlements by Type - Detailed
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Count</TableCell>
                      <TableCell align="right">Total Amount</TableCell>
                      <TableCell align="right">Average</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {typeData.map((item) => (
                      <TableRow key={item.name}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell align="right">{item.value}</TableCell>
                        <TableCell align="right">{formatPKR(item.amount)}</TableCell>
                        <TableCell align="right">
                          {formatPKR(item.value > 0 ? item.amount / item.value : 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Settlements by Department */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Settlements by Department - Detailed
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Department</TableCell>
                      <TableCell align="right">Count</TableCell>
                      <TableCell align="right">Total Amount</TableCell>
                      <TableCell align="right">Average</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {departmentData.map((item) => (
                      <TableRow key={item.name}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell align="right">{item.value}</TableCell>
                        <TableCell align="right">{formatPKR(item.amount)}</TableCell>
                        <TableCell align="right">
                          {formatPKR(item.value > 0 ? item.amount / item.value : 0)}
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
    </Box>
  );
};

export default FinalSettlementStatistics; 