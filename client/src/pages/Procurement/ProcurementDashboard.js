import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Button,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Avatar
} from '@mui/material';
import {
  ShoppingCart,
  Description,
  RequestQuote,
  ReceiptLong,
  LocalShipping,
  Add,
  Visibility,
  PendingActions,
  CheckCircle,
  TrendingUp,
  AssignmentInd,
  AssignmentTurnedIn
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import procurementService from '../../services/procurementService';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';

const StatCard = ({ title, value, subtitle, icon, color, onClick }) => (
  <Card
    onClick={onClick}
    sx={{
      height: '100%',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s ease',
      '&:hover': onClick
        ? {
            transform: 'translateY(-3px)',
            boxShadow: 4
          }
        : {}
    }}
  >
    <CardContent>
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar sx={{ bgcolor: color, width: 52, height: 52 }}>
          {icon}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {value}
          </Typography>
          {!!subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const ProcurementDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requisitions, setRequisitions] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [requisitionsRes, quotationsRes, poRes] = await Promise.all([
        procurementService.getRequisitions({ page: 1, limit: 200 }),
        procurementService.getQuotations({ page: 1, limit: 200 }),
        procurementService.getPurchaseOrders({ page: 1, limit: 200 })
      ]);

      setRequisitions(requisitionsRes?.data?.indents || []);
      setQuotations(quotationsRes?.data?.quotations || []);
      setPurchaseOrders(poRes?.data?.purchaseOrders || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load procurement dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const requisitionStatus = useMemo(() => {
    return requisitions.reduce((acc, req) => {
      const key = req.status || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [requisitions]);

  const quotationStatus = useMemo(() => {
    return quotations.reduce((acc, quote) => {
      const key = quote.status || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [quotations]);

  const poStatus = useMemo(() => {
    return purchaseOrders.reduce((acc, po) => {
      const key = po.status || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [purchaseOrders]);

  const totalPOValue = useMemo(() => {
    return purchaseOrders.reduce((sum, po) => sum + (Number(po.totalAmount) || 0), 0);
  }, [purchaseOrders]);

  const assignmentStats = useMemo(() => {
    const assigned = requisitions.filter(
      (req) => req?.procurementAssignment?.status === 'assigned' && req?.procurementAssignment?.assignedTo
    ).length;
    const unassigned = requisitions.length - assigned;
    return { assigned, unassigned };
  }, [requisitions]);

  const approvedRequisitions = requisitionStatus.Approved || 0;
  const shortlistedQuotes = quotationStatus.Shortlisted || 0;
  const finalizedQuotes = quotationStatus.Finalized || 0;
  const poInProgress = (poStatus.Submitted || 0) + (poStatus['Under Review'] || 0);

  const getStatusChipColor = (status) => {
    const map = {
      Draft: 'default',
      Submitted: 'info',
      Approved: 'success',
      Rejected: 'error',
      Received: 'info',
      Shortlisted: 'warning',
      Finalized: 'success',
      'Under Review': 'warning',
      Fulfilled: 'success',
      Cancelled: 'default'
    };
    return map[status] || 'default';
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Procurement Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Live snapshot of requisitions, quotations, and purchase orders
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<Visibility />} onClick={loadDashboardData}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/procurement/quotations')}>
            Open Quotations
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Approved Requisitions"
            value={approvedRequisitions}
            subtitle={`${requisitions.length} total requisitions`}
            icon={<Description />}
            color="success.main"
            onClick={() => navigate('/procurement/requisitions')}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Shortlisted Quotations"
            value={shortlistedQuotes}
            subtitle={`${finalizedQuotes} finalized`}
            icon={<RequestQuote />}
            color="warning.main"
            onClick={() => navigate('/procurement/quotations')}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="POs In Progress"
            value={poInProgress}
            subtitle={`${purchaseOrders.length} total purchase orders`}
            icon={<PendingActions />}
            color="info.main"
            onClick={() => navigate('/procurement/purchase-orders')}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Total PO Value"
            value={formatPKR(totalPOValue)}
            subtitle="Across loaded purchase orders"
            icon={<TrendingUp />}
            color="primary.main"
            onClick={() => navigate('/procurement/purchase-orders')}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6" fontWeight={700}>Assignment Overview</Typography>
                <AssignmentInd color="action" />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
                <Chip color="success" icon={<AssignmentTurnedIn />} label={`Assigned: ${assignmentStats.assigned}`} />
                <Chip color="warning" variant="outlined" icon={<AssignmentInd />} label={`Unassigned: ${assignmentStats.unassigned}`} />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Requisitions must be assigned before quotation and vendor-email actions.
              </Typography>
              <Button variant="outlined" onClick={() => navigate('/procurement/task-assignment')}>
                Open Task Assignment
              </Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                Execution Queue
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Use dedicated task views for manager allocation and team execution.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" onClick={() => navigate('/procurement/task-assignment')}>
                  Task Assignment
                </Button>
                <Button variant="outlined" onClick={() => navigate('/procurement/requisitions')}>
                  My/All Requisitions
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h6" fontWeight={700}>
                  Requisition Status
                </Typography>
                <Description color="action" />
              </Stack>
              <Stack spacing={1}>
                {Object.entries(requisitionStatus).length === 0 ? (
                  <Typography color="text.secondary" variant="body2">No requisitions found</Typography>
                ) : (
                  Object.entries(requisitionStatus).map(([status, count]) => (
                    <Stack key={status} direction="row" justifyContent="space-between" alignItems="center">
                      <Chip label={status} size="small" color={getStatusChipColor(status)} />
                      <Typography fontWeight={600}>{count}</Typography>
                    </Stack>
                  ))
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h6" fontWeight={700}>
                  Quotation Status
                </Typography>
                <ReceiptLong color="action" />
              </Stack>
              <Stack spacing={1}>
                {Object.entries(quotationStatus).length === 0 ? (
                  <Typography color="text.secondary" variant="body2">No quotations found</Typography>
                ) : (
                  Object.entries(quotationStatus).map(([status, count]) => (
                    <Stack key={status} direction="row" justifyContent="space-between" alignItems="center">
                      <Chip label={status} size="small" color={getStatusChipColor(status)} />
                      <Typography fontWeight={600}>{count}</Typography>
                    </Stack>
                  ))
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h6" fontWeight={700}>
                  PO Status
                </Typography>
                <LocalShipping color="action" />
              </Stack>
              <Stack spacing={1}>
                {Object.entries(poStatus).length === 0 ? (
                  <Typography color="text.secondary" variant="body2">No purchase orders found</Typography>
                ) : (
                  Object.entries(poStatus).map(([status, count]) => (
                    <Stack key={status} direction="row" justifyContent="space-between" alignItems="center">
                      <Chip label={status} size="small" color={getStatusChipColor(status)} />
                      <Typography fontWeight={600}>{count}</Typography>
                    </Stack>
                  ))
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h6" fontWeight={700}>Recent Requisitions</Typography>
                <Button size="small" onClick={() => navigate('/procurement/requisitions')}>View All</Button>
              </Stack>
              <Divider sx={{ mb: 1.5 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Req #</strong></TableCell>
                      <TableCell><strong>Department</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                      <TableCell><strong>Date</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {requisitions.slice(0, 6).map((req) => (
                      <TableRow key={req._id} hover>
                        <TableCell>{req.indentNumber || '-'}</TableCell>
                        <TableCell>{req.department?.name || '-'}</TableCell>
                        <TableCell>
                          <Chip label={req.status || 'Unknown'} size="small" color={getStatusChipColor(req.status)} />
                        </TableCell>
                        <TableCell>{formatDate(req.requestedDate || req.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {requisitions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary">No requisitions found</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h6" fontWeight={700}>Recent Quotations</Typography>
                <Button size="small" onClick={() => navigate('/procurement/quotations')}>View All</Button>
              </Stack>
              <Divider sx={{ mb: 1.5 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Quote #</strong></TableCell>
                      <TableCell><strong>Requisition</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                      <TableCell><strong>Amount</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {quotations.slice(0, 6).map((quote) => (
                      <TableRow key={quote._id} hover>
                        <TableCell>{quote.quotationNumber || '-'}</TableCell>
                        <TableCell>{quote.indent?.indentNumber || '-'}</TableCell>
                        <TableCell>
                          <Chip label={quote.status || 'Unknown'} size="small" color={getStatusChipColor(quote.status)} />
                        </TableCell>
                        <TableCell>{formatPKR(quote.totalAmount || 0)}</TableCell>
                      </TableRow>
                    ))}
                    {quotations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary">No quotations found</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 1.5 }} spacing={1}>
                <Typography variant="h6" fontWeight={700}>Recent Purchase Orders</Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => navigate('/procurement/purchase-orders')}>View All POs</Button>
                  <Tooltip title="Open Purchase Orders module">
                    <IconButton size="small" color="primary" onClick={() => navigate('/procurement/purchase-orders')}>
                      <ShoppingCart fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
              <Divider sx={{ mb: 1.5 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>PO #</strong></TableCell>
                      <TableCell><strong>Vendor</strong></TableCell>
                      <TableCell><strong>Requisition</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                      <TableCell><strong>Total</strong></TableCell>
                      <TableCell><strong>Date</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {purchaseOrders.slice(0, 8).map((po) => (
                      <TableRow key={po._id} hover>
                        <TableCell>{po.orderNumber || '-'}</TableCell>
                        <TableCell>{po.vendor?.name || '-'}</TableCell>
                        <TableCell>{po.indent?.indentNumber || '-'}</TableCell>
                        <TableCell>
                          <Chip label={po.status || 'Unknown'} size="small" color={getStatusChipColor(po.status)} />
                        </TableCell>
                        <TableCell>{formatPKR(po.totalAmount || 0)}</TableCell>
                        <TableCell>{formatDate(po.orderDate || po.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {purchaseOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography variant="body2" color="text.secondary">No purchase orders found</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
            Quick Actions
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="outlined" startIcon={<Description />} onClick={() => navigate('/procurement/requisitions')}>
              Requisitions
            </Button>
            <Button variant="outlined" startIcon={<AssignmentInd />} onClick={() => navigate('/procurement/task-assignment')}>
              Task Assignment
            </Button>
            <Button variant="outlined" startIcon={<RequestQuote />} onClick={() => navigate('/procurement/quotations')}>
              Quotations
            </Button>
            <Button variant="outlined" startIcon={<CheckCircle />} onClick={() => navigate('/procurement/comparative-statements')}>
              Comparative Statements
            </Button>
            <Button variant="outlined" startIcon={<ShoppingCart />} onClick={() => navigate('/procurement/purchase-orders')}>
              Purchase Orders
            </Button>
            <Button variant="outlined" startIcon={<LocalShipping />} onClick={() => navigate('/procurement/vendor-bills')}>
              Vendor Bills
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ProcurementDashboard;
