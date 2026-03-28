import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
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
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  SvgIcon
} from '@mui/material';
import { TaskAlt as TaskAltIcon, Search as SearchIcon, ChatBubbleOutline as ChatIcon, Close as CloseIcon } from '@mui/icons-material';
import { usePagination } from '../../../hooks/usePagination';
import TablePaginationWrapper from '../../../components/TablePaginationWrapper';
import { fetchCompletedRecoveryTasks, fetchRecoveryAssignmentStats, fetchWhatsAppIncomingMessages } from '../../../services/recoveryAssignmentService';

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

const CompletedTasks = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sectors: [], statuses: [] });
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [repliesDialogOpen, setRepliesDialogOpen] = useState(false);
  const [repliesRow, setRepliesRow] = useState(null);
  const [repliesMessages, setRepliesMessages] = useState([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [scopedToMyCompletions, setScopedToMyCompletions] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const pagination = usePagination({
    defaultRowsPerPage: 50,
    resetDependencies: [searchDebounced, sectorFilter, statusFilter]
  });

  const loadCompleted = useCallback(async () => {
    try {
      setLoading(true);
      const apiParams = pagination.getApiParams();
      const params = {
        ...apiParams,
        ...(searchDebounced.trim() && { search: searchDebounced.trim() }),
        ...(sectorFilter && { sector: sectorFilter }),
        ...(statusFilter && { status: statusFilter })
      };
      const res = await fetchCompletedRecoveryTasks(params);
      const data = res.data?.data || [];
      const pag = res.data?.pagination || {};
      setRecords(Array.isArray(data) ? data : []);
      pagination.setTotal(pag.total || 0);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to load completed tasks',
        severity: 'error'
      });
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [searchDebounced, sectorFilter, statusFilter, pagination.page, pagination.rowsPerPage]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchRecoveryAssignmentStats({ completedTaskFilters: 1 });
      const d = res.data?.data || {};
      setStats({ sectors: d.sectors || [], statuses: d.statuses || [] });
      setScopedToMyCompletions(!!d.scopedToMyCompletions);
    } catch {
      setStats({ sectors: [], statuses: [] });
      setScopedToMyCompletions(false);
    }
  }, []);

  useEffect(() => {
    loadCompleted();
  }, [loadCompleted]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleOpenReplies = async (row) => {
    if (!row?.mobileNumber) {
      return;
    }
    setRepliesRow(row);
    setRepliesDialogOpen(true);
    setRepliesMessages([]);
    setRepliesLoading(true);
    try {
      const res = await fetchWhatsAppIncomingMessages(row.mobileNumber);
      setRepliesMessages(res?.data?.data || []);
    } catch {
      setRepliesMessages([]);
    } finally {
      setRepliesLoading(false);
    }
  };

  const handleCloseReplies = () => {
    setRepliesDialogOpen(false);
    setRepliesRow(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TaskAltIcon color="success" />
            <Typography variant="h6" fontWeight={600}>
              Completed Tasks
            </Typography>
          </Box>

          {scopedToMyCompletions && (
            <Alert severity="info" sx={{ mb: 2 }}>
              You are viewing only tasks that you marked as completed.
            </Alert>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search order, customer, CNIC, plot..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
              <Select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value || '')} label="Sector">
                <MenuItem value="">All</MenuItem>
                {stats.sectors.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value || '')} label="Status">
                <MenuItem value="">All</MenuItem>
                {stats.statuses.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="body2" color="text.secondary">
              {pagination.total} completed task{pagination.total !== 1 ? 's' : ''} found
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : records.length === 0 ? (
            <Alert severity="info">No completed tasks yet.</Alert>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 'calc(100vh - 320px)', minHeight: 500, overflowX: 'auto' }}>
                <Table size="small" stickyHeader sx={{ minWidth: 1320 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 90, fontWeight: 600, bgcolor: 'grey.50' }}>Order Code</TableCell>
                      <TableCell sx={{ minWidth: 140, fontWeight: 600, bgcolor: 'grey.50' }}>Customer Name</TableCell>
                      <TableCell sx={{ minWidth: 110, fontWeight: 600, bgcolor: 'grey.50' }}>Sector</TableCell>
                      <TableCell sx={{ minWidth: 110, fontWeight: 600, bgcolor: 'grey.50' }}>Mobile</TableCell>
                      <TableCell sx={{ minWidth: 90, fontWeight: 600, bgcolor: 'grey.50' }}>Status</TableCell>
                      <TableCell sx={{ minWidth: 120, fontWeight: 600, bgcolor: 'grey.50' }} align="right">Currently Due</TableCell>
                      <TableCell sx={{ minWidth: 120, fontWeight: 600, bgcolor: 'grey.50' }}>Assign Date</TableCell>
                      <TableCell sx={{ minWidth: 140, fontWeight: 600, bgcolor: 'grey.50' }}>Completed Date</TableCell>
                      <TableCell sx={{ minWidth: 140, fontWeight: 600, bgcolor: 'grey.50' }}>Assigned By</TableCell>
                      <TableCell sx={{ minWidth: 140, fontWeight: 600, bgcolor: 'grey.50' }}>Completed By</TableCell>
                      <TableCell sx={{ minWidth: 80, fontWeight: 600, bgcolor: 'grey.50' }} align="right">Replies</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.map((row) => (
                      <TableRow key={row._id} hover>
                        <TableCell>{row.orderCode ?? '—'}</TableCell>
                        <TableCell>{row.customerName ?? '—'}</TableCell>
                        <TableCell>{row.sector ?? '—'}</TableCell>
                        <TableCell>{row.mobileNumber ?? '—'}</TableCell>
                        <TableCell>{row.status ?? '—'}</TableCell>
                        <TableCell align="right">{formatCurrency(row.currentlyDue)}</TableCell>
                        <TableCell>{row.createdAt ? formatDate(row.createdAt) : '—'}</TableCell>
                        <TableCell>{row.taskCompletedAt ? formatDate(row.taskCompletedAt) : '—'}</TableCell>
                        <TableCell>{row.assignedToMember?.assignedBy?.name || '—'}</TableCell>
                        <TableCell>
                          {row.taskCompletedBy
                            ? `${row.taskCompletedBy.firstName || ''} ${row.taskCompletedBy.lastName || ''}`.trim() || row.taskCompletedBy.email || '—'
                            : '—'}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenReplies(row)}
                            title="View replies"
                            disabled={!row?.mobileNumber}
                          >
                            <ChatIcon />
                          </IconButton>
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
              <Typography variant="body2" color="text.secondary">No messages in this conversation.</Typography>
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
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default CompletedTasks;
