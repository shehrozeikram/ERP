import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Alert
} from '@mui/material';
import { ArrowBack as BackIcon, Print as PrintIcon } from '@mui/icons-material';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';
import { DigitalSignatureImage } from '../../components/common/DigitalSignatureImage';
import { useAuth } from '../../contexts/AuthContext';
import { useFinanceCompany } from '../../context/FinanceCompanyContext';

const VOUCHER_SERIES_TITLES = {
  BPV: 'Bank Payment Voucher',
  CPV: 'Cash Payment Voucher',
  JV: 'Journal Voucher',
  GRN: 'Goods Receipt Voucher',
  SIN: 'Store Issue Voucher'
};

const resolveCompanyName = (entry, linkedDocs, companies) => {
  const populated = entry?.companyId;
  if (populated && typeof populated === 'object' && populated.name) {
    return populated.name;
  }

  const companyId = populated?._id || entry?.companyId;
  if (companyId && Array.isArray(companies)) {
    const match = companies.find((row) => String(row._id) === String(companyId));
    if (match?.name) return match.name;
  }

  const { payrollPeriodPaymentApp, apPaymentApp } = linkedDocs;
  if (payrollPeriodPaymentApp?.companyName) return payrollPeriodPaymentApp.companyName;
  if (apPaymentApp?.companyName) return apPaymentApp.companyName;

  return 'Sardar Group of Companies';
};

const resolveVoucherTitle = (entry) => {
  const series = String(entry?.voucherSeries || '').trim().toUpperCase();
  if (series && VOUCHER_SERIES_TITLES[series]) return VOUCHER_SERIES_TITLES[series];
  if (series === 'BPV' || entry?.module === 'payroll') return VOUCHER_SERIES_TITLES.BPV;
  return 'Finance Voucher';
};

const VoucherView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companies } = useFinanceCompany();
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState(null);
  const [cashApproval, setCashApproval] = useState(null);
  const [vendorAdvanceDoc, setVendorAdvanceDoc] = useState(null);
  const [apPaymentApp, setApPaymentApp] = useState(null);
  const [payrollPeriodPaymentApp, setPayrollPeriodPaymentApp] = useState(null);
  const [approvalMsg, setApprovalMsg] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setLoadError('');
        const res = await api.get(`/finance/journal-entries/${id}`);
        setEntry(res?.data?.data || null);
        if (!res?.data?.data) {
          setLoadError('Voucher not found.');
        }
      } catch (err) {
        setEntry(null);
        setLoadError(err.response?.data?.message || 'Could not load voucher.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    const loadCashApproval = async () => {
      try {
        if (!entry?.referenceId) {
          setCashApproval(null);
          return;
        }
        const res = await api.get(`/cash-approvals/${entry.referenceId}`);
        setCashApproval(res?.data?.data || null);
      } catch (_e) {
        setCashApproval(null);
      }
    };
    loadCashApproval();
  }, [entry?.referenceId]);

  useEffect(() => {
    const loadLinkedDocs = async () => {
      if (!entry?._id) {
        setVendorAdvanceDoc(null);
        setApPaymentApp(null);
        setPayrollPeriodPaymentApp(null);
        return;
      }
      try {
        const apRes = await api.get(`/finance/ap-payment-applications/by-journal-entry/${entry._id}`);
        setApPaymentApp(apRes?.data?.data || null);
      } catch (_e) {
        setApPaymentApp(null);
      }
      try {
        const payrollRes = await api.get(`/finance/payroll-period-payments/by-journal-entry/${entry._id}`);
        setPayrollPeriodPaymentApp(payrollRes?.data?.data || null);
      } catch (_e) {
        setPayrollPeriodPaymentApp(null);
      }
      try {
        const res = await api.get(`/finance/vendor-advances/by-journal-entry/${entry._id}`);
        setVendorAdvanceDoc(res?.data?.data || null);
      } catch (_e) {
        setVendorAdvanceDoc(null);
      }
    };
    loadLinkedDocs();
  }, [entry?._id]);

  const reloadEntry = async () => {
    try {
      const res = await api.get(`/finance/journal-entries/${id}`);
      setEntry(res?.data?.data || null);
    } catch {
      /* ignore */
    }
  };

  const refreshApPaymentApp = async () => {
    try {
      const res = await api.get(`/finance/ap-payment-applications/by-journal-entry/${id}`);
      setApPaymentApp(res?.data?.data || apPaymentApp);
    } catch {
      /* ignore */
    }
  };

  const refreshPayrollPeriodPaymentApp = async () => {
    try {
      const res = await api.get(`/finance/payroll-period-payments/by-journal-entry/${id}`);
      setPayrollPeriodPaymentApp(res?.data?.data || payrollPeriodPaymentApp);
    } catch {
      /* ignore */
    }
  };

  const approveMyAuthorityFromVoucher = async () => {
    try {
      setApprovalMsg('');
      if (apPaymentApp?._id) {
        await api.put(`/finance/ap-payment-applications/${apPaymentApp._id}/finance-approve`, {
          comments: 'Approved from Voucher page'
        });
        await refreshApPaymentApp();
        await reloadEntry();
        setApprovalMsg('Authority approval recorded. Bill is marked paid when all three authorities have approved.');
        return;
      }
      if (payrollPeriodPaymentApp?._id) {
        await api.put(`/finance/payroll-period-payments/${payrollPeriodPaymentApp._id}/finance-approve`, {
          comments: 'Approved from Voucher page'
        });
        await refreshPayrollPeriodPaymentApp();
        await reloadEntry();
        setApprovalMsg('Authority approval recorded. Payroll records are marked paid when GM Finance approves on the BPV.');
        return;
      }
      if (cashApproval?._id) {
        await api.put(`/cash-approvals/${cashApproval._id}/finance-approve`, { comments: 'Approved from Voucher page' });
        const refreshed = await api.get(`/cash-approvals/${cashApproval._id}`);
        setCashApproval(refreshed?.data?.data || cashApproval);
        setApprovalMsg('Authority approval recorded from voucher and synced to Cash Approval.');
        return;
      }
      if (vendorAdvanceDoc?._id) {
        await api.put(`/finance/vendor-advances/${vendorAdvanceDoc._id}/finance-approve`, { comments: 'Approved from Voucher page' });
        const refreshed = await api.get(`/finance/vendor-advances/by-journal-entry/${id}`);
        setVendorAdvanceDoc(refreshed?.data?.data || vendorAdvanceDoc);
        await reloadEntry();
        setApprovalMsg('Authority approval recorded. Voucher posts to the ledger when all three have approved.');
        return;
      }
    } catch (e) {
      setApprovalMsg(e?.response?.data?.message || 'Approval failed.');
    }
  };

  const rejectMyAuthorityFromVoucher = async () => {
    const observation = window.prompt('Enter rejection observation for the preparer:');
    if (!observation || !String(observation).trim()) {
      setApprovalMsg('Rejection cancelled — observation is required.');
      return;
    }
    const comments = String(observation).trim();
    try {
      setApprovalMsg('');
      if (apPaymentApp?._id) {
        await api.put(`/finance/ap-payment-applications/${apPaymentApp._id}/finance-reject`, { comments });
        await refreshApPaymentApp();
        await reloadEntry();
        setApprovalMsg('Settlement rejected. Draft voucher cancelled; bill remains unpaid.');
        return;
      }
      if (payrollPeriodPaymentApp?._id) {
        await api.put(`/finance/payroll-period-payments/${payrollPeriodPaymentApp._id}/finance-reject`, { comments });
        await refreshPayrollPeriodPaymentApp();
        await reloadEntry();
        setApprovalMsg('Payroll payment rejected with observation. BPV cancelled; Sr Manager Accounts can correct and resubmit.');
        return;
      }
      if (cashApproval?._id) {
        await api.put(`/cash-approvals/${cashApproval._id}/finance-reject`, { comments });
        const refreshed = await api.get(`/cash-approvals/${cashApproval._id}`);
        setCashApproval(refreshed?.data?.data || cashApproval);
        setApprovalMsg('Authority rejection recorded from voucher and synced to Cash Approval.');
        return;
      }
      if (vendorAdvanceDoc?._id) {
        await api.put(`/finance/vendor-advances/${vendorAdvanceDoc._id}/finance-reject`, { comments: 'Rejected from Voucher page' });
        const refreshed = await api.get(`/finance/vendor-advances/by-journal-entry/${id}`);
        setVendorAdvanceDoc(refreshed?.data?.data || vendorAdvanceDoc);
        await reloadEntry();
        setApprovalMsg('Authority rejection recorded. Draft voucher cancelled.');
        return;
      }
    } catch (e) {
      setApprovalMsg(e?.response?.data?.message || 'Rejection failed.');
    }
  };

  const financeAuthorityDoc = apPaymentApp || payrollPeriodPaymentApp || vendorAdvanceDoc || cashApproval;
  const pendingAuthorityVoucher =
    (apPaymentApp?.workflowStatus === 'pending_authority' && entry?.status === 'draft')
    || (payrollPeriodPaymentApp?.workflowStatus === 'pending_authority' && entry?.status === 'draft')
    || (vendorAdvanceDoc?.voucherWorkflowStatus === 'pending_authority' && entry?.status === 'draft');

  const authoritySlots = useMemo(() => {
    if (payrollPeriodPaymentApp) {
      return [
        { key: 'accountsManagerUser', label: 'Sr Manager Accounts' },
        { key: 'financeControllerUser', label: 'GM Finance' }
      ];
    }
    return [
      { key: 'accountsOfficerUser', label: 'Accounts Officer / AM' },
      { key: 'accountsManagerUser', label: 'Sr Manager Accounts' },
      { key: 'financeControllerUser', label: 'GM Finance' }
    ];
  }, [payrollPeriodPaymentApp]);

  const myPendingAuthorityLabels = useMemo(() => {
    if (!financeAuthorityDoc || !user) return [];
    const uid = String(user?.id || user?._id || '');
    const authorities = financeAuthorityDoc?.financeApprovalAuthorities || {};
    const normId = (v) => String(v?._id || v?.id || v || '').trim();
    const approvals = Array.isArray(financeAuthorityDoc?.financeAuthorityApprovals) ? financeAuthorityDoc.financeAuthorityApprovals : [];
    const decided = new Set(approvals.map((a) => String(a?.authorityKey || '').trim()).filter(Boolean));
    return authoritySlots
      .filter((s) => normId(authorities?.[s.key]) === uid && !decided.has(s.key))
      .map((s) => s.label);
  }, [financeAuthorityDoc, user, authoritySlots]);

  const voucherType = useMemo(() => String(entry?.referenceType || 'manual').toUpperCase(), [entry]);
  const voucherTitle = useMemo(() => resolveVoucherTitle(entry), [entry]);
  const voucherCompanyName = useMemo(
    () => resolveCompanyName(entry, { payrollPeriodPaymentApp, apPaymentApp }, companies),
    [entry, payrollPeriodPaymentApp, apPaymentApp, companies]
  );
  const monthName = useMemo(() => {
    if (!entry?.date) return '—';
    return new Date(entry.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [entry]);

  const isPayrollBpv = useMemo(() => {
    const series = String(entry?.voucherSeries || '').trim().toUpperCase();
    return entry?.module === 'payroll' && (series === 'BPV' || series === 'CPV');
  }, [entry]);

  const payrollPeriodLabel =
    entry?.payrollVoucherSummary?.periodLabel
    || payrollPeriodPaymentApp?.periodLabel
    || monthName;
  const payrollEmployeeCount =
    entry?.payrollVoucherSummary?.employeeCount ?? payrollPeriodPaymentApp?.employeeCount;

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!entry) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{loadError || 'Voucher not found'}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>Back</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box className="app-print-hide" sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Button variant="outlined" startIcon={<BackIcon />} onClick={() => navigate('/finance/vouchers')}>
          Back
        </Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>
          Print
        </Button>
      </Box>

      <Paper sx={{ p: 3, maxWidth: '1200px', mx: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography fontWeight={700}>{voucherCompanyName}</Typography>
            <Typography fontWeight={700}>{voucherTitle}</Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2">{new Date(entry.date).toLocaleDateString()}</Typography>
            <Typography variant="body2">{new Date(entry.date).toLocaleTimeString()}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography fontWeight={600}>{new Date(entry.date).toLocaleDateString()}</Typography>
          <Box sx={{ minWidth: 260 }}>
            <Typography variant="body2"><strong>Voucher Type</strong> {voucherType}</Typography>
            <Typography variant="body2"><strong>Voucher No</strong> {entry.entryNumber}</Typography>
            <Typography variant="body2"><strong>Month</strong> {payrollPeriodLabel}</Typography>
            {isPayrollBpv && payrollEmployeeCount != null ? (
              <Typography variant="body2"><strong>Employees</strong> {payrollEmployeeCount}</Typography>
            ) : null}
            {vendorAdvanceDoc ? (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                <strong>Pay from account</strong>{' '}
                {vendorAdvanceDoc.bankAccountId?.name
                  ? `${vendorAdvanceDoc.bankAccountId.name}${
                    vendorAdvanceDoc.bankAccountId.accountNumber
                      ? ` (${vendorAdvanceDoc.bankAccountId.accountNumber})`
                      : ''
                  }`
                  : '—'}
              </Typography>
            ) : null}
          </Box>
        </Box>

        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          {isPayrollBpv ? 'Accounting Entries' : 'Voucher Lines'}
        </Typography>
        {isPayrollBpv ? (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Gross salary expense, EOBI employer expense, and each deduction post to their chart of accounts; bank is credited for net pay.
          </Typography>
        ) : null}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Account Title</TableCell>
              <TableCell>Narration</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Project</TableCell>
              <TableCell align="right">Debit</TableCell>
              <TableCell align="right">Credit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(entry.lines || []).map((line, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  {line?.account?.name || '—'}
                  {line?.account?.accountNumber ? <Typography variant="caption" display="block">({line.account.accountNumber})</Typography> : null}
                </TableCell>
                <TableCell>{line.description || entry.description || '—'}</TableCell>
                <TableCell>{entry.reference || '—'}</TableCell>
                <TableCell>{entry.module || '—'}</TableCell>
                <TableCell align="right">{line.debit ? formatPKR(line.debit) : '0'}</TableCell>
                <TableCell align="right">{line.credit ? formatPKR(line.credit) : '0'}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={4} align="right"><strong>Total</strong></TableCell>
              <TableCell align="right"><strong>{formatPKR(entry.totalDebits || 0)}</strong></TableCell>
              <TableCell align="right"><strong>{formatPKR(entry.totalCredits || 0)}</strong></TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <Box sx={{ mt: 4 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
            Finance Document Approval Authority
          </Typography>
          {approvalMsg ? (
            <Alert severity={approvalMsg.toLowerCase().includes('failed') ? 'error' : 'success'} sx={{ mb: 1.5 }}>
              {approvalMsg}
            </Alert>
          ) : null}
          {payrollPeriodPaymentApp?.workflowStatus === 'draft' ? (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              This payroll BPV is still a <strong>draft</strong>. Submit it from Payroll — Finance when ready, or delete the draft from there.
              It is not yet in the GM Finance approval queue.
            </Alert>
          ) : null}
          {pendingAuthorityVoucher ? (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              This voucher is <strong>draft</strong> until all finance authorities approve.
              {apPaymentApp
                ? ' The related vendor bill stays unpaid until final approval.'
                : payrollPeriodPaymentApp
                  ? ' Company payroll for this BPV stays unpaid until GM Finance approves. Sr Manager Accounts is already approved on submission.'
                  : ' General ledger and account balances update only after final approval.'}
            </Alert>
          ) : null}
          {apPaymentApp?.accountsPayableId ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Bill: <strong>{apPaymentApp.billNumber || apPaymentApp.accountsPayableId?.billNumber || '—'}</strong>
              {' · '}Settlement: {formatPKR(apPaymentApp.amount || 0)}
            </Typography>
          ) : null}
          {payrollPeriodPaymentApp ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Company: <strong>{payrollPeriodPaymentApp.companyName || '—'}</strong>
              {' · '}Period: <strong>{payrollPeriodPaymentApp.periodLabel || '—'}</strong>
              {' · '}{payrollPeriodPaymentApp.employeeCount || 0} employees
              {' · '}Payment: {formatPKR(payrollPeriodPaymentApp.amount || 0)}
            </Typography>
          ) : null}
          {payrollPeriodPaymentApp?.rejectionObservation ? (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              Rejection observation: {payrollPeriodPaymentApp.rejectionObservation}
            </Alert>
          ) : null}
          {myPendingAuthorityLabels.length > 0 ? (
            <Box className="app-print-hide" sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                Your pending authority:
              </Typography>
              <Typography component="span" variant="body2" fontWeight={600} sx={{ mr: 1.5 }}>
                {myPendingAuthorityLabels.join(', ')}
              </Typography>
              <Button size="small" variant="contained" color="success" onClick={approveMyAuthorityFromVoucher}>
                Approve from Voucher
              </Button>
              <Button size="small" variant="contained" color="error" onClick={rejectMyAuthorityFromVoucher} sx={{ ml: 1 }}>
                Reject from Voucher
              </Button>
            </Box>
          ) : null}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Authority</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Approver</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date &amp; Time</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Digital Signature</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(() => {
                const approvals = Array.isArray(financeAuthorityDoc?.financeAuthorityApprovals) ? financeAuthorityDoc.financeAuthorityApprovals : [];
                const byKey = new Map(approvals.map((a) => [String(a?.authorityKey || '').trim(), a]).filter(([k]) => Boolean(k)));

                return authoritySlots.map((slot) => {
                  const approval = byKey.get(slot.key);
                  const assigned = financeAuthorityDoc?.financeApprovalAuthorities?.[slot.key] || null;
                  const approver = approval?.approver || assigned || null;
                  const decision = approval ? String(approval.decision || 'approved').toLowerCase() : 'pending';
                  const approvedAt = approval?.approvedAt || null;
                  const approverName = approver
                    ? ([approver?.firstName, approver?.lastName].filter(Boolean).join(' ').trim() || approver?.email || '—')
                    : '—';

                  return (
                    <TableRow key={slot.key}>
                      <TableCell>{slot.label}</TableCell>
                      <TableCell>{approverName}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={decision === 'rejected' ? 'Rejected' : (decision === 'approved' ? 'Approved' : 'Pending')}
                          color={decision === 'rejected' ? 'error' : (decision === 'approved' ? 'success' : 'warning')}
                          variant={decision === 'approved' || decision === 'rejected' ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell>{approvedAt ? new Date(approvedAt).toLocaleString() : '—'}</TableCell>
                      <TableCell align="center">
                        {decision === 'approved' && approver?.digitalSignature ? (
                          <DigitalSignatureImage userOrPath={approver} alt={`${slot.label} signature`} />
                        ) : decision === 'approved' ? (
                          <Typography variant="caption" color="text.secondary">No signature on file</Typography>
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
      </Paper>
    </Box>
  );
};

export default VoucherView;

