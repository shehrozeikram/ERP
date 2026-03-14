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
import { Assignment as AssignmentIcon, Search as SearchIcon, Upload as UploadIcon, ChatBubbleOutline as ChatIcon, Close as CloseIcon } from '@mui/icons-material';
import { usePagination } from '../../../hooks/usePagination';
import TablePaginationWrapper from '../../../components/TablePaginationWrapper';
import {
  fetchRecoveryAssignments,
  fetchRecoveryAssignmentStats,
  importRecoveryAssignmentsFromLatestFile,
  fetchWhatsAppIncomingMessages,
  fetchWhatsAppNumbersWithMessages,
  markRecoveryWhatsAppRead,
  sendRecoveryWhatsApp
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
  const [unreadCounts, setUnreadCounts] = useState({});
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

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
      const d = res?.data?.data || {};
      setNumbersWithMessages(Array.isArray(d.numbers) ? d.numbers : d.numbers || []);
      setUnreadCounts(typeof d.unreadCounts === 'object' ? d.unreadCounts : {});
    } catch {
      setNumbersWithMessages([]);
      setUnreadCounts({});
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
      const norm = normalizeWhatsAppNumber(row.mobileNumber);
      if (norm) {
        try {
          await markRecoveryWhatsAppRead(norm);
          setUnreadCounts((prev) => ({ ...prev, [norm]: 0 }));
        } catch {
          // ignore
        }
      }
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
    setReplyText('');
    loadNumbersWithMessages();
  };

  const handleSendReply = async () => {
    const text = (replyText || '').trim();
    const toNumber = repliesRow?.mobileNumber ? normalizeWhatsAppNumber(repliesRow.mobileNumber) : '';
    if (!text || !toNumber) {
      setSnackbar({ open: true, message: 'Enter a message to send', severity: 'warning' });
      return;
    }
    try {
      setReplySending(true);
      await sendRecoveryWhatsApp({ to: toNumber, body: text });
      setReplyText('');
      const res = await fetchWhatsAppIncomingMessages(repliesRow.mobileNumber);
      setRepliesMessages(res?.data?.data || []);
      setSnackbar({ open: true, message: 'Reply sent', severity: 'success' });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to send reply',
        severity: 'error'
      });
    } finally {
      setReplySending(false);
    }
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
                          <Badge
                            badgeContent={unreadCounts[normalizeWhatsAppNumber(row.mobileNumber)] || 0}
                            color="error"
                            invisible={!(unreadCounts[normalizeWhatsAppNumber(row.mobileNumber)] > 0)}
                          >
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

      <Dialog open={repliesDialogOpen} onClose={handleCloseReplies} maxWidth="sm" fullWidth PaperProps={{ sx: { minHeight: 480 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#075E54', color: 'white', py: 1.5, pr: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChatIcon />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>{repliesRow?.customerName || '—'}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>{repliesRow?.mobileNumber || '—'}</Typography>
            </Box>
          </Box>
          <IconButton onClick={handleCloseReplies} size="small" sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#E5DDD5', display: 'flex', flexDirection: 'column', minHeight: 340 }}>
          {repliesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress />
            </Box>
          ) : repliesMessages.length === 0 ? (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body2" color="text.secondary">No messages yet. Start the conversation below.</Typography>
            </Box>
          ) : (
            <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {repliesMessages.map((m, idx) => (
                <Box
                  key={m._id || m.messageId || idx}
                  sx={{
                    alignSelf: m.direction === 'out' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    borderTopRightRadius: m.direction === 'out' ? 0.5 : 2,
                    borderTopLeftRadius: m.direction === 'in' ? 0.5 : 2,
                    bgcolor: m.direction === 'out' ? '#DCF8C6' : 'white',
                    boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
                  }}
                >
                  <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{m.text || '(media)'}</Typography>
                  <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', opacity: 0.7, mt: 0.25 }}>
                    {m.time ? new Date(m.time).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          {repliesRow?.mobileNumber && (
            <Box sx={{ p: 2, bgcolor: '#F0F2F5', borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                placeholder="Type a message..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'white',
                    borderRadius: 3,
                    fontSize: '0.95rem',
                    '& fieldset': { borderRadius: 3 },
                    '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.3)' },
                    '&.Mui-focused fieldset': { borderWidth: 1 }
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={handleSendReply}
                disabled={replySending || !replyText.trim()}
                sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' }, minWidth: 56, height: 48, borderRadius: 2 }}
              >
                {replySending ? <CircularProgress size={24} color="inherit" /> : 'Send'}
              </Button>
            </Box>
          )}
        </DialogContent>
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
