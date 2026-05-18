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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Checkbox,
  Radio,
  Collapse
} from '@mui/material';


import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  CalendarMonth as CalendarMonthIcon,
  MergeType as MergeTypeIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import utilityBillService from '../../../services/utilityBillService';
import {
  sumConsolidatedLineAmounts,
  UTILITY_MEMO_COL_WIDTHS,
  utilityMemoDateCellSx,
  utilityMemoRefCellSx,
  utilityMemoTableSx
} from '../../../utils/utilityBillMemoUtils';

function getConsolidatedIntoId(bill) {
  const ref = bill.consolidatedIntoBillId;
  if (!ref) return null;
  return String(ref._id != null ? ref._id : ref);
}

/** Top-level rows per period; bundled bills nested under `isConsolidated` parent only when parent is in the same period. */
function structurePeriodBills(groupBills) {
  const byId = new Map(groupBills.map((b) => [String(b._id), b]));
  const childrenByParent = new Map();

  for (const bill of groupBills) {
    const pid = getConsolidatedIntoId(bill);
    if (!pid) continue;
    const parent = byId.get(pid);
    if (parent && parent.isConsolidated) {
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid).push(bill);
    }
  }

  const nestedChildIds = new Set();
  childrenByParent.forEach((arr) => {
    arr.forEach((c) => nestedChildIds.add(String(c._id)));
  });

  const sortFn = (a, b) => {
    const ta = a.billDate ? new Date(a.billDate).getTime() : 0;
    const tb = b.billDate ? new Date(b.billDate).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return String(a.billId || '').localeCompare(String(b.billId || ''));
  };

  const roots = groupBills
    .filter((b) => !nestedChildIds.has(String(b._id)))
    .sort(sortFn);

  return roots.map((bill) => {
    if (bill.isConsolidated) {
      const kids = (childrenByParent.get(String(bill._id)) || []).slice().sort(sortFn);
      return { kind: 'parent', bill, children: kids };
    }
    return { kind: 'standalone', bill };
  });
}

const UtilityBillDashboard = () => {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState({ byType: [], monthly: { monthlyTotal: 0, monthlyPaid: 0, monthlyBills: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  /** Bill `_id` chosen as template for "next month" create flow */
  const [templateBillId, setTemplateBillId] = useState(null);
  /** Source bills selected to merge into one consolidated parent bill */
  const [consolidateBillIds, setConsolidateBillIds] = useState([]);
  const [consolidateDialogOpen, setConsolidateDialogOpen] = useState(false);
  const [consolidateSubmitting, setConsolidateSubmitting] = useState(false);
  /** Parent consolidated bill `_id` -> expanded nested source bills */
  const [expandedConsolidated, setExpandedConsolidated] = useState({});

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
          limit: 500,
          page: 1
        }),
        utilityBillService.getSummary()
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

  const formatMemoDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    }).replace(/ /g, '-');
  };

  const formatMemoAmount = (amount) =>
    new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(Number(amount || 0));

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

  const canSelectForConsolidate = (bill) =>
    !bill.consolidatedIntoBillId && !bill.isConsolidated;

  const consolidateBills = useMemo(
    () =>
      consolidateBillIds
        .map((id) => bills.find((b) => String(b._id) === String(id)))
        .filter(Boolean),
    [consolidateBillIds, bills]
  );

  const consolidatePreviewPrimary = useMemo(() => {
    if (!consolidateBills.length) return null;
    return [...consolidateBills].sort((a, b) => String(a.billId || '').localeCompare(String(b.billId || '')))[0];
  }, [consolidateBills]);

  const consolidatePreviewMemoDate = useMemo(() => {
    const d = consolidateBills.reduce((best, b) => {
      const t = b.billDate ? new Date(b.billDate) : null;
      if (!t || Number.isNaN(t.getTime())) return best;
      return !best || t > best ? t : best;
    }, null);
    const target = d || new Date();
    return target.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    }).replace(/ /g, '-');
  }, [consolidateBills]);

  const toggleConsolidateBill = (bill) => {
    if (!canSelectForConsolidate(bill)) return;
    const id = String(bill._id);
    setConsolidateBillIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleOpenConsolidateDialog = () => {
    if (consolidateBillIds.length < 2) return;
    const keys = new Set(consolidateBills.map((b) => billPeriodKey(b)).filter((k) => k && k !== '0000-00'));
    if (keys.size !== 1) {
      setError('Consolidated bill: select bills from the same calendar month only (by bill date).');
      return;
    }
    setError(null);
    setConsolidateDialogOpen(true);
  };

  const handleSubmitConsolidate = async () => {
    try {
      setConsolidateSubmitting(true);
      setError(null);
      const res = await utilityBillService.consolidateUtilityBills({ billIds: consolidateBillIds });
      const newId = res?.data?._id;
      setConsolidateDialogOpen(false);
      setConsolidateBillIds([]);
      await fetchData();
      if (newId) {
        navigate(`/admin/utility-bills/${newId}`);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create consolidated bill.';
      setError(msg);
    } finally {
      setConsolidateSubmitting(false);
    }
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
      const groupBills = map.get(key);
      const total = groupBills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
      const periodRows = structurePeriodBills(groupBills);
      return { key, label: formatPeriodLabel(key), bills: groupBills, periodRows, total };
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Utility Bills Management
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<MergeTypeIcon />}
            disabled={consolidateBillIds.length < 2}
            onClick={handleOpenConsolidateDialog}
          >
            Create consolidated bill
          </Button>
          <Button
            variant="outlined"
            startIcon={<CalendarMonthIcon />}
            disabled={!templateBillId}
            onClick={() => {
              if (templateBillId) {
                navigate(`/admin/utility-bills/new?from=${templateBillId}`);
              }
            }}
          >
            Next month from selected
          </Button>
          <Button variant="outlined" onClick={() => navigate('/admin/centralized-store')}>
            Centralized Store
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/utility-bills/new')}
          >
            Add New Bill
          </Button>
        </Stack>
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
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Bills by period (bill date)
        </Typography>
        {templateBillId && (
          <Typography variant="caption" color="text.secondary">
            One template bill selected (radio column) — use &quot;Next month from selected&quot; in the header to open a prefilled draft.
          </Typography>
        )}
        {consolidateBillIds.length > 0 && (
          <Typography variant="caption" color="text.secondary" display="block">
            {consolidateBillIds.length} bill{consolidateBillIds.length === 1 ? '' : 's'} selected — preview uses the full memo columns (date, reference, payee, for what, amounts).
          </Typography>
        )}
      </Box>
      {billsByMonthYear.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary" align="center" py={2}>
              No utility bills match your filters. Try clearing search or add a new bill.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {billsByMonthYear.map(({ key, label, bills: periodBills, periodRows, total }, idx) => {
            const toggleConsolidatedExpand = (parentId) => {
              const id = String(parentId);
              setExpandedConsolidated((prev) => ({ ...prev, [id]: !prev[id] }));
            };

            const billCellsFromMerge = (bill, { nested }) => (
              <>
                <TableCell padding="checkbox" align="center">
                  <Checkbox
                    size="small"
                    checked={consolidateBillIds.includes(String(bill._id))}
                    disabled={!canSelectForConsolidate(bill)}
                    onChange={() => toggleConsolidateBill(bill)}
                    inputProps={{ 'aria-label': `Include bill ${bill.billId} in consolidated bill` }}
                  />
                </TableCell>
                <TableCell padding="checkbox" align="center">
                  <Radio
                    size="small"
                    checked={templateBillId != null && String(templateBillId) === String(bill._id)}
                    onChange={() => setTemplateBillId(bill._id)}
                    onClick={(e) => {
                      if (templateBillId != null && String(templateBillId) === String(bill._id)) {
                        e.preventDefault();
                        setTemplateBillId(null);
                      }
                    }}
                    inputProps={{
                      'aria-label': `Template for next month: bill ${bill.billId}`
                    }}
                    sx={{ py: 0.25 }}
                  />
                </TableCell>
                <TableCell
                  sx={
                    nested
                      ? (theme) => ({
                          pl: 1,
                          borderLeft: `3px solid ${theme.palette.divider}`
                        })
                      : undefined
                  }
                >
                  <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
                    <span>{bill.billId}</span>
                    {!nested && bill.isConsolidated && (
                      <Chip size="small" label="Main consolidated" color="secondary" variant="outlined" />
                    )}
                    {nested && (
                      <Chip size="small" label="Source bill" color="default" variant="outlined" />
                    )}
                    {!nested && bill.consolidatedIntoBillId && (
                      <Chip
                        size="small"
                        label="Bundled"
                        color="default"
                        variant="outlined"
                        onClick={() => {
                          const pid = bill.consolidatedIntoBillId?._id || bill.consolidatedIntoBillId;
                          if (pid) navigate(`/admin/utility-bills/${pid}`);
                        }}
                        sx={{ cursor: bill.consolidatedIntoBillId ? 'pointer' : 'default' }}
                      />
                    )}
                  </Box>
                </TableCell>
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
                  <Box display="flex" gap={0.5} justifyContent="flex-end" flexWrap="wrap">
                    <Tooltip title="View">
                      <IconButton size="small" onClick={() => navigate(`/admin/utility-bills/${bill._id}`)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <span>
                        <IconButton
                          size="small"
                          disabled={Boolean(bill.consolidatedIntoBillId)}
                          onClick={() => navigate(`/admin/utility-bills/${bill._id}/edit`)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip
                      title={
                        bill.consolidatedIntoBillId
                          ? 'Cannot delete: bundled into consolidated bill'
                          : 'Delete'
                      }
                    >
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={Boolean(bill.consolidatedIntoBillId)}
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this utility bill?')) {
                              utilityBillService
                                .deleteUtilityBill(bill._id)
                                .then(() => fetchData())
                                .catch(() => setError('Failed to delete utility bill'));
                            }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </TableCell>
              </>
            );

            return (
            <Accordion key={key} defaultExpanded={idx === 0} disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
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
                        <Tooltip
                          title="Consolidated main: expand to see source bills under this row."
                          placement="top"
                        >
                          <TableCell sx={{ width: 40, cursor: 'help', px: 0.5 }} />
                        </Tooltip>
                        <Tooltip
                          title="Select one or more bills to combine into one consolidated bill (same calendar month only)."
                          placement="top"
                        >
                          <TableCell padding="checkbox" align="center" sx={{ width: 44, cursor: 'help' }}>
                            Merge
                          </TableCell>
                        </Tooltip>
                        <Tooltip
                          title='Pick one bill only. Used with "Next month from selected" to open a new draft copied from that bill.'
                          placement="top"
                        >
                          <TableCell padding="checkbox" align="center" sx={{ width: 48, cursor: 'help' }}>
                            Template
                          </TableCell>
                        </Tooltip>
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
                      {periodRows.map((row) => {
                        if (row.kind === 'standalone') {
                          const bill = row.bill;
                          return (
                            <TableRow
                              key={bill._id}
                              hover
                              selected={
                                (templateBillId != null &&
                                  String(templateBillId) === String(bill._id)) ||
                                consolidateBillIds.includes(String(bill._id))
                              }
                            >
                              <TableCell padding="none" align="center" sx={{ width: 40 }} />
                              {billCellsFromMerge(bill, { nested: false })}
                            </TableRow>
                          );
                        }

                        const parent = row.bill;
                        const { children } = row;
                        const pid = String(parent._id);
                        const expanded = Boolean(expandedConsolidated[pid]);
                        return (
                          <React.Fragment key={pid}>
                            <TableRow
                              hover
                              selected={
                                (templateBillId != null &&
                                  String(templateBillId) === String(parent._id)) ||
                                consolidateBillIds.includes(String(parent._id))
                              }
                            >
                              <TableCell padding="none" align="center" sx={{ width: 40, verticalAlign: 'middle' }}>
                                {children.length > 0 ? (
                                  <IconButton
                                    size="small"
                                    aria-label={expanded ? 'Hide source bills' : 'Show source bills'}
                                    onClick={() => toggleConsolidatedExpand(parent._id)}
                                  >
                                    {expanded ? (
                                      <KeyboardArrowDownIcon fontSize="small" />
                                    ) : (
                                      <KeyboardArrowRightIcon fontSize="small" />
                                    )}
                                  </IconButton>
                                ) : (
                                  <Box sx={{ width: 28, height: 28, mx: 'auto' }} />
                                )}
                              </TableCell>
                              {billCellsFromMerge(parent, { nested: false })}
                            </TableRow>
                            {children.length > 0 && (
                              <TableRow>
                                <TableCell
                                  colSpan={16}
                                  sx={{ py: 0, borderBottom: (t) => `1px solid ${t.palette.divider}` }}
                                >
                                  <Collapse in={expanded} timeout="auto" unmountOnExit>
                                    <Box sx={{ px: 1, py: 1, bgcolor: (t) => (t.palette.mode === 'dark' ? 'action.hover' : 'grey.50') }}>
                                      <Table size="small">
                                        <TableBody>
                                          {children.map((child) => (
                                            <TableRow
                                              key={child._id}
                                              hover
                                              selected={
                                                (templateBillId != null &&
                                                  String(templateBillId) === String(child._id)) ||
                                                consolidateBillIds.includes(String(child._id))
                                              }
                                              sx={{ '& > td': { borderBottom: 'none' } }}
                                            >
                                              <TableCell sx={{ width: 40, p: 0.5 }} />
                                              {billCellsFromMerge(child, { nested: true })}
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </Box>
                                  </Collapse>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
            );
          })}
        </Stack>
      )}

      <Dialog
        open={consolidateDialogOpen}
        onClose={() => !consolidateSubmitting && setConsolidateDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle>Create one consolidated utility bill</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Preview matches the main utility bill layout: each selected bill becomes one line in the memo table. After you confirm, a new bill opens with this structure and combined totals.
          </Typography>

          <Paper
            variant="outlined"
            sx={{
              p: { xs: 2, sm: 2.5 },
              bgcolor: 'background.paper',
              borderColor: 'grey.300',
              fontFamily: 'Georgia, "Times New Roman", serif',
              color: '#151515'
            }}
          >
            <Box textAlign="center" sx={{ mb: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'grey.300' }}>
              <Typography sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: { xs: 16, sm: 17 } }}>
                {(consolidatePreviewPrimary?.accountHead || consolidatePreviewPrimary?.site || 'Preview').toUpperCase()}
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 15, mt: 0.5 }}>
                Consolidated — {consolidateBills.length} utility bills
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 140px' },
                gap: 1,
                mb: 2,
                fontSize: 13
              }}
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: '72px 1fr', columnGap: 1, rowGap: 0.5 }}>
                <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>SITE :</Typography>
                <Typography sx={{ fontWeight: 700 }}>{consolidatePreviewPrimary?.site || consolidatePreviewPrimary?.location || '—'}</Typography>
                <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>From:</Typography>
                <Typography sx={{ fontWeight: 700 }}>{consolidatePreviewPrimary?.department || '—'}</Typography>
                <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Custodian:</Typography>
                <Typography sx={{ fontWeight: 700 }}>{consolidatePreviewPrimary?.custodian || '—'}</Typography>
              </Box>
              <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, lineHeight: 1.9 }}>
                <Typography sx={{ fontWeight: 800 }}>{consolidatePreviewMemoDate}</Typography>
                <Typography sx={{ fontWeight: 800, color: 'text.secondary' }}>New bill (preview)</Typography>
              </Box>
            </Box>

            <TableContainer sx={{ border: '1px solid', borderColor: 'grey.300', borderRadius: 1, overflowX: 'auto' }}>
              <Table size="small" sx={utilityMemoTableSx}>
                <colgroup>
                  {UTILITY_MEMO_COL_WIDTHS.map((width, colIdx) => (
                    <col key={`preview-col-${colIdx}`} style={{ width }} />
                  ))}
                </colgroup>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    {['Date', 'Reference No', 'To Whom Paid', 'For What', 'Amount', 'Last Month'].map((label) => (
                      <TableCell
                        key={label}
                        align={label.includes('Amount') || label.includes('Month') ? 'right' : 'center'}
                        sx={{ fontWeight: 800, fontSize: 11, py: 1, borderColor: 'grey.300', lineHeight: 1.2 }}
                      >
                        {label === 'Reference No' ? (
                          <>
                            Reference
                            <br />
                            No
                          </>
                        ) : (
                          label
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    const sortedPreview = [...consolidateBills].sort((a, b) =>
                      String(a.billId || '').localeCompare(String(b.billId || ''))
                    );
                    const previewTotals = sumConsolidatedLineAmounts(sortedPreview);
                    return (
                      <>
                  {sortedPreview.map((b) => (
                      <TableRow key={b._id}>
                        <TableCell sx={{ ...utilityMemoDateCellSx, fontSize: 12 }}>{formatMemoDate(b.billDate)}</TableCell>
                        <TableCell sx={{ ...utilityMemoRefCellSx, fontSize: 12 }}>
                          <Typography component="span" sx={{ fontWeight: 700 }}>
                            {b.accountNumber || '—'}
                          </Typography>
                          {b.billId ? (
                            <Typography variant="caption" display="block" color="text.secondary">
                              {b.billId}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12, wordBreak: 'break-word' }}>{b.provider || '—'}</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>
                          {(b.forWhat || b.description || b.utilityType || '—').toString().slice(0, 280)}
                          {String(b.forWhat || b.description || '').length > 280 ? '…' : ''}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontSize: 12 }}>
                          {formatMemoAmount(b.amount)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontSize: 12 }}>
                          {formatMemoAmount(b.lastMonthAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={4} align="right" sx={{ fontWeight: 800, fontSize: 12, py: 0.75, pr: 1, borderTop: '1px solid', borderColor: 'grey.300' }}>
                        Total
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: 12, py: 0.75, borderTop: '1px solid', borderColor: 'grey.300' }}>
                        {formatMemoAmount(previewTotals.amountTotal)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: 12, py: 0.75, borderTop: '1px solid', borderColor: 'grey.300' }}>
                        {formatMemoAmount(previewTotals.lastMonthTotal)}
                      </TableCell>
                    </TableRow>
                      </>
                    );
                  })()}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConsolidateDialogOpen(false)} disabled={consolidateSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmitConsolidate} variant="contained" disabled={consolidateSubmitting}>
            {consolidateSubmitting ? 'Creating…' : 'Create & open bill'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default UtilityBillDashboard;