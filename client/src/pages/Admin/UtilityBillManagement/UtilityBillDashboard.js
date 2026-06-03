import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Alert,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack
} from '@mui/material';

import {
  Visibility as ViewIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import utilityBillService from '../../../services/utilityBillService';

const sortBillsByDate = (a, b) => {
  const ta = a.billDate ? new Date(a.billDate).getTime() : 0;
  const tb = b.billDate ? new Date(b.billDate).getTime() : 0;
  if (ta !== tb) return ta - tb;
  return String(a.billId || '').localeCompare(String(b.billId || ''));
};

const UtilityBillDashboard = () => {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState({ byType: [], monthly: { monthlyTotal: 0, monthlyPaid: 0, monthlyBills: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const utilityTypes = ['Electricity', 'Water', 'Gas', 'Internet', 'Phone', 'Maintenance', 'Security', 'Cleaning', 'Other'];
  const statuses = ['Pending', 'Paid', 'Overdue', 'Partial'];

  const fetchData = async () => {
    try {
      setLoading(true);
      const [billsResponse, summaryResponse] = await Promise.all([
        utilityBillService.getUtilityBills({
          search: searchTerm,
          utilityType: filterType,
          status: filterStatus,
          excludeCentralizedStore: true,
          limit: 500,
          page: 1
        }),
        utilityBillService.getSummary({ excludeCentralizedStore: true })
      ]);

      setBills(billsResponse.data);
      setSummary(summaryResponse.data);
    } catch (err) {
      setError('Failed to fetch utility bills data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterType, filterStatus]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'success';
      case 'Pending': return 'warning';
      case 'Overdue': return 'error';
      case 'Partial': return 'info';
      default: return 'default';
    }
  };

  const getWorkflowLabel = (bill) => {
    if (bill.auditStatus && bill.auditStatus !== 'Not Sent') return bill.auditStatus;
    return bill.approvalStatus || 'Draft';
  };

  const getWorkflowColor = (bill) => {
    const label = getWorkflowLabel(bill);
    if (label.includes('Paid (from Finance)')) return 'success';
    if (label.includes('Partially Paid (from Finance)')) return 'info';
    if (label.includes('Approved')) return 'success';
    if (label === 'Send to Audit' || label === 'Forwarded to Audit Director' || label === 'Submitted') return 'warning';
    if (label.includes('Rejected') || label === 'Returned from Audit') return 'error';
    return 'default';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-PK');
  };

  /** YYYY-MM from billDate (or dueDate) for grouping */
  const billPeriodKey = (bill) => {
    const raw = bill.billDate || bill.dueDate;
    const d = raw ? new Date(raw) : null;
    if (!d || Number.isNaN(d.getTime())) return '0000-00';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const formatPeriodLabel = (key) => {
    if (key === '0000-00') return 'Unknown period';
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('en-PK', { month: 'long', year: 'numeric' });
  };

  const billsByMonthYear = useMemo(() => {
    const map = new Map();
    (bills || []).forEach((bill) => {
      const key = billPeriodKey(bill);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(bill);
    });
    const keys = [...map.keys()].sort((a, b) => b.localeCompare(a));
    return keys.map((key) => {
      const groupBills = [...map.get(key)].sort(sortBillsByDate);
      const total = groupBills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
      return { key, label: formatPeriodLabel(key), bills: groupBills, total };
    });
  }, [bills]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Header Skeleton */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width="30%" height={40} />
          <Skeleton variant="rectangular" width={140} height={36} borderRadius={1} />
        </Box>

        {/* Summary Cards Skeleton */}
        <Grid container spacing={3} mb={3}>
          {[1, 2, 3, 4].map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Skeleton variant="circular" width={24} height={24} sx={{ mr: 2 }} />
                    <Box flexGrow={1}>
                      <Skeleton variant="text" height={16} width="40%" />
                      <Skeleton variant="text" height={32} width="60%" sx={{ mt: 1 }} />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Filters Skeleton */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
              <Skeleton variant="rectangular" width={200} height={56} borderRadius={1} />
              <Skeleton variant="rectangular" width={150} height={56} borderRadius={1} />
              <Skeleton variant="rectangular" width={150} height={56} borderRadius={1} />
              <Skeleton variant="rectangular" width={80} height={56} borderRadius={1} />
            </Box>
          </CardContent>
        </Card>

        {/* Recent Bills Table Skeleton */}
        <Card>
          <CardContent>
            <Skeleton variant="text" width="25%" height={24} sx={{ mb: 2 }} />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[1, 2, 3, 4, 5].map((item) => (
                    <TableRow key={item}>
                      <TableCell><Skeleton variant="text" height={20} width="60%" /></TableCell>
                      <TableCell><Skeleton variant="rectangular" height={24} width={80} /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="50%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="40%" /></TableCell>
                      <TableCell><Skeleton variant="rectangular" height={24} width={60} /></TableCell>
                      <TableCell>
                        <Skeleton variant="circular" width={24} height={24} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box mb={3}>
        <Typography variant="h4" component="h1">
          Utility Bills Management
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          View utility bill records only. Centralized store bills are managed under Centralized Store.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <ReceiptIcon color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Total Bills
                    </Typography>
                    <Typography variant="h4">
                      {summary.byType.reduce((total, item) => total + (item.total || 0), 0)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <WarningIcon color="warning" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Pending Bills
                    </Typography>
                    <Typography variant="h4" color="warning.main">
                      {summary.byType.reduce((total, item) => total + (item.pending || 0), 0)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <WarningIcon color="error" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Overdue Bills
                    </Typography>
                    <Typography variant="h4" color="error.main">
                      {summary.byType.reduce((total, item) => total + (item.overdue || 0), 0)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <CheckCircleIcon color="success" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Monthly Total
                    </Typography>
                    <Typography variant="h4" color="primary.main">
                      {formatCurrency(summary.monthly?.monthlyTotal || 0)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search Bills"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                placeholder="Search by bill ID, site, provider, department..."
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Utility Type</InputLabel>
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  label="Utility Type"
                >
                  <MenuItem value="">All Types</MenuItem>
                  {utilityTypes.map(type => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Status</MenuItem>
                  {statuses.map(status => (
                    <MenuItem key={status} value={status}>{status}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  setSearchTerm('');
                  setFilterType('');
                  setFilterStatus('');
                }}
              >
                Clear
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Bills grouped by bill month & year (collapsible) */}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
        Bills by period (bill date)
      </Typography>
      {billsByMonthYear.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary" align="center" py={2}>
              No utility bills match your filters.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {billsByMonthYear.map(({ key, label, bills: periodBills, total }, idx) => (
            <Accordion
              key={key}
              defaultExpanded={idx === 0}
              disableGutters
              elevation={0}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'action.hover' : 'grey.50') }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" width="100%" pr={1} flexWrap="wrap" gap={1}>
                  <Typography fontWeight={600}>{label}</Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip size="small" label={`${periodBills.length} bill${periodBills.length === 1 ? '' : 's'}`} />
                    <Chip size="small" color="primary" variant="outlined" label={`Total ${formatCurrency(total)}`} />
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, px: 0 }}>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 0 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Bill ID</TableCell>
                        <TableCell>Bill date</TableCell>
                        <TableCell>Site</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Provider</TableCell>
                        <TableCell>Department</TableCell>
                        <TableCell>Custodian</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Paid</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Workflow</TableCell>
                        <TableCell>Due date</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {periodBills.map((bill) => (
                        <TableRow key={bill._id} hover>
                          <TableCell>{bill.billId}</TableCell>
                          <TableCell>{bill.billDate ? formatDate(bill.billDate) : '—'}</TableCell>
                          <TableCell>{bill.site || 'N/A'}</TableCell>
                          <TableCell>{bill.utilityType}</TableCell>
                          <TableCell>{bill.provider}</TableCell>
                          <TableCell>{bill.department || 'N/A'}</TableCell>
                          <TableCell>{bill.custodian || 'N/A'}</TableCell>
                          <TableCell>{formatCurrency(bill.amount)}</TableCell>
                          <TableCell>{formatCurrency(bill.paidAmount)}</TableCell>
                          <TableCell>
                            <Chip label={bill.status} color={getStatusColor(bill.status)} size="small" />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getWorkflowLabel(bill)}
                              color={getWorkflowColor(bill)}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{formatDate(bill.dueDate)}</TableCell>
                          <TableCell align="right">
                            <Tooltip title="View">
                              <IconButton size="small" onClick={() => navigate(`/admin/utility-bills/${bill._id}`)}>
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}

    </Box>
  );
};

export default UtilityBillDashboard;