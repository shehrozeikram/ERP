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
  TablePagination,
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
  InsertDriveFile as FileIcon,
  Description as DescriptionIcon,
  Print as PrintIcon,
  Close as CloseIcon,
  Add as AddIcon
} from '@mui/icons-material';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import { formatPKR } from '../../utils/currency';
import { useFinanceCompany } from '../../context/FinanceCompanyContext';
import FinanceCompanySelector from '../../components/Finance/FinanceCompanySelector';
import ComparativeStatementView from '../../components/Procurement/ComparativeStatementView';
import QuotationDetailView from '../../components/Procurement/QuotationDetailView';
import { DigitalSignatureImage } from '../../components/common/DigitalSignatureImage';
import { numberToWords } from '../../utils/numberToWords';

const formatDateForPrint = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

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
  { value: 'purchase_order', label: 'PURCHASE ORDER' },
  { value: 'depreciation', label: 'DEPRECIATION' },
  { value: 'expense', label: 'EXPENSE' },
  { value: 'stock_adjustment', label: 'STOCK ADJUSTMENT' },
  { value: 'purchase_return', label: 'PURCHASE RETURN' }
];

const SIGNATORY_OPTIONS = [
  { value: 'Sardar Tanveer Ilyas', label: 'Sardar Tanveer Ilyas' },
  { value: 'Sardar Umer Tanveer', label: 'Sardar Umer Tanveer' },
  { value: 'Hamza Tanveer', label: 'Hamza Tanveer' }
];

const Vouchers = () => {
  const navigate = useNavigate();
  const { selectedCompanyId } = useFinanceCompany();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  /** Default: PAYMENT vouchers (referenceType payment on journal) */
  const [voucherType, setVoucherType] = useState('payment');
  const [clearanceDialog, setClearanceDialog] = useState({
    open: false,
    voucher: null,
    status: 'pending',
    clearedAtDate: ''
  });
  const [viewDialog, setViewDialog] = useState({
    open: false,
    po: null,
    poQuotations: [],
    poGrns: [],
    poLinkedDocs: [],
    poAuditTab: 0,
    loading: false
  });
  const [attachDlg, setAttachDlg] = useState({ open: false, entry: null, uploading: false });
  const [attachError, setAttachError] = useState('');
  
  const [newVoucherDialog, setNewVoucherDialog] = useState(false);
  const [selectedNewVoucherType, setSelectedNewVoucherType] = useState('');

  const handleCreateVoucher = () => {
    if (!selectedNewVoucherType) return;
    
    switch (selectedNewVoucherType) {
      case 'purchase_bill':
        navigate('/finance/accounts-payable/new');
        break;
      case 'payment_voucher':
        navigate('/finance/vendor-payments');
        break;
      case 'receipt_voucher':
        navigate('/finance/customer-payments');
        break;
      case 'journal_voucher':
        navigate('/finance/journal-entries/new');
        break;
      case 'vendor_advance':
        navigate('/finance/vendor-advance');
        break;
      default:
        break;
    }
  };

  const handleOpenVoucherDocs = async (voucherRow) => {
    setViewDialog({
      open: true,
      po: null,
      poQuotations: [],
      poGrns: [],
      poLinkedDocs: [],
      poAuditTab: 0,
      loading: true
    });

    try {
      let poId = null;
      if (voucherRow.purchaseOrder || voucherRow.purchaseOrderId) {
        poId = voucherRow.purchaseOrder?._id || voucherRow.purchaseOrder || voucherRow.purchaseOrderId;
      } else if (voucherRow.referenceModel === 'PurchaseOrder' && voucherRow.referenceId) {
        poId = voucherRow.referenceId;
      }

      if (!poId && voucherRow._id) {
        try {
          const vaRes = await api.get(`/finance/vendor-advances/by-journal-entry/${voucherRow._id}`);
          const vaData = vaRes.data?.data;
          if (vaData && vaData.referenceType === 'purchase_order' && vaData.referenceId) {
            poId = vaData.referenceId;
          }
        } catch (_) {}
      }

      if (!poId && voucherRow._id) {
        try {
          const apRes = await api.get(`/finance/ap-payment-applications/by-journal-entry/${voucherRow._id}`);
          const apData = apRes.data?.data;
          if (apData && apData.referenceType === 'purchase_order' && apData.referenceId) {
            poId = apData.referenceId;
          }
        } catch (_) {}
      }

      if (!poId) {
        const fallbackDocs = (voucherRow.attachments || []).map((att, idx) => ({
          id: att._id || `att-${idx}`,
          source: 'Voucher Attachment',
          name: att.originalName || att.filename || `Attachment ${idx + 1}`,
          url: att.filename ? `${(api.defaults.baseURL || '').replace(/\/api\/?$/, '')}/uploads/finance/${encodeURIComponent(att.filename)}` : '',
          uploadedAt: att.uploadedAt || null
        }));
        setViewDialog({
          open: true,
          po: null,
          poQuotations: [],
          poGrns: [],
          poLinkedDocs: fallbackDocs,
          poAuditTab: 5,
          loading: false
        });
        return;
      }

      const r = await api.get(`/procurement/purchase-orders/${poId}`);
      const d = r.data?.data || null;

      const [qRes, grnRes] = await Promise.all([
        d?.indent?._id
          ? api.get(`/procurement/quotations/by-indent/${d.indent._id}`).catch(() => ({ data: { data: [] } }))
          : Promise.resolve({ data: { data: [] } }),
        d?._id
          ? api.get('/procurement/goods-receive', { params: { purchaseOrder: d._id, limit: 100 } }).catch(() => ({ data: { data: { receives: [] } } }))
          : Promise.resolve({ data: { data: { receives: [] } } })
      ]);

      const poQuotations = Array.isArray(qRes?.data?.data) ? qRes.data.data : [];
      const poGrns = Array.isArray(grnRes?.data?.data?.receives) ? grnRes.data.data.receives : [];
      const poLinkedDocs = [];

      const pushDocs = (items = [], source = 'Attachment') => {
        items.forEach((item, idx) => {
          const url = item?.url || '';
          const name = item?.originalName || item?.filename || `Document ${idx + 1}`;
          if (!name && !url) return;
          poLinkedDocs.push({
            id: item?._id || `${source}-${idx}`,
            source,
            name,
            url,
            uploadedAt: item?.uploadedAt || null,
            mimeType: item?.mimeType || ''
          });
        });
      };

      if (d) {
        pushDocs(d.attachments, 'PO Attachment');
        if (d.indent) pushDocs(d.indent.attachments, 'Indent Attachment');
        poQuotations.forEach((q) => pushDocs(q?.attachments, `Quotation ${q?.quotationNumber || ''}`.trim()));
      }

      (voucherRow.attachments || []).forEach((att, idx) => {
        poLinkedDocs.push({
          id: att._id || `v-att-${idx}`,
          source: 'Voucher Attachment',
          name: att.originalName || att.filename || `Attachment ${idx + 1}`,
          url: att.filename ? `${(api.defaults.baseURL || '').replace(/\/api\/?$/, '')}/uploads/finance/${encodeURIComponent(att.filename)}` : '',
          uploadedAt: att.uploadedAt || null
        });
      });

      setViewDialog({
        open: true,
        po: d,
        poQuotations,
        poGrns,
        poLinkedDocs,
        poAuditTab: d ? 0 : 5,
        loading: false
      });
    } catch (e) {
      console.error('Error loading voucher documents:', e);
      const fallbackDocs = (voucherRow.attachments || []).map((att, idx) => ({
        id: att._id || `att-${idx}`,
        source: 'Voucher Attachment',
        name: att.originalName || att.filename || `Attachment ${idx + 1}`,
        url: att.filename ? `${(api.defaults.baseURL || '').replace(/\/api\/?$/, '')}/uploads/finance/${encodeURIComponent(att.filename)}` : '',
        uploadedAt: att.uploadedAt || null
      }));
      setViewDialog({
        open: true,
        po: null,
        poQuotations: [],
        poGrns: [],
        poLinkedDocs: fallbackDocs,
        poAuditTab: 5,
        loading: false
      });
    }
  };

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

  const fetchEntries = async (opts = {}) => {
    const nextPage = opts.page ?? page;
    const nextRowsPerPage = opts.rowsPerPage ?? rowsPerPage;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', String(nextPage + 1));
      params.append('limit', String(nextRowsPerPage));
      if (status) params.append('status', status);
      if (search.trim()) params.append('search', search.trim());
      if (voucherType) params.append('referenceType', voucherType);
      // Payroll accrual JVs are auto-posted backend entries; finance uses Payroll Queue + BPV on payment.
      params.append('excludeReferenceTypes', 'payroll');
      if (selectedCompanyId) params.append('companyId', selectedCompanyId);
      const res = await api.get(`/finance/journal-entries?${params.toString()}`);
      setEntries(res?.data?.data?.entries || []);
      setTotalCount(res?.data?.data?.pagination?.totalCount || 0);
    } catch (_e) {
      setEntries([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setPage(0);
    fetchEntries({ page: 0 });
  };

  useEffect(() => {
    setPage(0);
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchEntries();
  }, [page, rowsPerPage, selectedCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const voucherRows = useMemo(() => (
    entries.map((entry) => ({
      ...entry,
      voucherType: String(entry?.referenceType || 'manual').toUpperCase()
    }))
  ), [entries]);

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

  const saveSignedDocumentStatus = async (voucherId, nextStatus, signedBySignatory) => {
    if (!voucherId) return;
    const row = entries.find((e) => e._id === voucherId);
    if (isCaVoucherWorkflowLocked(row)) return;
    if (nextStatus === 'signed' && !(row?.attachments || []).length) return;
    try {
      const payload = { signedDocumentStatus: nextStatus };
      if (signedBySignatory !== undefined) {
        payload.signedBySignatory = signedBySignatory;
      }
      const res = await api.put(`/finance/journal-entries/${voucherId}/signed-document`, payload);
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <VoucherIcon color="primary" />
            <Typography variant="h5" fontWeight={700}>Voucher Center</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FinanceCompanySelector minWidth={280} showHelper={false} />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setNewVoucherDialog(true)}
            >
              New Voucher
            </Button>
          </Box>
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
            <Button fullWidth variant="contained" onClick={applyFilters}>Apply</Button>
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
                <TableCell>Signed By</TableCell>
                <TableCell>Signed Date</TableCell>
                <TableCell>Clearance</TableCell>
                <TableCell>Clearance Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={14} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : voucherRows.length === 0 ? (
                <TableRow><TableCell colSpan={14} align="center">No vouchers found</TableCell></TableRow>
              ) : voucherRows.map((row) => {
                const workflowLocked = isCaVoucherWorkflowLocked(row);
                const hasAttachment = (row.attachments || []).length > 0;
                const isSigned = row.signedDocumentStatus === 'signed';
                const canUseClearance =
                  !workflowLocked &&
                  hasAttachment &&
                  isSigned &&
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
                      <Box sx={{ minWidth: 140 }}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          disabled={workflowLocked || !hasAttachment}
                          value={isSigned ? 'signed' : 'not_signed'}
                          onChange={(e) => saveSignedDocumentStatus(row._id, e.target.value, row.signedBySignatory)}
                          SelectProps={{
                            displayEmpty: true,
                            MenuProps: { PaperProps: { sx: { maxHeight: 250 } } }
                          }}
                        >
                          <MenuItem value="signed">Signed</MenuItem>
                          <MenuItem value="not_signed">Not Signed</MenuItem>
                        </TextField>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ minWidth: 180 }}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          disabled={workflowLocked || !hasAttachment || !isSigned}
                          value={row.signedBySignatory || ''}
                          onChange={(e) => saveSignedDocumentStatus(row._id, 'signed', e.target.value)}
                          SelectProps={{
                            displayEmpty: true,
                            MenuProps: { PaperProps: { sx: { maxHeight: 250 } } }
                          }}
                        >
                          <MenuItem value="">
                            <em>Select Signatory</em>
                          </MenuItem>
                          {SIGNATORY_OPTIONS.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Box>
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
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        <Tooltip title="View Voucher">
                          <IconButton size="small" onClick={() => navigate(`/finance/vouchers/${row._id}`)}>
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View Docs (PO & Audit Trail)">
                          <IconButton size="small" color="info" onClick={() => handleOpenVoucherDocs(row)}>
                            <DescriptionIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
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
            component="label"
            disabled={attachDlg.uploading}
          >
            Upload Document
            <input type="file" hidden onChange={handleFileUpload} accept=".pdf,.png,.jpg,.jpeg" />
          </Button>
          <Button variant="contained" onClick={closeAttachDlg}>Close</Button>
        </DialogActions>
      </Dialog>
      
      <Dialog open={newVoucherDialog} onClose={() => setNewVoucherDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Typography fontWeight={700}>Create New Voucher</Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ pt: 1 }}>
            <TextField
              select
              fullWidth
              label="Select Voucher Type"
              value={selectedNewVoucherType}
              onChange={(e) => setSelectedNewVoucherType(e.target.value)}
            >
              <MenuItem value="purchase_bill">Purchase Bill (PB)</MenuItem>
              <MenuItem value="payment_voucher">Payment Voucher (PV)</MenuItem>
              <MenuItem value="receipt_voucher">Receipt Voucher (RV)</MenuItem>
              <MenuItem value="vendor_advance">Vendor Advance (VA)</MenuItem>
              <MenuItem value="journal_voucher">Journal Voucher (JV)</MenuItem>
            </TextField>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Select the type of voucher you wish to create. This will redirect you to the corresponding financial form.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewVoucherDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateVoucher} 
            disabled={!selectedNewVoucherType}
          >
            Continue
          </Button>
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

      {/* Related PO & Voucher Audit Documents Dialog */}
      <Dialog
        open={viewDialog.open}
        onClose={() => setViewDialog((prev) => ({ ...prev, open: false }))}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 0,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            background: '#ffffff',
            width: '90%',
            maxWidth: '210mm',
            maxHeight: '95vh',
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
        <DialogTitle sx={{ p: 0, m: 0, '@media print': { display: 'none' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
              Voucher &amp; Linked Documents ({viewDialog.po?.orderNumber || 'Audit View'})
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={() => window.print()}
                size="small"
                sx={{ '@media print': { display: 'none' } }}
              >
                Print
              </Button>
              <IconButton
                size="small"
                onClick={() => setViewDialog((prev) => ({ ...prev, open: false }))}
                sx={{ color: '#666', '@media print': { display: 'none' } }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, background: '#ffffff', overflow: 'auto', '@media print': { p: 0, overflow: 'visible' } }}>
          {viewDialog.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ p: 0, background: '#ffffff', fontFamily: 'Arial, sans-serif' }} className="print-content">
              <Tabs
                value={viewDialog.poAuditTab ?? 0}
                onChange={(_, v) => setViewDialog((prev) => ({ ...prev, poAuditTab: v }))}
                sx={{ px: 2, pt: 1, borderBottom: 1, borderColor: 'divider', '@media print': { display: 'none' } }}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Indent" />
                <Tab label="Purchase Order" />
                <Tab label="Comparative Statement" />
                <Tab label={`Quotations (${viewDialog.poQuotations?.length || 0})`} />
                <Tab label={viewDialog.poGrns?.length > 0 ? `GRN(s) (${viewDialog.poGrns.length})` : 'GRN(s)'} />
                <Tab label={`Attached Documents (${viewDialog.poLinkedDocs?.length || 0})`} />
              </Tabs>

              {/* Tab 0: Indent */}
              {viewDialog.poAuditTab === 0 && (
                <Box sx={{ p: 2, overflowX: 'auto' }}>
                  {!viewDialog.po?.indent ? (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                      No indent linked with this Purchase Order.
                    </Typography>
                  ) : (
                    <Paper sx={{ p: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="h5" fontWeight={700} align="center" sx={{ textTransform: 'uppercase', mb: 1 }}>
                        Purchase Request Form
                      </Typography>
                      {viewDialog.po.indent.title && (
                        <Typography variant="h6" fontWeight={600} align="center" sx={{ mb: 2 }}>
                          {viewDialog.po.indent.title}
                        </Typography>
                      )}
                      <Box sx={{ mb: 1.5, fontSize: '0.9rem', textAlign: 'center' }}>
                        <Typography component="span" fontWeight={600}>ERP Ref:</Typography>
                        <Typography component="span" sx={{ ml: 1 }}>
                          {viewDialog.po.indent.erpRef || 'PR #' + (viewDialog.po.indent.indentNumber?.split('-').pop() || '')}
                        </Typography>
                      </Box>
                      <Box sx={{ mb: 1.5, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <Box>
                          <Typography component="span" fontWeight={600}>Date:</Typography>
                          <Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(viewDialog.po.indent.requestedDate)}</Typography>
                        </Box>
                        <Box>
                          <Typography component="span" fontWeight={600}>Required Date:</Typography>
                          <Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(viewDialog.po.indent.requiredDate) || '—'}</Typography>
                        </Box>
                        <Box>
                          <Typography component="span" fontWeight={600}>Indent No.:</Typography>
                          <Typography component="span" sx={{ ml: 1 }}>{viewDialog.po.indent.indentNumber || '—'}</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ mb: 3, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <Box>
                          <Typography component="span" fontWeight={600}>Department:</Typography>
                          <Typography component="span" sx={{ ml: 1 }}>{viewDialog.po.indent.department?.name || viewDialog.po.indent.department || '—'}</Typography>
                        </Box>
                        <Box>
                          <Typography component="span" fontWeight={600}>Originator:</Typography>
                          <Typography component="span" sx={{ ml: 1 }}>
                            {viewDialog.po.indent.requestedBy?.firstName && viewDialog.po.indent.requestedBy?.lastName
                              ? `${viewDialog.po.indent.requestedBy.firstName} ${viewDialog.po.indent.requestedBy.lastName}`
                              : viewDialog.po.indent.requestedBy?.name || '—'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ mb: 3 }}>
                        <Table size="small" sx={{ border: '1px solid', borderColor: 'divider' }}>
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'grey.100' }}>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>S#</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Item Name</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Description</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Brand</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Unit</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="center">Qty</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Purpose</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Est. Cost</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(viewDialog.po.indent.items || []).map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="center">{idx + 1}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.itemName || '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.description || '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.brand || '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.unit || '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="center">{item.quantity ?? '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.purpose || '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{item.estimatedCost != null ? Number(item.estimatedCost).toFixed(2) : '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                      {viewDialog.po.indent.justification && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Justification:</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            {viewDialog.po.indent.justification}
                          </Typography>
                        </Box>
                      )}
                      {Array.isArray(viewDialog.po.indent.approvalChain) && viewDialog.po.indent.approvalChain.length > 0 && (
                        <Box sx={{ mt: 3 }}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                            Indent approval progress
                          </Typography>
                          <Table size="small" sx={{ border: '1px solid', borderColor: 'divider', maxWidth: 760 }}>
                            <TableHead>
                              <TableRow sx={{ bgcolor: 'action.hover' }}>
                                <TableCell sx={{ fontWeight: 700 }}>Approver</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Date &amp; time</TableCell>
                                <TableCell sx={{ fontWeight: 700 }} align="center">Digital signature</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {viewDialog.po.indent.approvalChain.map((step, idx) => {
                                const approver = step.approver;
                                const name =
                                  [approver?.firstName, approver?.lastName].filter(Boolean).join(' ').trim() ||
                                  approver?.email ||
                                  `Approver ${idx + 1}`;
                                const status = step.status || 'pending';
                                const chipColor = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'warning';
                                const chipLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending approval';
                                return (
                                  <TableRow key={`${name}-${idx}`}>
                                    <TableCell>{name}</TableCell>
                                    <TableCell>
                                      <Chip size="small" label={chipLabel} color={chipColor} variant={status === 'pending' ? 'outlined' : 'filled'} />
                                    </TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{step?.actedAt ? formatDateForPrint(step.actedAt) : '—'}</TableCell>
                                    <TableCell align="center">
                                      {status === 'approved' && approver?.digitalSignature ? (
                                        <DigitalSignatureImage userOrPath={approver} alt={`Signature ${name}`} />
                                      ) : status === 'approved' ? (
                                        <Typography variant="caption" color="text.secondary">No signature on file</Typography>
                                      ) : (
                                        <Typography variant="caption" color="text.secondary">—</Typography>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </Box>
                      )}
                    </Paper>
                  )}
                </Box>
              )}

              {/* Tab 1: Purchase Order (Official Layout matching Audit and CEO) */}
              {viewDialog.poAuditTab === 1 && (
                <Box sx={{ p: 2 }}>
                  {!viewDialog.po ? (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                      No direct Purchase Order linked with this voucher. See Attached Documents tab.
                    </Typography>
                  ) : (
                    <Paper
                      sx={{
                        p: { xs: 3, sm: 3.5, md: 4 },
                        maxWidth: '210mm',
                        mx: 'auto',
                        backgroundColor: '#fff',
                        boxShadow: 'none',
                        width: '100%',
                        fontFamily: 'Arial, sans-serif',
                        '@media print': {
                          boxShadow: 'none',
                          p: 2.5,
                          maxWidth: '100%',
                          backgroundColor: '#fff',
                          mx: 0,
                          width: '100%',
                          pageBreakInside: 'avoid'
                        }
                      }}
                    >
                      {/* Title - Centered */}
                      <Typography
                        variant="h4"
                        fontWeight={700}
                        align="center"
                        sx={{
                          textTransform: 'uppercase',
                          mb: 3,
                          fontSize: { xs: '1.8rem', print: '1.6rem' },
                          letterSpacing: 1
                        }}
                      >
                        Purchase Order
                      </Typography>

                      {/* Buyer Information - First Row */}
                      <Box sx={{ mb: 2.5 }}>
                        <Typography variant="h6" fontWeight={600} sx={{ mb: 1, fontSize: '1.1rem' }}>
                          Residencia
                        </Typography>
                        <Typography sx={{ fontSize: '0.9rem', mb: 0.5 }}>
                          1st Avenue 18 4 Islamabad
                        </Typography>
                        <Typography sx={{ fontSize: '0.9rem' }}>
                          1. Het Sne 1-8. Islamabad.
                        </Typography>
                      </Box>

                      {/* Divider */}
                      <Divider sx={{ my: 2.5, borderWidth: 1, borderColor: '#ccc' }} />

                      {/* Vendor and PO Details - Second Row in Columns */}
                      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', gap: 3 }}>
                        {/* Left Column - Vendor Info */}
                        <Box sx={{ width: '45%', fontSize: '0.9rem' }}>
                          <Typography variant="h6" fontWeight={600} sx={{ mb: 1, fontSize: '1.1rem' }}>
                            {viewDialog.po.vendor?.name || 'Vendor Name'}
                          </Typography>
                          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.6, mb: 2 }}>
                            {viewDialog.po.vendor?.address || 'Vendor Address'}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', lineHeight: 1.6 }}>
                            <Typography component="span" sx={{ fontWeight: 600, mr: 1 }}>Indent Details:</Typography>
                            <Typography component="span">
                              Indent# {viewDialog.po.indent?.indentNumber || 'N/A'} Dated. {viewDialog.po.indent?.requestedDate ? formatDateForPrint(viewDialog.po.indent.requestedDate) : 'N/A'}.
                              {viewDialog.po.indent?.title && ` ${viewDialog.po.indent.title}.`}
                              {viewDialog.po.indent?.requestedBy && ` End User. ${viewDialog.po.indent.requestedBy.firstName || ''} ${viewDialog.po.indent.requestedBy.lastName || ''}`}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Right Column - PO Details */}
                        <Box sx={{ width: '50%', fontSize: '0.9rem', lineHeight: 2 }}>
                          <Box sx={{ display: 'flex', mb: 0.5 }}>
                            <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>P.O No.:</Typography>
                            <Typography component="span">
                              {viewDialog.po.orderNumber ? 
                                (viewDialog.po.orderNumber.startsWith('P') && !viewDialog.po.orderNumber.includes('-')
                                  ? viewDialog.po.orderNumber
                                  : 'P' + (viewDialog.po.orderNumber.match(/\d+$/)?.[0] || viewDialog.po.orderNumber.split('-').pop() || '').padStart(9, '0'))
                                : 'N/A'}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', mb: 0.5 }}>
                            <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Date:</Typography>
                            <Typography component="span">{formatDateForPrint(viewDialog.po.orderDate)}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', mb: 0.5 }}>
                            <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Delivery Date:</Typography>
                            <Typography component="span">{viewDialog.po.expectedDeliveryDate ? formatDateForPrint(viewDialog.po.expectedDeliveryDate) : '___________'}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', mb: 0.5 }}>
                            <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Delivery Address:</Typography>
                            <Typography component="span">
                              {(() => {
                                if (viewDialog.po.deliveryAddress && typeof viewDialog.po.deliveryAddress === 'string' && viewDialog.po.deliveryAddress.trim()) {
                                  return viewDialog.po.deliveryAddress.trim();
                                }
                                if (viewDialog.po.shippingAddress && typeof viewDialog.po.shippingAddress === 'object') {
                                  const parts = [
                                    viewDialog.po.shippingAddress.street,
                                    viewDialog.po.shippingAddress.city,
                                    viewDialog.po.shippingAddress.state,
                                    viewDialog.po.shippingAddress.zipCode,
                                    viewDialog.po.shippingAddress.country
                                  ].filter(Boolean);
                                  if (parts.length > 0) return parts.join(', ');
                                }
                                if (viewDialog.po.vendor?.address) return viewDialog.po.vendor.address;
                                return '___________';
                              })()}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', mb: 0.5 }}>
                            <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Cost Center:</Typography>
                            <Typography component="span">{viewDialog.po.indent?.department?.name || viewDialog.po.indent?.department || '___________'}</Typography>
                          </Box>
                        </Box>
                      </Box>

                      {/* Items Table */}
                      <Box sx={{ mb: 3 }}>
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            border: '1px solid #000',
                            fontSize: '0.85rem',
                            fontFamily: 'Arial, sans-serif'
                          }}
                        >
                          <thead>
                            <tr style={{ backgroundColor: '#f5f5f5', border: '1px solid #000' }}>
                              <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '5%' }}>
                                Sr no
                              </th>
                              <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '11%' }}>
                                Product
                              </th>
                              <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '23%' }}>
                                Description
                              </th>
                              <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '14%' }}>
                                Specification
                              </th>
                              <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '11%' }}>
                                Brand
                              </th>
                              <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '11%' }}>
                                Quantity Unit
                              </th>
                              <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '11%' }}>
                                Rate
                              </th>
                              <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '11%' }}>
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewDialog.po.items && viewDialog.po.items.length > 0 ? (
                              viewDialog.po.items.map((item, index) => (
                                <tr key={index} style={{ border: '1px solid #000' }}>
                                  <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                                    {index + 1}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                                    {item.productCode || viewDialog.po.indent?.items?.[index]?.itemCode || `44-001-${String(index + 1).padStart(4, '0')}`}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                                    {item.itemName || item.description || viewDialog.po.indent?.items?.[index]?.itemName || '___________'}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                                    {(() => {
                                      if (item.specification && String(item.specification).trim()) return item.specification.trim();
                                      const indentItem = viewDialog.po.indent?.items?.[index];
                                      if (indentItem?.specification && String(indentItem.specification).trim()) return indentItem.specification.trim();
                                      if (indentItem?.description && String(indentItem.description).trim()) return indentItem.description.trim();
                                      if (indentItem?.purpose && String(indentItem.purpose).trim()) return indentItem.purpose.trim();
                                      return '___________';
                                    })()}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                                    {item.brand || viewDialog.po.indent?.items?.[index]?.brand || '___________'}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                                    {item.quantity ? `${Number(item.quantity).toLocaleString()} ${item.unit || 'Nos'}` : '___________'}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                                    {item.unitPrice ? Number(item.unitPrice).toLocaleString() : '___________'}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                                    {item.totalPrice || item.amount ? Number(item.totalPrice || item.amount).toLocaleString() : '___________'}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={8} style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>
                                  No items
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </Box>

                      {/* Financial Summary - Right Aligned */}
                      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
                        <Box sx={{ width: '300px', fontSize: '0.9rem' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography component="span" fontWeight={600}>Total (Rupees):</Typography>
                            <Typography component="span">{Number(viewDialog.po.totalAmount || 0).toLocaleString()}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography component="span" fontWeight={600}>Net Total:</Typography>
                            <Typography component="span">{Number(viewDialog.po.totalAmount || 0).toLocaleString()}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography component="span" fontWeight={600}>Freight Charges:</Typography>
                            <Typography component="span">{Number(viewDialog.po.shippingCost || 0).toLocaleString()}</Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
                            Rupees {numberToWords(viewDialog.po.totalAmount || 0)}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Terms & Conditions */}
                      <Box sx={{ mb: 3, border: '1px solid #ccc', p: 2, fontSize: '0.9rem' }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, textDecoration: 'underline' }}>
                          TERMS & CONDITIONS
                        </Typography>
                        <Box sx={{ lineHeight: 1.8 }}>
                          <Typography sx={{ mb: 1, fontWeight: 600 }}>Main Terms & Conditions</Typography>
                          <Box sx={{ mb: 1 }}>
                            <Typography component="span" fontWeight={600}>Payment Terms:</Typography>
                            <Typography component="span" sx={{ ml: 1 }}>
                              {viewDialog.po.paymentTerms || '100% Advance Payment'}
                            </Typography>
                          </Box>
                          <Box sx={{ mb: 1 }}>
                            <Typography component="span" fontWeight={600}>Delivery Terms:</Typography>
                            <Typography component="span" sx={{ ml: 1 }}>
                              At-Site Delivery
                            </Typography>
                          </Box>
                          <Box sx={{ mb: 1 }}>
                            <Typography component="span" fontWeight={600}>Delivery Time.</Typography>
                            <Typography component="span" sx={{ ml: 1 }}>
                              Delivery within: {viewDialog.po.quotation?.deliveryTime || '03 days'} of confirmed PO & Payment
                            </Typography>
                          </Box>
                          <Typography sx={{ mb: 1 }}>
                            Rates Are Exclusive Of all The Taxes
                          </Typography>
                          {viewDialog.po.vendor?.cnic && (
                            <Typography sx={{ mb: 1 }}>
                              CNIC {viewDialog.po.vendor.cnic}
                            </Typography>
                          )}
                          {viewDialog.po.vendor?.payeeName && (
                            <Typography>
                              Payee Name: {viewDialog.po.vendor.payeeName}
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      <Divider sx={{ my: 3 }} />

                      {/* Approval Authorities Table */}
                      <Typography variant="subtitle1" fontWeight={700} mb={1.5} sx={{ textAlign: 'center' }}>
                        APPROVAL AUTHORITIES
                      </Typography>
                      <TableContainer component={Box} sx={{ border: '1px solid #ccc', mb: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                              <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700 }}>Authority</TableCell>
                              <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700 }}>Name</TableCell>
                              <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700, textAlign: 'center' }}>Digital Signature</TableCell>
                              <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700 }}>Date & Time</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(() => {
                              const poData = viewDialog.po;
                              const authorityText = poData.approvalAuthorities || {};
                              const indent = poData.indent && typeof poData.indent === 'object' ? poData.indent : {};
                              const csa = indent.comparativeStatementApprovals || {};
                              const approvalSteps = Array.isArray(indent?.comparativeApproval?.approvers)
                                ? indent.comparativeApproval.approvers
                                : [];
                              const stepByUserId = new Map(
                                approvalSteps.map((step) => [String(step?.approver?._id || step?.approver || ''), step])
                              );
                              const personName = (user, fallback = '') => {
                                if (fallback && String(fallback).trim()) return String(fallback).trim();
                                if (user) {
                                  const n = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
                                  if (n) return n;
                                  if (user?.email) return user.email;
                                }
                                return '—';
                              };
                              const authorityRows = [
                                { key: 'preparedBy', label: 'Prepared By', user: csa.preparedByUser, fallback: authorityText.preparedBy || csa.preparedBy || '' },
                                { key: 'managerProcurement', label: 'Manager Procurement', user: csa.managerProcurementUser, fallback: authorityText.managerProcurement || csa.managerProcurement || '' },
                                { key: 'chiefOperatingOfficer', label: 'Chief operating officer', user: null, fallback: authorityText.chiefOperatingOfficer || authorityText.verifiedBy || csa.verifiedBy || '' },
                                { key: 'avpTaj', label: 'AVP Taj', user: null, fallback: authorityText.avpTaj || authorityText.authorisedRep || csa.authorisedRep || '' },
                                ...(authorityText.technicalDepartment || csa.technicalDepartment ? [
                                  { key: 'technicalDepartment', label: 'Technical Department', user: null, fallback: authorityText.technicalDepartment || csa.technicalDepartment || '' }
                                ] : []),
                                { key: 'preAuditInitial', label: 'Initial Pre-Audit', user: poData.preAuditInitialApprovedBy, fallback: '' },
                                { key: 'auditDirectorApproval', label: 'Audit Director', user: poData.auditApprovedBy, fallback: '' }
                              ];
                              const authorityApprovalByKey = new Map(
                                (Array.isArray(poData.authorityApprovals) ? poData.authorityApprovals : [])
                                  .filter((entry) => entry?.authorityKey)
                                  .map((entry) => [String(entry.authorityKey), entry])
                              );

                              return authorityRows.map((row) => {
                                const uid = String(row?.user?._id || row?.user || '');
                                const step = uid ? stepByUserId.get(uid) : null;
                                const authorityApproval = authorityApprovalByKey.get(String(row.key));
                                const authorityUser = authorityApproval?.approver && typeof authorityApproval.approver === 'object'
                                  ? authorityApproval.approver
                                  : step?.approver && typeof step.approver === 'object'
                                    ? step.approver
                                    : row.user;
                                const actionDate = authorityApproval?.approvedAt
                                  || step?.actedAt
                                  || (row.key === 'preAuditInitial' ? poData.preAuditInitialApprovedAt : null)
                                  || (row.key === 'auditDirectorApproval' ? poData.auditApprovedAt : null)
                                  || null;

                                const displayAuthorityName = authorityApproval?.approver
                                  ? ([authorityApproval.approver.firstName, authorityApproval.approver.lastName].filter(Boolean).join(' ').trim() || authorityApproval.approver.email || row.fallback || '—')
                                  : personName(authorityUser, row.fallback);

                                return (
                                  <TableRow key={row.key}>
                                    <TableCell sx={{ border: '1px solid #ccc', fontWeight: 600 }}>{row.label}</TableCell>
                                    <TableCell sx={{ border: '1px solid #ccc' }}>{displayAuthorityName}</TableCell>
                                    <TableCell sx={{ border: '1px solid #ccc', textAlign: 'center' }}>
                                      {authorityUser?.digitalSignature ? (
                                        <DigitalSignatureImage userOrPath={authorityUser} alt={`${row.label} signature`} />
                                      ) : (
                                        <Typography variant="caption" color="text.secondary">—</Typography>
                                      )}
                                    </TableCell>
                                    <TableCell sx={{ border: '1px solid #ccc' }}>
                                      {actionDate ? formatDateForPrint(actionDate) : '—'}
                                    </TableCell>
                                  </TableRow>
                                );
                              });
                            })()}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  )}
                </Box>
              )}

              {/* Tab 2: Comparative Statement */}
              {viewDialog.poAuditTab === 2 && (
                <Box sx={{ p: 2, overflowX: 'auto' }}>
                  <ComparativeStatementView
                    requisition={viewDialog.po?.indent}
                    quotations={viewDialog.poQuotations || []}
                    approvalAuthority={viewDialog.po?.indent?.comparativeStatementApprovals || {}}
                    note={viewDialog.po?.indent?.notes ?? ''}
                    readOnly
                    formatNumber={(n) => Number(n || 0).toLocaleString()}
                    loadingQuotations={false}
                    showPrintButton={false}
                  />
                </Box>
              )}

              {/* Tab 3: Quotations */}
              {viewDialog.poAuditTab === 3 && (
                <Box sx={{ p: 2 }}>
                  {(!viewDialog.poQuotations || viewDialog.poQuotations.length === 0) ? (
                    <Typography color="text.secondary">No quotations linked with this PO.</Typography>
                  ) : (
                    <Stack spacing={4}>
                      {viewDialog.poQuotations.map((q) => (
                        <QuotationDetailView
                          key={q._id}
                          quotation={q}
                          formatNumber={(n) => Number(n || 0).toLocaleString()}
                          formatDateForPrint={formatDateForPrint}
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
              )}

              {/* Tab 4: GRNs */}
              {viewDialog.poAuditTab === 4 && (
                <Box sx={{ p: 2 }}>
                  {(!viewDialog.poGrns || viewDialog.poGrns.length === 0) ? (
                    <Typography color="text.secondary">No GRN attached to this PO.</Typography>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>#</TableCell>
                            <TableCell>GRN No</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Supplier</TableCell>
                            <TableCell align="right">Net Amount</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {viewDialog.poGrns.map((grn, idx) => (
                            <TableRow key={grn._id || idx}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell>{grn.receiveNumber || grn._id}</TableCell>
                              <TableCell>{formatDateForPrint(grn.receiveDate)}</TableCell>
                              <TableCell>{grn.supplierName || grn.supplier?.name || '—'}</TableCell>
                              <TableCell align="right">{formatPKR(grn.netAmount || grn.total || 0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {/* Tab 5: Attached Documents */}
              {viewDialog.poAuditTab === 5 && (
                <Box sx={{ p: 2 }}>
                  {(!viewDialog.poLinkedDocs || viewDialog.poLinkedDocs.length === 0) ? (
                    <Typography color="text.secondary">No attached documents found.</Typography>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>#</TableCell>
                            <TableCell>Source</TableCell>
                            <TableCell>Document</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell align="right">Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {viewDialog.poLinkedDocs.map((doc, idx) => (
                            <TableRow key={doc.id || idx}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell>{doc.source || 'Attachment'}</TableCell>
                              <TableCell>{doc.name || 'Document'}</TableCell>
                              <TableCell>{doc.uploadedAt ? formatDateForPrint(doc.uploadedAt) : '—'}</TableCell>
                              <TableCell align="right">
                                {doc.url ? (
                                  <Button size="small" variant="outlined" onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}>
                                    Open
                                  </Button>
                                ) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Vouchers;
