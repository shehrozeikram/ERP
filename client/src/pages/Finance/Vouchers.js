import React, { useEffect, useMemo, useState } from 'react';
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
  Menu,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider as MuiDivider
} from '@mui/material';
import {
  Visibility as ViewIcon,
  ReceiptLong as VoucherIcon,
  Description as DescriptionIcon,
  Print as PrintIcon,
  Close as CloseIcon,
  Add as AddIcon,
  ArrowDropDown as ArrowDropDownIcon,
  Checklist as ChecklistIcon
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
import CentralizedStoreBillInvoiceBody from '../../components/UtilityBill/CentralizedStoreBillInvoiceBody';
import { DigitalSignatureImage } from '../../components/common/DigitalSignatureImage';
import { numberToWords } from '../../utils/numberToWords';

const formatDateForPrint = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** User-facing voucher status (journal status + signed / clearance workflow). */
function getVoucherStatusDisplay(row) {
  const journalStatus = String(row?.status || '').toLowerCase();
  const signed =
    row?.signedDocumentStatus === 'signed' && Boolean(row?.signedDocumentAt);
  const cleared = row?.clearanceStatus === 'cleared';

  if (journalStatus === 'reversed') return { label: 'Reversed', color: 'default' };
  if (journalStatus === 'cancelled') return { label: 'Cancelled', color: 'default' };
  if (cleared) return { label: 'Cleared', color: 'success' };
  if (signed) return { label: 'Signed', color: 'info' };
  if (journalStatus === 'posted') return { label: 'Posted', color: 'success' };
  if (journalStatus === 'draft') return { label: 'Draft', color: 'warning' };
  const fallback = journalStatus
    ? journalStatus.charAt(0).toUpperCase() + journalStatus.slice(1)
    : '—';
  return { label: fallback, color: 'default' };
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

const Vouchers = () => {
  const navigate = useNavigate();
  const { selectedCompanyId } = useFinanceCompany();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  /** Default: PAYMENT vouchers (referenceType payment on journal) */
  const [voucherType, setVoucherType] = useState('payment');
  const [viewDialog, setViewDialog] = useState({
    open: false,
    voucher: null,
    po: null,
    poQuotations: [],
    poGrns: [],
    poLinkedDocs: [],
    poAuditTab: 0,
    financeAuthorityDoc: null,
    vendorAdvanceDoc: null,
    apPaymentApp: null,
    payrollPeriodPaymentApp: null,
    cashApproval: null,
    loading: false
  });

  // Print selection dialog state
  const [printSelectDialogOpen, setPrintSelectDialogOpen] = useState(false);
  const [printSelection, setPrintSelection] = useState({
    voucher: true,
    indent: true,
    po: true,
    comparative: true,
    quotations: true,
    grns: true
  });
  const [multiPrintMode, setMultiPrintMode] = useState(false); // true when printing all or selected
  const [printMenuAnchor, setPrintMenuAnchor] = useState(null);
  
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
      voucher: voucherRow,
      po: null,
      poQuotations: [],
      poGrns: [],
      poLinkedDocs: [],
      poAuditTab: 0,
      financeAuthorityDoc: null,
      vendorAdvanceDoc: null,
      apPaymentApp: null,
      payrollPeriodPaymentApp: null,
      cashApproval: null,
      loading: true
    });
    setMultiPrintMode(false);

    try {
      // 1. Fetch full journal entry to ensure complete lines, populated accounts and approval authorities
      let fullVoucher = voucherRow;
      if (voucherRow?._id) {
        try {
          const vRes = await api.get(`/finance/journal-entries/${voucherRow._id}`);
          if (vRes.data?.data) {
            fullVoucher = vRes.data.data;
          }
        } catch (_) {}
      }

      let poId = null;
      if (fullVoucher.purchaseOrder || fullVoucher.purchaseOrderId) {
        poId = fullVoucher.purchaseOrder?._id || fullVoucher.purchaseOrder || fullVoucher.purchaseOrderId;
      } else if (fullVoucher.referenceModel === 'PurchaseOrder' && fullVoucher.referenceId) {
        poId = fullVoucher.referenceId;
      }

      let vaData = null;
      let apData = null;
      let payrollData = null;
      let caData = null;

      if (fullVoucher._id) {
        try {
          const vaRes = await api.get(`/finance/vendor-advances/by-journal-entry/${fullVoucher._id}`);
          vaData = vaRes.data?.data || null;
          if (!poId && vaData && vaData.referenceType === 'purchase_order' && vaData.referenceId) {
            poId = vaData.referenceId;
          }
        } catch (_) {}
      }

      if (fullVoucher._id) {
        try {
          const apRes = await api.get(`/finance/ap-payment-applications/by-journal-entry/${fullVoucher._id}`);
          apData = apRes.data?.data || null;
          if (!poId && apData && apData.referenceType === 'purchase_order' && apData.referenceId) {
            poId = apData.referenceId;
          }
        } catch (_) {}
      }

      if (fullVoucher._id) {
        try {
          const pRes = await api.get(`/finance/payroll-period-payments/by-journal-entry/${fullVoucher._id}`);
          payrollData = pRes.data?.data || null;
        } catch (_) {}
      }

      if (fullVoucher.referenceId && fullVoucher.referenceModel === 'CashApproval') {
        try {
          const cRes = await api.get(`/cash-approvals/${fullVoucher.referenceId}`);
          caData = cRes.data?.data || null;
        } catch (_) {}
      }

      const financeAuthDoc = apData || payrollData || vaData || caData;

      // Fetch Vendor Bills linked to PO or AP payment application or Voucher
      let poBills = [];
      try {
        if (apData?.accountsPayableId?._id || apData?.accountsPayableId) {
          const bId = apData.accountsPayableId._id || apData.accountsPayableId;
          const bRes = await api.get(`/finance/accounts-payable/${bId}`).catch(() => null);
          if (bRes?.data?.data) {
            poBills.push(bRes.data.data);
          }
        }
        if (poId) {
          const bRes = await api.get('/finance/accounts-payable', { params: { limit: 100 } }).catch(() => null);
          const allBills = bRes?.data?.data?.bills || bRes?.data?.data || [];
          const matchedBills = allBills.filter((b) => {
            if (String(b.referenceId || '') === String(poId)) return true;
            if (b.lineItems?.some((li) => String(li.poId || '') === String(poId))) return true;
            if (b.linkedGRNs?.some((lg) => String(lg.poId || '') === String(poId))) return true;
            return false;
          });
          matchedBills.forEach((b) => {
            if (!poBills.some((existing) => String(existing._id) === String(b._id))) {
              poBills.push(b);
            }
          });
        }
        if (fullVoucher.referenceModel === 'AccountsPayable' && fullVoucher.referenceId) {
          const bRes = await api.get(`/finance/accounts-payable/${fullVoucher.referenceId}`).catch(() => null);
          if (bRes?.data?.data && !poBills.some((existing) => String(existing._id) === String(bRes.data.data._id))) {
            poBills.push(bRes.data.data);
          }
        }
      } catch (_) {}

      if (!poId) {
        const fallbackDocs = (fullVoucher.attachments || []).map((att, idx) => ({
          id: att._id || `att-${idx}`,
          source: 'Voucher Attachment',
          name: att.originalName || att.filename || `Attachment ${idx + 1}`,
          url: att.filename ? `${(api.defaults.baseURL || '').replace(/\/api\/?$/, '')}/uploads/finance/${encodeURIComponent(att.filename)}` : '',
          uploadedAt: att.uploadedAt || null
        }));

        poBills.forEach((b) => {
          (b.attachments || []).forEach((att, idx) => {
            const pathUrl = att.path ? `${(api.defaults.baseURL || '').replace(/\/api\/?$/, '')}/${att.path.replace(/^\/+/, '')}` : '';
            fallbackDocs.push({
              id: att._id || `bill-att-${idx}`,
              source: `Vendor Bill (${b.billNumber})`,
              name: att.originalName || att.filename || `Bill Document ${idx + 1}`,
              url: pathUrl,
              uploadedAt: b.billDate || null
            });
          });
        });

        setViewDialog({
          open: true,
          voucher: fullVoucher,
          po: null,
          poBills,
          poQuotations: [],
          poGrns: [],
          poLinkedDocs: fallbackDocs,
          poAuditTab: 0,
          financeAuthorityDoc: financeAuthDoc,
          vendorAdvanceDoc: vaData,
          apPaymentApp: apData,
          payrollPeriodPaymentApp: payrollData,
          cashApproval: caData,
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
          const url = item?.url || (item?.path ? `${(api.defaults.baseURL || '').replace(/\/api\/?$/, '')}/${item.path.replace(/^\/+/, '')}` : '');
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

      poBills.forEach((b) => {
        pushDocs(b.attachments, `Vendor Bill (${b.billNumber})`);
      });

      (fullVoucher.attachments || []).forEach((att, idx) => {
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
        voucher: fullVoucher,
        po: d,
        poBills,
        poQuotations,
        poGrns,
        poLinkedDocs,
        poAuditTab: 0,
        financeAuthorityDoc: financeAuthDoc,
        vendorAdvanceDoc: vaData,
        apPaymentApp: apData,
        payrollPeriodPaymentApp: payrollData,
        cashApproval: caData,
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
        voucher: voucherRow,
        po: null,
        poBills: [],
        poQuotations: [],
        poGrns: [],
        poLinkedDocs: fallbackDocs,
        poAuditTab: 0,
        financeAuthorityDoc: null,
        vendorAdvanceDoc: null,
        apPaymentApp: null,
        payrollPeriodPaymentApp: null,
        cashApproval: null,
        loading: false
      });
    }
  };

  const handlePrintAllInOneGo = () => {
    setMultiPrintMode(true);
    setPrintSelection({
      voucher: true,
      indent: Boolean(viewDialog.po?.indent),
      po: Boolean(viewDialog.po),
      bills: Boolean(viewDialog.poBills?.length > 0),
      comparative: Boolean(viewDialog.poQuotations?.length > 0 || viewDialog.po?.indent?.comparativeApproval),
      quotations: Boolean(viewDialog.poQuotations?.length > 0),
      grns: Boolean(viewDialog.poGrns?.length > 0)
    });
    setPrintMenuAnchor(null);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handleOpenPrintCustomizer = () => {
    setPrintSelection({
      voucher: true,
      indent: Boolean(viewDialog.po?.indent),
      po: Boolean(viewDialog.po),
      bills: Boolean(viewDialog.poBills?.length > 0),
      comparative: Boolean(viewDialog.poQuotations?.length > 0 || viewDialog.po?.indent?.comparativeApproval),
      quotations: Boolean(viewDialog.poQuotations?.length > 0),
      grns: Boolean(viewDialog.poGrns?.length > 0)
    });
    setPrintMenuAnchor(null);
    setPrintSelectDialogOpen(true);
  };

  const handleExecuteCustomPrint = () => {
    setPrintSelectDialogOpen(false);
    setMultiPrintMode(true);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handlePrintCurrentTabOnly = () => {
    setMultiPrintMode(false);
    setPrintMenuAnchor(null);
    setTimeout(() => {
      window.print();
    }, 150);
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

  return (
    <Box sx={{ p: 3, '@media print': { display: 'none !important' } }} className="app-print-hide">
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
                <TableCell>Status</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : voucherRows.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center">No vouchers found</TableCell></TableRow>
              ) : voucherRows.map((row) => {
                return (
                  <TableRow key={row._id} hover>
                    <TableCell>{formatDate(row.date)}</TableCell>
                    <TableCell>{row.entryNumber}</TableCell>
                    <TableCell>{row.voucherType}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell align="right">{formatPKR(row.totalDebits || 0)}</TableCell>
                    <TableCell>{row.reference || '—'}</TableCell>
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
          rowsPerPageOptions={[25, 50, 100, 250, 500]}
        />
      </Paper>

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

      {/* Related PO & Voucher Audit Documents Dialog */}
      <Dialog
        open={viewDialog.open}
        onClose={() => {
          setViewDialog((prev) => ({ ...prev, open: false }));
          setMultiPrintMode(false);
        }}
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
              padding: 0,
              height: 'auto',
              width: '100%',
              maxHeight: 'none',
              overflow: 'visible',
              position: 'static'
            }
          }
        }}
      >
        <DialogTitle sx={{ p: 0, m: 0, '@media print': { display: 'none !important' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid #e0e0e0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VoucherIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
                Voucher &amp; Linked Documents ({viewDialog.voucher?.entryNumber || viewDialog.po?.orderNumber || 'Audit View'})
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                endIcon={<ArrowDropDownIcon />}
                onClick={(e) => setPrintMenuAnchor(e.currentTarget)}
                size="small"
                sx={{ '@media print': { display: 'none' } }}
              >
                Print Options
              </Button>
              <Menu
                anchorEl={printMenuAnchor}
                open={Boolean(printMenuAnchor)}
                onClose={() => setPrintMenuAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MenuItem onClick={handlePrintAllInOneGo}>
                  <PrintIcon fontSize="small" sx={{ mr: 1.5, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Print All in One Go</Typography>
                    <Typography variant="caption" color="text.secondary">Prints Voucher + all attached docs in a single queue</Typography>
                  </Box>
                </MenuItem>
                <MenuItem onClick={handleOpenPrintCustomizer}>
                  <ChecklistIcon fontSize="small" sx={{ mr: 1.5, color: 'info.main' }} />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Select Documents to Print...</Typography>
                    <Typography variant="caption" color="text.secondary">Choose which documents you want to include</Typography>
                  </Box>
                </MenuItem>
                <MuiDivider />
                <MenuItem onClick={handlePrintCurrentTabOnly}>
                  <DescriptionIcon fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="body2">Print Current View Only</Typography>
                    <Typography variant="caption" color="text.secondary">Prints currently selected tab</Typography>
                  </Box>
                </MenuItem>
              </Menu>
              <IconButton
                size="small"
                onClick={() => {
                  setViewDialog((prev) => ({ ...prev, open: false }));
                  setMultiPrintMode(false);
                }}
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
              {/* Screen Tab Navigation */}
              <Tabs
                value={viewDialog.poAuditTab ?? 0}
                onChange={(_, v) => {
                  setMultiPrintMode(false);
                  setViewDialog((prev) => ({ ...prev, poAuditTab: v }));
                }}
                sx={{ px: 2, pt: 1, borderBottom: 1, borderColor: 'divider', '@media print': { display: 'none' } }}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Voucher" />
                <Tab label="Indent" />
                <Tab label="Purchase Order" />
                <Tab label="Comparative Statement" />
                <Tab label={`Quotations (${viewDialog.poQuotations?.length || 0})`} />
                <Tab label={viewDialog.poGrns?.length > 0 ? `GRN(s) (${viewDialog.poGrns.length})` : 'GRN(s)'} />
                <Tab label={viewDialog.poBills?.length > 0 ? `Vendor Bills (${viewDialog.poBills.length})` : 'Vendor Bills'} />
                <Tab label={`Attached Documents (${viewDialog.poLinkedDocs?.length || 0})`} />
              </Tabs>

              {/* ----------------- SECTION 0: VOUCHER DETAILS ----------------- */}
              {(multiPrintMode ? printSelection.voucher : viewDialog.poAuditTab === 0) && viewDialog.voucher && (
                <Box
                  sx={{
                    p: 2,
                    '@media print': {
                      p: 0,
                      m: 0,
                      pageBreakAfter: 'always',
                      breakAfter: 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      height: 'auto',
                      maxHeight: 'none',
                      overflow: 'visible'
                    }
                  }}
                >
                  <Paper
                    sx={{
                      p: { xs: 3, sm: 3.5, md: 4 },
                      maxWidth: '210mm',
                      mx: 'auto',
                      backgroundColor: '#fff',
                      boxShadow: 'none',
                      border: '1px solid',
                      borderColor: 'divider',
                      fontFamily: 'Arial, sans-serif',
                      '@media print': {
                        p: '10mm 14mm',
                        boxShadow: 'none',
                        border: 'none',
                        maxWidth: '100%',
                        mx: 0,
                        pageBreakInside: 'avoid',
                        breakInside: 'avoid'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2.5, '@media print': { mb: 2 } }}>
                      <Box>
                        <Typography fontWeight={700} sx={{ fontSize: '1.4rem', '@media print': { fontSize: '1.65rem', lineHeight: 1.2 } }}>
                          {viewDialog.voucher?.companyId?.name || 'Sardar Group of Companies'}
                        </Typography>
                        <Typography fontWeight={700} color="primary" sx={{ fontSize: '1.2rem', textTransform: 'uppercase', '@media print': { fontSize: '1.45rem', mt: 0.5, letterSpacing: 0.5 } }}>
                          {viewDialog.voucher?.voucherSeries
                            ? `${viewDialog.voucher.voucherSeries} Voucher`
                            : `${String(viewDialog.voucher?.voucherType || viewDialog.voucher?.referenceType || 'Payment').toUpperCase()} VOUCHER`}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" sx={{ '@media print': { fontSize: '1.1rem', mb: 0.5 } }}><strong>Date:</strong> {formatDateForPrint(viewDialog.voucher.date)}</Typography>
                        <Typography variant="body2" sx={{ '@media print': { fontSize: '1.1rem' } }}><strong>Status:</strong> {getVoucherStatusDisplay(viewDialog.voucher).label}</Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2.5, p: 2, bgcolor: '#f9f9f9', borderRadius: 1, border: '1px solid #eee', '@media print': { p: 1.8, mb: 2, bgcolor: '#fcfcfc', border: '1.5px solid #ddd' } }}>
                      <Box sx={{ '@media print': { lineHeight: 1.7 } }}>
                        <Typography variant="body2" sx={{ '@media print': { fontSize: '1.1rem', mb: 0.4 } }}><strong>Voucher No:</strong> {viewDialog.voucher.entryNumber || '—'}</Typography>
                        <Typography variant="body2" sx={{ '@media print': { fontSize: '1.1rem', mb: 0.4 } }}><strong>Voucher Type:</strong> {viewDialog.voucher.voucherType || viewDialog.voucher.referenceType || '—'}</Typography>
                        <Typography variant="body2" sx={{ '@media print': { fontSize: '1.1rem' } }}><strong>Reference:</strong> {viewDialog.voucher.reference || '—'}</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right', '@media print': { lineHeight: 1.7 } }}>
                        <Typography variant="body2" sx={{ '@media print': { fontSize: '1.1rem', mb: 0.4 } }}><strong>Amount:</strong> {formatPKR(viewDialog.voucher.totalDebits || 0)}</Typography>
                        <Typography variant="body2" sx={{ '@media print': { fontSize: '1.1rem', mb: 0.4 } }}><strong>Module:</strong> {viewDialog.voucher.module || 'Finance'}</Typography>
                        {viewDialog.voucher.signedBySignatory && (
                          <Typography variant="body2" sx={{ '@media print': { fontSize: '1.1rem' } }}><strong>Signed By:</strong> {viewDialog.voucher.signedBySignatory}</Typography>
                        )}
                      </Box>
                    </Box>

                    {viewDialog.voucher.description && (
                      <Box sx={{ mb: 2.5, '@media print': { mb: 2 } }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ '@media print': { fontSize: '1.15rem', mb: 0.5 } }}>Narration / Description:</Typography>
                        <Typography variant="body2" sx={{ p: 1.5, bgcolor: '#fcfcfc', border: '1px solid #eee', borderRadius: 0.5, '@media print': { fontSize: '1.05rem', p: 1.2, border: '1.5px solid #ddd' } }}>
                          {viewDialog.voucher.description}
                        </Typography>
                      </Box>
                    )}

                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, '@media print': { fontSize: '1.25rem', mb: 0.8 } }}>
                      Accounting Entries &amp; Lines
                    </Typography>
                    <Table size="small" sx={{ border: '1px solid', borderColor: 'divider', mb: 2.5, '@media print': { mb: 2, border: '1.5px solid #000' } }}>
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.100', '@media print': { bgcolor: '#f2f2f2' } }}>
                          <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 1.2, px: 1.5, fontSize: '1.05rem', border: '1px solid #000' } }}>Account Title</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 1.2, px: 1.5, fontSize: '1.05rem', border: '1px solid #000' } }}>Narration</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 1.2, px: 1.5, fontSize: '1.05rem', border: '1px solid #000' } }}>Ref</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 1.2, px: 1.5, fontSize: '1.05rem', border: '1px solid #000' } }} align="right">Debit (PKR)</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 1.2, px: 1.5, fontSize: '1.05rem', border: '1px solid #000' } }} align="right">Credit (PKR)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(viewDialog.voucher.lines || []).map((line, idx) => (
                          <TableRow key={idx}>
                            <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 1.1, px: 1.5, fontSize: '1.05rem', border: '1px solid #000' } }}>
                              {line?.account?.name || line?.accountTitle || '—'}
                              {line?.account?.accountNumber ? (
                                <Typography variant="caption" display="block" color="text.secondary" sx={{ '@media print': { fontSize: '0.85rem' } }}>({line.account.accountNumber})</Typography>
                              ) : null}
                            </TableCell>
                            <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 1.1, px: 1.5, fontSize: '1.05rem', border: '1px solid #000' } }}>{line.description || viewDialog.voucher.description || '—'}</TableCell>
                            <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 1.1, px: 1.5, fontSize: '1.05rem', border: '1px solid #000' } }}>{viewDialog.voucher.reference || '—'}</TableCell>
                            <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 1.1, px: 1.5, fontSize: '1.05rem', fontWeight: 600, border: '1px solid #000' } }} align="right">{line.debit ? formatPKR(line.debit) : '0'}</TableCell>
                            <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 1.1, px: 1.5, fontSize: '1.05rem', fontWeight: 600, border: '1px solid #000' } }} align="right">{line.credit ? formatPKR(line.credit) : '0'}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: '#fafafa', '@media print': { bgcolor: '#f5f5f5' } }}>
                          <TableCell colSpan={3} align="right" sx={{ fontWeight: 700, border: '1px solid', borderColor: 'divider', '@media print': { py: 1.2, px: 1.5, fontSize: '1.15rem', border: '1px solid #000' } }}>Total</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, border: '1px solid', borderColor: 'divider', '@media print': { py: 1.2, px: 1.5, fontSize: '1.15rem', border: '1px solid #000' } }}>{formatPKR(viewDialog.voucher.totalDebits || 0)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, border: '1px solid', borderColor: 'divider', '@media print': { py: 1.2, px: 1.5, fontSize: '1.15rem', border: '1px solid #000' } }}>{formatPKR(viewDialog.voucher.totalCredits || 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>

                    {/* Voucher Finance Approval Authorities */}
                    {viewDialog.financeAuthorityDoc && (
                      <Box sx={{ mt: 3, '@media print': { mt: 2.5, pageBreakInside: 'avoid', breakInside: 'avoid' } }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, '@media print': { fontSize: '1.25rem', mb: 0.8 } }}>
                          Finance Document Approval Authority
                        </Typography>
                        <Table size="small" sx={{ border: '1px solid', borderColor: 'divider', '@media print': { border: '1.5px solid #000' } }}>
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'grey.100', '@media print': { bgcolor: '#f2f2f2' } }}>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 1, px: 1.5, fontSize: '1.05rem', border: '1px solid #000' } }}>Authority</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 1, px: 1.5, fontSize: '1.05rem', border: '1px solid #000' } }}>Approver</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 1, px: 1.5, fontSize: '1.05rem', border: '1px solid #000' } }}>Status</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 1, px: 1.5, fontSize: '1.05rem', border: '1px solid #000' } }}>Date &amp; Time</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 1, px: 1.5, fontSize: '1.05rem', border: '1px solid #000' } }} align="center">Digital Signature</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(() => {
                              const authorityDoc = viewDialog.financeAuthorityDoc;
                              const approvals = Array.isArray(authorityDoc?.financeAuthorityApprovals) ? authorityDoc.financeAuthorityApprovals : [];
                              const byKey = new Map(approvals.map((a) => [String(a?.authorityKey || '').trim(), a]).filter(([k]) => Boolean(k)));
                              const slots = [
                                { key: 'accountsOfficerUser', label: 'Accounts Officer / AM' },
                                { key: 'accountsManagerUser', label: 'Sr Manager Accounts' },
                                { key: 'financeControllerUser', label: 'GM Finance' }
                              ];

                              return slots.map((slot) => {
                                const approval = byKey.get(slot.key);
                                const assigned = authorityDoc?.financeApprovalAuthorities?.[slot.key] || null;
                                const approver = approval?.approver || assigned || null;
                                const decision = approval ? String(approval.decision || 'approved').toLowerCase() : 'pending';
                                const approvedAt = approval?.approvedAt || null;
                                const approverName = approver
                                  ? ([approver?.firstName, approver?.lastName].filter(Boolean).join(' ').trim() || approver?.email || '—')
                                  : '—';

                                return (
                                  <TableRow key={slot.key}>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider', fontWeight: 600, '@media print': { py: 1, px: 1.5, fontSize: '1.05rem', border: '1px solid #000' } }}>{slot.label}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 1, px: 1.5, fontSize: '1.05rem', border: '1px solid #000' } }}>{approverName}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 0.8, px: 1.2, border: '1px solid #000' } }}>
                                      <Chip
                                        size="small"
                                        label={decision === 'rejected' ? 'Rejected' : (decision === 'approved' ? 'Approved' : 'Pending')}
                                        color={decision === 'rejected' ? 'error' : (decision === 'approved' ? 'success' : 'warning')}
                                        variant={decision === 'approved' ? 'filled' : 'outlined'}
                                        sx={{ '@media print': { height: 26, fontSize: '0.9rem', fontWeight: 600 } }}
                                      />
                                    </TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 1, px: 1.5, fontSize: '1rem', border: '1px solid #000' } }}>{approvedAt ? formatDateForPrint(approvedAt) : '—'}</TableCell>
                                    <TableCell align="center" sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 0.6, px: 1, border: '1px solid #000' } }}>
                                      {decision === 'approved' && approver?.digitalSignature ? (
                                        <DigitalSignatureImage userOrPath={approver} alt={`${slot.label} signature`} sx={{ maxHeight: 56, maxWidth: 180, '@media print': { maxHeight: 52, maxWidth: 170 } }} />
                                      ) : decision === 'approved' ? (
                                        <Typography variant="caption" color="text.secondary" sx={{ '@media print': { fontSize: '0.9rem' } }}>No signature on file</Typography>
                                      ) : (
                                        <Typography variant="caption" color="text.secondary">—</Typography>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              });
                            })()}
                          </TableBody>
                        </Table>
                      </Box>
                    )}
                  </Paper>
                </Box>
              )}

              {/* ----------------- SECTION 1: INDENT ----------------- */}
              {(multiPrintMode ? (printSelection.indent && viewDialog.po?.indent) : viewDialog.poAuditTab === 1) && (
                <Box
                  sx={{
                    p: 2,
                    overflowX: 'auto',
                    '@media print': {
                      p: 0,
                      m: 0,
                      pageBreakAfter: 'always',
                      breakAfter: 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      height: '100%',
                      maxHeight: '100vh',
                      overflow: 'hidden'
                    }
                  }}
                >
                  {!viewDialog.po?.indent ? (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                      No indent linked with this Purchase Order.
                    </Typography>
                  ) : (
                    <Paper sx={{ p: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none', border: '1px solid', borderColor: 'divider', '@media print': { p: '12mm 15mm', border: 'none', maxWidth: '100%', mx: 0, pageBreakInside: 'avoid', breakInside: 'avoid' } }}>
                      <Typography variant="h5" fontWeight={700} align="center" sx={{ textTransform: 'uppercase', mb: 1, '@media print': { fontSize: '1.2rem', mb: 0.5 } }}>
                        Purchase Request Form
                      </Typography>
                      {viewDialog.po.indent.title && (
                        <Typography variant="h6" fontWeight={600} align="center" sx={{ mb: 1.5, '@media print': { fontSize: '0.95rem', mb: 1 } }}>
                          {viewDialog.po.indent.title}
                        </Typography>
                      )}
                      <Box sx={{ mb: 1, fontSize: '0.9rem', textAlign: 'center', '@media print': { fontSize: '0.8rem', mb: 0.5 } }}>
                        <Typography component="span" fontWeight={600}>ERP Ref:</Typography>
                        <Typography component="span" sx={{ ml: 1 }}>
                          {viewDialog.po.indent.erpRef || 'PR #' + (viewDialog.po.indent.indentNumber?.split('-').pop() || '')}
                        </Typography>
                      </Box>
                      <Box sx={{ mb: 1, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 4, '@media print': { fontSize: '0.78rem', mb: 0.8, gap: 2 } }}>
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
                      <Box sx={{ mb: 1.5, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 4, '@media print': { fontSize: '0.78rem', mb: 1, gap: 2 } }}>
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
                      <Box sx={{ mb: 2, '@media print': { mb: 1 } }}>
                        <Table size="small" sx={{ border: '1px solid', borderColor: 'divider' }}>
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'grey.100' }}>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.73rem' } }}>S#</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.73rem' } }}>Item Name</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.73rem' } }}>Description</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.73rem' } }}>Brand</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.73rem' } }}>Unit</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.73rem' } }} align="center">Qty</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.73rem' } }}>Purpose</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.73rem' } }} align="right">Est. Cost</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(viewDialog.po.indent.items || []).map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }} align="center">{idx + 1}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }}>{item.itemName || '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }}>{item.description || '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }}>{item.brand || '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }}>{item.unit || '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }} align="center">{item.quantity ?? '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }}>{item.purpose || '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider', '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }} align="right">{item.estimatedCost != null ? Number(item.estimatedCost).toFixed(2) : '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                      {viewDialog.po.indent.justification && (
                        <Box sx={{ mb: 1.5, '@media print': { mb: 1 } }}>
                          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5, '@media print': { fontSize: '0.78rem' } }}>Justification:</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, '@media print': { fontSize: '0.72rem', p: 0.5 } }}>
                            {viewDialog.po.indent.justification}
                          </Typography>
                        </Box>
                      )}
                      {Array.isArray(viewDialog.po.indent.approvalChain) && viewDialog.po.indent.approvalChain.length > 0 && (
                        <Box sx={{ mt: 2, '@media print': { mt: 1, pageBreakInside: 'avoid', breakInside: 'avoid' } }}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, '@media print': { fontSize: '0.8rem', mb: 0.5 } }}>
                            Indent approval progress
                          </Typography>
                          <Table size="small" sx={{ border: '1px solid', borderColor: 'divider', maxWidth: 760 }}>
                            <TableHead>
                              <TableRow sx={{ bgcolor: 'action.hover' }}>
                                <TableCell sx={{ fontWeight: 700, '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }}>Approver</TableCell>
                                <TableCell sx={{ fontWeight: 700, '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 700, '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }}>Date &amp; time</TableCell>
                                <TableCell sx={{ fontWeight: 700, '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }} align="center">Digital signature</TableCell>
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
                                    <TableCell sx={{ '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }}>{name}</TableCell>
                                    <TableCell sx={{ '@media print': { py: 0.3, px: 0.5 } }}>
                                      <Chip size="small" label={chipLabel} color={chipColor} variant={status === 'pending' ? 'outlined' : 'filled'} sx={{ '@media print': { height: 20, fontSize: '0.65rem' } }} />
                                    </TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap', '@media print': { py: 0.4, px: 0.6, fontSize: '0.7rem' } }}>{step?.actedAt ? formatDateForPrint(step.actedAt) : '—'}</TableCell>
                                    <TableCell align="center" sx={{ '@media print': { py: 0.2, px: 0.4 } }}>
                                      {status === 'approved' && approver?.digitalSignature ? (
                                        <DigitalSignatureImage userOrPath={approver} alt={`Signature ${name}`} sx={{ maxHeight: 36, maxWidth: 120, '@media print': { maxHeight: 32, maxWidth: 100 } }} />
                                      ) : status === 'approved' ? (
                                        <Typography variant="caption" color="text.secondary" sx={{ '@media print': { fontSize: '0.65rem' } }}>No signature on file</Typography>
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

              {/* ----------------- SECTION 2: PURCHASE ORDER ----------------- */}
              {(multiPrintMode ? (printSelection.po && viewDialog.po) : viewDialog.poAuditTab === 2) && (
                <Box
                  sx={{
                    p: 2,
                    '@media print': {
                      p: 0,
                      m: 0,
                      pageBreakAfter: 'always',
                      breakAfter: 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      height: '100%',
                      maxHeight: '100vh',
                      overflow: 'hidden'
                    }
                  }}
                >
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
                          p: '10mm 15mm',
                          maxWidth: '100%',
                          backgroundColor: '#fff',
                          mx: 0,
                          width: '100%',
                          pageBreakInside: 'avoid',
                          breakInside: 'avoid'
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
                          mb: 2,
                          fontSize: { xs: '1.8rem', print: '1.4rem' },
                          letterSpacing: 1
                        }}
                      >
                        Purchase Order
                      </Typography>

                      {/* Buyer Information */}
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5, fontSize: '1rem', '@media print': { fontSize: '0.9rem' } }}>
                          Residencia
                        </Typography>
                        <Typography sx={{ fontSize: '0.85rem', mb: 0.2, '@media print': { fontSize: '0.75rem' } }}>
                          1st Avenue 18 4 Islamabad
                        </Typography>
                        <Typography sx={{ fontSize: '0.85rem', '@media print': { fontSize: '0.75rem' } }}>
                          1. Het Sne 1-8. Islamabad.
                        </Typography>
                      </Box>

                      <Divider sx={{ my: 1.5, borderWidth: 1, borderColor: '#ccc', '@media print': { my: 1 } }} />

                      {/* Vendor and PO Details */}
                      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', gap: 2, '@media print': { mb: 1.5 } }}>
                        <Box sx={{ width: '48%', fontSize: '0.85rem', '@media print': { fontSize: '0.75rem' } }}>
                          <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5, fontSize: '0.95rem', '@media print': { fontSize: '0.85rem' } }}>
                            {viewDialog.po.vendor?.name || 'Vendor Name'}
                          </Typography>
                          <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.4, mb: 1, '@media print': { fontSize: '0.75rem' } }}>
                            {viewDialog.po.vendor?.address || 'Vendor Address'}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', lineHeight: 1.4 }}>
                            <Typography component="span" sx={{ fontWeight: 600, mr: 0.5 }}>Indent Details:</Typography>
                            <Typography component="span">
                              Indent# {viewDialog.po.indent?.indentNumber || 'N/A'} Dated. {viewDialog.po.indent?.requestedDate ? formatDateForPrint(viewDialog.po.indent.requestedDate) : 'N/A'}.
                              {viewDialog.po.indent?.title && ` ${viewDialog.po.indent.title}.`}
                              {viewDialog.po.indent?.requestedBy && ` End User. ${viewDialog.po.indent.requestedBy.firstName || ''} ${viewDialog.po.indent.requestedBy.lastName || ''}`}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ width: '48%', fontSize: '0.85rem', lineHeight: 1.6, '@media print': { fontSize: '0.75rem', lineHeight: 1.4 } }}>
                          <Box sx={{ display: 'flex', mb: 0.2 }}>
                            <Typography component="span" sx={{ minWidth: '120px', fontWeight: 600 }}>P.O No.:</Typography>
                            <Typography component="span">
                              {viewDialog.po.orderNumber ? 
                                (viewDialog.po.orderNumber.startsWith('P') && !viewDialog.po.orderNumber.includes('-')
                                  ? viewDialog.po.orderNumber
                                  : 'P' + (viewDialog.po.orderNumber.match(/\d+$/)?.[0] || viewDialog.po.orderNumber.split('-').pop() || '').padStart(9, '0'))
                                : 'N/A'}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', mb: 0.2 }}>
                            <Typography component="span" sx={{ minWidth: '120px', fontWeight: 600 }}>Date:</Typography>
                            <Typography component="span">{formatDateForPrint(viewDialog.po.orderDate)}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', mb: 0.2 }}>
                            <Typography component="span" sx={{ minWidth: '120px', fontWeight: 600 }}>Delivery Date:</Typography>
                            <Typography component="span">{viewDialog.po.expectedDeliveryDate ? formatDateForPrint(viewDialog.po.expectedDeliveryDate) : '___________'}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', mb: 0.2 }}>
                            <Typography component="span" sx={{ minWidth: '120px', fontWeight: 600 }}>Delivery Address:</Typography>
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
                          <Box sx={{ display: 'flex', mb: 0.2 }}>
                            <Typography component="span" sx={{ minWidth: '120px', fontWeight: 600 }}>Cost Center:</Typography>
                            <Typography component="span">{viewDialog.po.indent?.department?.name || viewDialog.po.indent?.department || '___________'}</Typography>
                          </Box>
                        </Box>
                      </Box>

                      {/* Items Table */}
                      <Box sx={{ mb: 1.5, '@media print': { mb: 1 } }}>
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            border: '1px solid #000',
                            fontSize: '0.8rem',
                            fontFamily: 'Arial, sans-serif'
                          }}
                        >
                          <thead>
                            <tr style={{ backgroundColor: '#f5f5f5', border: '1px solid #000' }}>
                              <th style={{ border: '1px solid #000', padding: '6px 5px', fontWeight: 700, textAlign: 'center', width: '5%' }}>Sr no</th>
                              <th style={{ border: '1px solid #000', padding: '6px 5px', fontWeight: 700, textAlign: 'left', width: '11%' }}>Product</th>
                              <th style={{ border: '1px solid #000', padding: '6px 5px', fontWeight: 700, textAlign: 'left', width: '23%' }}>Description</th>
                              <th style={{ border: '1px solid #000', padding: '6px 5px', fontWeight: 700, textAlign: 'left', width: '14%' }}>Specification</th>
                              <th style={{ border: '1px solid #000', padding: '6px 5px', fontWeight: 700, textAlign: 'left', width: '11%' }}>Brand</th>
                              <th style={{ border: '1px solid #000', padding: '6px 5px', fontWeight: 700, textAlign: 'center', width: '11%' }}>Quantity Unit</th>
                              <th style={{ border: '1px solid #000', padding: '6px 5px', fontWeight: 700, textAlign: 'right', width: '11%' }}>Rate</th>
                              <th style={{ border: '1px solid #000', padding: '6px 5px', fontWeight: 700, textAlign: 'right', width: '11%' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewDialog.po.items && viewDialog.po.items.length > 0 ? (
                              viewDialog.po.items.map((item, index) => (
                                <tr key={index} style={{ border: '1px solid #000' }}>
                                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', verticalAlign: 'top' }}>{index + 1}</td>
                                  <td style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'top' }}>
                                    {item.productCode || viewDialog.po.indent?.items?.[index]?.itemCode || `44-001-${String(index + 1).padStart(4, '0')}`}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'top' }}>
                                    {item.itemName || item.description || viewDialog.po.indent?.items?.[index]?.itemName || '___________'}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'top' }}>
                                    {(() => {
                                      if (item.specification && String(item.specification).trim()) return item.specification.trim();
                                      const indentItem = viewDialog.po.indent?.items?.[index];
                                      if (indentItem?.specification && String(indentItem.specification).trim()) return indentItem.specification.trim();
                                      if (indentItem?.description && String(indentItem.description).trim()) return indentItem.description.trim();
                                      if (indentItem?.purpose && String(indentItem.purpose).trim()) return indentItem.purpose.trim();
                                      return '___________';
                                    })()}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '5px 4px', verticalAlign: 'top' }}>
                                    {item.brand || viewDialog.po.indent?.items?.[index]?.brand || '___________'}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                                    {item.quantity ? `${Number(item.quantity).toLocaleString()} ${item.unit || 'Nos'}` : '___________'}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right', verticalAlign: 'top' }}>
                                    {item.unitPrice ? Number(item.unitPrice).toLocaleString() : '___________'}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right', verticalAlign: 'top' }}>
                                    {item.totalPrice || item.amount ? Number(item.totalPrice || item.amount).toLocaleString() : '___________'}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={8} style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center' }}>
                                  No items
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </Box>

                      {/* Financial Summary */}
                      <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'flex-end', '@media print': { mb: 1 } }}>
                        <Box sx={{ width: '280px', fontSize: '0.82rem', '@media print': { fontSize: '0.74rem' } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                            <Typography component="span" fontWeight={600} sx={{ fontSize: 'inherit' }}>Total (Rupees):</Typography>
                            <Typography component="span" sx={{ fontSize: 'inherit' }}>{Number(viewDialog.po.totalAmount || 0).toLocaleString()}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                            <Typography component="span" fontWeight={600} sx={{ fontSize: 'inherit' }}>Net Total:</Typography>
                            <Typography component="span" sx={{ fontSize: 'inherit' }}>{Number(viewDialog.po.totalAmount || 0).toLocaleString()}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography component="span" fontWeight={600} sx={{ fontSize: 'inherit' }}>Freight Charges:</Typography>
                            <Typography component="span" sx={{ fontSize: 'inherit' }}>{Number(viewDialog.po.shippingCost || 0).toLocaleString()}</Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, fontStyle: 'italic', '@media print': { fontSize: '0.7rem' } }}>
                            Rupees {numberToWords(viewDialog.po.totalAmount || 0)}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Terms & Conditions */}
                      <Box sx={{ mb: 1.5, border: '1px solid #ccc', p: 1.2, fontSize: '0.8rem', '@media print': { p: 0.8, mb: 1, fontSize: '0.72rem' } }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5, textDecoration: 'underline', '@media print': { fontSize: '0.75rem' } }}>
                          TERMS &amp; CONDITIONS
                        </Typography>
                        <Box sx={{ lineHeight: 1.4 }}>
                          <Box sx={{ mb: 0.3 }}>
                            <Typography component="span" fontWeight={600} sx={{ fontSize: 'inherit' }}>Payment Terms:</Typography>
                            <Typography component="span" sx={{ ml: 0.5, fontSize: 'inherit' }}>
                              {viewDialog.po.paymentTerms || '100% Advance Payment'}
                            </Typography>
                          </Box>
                          <Box sx={{ mb: 0.3 }}>
                            <Typography component="span" fontWeight={600} sx={{ fontSize: 'inherit' }}>Delivery Terms:</Typography>
                            <Typography component="span" sx={{ ml: 0.5, fontSize: 'inherit' }}>
                              At-Site Delivery
                            </Typography>
                          </Box>
                          <Box sx={{ mb: 0.3 }}>
                            <Typography component="span" fontWeight={600} sx={{ fontSize: 'inherit' }}>Delivery Time.</Typography>
                            <Typography component="span" sx={{ ml: 0.5, fontSize: 'inherit' }}>
                              Delivery within: {viewDialog.po.quotation?.deliveryTime || '03 days'} of confirmed PO &amp; Payment
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: 'inherit' }}>
                            Rates Are Exclusive Of all The Taxes {viewDialog.po.vendor?.cnic ? `| CNIC: ${viewDialog.po.vendor.cnic}` : ''} {viewDialog.po.vendor?.payeeName ? `| Payee: ${viewDialog.po.vendor.payeeName}` : ''}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Approval Authorities Table */}
                      <Typography variant="subtitle2" fontWeight={700} mb={0.5} sx={{ textAlign: 'center', '@media print': { fontSize: '0.78rem' } }}>
                        APPROVAL AUTHORITIES
                      </Typography>
                      <TableContainer component={Box} sx={{ border: '1px solid #ccc', mb: 1, '@media print': { pageBreakInside: 'avoid', breakInside: 'avoid' } }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                              <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700, '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }}>Authority</TableCell>
                              <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700, '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }}>Name</TableCell>
                              <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700, textAlign: 'center', '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }}>Digital Signature</TableCell>
                              <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700, '@media print': { py: 0.4, px: 0.6, fontSize: '0.72rem' } }}>Date &amp; Time</TableCell>
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
                                    <TableCell sx={{ border: '1px solid #ccc', fontWeight: 600, '@media print': { py: 0.3, px: 0.6, fontSize: '0.7rem' } }}>{row.label}</TableCell>
                                    <TableCell sx={{ border: '1px solid #ccc', '@media print': { py: 0.3, px: 0.6, fontSize: '0.7rem' } }}>{displayAuthorityName}</TableCell>
                                    <TableCell sx={{ border: '1px solid #ccc', textAlign: 'center', '@media print': { py: 0.2, px: 0.4 } }}>
                                      {authorityUser?.digitalSignature ? (
                                        <DigitalSignatureImage userOrPath={authorityUser} alt={`${row.label} signature`} sx={{ maxHeight: 32, maxWidth: 100, '@media print': { maxHeight: 28, maxWidth: 90 } }} />
                                      ) : (
                                        <Typography variant="caption" color="text.secondary" sx={{ '@media print': { fontSize: '0.65rem' } }}>—</Typography>
                                      )}
                                    </TableCell>
                                    <TableCell sx={{ border: '1px solid #ccc', '@media print': { py: 0.3, px: 0.6, fontSize: '0.68rem' } }}>
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

              {/* ----------------- SECTION 3: COMPARATIVE STATEMENT ----------------- */}
              {(multiPrintMode ? (printSelection.comparative && (viewDialog.poQuotations?.length > 0 || viewDialog.po?.indent?.comparativeApproval)) : viewDialog.poAuditTab === 3) && (
                <Box
                  sx={{
                    p: 2,
                    overflowX: 'auto',
                    '@media print': {
                      p: 0,
                      m: 0,
                      pageBreakAfter: 'always',
                      breakAfter: 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid'
                    }
                  }}
                >
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

              {/* ----------------- SECTION 4: QUOTATIONS ----------------- */}
              {(multiPrintMode ? (printSelection.quotations && viewDialog.poQuotations?.length > 0) : viewDialog.poAuditTab === 4) && (
                <Box
                  sx={{
                    p: 2,
                    '@media print': {
                      p: 0,
                      m: 0,
                      pageBreakAfter: 'always',
                      breakAfter: 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid'
                    }
                  }}
                >
                  {(!viewDialog.poQuotations || viewDialog.poQuotations.length === 0) ? (
                    <Typography color="text.secondary">No quotations linked with this PO.</Typography>
                  ) : (
                    <Stack spacing={4}>
                      {viewDialog.poQuotations.map((q) => (
                        <Box key={q._id} sx={{ '@media print': { pageBreakAfter: 'always', breakAfter: 'page', pageBreakInside: 'avoid', breakInside: 'avoid' } }}>
                          <QuotationDetailView
                            quotation={q}
                            formatNumber={(n) => Number(n || 0).toLocaleString()}
                            formatDateForPrint={formatDateForPrint}
                          />
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}

              {/* ----------------- SECTION 5: GRNS ----------------- */}
              {(multiPrintMode ? (printSelection.grns && viewDialog.poGrns?.length > 0) : viewDialog.poAuditTab === 5) && (
                <Box
                  sx={{
                    p: 2,
                    '@media print': {
                      p: 0,
                      m: 0,
                      pageBreakAfter: 'always',
                      breakAfter: 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid'
                    }
                  }}
                >
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

              {/* ----------------- SECTION 6: VENDOR BILLS ----------------- */}
              {(multiPrintMode ? (printSelection.bills && viewDialog.poBills?.length > 0) : viewDialog.poAuditTab === 6) && (
                <Box
                  sx={{
                    p: 2,
                    '@media print': {
                      p: 0,
                      m: 0,
                      pageBreakAfter: 'always',
                      breakAfter: 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid'
                    }
                  }}
                >
                  {(!viewDialog.poBills || viewDialog.poBills.length === 0) ? (
                    <Typography color="text.secondary">No vendor bills attached.</Typography>
                  ) : (
                    <Stack spacing={4}>
                      {viewDialog.poBills.map((b) => {
                        const getApprovalRows = () => {
                          const formatDateTime = (date) => {
                            if (!date) return '-';
                            return new Date(date).toLocaleString('en-PK', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            });
                          };

                          const userDisplayName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.name || '-';
                          const history = Array.isArray(b.workflowHistory) ? [...b.workflowHistory].reverse() : [];
                          const preAuditEntry = history.find(e => e.toStatus === 'Forwarded to Audit Director' || e.toStatus === 'initial audit approval' || e.toStatus?.includes('Pre-Audit'));
                          const directorEntry = history.find(e => e.toStatus === 'approved' || e.toStatus === 'Approved' || e.toStatus?.includes('Audit Director'));

                          const rows = [
                            {
                              authority: 'Sig of Requester',
                              name: userDisplayName(b.createdBy),
                              signatureUser: b.createdBy,
                              dateTime: b.createdAt ? formatDateTime(b.createdAt) : '-'
                            },
                            {
                              authority: 'Pre-Audit Authority',
                              name: userDisplayName(preAuditEntry?.changedBy),
                              signatureUser: preAuditEntry?.changedBy || null,
                              dateTime: preAuditEntry?.changedAt ? formatDateTime(preAuditEntry.changedAt) : '-'
                            },
                            {
                              authority: 'Audit Director',
                              name: userDisplayName(directorEntry?.changedBy),
                              signatureUser: directorEntry?.changedBy || null,
                              signaturePath: directorEntry?.stampUsed && directorEntry?.stampImage ? directorEntry.stampImage : directorEntry?.changedBy?.digitalSignature || '',
                              dateTime: directorEntry?.changedAt ? formatDateTime(directorEntry.changedAt) : '-'
                            }
                          ];
                          return rows;
                        };

                        const getSignatureSource = (row) => row?.signaturePath || row?.signatureUser?.digitalSignature || '';

                        return (
                          <Box key={b._id} sx={{ '@media print': { pageBreakAfter: 'always', breakAfter: 'page', pageBreakInside: 'avoid', breakInside: 'avoid' } }}>
                            <Paper sx={{ p: { xs: 2.5, sm: 3 }, border: '1px solid #ccc', '@media print': { p: '10mm 14mm', border: 'none' } }}>
                              <CentralizedStoreBillInvoiceBody
                                bill={{
                                  ...b,
                                  billId: b.billNumber,
                                  billDate: b.billDate,
                                  createdAt: b.createdAt || b.billDate,
                                  provider: b.vendorName || b.vendor?.name,
                                  location: b.company || b.vendor?.address?.city || b.department || 'N/A',
                                  notes: b.notes || b.internalNotes,
                                  forWhat: b.forWhat || b.notes,
                                  billLines: (b.lineItems && b.lineItems.length > 0)
                                    ? b.lineItems.map((line, idx) => ({
                                        ...line,
                                        category: line.category || line.accountName || line.account?.name || (line.accountNumber ? `Account ${line.accountNumber}` : '—'),
                                        accountName: line.accountName || line.account?.name || '',
                                        accountNumber: line.accountNumber || line.account?.accountNumber || '',
                                        itemName: line.description || line.itemName || (line.accountNumber ? `Account ${line.accountNumber}` : 'Item'),
                                        description: line.description || line.itemName || '',
                                        itemCode: line.itemCode || line.accountNumber || '—',
                                        amount: line.amount || (line.quantity * line.unitPrice),
                                        attachments: idx === 0 && b.attachments?.length ? b.attachments.map(a => ({ url: a.path || a.filename, originalName: a.originalName })) : undefined
                                      }))
                                    : (b.billLines || [])
                                }}
                                showChargesSummary={true}
                              />

                              {/* Approval Authority Table */}
                              <Table
                                size="small"
                                sx={{
                                  mt: 3,
                                  mb: 1,
                                  border: '1px solid',
                                  borderColor: 'grey.300',
                                  '& th': {
                                    bgcolor: 'grey.100',
                                    fontWeight: 800,
                                    fontSize: 13,
                                    borderBottom: '1px solid',
                                    borderColor: 'grey.300'
                                  },
                                  '& td': {
                                    fontSize: 13,
                                    borderBottom: '1px solid',
                                    borderColor: 'grey.200',
                                    py: 1.2
                                  },
                                  '& tr:last-child td': {
                                    borderBottom: 0
                                  }
                                }}
                              >
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Authority</TableCell>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Digital Signature</TableCell>
                                    <TableCell>Date &amp; Time</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {getApprovalRows().map((row) => (
                                    <TableRow key={row.authority}>
                                      <TableCell sx={{ fontWeight: 800 }}>{row.authority}</TableCell>
                                      <TableCell>{row.name || '-'}</TableCell>
                                      <TableCell>
                                        {getSignatureSource(row) ? (
                                          <DigitalSignatureImage userOrPath={getSignatureSource(row)} alt={`${row.authority} signature`} />
                                        ) : (
                                          '-'
                                        )}
                                      </TableCell>
                                      <TableCell>{row.dateTime || '-'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </Paper>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </Box>
              )}

              {/* ----------------- SECTION 7: ATTACHED DOCUMENTS ----------------- */}
              {(!multiPrintMode && viewDialog.poAuditTab === 7) && (
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

      {/* Select Documents to Print Dialog */}
      <Dialog
        open={printSelectDialogOpen}
        onClose={() => setPrintSelectDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ChecklistIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>Select Documents to Print</Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose which documents from this voucher package to include in the single print job:
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={printSelection.voucher}
                  onChange={(e) => setPrintSelection((prev) => ({ ...prev, voucher: e.target.checked }))}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Voucher (General Ledger &amp; Lines)</Typography>
                  <Typography variant="caption" color="text.secondary">Voucher summary, accounting entries &amp; authorities</Typography>
                </Box>
              }
              sx={{ mb: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={printSelection.indent}
                  disabled={!viewDialog.po?.indent}
                  onChange={(e) => setPrintSelection((prev) => ({ ...prev, indent: e.target.checked }))}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Indent (Purchase Request Form)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {viewDialog.po?.indent ? `PR #${viewDialog.po.indent.indentNumber || ''}` : 'No indent linked'}
                  </Typography>
                </Box>
              }
              sx={{ mb: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={printSelection.po}
                  disabled={!viewDialog.po}
                  onChange={(e) => setPrintSelection((prev) => ({ ...prev, po: e.target.checked }))}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Purchase Order (PO)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {viewDialog.po ? `PO #${viewDialog.po.orderNumber || ''}` : 'No PO linked'}
                  </Typography>
                </Box>
              }
              sx={{ mb: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={printSelection.bills}
                  disabled={!viewDialog.poBills || viewDialog.poBills.length === 0}
                  onChange={(e) => setPrintSelection((prev) => ({ ...prev, bills: e.target.checked }))}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Vendor Bills ({viewDialog.poBills?.length || 0})</Typography>
                  <Typography variant="caption" color="text.secondary">Attached vendor bills &amp; line invoices</Typography>
                </Box>
              }
              sx={{ mb: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={printSelection.comparative}
                  disabled={!viewDialog.poQuotations?.length && !viewDialog.po?.indent?.comparativeApproval}
                  onChange={(e) => setPrintSelection((prev) => ({ ...prev, comparative: e.target.checked }))}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Comparative Statement</Typography>
                  <Typography variant="caption" color="text.secondary">Vendor rate comparison &amp; committee approvals</Typography>
                </Box>
              }
              sx={{ mb: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={printSelection.quotations}
                  disabled={!viewDialog.poQuotations || viewDialog.poQuotations.length === 0}
                  onChange={(e) => setPrintSelection((prev) => ({ ...prev, quotations: e.target.checked }))}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Quotations ({viewDialog.poQuotations?.length || 0})</Typography>
                  <Typography variant="caption" color="text.secondary">Official vendor quotation sheets</Typography>
                </Box>
              }
              sx={{ mb: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={printSelection.grns}
                  disabled={!viewDialog.poGrns || viewDialog.poGrns.length === 0}
                  onChange={(e) => setPrintSelection((prev) => ({ ...prev, grns: e.target.checked }))}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>GRN(s) ({viewDialog.poGrns?.length || 0})</Typography>
                  <Typography variant="caption" color="text.secondary">Goods Receipt Notes for delivered items</Typography>
                </Box>
              }
            />
          </FormGroup>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button onClick={() => setPrintSelectDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handleExecuteCustomPrint}
            disabled={!Object.values(printSelection).some(Boolean)}
          >
            Print Selected
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Vouchers;
