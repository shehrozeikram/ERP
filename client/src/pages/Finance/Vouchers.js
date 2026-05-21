import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  MenuItem,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Visibility as ViewIcon,
  ReceiptLong as VoucherIcon,
  AttachFile as AttachIcon,
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  GetApp as DownloadIcon,
  InsertDriveFile as FileIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import { formatPKR } from '../../utils/currency';

/** YYYY-MM-DD in local calendar from a Date or ISO string */
function clearedAtToYmd(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** User-facing voucher status (journal status + signed / clearance workflow). */
function getVoucherStatusDisplay(row) {
  const journalStatus = String(row?.status || '').toLowerCase();
  const signed =
    row?.signedDocumentStatus === 'signed' && Boolean(row?.signedDocumentAt);
  const cleared = row?.clearanceStatus === 'cleared';

  if (journalStatus === 'reversed') return { label: 'Reversed', color: 'default' };
  if (journalStatus === 'cancelled') return { label: 'Cancelled', color: 'default' };
  if (cleared) return { label: 'Cleared', color: 'success' };
  if (journalStatus === 'posted') return { label: 'Posted', color: 'success' };
  if (journalStatus === 'draft' && signed) return { label: 'Signed', color: 'info' };
  if (journalStatus === 'draft') return { label: 'Draft', color: 'warning' };
  const fallback = journalStatus
    ? journalStatus.charAt(0).toUpperCase() + journalStatus.slice(1)
    : '—';
  return { label: fallback, color: 'default' };
}

const CA_VOUCHER_WORKFLOW_LOCK_MSG =
  'Available after all finance authorities approve the linked cash approval.';

/** Cash-approval BPV/CPV: lock attachment / signed / clearance until every authority has approved. */
const isCaVoucherWorkflowLocked = (row) => row?.cashApprovalAuthoritiesComplete === false;

/** Parse YYYY-MM-DD as local noon (stable for API ISO). */
function parseYmdLocalNoon(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((ymd || '').trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const dt = new Date(y, mo, d, 12, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

/** Journal referenceType values → Voucher Type filter labels (Finance → Vouchers) */
const VOUCHER_TYPE_FILTER_OPTIONS = [
  { value: 'payment', label: 'PAYMENT' },
  { value: 'receipt', label: 'RECEIPT' },
  { value: 'bill', label: 'BILL' },
  { value: 'invoice', label: 'INVOICE' },
  { value: 'grn', label: 'GRN' },
  { value: 'sin', label: 'SIN' },
  { value: 'manual', label: 'MANUAL' },
  { value: 'adjustment', label: 'ADJUSTMENT' },
  { value: 'payroll', label: 'PAYROLL' },
  { value: 'purchase_order', label: 'PURCHASE ORDER' },
  { value: 'depreciation', label: 'DEPRECIATION' },
  { value: 'expense', label: 'EXPENSE' },
  { value: 'stock_adjustment', label: 'STOCK ADJUSTMENT' },
  { value: 'purchase_return', label: 'PURCHASE RETURN' }
];

const Vouchers = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  /** Default: PAYMENT vouchers (referenceType payment on journal) */
  const [voucherType, setVoucherType] = useState('payment');
  const [clearanceDialog, setClearanceDialog] = useState({
    open: false,
    voucher: null,
    status: 'pending',
    clearedAtDate: ''
  });
  const [attachDlg, setAttachDlg] = useState({ open: false, entry: null, uploading: false });
  const [attachError, setAttachError] = useState('');

  const openAttachDlg = (entry) => {
    if (isCaVoucherWorkflowLocked(entry)) return;
    setAttachDlg({ open: true, entry, uploading: false });
    setAttachError('');
  };
  const closeAttachDlg = () => setAttachDlg({ open: false, entry: null, uploading: false });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || isCaVoucherWorkflowLocked(attachDlg.entry)) return;
    setAttachDlg((d) => ({ ...d, uploading: true }));
    setAttachError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/finance/journal-entries/${attachDlg.entry._id}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const updated = {
        ...attachDlg.entry,
        attachments: [...(attachDlg.entry.attachments || []), res.data.data]
      };
      setAttachDlg((d) => ({ ...d, entry: updated, uploading: false }));
      setEntries((prev) => prev.map((en) => (en._id === updated._id ? { ...en, attachments: updated.attachments } : en)));
    } catch (err) {
      setAttachError(err.response?.data?.message || 'Upload failed');
      setAttachDlg((d) => ({ ...d, uploading: false }));
    }
    e.target.value = '';
  };

  const handleDeleteAttachment = async (filename) => {
    if (isCaVoucherWorkflowLocked(attachDlg.entry)) return;
    if (!window.confirm('Delete this attachment?')) return;
    try {
      const res = await api.delete(
        `/finance/journal-entries/${attachDlg.entry._id}/attachments/${encodeURIComponent(filename)}`
      );
      const serverRow = res?.data?.data;
      const nextAttachments = (attachDlg.entry.attachments || []).filter((a) => a.filename !== filename);
      const merged = serverRow && serverRow._id
        ? { ...attachDlg.entry, ...serverRow, attachments: serverRow.attachments || nextAttachments }
        : {
            ...attachDlg.entry,
            attachments: nextAttachments,
            signedDocumentStatus: nextAttachments.length ? attachDlg.entry.signedDocumentStatus : 'not_signed',
            signedDocumentAt: nextAttachments.length ? attachDlg.entry.signedDocumentAt : null
          };
      setAttachDlg((d) => ({ ...d, entry: merged }));
      setEntries((prev) => prev.map((en) => (en._id === merged._id ? { ...en, ...merged } : en)));
    } catch (err) {
      setAttachError(err.response?.data?.message || 'Delete failed');
    }
  };

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('limit', '200');
      if (status && status !== 'signed') params.append('status', status);
      if (search.trim()) params.append('search', search.trim());
      if (voucherType) params.append('referenceType', voucherType);
      const res = await api.get(`/finance/journal-entries?${params.toString()}`);
      setEntries(res?.data?.data?.entries || []);
    } catch (_e) {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [status, voucherType]); // eslint-disable-line react-hooks/exhaustive-deps

  const voucherRows = useMemo(() => {
    let rows = entries.map((entry) => ({
      ...entry,
      voucherType: String(entry?.referenceType || 'manual').toUpperCase()
    }));
    if (status === 'signed') {
      rows = rows.filter(
        (row) => row.signedDocumentStatus === 'signed' && Boolean(row.signedDocumentAt)
      );
    }
    return rows;
  }, [entries, status]);

  const closeClearanceDialog = () =>
    setClearanceDialog({ open: false, voucher: null, status: 'pending', clearedAtDate: '' });

  const openClearanceDialog = (voucher) => {
    if (isCaVoucherWorkflowLocked(voucher)) return;
    const can =
      (voucher?.attachments || []).length > 0 &&
      voucher?.signedDocumentStatus === 'signed' &&
      Boolean(voucher?.signedDocumentAt);
    if (!can) return;
    setClearanceDialog({
      open: true,
      voucher,
      status: voucher?.clearanceStatus || 'pending',
      clearedAtDate:
        voucher?.clearanceStatus === 'cleared' && voucher?.clearedAt
          ? clearedAtToYmd(voucher.clearedAt)
          : ''
    });
  };

  const saveClearance = async () => {
    if (!clearanceDialog.voucher?._id) return;
    const nextStatus = clearanceDialog.status || 'pending';
    let clearedAtPayload = null;
    if (nextStatus === 'cleared') {
      const ymd = (clearanceDialog.clearedAtDate || '').trim();
      if (!ymd) {
        window.alert('Please select a clearance date using the calendar.');
        return;
      }
      const parsed = parseYmdLocalNoon(ymd);
      if (!parsed) {
        window.alert('Clearance date is invalid.');
        return;
      }
      clearedAtPayload = parsed.toISOString();
    }
    try {
      const res = await api.put(`/finance/journal-entries/${clearanceDialog.voucher._id}/clearance`, {
        clearanceStatus: nextStatus,
        clearanceRemarks: '',
        clearedAt: clearedAtPayload
      });
      const updated = res?.data?.data;
      setEntries((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
      closeClearanceDialog();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not update clearance');
    }
  };

  const saveSignedDocumentStatus = async (voucherId, nextStatus) => {
    if (!voucherId) return;
    const row = entries.find((e) => e._id === voucherId);
    if (isCaVoucherWorkflowLocked(row)) return;
    if (!(row?.attachments || []).length) return;
    try {
      const res = await api.put(`/finance/journal-entries/${voucherId}/signed-document`, {
        signedDocumentStatus: nextStatus
      });
      const updated = res?.data?.data;
      if (!updated?._id) return;
      setEntries((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
      if (attachDlg.entry?._id === voucherId) {
        setAttachDlg((d) => (d.entry ? { ...d, entry: { ...d.entry, ...updated } } : d));
      }
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not update signed document status');
    }
  };

  const baseUploadsUrl = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <VoucherIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>Vouchers</Typography>
        </Box>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              label="Search Voucher"
              placeholder="Entry number / reference / description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              size="small"
              label="Voucher type"
              value={voucherType}
              onChange={(e) => setVoucherType(e.target.value)}
            >
              <MenuItem value="">
                <em>All types</em>
              </MenuItem>
              {VOUCHER_TYPE_FILTER_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              size="small"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="posted">Posted</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="signed">Signed (document)</MenuItem>
              <MenuItem value="reversed">Reversed</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={fetchEntries}>Apply</Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Voucher No</TableCell>
                <TableCell>Voucher Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell align="center">Attachment</TableCell>
                <TableCell>Signed Document</TableCell>
                <TableCell>Signed Date</TableCell>
                <TableCell>Clearance</TableCell>
                <TableCell>Clearance Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={13} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : voucherRows.length === 0 ? (
                <TableRow><TableCell colSpan={13} align="center">No vouchers found</TableCell></TableRow>
              ) : voucherRows.map((row) => {
                const workflowLocked = isCaVoucherWorkflowLocked(row);
                const hasAttachment = (row.attachments || []).length > 0;
                const canUseClearance =
                  !workflowLocked &&
                  hasAttachment &&
                  row.signedDocumentStatus === 'signed' &&
                  Boolean(row.signedDocumentAt);
                return (
                <TableRow key={row._id} hover>
                  <TableCell>{formatDate(row.date)}</TableCell>
                  <TableCell>{row.entryNumber}</TableCell>
                  <TableCell>{row.voucherType}</TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell align="right">{formatPKR(row.totalDebits || 0)}</TableCell>
                  <TableCell>{row.reference || '—'}</TableCell>
                  <TableCell align="center">
                    <Tooltip
                      title={
                        workflowLocked
                          ? CA_VOUCHER_WORKFLOW_LOCK_MSG
                          : `Attachments (${(row.attachments || []).length}) — click to add or view`
                      }
                    >
                      <span>
                      <IconButton
                        size="small"
                        color={(row.attachments || []).length > 0 ? 'primary' : 'default'}
                        onClick={() => openAttachDlg(row)}
                        disabled={workflowLocked}
                      >
                        <AttachIcon fontSize="small" />
                        {(row.attachments || []).length > 0 && (
                          <Typography component="span" variant="caption" sx={{ fontSize: 10, fontWeight: 700, ml: 0.25 }}>
                            {row.attachments.length}
                          </Typography>
                        )}
                      </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip
                      title={
                        workflowLocked
                          ? CA_VOUCHER_WORKFLOW_LOCK_MSG
                          : hasAttachment
                          ? 'Signed document status'
                          : 'Add an attachment first to set signed document status'
                      }
                    >
                      <span>
                        <TextField
                          select
                          size="small"
                          disabled={workflowLocked || !hasAttachment}
                          value={row.signedDocumentStatus === 'signed' ? 'signed' : 'not_signed'}
                          onChange={(e) => saveSignedDocumentStatus(row._id, e.target.value)}
                          sx={{ minWidth: 130 }}
                        >
                          <MenuItem value="signed">Signed</MenuItem>
                          <MenuItem value="not_signed">Not Signed</MenuItem>
                        </TextField>
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {!workflowLocked && hasAttachment && row.signedDocumentAt
                      ? formatDate(row.signedDocumentAt)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Tooltip
                      title={
                        workflowLocked
                          ? CA_VOUCHER_WORKFLOW_LOCK_MSG
                          : canUseClearance
                          ? 'Update clearance status'
                          : 'Complete attachment and signed document (with signed date) before clearance'
                      }
                    >
                      <Box component="span" sx={{ display: 'inline-flex' }}>
                        <Chip
                          size="small"
                          label={row.clearanceStatus === 'cleared' ? 'Cleared' : 'Pending'}
                          color={row.clearanceStatus === 'cleared' ? 'success' : 'warning'}
                          variant={row.clearanceStatus === 'cleared' ? 'filled' : 'outlined'}
                          onClick={canUseClearance ? () => openClearanceDialog(row) : undefined}
                          sx={{
                            opacity: canUseClearance ? 1 : 0.55,
                            cursor: canUseClearance ? 'pointer' : 'default'
                          }}
                        />
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {canUseClearance && row.clearedAt ? formatDate(row.clearedAt) : '—'}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const display = getVoucherStatusDisplay(row);
                      return (
                        <Chip
                          size="small"
                          label={display.label}
                          color={display.color}
                          variant={display.color === 'default' ? 'outlined' : 'filled'}
                        />
                      );
                    })()}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View Voucher">
                      <IconButton size="small" onClick={() => navigate(`/finance/vouchers/${row._id}`)}>
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
      </Paper>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={handleFileUpload}
        accept="image/png,image/jpeg,image/jpg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"
      />

      <Dialog open={attachDlg.open} onClose={closeAttachDlg} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <AttachIcon color="primary" />
            <Typography fontWeight={700}>Attachments — {attachDlg.entry?.entryNumber}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {attachError && (
            <Alert severity="error" onClose={() => setAttachError('')} sx={{ mb: 1 }}>
              {attachError}
            </Alert>
          )}
          {(attachDlg.entry?.attachments || []).length === 0 && (
            <Box textAlign="center" py={3} color="text.disabled">
              <AttachIcon sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
              <Typography variant="body2">
                No attachments yet. Upload a voucher image, bank slip, or supporting document.
              </Typography>
            </Box>
          )}
          <List dense>
            {(attachDlg.entry?.attachments || []).map((a, i) => (
              <ListItem key={i} divider sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                <FileIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                <ListItemText
                  primary={<Typography variant="body2" fontWeight={600}>{a.originalName || a.filename}</Typography>}
                  secondary={a.uploadedAt ? new Date(a.uploadedAt).toLocaleDateString('en-PK') : ''}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Open / download">
                    <IconButton
                      size="small"
                      component="a"
                      href={`${baseUploadsUrl}/uploads/finance/${encodeURIComponent(a.filename)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={a.originalName}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDeleteAttachment(a.filename)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 2 }}>
          <Button
            variant="outlined"
            startIcon={attachDlg.uploading ? <CircularProgress size={16} /> : <UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={attachDlg.uploading || isCaVoucherWorkflowLocked(attachDlg.entry)}
          >
            {attachDlg.uploading ? 'Uploading…' : 'Upload image / file'}
          </Button>
          <Button onClick={closeAttachDlg}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={clearanceDialog.open}
        onClose={closeClearanceDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Clearance — {clearanceDialog.voucher?.entryNumber}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                size="small"
                label="Clearance Status"
                value={clearanceDialog.status}
                onChange={(e) => {
                  const v = e.target.value;
                  setClearanceDialog((d) => ({
                    ...d,
                    status: v,
                    clearedAtDate:
                      v === 'pending'
                        ? ''
                        : d.voucher?.clearanceStatus === 'cleared' && d.voucher?.clearedAt
                          ? clearedAtToYmd(d.voucher.clearedAt)
                          : d.clearedAtDate || ''
                  }));
                }}
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="cleared">Cleared</MenuItem>
              </TextField>
            </Grid>
            {clearanceDialog.status === 'cleared' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Clearance date"
                  value={clearanceDialog.clearedAtDate}
                  onChange={(e) =>
                    setClearanceDialog((d) => ({ ...d, clearedAtDate: e.target.value }))
                  }
                  InputLabelProps={{ shrink: true }}
                  helperText="Choose the actual clearance date (not auto-filled)."
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeClearanceDialog}>Cancel</Button>
          <Button variant="contained" onClick={saveClearance}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Vouchers;
