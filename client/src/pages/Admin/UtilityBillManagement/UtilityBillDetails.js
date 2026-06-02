import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Print as PrintIcon,
  Send as SendIcon,
  RestartAlt as RestartAltIcon
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import utilityBillService from '../../../services/utilityBillService';
import { getImageUrl, handleImageError } from '../../../utils/imageService';
import {
  UTILITY_MEMO_COL_WIDTHS,
  utilityMemoDateCellSx,
  utilityMemoRefCellSx,
  utilityMemoTableSx
} from '../../../utils/utilityBillMemoUtils';
import { DigitalSignatureImage } from '../../../components/common/DigitalSignatureImage';
import LineAttachmentsView from '../../../components/UtilityBill/LineAttachmentsView';
import ZoomPanImageToolbar from '../../../components/common/ZoomPanImageToolbar';
import { useZoomPanImage } from '../../../hooks/useZoomPanImage';
import {
  approverSearchOnInputChange,
  mergeApproverOptionList,
  optionsForManagerApprover,
  optionsForHodApprover
} from '../../../utils/dualApproverAutocomplete';
import {
  AuditReturnFeedbackSection,
  ResendToPreAuditDialog,
  useAdminWorkflowAuditReturn,
  isWorkflowAuditBlockingEditStatus
} from '../../../components/Admin/workflowAuditReturn';

const formatMemoDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit'
  }).replace(/ /g, '-');
};

const formatDateTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatMemoAmount = (amount) => new Intl.NumberFormat('en-PK', {
  maximumFractionDigits: 0
}).format(Number(amount || 0));

/** Centralized store commercial invoice (print + on-screen) */
const formatInvoiceDateDmy = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).replace(/ /g, '-');
};

const formatInvoiceTime12h = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

const formatDecimalPk = (amount) => new Intl.NumberFormat('en-PK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(Number(amount || 0));

const displayValue = (value) => value || '';
const userDisplayName = (user) => {
  if (!user) return '';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.employeeId || '';
};
const getUserId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id || value.id || value.userId || '');
};
const getSignatureSource = (row) => row?.signatureUser?.digitalSignature || '';

const utilityBillObservationKey = (obs) => {
  if (!obs) return '';
  return String(obs._id || obs.id || '');
};

/** Bill detail page: payment recording is not offered here (removed from toolbar). */
const UtilityBillDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isCentralizedStoreContext = location.pathname.startsWith('/admin/centralized-store');
  const billsListPath = isCentralizedStoreContext ? '/admin/centralized-store/bills' : '/admin/utility-bills';
  const billEditPath = (billId) =>
    isCentralizedStoreContext
      ? `/admin/centralized-store/bill/${billId}/edit`
      : `/admin/utility-bills/${billId}/edit`;
  const { user } = useAuth();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [managerApprover, setManagerApprover] = useState(null);
  const [hodApprover, setHodApprover] = useState(null);
  const [approverOptions, setApproverOptions] = useState([]);
  const [approverLoading, setApproverLoading] = useState(false);
  const submitRequesterId = getUserId(user);
  const mergedSubmitApprovers = useMemo(
    () => mergeApproverOptionList(approverOptions, managerApprover, hodApprover),
    [approverOptions, managerApprover, hodApprover]
  );
  const managerSubmitOptions = useMemo(
    () => optionsForManagerApprover({ optionsMerged: mergedSubmitApprovers, requesterId: submitRequesterId, hodApprover }),
    [mergedSubmitApprovers, submitRequesterId, hodApprover]
  );
  const hodSubmitOptions = useMemo(
    () => optionsForHodApprover({ optionsMerged: mergedSubmitApprovers, requesterId: submitRequesterId, managerApprover }),
    [mergedSubmitApprovers, submitRequesterId, managerApprover]
  );
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const billImageZoomPan = useZoomPanImage(imageModalOpen ? bill?.billImage : null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [postingFinance, setPostingFinance] = useState(false);
  useEffect(() => {
    fetchBill();
  }, [id]);

  const fetchBill = async () => {
    try {
      setLoading(true);
      const response = await utilityBillService.getUtilityBill(id);
      setBill(response.data);
    } catch (err) {
      setError('Failed to fetch utility bill details');
      console.error('Error fetching bill:', err);
    } finally {
      setLoading(false);
    }
  };

  const getGrandTotal = () => bill?.grandTotal ?? ((Number(bill?.amount) || 0) + (Number(bill?.balanceAmount) || 0));
  const getBalanceToPay = () => (
    Number(bill?.balanceAmount) || Math.max((Number(getGrandTotal()) || 0) - (Number(bill?.lastMonthAmount) || 0), 0)
  );
  const getForWhat = () => bill?.forWhat || bill?.description || '';
  const getPreparedBy = () => (
    userDisplayName(bill?.createdBy)
  );
  const getApprovedBy = () => userDisplayName(bill?.approvedBy);
  const getApprovalRows = () => {
    const chain = bill?.approvalChain || [];
    const workflowHistory = bill?.workflowHistory || [];
    const normalize = (value) => String(value || '').trim().toLowerCase();
    const history = Array.isArray(workflowHistory) ? [...workflowHistory].reverse() : [];
    const findLatestAuditEntry = (keywords = []) => history.find((entry) => {
      const toStatus = normalize(entry?.toStatus);
      const fromStatus = normalize(entry?.fromStatus);
      return keywords.some((keyword) => toStatus.includes(keyword) || fromStatus.includes(keyword));
    });
    const findLatestByToStatus = (accepted = []) => history.find((entry) => {
      const toStatus = normalize(entry?.toStatus);
      return accepted.some((status) => (
        toStatus === status || toStatus.startsWith(status)
      ));
    });

    const findPreferredAuditEntry = (accepted = []) => {
      const entries = history.filter((entry) => {
        const toStatus = normalize(entry?.toStatus);
        return accepted.some((status) => toStatus === status || toStatus.startsWith(status));
      });
      return entries.find((e) => e?.stampUsed && e?.stampImage)
        || entries.find((e) => e?.changedBy?.digitalSignature)
        || entries[0];
    };
    const preAuditActorEntry = findPreferredAuditEntry([
      'forwarded to audit director',
      'initial audit approval'
    ]) || findLatestAuditEntry([
      'forwarded to audit director',
      'initial audit approval'
    ]);
    const directorApproval = findLatestByToStatus([
      'approved (from forwarded to audit director)',
      'approved (from send to audit)'
    ]) || findLatestAuditEntry([
      'approved (from forwarded to audit director)',
      'approved (from send to audit)'
    ]);

    const rows = [
      {
        authority: 'Sig of Requester',
        name: getPreparedBy(),
        signature: '',
        signatureUser: bill?.createdBy,
        dateTime: formatDateTime(bill?.createdAt)
      },
      {
        authority: 'Manager Approver',
        name: userDisplayName(chain[0]?.approver),
        signature: chain[0]?.status === 'approved' ? userDisplayName(chain[0]?.approver) : '',
        signatureUser: chain[0]?.status === 'approved' ? chain[0]?.approver : null,
        dateTime: chain[0]?.status === 'approved' ? formatDateTime(chain[0]?.actedAt) : ''
      },
      {
        authority: 'Head Of Department Approver',
        name: userDisplayName(chain[1]?.approver),
        signature: chain[1]?.status === 'approved' ? userDisplayName(chain[1]?.approver) : '',
        signatureUser: chain[1]?.status === 'approved' ? chain[1]?.approver : null,
        dateTime: chain[1]?.status === 'approved' ? formatDateTime(chain[1]?.actedAt) : ''
      }
    ];

    rows.push(
      {
        authority: 'Pre-Audit Authority',
        name: userDisplayName(preAuditActorEntry?.changedBy),
        signature: preAuditActorEntry?.changedBy ? userDisplayName(preAuditActorEntry.changedBy) : '',
        signatureUser: preAuditActorEntry?.changedBy || null,
        signaturePath: preAuditActorEntry?.stampUsed && preAuditActorEntry?.stampImage
          ? preAuditActorEntry.stampImage
          : preAuditActorEntry?.changedBy?.digitalSignature || '',
        dateTime: formatDateTime(preAuditActorEntry?.changedAt)
      },
      {
        authority: 'Audit Director',
        name: userDisplayName(directorApproval?.changedBy),
        signature: directorApproval?.changedBy ? userDisplayName(directorApproval.changedBy) : '',
        signatureUser: directorApproval?.changedBy || null,
        signaturePath: directorApproval?.stampUsed && directorApproval?.stampImage
          ? directorApproval.stampImage
          : directorApproval?.changedBy?.digitalSignature || '',
        dateTime: formatDateTime(directorApproval?.changedAt)
      }
    );

    return rows;
  };
  const getStampRows = () => {
    const workflowHistory = bill?.workflowHistory || [];
    const normalize = (value) => String(value || '').trim().toLowerCase();
    const history = Array.isArray(workflowHistory) ? [...workflowHistory].reverse() : [];
    const findStampedEntry = (accepted = []) => history.find((entry) => {
      const toStatus = normalize(entry?.toStatus);
      return (entry?.stampUsed && entry?.stampImage)
        && accepted.some((status) => toStatus === status || toStatus.startsWith(status));
    });
    const preAuditStamp = findStampedEntry(['forwarded to audit director', 'initial audit approval']);
    const directorStamp = findStampedEntry(['approved (from forwarded to audit director)', 'approved (from send to audit)']);
    return [
      { authority: 'Pre-Audit Authority Stamp', stampImage: preAuditStamp?.stampImage || '', dateTime: formatDateTime(preAuditStamp?.changedAt) },
      { authority: 'Audit Director Stamp', stampImage: directorStamp?.stampImage || '', dateTime: formatDateTime(directorStamp?.changedAt) }
    ].filter((row) => row.stampImage);
  };
  const getPrimaryHeading = () => (bill?.accountHead || bill?.site || bill?.location || bill?.provider || bill?.utilityType || 'Utility Bill').toUpperCase();
  const getSecondaryHeading = () =>
    [bill?.provider, bill?.utilityType].filter(Boolean).join(' - ') || '';
  const isCentralizedStoreInvoice = Boolean(
    bill?.useCentralizedStore && Array.isArray(bill?.billLines) && bill.billLines.length > 0
  );
  const getStoreInvoiceOrgTitle = () =>
    (displayValue(bill?.site) || displayValue(bill?.accountHead) || displayValue(bill?.provider) || 'Bill').trim();
  const getVendorSupplierLine = () => {
    const v = bill?.vendorId;
    if (v && typeof v === 'object') {
      const sid = v.supplierId != null && String(v.supplierId).trim() !== '' ? `${String(v.supplierId).trim()} ` : '';
      return `${sid}${v.name || ''}`.trim() || displayValue(bill?.provider);
    }
    return displayValue(bill?.provider);
  };
  const getStoreLineProductCode = (line) => {
    const snap = displayValue(line?.itemCode);
    if (snap) return snap;
    const si = line?.storeItem;
    if (si && typeof si === 'object' && si.code) return String(si.code).trim();
    return '—';
  };
  const getStoreLineDescription = (line) => {
    const parts = [line?.itemName, line?.description].filter(Boolean);
    return parts.join(' — ') || '—';
  };
  const getStoreInvoiceNarration = () => displayValue(bill?.notes) || getForWhat() || '—';
  const getStoreInvoiceLinesTotal = () =>
    (bill?.billLines || []).reduce((s, l) => s + (Number(l?.amount) || 0), 0) || Number(bill?.amount) || 0;

  const approvalStatus = bill?.approvalStatus || 'Draft';
  const pendingApproval = (bill?.approvalChain || []).find((step) => step.status === 'pending');
  const pendingApproverId = getUserId(pendingApproval?.approver);
  const userId = getUserId(user);
  const requesterId = getUserId(bill?.createdBy);
  const isRequester = requesterId && userId && requesterId === userId;
  const isPendingApprover = pendingApproverId && userId && pendingApproverId === userId && !isRequester;
  const canSubmitForApproval = ['Draft', 'Rejected'].includes(approvalStatus);
  const canApproveReject = approvalStatus === 'Submitted' && isPendingApprover;
  const computeAuditUi = useCallback((b) => ({
    auditBlocksEdit:
      b?.approvalStatus === 'Approved' &&
      isWorkflowAuditBlockingEditStatus(b?.auditStatus),
    canResendToPreAudit:
      b?.auditStatus === 'Returned from Audit' &&
      b?.approvalStatus === 'Approved'
  }), []);

  const resendToAuditApi = useCallback(
    async (payload) => {
      const response = await utilityBillService.resendUtilityBillToAudit(bill._id, payload);
      return response.data;
    },
    [bill?._id]
  );

  const workflowAudit = useAdminWorkflowAuditReturn({
    document: bill,
    computeAuditUi,
    getObservationKey: utilityBillObservationKey,
    onResend: resendToAuditApi,
    onDocumentUpdate: setBill,
    onError: (message) => setSnackbar({ open: true, message, severity: 'error' }),
    onSuccess: (message) => setSnackbar({ open: true, message, severity: 'success' })
  });

  const getApprovalColor = (status) => {
    switch (status) {
      case 'Approved': return 'success';
      case 'Submitted': return 'warning';
      case 'Rejected': return 'error';
      default: return 'default';
    }
  };

  const getAuditStatusColor = (auditLabel) => {
    const s = String(auditLabel || '');
    if (s === 'Returned from Audit' || s.includes('Rejected')) return 'error';
    if (s.startsWith('Approved')) return 'success';
    if (s === 'Not Sent') return 'default';
    return 'warning';
  };

  const isAuditFinallyApproved = String(bill?.auditStatus || '').startsWith('Approved (from ');
  const needsFinancePost = isAuditFinallyApproved && !bill?.financeApBillId;

  const handlePostToFinance = async () => {
    try {
      setPostingFinance(true);
      const response = await utilityBillService.postUtilityBillToFinance(bill._id);
      setBill(response.data?.bill || response.data);
      setSnackbar({ open: true, message: response.message || 'Posted to Finance', severity: 'success' });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to post to Finance',
        severity: 'error'
      });
    } finally {
      setPostingFinance(false);
    }
  };

  const loadApproverOptions = async (search = '') => {
    try {
      setApproverLoading(true);
      const response = await utilityBillService.getApproverCandidates({ search, limit: 50 });
      setApproverOptions(response.data || []);
    } catch {
      setApproverOptions([]);
    } finally {
      setApproverLoading(false);
    }
  };

  useEffect(() => {
    if (submitDialogOpen) loadApproverOptions('');
  }, [submitDialogOpen]);

  const handleSubmitForApproval = async () => {
    if (!managerApprover?._id || !hodApprover?._id) {
      setSnackbar({ open: true, message: 'Select Manager and Head Of Department approvers', severity: 'error' });
      return;
    }

    if ([getUserId(managerApprover), getUserId(hodApprover)].includes(getUserId(user))) {
      setSnackbar({ open: true, message: 'Requester cannot be selected as Manager or Head Of Department approver', severity: 'error' });
      return;
    }

    if (managerApprover._id === hodApprover._id) {
      setSnackbar({ open: true, message: 'Manager and Head Of Department approvers must be different', severity: 'error' });
      return;
    }

    try {
      const response = await utilityBillService.submitUtilityBill(bill._id, { approverIds: [managerApprover._id, hodApprover._id] });
      setBill(response.data);
      setSubmitDialogOpen(false);
      setManagerApprover(null);
      setHodApprover(null);
      setSnackbar({ open: true, message: 'Utility bill submitted for approval', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to submit utility bill', severity: 'error' });
    }
  };

  const handleApprove = async () => {
    try {
      const response = await utilityBillService.approveUtilityBill(bill._id);
      setBill(response.data);
      setSnackbar({ open: true, message: 'Utility bill approved', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to approve utility bill', severity: 'error' });
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('Please enter rejection reason:');
    if (!reason) return;

    try {
      const response = await utilityBillService.rejectUtilityBill(bill._id, reason);
      setBill(response.data);
      setSnackbar({ open: true, message: 'Utility bill rejected', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to reject utility bill', severity: 'error' });
    }
  };

  const buildMemoTableBodyHtml = () => `
              <tr class="body-row">
                <td>${formatMemoDate(bill?.billDate)}</td>
                <td>${displayValue(bill?.accountNumber)}</td>
                <td>${displayValue(bill?.provider)}</td>
                <td>${getForWhat()}</td>
                <td class="amount-col">${formatMemoAmount(bill?.amount)}</td>
                <td class="last-col">${formatMemoAmount(bill?.lastMonthAmount)}</td>
              </tr>
              <tr class="totals"><td colspan="4" class="total-label">Grand Total</td><td class="amount-col">${formatMemoAmount(getGrandTotal())}</td><td></td></tr>
              <tr class="totals"><td colspan="4" class="total-label">Cash Deposit Last Month</td><td class="amount-col">${formatMemoAmount(bill?.lastMonthAmount)}</td><td></td></tr>
              <tr class="totals"><td colspan="4" class="total-label">Balance Amount to be Paid</td><td class="amount-col">${formatMemoAmount(getBalanceToPay())}</td><td></td></tr>`;

  const getStoreCentralizedPrintHtml = () => {
    const esc = (s) => String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const lines = bill?.billLines || [];
    const totalVal = getStoreInvoiceLinesTotal();
    const bd = bill?.billDate ? new Date(bill.billDate) : null;
    const created = bill?.createdAt ? new Date(bill.createdAt) : bd;
    const rowHtml = lines.map((line, i) => {
      const amt = Number(line.amount) || 0;
      const qty = 1;
      const rate = amt;
      return `<tr class="data-row">
        <td class="c-num">${i + 1}</td>
        <td class="c-code">${esc(getStoreLineProductCode(line))}</td>
        <td class="c-desc">${esc(getStoreLineDescription(line))}</td>
        <td class="c-center">Nos</td>
        <td class="c-num">${formatDecimalPk(qty)}</td>
        <td class="c-num">${formatDecimalPk(rate)}</td>
        <td class="c-num">${formatDecimalPk(amt)}</td>
        <td class="c-center">0 %</td>
        <td class="c-num">${formatDecimalPk(amt)}</td>
      </tr>`;
    }).join('');
    const charges = [
      ['Service Charges', 0],
      ['Freight Charges', 0],
      ['Packing Charges', 0],
      ['Loading Charges', 0],
      ['Income Tax', 0],
      ['Special Excise Duty', 0],
      ['Custom Duty', 0],
      ['Sales Tax', 0]
    ];
    const chargesHtml = charges
      .map(([label, val]) => `<div class="sum-row"><span>${esc(label)}</span><span>${formatDecimalPk(val)}</span></div>`)
      .join('');
    const orgTitle = esc(getStoreInvoiceOrgTitle());
    const narration = esc(getStoreInvoiceNarration());

    return `<!DOCTYPE html>
<html>
  <head>
    <title>Bill - ${esc(displayValue(bill?.billId))}</title>
    <style>
      body { font-family: Georgia, "Times New Roman", serif; color: #111; margin: 0; padding: 18px 22px; font-size: 12px; background: #fff; }
      .sheet { max-width: 900px; margin: 0 auto; }
      .doc-title { text-align: center; margin-bottom: 14px; }
      .doc-title .org { font-size: 20px; font-weight: 700; letter-spacing: 0.3px; }
      .doc-title .sub { font-size: 15px; font-weight: 700; margin-top: 2px; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 12px; border-bottom: 1px solid #bbb; padding-bottom: 10px; }
      .meta-block { line-height: 1.55; }
      .meta-block-right { text-align: right; }
      .meta-row { display: grid; grid-template-columns: 92px 1fr; font-weight: 700; }
      .meta-row-time { display: flex; justify-content: flex-end; align-items: baseline; gap: 8px; font-weight: 700; }
      .meta-row .lbl, .meta-row-time .lbl { color: #333; }
      .narration { background: #ffe7c2; border: 1px solid #e8b86a; padding: 8px 10px; margin: 10px 0 14px; font-weight: 700; line-height: 1.4; }
      table.inv { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 4px; }
      table.inv th { font-size: 10px; font-weight: 800; text-align: center; border: 1px solid #999; padding: 6px 4px; background: #f2f2f2; vertical-align: middle; line-height: 1.2; }
      table.inv td { border: 1px solid #aaa; padding: 7px 6px; vertical-align: top; font-size: 11px; }
      table.inv .c-num { text-align: right; font-variant-numeric: tabular-nums; }
      table.inv .c-center { text-align: center; }
      table.inv .c-code { font-size: 10.5px; word-break: break-all; }
      table.inv .c-desc { text-align: left; line-height: 1.35; }
      table.inv tr.subtotal td { font-weight: 800; border-top: 2px solid #333; }
      .footer-sum { display: flex; justify-content: flex-end; margin-top: 10px; }
      .sum-box { width: 280px; font-size: 11px; }
      .sum-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #ddd; }
      .sum-row.net { border-bottom: 0; margin-top: 6px; padding-top: 8px; font-weight: 800; font-size: 12px; }
      .sum-row.net span:last-child { border-bottom: 3px double #111; padding-bottom: 2px; }
      .approval-table { margin-top: 36px; border: 1px solid #999; width: 100%; border-collapse: collapse; }
      .approval-table th { text-align: left; font-size: 11px; background: #f5f5f5; border-bottom: 1px solid #999; padding: 6px 8px; }
      .approval-table td { border-bottom: 1px solid #ddd; padding: 6px 8px; font-size: 11px; }
      .approval-table tr:last-child td { border-bottom: 0; }
      @media print { body { padding: 12px; } }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="doc-title">
        <div class="org">${orgTitle}</div>
        <div class="sub">Bill</div>
      </div>
      <div class="meta">
        <div class="meta-block">
          <div class="meta-row"><span class="lbl">Date</span><span>${esc(formatInvoiceDateDmy(bd))}</span></div>
          <div class="meta-row"><span class="lbl">Bill ID</span><span>${esc(displayValue(bill?.billId))}</span></div>
          <div class="meta-row"><span class="lbl">Supplier</span><span>${esc(getVendorSupplierLine())}</span></div>
          <div class="meta-row"><span class="lbl">Address</span><span>${esc(displayValue(bill?.location))}</span></div>
        </div>
        <div class="meta-block meta-block-right">
          <div class="meta-row-time"><span class="lbl">Time</span><span>${esc(formatInvoiceTime12h(created))}</span></div>
        </div>
      </div>
      <div class="narration">Narration: ${narration}</div>
      <table class="inv">
        <thead>
          <tr>
            <th style="width:4%">S.<br/>No</th>
            <th style="width:11%">Product<br/>Code</th>
            <th style="width:28%">Description</th>
            <th style="width:7%">Units</th>
            <th style="width:9%">Quantity</th>
            <th style="width:10%">Rate</th>
            <th style="width:12%">Value Excluding<br/>Sales Tax</th>
            <th style="width:7%">Discount</th>
            <th style="width:12%">Net<br/>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowHtml}
          <tr class="subtotal">
            <td colspan="6" style="text-align:right;border-right:1px solid #aaa;">Sub Total</td>
            <td class="c-num">${formatDecimalPk(totalVal)}</td>
            <td></td>
            <td class="c-num">${formatDecimalPk(totalVal)}</td>
          </tr>
        </tbody>
      </table>
      <div class="footer-sum">
        <div class="sum-box">
          ${chargesHtml}
          <div class="sum-row net"><span>Net Total</span><span>${formatDecimalPk(totalVal)}</span></div>
        </div>
      </div>
      <table class="approval-table">
        <thead><tr><th>Authority</th><th>Name</th><th>Digital Signature</th><th>Date &amp; Time</th></tr></thead>
        <tbody>
          ${getApprovalRows().map((row) => `
            <tr>
              <td style="font-weight:800">${esc(row.authority)}</td>
              <td>${esc(row.name || '-')}</td>
              <td>${
                getSignatureSource(row)
                  ? `<img src="${esc(getImageUrl(getSignatureSource(row)))}" alt="" style="max-height:38px;max-width:130px;object-fit:contain;" />`
                  : esc(row.signature || '-')
              }</td>
              <td>${esc(row.dateTime || '-')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </body>
</html>`;
  };

  const getPrintContent = () => {
    if (isCentralizedStoreInvoice) {
      return getStoreCentralizedPrintHtml();
    }
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Utility Bill - ${displayValue(bill?.billId)}</title>
        <style>
          body { font-family: Georgia, "Times New Roman", serif; color: #141414; margin: 20px; font-size: 12px; background: #fff; }
          .memo-paper { max-width: 960px; margin: 0 auto; padding: 38px 30px 30px; }
          .header { text-align: center; line-height: 1.15; margin-bottom: 14px; }
          .company { font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: .35px; }
          .title { font-size: 16px; font-weight: 700; margin-top: 2px; }
          .top-meta { display: grid; grid-template-columns: 1fr 170px; align-items: start; margin-bottom: 26px; }
          .left-meta { display: grid; grid-template-columns: 62px 1fr; width: 360px; margin-left: 150px; line-height: 1.35; font-weight: 700; }
          .right-meta { text-align: right; line-height: 2; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th { font-size: 10.5px; font-weight: 800; text-align: center; border-bottom: 1px solid #c7c7c7; padding: 7px 8px; color: #333; background: #f8f8f8; }
          td { padding: 9px 8px; vertical-align: top; }
          .main-table { margin-top: 6px; border-top: 1px solid #c7c7c7; border-bottom: 1px solid #c7c7c7; }
          .date-col { width: 11%; white-space: normal; }
          .ref-col { width: 14%; word-break: break-word; overflow-wrap: anywhere; }
          .paid-col { width: 20%; }
          .for-col { width: 27%; }
          .amount-col { width: 13%; text-align: right; }
          .last-col { width: 15%; text-align: right; }
          .main-table th, .main-table td { border-right: 1px solid #ededed; }
          .main-table th:last-child, .main-table td:last-child { border-right: 0; }
          .body-row td { border-top: 1px solid #d9d9d9; }
          .totals td { padding-top: 4px; padding-bottom: 4px; font-weight: 700; }
          .total-label { text-align: right; }
          .approval-table { margin-top: 56px; border: 1px solid #d8d8d8; }
          .approval-table th { text-align: left; font-size: 12px; background: #f5f5f5; border-bottom: 1px solid #d8d8d8; }
          .approval-table td { border-bottom: 1px solid #e0e0e0; }
          .approval-table tr:last-child td { border-bottom: 0; }
          .authority { font-weight: 800; }
          @media print { body { margin: 0; } .memo-paper { padding-top: 26px; } }
        </style>
      </head>
      <body>
        <div class="memo-paper">
          <div class="header">
            <div class="company">${getPrimaryHeading()}</div>
            <div class="title">${getSecondaryHeading()}</div>
          </div>
          <div class="top-meta">
            <div class="left-meta">
              <span>SITE :</span><span>${displayValue(bill?.site || bill?.location)}</span>
              <span>From:</span><span>${displayValue(bill?.department)}</span>
              <span>Custodian:</span><span>${displayValue(bill?.custodian)}</span>
            </div>
            <div class="right-meta">
              <div>${formatMemoDate(bill?.billDate)}</div>
              <div>${displayValue(bill?.billId)}</div>
            </div>
          </div>
          <table class="main-table">
            <colgroup>
              <col class="date-col" />
              <col class="ref-col" />
              <col class="paid-col" />
              <col class="for-col" />
              <col class="amount-col" />
              <col class="last-col" />
            </colgroup>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference<br />No</th>
                <th>To Whom Paid</th>
                <th class="for-col">For What</th>
                <th>Amount</th>
                <th>Last Month Amount</th>
              </tr>
            </thead>
            <tbody>
              ${buildMemoTableBodyHtml()}
            </tbody>
          </table>
          <table class="approval-table">
            <thead>
              <tr>
                <th>Authority</th>
                <th>Name</th>
                <th>Digital Signature</th>
                <th>Date &amp; Time</th>
              </tr>
            </thead>
            <tbody>
              ${getApprovalRows().map((row) => `
                <tr>
                  <td class="authority">${row.authority}</td>
                  <td>${row.name || '-'}</td>
                  <td>${
                    getSignatureSource(row)
                      ? `<img src="${getImageUrl(getSignatureSource(row))}" alt="${row.authority} signature" style="max-height:42px;max-width:135px;object-fit:contain;" />`
                      : row.signature || '-'
                  }</td>
                  <td>${row.dateTime || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
  };

  const handlePrint = () => {
    if (!bill) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Unable to open print window. Please allow pop-ups and try again.');
      return;
    }

    printWindow.document.write(getPrintContent());
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width="30%" height={48} />
        <Skeleton variant="rectangular" height={620} sx={{ mt: 2 }} />
      </Box>
    );
  }

  if (!bill) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Utility bill not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(billsListPath)}>
          Back to Bills
        </Button>
        <Stack direction="row" spacing={1}>
          <Chip label={`Approval: ${approvalStatus}`} color={getApprovalColor(approvalStatus)} sx={{ alignSelf: 'center' }} />
          {bill.auditStatus && bill.auditStatus !== 'Not Sent' && (
            <Chip
              label={`Audit: ${bill.auditStatus}`}
              color={getAuditStatusColor(bill.auditStatus)}
              sx={{ alignSelf: 'center' }}
              variant="outlined"
            />
          )}
          {canSubmitForApproval && (
            <Button variant="contained" color="info" startIcon={<SendIcon />} onClick={() => setSubmitDialogOpen(true)}>
              Submit
            </Button>
          )}
          {canApproveReject && (
            <>
              <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={handleApprove}>
                Approve
              </Button>
              <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={handleReject}>
                Reject
              </Button>
            </>
          )}
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
            Print
          </Button>
          {workflowAudit.canResendToPreAudit && (
            <Button variant="contained" color="warning" startIcon={<RestartAltIcon />} onClick={workflowAudit.openResendDialog}>
              Resend to Pre-Audit
            </Button>
          )}
          <Tooltip
            title={
              workflowAudit.auditBlocksEdit
                ? 'This bill is with audit and cannot be edited until it is returned for correction.'
                : 'Edit bill fields'
            }
          >
            <span>
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                disabled={workflowAudit.auditBlocksEdit}
                onClick={() => navigate(billEditPath(bill._id))}
              >
                Edit Bill
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {needsFinancePost && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Audit approved but this bill is not in Finance yet. Post it to create Accounts Payable and debit utilities account 6200.
          <Button
            variant="contained"
            size="small"
            sx={{ ml: 1 }}
            disabled={postingFinance}
            onClick={handlePostToFinance}
          >
            {postingFinance ? 'Posting…' : 'Post to Finance'}
          </Button>
        </Alert>
      )}

      <Paper
        elevation={2}
        sx={{
          maxWidth: 1050,
          mx: 'auto',
          p: { xs: 2.25, md: 5 },
          bgcolor: 'background.paper',
          color: '#151515',
          borderRadius: 1.5,
          border: '1px solid',
          borderColor: 'grey.200',
          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)'
        }}
      >
        <Box
          textAlign="center"
          sx={{
            lineHeight: 1.12,
            mb: 1.75,
            pb: 1.25,
            borderBottom: '1px solid',
            borderColor: 'grey.200'
          }}
        >
          {isCentralizedStoreInvoice ? (
            <>
              <Typography
                variant="h5"
                sx={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontWeight: 700,
                  fontSize: { xs: 20, md: 22 },
                  textTransform: 'none',
                  letterSpacing: 0.2
                }}
              >
                {getStoreInvoiceOrgTitle()}
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontWeight: 700,
                  fontSize: { xs: 16, md: 18 },
                  mt: 0.5
                }}
              >
                Bill
              </Typography>
            </>
          ) : (
            <>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  fontSize: { xs: 17, md: 19 }
                }}
              >
                {getPrimaryHeading()}
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontWeight: 700,
                  fontSize: { xs: 15, md: 17 }
                }}
              >
                {getSecondaryHeading()}
              </Typography>
            </>
          )}
        </Box>

        <AuditReturnFeedbackSection
          visualVariant="settlement"
          auditStatus={bill.auditStatus}
          returnedAuditStatus="Returned from Audit"
          latestReturnHistory={workflowAudit.latestReturnHistory}
          observations={workflowAudit.observations}
          getObservationKey={utilityBillObservationKey}
          formatDateTime={formatDateTime}
          userDisplayName={userDisplayName}
          answerTitle="Administration response:"
          answeredIntro={(
            <>
              Replies below are shown on this bill and in Pre-Audit when you resend. Open observations still need a reply
              in <strong>Resend to Pre-Audit</strong>.
            </>
          )}
          returnedIntro={(
            <>
              This bill was returned for correction. Review the points below, use <strong>Edit Bill</strong> to update the
              memo if needed, then use <strong>Resend to Pre-Audit</strong> when you are ready.
            </>
          )}
        />

        {isCentralizedStoreInvoice ? (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: { xs: 2, md: 3 },
                mb: 2,
                pb: 2,
                borderBottom: '1px solid',
                borderColor: 'grey.400'
              }}
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: '88px 1fr', rowGap: 0.75, columnGap: 1, fontSize: 13 }}>
                <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Date</Typography>
                <Typography sx={{ fontWeight: 700 }}>{formatInvoiceDateDmy(bill.billDate)}</Typography>
                <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Bill ID</Typography>
                <Typography sx={{ fontWeight: 700 }}>{bill.billId}</Typography>
                <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Supplier</Typography>
                <Typography sx={{ fontWeight: 700 }}>{getVendorSupplierLine()}</Typography>
                <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Address</Typography>
                <Typography sx={{ fontWeight: 700 }}>{displayValue(bill.location)}</Typography>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: { xs: 'flex-start', md: 'flex-end' },
                  alignItems: 'baseline',
                  gap: 1,
                  fontSize: 13
                }}
              >
                <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Time</Typography>
                <Typography sx={{ fontWeight: 700 }}>
                  {formatInvoiceTime12h(bill.createdAt || bill.billDate)}
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                bgcolor: '#ffe7c2',
                border: '1px solid #e8b86a',
                p: 1.5,
                mb: 2,
                fontWeight: 700,
                fontSize: 13,
                lineHeight: 1.45
              }}
            >
              Narration: {getStoreInvoiceNarration()}
            </Box>
            <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
              <Table
                size="small"
                sx={{
                  border: '1px solid',
                  borderColor: 'grey.500',
                  '& th': {
                    bgcolor: 'grey.100',
                    border: '1px solid',
                    borderColor: 'grey.500',
                    fontSize: 11,
                    fontWeight: 800,
                    textAlign: 'center',
                    lineHeight: 1.2,
                    py: 1,
                    px: 0.5
                  },
                  '& td': {
                    border: '1px solid',
                    borderColor: 'grey.400',
                    fontSize: 12,
                    py: 1,
                    px: 0.75,
                    verticalAlign: 'top'
                  }
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '4%' }}>S. No</TableCell>
                    <TableCell sx={{ width: '11%' }}>Product Code</TableCell>
                    <TableCell sx={{ width: '22%' }}>Description</TableCell>
                    <TableCell sx={{ width: '14%', minWidth: 120 }}>Attachments</TableCell>
                    <TableCell sx={{ width: '7%' }}>Units</TableCell>
                    <TableCell sx={{ width: '9%', textAlign: 'right' }}>Quantity</TableCell>
                    <TableCell sx={{ width: '10%', textAlign: 'right' }}>Rate</TableCell>
                    <TableCell sx={{ width: '12%', textAlign: 'right' }}>Value Excluding Sales Tax</TableCell>
                    <TableCell sx={{ width: '7%', textAlign: 'center' }}>Discount</TableCell>
                    <TableCell sx={{ width: '12%', textAlign: 'right' }}>Net Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(bill.billLines || []).map((line, i) => {
                    const amt = Number(line.amount) || 0;
                    return (
                      <TableRow key={line._id || line.storeItem || i}>
                        <TableCell sx={{ textAlign: 'center' }}>{i + 1}</TableCell>
                        <TableCell sx={{ wordBreak: 'break-all', fontSize: 11 }}>{getStoreLineProductCode(line)}</TableCell>
                        <TableCell sx={{ lineHeight: 1.35 }}>{getStoreLineDescription(line)}</TableCell>
                        <TableCell>
                          <LineAttachmentsView line={line} />
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>Nos</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatDecimalPk(1)}</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatDecimalPk(amt)}</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatDecimalPk(amt)}</TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>0 %</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                          {formatDecimalPk(amt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow
                    sx={{
                      '& td': {
                        fontWeight: 800,
                        borderTop: '2px solid',
                        borderColor: 'grey.800',
                        bgcolor: 'grey.50'
                      }
                    }}
                  >
                    <TableCell colSpan={7} align="right" sx={{ borderRight: '1px solid', borderColor: 'grey.400' }}>
                      Sub Total
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatDecimalPk(getStoreInvoiceLinesTotal())}
                    </TableCell>
                    <TableCell />
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatDecimalPk(getStoreInvoiceLinesTotal())}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Stack spacing={0.35} sx={{ width: 280, fontSize: 12 }}>
                {[
                  'Service Charges',
                  'Freight Charges',
                  'Packing Charges',
                  'Loading Charges',
                  'Income Tax',
                  'Special Excise Duty',
                  'Custom Duty',
                  'Sales Tax'
                ].map((label) => (
                  <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'grey.300', py: 0.35 }}>
                    <Typography component="span" sx={{ fontSize: 12 }}>{label}</Typography>
                    <Typography component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatDecimalPk(0)}</Typography>
                  </Box>
                ))}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    pt: 1,
                    mt: 0.5,
                    fontWeight: 800,
                    fontSize: 13,
                    borderBottom: '3px double',
                    borderColor: 'grey.900',
                    pb: 0.5
                  }}
                >
                  <Typography component="span">Net Total</Typography>
                  <Typography component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatDecimalPk(getStoreInvoiceLinesTotal())}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </>
        ) : (
          <>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 170px' },
            alignItems: 'start',
            mb: 3
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr',
              width: { xs: '100%', md: 390 },
              ml: { xs: 0, md: 18 },
              lineHeight: 1.45,
              fontSize: 13
            }}
          >
            <Typography sx={{ fontWeight: 800, color: 'grey.700', fontSize: 13 }}>SITE :</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{displayValue(bill.site || bill.location)}</Typography>
            <Typography sx={{ fontWeight: 800, color: 'grey.700', fontSize: 13 }}>From:</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{displayValue(bill.department)}</Typography>
            <Typography sx={{ fontWeight: 800, color: 'grey.700', fontSize: 13 }}>Custodian:</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{displayValue(bill.custodian)}</Typography>
          </Box>
          <Box
            sx={{
              textAlign: { xs: 'left', md: 'right' },
              lineHeight: 2,
              mt: { xs: 2, md: 0 },
              color: 'grey.800'
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{formatMemoDate(bill.billDate)}</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{bill.billId}</Typography>
          </Box>
        </Box>

        <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
        <Table
          size="small"
          sx={{
            ...utilityMemoTableSx,
            mt: 1,
            borderTop: '1px solid',
            borderBottom: '1px solid',
            borderColor: 'grey.300',
            '& th': {
              bgcolor: 'grey.50',
              borderBottom: '1px solid',
              borderRight: '1px solid',
              borderColor: 'grey.300',
              p: 1,
              fontSize: 12,
              fontWeight: 800,
              textAlign: 'center',
              color: 'grey.700',
              lineHeight: 1.25
            },
            '& th:last-of-type': {
              borderRight: 0
            },
            '& td': {
              borderBottom: 0,
              borderTop: '1px solid',
              borderRight: '1px solid',
              borderColor: 'grey.200',
              p: 1.25,
              fontSize: 13,
              verticalAlign: 'top'
            },
            '& td:last-of-type': {
              borderRight: 0
            }
          }}
        >
          <colgroup>
            {UTILITY_MEMO_COL_WIDTHS.map((width, colIdx) => (
              <col key={`memo-col-${colIdx}`} style={{ width }} />
            ))}
          </colgroup>
          <TableHead>
            <TableRow>
              {[
                'Date',
                'Reference No',
                'To Whom Paid',
                'For What',
                'Amount',
                'Last Month Amount'
              ].map((label) => (
                <TableCell
                  key={label}
                  sx={{
                    textAlign: label.includes('Amount') ? 'right' : 'center'
                  }}
                >
                  {label === 'Reference No' ? <>Reference<br />No</> : label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell sx={utilityMemoDateCellSx}>
                {formatMemoDate(bill.billDate)}
              </TableCell>
              <TableCell sx={utilityMemoRefCellSx}>{displayValue(bill.accountNumber)}</TableCell>
              <TableCell sx={{ fontWeight: 700, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{displayValue(bill.provider)}</TableCell>
              <TableCell sx={{ fontWeight: 700, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                {getForWhat()}
              </TableCell>
              <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>
                {formatMemoAmount(bill.amount)}
              </TableCell>
              <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>
                {formatMemoAmount(bill.lastMonthAmount)}
              </TableCell>
            </TableRow>

            {[
              ['Grand Total', formatMemoAmount(getGrandTotal())],
              ['Cash Deposit Last Month', formatMemoAmount(bill.lastMonthAmount)],
              ['Balance Amount to be Paid', formatMemoAmount(getBalanceToPay())]
            ].map(([label, value]) => (
              <TableRow key={label}>
                <TableCell colSpan={4} sx={{ p: 0.6, pr: 2, fontWeight: 800, fontSize: 13, textAlign: 'right', borderTop: 0 }}>
                  {label}
                </TableCell>
                <TableCell sx={{ p: 0.6, pr: 1.25, fontWeight: 800, fontSize: 13, textAlign: 'right', borderTop: 0 }}>
                  {value}
                </TableCell>
                <TableCell sx={{ borderTop: 0 }} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </TableContainer>
          </>
        )}

        {bill.notes && !isCentralizedStoreInvoice && (
          <Box sx={{ mt: 2, p: 1.5, borderTop: '1px solid', borderColor: 'grey.200', bgcolor: 'grey.50' }}>
            <Typography sx={{ fontWeight: 800, fontSize: 13 }}>Notes</Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5 }}>{bill.notes}</Typography>
          </Box>
        )}

        <Table
          size="small"
          sx={{
            mt: 7,
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
                    row.signature || '-'
                  )}
                </TableCell>
                <TableCell>{row.dateTime || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {getStampRows().length > 0 && (
          <Box sx={{ mt: 3, p: 2.5, border: '2px solid', borderColor: 'grey.300', borderRadius: 1.5, backgroundColor: 'grey.50' }}>
            <Typography sx={{ fontWeight: 900, fontSize: 17, mb: 2 }}>Approval Stamp</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              {getStampRows().map((stampRow) => (
                <Box key={stampRow.authority} sx={{ flex: 1, minWidth: 260, p: 2, bgcolor: 'white', border: '1.5px solid', borderColor: 'grey.400', borderRadius: 1.5, boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)' }}>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>{stampRow.authority}</Typography>
                  <Box component="img" src={getImageUrl(stampRow.stampImage)} alt={stampRow.authority} sx={{ display: 'block', maxHeight: 170, width: '100%', objectFit: 'contain', border: '2px dashed', borderColor: 'grey.400', p: 1.5, backgroundColor: '#fff'  }} />
                  <Typography sx={{ mt: 1, fontSize: 12.5, color: 'grey.700' }}>{stampRow.dateTime || '-'}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        <Box sx={{ mt: 5, minHeight: 120 }} />

        {bill.billImage && (
          <Box sx={{ mt: 3 }}>
            <Typography fontWeight="bold" gutterBottom>Attached Bill Image</Typography>
            <Box
              component="img"
              src={getImageUrl(bill.billImage)}
              alt="Utility Bill"
              onClick={() => {
                billImageZoomPan.resetView();
                setImageModalOpen(true);
              }}
              onError={(e) => handleImageError(e)}
              sx={{ maxWidth: 220, maxHeight: 220, border: '1px solid', borderColor: 'divider', cursor: 'pointer' }}
            />
          </Box>
        )}
      </Paper>

      <ResendToPreAuditDialog
        open={workflowAudit.resendDialogOpen}
        onClose={workflowAudit.closeResendDialog}
        submitting={workflowAudit.resendSubmitting}
        observations={workflowAudit.observations}
        getObservationKey={utilityBillObservationKey}
        resendComments={workflowAudit.resendComments}
        onResendCommentsChange={workflowAudit.setResendComments}
        resendAnswers={workflowAudit.resendAnswers}
        onResendAnswerChange={(key, value) =>
          workflowAudit.setResendAnswers((prev) => ({ ...prev, [key]: value }))}
        onSubmit={workflowAudit.handleResendToAudit}
        intro={(
          <>
            Save any memo changes with <strong>Edit Bill</strong> before confirming. Add replies for each open
            observation, then send the bill back to the audit queue.
          </>
        )}
      />

      <Dialog open={submitDialogOpen} onClose={() => setSubmitDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Select Approval Authorities</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Users are filtered by User Management department only (Administration / code ADMIN).
          </Typography>
          <Autocomplete
            options={managerSubmitOptions}
            value={managerApprover}
            loading={approverLoading}
            onChange={(_, value) => setManagerApprover(value)}
            onOpen={() => loadApproverOptions('')}
            onInputChange={approverSearchOnInputChange(loadApproverOptions)}
            getOptionLabel={(option) => userDisplayName(option)}
            isOptionEqualToValue={(option, value) => option._id === value._id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Manager Approver"
                placeholder="Search manager approver"
                margin="normal"
              />
            )}
          />
          <Autocomplete
            options={hodSubmitOptions}
            value={hodApprover}
            loading={approverLoading}
            onChange={(_, value) => setHodApprover(value)}
            onOpen={() => loadApproverOptions('')}
            onInputChange={approverSearchOnInputChange(loadApproverOptions)}
            getOptionLabel={(option) => userDisplayName(option)}
            isOptionEqualToValue={(option, value) => option._id === value._id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Head Of Department Approver"
                placeholder="Search HOD approver"
                margin="normal"
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<SendIcon />} onClick={handleSubmitForApproval}>
            Submit for Approval
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={imageModalOpen} onClose={() => setImageModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Bill Image
          <Box sx={{ position: 'absolute', right: 48, top: 8 }}>
            <ZoomPanImageToolbar
              onZoomIn={billImageZoomPan.zoomIn}
              onZoomOut={billImageZoomPan.zoomOut}
              onReset={billImageZoomPan.resetView}
            />
          </Box>
          <IconButton onClick={() => setImageModalOpen(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={billImageZoomPan.containerSx} {...billImageZoomPan.containerHandlers}>
          {bill.billImage && (
            <Box
              component="img"
              src={getImageUrl(bill.billImage)}
              alt="Utility Bill"
              onError={(e) => handleImageError(e)}
              onMouseDown={billImageZoomPan.startDrag}
              sx={{
                ...billImageZoomPan.imageSx,
                width: '100%'
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UtilityBillDetails;
