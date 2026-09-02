import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  alpha,
  useTheme,
  Avatar,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tabs,
  Tab,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  InputAdornment
} from '@mui/material';
import {
  AccountBalance as AccountBalanceIcon,
  ShoppingCart as ShoppingCartIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Payment as PaymentIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  History as HistoryIcon,
  Print as PrintIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import { fetchPayFromAccounts, formatPayFromAccountLabel } from '../../utils/payFromAccounts';
import toast from 'react-hot-toast';
import ComparativeStatementView from '../../components/Procurement/ComparativeStatementView';
import QuotationDetailView from '../../components/Procurement/QuotationDetailView';
import CentralizedStoreBillInvoiceBody from '../../components/UtilityBill/CentralizedStoreBillInvoiceBody';
import { DigitalSignatureImage } from '../../components/common/DigitalSignatureImage';
import NarrationTableCell from '../../components/common/NarrationTableCell';
import { getBillNarrationDisplay } from '../../utils/documentNarrationDisplay';
import { useAuth } from '../../contexts/AuthContext';
import FinanceApprovalAuthorityPicker from '../../components/Finance/FinanceApprovalAuthorityPicker';
import {
  buildFinanceApprovalAuthoritiesPayload,
  fetchFinanceAuthorityCandidates,
  validateFinanceAuthoritySelection
} from '../../services/financeApprovalAuthorityService';
import { useFinanceCompany } from '../../context/FinanceCompanyContext';
import FinanceCompanySelector from '../../components/Finance/FinanceCompanySelector';
import WorkflowHistoryDialog from '../../components/WorkflowHistoryDialog';
import QuickbooksPayBillsModal from '../../components/Finance/QuickbooksPayBillsModal';

const getBillPayeeEmployeeId = (bill) => {
  const pe = bill?.payeeEmployee;
  if (!pe) return '';
  if (typeof pe === 'object' && pe !== null) return String(pe._id || '');
  return String(pe);
};

const getBillPayeeEmployeeDisplayName = (bill) => {
  const pe = bill?.payeeEmployee;
  if (pe && typeof pe === 'object') {
    const name = [pe.firstName, pe.lastName].filter(Boolean).join(' ').trim();
    if (name) return name;
    if (pe.employeeId) return String(pe.employeeId);
  }
  return bill?.vendorName || bill?.vendor?.name || '';
};

const calculateAge = (date) => {
  if (!date) return 0;
  const today = new Date();
  const billDate = new Date(date);
  const diffTime = Math.abs(today - billDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let prev = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      const val = Math.min(row[j + 1] + 1, prev + 1, row[j] + cost);
      row[j] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
};

const matchesFuzzyToken = (token, corpus, words) => {
  if (!token) return true;
  // 1. Direct substring match in full corpus
  if (corpus.includes(token)) return true;

  // 2. Numeric / amount match without formatting
  const cleanDigits = token.replace(/[^0-9.]/g, '');
  if (cleanDigits && corpus.replace(/[^0-9.]/g, ' ').includes(cleanDigits)) {
    return true;
  }

  // 3. Typo-tolerant match against individual words (for words of length >= 5)
  if (token.length >= 5) {
    const maxDist = token.length <= 7 ? 1 : 2;
    for (const w of words) {
      if (w.length >= 5 && Math.abs(w.length - token.length) <= maxDist) {
        if (levenshtein(token, w) <= maxDist) return true;
      }
    }
  }

  return false;
};

const AccountsPayable = () => {
  const { selectedCompanyId } = useFinanceCompany();
  const { user: currentUser } = useAuth();
  const preparerUserId = String(currentUser?.id || currentUser?._id || '');
  const preparerDisplayName = [currentUser?.firstName, currentUser?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || currentUser?.email || 'Preparer';

  const getPaidAmount = (bill) => {
    // Backend responses are inconsistent: sometimes use `paidAmount`, sometimes `amountPaid`.
    const paid = bill?.paidAmount ?? bill?.amountPaid ?? 0;
    return Number(paid) || 0;
  };
  const getAdvanceAppliedAmount = (bill) => Number(bill?.advanceApplied || 0) || 0;
  const getSettledAmount = (bill) => {
    // Settlement on AP is cash/bank paid + vendor advance applied.
    return Math.round((getPaidAmount(bill) + getAdvanceAppliedAmount(bill)) * 100) / 100;
  };

  const getSettlementPending = (bill) =>
    Number(bill?.settlementPending ?? ((bill?.advancePending || 0) + (bill?.paymentPending || 0))) || 0;

  const canEditVendorBill = (bill) => {
    if (!bill) return false;
    if (['paid', 'partial', 'cancelled'].includes(bill.status)) return false;
    if (getSettledAmount(bill) > 0) return false;
    if (getSettlementPending(bill) > 0) return false;
    return true;
  };

  const getOutstanding = (bill) => {
    const total = Number(bill?.totalAmount || 0);
    const paid = getPaidAmount(bill);
    const adv = getAdvanceAppliedAmount(bill);
    // Unpaid balance before pending authority
    const actualUnpaid = Math.max(0, Math.round((total - paid - adv) * 100) / 100);
    if (bill?.outstandingAmount != null && Number(bill.outstandingAmount) >= 0) {
      return Number(bill.outstandingAmount);
    }
    const pending = getSettlementPending(bill);
    const afterPending = Math.max(0, Math.round((actualUnpaid - pending) * 100) / 100);
    // If afterPending is 0 but bill is not yet marked paid, fall back to actual unpaid so user can still view/settle
    return afterPending > 0 ? afterPending : (bill?.status !== 'paid' ? actualUnpaid : 0);
  };

  const getCashPaidAmount = (bill) => {
    const total = Number(bill?.totalAmount || 0);
    const adv = Number(bill?.advanceApplied || 0);
    const outstanding = getOutstanding(bill);
    const cashPaid = total - adv - outstanding;
    return Math.round((Number(cashPaid) || 0) * 100) / 100;
  };

  const roundPay2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  /** Distribute cash-approval usage to bills (selected bill first), then set bank payment per row. */
  const distributeCaUsageToBillRows = (totalCaUsage, billRows, seedBillId) => {
    let remaining = roundPay2(totalCaUsage);
    const ordered = [...billRows];
    if (seedBillId) {
      ordered.sort((a, b) => {
        if (String(a.billId) === String(seedBillId)) return -1;
        if (String(b.billId) === String(seedBillId)) return 1;
        return 0;
      });
    }
    const byId = new Map(
      ordered.map((row) => {
        const advanceApplyAmount = remaining <= 0 ? 0 : Math.min(Number(row.outstanding) || 0, remaining);
        remaining = roundPay2(remaining - advanceApplyAmount);
        const payAmount = roundPay2(Math.max(0, (Number(row.outstanding) || 0) - advanceApplyAmount));
        return [String(row.billId), { ...row, advanceApplyAmount, payAmount }];
      })
    );
    return billRows.map((row) => byId.get(String(row.billId)) || row);
  };

  const syncBillPaymentFromCaApply = (nextCaApplyAmounts, billRows, seedBillId) => {
    const totalCaUsage = roundPay2(
      payeeCashApprovals.reduce((s, ca) => s + (Number(nextCaApplyAmounts[ca.cashApprovalId]) || 0), 0)
    );
    const nextBills = distributeCaUsageToBillRows(totalCaUsage, billRows, seedBillId);
    const totalBank = roundPay2(nextBills.reduce((s, r) => s + (Number(r.payAmount) || 0), 0));
    setOutstandingTransactions(nextBills);
    setPaymentData((prev) => ({ ...prev, amount: totalBank }));
    return nextBills;
  };

  /**
   * Per-GRN paid in Linked Documents: sum cash payments allocated to each GRN when present;
   * spread any remaining settlement (e.g. vendor advance applied to the bill) across GRN
   * lines by their bill portion so advance-only settlement still shows correct Paid / %.
   */
  const getLinkedGrnSettlementRows = (bill) => {
    const linked = bill?.linkedGRNs || [];
    if (!linked.length) return [];

    const paidByGrn = {};
    (bill?.payments || []).forEach((p) => {
      (p?.allocations || []).forEach((a) => {
        const key = String(a?.grnId || '');
        if (!key) return;
        paidByGrn[key] = (paidByGrn[key] || 0) + (Number(a?.amount) || 0);
      });
    });

    const totalSettled = getSettledAmount(bill);
    const rows = linked.map((ln) => {
      const portion = Number(ln?.amount) || 0;
      const key = String(ln?.grnId || '');
      const fromAlloc = Math.min(portion, Number(paidByGrn[key] || 0));
      return { ln, portion, fromAlloc };
    });

    const sumAlloc = rows.reduce((s, r) => s + r.fromAlloc, 0);
    const remaining = Math.round((totalSettled - sumAlloc) * 100) / 100;
    const sumCap = rows.reduce((s, r) => s + Math.max(0, r.portion - r.fromAlloc), 0);

    return rows.map((r) => {
      let paid = r.fromAlloc;
      if (remaining > 0.01 && sumCap > 0) {
        const cap = Math.max(0, r.portion - r.fromAlloc);
        paid = Math.round((r.fromAlloc + (remaining * cap) / sumCap) * 100) / 100;
        paid = Math.min(r.portion, paid);
      }
      const remainingByGrn = Math.max(0, Math.round((r.portion - paid) * 100) / 100);
      const pct = r.portion > 0 ? Math.round((paid / r.portion) * 100) : 0;
      return { ln: r.ln, portion: r.portion, paid, remainingByGrn, pct };
    });
  };

  const navigate = useNavigate();
  const theme = useTheme();
  
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBill, setSelectedBill] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [workflowHistoryDialog, setWorkflowHistoryDialog] = useState({ open: false, document: null });
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [payBillsModalOpen, setPayBillsModalOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({
    billNumber: '',
    totalAmount: 0,
    billDate: '',
    dueDate: ''
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);
  const [deletingBill, setDeletingBill] = useState(false);

  const handleOpenDelete = (bill) => {
    setBillToDelete(bill);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!billToDelete) return;
    try {
      setDeletingBill(true);
      const res = await api.delete(`/finance/accounts-payable/${billToDelete._id}`);
      if (res.data?.success || res.status === 200) {
        toast.success(`✓ Bill ${billToDelete.billNumber} deleted successfully`);
        setDeleteDialogOpen(false);
        setBillToDelete(null);
        fetchAccountsPayable();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete bill');
    } finally {
      setDeletingBill(false);
    }
  };

  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'bank_transfer',
    reference: '',
    paymentDate: new Date().toISOString().split('T')[0]
  });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [posForBilling, setPosForBilling] = useState([]);
  const [loadingPosForBilling, setLoadingPosForBilling] = useState(false);
  const [createFromPoDialog, setCreateFromPoDialog] = useState({ open: false, po: null, billNumber: '', creating: false });
  const [billViewTab, setBillViewTab] = useState(0);
  const [expandedRows, setExpandedRows] = useState({});
  const [payeeVendors, setPayeeVendors] = useState([]);
  const [selectedPayee, setSelectedPayee] = useState({ vendorId: '', vendorName: '' });
  const [payeeType, setPayeeType] = useState('vendor');
  const [financeEmployees, setFinanceEmployees] = useState([]);
  const [selectedEmployeePayee, setSelectedEmployeePayee] = useState({
    employeeId: '',
    employeeName: '',
    employeeCode: ''
  });
  const [outstandingTransactions, setOutstandingTransactions] = useState([]);
  const [loadingOutstandingTransactions, setLoadingOutstandingTransactions] = useState(false);
  const [payeeCashApprovals, setPayeeCashApprovals] = useState([]);
  const [loadingPayeeCashApprovals, setLoadingPayeeCashApprovals] = useState(false);
  const [payeeVendorAdvances, setPayeeVendorAdvances] = useState([]);
  const [caApplyAmounts, setCaApplyAmounts] = useState({});
  const [processingCaApply, setProcessingCaApply] = useState(false);
  const [financeAuthorityCandidates, setFinanceAuthorityCandidates] = useState([]);
  const [billPaymentFinAuth, setBillPaymentFinAuth] = useState({
    accountsManagerUser: null,
    financeControllerUser: null
  });
  const [filters, setFilters] = useState({
    status: 'unpaid',
    vendor: '',
    startDate: new Date(new Date().getFullYear(), 6, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    search: '',
    billType: ''
  });
  const [searchInput, setSearchInput] = useState('');
  const [vendorInput, setVendorInput] = useState('');

  // Debounce search input into filters.search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => {
        if (prev.search === searchInput) return prev;
        return { ...prev, search: searchInput };
      });
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Debounce vendor input into filters.vendor
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => {
        if (prev.vendor === vendorInput) return prev;
        return { ...prev, vendor: vendorInput };
      });
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [vendorInput]);

  const getBillTypeBadge = (bill) => {
    if (bill.referenceType === 'utility_bill' || bill.module === 'taj_utilities') {
      return (
        <Chip
          label="Centralized Store"
          size="small"
          color="secondary"
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: '0.72rem' }}
        />
      );
    }
    if (bill.referenceType === 'purchase_order' || bill.referenceType === 'grn') {
      return (
        <Chip
          label="PO / GRN"
          size="small"
          color="info"
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: '0.72rem' }}
        />
      );
    }
    return (
      <Chip
        label="Chart of Accounts"
        size="small"
        color="primary"
        variant="outlined"
        sx={{ fontWeight: 600, fontSize: '0.72rem' }}
      />
    );
  };

  const getBillCompany = (bill) => {
    if (bill.company && typeof bill.company === 'string' && bill.company.trim()) return bill.company;
    if (bill.lineItems && Array.isArray(bill.lineItems)) {
      const lineWithComp = bill.lineItems.find((l) => l.company && typeof l.company === 'string' && l.company.trim());
      if (lineWithComp) return lineWithComp.company;
    }
    if (bill.companyId && typeof bill.companyId === 'object' && bill.companyId.name) return bill.companyId.name;
    return '—';
  };

  const getBillProject = (bill) => {
    if (bill.project && typeof bill.project === 'string' && bill.project.trim()) return bill.project;
    if (bill.lineItems && Array.isArray(bill.lineItems)) {
      const lineWithProj = bill.lineItems.find((l) => l.project && typeof l.project === 'string' && l.project.trim());
      if (lineWithProj) return lineWithProj.project;
    }
    return '—';
  };

  const getBillSearchCorpus = useCallback((bill) => {
    const parts = [];
    // Bill # & Vendor Invoice #
    if (bill.billNumber) parts.push(String(bill.billNumber));
    if (bill.vendorInvoiceNumber) parts.push(String(bill.vendorInvoiceNumber));

    // Bill Type
    if (bill.referenceType === 'utility_bill' || bill.module === 'taj_utilities') {
      parts.push('centralized store utility bill');
    } else if (bill.referenceType === 'purchase_order' || bill.referenceType === 'grn') {
      parts.push('purchase order po grn');
    } else {
      parts.push('chart of accounts coa manual finance');
    }

    // Vendor / Payee
    if (bill.vendorName) parts.push(String(bill.vendorName));
    if (bill.vendor?.name) parts.push(String(bill.vendor.name));
    if (bill.vendorEmail) parts.push(String(bill.vendorEmail));
    if (bill.vendor?.email) parts.push(String(bill.vendor.email));
    const payeeEmp = getBillPayeeEmployeeDisplayName(bill);
    if (payeeEmp) parts.push(payeeEmp);
    if (bill.payeeEmployee?.employeeId) parts.push(String(bill.payeeEmployee.employeeId));

    // Company & Project
    const comp = getBillCompany(bill);
    if (comp && comp !== '—') parts.push(comp);
    const proj = getBillProject(bill);
    if (proj && proj !== '—') parts.push(proj);

    // Narration / Description (all variants)
    const narration = getBillNarrationDisplay(bill);
    if (narration && narration !== '—') parts.push(narration);
    if (bill.notes) parts.push(String(bill.notes));
    if (bill.internalNotes) parts.push(String(bill.internalNotes));
    if (bill.forWhat) parts.push(String(bill.forWhat));
    if (bill.description) parts.push(String(bill.description));
    if (Array.isArray(bill.lineItems)) {
      bill.lineItems.forEach((li) => {
        if (li.description) parts.push(String(li.description));
        if (li.itemName) parts.push(String(li.itemName));
        if (li.company) parts.push(String(li.company));
        if (li.project) parts.push(String(li.project));
      });
    }

    // Dates
    if (bill.billDate) {
      parts.push(formatDate(bill.billDate));
      parts.push(String(bill.billDate));
    }
    if (bill.dueDate) {
      parts.push(formatDate(bill.dueDate));
      parts.push(String(bill.dueDate));
    }

    // Amounts: Total Amount, Paid, Outstanding
    const total = Number(bill.totalAmount || 0);
    const paid = getSettledAmount(bill);
    const outstanding = getOutstanding(bill);
    parts.push(String(total));
    parts.push(formatPKR(total));
    parts.push(String(Math.round(total)));
    parts.push(String(paid));
    parts.push(formatPKR(paid));
    parts.push(String(Math.round(paid)));
    parts.push(String(outstanding));
    parts.push(formatPKR(outstanding));
    parts.push(String(Math.round(outstanding)));

    // Status & approvals
    if (bill.status) parts.push(String(bill.status));
    if (getSettlementPending(bill) > 0) parts.push('pending approval');

    // Aging
    const days = calculateAge(bill.billDate);
    parts.push(`${days} days`);

    // Linked GRNs & POs
    if (Array.isArray(bill.linkedGRNs)) {
      bill.linkedGRNs.forEach((g) => {
        if (g.grnNumber) parts.push(String(g.grnNumber));
        if (g.poNumber) parts.push(String(g.poNumber));
      });
    }

    const fullText = parts.join(' ').toLowerCase();
    const words = fullText.split(/[\s,/;:\-–—_()[\]{}]+/).filter(Boolean);
    return { fullText, words };
  }, []);

  const filteredBills = useMemo(() => {
    let list = bills;

    if (filters.billType) {
      list = list.filter((b) => {
        if (filters.billType === 'store') return b.referenceType === 'utility_bill' || b.module === 'taj_utilities';
        if (filters.billType === 'category') return b.referenceType === 'manual' || b.module === 'finance' || (!b.referenceType && b.lineItems?.length > 0);
        if (filters.billType === 'po') return b.referenceType === 'purchase_order' || b.referenceType === 'grn';
        return true;
      });
    }

    const query = (searchInput || '').trim().toLowerCase();
    if (!query) return list;

    const tokens = query.split(/\s+/).filter(Boolean);
    if (!tokens.length) return list;

    return list.filter((bill) => {
      const { fullText, words } = getBillSearchCorpus(bill);
      return tokens.every((token) => matchesFuzzyToken(token, fullText, words));
    });
  }, [bills, filters.billType, searchInput, getBillSearchCorpus]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 100
  });
  const [summary, setSummary] = useState({
    totalOutstanding: 0,
    totalOverdue: 0,
    totalPaid: 0,
    totalBills: 0
  });

  useEffect(() => {
    if (!paymentDialogOpen) return;
    let cancelled = false;
    fetchFinanceAuthorityCandidates()
      .then((list) => {
        if (!cancelled) setFinanceAuthorityCandidates(list);
      })
      .catch(() => {
        if (!cancelled) setFinanceAuthorityCandidates([]);
      });
    return () => { cancelled = true; };
  }, [paymentDialogOpen]);

  // Load bank/cash accounts from chart of accounts (includes subaccounts under pay-from parents)
  useEffect(() => {
    if (!selectedCompanyId) return;
    fetchPayFromAccounts(api, { companyId: selectedCompanyId })
      .then(setBankAccounts)
      .catch(() => setBankAccounts([]));
  }, [selectedCompanyId]);

  useEffect(() => {
    api.get('/procurement/vendors', { params: { limit: 1000 } })
      .then((res) => {
        const vendors = res.data?.data?.vendors || [];
        setPayeeVendors(vendors.map((v) => ({
          vendorId: String(v?._id || ''),
          vendorName: v?.name || 'Unknown Vendor'
        })));
      })
      .catch(() => setPayeeVendors([]));
  }, []);

  useEffect(() => {
    api.get('/finance/employees', { params: { limit: 500 } })
      .then((res) => {
        const rows = res.data?.data?.employees || [];
        setFinanceEmployees(
          rows.map((e) => ({
            employeeId: String(e._id),
            employeeCode: e.employeeId || '',
            employeeName:
              [e.firstName, e.lastName].filter(Boolean).join(' ').trim() ||
              e.employeeId ||
              'Employee'
          }))
        );
      })
      .catch(() => setFinanceEmployees([]));
  }, []);

  const fetchPosForBilling = async () => {
    try {
      setLoadingPosForBilling(true);
      const res = await api.get('/finance/accounts-payable/pos-for-billing');
      if (res.data?.success) setPosForBilling(res.data.data || []);
    } catch (e) {
      setPosForBilling([]);
    } finally {
      setLoadingPosForBilling(false);
    }
  };
  useEffect(() => { fetchPosForBilling(); }, [viewDialogOpen]);

  const fetchAccountsPayable = useCallback(async () => {
    if (!selectedCompanyId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.vendor) params.append('vendor', filters.vendor);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.search) params.append('search', filters.search);
      params.append('page', pagination.currentPage);
      params.append('limit', pagination.limit);
      params.append('companyId', selectedCompanyId);
      params.append('_t', new Date().getTime());

      const response = await api.get(`/finance/accounts-payable?${params}`, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (response.data.success) {
        setBills(response.data.data.bills || []);
        setPagination(prev => ({
          ...prev,
          ...response.data.data.pagination
        }));
        setSummary(response.data.data.summary || {
          totalOutstanding: 0,
          totalOverdue: 0,
          totalPaid: 0,
          totalBills: 0
        });
      }
    } catch (error) {
      console.error('Error fetching accounts payable:', error);
      setError('Failed to fetch accounts payable data');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [filters, pagination.currentPage, pagination.limit, selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setLoading(false);
      setInitialLoading(false);
      return;
    }
    fetchAccountsPayable();
  }, [fetchAccountsPayable, selectedCompanyId]);

  const handleFilterChange = (field) => (event) => {
    setFilters(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handlePageChange = (event, newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage + 1 }));
  };

  const handleRowsPerPageChange = (event) => {
    setPagination(prev => ({
      ...prev,
      limit: parseInt(event.target.value, 10),
      currentPage: 1
    }));
  };

  const handleViewBill = async (bill) => {
    try {
      setLoading(true);
      setBillViewTab(0);
      const response = await api.get(`/finance/accounts-payable/${bill._id}`);
      if (response.data.success) {
        const b = response.data.data;
        setSelectedBill(b);
        setViewDialogOpen(true);
      }
    } catch (error) {
      console.error('Error fetching bill details:', error);
      toast.error('Failed to fetch bill details');
    } finally {
      setLoading(false);
    }
  };

  const mapOutstandingBillRows = (allBills, seedBillId) => {
    const rows = allBills
      .map((b) => {
        const outstanding = Math.max(0, getOutstanding(b));
        return {
          billId: b._id,
          billNumber: b.billNumber,
          billDate: b.billDate,
          dueDate: b.dueDate,
          totalAmount: Number(b.totalAmount || 0),
          company: b.company || 'Unassigned',
          outstanding,
          payAmount: seedBillId && String(b._id) === String(seedBillId) ? outstanding : 0,
          advanceApplyAmount: 0
        };
      })
      .filter((r) => r.outstanding > 0);
    const totalPay = Math.round(rows.reduce((s, r) => s + (Number(r.payAmount) || 0), 0) * 100) / 100;
    setOutstandingTransactions(rows);
    setPaymentData((prev) => ({ ...prev, amount: totalPay }));
    return rows;
  };

  const loadPayeeCashApprovals = async (
    type = payeeType,
    employeeId = selectedEmployeePayee.employeeId,
    vendorId = selectedPayee.vendorId,
    employeeCode = selectedEmployeePayee.employeeCode
  ) => {
    const isEmployee = type === 'employee';
    if (isEmployee && !employeeId && !employeeCode) {
      setPayeeCashApprovals([]);
      return;
    }
    if (!isEmployee && !vendorId) {
      setPayeeCashApprovals([]);
      return;
    }
    try {
      setLoadingPayeeCashApprovals(true);
      const params = isEmployee
        ? { employeeId: employeeId || undefined, employeeCode: employeeCode || undefined }
        : { vendorId };
      const res = await api.get('/finance/accounts-payable/payee-cash-approvals', { params });
      setPayeeCashApprovals(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setPayeeCashApprovals([]);
    } finally {
      setLoadingPayeeCashApprovals(false);
    }
  };

  const loadPayeeVendorAdvances = async (vendorId, vendorName) => {
    if (!vendorId && !vendorName) {
      setPayeeVendorAdvances([]);
      return;
    }
    try {
      const res = await api.get('/finance/accounts-payable/vendor-advance-balance', {
        params: { vendorId: vendorId || undefined, vendorName: vendorName || undefined }
      });
      setPayeeVendorAdvances(Array.isArray(res.data?.data?.advances) ? res.data.data.advances : []);
    } catch {
      setPayeeVendorAdvances([]);
    }
  };

  const getCashApprovalViewPath = (row) => {
    if (row?.originatingModule === 'general') {
      return `/general/cash-approvals/${row.cashApprovalId}`;
    }
    return `/cash-approvals/${row.cashApprovalId}/view`;
  };

  const loadOutstandingByVendor = async (vendorId, vendorName, seedBillId = null) => {
    try {
      setLoadingOutstandingTransactions(true);
      const cleanVendorName = String(vendorName || '').trim();
      const response = await api.get('/finance/accounts-payable', {
        params: { limit: 1000, search: cleanVendorName || '' }
      });
      const allBills = response.data?.data?.bills || [];
      const normName = cleanVendorName.toLowerCase();
      let filtered = allBills.filter((b) => {
        if (getBillPayeeEmployeeId(b)) return false;
        if (b.status === 'cancelled') return false;
        const bVendorId = String(b?.vendor?.vendorId || b?.vendor?._id || '');
        const bVendorName = String(b?.vendor?.name || b?.vendorName || '').toLowerCase().trim();
        const idMatch = vendorId && bVendorId && bVendorId === String(vendorId);
        const nameMatch = normName && bVendorName.includes(normName);
        return idMatch || nameMatch;
      });

      // Ensure seed bill is included if it was not in search results
      if (seedBillId && !filtered.some((b) => String(b._id) === String(seedBillId))) {
        try {
          const singleRes = await api.get(`/finance/accounts-payable/${seedBillId}`);
          if (singleRes.data?.success && singleRes.data?.data) {
            filtered = [singleRes.data.data, ...filtered];
          }
        } catch {
          // keep filtered as is
        }
      }

      mapOutstandingBillRows(filtered, seedBillId);
    } catch (e) {
      setOutstandingTransactions([]);
      toast.error('Failed to load vendor outstanding transactions');
    } finally {
      setLoadingOutstandingTransactions(false);
    }
  };

  const loadOutstandingByEmployee = async (employeeId, employeeName, seedBillId = null) => {
    try {
      setLoadingOutstandingTransactions(true);
      const response = await api.get('/finance/accounts-payable', { params: { limit: 500, search: employeeName || '' } });
      const allBills = response.data?.data?.bills || [];
      const filtered = allBills.filter((b) => {
        const empId = getBillPayeeEmployeeId(b);
        if (employeeId) return String(empId) === String(employeeId);
        const displayName = getBillPayeeEmployeeDisplayName(b) || b?.vendorName || '';
        return displayName.toLowerCase() === (employeeName || '').toLowerCase();
      });
      mapOutstandingBillRows(filtered, seedBillId);
    } catch (e) {
      setOutstandingTransactions([]);
      toast.error('Failed to load employee outstanding transactions');
    } finally {
      setLoadingOutstandingTransactions(false);
    }
  };

  const handleOpenPayment = async (bill) => {
    let b = bill;
    try {
      const response = await api.get(`/finance/accounts-payable/${bill._id}`);
      if (response.data?.success) b = response.data.data;
    } catch {
      // use list row if detail fetch fails
    }

    setSelectedBill(b);
    const outstanding = getOutstanding(b);
    const employeeId = getBillPayeeEmployeeId(b);
    const employeeName = getBillPayeeEmployeeDisplayName(b);
    const employeeCode =
      typeof b.payeeEmployee === 'object' && b.payeeEmployee?.employeeId
        ? b.payeeEmployee.employeeId
        : '';

    setPaymentData({
      amount: outstanding,
      paymentMethod: 'bank_transfer',
      reference: '',
      paymentDate: new Date().toISOString().split('T')[0],
      whtRate: 0
    });

    let vendorId = '';
    let vendorName = '';

    if (employeeId) {
      setPayeeType('employee');
      setSelectedEmployeePayee({ employeeId, employeeName, employeeCode });
      setSelectedPayee({ vendorId: '', vendorName: '' });
      setFinanceEmployees((prev) => {
        if (prev.some((e) => String(e.employeeId) === String(employeeId))) return prev;
        return [{ employeeId, employeeName, employeeCode }, ...prev];
      });
    } else {
      setPayeeType('vendor');
      vendorId = String(b?.vendor?.vendorId || b?.vendor?._id || '');
      vendorName = b?.vendor?.name || b?.vendorName || '';

      // Match vendor in payeeVendors or add temporary entry
      if (!vendorId && vendorName) {
        const found = payeeVendors.find((v) => (v.vendorName || '').toLowerCase().trim() === vendorName.toLowerCase().trim());
        if (found) vendorId = found.vendorId;
      }
      if (vendorName && (!vendorId || !payeeVendors.some((v) => String(v.vendorId) === String(vendorId)))) {
        setPayeeVendors((prev) => {
          const exists = prev.some((v) => (v.vendorName || '').toLowerCase().trim() === vendorName.toLowerCase().trim());
          if (exists) return prev;
          return [{ vendorId: vendorId || `temp_${Date.now()}`, vendorName }, ...prev];
        });
      }

      setSelectedPayee({ vendorId: vendorId || vendorName, vendorName });
      setSelectedEmployeePayee({ employeeId: '', employeeName: '', employeeCode: '' });
    }

    setCaApplyAmounts({});
    setBillPaymentFinAuth({ accountsManagerUser: null, financeControllerUser: null });
    setPaymentDialogOpen(true);

    if (employeeId) {
      await Promise.all([
        loadOutstandingByEmployee(employeeId, employeeName, b?._id),
        loadPayeeCashApprovals('employee', employeeId, '', employeeCode)
      ]);
    } else {
      await Promise.all([
        loadOutstandingByVendor(vendorId, vendorName, b?._id),
        loadPayeeCashApprovals('vendor', '', vendorId, ''),
        loadPayeeVendorAdvances(vendorId, vendorName)
      ]);
    }
  };

  const refreshPaymentDialogData = async () => {
    if (!selectedBill?._id) return;
    try {
      const refreshed = await api.get(`/finance/accounts-payable/${selectedBill._id}`);
      if (refreshed.data?.success) {
        const b = refreshed.data.data;
        setSelectedBill(b);
        const out = getOutstanding(b);
        setPaymentData((prev) => ({ ...prev, amount: out }));
      }
    } catch {
      // ignore refresh errors
    }
    if (payeeType === 'employee' && selectedEmployeePayee.employeeId) {
      await Promise.all([
        loadOutstandingByEmployee(
          selectedEmployeePayee.employeeId,
          selectedEmployeePayee.employeeName,
          selectedBill._id
        ),
        loadPayeeCashApprovals(
          'employee',
          selectedEmployeePayee.employeeId,
          '',
          selectedEmployeePayee.employeeCode
        )
      ]);
    } else if (selectedPayee.vendorId || selectedPayee.vendorName) {
      await Promise.all([
        loadOutstandingByVendor(selectedPayee.vendorId, selectedPayee.vendorName, selectedBill._id),
        loadPayeeCashApprovals('vendor', '', selectedPayee.vendorId, ''),
        loadPayeeVendorAdvances(selectedPayee.vendorId, selectedPayee.vendorName)
      ]);
    }
  };

  const employeeAdvanceApplyTotals = useMemo(() => {
    const totalCaUsage = Math.round(
      payeeCashApprovals.reduce((s, ca) => s + (Number(caApplyAmounts[ca.cashApprovalId]) || 0), 0) * 100
    ) / 100;
    const totalAllocatedToBills = Math.round(
      outstandingTransactions.reduce((s, r) => s + (Number(r.advanceApplyAmount) || 0), 0) * 100
    ) / 100;
    return {
      totalCaUsage,
      totalAllocatedToBills,
      remainingToAllocate: Math.round((totalCaUsage - totalAllocatedToBills) * 100) / 100
    };
  }, [payeeCashApprovals, caApplyAmounts, outstandingTransactions]);

  const handleApplyCaAdvanceToBill = async () => {
    if (payeeType !== 'employee' || !selectedEmployeePayee.employeeId) {
      toast.error('Cash approval apply is available for employee payees only');
      return;
    }

    const cashApprovalUsages = payeeCashApprovals
      .map((ca) => ({
        cashApprovalId: ca.cashApprovalId,
        amount: Math.round((Number(caApplyAmounts[ca.cashApprovalId]) || 0) * 100) / 100
      }))
      .filter((row) => row.amount > 0);

    const billAllocations = outstandingTransactions
      .map((row) => ({
        billId: row.billId,
        amount: Math.round((Number(row.advanceApplyAmount) || 0) * 100) / 100
      }))
      .filter((row) => row.amount > 0);

    if (!cashApprovalUsages.length) {
      toast.error('Enter amount to use on at least one cash approval');
      return;
    }
    if (!billAllocations.length) {
      toast.error('Enter apply from advance on at least one bill');
      return;
    }

    const { totalCaUsage, totalAllocatedToBills } = employeeAdvanceApplyTotals;
    if (Math.abs(totalCaUsage - totalAllocatedToBills) > 0.009) {
      if (totalAllocatedToBills < totalCaUsage) {
        toast.error(
          `Total applied to bills (${formatPKR(totalAllocatedToBills)}) is less than cash approval usage (${formatPKR(totalCaUsage)}). Allocate the full amount.`
        );
      } else {
        toast.error(
          `Total applied to bills (${formatPKR(totalAllocatedToBills)}) exceeds cash approval usage (${formatPKR(totalCaUsage)}).`
        );
      }
      return;
    }

    for (const row of billAllocations) {
      const billRow = outstandingTransactions.find((b) => String(b.billId) === String(row.billId));
      if (billRow && row.amount > (billRow.outstanding || 0) + 0.009) {
        toast.error(`${billRow.billNumber}: apply amount exceeds open balance`);
        return;
      }
    }

    const finAuthErr = validateFinanceAuthoritySelection(billPaymentFinAuth);
    if (finAuthErr) {
      toast.error(finAuthErr);
      return;
    }
    const financeApprovalAuthorities = buildFinanceApprovalAuthoritiesPayload(
      billPaymentFinAuth,
      preparerUserId
    );

    try {
      setProcessingCaApply(true);
      const response = await api.post('/finance/accounts-payable/apply-employee-advance-batch', {
        employeeId: selectedEmployeePayee.employeeId,
        cashApprovalUsages,
        billAllocations,
        financeApprovalAuthorities
      });
      if (response.data?.success) {
        toast.success(response.data.message || 'Cash approval submitted for bill(s)');
        setCaApplyAmounts({});
        await refreshPaymentDialogData();
        fetchAccountsPayable();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to apply cash approval to bill(s)');
    } finally {
      setProcessingCaApply(false);
    }
  };

  const handleRecordPayment = async () => {
    if (paymentData.amount <= 0) {
      toast.error('Payment amount must be greater than zero');
      return;
    }

    const finAuthErr = validateFinanceAuthoritySelection(billPaymentFinAuth);
    if (finAuthErr) {
      toast.error(finAuthErr);
      return;
    }
    const financeApprovalAuthorities = buildFinanceApprovalAuthoritiesPayload(
      billPaymentFinAuth,
      preparerUserId
    );

    try {
      setProcessingPayment(true);
      const payRows = outstandingTransactions
        .filter((r) => Number(r.payAmount) > 0)
        .map((r) => ({ ...r, payAmount: Math.round((Number(r.payAmount) || 0) * 100) / 100 }));
      if (payRows.length === 0) {
        toast.error('Enter payment amount against at least one outstanding bill');
        setProcessingPayment(false);
        return;
      }
      let paymentToast = '';
      for (const row of payRows) {
        const payRes = await api.post(`/finance/accounts-payable/${row.billId}/payment`, {
          amount: row.payAmount,
          paymentMethod: paymentData.paymentMethod,
          reference: paymentData.reference,
          paymentDate: paymentData.paymentDate,
          whtRate: Number(paymentData.whtRate) || 0,
          bankAccountId: paymentData.bankAccountId || null,
          financeApprovalAuthorities
        });
        paymentToast = payRes?.data?.message || paymentToast;
      }
      toast.success(
        paymentToast || `Payment submitted for ${payRows.length} bill(s) — pending finance approval`
      );
      setPaymentDialogOpen(false);
      fetchAccountsPayable();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error(error.response?.data?.message || 'Failed to record payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleOpenEdit = (bill) => {
    if (!canEditVendorBill(bill)) {
      toast.error('This bill cannot be edited after payment has been recorded or is pending');
      return;
    }
    setSelectedBill(bill);
    setEditData({
      billNumber: bill.billNumber,
      totalAmount: bill.totalAmount,
      billDate: new Date(bill.billDate).toISOString().split('T')[0],
      dueDate: new Date(bill.dueDate).toISOString().split('T')[0],
      lineItems: bill.lineItems ? JSON.parse(JSON.stringify(bill.lineItems)) : []
    });
    setEditDialogOpen(true);
  };

  const handleUpdateBill = async () => {
    try {
      const response = await api.put(`/finance/accounts-payable/${selectedBill._id}`, editData);
      if (response.data.success) {
        toast.success('Bill updated successfully');
        setEditDialogOpen(false);
        fetchAccountsPayable();
      }
    } catch (error) {
      console.error('Error updating bill:', error);
      toast.error(error.response?.data?.message || 'Failed to update bill');
    }
  };

  const handleCreateBillFromPo = async (po) => {
    setCreateFromPoDialog({ open: true, po, billNumber: `BILL-PO-${po.orderNumber}`, creating: false });
  };

  const handleConfirmCreateFromPo = async () => {
    const { po } = createFromPoDialog;
    if (!po?._id) return;
    try {
      setCreateFromPoDialog(prev => ({ ...prev, creating: true }));
      const res = await api.post('/finance/accounts-payable/create-from-po', {
        purchaseOrderId: po._id,
        billNumber: createFromPoDialog.billNumber || undefined
      });
      if (res.data?.success) {
        toast.success('Bill created from purchase order');
        setCreateFromPoDialog({ open: false, po: null, billNumber: '', creating: false });
        fetchAccountsPayable();
        fetchPosForBilling();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create bill');
    } finally {
      setCreateFromPoDialog(prev => ({ ...prev, creating: false }));
    }
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'draft': 'default',
      'received': 'info',
      'approved': 'success',
      'pending': 'warning',
      'paid': 'success',
      'overdue': 'error',
      'partial': 'info',
      'cancelled': 'default'
    };
    return colorMap[status] || 'default';
  };

  const getStatusIcon = (status) => {
    const iconMap = {
      'draft': <AccountBalanceIcon />,
      'received': <AccountBalanceIcon />,
      'approved': <CheckCircleIcon />,
      'pending': <WarningIcon />,
      'paid': <CheckCircleIcon />,
      'overdue': <WarningIcon />,
      'partial': <TrendingDownIcon />,
      'cancelled': <AccountBalanceIcon />
    };
    return iconMap[status] || <AccountBalanceIcon />;
  };

  const getAgingColor = (days) => {
    if (days <= 30) return 'success';
    if (days <= 60) return 'warning';
    return 'error';
  };

  const formatGRNDate = (d) => {
    if (!d) return '';
    const x = new Date(d);
    const days = String(x.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days}-${months[x.getMonth()]}-${x.getFullYear()}`;
  };
  const formatGRNNumber = (n) => (n == null || n === '') ? '' : Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDateForPrint = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
  };
  const toggleExpandRow = (billId) => {
    setExpandedRows((prev) => ({ ...prev, [billId]: !prev[billId] }));
  };

  if (initialLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading Accounts Payable...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.error.main }}>
              <ShoppingCartIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.error.main }}>
                Accounts Payable
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Manage vendor bills and payments
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <FinanceCompanySelector minWidth={240} showHelper={false} />
            <Button variant="outlined" size="small" color="info"
              onClick={() => navigate('/finance/vendor-advance')} sx={{ fontSize: 12 }}>
              Vendor advance
            </Button>
            <Button variant="outlined" size="small" color="primary"
              onClick={() => navigate('/finance/vendor-payments')} sx={{ fontSize: 12 }}>
              Payments
            </Button>
            <Button variant="outlined" size="small" color="error"
              onClick={() => navigate('/finance/vendor-refunds')} sx={{ fontSize: 12 }}>
              Refunds
            </Button>
            <Button variant="outlined" size="small" color="warning"
              onClick={() => navigate('/finance/bill-to-receive')} sx={{ fontSize: 12 }}>
              Bill to Receive
            </Button>
            <Button variant="outlined" size="small"
              onClick={() => navigate('/finance/billed-not-received')} sx={{ fontSize: 12 }}>
              Billed Not Received
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchAccountsPayable}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => toast.success('Export functionality coming soon')}
            >
              Export
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<PaymentIcon />}
              onClick={() => setPayBillsModalOpen(true)}
              sx={{ fontWeight: 700 }}
            >
              Pay Bills (Multi-Bill)
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/finance/accounts-payable/new')}
            >
              New Bill
            </Button>
          </Box>
        </Box>

        {/* Filters */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              type="date"
              label="Start Date"
              value={filters.startDate}
              onChange={handleFilterChange('startDate')}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              type="date"
              label="End Date"
              value={filters.endDate}
              onChange={handleFilterChange('endDate')}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                onChange={handleFilterChange('status')}
                label="Status"
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="unpaid">Unpaid / Unsettled</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="received">Received</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="partial">Partial</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="overdue">Overdue</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Bill Type</InputLabel>
              <Select
                value={filters.billType}
                onChange={handleFilterChange('billType')}
                label="Bill Type"
              >
                <MenuItem value="">All Bill Types</MenuItem>
                <MenuItem value="category">Chart of Accounts</MenuItem>
                <MenuItem value="store">Centralized Store</MenuItem>
                <MenuItem value="po">PO / GRN</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              label="Vendor"
              value={vendorInput}
              onChange={(e) => setVendorInput(e.target.value)}
              placeholder="Search vendors"
              size="small"
              InputProps={{
                endAdornment: vendorInput ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setVendorInput('');
                        setFilters((prev) => ({ ...prev, vendor: '' }));
                        setPagination((prev) => ({ ...prev, currentPage: 1 }));
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              label="Search All Columns"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setFilters((prev) => ({ ...prev, search: searchInput }));
                  setPagination((prev) => ({ ...prev, currentPage: 1 }));
                }
              }}
              placeholder="Search bills..."
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchInput ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSearchInput('');
                        setFilters((prev) => ({ ...prev, search: '' }));
                        setPagination((prev) => ({ ...prev, currentPage: 1 }));
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* POs for Billing */}
      {posForBilling.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShoppingCartIcon /> POs for Billing (Create Bill from Purchase Order)
            </Typography>
            {loadingPosForBilling ? (
              <LinearProgress sx={{ mb: 2 }} />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>PO Number</strong></TableCell>
                      <TableCell><strong>Vendor</strong></TableCell>
                      <TableCell><strong>Indent</strong></TableCell>
                      <TableCell align="right"><strong>Amount</strong></TableCell>
                      <TableCell align="center"><strong>Action</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {posForBilling.map((po) => (
                      <TableRow key={po._id}>
                        <TableCell>{po.orderNumber}</TableCell>
                        <TableCell>{po.vendor?.name || 'N/A'}</TableCell>
                        <TableCell>{po.indent?.indentNumber || 'N/A'}</TableCell>
                        <TableCell align="right">{formatPKR(po.totalAmount)}</TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => handleCreateBillFromPo(po)}
                          >
                            Create Bill
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Outstanding
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                    {formatPKR(summary.totalOutstanding)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {summary.totalBills} bills
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <ShoppingCartIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Overdue Amount
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                    {formatPKR(summary.totalOverdue)}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'error.main' }}>
                  <WarningIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Paid
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    {formatPKR(summary.totalPaid)}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <CheckCircleIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Bills
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {summary.totalBills}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                  <AccountBalanceIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Accounts Payable Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Bill Details
          </Typography>
          {loading && <LinearProgress sx={{ height: 4, mb: 1.5, borderRadius: 1 }} />}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>Bill #</TableCell>
                  <TableCell>Bill Type</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Project</TableCell>
                  <TableCell sx={{ minWidth: 180, maxWidth: 280 }}>Narration / Description</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Paid</TableCell>
                  <TableCell align="right">Outstanding</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Aging</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredBills.map((bill) => {
                  const days = calculateAge(bill.billDate);
                  const outstanding = getOutstanding(bill);
                  const grnSettlementRows = getLinkedGrnSettlementRows(bill);
                  return (
                    <React.Fragment key={bill._id}>
                      <TableRow hover>
                        <TableCell sx={{ width: 48 }}>
                          <IconButton size="small" onClick={() => toggleExpandRow(bill._id)}>
                            {expandedRows[bill._id] ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                            {bill.billNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {getBillTypeBadge(bill)}
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              {bill.vendorName || 'Unknown Vendor'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {bill.vendorEmail}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell><Typography variant="body2" fontWeight={600}>{getBillCompany(bill)}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{getBillProject(bill)}</Typography></TableCell>
                        <NarrationTableCell text={getBillNarrationDisplay(bill)} />
                        <TableCell><Typography variant="body2">{formatDate(bill.billDate)}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{formatDate(bill.dueDate)}</Typography></TableCell>
                        <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 'bold' }}>{formatPKR(bill.totalAmount)}</Typography></TableCell>
                        <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>{formatPKR(getSettledAmount(bill))}</Typography></TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: outstanding > 0 ? 'warning.main' : 'success.main' }}>
                            {formatPKR(outstanding)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={bill.status?.toUpperCase() || 'UNKNOWN'} size="small" color={getStatusColor(bill.status)} icon={getStatusIcon(bill.status)} />
                          {getSettlementPending(bill) > 0 ? (
                            <Chip label="Pending approval" size="small" color="warning" variant="outlined" sx={{ ml: 0.5 }} />
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Chip label={`${days} days`} size="small" color={getAgingColor(days)} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="View Details"><IconButton size="small" onClick={() => handleViewBill(bill)}><ViewIcon fontSize="small" /></IconButton></Tooltip>
                            {bill.status === 'paid' || outstanding <= 0 ? (
                              <Tooltip title="Fully Paid">
                                <Chip label="PAID" size="small" color="success" variant="filled" sx={{ height: 26, fontWeight: 'bold', fontSize: '0.7rem' }} />
                              </Tooltip>
                            ) : (
                              <Tooltip title="Make Payment">
                                <IconButton size="small" color="success" onClick={() => handleOpenPayment(bill)}>
                                  <PaymentIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title={canEditVendorBill(bill) ? 'Edit Bill' : 'Cannot edit after payment'}>
                              <span>
                                <IconButton size="small" onClick={() => handleOpenEdit(bill)} disabled={!canEditVendorBill(bill)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Print / Download Bill"><IconButton size="small" onClick={() => navigate(`/finance/bill-print/${bill._id}`)}><PrintIcon fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title={bill.amountPaid > 0 ? 'Cannot delete bill with recorded payments' : 'Delete Bill'}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleOpenDelete(bill)}
                                  disabled={bill.amountPaid > 0}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                      {expandedRows[bill._id] && (
                        <TableRow>
                          <TableCell />
                          <TableCell colSpan={13} sx={{ bgcolor: 'grey.50' }}>
                            <Box sx={{ py: 1 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>Linked Documents</Typography>
                              {bill?.linkedGRNs?.length ? (
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>GRN</TableCell>
                                      <TableCell>PO</TableCell>
                                      <TableCell align="right">Bill Portion</TableCell>
                                      <TableCell align="right">Paid</TableCell>
                                      <TableCell align="right">Remaining</TableCell>
                                      <TableCell>Progress</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {grnSettlementRows.map((row, idx) => {
                                      const { ln, portion, paid, remainingByGrn, pct } = row;
                                      return (
                                        <TableRow key={`${bill._id}-grn-${idx}`}>
                                          <TableCell>{ln?.grnNumber || '—'}</TableCell>
                                          <TableCell>{ln?.poNumber || '—'}</TableCell>
                                          <TableCell align="right">{formatPKR(portion)}</TableCell>
                                          <TableCell align="right">{formatPKR(paid)}</TableCell>
                                          <TableCell align="right">{formatPKR(remainingByGrn)}</TableCell>
                                          <TableCell sx={{ minWidth: 180 }}>
                                            <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4, mb: 0.5 }} />
                                            <Typography variant="caption" color="text.secondary">{pct}% paid</Typography>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              ) : (
                                <Typography variant="body2" color="text.secondary">No GRN linkage found for this bill.</Typography>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {filteredBills.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="textSecondary">
                {searchInput || filters.search || vendorInput || filters.vendor || (filters.status && filters.status !== 'unpaid') || filters.billType
                  ? 'No matching bills found'
                  : 'No bills found'}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                {searchInput || filters.search || vendorInput || filters.vendor || (filters.status && filters.status !== 'unpaid') || filters.billType
                  ? 'Try adjusting your search terms or filters'
                  : 'Create your first bill to get started'}
              </Typography>
              {searchInput || filters.search || vendorInput || filters.vendor || (filters.status && filters.status !== 'unpaid') || filters.billType ? (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setSearchInput('');
                    setVendorInput('');
                    setFilters((prev) => ({
                      ...prev,
                      search: '',
                      vendor: '',
                      status: 'unpaid',
                      billType: ''
                    }));
                    setPagination((prev) => ({ ...prev, currentPage: 1 }));
                  }}
                >
                  Reset Search & Filters
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/finance/accounts-payable/new')}
                >
                  Create First Bill
                </Button>
              )}
            </Box>
          )}

          <TablePagination
            component="div"
            count={pagination.totalCount}
            page={Math.max(0, pagination.currentPage - 1)}
            onPageChange={handlePageChange}
            rowsPerPage={pagination.limit}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[25, 50, 100, 250, 500]}
          />
        </CardContent>
      </Card>

      {/* Bill Details Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)}
        maxWidth={selectedBill?.referenceType === 'purchase_order' ? 'lg' : 'md'}
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Bill Details: {selectedBill?.billNumber}
          <IconButton onClick={() => setViewDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedBill && (
            <>
              <Tabs
                value={billViewTab}
                onChange={(_, v) => setBillViewTab(v)}
                sx={{ px: 2, pt: 1, borderBottom: 1, borderColor: 'divider', mb: 2 }}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Vendor Bill" />
                <Tab label={selectedBill?.poDetail?.indent ? 'Indent' : 'Indent'} />
                <Tab label={`Quotations (${selectedBill?.poDetail?.quotations?.length || 0})`} />
                <Tab label="Comparative Statement" />
                <Tab label={selectedBill?.poDetail?.po ? 'Purchase Order' : 'PO'} />
                <Tab label={(selectedBill?.poDetail?.grns?.length || 0) > 0 ? `GRN(s) (${selectedBill.poDetail.grns.length})` : 'GRN(s)'} />
                <Tab label="Payment History" />
              </Tabs>

              {/* Tab 0: Vendor Bill & Approval Authorities */}
              {billViewTab === 0 && (
                <Box sx={{ p: 2 }}>
                  <CentralizedStoreBillInvoiceBody 
                    bill={{
                      ...selectedBill,
                      billId: selectedBill.billNumber,
                      billDate: selectedBill.billDate,
                      createdAt: selectedBill.createdAt || selectedBill.billDate,
                      provider: selectedBill.vendorName || selectedBill.vendor?.name,
                      location: getBillCompany(selectedBill) !== '—' ? `${getBillCompany(selectedBill)}${getBillProject(selectedBill) !== '—' ? ` — ${getBillProject(selectedBill)}` : ''}` : (selectedBill.vendor?.address?.city || selectedBill.department || 'N/A'),
                      notes: selectedBill.notes || selectedBill.internalNotes || getBillNarrationDisplay(selectedBill),
                      forWhat: selectedBill.forWhat || getBillNarrationDisplay(selectedBill),
                      billLines: (selectedBill.lineItems && selectedBill.lineItems.length > 0)
                        ? selectedBill.lineItems.map((line, idx) => ({
                            ...line,
                            category: line.category || line.accountName || line.account?.name || (line.accountNumber ? `Account ${line.accountNumber}` : '—'),
                            accountName: line.accountName || line.account?.name || '',
                            accountNumber: line.accountNumber || line.account?.accountNumber || '',
                            itemName: line.description || line.itemName || (line.accountNumber ? `Account ${line.accountNumber}` : 'Item'),
                            description: line.description || line.itemName || '',
                            itemCode: line.itemCode || line.accountNumber || '—',
                            amount: line.amount || (line.quantity * line.unitPrice),
                            attachments: idx === 0 && selectedBill.attachments?.length ? selectedBill.attachments.map(a => ({ url: a.path || a.filename, originalName: a.originalName })) : undefined
                          }))
                        : (selectedBill.billLines || [])
                    }}
                    showChargesSummary={true}
                  />

                  {/* Approval Authority Table — ONLY for Centralized Store / Utility Bills */}
                  {(selectedBill?.referenceType === 'utility_bill' || selectedBill?.module === 'taj_utilities') && (() => {
                    const getApprovalRows = () => {
                      const formatDateTime = (date) => {
                        if (!date) return '-';
                        return new Date(date).toLocaleString('en-PK', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        });
                      };

                      const userDisplayName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.name || '-';

                      const history = Array.isArray(selectedBill?.workflowHistory) ? [...selectedBill.workflowHistory].reverse() : [];
                      const preAuditEntry = history.find(e => e.toStatus === 'Forwarded to Audit Director' || e.toStatus === 'initial audit approval' || e.toStatus?.includes('Pre-Audit'));
                      const directorEntry = history.find(e => e.toStatus === 'approved' || e.toStatus === 'Approved' || e.toStatus?.includes('Audit Director'));

                      const rows = [
                        {
                          authority: 'Sig of Requester',
                          name: userDisplayName(selectedBill?.createdBy),
                          signatureUser: selectedBill?.createdBy,
                          dateTime: selectedBill?.createdAt ? formatDateTime(selectedBill.createdAt) : '-'
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
                      <Table
                        size="small"
                        sx={{
                          mt: 4,
                          mb: 2,
                          border: '1px solid',
                          borderColor: 'grey.300',
                          '& th': {
                            bgcolor: 'grey.100',
                            fontWeight: 800,
                            fontSize: 14,
                            borderBottom: '1px solid',
                            borderColor: 'grey.300'
                          },
                          '& td': {
                            fontSize: 14,
                            borderBottom: '1px solid',
                            borderColor: 'grey.200',
                            py: 1.4
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
                    );
                  })()}
                </Box>
              )}

              {/* Tab 1: Indent */}
              {billViewTab === 1 && (
                <Box sx={{ p: 2, overflowX: 'auto' }} className="print-content">
                  {!selectedBill?.poDetail?.indent ? (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No Indent linked to this Vendor Bill.</Typography>
                  ) : (
                      <Paper sx={{ p: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none' }}>
                        <Typography variant="h5" fontWeight={700} align="center" sx={{ textTransform: 'uppercase', mb: 1 }}>
                          Purchase Request Form
                        </Typography>
                        {selectedBill.poDetail.indent.title && (
                          <Typography variant="h6" fontWeight={600} align="center" sx={{ mb: 2 }}>{selectedBill.poDetail.indent.title}</Typography>
                        )}
                        <Box sx={{ mb: 1.5, fontSize: '0.9rem', textAlign: 'center' }}>
                          <Typography component="span" fontWeight={600}>ERP Ref:</Typography>
                          <Typography component="span" sx={{ ml: 1 }}>{selectedBill.poDetail.indent.erpRef || 'PR #' + (selectedBill.poDetail.indent.indentNumber?.split('-').pop() || '')}</Typography>
                        </Box>
                        <Box sx={{ mb: 1.5, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <Box><Typography component="span" fontWeight={600}>Date:</Typography><Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(selectedBill.poDetail.indent.requestedDate)}</Typography></Box>
                          <Box><Typography component="span" fontWeight={600}>Required Date:</Typography><Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(selectedBill.poDetail.indent.requiredDate) || '—'}</Typography></Box>
                          <Box><Typography component="span" fontWeight={600}>Indent No.:</Typography><Typography component="span" sx={{ ml: 1 }}>{selectedBill.poDetail.indent.indentNumber || '—'}</Typography></Box>
                        </Box>
                        <Box sx={{ mb: 3, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <Box><Typography component="span" fontWeight={600}>Department:</Typography><Typography component="span" sx={{ ml: 1 }}>{selectedBill.poDetail.indent.department?.name || selectedBill.poDetail.indent.department || '—'}</Typography></Box>
                          <Box><Typography component="span" fontWeight={600}>Originator:</Typography><Typography component="span" sx={{ ml: 1 }}>{selectedBill.poDetail.indent.requestedBy?.firstName && selectedBill.poDetail.indent.requestedBy?.lastName ? `${selectedBill.poDetail.indent.requestedBy.firstName} ${selectedBill.poDetail.indent.requestedBy.lastName}` : selectedBill.poDetail.indent.requestedBy?.name || '—'}</Typography></Box>
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
                              {(selectedBill.poDetail.indent.items || []).map((item, idx) => (
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
                        {selectedBill.poDetail.indent.justification && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Justification:</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>{selectedBill.poDetail.indent.justification}</Typography>
                          </Box>
                        )}
                        {/* Approval Authorities for Indent */}
                        <Box sx={{ mt: 3 }}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                            Approval Authorities (Indent)
                          </Typography>
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ bgcolor: 'grey.100' }}>
                                  <TableCell sx={{ fontWeight: 800 }}>Authority</TableCell>
                                  <TableCell sx={{ fontWeight: 800 }}>Name</TableCell>
                                  <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                                  <TableCell sx={{ fontWeight: 800 }}>Date &amp; Time</TableCell>
                                  <TableCell sx={{ fontWeight: 800 }} align="center">Digital Signature</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {(() => {
                                  const ind = selectedBill.poDetail.indent;
                                  const formatDt = (d) => d ? new Date(d).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
                                  const userNm = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.name || '-';
                                  const reqUser = ind.requestedBy;
                                  const compApprovals = ind.comparativeStatementApprovals || {};

                                  const rows = [
                                    { authority: 'Requester / Originator', name: userNm(reqUser), status: 'Submitted', dateTime: formatDt(ind.requestedDate || ind.createdAt), user: reqUser },
                                    { authority: 'Prepared By', name: userNm(compApprovals.preparedByUser), status: compApprovals.preparedByUser ? 'Approved' : 'Pending', dateTime: formatDt(compApprovals.preparedAt), user: compApprovals.preparedByUser },
                                    { authority: 'Verified By', name: userNm(compApprovals.verifiedByUser), status: compApprovals.verifiedByUser ? 'Approved' : 'Pending', dateTime: formatDt(compApprovals.verifiedAt), user: compApprovals.verifiedByUser },
                                    { authority: 'Authorised Rep', name: userNm(compApprovals.authorisedRepUser), status: compApprovals.authorisedRepUser ? 'Approved' : 'Pending', dateTime: formatDt(compApprovals.authorisedRepAt), user: compApprovals.authorisedRepUser },
                                    { authority: 'Finance Rep', name: userNm(compApprovals.financeRepUser), status: compApprovals.financeRepUser ? 'Approved' : 'Pending', dateTime: formatDt(compApprovals.financeRepAt), user: compApprovals.financeRepUser },
                                    { authority: 'Manager Procurement', name: userNm(compApprovals.managerProcurementUser), status: compApprovals.managerProcurementUser ? 'Approved' : 'Pending', dateTime: formatDt(compApprovals.managerProcurementAt), user: compApprovals.managerProcurementUser }
                                  ];

                                  return rows.map((r, i) => (
                                    <TableRow key={i}>
                                      <TableCell sx={{ fontWeight: 700 }}>{r.authority}</TableCell>
                                      <TableCell>{r.name}</TableCell>
                                      <TableCell>
                                        <Chip size="small" label={r.status} color={r.status === 'Approved' || r.status === 'Submitted' ? 'success' : 'default'} variant="outlined" />
                                      </TableCell>
                                      <TableCell>{r.dateTime}</TableCell>
                                      <TableCell align="center">
                                        {r.user?.digitalSignature ? (
                                          <DigitalSignatureImage userOrPath={r.user} alt={`${r.authority} signature`} />
                                        ) : (
                                          '-'
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ));
                                })()}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      </Paper>
                  )}
                </Box>
              )}

              {/* Tab 2: Quotations */}
              {billViewTab === 2 && (
                <Box sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                  {(!selectedBill?.poDetail?.quotations || selectedBill.poDetail.quotations.length === 0) ? (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No Quotations found.</Typography>
                  ) : (
                    <Stack spacing={4}>
                      {selectedBill.poDetail.quotations.map((q) => (
                        <QuotationDetailView
                          key={q._id}
                          quotation={{ ...q, indent: selectedBill.poDetail.indent || q.indent }}
                          formatNumber={(n) => formatPKR(n)}
                          formatDateForPrint={(d) => formatDate(d)}
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
              )}

              {/* Tab 3: Comparative Statement */}
              {billViewTab === 3 && (
                <Box sx={{ p: 2, overflowX: 'auto' }}>
                  {!selectedBill?.poDetail?.indent ? (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No Comparative Statement available.</Typography>
                  ) : (
                    <ComparativeStatementView
                      requisition={selectedBill.poDetail.indent}
                      quotations={selectedBill.poDetail.quotations || []}
                      approvalAuthority={selectedBill.poDetail.indent?.comparativeStatementApprovals || {}}
                      note={selectedBill.poDetail.indent?.notes ?? ''}
                      readOnly
                      formatNumber={(n) => formatPKR(n)}
                      loadingQuotations={false}
                      showPrintButton={false}
                    />
                  )}
                </Box>
              )}

              {/* Tab 4: Purchase Order */}
              {billViewTab === 4 && (
                <Box sx={{ p: 2, overflowX: 'auto' }} className="print-content">
                  {!selectedBill?.poDetail?.po ? (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No Purchase Order linked to this Vendor Bill.</Typography>
                  ) : (
                      <Paper sx={{ p: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none', fontFamily: 'Arial, sans-serif' }}>
                        <Typography variant="h4" fontWeight={700} align="center" sx={{ textTransform: 'uppercase', mb: 3 }}>Purchase Order</Typography>
                        <Box sx={{ mb: 2.5 }}>
                          <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>Residencia</Typography>
                          <Typography variant="body2">1st Avenue 18 4 Islamabad</Typography>
                          <Typography variant="body2">1. Het Sne 1-8. Islamabad.</Typography>
                        </Box>
                        <Divider sx={{ my: 2.5 }} />
                        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap' }}>
                          <Box sx={{ width: { xs: '100%', md: '45%' }, fontSize: '0.9rem' }}>
                            <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>{selectedBill.poDetail.po.vendor?.name || 'Vendor Name'}</Typography>
                            <Typography variant="body2" sx={{ mb: 2 }}>{typeof selectedBill.poDetail.po.vendor?.address === 'string' ? selectedBill.poDetail.po.vendor.address : (selectedBill.poDetail.po.vendor?.address ? Object.values(selectedBill.poDetail.po.vendor.address).filter(Boolean).join(', ') : 'Vendor Address')}</Typography>
                            <Box>
                              <Typography component="span" fontWeight={600}>Indent Details: </Typography>
                              <Typography component="span">Indent# {selectedBill.poDetail.po.indent?.indentNumber || selectedBill.poDetail.indent?.indentNumber || 'N/A'} Dated. {formatDateForPrint(selectedBill.poDetail.po.indent?.requestedDate || selectedBill.poDetail.indent?.requestedDate) || 'N/A'}.
                                {selectedBill.poDetail.po.indent?.title && ` ${selectedBill.poDetail.po.indent.title}.`}
                                {selectedBill.poDetail.indent?.requestedBy && ` End User. ${selectedBill.poDetail.indent.requestedBy.firstName || ''} ${selectedBill.poDetail.indent.requestedBy.lastName || selectedBill.poDetail.indent.requestedBy.name || ''}`}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ width: { xs: '100%', md: '50%' }, fontSize: '0.9rem' }}>
                            <Box sx={{ display: 'flex', mb: 0.5 }}><Typography component="span" sx={{ minWidth: 140, fontWeight: 600 }}>P.O No.:</Typography><Typography component="span">{selectedBill.poDetail.po.orderNumber || 'N/A'}</Typography></Box>
                            <Box sx={{ display: 'flex', mb: 0.5 }}><Typography component="span" sx={{ minWidth: 140, fontWeight: 600 }}>Date:</Typography><Typography component="span">{formatDateForPrint(selectedBill.poDetail.po.orderDate)}</Typography></Box>
                            <Box sx={{ display: 'flex', mb: 0.5 }}><Typography component="span" sx={{ minWidth: 140, fontWeight: 600 }}>Delivery Date:</Typography><Typography component="span">{formatDateForPrint(selectedBill.poDetail.po.expectedDeliveryDate) || '—'}</Typography></Box>
                            <Box sx={{ display: 'flex', mb: 0.5 }}><Typography component="span" sx={{ minWidth: 140, fontWeight: 600 }}>Delivery Address:</Typography><Typography component="span">{selectedBill.poDetail.po.deliveryAddress || '—'}</Typography></Box>
                          </Box>
                        </Box>
                        <TableContainer sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ bgcolor: 'grey.100' }}>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Sr</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Product</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Description</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Specification</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Brand</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Qty Unit</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Rate</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Amount</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(selectedBill.poDetail.po.items || []).map((item, idx) => {
                                const indentItem = selectedBill.poDetail.indent?.items?.[idx];
                                return (
                                  <TableRow key={idx}>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="center">{idx + 1}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.productCode || indentItem?.itemCode || item.description?.split(' ')[0] || '—'}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.description || indentItem?.itemName || '—'}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.specification || indentItem?.description || indentItem?.specification || '—'}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.brand || indentItem?.brand || '—'}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="center">{item.quantity} {item.unit || 'pcs'}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{formatPKR(item.unitPrice)}</TableCell>
                                    <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{formatPKR((item.quantity || 0) * (item.unitPrice || 0))}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                          <Typography variant="body1" fontWeight="bold">Total: {formatPKR(selectedBill.poDetail.po.totalAmount)}</Typography>
                        </Box>
                        {/* Approval Authorities for PO */}
                        <Box sx={{ mt: 3 }}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                            Approval Authorities (Purchase Order)
                          </Typography>
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ bgcolor: 'grey.100' }}>
                                  <TableCell sx={{ fontWeight: 800 }}>Authority</TableCell>
                                  <TableCell sx={{ fontWeight: 800 }}>Name</TableCell>
                                  <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                                  <TableCell sx={{ fontWeight: 800 }}>Date &amp; Time</TableCell>
                                  <TableCell sx={{ fontWeight: 800 }} align="center">Digital Signature</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {(() => {
                                  const po = selectedBill.poDetail.po;
                                  const history = Array.isArray(po.workflowHistory) ? [...po.workflowHistory].reverse() : [];
                                  const formatDt = (d) => d ? new Date(d).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
                                  const userNm = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.name || '-';

                                  const preAuditEntry = history.find(e => e.toStatus === 'Forwarded to Audit Director' || e.toStatus === 'initial audit approval' || e.toStatus?.includes('Pre-Audit'));
                                  const directorEntry = history.find(e => e.toStatus === 'approved' || e.toStatus === 'Approved' || e.toStatus?.includes('Audit Director'));

                                  const rows = [
                                    { authority: 'Prepared By (Procurement)', name: userNm(po.createdBy), status: 'Created', dateTime: formatDt(po.createdAt || po.orderDate), user: po.createdBy },
                                    { authority: 'Pre-Audit Authority', name: userNm(preAuditEntry?.changedBy), status: preAuditEntry ? 'Approved' : 'Pending', dateTime: formatDt(preAuditEntry?.changedAt), user: preAuditEntry?.changedBy },
                                    { authority: 'Audit Director', name: userNm(po.auditApprovedBy || directorEntry?.changedBy), status: (po.auditApprovedBy || directorEntry) ? 'Approved' : 'Pending', dateTime: formatDt(po.auditApprovedAt || directorEntry?.changedAt), user: po.auditApprovedBy || directorEntry?.changedBy, stampPath: directorEntry?.stampUsed && directorEntry?.stampImage ? directorEntry.stampImage : '' }
                                  ];

                                  return rows.map((r, i) => (
                                    <TableRow key={i}>
                                      <TableCell sx={{ fontWeight: 700 }}>{r.authority}</TableCell>
                                      <TableCell>{r.name}</TableCell>
                                      <TableCell>
                                        <Chip size="small" label={r.status} color={r.status === 'Approved' || r.status === 'Created' ? 'success' : 'default'} variant="outlined" />
                                      </TableCell>
                                      <TableCell>{r.dateTime}</TableCell>
                                      <TableCell align="center">
                                        {(r.stampPath || r.user?.digitalSignature) ? (
                                          <DigitalSignatureImage userOrPath={r.stampPath || r.user} alt={`${r.authority} signature`} />
                                        ) : (
                                          '-'
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ));
                                })()}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      </Paper>
                  )}
                </Box>
              )}
                  {/* Tab 5: GRNs */}
                  {billViewTab === 5 && (
                    <Box sx={{ p: 2, overflowX: 'auto' }} className="print-content">
                      {(!selectedBill?.poDetail?.grns || selectedBill.poDetail.grns.length === 0) ? (
                        <Typography color="textSecondary" sx={{ py: 4, textAlign: 'center' }}>No GRN(s) attached to this Purchase Order.</Typography>
                      ) : (
                        selectedBill.poDetail.grns.map((grn) => (
                          <Paper key={grn._id} sx={{ p: 4, mb: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="overline" color="textSecondary" sx={{ display: 'block', mb: 1 }}>Attached GRN (copy)</Typography>
                            <Grid container sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', pb: 2 }} alignItems="center">
                              <Grid item xs={4}><Typography variant="h6" fontWeight="bold">Taj Residencia</Typography><Typography variant="body2" color="textSecondary">Head Office</Typography></Grid>
                              <Grid item xs={4} sx={{ textAlign: 'center' }}><Typography variant="h5" fontWeight="bold">Goods Received Note</Typography></Grid>
                              <Grid item xs={4} />
                            </Grid>
                            <Grid container spacing={3} sx={{ mb: 2 }}>
                              <Grid item xs={12} md={6}>
                                <Typography variant="caption" color="textSecondary">No.</Typography>
                                <Typography variant="body1" fontWeight="bold">{grn.receiveNumber || grn._id}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Supplier</Typography>
                                <Typography variant="body2">{[grn.supplier?.supplierId, grn.supplierName || grn.supplier?.name].filter(Boolean).join(' ') || '—'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Address</Typography>
                                <Typography variant="body2">{grn.supplierAddress || grn.supplier?.address || '—'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Narration</Typography>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{grn.narration || '—'}</Typography>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <Typography variant="caption" color="textSecondary">Date</Typography>
                                <Typography variant="body2">{formatGRNDate(grn.receiveDate)}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Currency</Typography>
                                <Typography variant="body2">{grn.currency || 'Rupees'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>P.R No.</Typography>
                                <Typography variant="body2">{grn.prNumber || '—'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>P.O No.</Typography>
                                <Typography variant="body2">{grn.poNumber || selectedBill.poDetail.po?.orderNumber || '—'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Store</Typography>
                                <Typography variant="body2">{grn.store || '—'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Gate Pass No.</Typography>
                                <Typography variant="body2">{grn.gatePassNo || '—'}</Typography>
                              </Grid>
                            </Grid>
                            <TableContainer sx={{ mb: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>S. No</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Product Code</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Description</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Unit</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Quantity</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Rate</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Value Excl. ST</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {(grn.items || []).map((item, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{idx + 1}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.itemCode || '—'}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.itemName || '—'}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.unit || '—'}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{formatGRNNumber(item.quantity)}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{formatGRNNumber(item.unitPrice)}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{formatGRNNumber(item.valueExcludingSalesTax ?? (item.quantity * item.unitPrice))}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                              <Grid container spacing={1} sx={{ maxWidth: 320 }}>
                                <Grid item xs={6}><Typography variant="body2">Discount</Typography></Grid>
                                <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2">{formatGRNNumber(grn.discount)}</Typography></Grid>
                                <Grid item xs={6}><Typography variant="body2">Other Charges</Typography></Grid>
                                <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2">{formatGRNNumber(grn.otherCharges)}</Typography></Grid>
                                <Grid item xs={6}><Typography variant="body2" fontWeight="bold">Net Amount</Typography></Grid>
                                <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2" fontWeight="bold">{formatGRNNumber(grn.netAmount)}</Typography></Grid>
                                <Grid item xs={6}><Typography variant="body2" fontWeight="bold">Total</Typography></Grid>
                                <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2" fontWeight="bold">{formatGRNNumber(grn.total ?? grn.netAmount)}</Typography></Grid>
                              </Grid>
                            </Box>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="caption" color="textSecondary">Observation</Typography>
                            <Typography variant="body2" sx={{ minHeight: 24 }}>{grn.observation || ' '}</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 3 }}>
                              <Box>
                                <Typography variant="caption" color="textSecondary">Prepared By</Typography>
                                <Typography variant="body2" fontWeight="medium">{grn.preparedByName || (grn.receivedBy?.firstName && grn.receivedBy?.lastName ? `${grn.receivedBy.firstName} ${grn.receivedBy.lastName}` : '—')}</Typography>
                              </Box>
                              <Box sx={{ width: 120, height: 40, border: '1px dashed', borderColor: 'divider' }} />
                            </Box>
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}

                  {/* Tab 6: Payment History */}
                  {billViewTab === 6 && (
                    <Box sx={{ p: 2 }}>
                      <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HistoryIcon /> Payment History
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'grey.50' }}>
                        <Grid container spacing={1}>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="text.secondary">Bill Total</Typography>
                            <Typography fontWeight={700}>{formatPKR(selectedBill?.totalAmount || 0)}</Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="text.secondary">Advance Applied</Typography>
                            <Typography fontWeight={700} color="info.main">{formatPKR(selectedBill?.advanceApplied || 0)}</Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="text.secondary">Cash/Bank Paid</Typography>
                        <Typography fontWeight={700} color="success.main">{formatPKR(getCashPaidAmount(selectedBill))}</Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="text.secondary">Outstanding</Typography>
                            <Typography fontWeight={800} color="error.main">{formatPKR(getOutstanding(selectedBill))}</Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                      {selectedBill.payments && selectedBill.payments.length > 0 ? (
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ bgcolor: 'grey.100' }}>
                                <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Method</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Reference</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }} align="right">Amount</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {selectedBill.payments.map((payment, index) => (
                                <TableRow key={index}>
                                  <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                                  <TableCell>{payment.paymentMethod?.replace('_', ' ')}</TableCell>
                                  <TableCell>{payment.reference || '—'}</TableCell>
                                  <TableCell align="right">{formatPKR(payment.amount)}</TableCell>
                                </TableRow>
                              ))}
                              {(selectedBill?.advanceApplied || 0) > 0 && (
                                <TableRow sx={{ bgcolor: 'info.50' }}>
                                  <TableCell>{formatDate(selectedBill?.updatedAt || selectedBill?.billDate)}</TableCell>
                                  <TableCell>advance adjustment</TableCell>
                                  <TableCell>Auto-applied to bill</TableCell>
                                  <TableCell align="right">{formatPKR(selectedBill.advanceApplied)}</TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <>
                          <Typography variant="body2" color="textSecondary">No cash/bank payments recorded yet</Typography>
                          {(selectedBill?.advanceApplied || 0) > 0 && (
                            <Typography variant="body2" sx={{ mt: 1 }} color="info.main">
                              Advance adjustment applied: {formatPKR(selectedBill.advanceApplied)}
                            </Typography>
                          )}
                        </>
                      )}
                    </Box>
                  )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
          <Box>
            {selectedBill?.workflowHistory && selectedBill.workflowHistory.length > 0 && (
              <Button
                variant="outlined"
                startIcon={<HistoryIcon />}
                onClick={() => setWorkflowHistoryDialog({ open: true, document: selectedBill })}
              >
                See Workflow History
              </Button>
            )}
          </Box>
          <Button onClick={() => setViewDialogOpen(false)} variant="outlined">Close</Button>
        </DialogActions>
      </Dialog>

      <WorkflowHistoryDialog
        open={workflowHistoryDialog.open}
        onClose={() => setWorkflowHistoryDialog({ open: false, document: null })}
        document={workflowHistoryDialog.document}
        documentType="preAudit"
      />

      {/* Create Bill from PO Dialog */}
      <Dialog open={createFromPoDialog.open} onClose={() => setCreateFromPoDialog({ open: false, po: null, billNumber: '', creating: false })} maxWidth="sm" fullWidth>
        <DialogTitle>Create Bill from Purchase Order</DialogTitle>
        <DialogContent>
          {createFromPoDialog.po && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" sx={{ mb: 2 }}>
                PO: <strong>{createFromPoDialog.po.orderNumber}</strong> | Vendor: {createFromPoDialog.po.vendor?.name} | Amount: {formatPKR(createFromPoDialog.po.totalAmount)}
              </Typography>
              <TextField
                fullWidth
                label="Bill Number"
                value={createFromPoDialog.billNumber}
                onChange={(e) => setCreateFromPoDialog(prev => ({ ...prev, billNumber: e.target.value }))}
                size="small"
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateFromPoDialog({ open: false, po: null, billNumber: '', creating: false })}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmCreateFromPo} disabled={createFromPoDialog.creating}>
            {createFromPoDialog.creating ? 'Creating...' : 'Create Bill'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog 
        open={paymentDialogOpen} 
        onClose={() => setPaymentDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Bill Payment
          {outstandingTransactions.length > 0 && outstandingTransactions[0].company && (
            <Typography variant="body2" color="text.secondary">
              Company: {outstandingTransactions[0].company}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">Amount to post: {formatPKR(paymentData.amount || 0)}</Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                      Payee type
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={payeeType}
                      onChange={async (_, v) => {
                        if (!v) return;
                        setPayeeType(v);
                        if (v === 'vendor') {
                          setSelectedEmployeePayee({ employeeId: '', employeeName: '', employeeCode: '' });
                          setOutstandingTransactions([]);
                          setPayeeCashApprovals([]);
                          if (selectedPayee.vendorId) {
                            await Promise.all([
                              loadOutstandingByVendor(
                                selectedPayee.vendorId,
                                selectedPayee.vendorName,
                                selectedBill?._id
                              ),
                              loadPayeeCashApprovals(
                                'vendor',
                                '',
                                selectedPayee.vendorId,
                                ''
                              )
                            ]);
                          }
                        } else {
                          setSelectedPayee({ vendorId: '', vendorName: '' });
                          setOutstandingTransactions([]);
                          setPayeeCashApprovals([]);
                          if (selectedEmployeePayee.employeeId) {
                            await Promise.all([
                              loadOutstandingByEmployee(
                                selectedEmployeePayee.employeeId,
                                selectedEmployeePayee.employeeName,
                                selectedBill?._id
                              ),
                              loadPayeeCashApprovals(
                                'employee',
                                selectedEmployeePayee.employeeId,
                                '',
                                selectedEmployeePayee.employeeCode
                              )
                            ]);
                          }
                        }
                      }}
                    >
                      <ToggleButton value="vendor">Vendor</ToggleButton>
                      <ToggleButton value="employee">Employee</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                  <Grid container spacing={1} alignItems="flex-end">
                    <Grid item xs={12} md={6}>
                      {payeeType === 'employee' ? (
                        <FormControl fullWidth size="small">
                          <InputLabel>Payee (Employee)</InputLabel>
                          <Select
                            value={selectedEmployeePayee.employeeId || ''}
                            label="Payee (Employee)"
                            onChange={async (e) => {
                              const employeeId = e.target.value;
                              const row = financeEmployees.find(
                                (emp) => String(emp.employeeId) === String(employeeId)
                              );
                              const employeeName = row?.employeeName || '';
                              const employeeCode = row?.employeeCode || '';
                              setSelectedEmployeePayee({ employeeId, employeeName, employeeCode });
                              await Promise.all([
                                loadOutstandingByEmployee(employeeId, employeeName, selectedBill?._id),
                                loadPayeeCashApprovals('employee', employeeId, '', employeeCode)
                              ]);
                            }}
                          >
                            <MenuItem value="">
                              <em>Select employee</em>
                            </MenuItem>
                            {financeEmployees.map((e) => (
                              <MenuItem key={e.employeeId} value={e.employeeId}>
                                {e.employeeCode ? `${e.employeeCode} — ` : ''}
                                {e.employeeName}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <FormControl fullWidth size="small">
                          <InputLabel>Payee (Vendor)</InputLabel>
                          <Select
                            value={selectedPayee.vendorId || ''}
                            label="Payee (Vendor)"
                            onChange={async (e) => {
                              const vendorId = e.target.value;
                              const row = payeeVendors.find((v) => String(v.vendorId) === String(vendorId));
                              const vendorName = row?.vendorName || '';
                              setSelectedPayee({ vendorId, vendorName });
                              await Promise.all([
                                loadOutstandingByVendor(vendorId, vendorName, selectedBill?._id),
                                loadPayeeCashApprovals('vendor', '', vendorId, ''),
                                loadPayeeVendorAdvances(vendorId, vendorName)
                              ]);
                            }}
                          >
                            <MenuItem value="">
                              <em>Select vendor</em>
                            </MenuItem>
                            {payeeVendors.map((v) => (
                              <MenuItem key={v.vendorId} value={v.vendorId}>
                                {v.vendorName}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">
                        {payeeType === 'employee' ? 'Selected employee' : 'Selected vendor'}
                      </Typography>
                      <Typography fontWeight={700}>
                        {payeeType === 'employee'
                          ? selectedEmployeePayee.employeeName
                            ? `${selectedEmployeePayee.employeeCode ? `${selectedEmployeePayee.employeeCode} — ` : ''}${selectedEmployeePayee.employeeName}`
                            : '—'
                          : selectedPayee.vendorName || '—'}
                      </Typography>
                    </Grid>
                  </Grid>
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                <Grid container spacing={1.5}>
                  <FinanceApprovalAuthorityPicker
                    finAuth={billPaymentFinAuth}
                    onChange={setBillPaymentFinAuth}
                    candidateUsers={financeAuthorityCandidates}
                    preparerName={preparerDisplayName}
                    disabled={processingCaApply || processingPayment}
                    title="Finance approval authorities (required before apply or payment)"
                  />
                </Grid>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2">
                    {payeeType === 'employee' ? 'Outstanding bills — apply advance (Step 2a)' : 'Outstanding Transactions'}
                  </Typography>
                  {outstandingTransactions.length > 0 && (
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          const next = outstandingTransactions.map((r) => {
                            const maxBank = roundPay2(Math.max(0, (r.outstanding || 0) - (Number(r.advanceApplyAmount) || 0)));
                            return { ...r, payAmount: maxBank };
                          });
                          setOutstandingTransactions(next);
                          const total = roundPay2(next.reduce((s, r) => s + (Number(r.payAmount) || 0), 0));
                          setPaymentData((prev) => ({ ...prev, amount: total }));
                        }}
                        sx={{ fontSize: '0.75rem', py: 0.2 }}
                      >
                        Select All Bills
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        onClick={() => {
                          const next = outstandingTransactions.map((r) => ({ ...r, payAmount: 0 }));
                          setOutstandingTransactions(next);
                          setPaymentData((prev) => ({ ...prev, amount: 0 }));
                        }}
                        sx={{ fontSize: '0.75rem', py: 0.2 }}
                      >
                        Clear
                      </Button>
                    </Stack>
                  )}
                </Stack>
                {loadingOutstandingTransactions ? (
                  <LinearProgress />
                ) : outstandingTransactions.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {payeeType === 'employee'
                      ? 'No outstanding bills for selected employee.'
                      : 'No outstanding bills for selected vendor.'}
                  </Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Bill #</TableCell>
                        <TableCell>Due Date</TableCell>
                        <TableCell align="right">Original Amount</TableCell>
                        <TableCell align="right">Open Balance</TableCell>
                        {payeeType === 'employee' && (
                          <TableCell align="right" sx={{ minWidth: 140 }}>Apply from advance</TableCell>
                        )}
                        <TableCell align="right" sx={{ minWidth: 140 }}>
                          {payeeType === 'employee' ? 'Bank payment' : 'Payment'}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {outstandingTransactions.map((row, idx) => (
                        <TableRow key={row.billId}>
                          <TableCell>{row.billNumber}</TableCell>
                          <TableCell>{formatDate(row.dueDate)}</TableCell>
                          <TableCell align="right">{formatPKR(row.totalAmount)}</TableCell>
                          <TableCell align="right">
                            {formatPKR(
                              roundPay2(
                                Math.max(
                                  0,
                                  (Number(row.outstanding) || 0) - (Number(row.advanceApplyAmount) || 0)
                                )
                              )
                            )}
                          </TableCell>
                          {payeeType === 'employee' && (
                            <TableCell align="right">
                              <TextField
                                size="small"
                                type="number"
                                placeholder="0"
                                value={row.advanceApplyAmount ?? ''}
                                inputProps={{ min: 0, max: row.outstanding, step: 0.01 }}
                                onChange={(e) => {
                                  const next = [...outstandingTransactions];
                                  const v = Math.max(0, Math.min(Number(e.target.value) || 0, row.outstanding || 0));
                                  next[idx] = {
                                    ...next[idx],
                                    advanceApplyAmount: v,
                                    payAmount: roundPay2(Math.max(0, (row.outstanding || 0) - v))
                                  };
                                  setOutstandingTransactions(next);
                                  const total = roundPay2(
                                    next.reduce((s, r) => s + (Number(r.payAmount) || 0), 0)
                                  );
                                  setPaymentData((prev) => ({ ...prev, amount: total }));
                                }}
                                sx={{ width: 120 }}
                              />
                            </TableCell>
                          )}
                          <TableCell align="right">
                            <TextField
                              size="small"
                              type="number"
                              value={row.payAmount}
                              inputProps={{
                                min: 0,
                                max: roundPay2(
                                  Math.max(0, (row.outstanding || 0) - (Number(row.advanceApplyAmount) || 0))
                                ),
                                step: 0.01
                              }}
                              onChange={(e) => {
                                const next = [...outstandingTransactions];
                                const maxBank = roundPay2(
                                  Math.max(0, (row.outstanding || 0) - (Number(row.advanceApplyAmount) || 0))
                                );
                                const v = Math.max(0, Math.min(Number(e.target.value) || 0, maxBank));
                                next[idx] = { ...next[idx], payAmount: v };
                                setOutstandingTransactions(next);
                                const total = roundPay2(
                                  next.reduce((s, r) => s + (Number(r.payAmount) || 0), 0)
                                );
                                setPaymentData((prev) => ({ ...prev, amount: total }));
                              }}
                              sx={{ width: 120 }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'info.50' }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  flexWrap="wrap"
                  gap={1}
                  sx={{ mb: 1 }}
                >
                  <Typography variant="subtitle2">
                    {payeeType === 'employee'
                      ? 'Apply bill from cash approval (Step 1 — like Taj deposit)'
                      : `Cash approvals — ${payeeType === 'employee' ? 'employee' : 'vendor'}`}
                  </Typography>
                </Stack>
                {payeeType === 'employee' && payeeCashApprovals.length > 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Enter <strong>Amount to use</strong> on each cash approval (deposit). Then allocate the same
                    total under <strong>Apply from advance</strong> on outstanding bills. Totals must match before you apply.
                  </Typography>
                )}
                {loadingPayeeCashApprovals ? (
                  <LinearProgress />
                ) : !(payeeType === 'employee' ? selectedEmployeePayee.employeeId : selectedPayee.vendorId) ? (
                  <Typography variant="body2" color="text.secondary">
                    Select a {payeeType === 'employee' ? 'employee' : 'vendor'} to view related cash approvals.
                  </Typography>
                ) : payeeCashApprovals.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No cash approvals found for this {payeeType === 'employee' ? 'employee' : 'vendor'}.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>CA #</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Approval date</TableCell>
                          <TableCell>Advance issued</TableCell>
                          <TableCell>GL account</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell align="right">Applied to bills</TableCell>
                          <TableCell align="right">Open</TableCell>
                          {payeeType === 'employee' && (
                            <TableCell align="right" sx={{ minWidth: 140 }}>
                              Amount to use
                            </TableCell>
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {payeeCashApprovals.map((row) => (
                          <TableRow key={row.cashApprovalId} hover>
                            <TableCell>
                              <Typography
                                component="span"
                                variant="body2"
                                sx={{
                                  color: 'primary.main',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  '&:hover': { textDecoration: 'underline' }
                                }}
                                onClick={() => {
                                  setPaymentDialogOpen(false);
                                  navigate(getCashApprovalViewPath(row));
                                }}
                              >
                                {row.caNumber || '—'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={row.status} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>{row.approvalDate ? formatDate(row.approvalDate) : '—'}</TableCell>
                            <TableCell>{row.advanceIssuedAt ? formatDate(row.advanceIssuedAt) : '—'}</TableCell>
                            <TableCell>{row.advanceGlAccountNumber || '—'}</TableCell>
                            <TableCell align="right">{formatPKR(row.advanceAmount || row.totalAmount || 0)}</TableCell>
                            <TableCell align="right">
                              {row.applied != null ? formatPKR(row.applied) : '—'}
                            </TableCell>
                            <TableCell align="right">
                              {row.open != null ? formatPKR(row.open) : '—'}
                            </TableCell>
                            {payeeType === 'employee' && (
                              <TableCell align="right">
                                {row.advanceIssuedAt && (row.open == null || row.open > 0) ? (
                                  <TextField
                                    size="small"
                                    type="number"
                                    placeholder="0"
                                    value={caApplyAmounts[row.cashApprovalId] ?? ''}
                                    inputProps={{
                                      min: 0,
                                      max: row.open ?? undefined,
                                      step: 0.01
                                    }}
                                    onChange={(e) => {
                                      const max = Number(row.open) || 0;
                                      const v = Math.max(0, Math.min(Number(e.target.value) || 0, max));
                                      const nextCa = {
                                        ...caApplyAmounts,
                                        [row.cashApprovalId]: v > 0 ? String(v) : ''
                                      };
                                      setCaApplyAmounts(nextCa);
                                      syncBillPaymentFromCaApply(
                                        nextCa,
                                        outstandingTransactions,
                                        selectedBill?._id
                                      );
                                    }}
                                    sx={{ width: 120 }}
                                  />
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    —
                                  </Typography>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
                {payeeType === 'vendor' && payeeVendorAdvances.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: 'success.dark', fontWeight: 700 }}>
                      Available Vendor Advances / Credits ({payeeVendorAdvances.length})
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Advance Ref</TableCell>
                            <TableCell>Payment Date</TableCell>
                            <TableCell>Method</TableCell>
                            <TableCell align="right">Original Amount</TableCell>
                            <TableCell align="right">Applied</TableCell>
                            <TableCell align="right">Open Balance</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {payeeVendorAdvances.map((adv) => (
                            <TableRow key={adv.vendorAdvanceId} hover>
                              <TableCell sx={{ fontWeight: 600 }}>{adv.reference}</TableCell>
                              <TableCell>{formatDate(adv.paymentDate)}</TableCell>
                              <TableCell>{adv.paymentMethod}</TableCell>
                              <TableCell align="right">{formatPKR(adv.amount)}</TableCell>
                              <TableCell align="right">{formatPKR(adv.applied)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                                {formatPKR(adv.open)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
                {payeeType === 'employee' && payeeCashApprovals.length > 0 && (
                  <>
                    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mt: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">Total from cash approvals:</Typography>
                        <Typography fontWeight={700} color="primary.main">
                          {formatPKR(employeeAdvanceApplyTotals.totalCaUsage)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">Total applied to bills:</Typography>
                        <Typography fontWeight={700}>
                          {formatPKR(employeeAdvanceApplyTotals.totalAllocatedToBills)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Remaining to allocate:</Typography>
                        <Typography
                          fontWeight={700}
                          color={
                            employeeAdvanceApplyTotals.remainingToAllocate === 0
                              ? 'success.main'
                              : 'warning.main'
                          }
                        >
                          {formatPKR(employeeAdvanceApplyTotals.remainingToAllocate)}
                        </Typography>
                      </Stack>
                    </Box>
                    {employeeAdvanceApplyTotals.totalCaUsage > 0 &&
                      employeeAdvanceApplyTotals.remainingToAllocate !== 0 && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Total from cash approvals must equal total applied to bills (like Taj Pay Invoices from Deposit).
                      </Alert>
                    )}
                    <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.5 }}>
                      <Button
                        size="small"
                        variant="contained"
                        color="info"
                        disabled={
                          processingCaApply ||
                          employeeAdvanceApplyTotals.totalCaUsage <= 0 ||
                          employeeAdvanceApplyTotals.remainingToAllocate !== 0 ||
                          !billPaymentFinAuth.accountsManagerUser ||
                          !billPaymentFinAuth.financeControllerUser
                        }
                        onClick={handleApplyCaAdvanceToBill}
                      >
                        {processingCaApply ? 'Applying…' : 'Apply advance to bills'}
                      </Button>
                    </Stack>
                  </>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {payeeType === 'employee' ? 'Bank payment (Step 2b)' : 'Payment details'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Payment Amount (PKR)" type="number"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: Number(e.target.value) })}
                size="small" inputProps={{ min: 0, step: 0.01 }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="WHT Rate %" type="number" placeholder="e.g. 4.5"
                value={paymentData.whtRate || ''}
                onChange={(e) => setPaymentData({ ...paymentData, whtRate: e.target.value })}
                size="small" inputProps={{ min: 0, max: 30, step: 0.01 }}
                helperText={paymentData.whtRate > 0
                  ? `WHT: PKR ${((paymentData.amount || 0) * (paymentData.whtRate / 100)).toFixed(2)} — Net to bank: PKR ${((paymentData.amount || 0) * (1 - paymentData.whtRate / 100)).toFixed(2)}`
                  : 'Leave 0 if no WHT applies'} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Method</InputLabel>
                <Select value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                  label="Payment Method">
                  <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                  <MenuItem value="check">Check / Cheque</MenuItem>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Pay From Account</InputLabel>
                <Select value={paymentData.bankAccountId || ''}
                  onChange={(e) => setPaymentData({ ...paymentData, bankAccountId: e.target.value })}
                  label="Pay From Account">
                  <MenuItem value="">— Auto (default bank) —</MenuItem>
                  {bankAccounts.map((item) => {
                    const account = item?.account || item;
                    const depth = item?.depth || 0;
                    return (
                      <MenuItem key={account._id} value={account._id}>
                        {formatPayFromAccountLabel(account, depth)}
                      </MenuItem>
                    );
                  })}
                </Select>
                {bankAccounts.length === 0 && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    No Cash and cash equivalents accounts found in the chart. Add accounts under that account type (or subaccounts under them) in Chart of Accounts.
                  </Typography>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Payment Date" type="date"
                value={paymentData.paymentDate}
                onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                InputLabelProps={{ shrink: true }} size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Reference / Cheque # / TT #"
                value={paymentData.reference}
                onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                size="small" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleRecordPayment}
            disabled={
              processingPayment
              || !billPaymentFinAuth.accountsManagerUser
              || !billPaymentFinAuth.financeControllerUser
            }
          >
            {processingPayment ? 'Processing…' : 'Post Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Bill Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth={selectedBill?.referenceType === 'purchase_order' ? 'lg' : 'md'}
        fullWidth
      >
        <DialogTitle>Edit Bill: {selectedBill?.billNumber}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Bill Number"
                value={editData.billNumber}
                onChange={(e) => setEditData({ ...editData, billNumber: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Total Amount"
                type="number"
                value={editData.totalAmount}
                onChange={(e) => setEditData({ ...editData, totalAmount: parseFloat(e.target.value) })}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Bill Date"
                type="date"
                value={editData.billDate}
                onChange={(e) => setEditData({ ...editData, billDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Due Date"
                type="date"
                value={editData.dueDate}
                onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
          </Grid>

          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Line Items</Typography>
          <Table size="small" sx={{ mb: 4, border: '1px solid', borderColor: 'grey.300' }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell>Description</TableCell>
                <TableCell align="right" width={100}>Quantity</TableCell>
                <TableCell align="right" width={150}>Unit Price</TableCell>
                <TableCell align="right" width={150}>Amount</TableCell>
                <TableCell width={48} />
              </TableRow>
            </TableHead>
            <TableBody>
              {(editData.lineItems || []).map((line, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <TextField 
                      fullWidth size="small" 
                      value={line.description || ''} 
                      onChange={e => {
                        const newLines = [...editData.lineItems];
                        newLines[idx].description = e.target.value;
                        setEditData({ ...editData, lineItems: newLines });
                      }}
                      placeholder="Item description"
                    />
                  </TableCell>
                  <TableCell>
                    <TextField 
                      fullWidth size="small" type="number"
                      value={line.quantity || 0} 
                      onChange={e => {
                        const newLines = [...editData.lineItems];
                        newLines[idx].quantity = parseFloat(e.target.value) || 0;
                        newLines[idx].amount = newLines[idx].quantity * newLines[idx].unitPrice;
                        setEditData({ ...editData, lineItems: newLines });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField 
                      fullWidth size="small" type="number"
                      value={line.unitPrice || 0} 
                      onChange={e => {
                        const newLines = [...editData.lineItems];
                        newLines[idx].unitPrice = parseFloat(e.target.value) || 0;
                        newLines[idx].amount = newLines[idx].quantity * newLines[idx].unitPrice;
                        setEditData({ ...editData, lineItems: newLines });
                      }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ verticalAlign: 'middle' }}>
                    {formatPKR(line.amount || 0)}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" color="error" onClick={() => {
                      const newLines = editData.lineItems.filter((_, i) => i !== idx);
                      setEditData({ ...editData, lineItems: newLines });
                    }}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={5}>
                  <Button startIcon={<AddIcon />} size="small" onClick={() => {
                    setEditData({
                      ...editData,
                      lineItems: [...(editData.lineItems || []), { description: '', quantity: 1, unitPrice: 0, amount: 0 }]
                    });
                  }}>
                    Add Line Item
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <Divider sx={{ mb: 3 }} />

          {selectedBill && (
            <Box sx={{ opacity: 0.9 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>Document Preview</Typography>
              <CentralizedStoreBillInvoiceBody 
                bill={{
                  ...selectedBill,
                  billId: editData.billNumber || selectedBill.billNumber,
                  billDate: editData.billDate || selectedBill.billDate,
                  createdAt: selectedBill.createdAt || selectedBill.billDate,
                  totalAmount: editData.totalAmount ?? selectedBill.totalAmount,
                  provider: selectedBill.vendorName || selectedBill.vendor?.name,
                  location: selectedBill.vendor?.address?.city || selectedBill.department || 'N/A',
                  notes: selectedBill.notes || selectedBill.internalNotes,
                  billLines: (editData.lineItems || []).map((line, idx) => ({
                    ...line,
                    itemName: line.description,
                    itemCode: line.itemCode || 'N/A',
                    amount: line.amount || (line.quantity * line.unitPrice)
                  }))
                }}
                showChargesSummary={true}
              />

              {(selectedBill?.referenceType === 'utility_bill' || selectedBill?.module === 'taj_utilities') && (() => {
                const getApprovalRows = () => {
                  const formatDateTime = (date) => {
                    if (!date) return '-';
                    return new Date(date).toLocaleString('en-PK', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    });
                  };

                  const rows = [];
                  if (selectedBill?.cashApproval?.workflowHistory?.length > 0) {
                    const history = [...selectedBill.cashApproval.workflowHistory].reverse();
                    history.forEach(entry => {
                      let actionDesc = entry.toStatus;
                      if (entry.comments) {
                        actionDesc += ` (${entry.comments})`;
                      }
                      rows.push({
                        authority: actionDesc,
                        name: [entry.changedBy?.firstName, entry.changedBy?.lastName].filter(Boolean).join(' ') || entry.changedBy?.name || 'System',
                        signatureUser: entry.changedBy,
                        dateTime: entry.changedAt ? formatDateTime(entry.changedAt) : '-'
                      });
                    });
                    return rows;
                  }
                  if (selectedBill?.poDetail?.po?.workflowHistory?.length > 0) {
                    const history = [...selectedBill.poDetail.po.workflowHistory].reverse();
                    history.forEach(entry => {
                      let actionDesc = entry.toStatus;
                      if (entry.comments) {
                        actionDesc += ` (${entry.comments})`;
                      }
                      rows.push({
                        authority: actionDesc,
                        name: [entry.changedBy?.firstName, entry.changedBy?.lastName].filter(Boolean).join(' ') || entry.changedBy?.name || 'System',
                        signatureUser: entry.changedBy,
                        dateTime: entry.changedAt ? formatDateTime(entry.changedAt) : '-'
                      });
                    });
                    return rows;
                  }
                  rows.push({
                    authority: 'Preparer',
                    name: [selectedBill?.createdBy?.firstName, selectedBill?.createdBy?.lastName].filter(Boolean).join(' ') || selectedBill?.createdBy?.name || '-',
                    signatureUser: selectedBill?.createdBy,
                    dateTime: selectedBill?.createdAt ? formatDateTime(selectedBill.createdAt) : '-'
                  });
                  if (selectedBill?.approval?.approvedBy) {
                    rows.push({
                      authority: 'Approver',
                      name: [selectedBill.approval.approvedBy.firstName, selectedBill.approval.approvedBy.lastName].filter(Boolean).join(' ') || selectedBill.approval.approvedBy.name || '-',
                      signatureUser: selectedBill.approval.approvedBy,
                      dateTime: selectedBill.approval.approvedDate ? formatDateTime(selectedBill.approval.approvedDate) : '-'
                    });
                  }
                  return rows;
                };
                const getSignatureSource = (row) => row?.signatureUser?.digitalSignature || '';
                return (
                  <Table
                    size="small"
                    sx={{
                      mt: 4,
                      mb: 2,
                      border: '1px solid',
                      borderColor: 'grey.300',
                      '& th': {
                        bgcolor: 'grey.100',
                        fontWeight: 800,
                        fontSize: 14,
                        borderBottom: '1px solid',
                        borderColor: 'grey.300'
                      },
                      '& td': {
                        fontSize: 14,
                        borderBottom: '1px solid',
                        borderColor: 'grey.200',
                        py: 1.4
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
                        <TableCell>Date & Time</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {getApprovalRows().map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell sx={{ fontWeight: 600 }}>{row.authority}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>
                            {getSignatureSource(row) ? (
                              <DigitalSignatureImage 
                                signatureUrl={getSignatureSource(row)} 
                                userName={row.name} 
                              />
                            ) : (
                              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                Not signed
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>{row.dateTime}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })()}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleUpdateBill}
          >
            Update Bill
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deletingBill && setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteIcon /> Delete Bill
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to delete bill <strong>{billToDelete?.billNumber}</strong> ({billToDelete?.vendorName}) for <strong>{formatPKR(billToDelete?.totalAmount || 0)}</strong>?
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            This will permanently remove the bill and its corresponding General Ledger journal entries.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deletingBill} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deletingBill}
          >
            {deletingBill ? 'Deleting...' : 'Delete Bill'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* QuickBooks-style Pay Bills Dialog */}
      <QuickbooksPayBillsModal
        open={payBillsModalOpen}
        onClose={() => {
          setPayBillsModalOpen(false);
          setSelectedBill(null);
          setSelectedPayee({ vendorId: '', vendorName: '' });
        }}
        onSuccess={fetchAccountsPayable}
        selectedCompanyId={selectedCompanyId}
        preselectedVendorId={selectedPayee.vendorId}
        preselectedVendorName={selectedPayee.vendorName}
        preselectedBillId={selectedBill?._id}
      />
    </Box>
  );
};

export default AccountsPayable;
