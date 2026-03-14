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
  Snackbar,
  Badge,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  SvgIcon
} from '@mui/material';
import { TaskAlt as TaskIcon, Search as SearchIcon, Edit as EditIcon, ChatBubbleOutline as ChatIcon } from '@mui/icons-material';
import { usePagination } from '../../../hooks/usePagination';
import TablePaginationWrapper from '../../../components/TablePaginationWrapper';
import {
  fetchMyRecoveryTasks,
  fetchRecoveryAssignmentStats,
  updateRecoveryAssignmentFeedback,
  sendRecoveryWhatsApp,
  fetchWhatsAppIncomingMessages,
  fetchWhatsAppNumbersWithMessages
} from '../../../services/recoveryAssignmentService';
import { fetchRecoveryCampaigns } from '../../../services/recoveryCampaignService';

function WhatsAppIcon(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </SvgIcon>
  );
}

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

const ASSIGNED_ACTION_LABELS = { whatsapp: 'WhatsApp message', call: 'Call', both: 'Both' };

function normalizeWhatsAppNumber(mobile) {
  if (!mobile) return '';
  let n = String(mobile).replace(/\D/g, '').trim();
  if (n.startsWith('0')) n = n.slice(1);
  if (n.length === 10 && n.startsWith('3')) n = '92' + n;
  else if (n.length === 10) n = '92' + n;
  return n || '';
}

function substituteMessage(template, customerName, mobileNumber) {
  if (!template) return '';
  return template
    .replace(/\{\{customerName\}\}/gi, customerName ?? '')
    .replace(/\{\{mobileNumber\}\}/gi, mobileNumber ?? '');
}

const MyTasks = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sectors: [], statuses: [] });
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [notRecoveryMember, setNotRecoveryMember] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const [campaigns, setCampaigns] = useState([]);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappRow, setWhatsappRow] = useState(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackRow, setFeedbackRow] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState({ whatsappFeedback: '', callFeedback: '' });
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [sendingViaApi, setSendingViaApi] = useState(false);
  const [repliesDialogOpen, setRepliesDialogOpen] = useState(false);
  const [repliesRow, setRepliesRow] = useState(null);
  const [repliesMessages, setRepliesMessages] = useState([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [numbersWithMessages, setNumbersWithMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const pagination = usePagination({
    defaultRowsPerPage: 50,
    resetDependencies: [searchDebounced, sectorFilter, statusFilter]
  });

  const loadMyTasks = useCallback(async () => {
    try {
      setLoading(true);
      setNotRecoveryMember(false);
      const params = {
        ...pagination.getApiParams(),
        ...(searchDebounced.trim() && { search: searchDebounced.trim() }),
        ...(sectorFilter && { sector: sectorFilter }),
        ...(statusFilter && { status: statusFilter })
      };
      const res = await fetchMyRecoveryTasks(params);
      const data = res.data?.data || [];
      const pag = res.data?.pagination || {};
      setRecords(Array.isArray(data) ? data : []);
      pagination.setTotal(pag.total || 0);
      if (res.data?.notRecoveryMember) setNotRecoveryMember(true);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to load your tasks',
        severity: 'error'
      });
      setRecords([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination object is new each render; use page/rowsPerPage only to avoid infinite loop
  }, [searchDebounced, sectorFilter, statusFilter, pagination.page, pagination.rowsPerPage]);

  const loadNumbersWithMessages = useCallback(async () => {
    try {
      const res = await fetchWhatsAppNumbersWithMessages();
      setNumbersWithMessages(res?.data?.data || []);
    } catch {
      setNumbersWithMessages([]);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchRecoveryAssignmentStats();
      const d = res.data?.data || {};
      setStats({ sectors: d.sectors || [], statuses: d.statuses || [] });
    } catch {
      setStats({ sectors: [], statuses: [] });
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetchRecoveryCampaigns({ activeOnly: 'true' });
      setCampaigns(res.data?.data || []);
    } catch {
      setCampaigns([]);
    }
  }, []);

  useEffect(() => {
    loadMyTasks();
  }, [loadMyTasks]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadNumbersWithMessages();
  }, [loadNumbersWithMessages]);

  const handleOpenWhatsApp = (row) => {
    setWhatsappRow(row);
    setSelectedCampaignId('');
    setWhatsappDialogOpen(true);
  };

  const handleCloseWhatsApp = () => {
    setWhatsappDialogOpen(false);
    setWhatsappRow(null);
  };

  const handleOpenInWhatsApp = () => {
    if (!whatsappRow) return;
    const num = normalizeWhatsAppNumber(whatsappRow.mobileNumber);
    if (!num) {
      setSnackbar({ open: true, message: 'No valid mobile number', severity: 'warning' });
      return;
    }
    const campaign = campaigns.find((c) => c._id === selectedCampaignId);
    const message = campaign
      ? substituteMessage(campaign.message, whatsappRow.customerName, whatsappRow.mobileNumber)
      : '';
    const url = `https://wa.me/${num}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
    window.open(url, '_blank');
    handleCloseWhatsApp();
    setSnackbar({ open: true, message: 'Opened WhatsApp', severity: 'success' });
  };

  const handleSendViaApi = async () => {
    if (sendingViaApi) return;
    setSendingViaApi(true);
    try {
      await sendRecoveryWhatsApp({
        to: '923214554035',
        template: 'taj_discount_on_installments'
      });
      setSnackbar({ open: true, message: 'Taj discount template sent.', severity: 'success' });
      handleCloseWhatsApp();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to send via WhatsApp API';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setSendingViaApi(false);
    }
  };

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
    setReplyText('');
    loadNumbersWithMessages();
  };

  const handleSendReply = async () => {
    const text = (replyText || '').trim();
    if (!text || !repliesRow?.mobileNumber) {
      setSnackbar({ open: true, message: 'Enter a message to send', severity: 'warning' });
      return;
    }
    try {
      setReplySending(true);
      await sendRecoveryWhatsApp({ to: repliesRow.mobileNumber, body: text });
      setSnackbar({ open: true, message: 'Reply sent', severity: 'success' });
      setReplyText('');
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

  const handleOpenFeedback = (row) => {
    setFeedbackRow(row);
    setFeedbackForm({
      whatsappFeedback: row.whatsappFeedback ?? '',
      callFeedback: row.callFeedback ?? ''
    });
    setFeedbackDialogOpen(true);
  };

  const handleCloseFeedback = () => {
    setFeedbackDialogOpen(false);
    setFeedbackRow(null);
  };

  const handleSaveFeedback = async () => {
    if (!feedbackRow) return;
    try {
      setFeedbackSaving(true);
      await updateRecoveryAssignmentFeedback(feedbackRow._id, {
        whatsappFeedback: feedbackForm.whatsappFeedback,
        callFeedback: feedbackForm.callFeedback
      });
      setSnackbar({ open: true, message: 'Feedback saved', severity: 'success' });
      handleCloseFeedback();
      loadMyTasks();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to save feedback',
        severity: 'error'
      });
    } finally {
      setFeedbackSaving(false);
    }
  };

  const action = (row) => row.assignedToMember?.action || '';
  const showWhatsApp = (row) => {
    const a = action(row);
    return a === 'whatsapp' || a === 'both';
  };
  const showCallFeedback = (row) => {
    const a = action(row);
    return a === 'call' || a === 'both';
  };

  useEffect(() => {
    if (whatsappDialogOpen) loadCampaigns();
  }, [whatsappDialogOpen, loadCampaigns]);

  const selectedCampaign = campaigns.find((c) => c._id === selectedCampaignId);
  const previewMessage = whatsappRow && selectedCampaign
    ? substituteMessage(selectedCampaign.message, whatsappRow.customerName, whatsappRow.mobileNumber)
    : '';

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <TaskIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" fontWeight={600}>
          My Tasks
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          {notRecoveryMember ? (
            <Alert severity="info">
              You are not set up as a recovery member. Ask an admin to add you under <strong>Recovery Members</strong> and assign you via <strong>Task Assignment</strong> to see your tasks here.
            </Alert>
          ) : (
            <>
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
                  {pagination.total} task{pagination.total !== 1 ? 's' : ''} assigned
                </Typography>
              </Box>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : records.length === 0 ? (
                <Alert severity="info">No recovery tasks assigned. Assignments are based on sector and balance rules in Task Assignment.</Alert>
              ) : (
                <>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 'calc(100vh - 320px)', minHeight: 500, overflowX: 'auto' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ minWidth: 90, fontWeight: 600, bgcolor: 'grey.50' }}>Order Code</TableCell>
                          <TableCell sx={{ minWidth: 140, fontWeight: 600, bgcolor: 'grey.50' }}>Customer Name</TableCell>
                          <TableCell sx={{ minWidth: 110, fontWeight: 600, bgcolor: 'grey.50' }}>Booking Date</TableCell>
                          <TableCell sx={{ minWidth: 100, fontWeight: 600, bgcolor: 'grey.50' }}>Sector</TableCell>
                          <TableCell sx={{ minWidth: 110, fontWeight: 600, bgcolor: 'grey.50' }}>Mobile</TableCell>
                          <TableCell sx={{ minWidth: 90, fontWeight: 600, bgcolor: 'grey.50' }}>Status</TableCell>
                          <TableCell sx={{ minWidth: 120, fontWeight: 600, bgcolor: 'grey.50' }} align="right">Currently Due</TableCell>
                          <TableCell sx={{ minWidth: 120, fontWeight: 600, bgcolor: 'grey.50' }}>Action</TableCell>
                          <TableCell sx={{ minWidth: 160, fontWeight: 600, bgcolor: 'grey.50' }}>WhatsApp feedback</TableCell>
                          <TableCell sx={{ minWidth: 160, fontWeight: 600, bgcolor: 'grey.50' }}>Call feedback</TableCell>
                          <TableCell sx={{ minWidth: 120, fontWeight: 600, bgcolor: 'grey.50' }} align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {records.map((row) => (
                          <TableRow key={row._id} hover>
                            <TableCell>{row.orderCode ?? '—'}</TableCell>
                            <TableCell>{row.customerName ?? '—'}</TableCell>
                            <TableCell>{formatDate(row.bookingDate)}</TableCell>
                            <TableCell>{row.sector ?? '—'}</TableCell>
                            <TableCell>{row.mobileNumber ?? '—'}</TableCell>
                            <TableCell>{row.status ?? '—'}</TableCell>
                            <TableCell align="right">{formatCurrency(row.currentlyDue)}</TableCell>
                            <TableCell>
                              {row.assignedToMember
                                ? (ASSIGNED_ACTION_LABELS[row.assignedToMember.action] || row.assignedToMember.action || '—')
                                : '—'}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 200 }}>
                              {showWhatsApp(row) ? (row.whatsappFeedback || '—') : '—'}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 200 }}>
                              {showCallFeedback(row) ? (row.callFeedback || '—') : '—'}
                            </TableCell>
                            <TableCell align="right">
                              {showWhatsApp(row) && (
                                <IconButton size="small" onClick={() => handleOpenWhatsApp(row)} title="Send WhatsApp">
                                  <WhatsAppIcon sx={{ color: '#25D366' }} />
                                </IconButton>
                              )}
                              <Badge color="success" variant="dot" invisible={!numbersWithMessages.includes(normalizeWhatsAppNumber(row.mobileNumber))}>
                                <IconButton size="small" onClick={() => handleOpenReplies(row)} title="View replies">
                                  <ChatIcon />
                                </IconButton>
                              </Badge>
                              <IconButton size="small" onClick={() => handleOpenFeedback(row)} title="Edit feedback">
                                <EditIcon />
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
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={whatsappDialogOpen} onClose={handleCloseWhatsApp} maxWidth="sm" fullWidth>
        <DialogTitle>Send WhatsApp message</DialogTitle>
        <DialogContent>
          {whatsappRow && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                To: {whatsappRow.customerName} — {whatsappRow.mobileNumber}
              </Typography>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Campaign (message template)</InputLabel>
                <Select
                  value={selectedCampaignId}
                  label="Campaign (message template)"
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                >
                  <MenuItem value="">Select campaign</MenuItem>
                  {campaigns.map((c) => (
                    <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {previewMessage && (
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Message preview"
                  value={previewMessage}
                  InputProps={{ readOnly: true }}
                  size="small"
                  sx={{ mb: 1 }}
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseWhatsApp}>Cancel</Button>
          <Button variant="contained" onClick={handleSendViaApi} disabled={sendingViaApi} sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' } }}>
            {sendingViaApi ? <CircularProgress size={24} color="inherit" /> : 'Send message'}
          </Button>
          <Button variant="outlined" onClick={handleOpenInWhatsApp} disabled={!normalizeWhatsAppNumber(whatsappRow?.mobileNumber)}>
            Open in WhatsApp
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={feedbackDialogOpen} onClose={handleCloseFeedback} maxWidth="sm" fullWidth>
        <DialogTitle>Feedback</DialogTitle>
        <DialogContent>
          {feedbackRow && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {feedbackRow.customerName} — {feedbackRow.orderCode}
              </Typography>
              {(showWhatsApp(feedbackRow)) && (
                <TextField
                  fullWidth
                  label="WhatsApp feedback"
                  value={feedbackForm.whatsappFeedback}
                  onChange={(e) => setFeedbackForm((f) => ({ ...f, whatsappFeedback: e.target.value }))}
                  multiline
                  rows={3}
                  size="small"
                  sx={{ mb: 2 }}
                  placeholder="Your feedback after sending WhatsApp..."
                />
              )}
              {(showCallFeedback(feedbackRow)) && (
                <TextField
                  fullWidth
                  label="Call feedback"
                  value={feedbackForm.callFeedback}
                  onChange={(e) => setFeedbackForm((f) => ({ ...f, callFeedback: e.target.value }))}
                  multiline
                  rows={3}
                  size="small"
                  placeholder="Your feedback after the call..."
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFeedback}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveFeedback} disabled={feedbackSaving}>
            {feedbackSaving ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

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
          {repliesRow?.mobileNumber && (
            <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                size="small"
                label="Reply"
                placeholder="Type your reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={handleSendReply}
                disabled={replySending || !replyText.trim()}
                sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' }, minWidth: 90 }}
              >
                {replySending ? <CircularProgress size={24} color="inherit" /> : 'Send'}
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseReplies}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MyTasks;
