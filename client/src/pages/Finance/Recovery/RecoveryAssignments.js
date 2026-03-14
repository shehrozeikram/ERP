import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Snackbar,
  Badge
} from '@mui/material';
import { Assignment as AssignmentIcon, Search as SearchIcon, Upload as UploadIcon, ChatBubbleOutline as ChatIcon } from '@mui/icons-material';
import { usePagination } from '../../../hooks/usePagination';
import TablePaginationWrapper from '../../../components/TablePaginationWrapper';
import {
  fetchRecoveryAssignments,
  fetchRecoveryAssignmentStats,
  importRecoveryAssignmentsFromLatestFile,
  fetchWhatsAppIncomingMessages,
  fetchWhatsAppNumbersWithMessages
} from '../../../services/recoveryAssignmentService';

const formatCurrency = (val) => {
  const n = Number(val);
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-PK', { minimumFractionDigits: 0 });
};

const formatDate = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
};

function normalizeWhatsAppNumber(mobile) {
  if (!mobile) return '';
  let n = String(mobile).replace(/\D/g, '').trim();
  if (n.startsWith('0')) n = n.slice(1);
  if (n.length === 10 && n.startsWith('3')) n = '92' + n;
  else if (n.length === 10) n = '92' + n;
  return n || '';
}

const ASSIGNED_ACTION_LABELS = { whatsapp: 'WhatsApp message', call: 'Call', both: 'Both' };

const COLUMNS = [
  { id: 'orderCode', label: 'Order Code', minWidth: 90 },
  { id: 'customerName', label: 'Customer Name', minWidth: 140 },
  { id: 'bookingDate', label: 'Booking Date', minWidth: 110, format: formatDate },
  { id: 'sector', label: 'Sector', minWidth: 100 },
  { id: 'size', label: 'Size', minWidth: 80 },
  { id: 'cnic', label: 'CNIC', minWidth: 130 },
  { id: 'mobileNumber', label: 'Mobile', minWidth: 110 },
  { id: 'customerAddress', label: 'Address', minWidth: 180 },
  { id: 'length', label: 'Length', minWidth: 80 },
  { id: 'plotNo', label: 'Plot No.', minWidth: 80 },
  { id: 'status', label: 'Status', minWidth: 90 },
  { id: 'salePrice', label: 'Sale Price', minWidth: 110, align: 'right', format: formatCurrency },
  { id: 'received', label: 'Received', minWidth: 110, align: 'right', format: formatCurrency },
  { id: 'currentlyDue', label: 'Currently Due', minWidth: 120, align: 'right', format: formatCurrency },
  { id: 'assignedToMember', label: 'Assigned To', minWidth: 120, format: (v) => (v && v.name) || '—' },
  { id: 'assignedAction', label: 'Action', minWidth: 120 }
];

const RecoveryAssignments = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, sectors: [], statuses: [] });
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [importing, setImporting] = useState(false);
  const [repliesDialogOpen, setRepliesDialogOpen] = useState(false);
  const [repliesRow, setRepliesRow] = useState(null);
  const [repliesMessages, setRepliesMessages] = useState([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [numbersWithMessages, setNumbersWithMessages] = useState([]);

  const pagination = usePagination({
    defaultRowsPerPage: 50,
    resetDependencies: [searchDebounced, sectorFilter, statusFilter]
  });

  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        ...pagination.getApiParams(),
        ...(searchDebounced.trim() && { search: searchDebounced.trim() }),
        ...(sectorFilter && { sector: sectorFilter }),
        ...(statusFilter && { status: statusFilter })
      };
      const res = await fetchRecoveryAssignments(params);
      const data = res.data?.data || [];
      const pag = res.data?.pagination || {};
      setRecords(Array.isArray(data) ? data : []);
      pagination.setTotal(pag.total || 0);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to load recovery assignments',
        severity: 'error'
      });
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [searchDebounced, sectorFilter, statusFilter, pagination.page, pagination.rowsPerPage]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchRecoveryAssignmentStats();
      const d = res.data?.data || {};
      setStats({ total: d.total || 0, sectors: d.sectors || [], statuses: d.statuses || [] });
    } catch {
      setStats({ total: 0, sectors: [], statuses: [] });
    }
  }, []);

  const loadNumbersWithMessages = useCallback(async () => {
    try {
      const res = await fetchWhatsAppNumbersWithMessages();
      setNumbersWithMessages(res?.data?.data || []);
    } catch {
      setNumbersWithMessages([]);
    }
  }, []);

  const handleOpenReplies = async (row) => {
    if (!row?.mobileNumber) {
      setSnackbar({ open: true, message: 'No mobile number', severity: 'warning' });
      return;
    }
    setRepliesRow(row);
    setRepliesDialogOpen(true);
    setRepliesMessages([]);
    setRepliesLoading(true);
    try {
      const res = await fetchWhatsAppIncomingMessages(row.mobileNumber);
      setRepliesMessages(res?.data?.data || []);
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to load messages', severity: 'error' });
      setRepliesMessages([]);
    } finally {
      setRepliesLoading(false);
    }
  };

  const handleCloseReplies = () => {
    setRepliesDialogOpen(false);
    setRepliesRow(null);
    loadNumbersWithMessages();
  };

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    // Run stats and numbers-with-messages in parallel (assignments loads first for main content)
    Promise.all([loadStats(), loadNumbersWithMessages()]).catch(() => {});
  }, [loadStats, loadNumbersWithMessages]);

  const handleSearchChange = (e) => setSearch(e.target.value);
  const handleSectorChange = (e) => setSectorFilter(e.target.value || '');
  const handleStatusChange = (e) => setStatusFilter(e.target.value || '');

  const handleImportLatest = async () => {
    try {
      setImporting(true);
      const res = await importRecoveryAssignmentsFromLatestFile();
      const inserted = res.data?.data?.inserted ?? 0;
      setSnackbar({
        open: true,
        message: res.data?.message || `Imported ${inserted} recovery assignments from latest-recovery.xlsx`,
        severity: 'success'
      });
      loadAssignments();
      loadStats();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Import failed. Ensure server/scripts/latest-recovery.xlsx exists.',
        severity: 'error'
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <AssignmentIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" fontWeight={600}>
          Recovery Assignments
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search order, customer, CNIC, plot..."
              value={search}
              onChange={handleSearchChange}
              sx={{ minWidth: 260 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                )
              }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Sector</InputLabel>
              <Select value={sectorFilter} onChange={handleSectorChange} label="Sector">
                <MenuItem value="">All</MenuItem>
                {stats.sectors.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} onChange={handleStatusChange} label="Status">
                <MenuItem value="">All</MenuItem>
                {stats.statuses.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Chip label={`Total: ${stats.total.toLocaleString()}`} color="primary" variant="outlined" />
            <Button
              variant="outlined"
              size="small"
              startIcon={importing ? <CircularProgress size={18} /> : <UploadIcon />}
              onClick={handleImportLatest}
              disabled={importing}
            >
              {importing ? 'Importing…' : 'Import from latest-recovery.xlsx'}
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : records.length === 0 ? (
            <Alert severity="info">No recovery assignments found. Run the import script to load data.</Alert>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 'calc(100vh - 320px)', minHeight: 500, overflowX: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {COLUMNS.map((col) => (
                        <TableCell
                          key={col.id}
                          sx={{ minWidth: col.minWidth, fontWeight: 600, bgcolor: 'grey.50' }}
                          align={col.align}
                        >
                          {col.label}
                        </TableCell>
                      ))}
                      <TableCell sx={{ minWidth: 80, fontWeight: 600, bgcolor: 'grey.50' }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.map((row) => (
                      <TableRow key={row._id} hover>
                        {COLUMNS.map((col) => (
                          <TableCell key={col.id} sx={{ minWidth: col.minWidth }} align={col.align}>
                            {col.id === 'assignedAction'
                              ? (row.assignedToMember ? (ASSIGNED_ACTION_LABELS[row.assignedToMember.action] || row.assignedToMember.action || '—') : '—')
                              : (col.format ? col.format(row[col.id]) : (row[col.id] ?? '—'))}
                          </TableCell>
                        ))}
                        <TableCell align="right">
                          <Badge color="success" variant="dot" invisible={!numbersWithMessages.includes(normalizeWhatsAppNumber(row.mobileNumber))}>
                            <IconButton size="small" onClick={() => handleOpenReplies(row)} title="View replies" disabled={!row?.mobileNumber}>
                              <ChatIcon />
                            </IconButton>
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePaginationWrapper
                page={pagination.page}
                rowsPerPage={pagination.rowsPerPage}
                total={pagination.total}
                onPageChange={pagination.handleChangePage}
                onRowsPerPageChange={pagination.handleChangeRowsPerPage}
                rowsPerPageOptions={[25, 50, 100, 200]}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={repliesDialogOpen} onClose={handleCloseReplies} maxWidth="sm" fullWidth>
        <DialogTitle>WhatsApp replies — {repliesRow?.customerName || '—'}</DialogTitle>
        <DialogContent>
          {repliesRow && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              From: {repliesRow.mobileNumber}
            </Typography>
          )}
          {repliesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : repliesMessages.length === 0 ? (
            <Alert severity="info">No incoming messages yet from this number.</Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 360, overflow: 'auto' }}>
              {repliesMessages.map((m) => (
                <Paper key={m._id} variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                  <Typography variant="caption" color="text.secondary">
                    {m.receivedAt ? new Date(m.receivedAt).toLocaleString() : '—'}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{m.text || '(media/other)'}</Typography>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseReplies}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RecoveryAssignments;
