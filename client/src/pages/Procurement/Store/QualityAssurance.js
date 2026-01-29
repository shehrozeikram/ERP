import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tabs,
  Tab,
  useTheme,
  alpha,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import {
  VerifiedUser as QAIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  CheckCircle as PassIcon,
  Cancel as RejectIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import api from '../../../services/api';
import dayjs from 'dayjs';
import PODocumentView from './PODocumentView';

const QA_TABS = { Pending: 'Pending', Approved: 'Approved', Rejected: 'Rejected' };
// API uses Passed for Approved
const tabToApiStatus = (tab) => (tab === 'Approved' ? 'Passed' : tab);

const QualityAssurance = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState(QA_TABS.Pending);
  const [list, setList] = useState([]);
  const [viewDialog, setViewDialog] = useState({ open: false, data: null });
  const [qaDialog, setQaDialog] = useState({ open: false, po: null, action: null, remarks: '' });
  const [qaSubmitting, setQaSubmitting] = useState(false);

  const loadList = useCallback(async (tab) => {
    const qaStatus = tabToApiStatus(tab);
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/procurement/store/qa-list', { params: { qaStatus } });
      if (response.data.success) {
        setList(response.data.data.purchaseOrders || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load QA list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList(activeTab);
  }, [activeTab, loadList]);

  const handleTabChange = (_, value) => setActiveTab(value);
  const isPending = activeTab === QA_TABS.Pending;

  const formatPKR = (amount) =>
    new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);

  const formatDate = (date) => (date ? dayjs(date).format('DD-MMM-YYYY') : 'N/A');

  const formatNumber = (num) =>
    new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num || 0);

  const getPriorityColor = (p) => ({ Low: 'info', Medium: 'default', High: 'warning', Urgent: 'error' }[p] || 'default');
  const getQaStatusColor = (s) => ({ Pending: 'warning', Passed: 'success', Rejected: 'error' }[s || 'Pending'] || 'default');
  const getQaStatusLabel = (s) => (s === 'Passed' ? 'Approved' : (s || 'Pending'));

  const handleView = async (po) => {
    try {
      const res = await api.get(`/procurement/purchase-orders/${po._id}`);
      if (res.data?.success) setViewDialog({ open: true, data: res.data.data });
      else setViewDialog({ open: true, data: po });
    } catch {
      setViewDialog({ open: true, data: po });
    }
  };

  const handleCloseView = () => setViewDialog({ open: false, data: null });

  const openQaDialog = (po, action) => {
    setQaDialog({ open: true, po, action, remarks: '' });
  };

  const handleQaSubmit = async () => {
    if (!qaDialog.po || !qaDialog.action) return;
    try {
      setQaSubmitting(true);
      setError('');
      await api.post(`/procurement/store/po/${qaDialog.po._id}/qa-check`, {
        status: qaDialog.action,
        remarks: qaDialog.remarks || undefined
      });
      setSuccess(`QA ${qaDialog.action === 'Passed' ? 'Approved' : 'Rejected'} successfully`);
      setQaDialog({ open: false, po: null, action: null, remarks: '' });
      setViewDialog({ open: false, data: null });
      await loadList(QA_TABS.Pending);
    } catch (err) {
      setError(err.response?.data?.message || 'QA check failed');
    } finally {
      setQaSubmitting(false);
    }
  };

  const showQaActions = (data) =>
    data && data.qaStatus !== 'Passed' && data.qaStatus !== 'Rejected';

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.15)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: 'warning.main', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <QAIcon fontSize="large" />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.warning.dark }}>
                Quality Assurance
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Pending, Approved, and Rejected – documents move to Approved when passed, Rejected when rejected
              </Typography>
            </Box>
          </Box>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => loadList(activeTab)} disabled={loading}>
            Refresh
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label={`Pending (${activeTab === QA_TABS.Pending ? list.length : '—'})`} value={QA_TABS.Pending} />
            <Tab label={`Approved (${activeTab === QA_TABS.Approved ? list.length : '—'})`} value={QA_TABS.Approved} />
            <Tab label={`Rejected (${activeTab === QA_TABS.Rejected ? list.length : '—'})`} value={QA_TABS.Rejected} />
          </Tabs>
        </Box>
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold" color="textSecondary">
            {activeTab === QA_TABS.Pending && `Purchase orders pending QA (${list.length})`}
            {activeTab === QA_TABS.Approved && `Purchase orders approved (${list.length})`}
            {activeTab === QA_TABS.Rejected && `Purchase orders rejected (${list.length})`}
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                <TableCell><strong>Order Number</strong></TableCell>
                <TableCell><strong>Vendor</strong></TableCell>
                <TableCell><strong>Order Date</strong></TableCell>
                <TableCell><strong>Expected Delivery</strong></TableCell>
                <TableCell><strong>Priority</strong></TableCell>
                <TableCell align="right"><strong>Total Amount</strong></TableCell>
                {activeTab === QA_TABS.Approved && <TableCell><strong>Approved By</strong></TableCell>}
                {activeTab === QA_TABS.Rejected && <TableCell><strong>Rejected By</strong></TableCell>}
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={isPending ? 7 : 8} align="center"><CircularProgress /></TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isPending ? 7 : 8} align="center">
                    <Typography variant="body2" color="textSecondary">
                      {activeTab === QA_TABS.Pending && 'No POs pending QA'}
                      {activeTab === QA_TABS.Approved && 'No POs approved yet'}
                      {activeTab === QA_TABS.Rejected && 'No POs rejected'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                list.map((po) => (
                  <TableRow key={po._id} hover>
                    <TableCell>{po.orderNumber || 'N/A'}</TableCell>
                    <TableCell>{po.vendor?.name || 'Unknown Vendor'}</TableCell>
                    <TableCell>{formatDate(po.orderDate)}</TableCell>
                    <TableCell>{formatDate(po.expectedDeliveryDate)}</TableCell>
                    <TableCell>
                      <Chip label={po.priority || 'Medium'} color={getPriorityColor(po.priority || 'Medium')} size="small" />
                    </TableCell>
                    <TableCell align="right">{formatPKR(po.totalAmount)}</TableCell>
                    {activeTab === QA_TABS.Approved && (
                      <TableCell>
                        {po.qaCheckedBy ? `${po.qaCheckedBy.firstName || ''} ${po.qaCheckedBy.lastName || ''}`.trim() || formatDate(po.qaCheckedAt) : formatDate(po.qaCheckedAt) || '—'}
                      </TableCell>
                    )}
                    {activeTab === QA_TABS.Rejected && (
                      <TableCell>
                        {po.qaCheckedBy ? `${po.qaCheckedBy.firstName || ''} ${po.qaCheckedBy.lastName || ''}`.trim() || formatDate(po.qaCheckedAt) : formatDate(po.qaCheckedAt) || '—'}
                      </TableCell>
                    )}
                    <TableCell align="center">
                      <Tooltip title="View">
                        <IconButton size="small" onClick={() => handleView(po)}><ViewIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      {isPending && (
                        <>
                          <Tooltip title="Pass QA (Approved)">
                            <IconButton size="small" color="success" onClick={() => openQaDialog(po, 'Passed')}><PassIcon fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Reject QA">
                            <IconButton size="small" color="error" onClick={() => openQaDialog(po, 'Rejected')}><RejectIcon fontSize="small" /></IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* View PO dialog – same full layout as Store Dashboard + Print */}
      <Dialog
        open={viewDialog.open}
        onClose={handleCloseView}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: '90%',
            maxWidth: '210mm',
            maxHeight: '95vh',
            m: 2,
            '@media print': {
              boxShadow: 'none',
              maxWidth: '100%',
              margin: 0,
              height: '100%',
              width: '100%',
              maxHeight: '100%'
            }
          }
        }}
      >
        <DialogTitle sx={{ '@media print': { display: 'none' }, pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6">Purchase Order Details</Typography>
              {viewDialog.data && (
                <Chip label={`QA: ${getQaStatusLabel(viewDialog.data.qaStatus)}`} color={getQaStatusColor(viewDialog.data.qaStatus)} size="small" />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>
                Print
              </Button>
              {viewDialog.data && showQaActions(viewDialog.data) && (
                <>
                  <Button size="small" color="success" variant="outlined" startIcon={<PassIcon />} onClick={() => openQaDialog(viewDialog.data, 'Passed')}>
                    Pass QA (Approved)
                  </Button>
                  <Button size="small" color="error" variant="outlined" startIcon={<RejectIcon />} onClick={() => openQaDialog(viewDialog.data, 'Rejected')}>
                    Reject QA
                  </Button>
                </>
              )}
              <IconButton onClick={handleCloseView} size="small"><CloseIcon /></IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'auto', '@media print': { p: 0, overflow: 'visible' } }}>
          {viewDialog.data && (
            <Box sx={{ width: '100%' }} className="print-content">
              <PODocumentView data={viewDialog.data} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ '@media print': { display: 'none' } }}>
          <Button onClick={handleCloseView}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Print styles for PO view dialog */}
      <Box
        component="style"
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4; margin: 15mm; }
              body * { visibility: hidden; }
              .MuiDialog-container, .MuiDialog-container *, .MuiDialog-paper, .MuiDialog-paper *, .print-content, .print-content * { visibility: visible; }
              .MuiDialog-container { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; display: block !important; padding: 0 !important; margin: 0 !important; overflow: visible !important; }
              .MuiDialog-paper { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; width: 100% !important; height: auto !important; max-height: none !important; position: relative !important; transform: none !important; overflow: visible !important; }
              .MuiDialogContent-root { overflow: visible !important; padding: 0 !important; height: auto !important; max-height: none !important; margin: 0 !important; }
              .MuiDialogTitle-root, .MuiDialogActions-root, .MuiBackdrop-root { display: none !important; }
              .MuiPaper-root { box-shadow: none !important; }
            }
          `
        }}
      />

      {/* QA confirmation dialog */}
      <Dialog open={qaDialog.open} onClose={() => setQaDialog({ open: false, po: null, action: null, remarks: '' })} maxWidth="xs" fullWidth>
        <DialogTitle>Quality Assurance – {qaDialog.action === 'Passed' ? 'Pass' : 'Reject'}</DialogTitle>
        <DialogContent>
          {qaDialog.po && <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>PO {qaDialog.po.orderNumber}</Typography>}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Remarks (optional)"
            value={qaDialog.remarks}
            onChange={(e) => setQaDialog((p) => ({ ...p, remarks: e.target.value }))}
            placeholder={qaDialog.action === 'Rejected' ? 'Reason for rejection...' : 'Optional notes...'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQaDialog({ open: false, po: null, action: null, remarks: '' })}>Cancel</Button>
          <Button variant="contained" color={qaDialog.action === 'Passed' ? 'success' : 'error'} onClick={handleQaSubmit} disabled={qaSubmitting}>
            {qaSubmitting ? 'Submitting...' : (qaDialog.action === 'Passed' ? 'Pass QA' : 'Reject QA')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QualityAssurance;
