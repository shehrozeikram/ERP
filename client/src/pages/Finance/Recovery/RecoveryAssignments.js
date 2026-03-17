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
import { Assignment as AssignmentIcon, Search as SearchIcon, Upload as UploadIcon, ChatBubbleOutline as ChatIcon, Close as CloseIcon, CheckCircleOutline as CheckIcon, Add as AddIcon, Edit as EditIcon, Info as InfoIcon, Download as DownloadIcon, AttachFile as AttachFileIcon, Send as SendIcon } from '@mui/icons-material';
import { usePagination } from '../../../hooks/usePagination';
import TablePaginationWrapper from '../../../components/TablePaginationWrapper';
import {
  fetchRecoveryAssignments,
  fetchRecoveryAssignmentStats,
  importRecoveryAssignmentsFromFile,
  fetchRecoveryImportFormat,
  downloadRecoverySampleExcel,
  createRecoveryAssignment,
  updateRecoveryAssignment,
  fetchWhatsAppIncomingMessages,
  fetchWhatsAppNumbersWithMessages,
  markRecoveryWhatsAppRead,
  sendRecoveryWhatsApp,
  uploadWhatsAppMedia
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
  { id: 'createdAt', label: 'Assign date', minWidth: 120, format: formatDate },
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
  const [unreadFilter, setUnreadFilter] = useState('all');
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyAttachment, setReplyAttachment] = useState(null);
  const replyFileInputRef = React.useRef(null);

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formEditingId, setFormEditingId] = useState(null);
  const [formSaving, setFormSaving] = useState(false);
  const [form, setForm] = useState({
    orderCode: '', customerName: '', bookingDate: '', sector: '', size: '', cnic: '', mobileNumber: '',
    customerAddress: '', length: '', plotNo: '', status: '', salePrice: '', received: '', currentlyDue: ''
  });
  const [formatDialogOpen, setFormatDialogOpen] = useState(false);
  const [formatData, setFormatData] = useState(null);
  const [formatLoading, setFormatLoading] = useState(false);
  const fileInputRef = React.useRef(null);

  const pagination = usePagination({
    defaultRowsPerPage: 50,
    resetDependencies: [searchDebounced, sectorFilter, statusFilter, unreadFilter]
  });

  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const apiParams = pagination.getApiParams();
      const params = {
        ...apiParams,
        ...(searchDebounced.trim() && { search: searchDebounced.trim(), page: 1, limit: 10000 }),
        ...(sectorFilter && { sector: sectorFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(unreadFilter === 'unread' && { unread: 'true' })
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
    setReplyAttachment(null);
    loadNumbersWithMessages();
  };

  const handleReplyFileSelect = (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const mime = (file.type || '').toLowerCase();
    const ok = mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('audio/') || mime.startsWith('video/');
    if (!ok) {
      setSnackbar({ open: true, message: 'Only images, PDF, audio, and video are allowed', severity: 'warning' });
      return;
    }
    const mediaType = mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : mime.startsWith('video/') ? 'video' : 'document';
    setReplyAttachment({ file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null, mediaType });
    e.target.value = '';
  };

  const handleRemoveReplyAttachment = () => {
    if (replyAttachment?.preview) URL.revokeObjectURL(replyAttachment.preview);
    setReplyAttachment(null);
  };

  const handleSendReply = async () => {
    const text = (replyText || '').trim();
    const toNumber = repliesRow?.mobileNumber ? normalizeWhatsAppNumber(repliesRow.mobileNumber) : '';
    if ((!text && !replyAttachment) || !toNumber) {
      setSnackbar({ open: true, message: 'Enter a message or add an attachment', severity: 'warning' });
      return;
    }
    try {
      setReplySending(true);
      let mediaUrl = null;
      let mediaType = null;
      if (replyAttachment?.file) {
        const uploadRes = await uploadWhatsAppMedia(replyAttachment.file);
        mediaUrl = uploadRes.data?.data?.url;
        mediaType = uploadRes.data?.data?.mediaType || replyAttachment.mediaType;
      }
      await sendRecoveryWhatsApp({
        to: toNumber,
        body: text || '',
        ...(mediaUrl && mediaType && { mediaUrl, mediaType })
      });
      setReplyText('');
      handleRemoveReplyAttachment();
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

  // Periodically refresh unread counters so new incoming messages update the badges
  useEffect(() => {
    const interval = setInterval(() => {
      loadNumbersWithMessages();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadNumbersWithMessages]);

  const handleSearchChange = (e) => setSearch(e.target.value);
  const handleSectorChange = (e) => setSectorFilter(e.target.value || '');
  const handleStatusChange = (e) => setStatusFilter(e.target.value || '');
  const handleUnreadFilterChange = (e) => setUnreadFilter(e.target.value || 'all');

  const handleOpenAdd = () => {
    setFormEditingId(null);
    setForm({
      orderCode: '', customerName: '', bookingDate: '', sector: '', size: '', cnic: '', mobileNumber: '',
      customerAddress: '', length: '', plotNo: '', status: '', salePrice: '', received: '', currentlyDue: ''
    });
    setFormDialogOpen(true);
  };

  const handleOpenEdit = (row) => {
    setFormEditingId(row._id);
    const d = (v) => (v != null && v !== undefined ? String(v) : '');
    setForm({
      orderCode: d(row.orderCode),
      customerName: d(row.customerName),
      bookingDate: row.bookingDate ? new Date(row.bookingDate).toISOString().slice(0, 10) : '',
      sector: d(row.sector),
      size: d(row.size),
      cnic: d(row.cnic),
      mobileNumber: d(row.mobileNumber),
      customerAddress: d(row.customerAddress),
      length: d(row.length),
      plotNo: d(row.plotNo),
      status: d(row.status),
      salePrice: row.salePrice != null ? String(row.salePrice) : '',
      received: row.received != null ? String(row.received) : '',
      currentlyDue: row.currentlyDue != null ? String(row.currentlyDue) : ''
    });
    setFormDialogOpen(true);
  };

  const handleCloseForm = () => {
    setFormDialogOpen(false);
    setFormEditingId(null);
  };

  const handleFormSave = async () => {
    if (!form.orderCode?.trim() && !form.customerName?.trim()) {
      setSnackbar({ open: true, message: 'Order Code or Customer Name is required', severity: 'warning' });
      return;
    }
    const payload = {
      orderCode: form.orderCode?.trim() || '',
      customerName: form.customerName?.trim() || '',
      bookingDate: form.bookingDate || null,
      sector: form.sector?.trim() || '',
      size: form.size?.trim() || '',
      cnic: form.cnic?.trim() || '',
      mobileNumber: form.mobileNumber?.trim() || '',
      customerAddress: form.customerAddress?.trim() || '',
      length: form.length?.trim() || '',
      plotNo: form.plotNo?.trim() || '',
      status: form.status?.trim() || '',
      salePrice: Number(form.salePrice) || 0,
      received: Number(form.received) || 0,
      currentlyDue: Number(form.currentlyDue) || 0
    };
    try {
      setFormSaving(true);
      if (formEditingId) {
        await updateRecoveryAssignment(formEditingId, payload);
        setSnackbar({ open: true, message: 'Record updated', severity: 'success' });
      } else {
        await createRecoveryAssignment(payload);
        setSnackbar({ open: true, message: 'Record added', severity: 'success' });
      }
      handleCloseForm();
      loadAssignments();
      loadStats();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to save', severity: 'error' });
    } finally {
      setFormSaving(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const ext = (file.name || '').toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      setSnackbar({ open: true, message: 'Only .xlsx or .xls files are allowed', severity: 'warning' });
      return;
    }
    handleImportFile(file);
    e.target.value = '';
  };

  const handleImportFile = async (file) => {
    try {
      setImporting(true);
      const res = await importRecoveryAssignmentsFromFile(file);
      const inserted = res.data?.data?.inserted ?? 0;
      setSnackbar({ open: true, message: res.data?.message || `Imported ${inserted} records`, severity: 'success' });
      loadAssignments();
      loadStats();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Import failed', severity: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const handleOpenFormat = async () => {
    setFormatDialogOpen(true);
    setFormatLoading(true);
    try {
      const res = await fetchRecoveryImportFormat();
      setFormatData(res.data?.data || null);
    } catch {
      setFormatData(null);
    } finally {
      setFormatLoading(false);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const res = await downloadRecoverySampleExcel();
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'recovery-assignments-sample.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      setSnackbar({ open: true, message: 'Sample file downloaded', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Download failed', severity: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssignmentIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" fontWeight={600}>
            Recovery Assignments
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
          Add record
        </Button>
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
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Unread messages</InputLabel>
              <Select
                value={unreadFilter}
                onChange={handleUnreadFilterChange}
                label="Unread messages"
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="unread">Unread only</MenuItem>
              </Select>
            </FormControl>
            <Chip label={`Total: ${stats.total.toLocaleString()}`} color="primary" variant="outlined" />
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={importing ? <CircularProgress size={18} /> : <UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? 'Importing…' : 'Import Excel file'}
            </Button>
            <Button variant="outlined" size="small" startIcon={<InfoIcon />} onClick={handleOpenFormat}>
              Import format & sample
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
                      <TableCell sx={{ minWidth: 80, fontWeight: 600, bgcolor: 'grey.50' }}>Completed</TableCell>
                      <TableCell sx={{ minWidth: 80, fontWeight: 600, bgcolor: 'grey.50' }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.map((row) => {
                      const isCompleted = row.taskStatus === 'completed';
                      return (
                        <TableRow
                          key={row._id}
                          hover
                          sx={
                            isCompleted
                              ? { bgcolor: 'rgba(76, 175, 80, 0.08)' }
                              : undefined
                          }
                        >
                          {COLUMNS.map((col) => (
                            <TableCell key={col.id} sx={{ minWidth: col.minWidth }} align={col.align}>
                              {col.id === 'assignedAction'
                                ? (row.assignedToMember ? (ASSIGNED_ACTION_LABELS[row.assignedToMember.action] || row.assignedToMember.action || '—') : '—')
                                : (col.format ? col.format(row[col.id]) : (row[col.id] ?? '—'))}
                            </TableCell>
                          ))}
                          <TableCell align="center">
                            {isCompleted && <CheckIcon fontSize="small" color="success" />}
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" onClick={() => handleOpenEdit(row)} title="Edit">
                              <EditIcon fontSize="small" />
                            </IconButton>
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
                      );
                    })}
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
            <Box sx={{ p: 1.5, bgcolor: '#F0F2F5', borderTop: '1px solid', borderColor: 'divider' }}>
              <input
                type="file"
                ref={replyFileInputRef}
                accept="image/*,application/pdf,audio/*,video/*"
                style={{ display: 'none' }}
                onChange={handleReplyFileSelect}
              />
              {replyAttachment && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, bgcolor: 'white', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  {replyAttachment.preview ? (
                    <Box component="img" src={replyAttachment.preview} alt="Preview" sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 1 }} />
                  ) : (
                    <AttachFileIcon sx={{ color: 'text.secondary', fontSize: 28 }} />
                  )}
                  <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>{replyAttachment.file?.name}</Typography>
                  <IconButton size="small" onClick={handleRemoveReplyAttachment} title="Remove attachment"><CloseIcon fontSize="small" /></IconButton>
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                <IconButton
                  onClick={() => replyFileInputRef.current?.click()}
                  sx={{ color: '#54656F', alignSelf: 'center', flexShrink: 0 }}
                  title="Attach file"
                >
                  <AttachFileIcon />
                </IconButton>
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
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'white',
                      borderRadius: 8,
                      fontSize: '0.95rem',
                      '& fieldset': { borderRadius: 8, borderColor: 'rgba(0,0,0,0.12)' },
                      '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.2)' },
                      '&.Mui-focused fieldset': { borderWidth: 1, borderColor: '#25D366' }
                    }
                  }}
                />
                <IconButton
                  onClick={handleSendReply}
                  disabled={replySending || (!replyText.trim() && !replyAttachment)}
                  sx={{
                    bgcolor: '#25D366',
                    color: 'white',
                    '&:hover': { bgcolor: '#1da851' },
                    '&.Mui-disabled': { bgcolor: 'grey.300', color: 'grey.500' },
                    alignSelf: 'flex-end',
                    flexShrink: 0
                  }}
                >
                  {replySending ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
                </IconButton>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={formDialogOpen} onClose={handleCloseForm} maxWidth="md" fullWidth>
        <DialogTitle>{formEditingId ? 'Edit record' : 'Add record'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField label="Order Code" value={form.orderCode} onChange={(e) => setForm((f) => ({ ...f, orderCode: e.target.value }))} size="small" fullWidth />
            <TextField label="Customer Name" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} size="small" fullWidth />
            <TextField label="Booking Date" type="date" value={form.bookingDate} onChange={(e) => setForm((f) => ({ ...f, bookingDate: e.target.value }))} size="small" fullWidth InputLabelProps={{ shrink: true }} />
            <TextField label="Sector" value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} size="small" fullWidth />
            <TextField label="Size" value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} size="small" fullWidth />
            <TextField label="CNIC" value={form.cnic} onChange={(e) => setForm((f) => ({ ...f, cnic: e.target.value }))} size="small" fullWidth />
            <TextField label="Mobile Number" value={form.mobileNumber} onChange={(e) => setForm((f) => ({ ...f, mobileNumber: e.target.value }))} size="small" fullWidth />
            <TextField label="Plot No." value={form.plotNo} onChange={(e) => setForm((f) => ({ ...f, plotNo: e.target.value }))} size="small" fullWidth />
            <TextField label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} size="small" fullWidth />
            <TextField label="Length" value={form.length} onChange={(e) => setForm((f) => ({ ...f, length: e.target.value }))} size="small" fullWidth />
            <TextField label="Sale Price" type="number" value={form.salePrice} onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))} size="small" fullWidth inputProps={{ min: 0 }} />
            <TextField label="Received" type="number" value={form.received} onChange={(e) => setForm((f) => ({ ...f, received: e.target.value }))} size="small" fullWidth inputProps={{ min: 0 }} />
            <TextField label="Currently Due" type="number" value={form.currentlyDue} onChange={(e) => setForm((f) => ({ ...f, currentlyDue: e.target.value }))} size="small" fullWidth inputProps={{ min: 0 }} />
            <TextField label="Customer Address" value={form.customerAddress} onChange={(e) => setForm((f) => ({ ...f, customerAddress: e.target.value }))} size="small" fullWidth sx={{ gridColumn: '1 / -1' }} />
          </Box>
        </DialogContent>
        <Box sx={{ px: 2, pb: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={handleCloseForm}>Cancel</Button>
          <Button variant="contained" onClick={handleFormSave} disabled={formSaving}>
            {formSaving ? <CircularProgress size={24} /> : (formEditingId ? 'Update' : 'Create')}
          </Button>
        </Box>
      </Dialog>

      <Dialog open={formatDialogOpen} onClose={() => setFormatDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Excel import format</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Use these exact column headers in your Excel file. At least <strong>Order Code</strong> or <strong>Customer Name</strong> is required per row.
          </Typography>
          {formatLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : formatData?.columns ? (
            <>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Excel header</strong></TableCell>
                      <TableCell><strong>Type</strong></TableCell>
                      <TableCell><strong>Sample value</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {formatData.columns.map((c) => (
                      <TableRow key={c.excelHeader}>
                        <TableCell>{c.excelHeader}</TableCell>
                        <TableCell>{c.type}</TableCell>
                        <TableCell>{String(c.sample)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {formatData.note && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>{formatData.note}</Typography>}
            </>
          ) : (
            <Typography color="text.secondary">Unable to load format details.</Typography>
          )}
        </DialogContent>
        <Box sx={{ px: 2, pb: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleDownloadSample}>
            Download sample Excel
          </Button>
        </Box>
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
