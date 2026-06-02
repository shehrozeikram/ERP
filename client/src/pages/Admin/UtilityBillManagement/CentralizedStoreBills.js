import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
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
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import utilityBillService from '../../../services/utilityBillService';
import centralizedStoreService from '../../../services/centralizedStoreService';
import NarrationTableCell from '../../../components/common/NarrationTableCell';
import { getBillNarrationDisplay } from '../../../utils/documentNarrationDisplay';

const sortBillsByDate = (a, b) => {
  const ta = a.billDate ? new Date(a.billDate).getTime() : 0;
  const tb = b.billDate ? new Date(b.billDate).getTime() : 0;
  if (ta !== tb) return ta - tb;
  return String(a.billId || '').localeCompare(String(b.billId || ''));
};

/** Unique store categories represented on a bill's line items */
const getBillCategories = (bill) => {
  const byId = new Map();
  (bill.billLines || []).forEach((line) => {
    const cat = line.storeItem?.category;
    if (!cat) return;
    const id = String(cat._id || cat);
    const name = cat.name || 'Uncategorized';
    if (!byId.has(id)) byId.set(id, name);
  });
  return [...byId.entries()].map(([id, name]) => ({ id, name }));
};

const CentralizedStoreBills = () => {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');

  const loadCategories = useCallback(async () => {
    try {
      const res = await centralizedStoreService.getCatalog();
      setCategories(res.data?.categories || res.categories || []);
    } catch (err) {
      console.error('Failed to load store categories', err);
    }
  }, []);

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        search: searchTerm,
        centralizedStoreOnly: true,
        limit: 500,
        page: 1
      };
      if (filterCategoryId) params.storeCategoryId = filterCategoryId;

      const response = await utilityBillService.getUtilityBills(params);
      setBills(response.data || []);
    } catch (err) {
      setError('Failed to fetch centralized store bills');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterCategoryId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amount || 0);

  const formatDate = (date) => (date ? new Date(date).toLocaleDateString('en-PK') : '—');

  const getWorkflowLabel = (bill) => {
    if (bill.auditStatus && bill.auditStatus !== 'Not Sent') return bill.auditStatus;
    return bill.approvalStatus || 'Draft';
  };

  const getWorkflowColor = (bill) => {
    const label = getWorkflowLabel(bill);
    if (label.includes('Approved')) return 'success';
    if (label === 'Send to Audit' || label === 'Forwarded to Audit Director' || label === 'Submitted') return 'warning';
    if (label.includes('Rejected') || label === 'Returned from Audit') return 'error';
    return 'default';
  };

  const vendorName = (bill) =>
    bill.vendorId?.name || bill.provider || '—';

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

  const clearFilters = () => {
    setSearchTerm('');
    setFilterCategoryId('');
  };

  if (loading && bills.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width="40%" height={48} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={56} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={320} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" component="h1">
            Bills
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Centralized store bills created from Create Bill.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/centralized-store/bill/new')}
        >
          Create Bill
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                label="Search bills"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                placeholder="Bill ID, vendor, narration..."
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={filterCategoryId}
                  onChange={(e) => setFilterCategoryId(e.target.value)}
                  label="Category"
                >
                  <MenuItem value="">All categories</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat._id} value={cat._id}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" fullWidth onClick={clearFilters}>
                  Clear
                </Button>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchBills}>
                  Refresh
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
        Bills by period
      </Typography>

      {billsByMonthYear.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary" align="center" py={2}>
              {filterCategoryId
                ? 'No bills found for this category. Try another filter or create a bill.'
                : 'No centralized store bills yet. Use Create Bill to add one.'}
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
                        <TableCell>Category</TableCell>
                        <TableCell>Vendor</TableCell>
                        <TableCell sx={{ minWidth: 180, maxWidth: 280 }}>Narration / Description</TableCell>
                        <TableCell>Items</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Workflow</TableCell>
                        <TableCell>Due date</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {periodBills.map((bill) => {
                        const billCategories = getBillCategories(bill);
                        return (
                          <TableRow key={bill._id} hover>
                            <TableCell>{bill.billId}</TableCell>
                            <TableCell>{formatDate(bill.billDate)}</TableCell>
                            <TableCell>
                              {billCategories.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                  —
                                </Typography>
                              ) : (
                                <Box display="flex" flexWrap="wrap" gap={0.5}>
                                  {billCategories.map((cat) => (
                                    <Chip key={cat.id} label={cat.name} size="small" variant="outlined" />
                                  ))}
                                </Box>
                              )}
                            </TableCell>
                            <TableCell>{vendorName(bill)}</TableCell>
                            <NarrationTableCell text={getBillNarrationDisplay(bill)} />
                            <TableCell>{bill.billLines?.length || 0}</TableCell>
                            <TableCell>{formatCurrency(bill.amount)}</TableCell>
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
                              <Tooltip title="View bill">
                                <IconButton
                                  size="small"
                                  onClick={() => navigate(`/admin/centralized-store/bills/${bill._id}`)}
                                >
                                  <ViewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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

export default CentralizedStoreBills;
