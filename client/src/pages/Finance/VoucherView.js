import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Grid,
  TextField,
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

const VoucherView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState(null);
  const [cashApproval, setCashApproval] = useState(null);
  const [uploadingCheck, setUploadingCheck] = useState(false);
  const [savingCheckDetails, setSavingCheckDetails] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [approvalMsg, setApprovalMsg] = useState('');
  const [checkDetails, setCheckDetails] = useState({
    signedCheckNumber: '',
    signedCheckDate: '',
    signedCheckBankName: '',
    signedCheckRemarks: ''
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/finance/journal-entries/${id}`);
        setEntry(res?.data?.data || null);
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
    setCheckDetails({
      signedCheckNumber: cashApproval?.signedCheckNumber || '',
      signedCheckDate: cashApproval?.signedCheckDate ? new Date(cashApproval.signedCheckDate).toISOString().split('T')[0] : '',
      signedCheckBankName: cashApproval?.signedCheckBankName || '',
      signedCheckRemarks: cashApproval?.signedCheckRemarks || ''
    });
  }, [cashApproval]);

  const resolveFileUrl = (url) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    const apiBase = (api?.defaults?.baseURL || '').replace(/\/api\/?$/, '');
    if (!apiBase) return url;
    return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const uploadSignedCheck = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!cashApproval?._id || !files.length) return;
    try {
      setUploadingCheck(true);
      setUploadMsg('');
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      await api.post(`/cash-approvals/${cashApproval._id}/signed-check-upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const refreshed = await api.get(`/cash-approvals/${cashApproval._id}`);
      setCashApproval(refreshed?.data?.data || cashApproval);
      setUploadMsg('Cheque image/evidence uploaded successfully.');
    } catch (_e) {
      setUploadMsg('Failed to upload cheque image.');
    } finally {
      setUploadingCheck(false);
    }
  };

  const saveSignedCheckDetails = async () => {
    if (!cashApproval?._id) return;
    try {
      setSavingCheckDetails(true);
      setUploadMsg('');
      const res = await api.put(`/cash-approvals/${cashApproval._id}/signed-check-details`, {
        signedCheckNumber: checkDetails.signedCheckNumber || '',
        signedCheckDate: checkDetails.signedCheckDate || null,
        signedCheckBankName: checkDetails.signedCheckBankName || '',
        signedCheckRemarks: checkDetails.signedCheckRemarks || ''
      });
      setCashApproval(res?.data?.data || cashApproval);
      setUploadMsg('Signed check details updated successfully.');
    } catch (_e) {
      setUploadMsg('Failed to update signed check details.');
    } finally {
      setSavingCheckDetails(false);
    }
  };

  const approveMyAuthorityFromVoucher = async () => {
    if (!cashApproval?._id) return;
    try {
      setApprovalMsg('');
      await api.put(`/cash-approvals/${cashApproval._id}/finance-approve`, { comments: 'Approved from Voucher page' });
      const refreshed = await api.get(`/cash-approvals/${cashApproval._id}`);
      setCashApproval(refreshed?.data?.data || cashApproval);
      setApprovalMsg('Authority approval recorded from voucher and synced to Cash Approval.');
    } catch (e) {
      setApprovalMsg(e?.response?.data?.message || 'Approval failed.');
    }
  };

  const rejectMyAuthorityFromVoucher = async () => {
    if (!cashApproval?._id) return;
    try {
      setApprovalMsg('');
      await api.put(`/cash-approvals/${cashApproval._id}/finance-reject`, { comments: 'Rejected from Voucher page' });
      const refreshed = await api.get(`/cash-approvals/${cashApproval._id}`);
      setCashApproval(refreshed?.data?.data || cashApproval);
      setApprovalMsg('Authority rejection recorded from voucher and synced to Cash Approval.');
    } catch (e) {
      setApprovalMsg(e?.response?.data?.message || 'Rejection failed.');
    }
  };

  const myPendingAuthorityLabels = useMemo(() => {
    if (!cashApproval || !user) return [];
    const uid = String(user?.id || user?._id || '');
    const authorities = cashApproval?.financeApprovalAuthorities || {};
    const normId = (v) => String(v?._id || v?.id || v || '').trim();
    const approvals = Array.isArray(cashApproval?.financeAuthorityApprovals) ? cashApproval.financeAuthorityApprovals : [];
    const decided = new Set(approvals.map((a) => String(a?.authorityKey || '').trim()).filter(Boolean));
    const slots = [
      { key: 'accountsOfficerUser', label: 'Accounts Officer / AM' },
      { key: 'accountsManagerUser', label: 'Sr Manager Accounts' },
      { key: 'financeControllerUser', label: 'GM Finance' }
    ];
    return slots
      .filter((s) => normId(authorities?.[s.key]) === uid && !decided.has(s.key))
      .map((s) => s.label);
  }, [cashApproval, user]);

  const voucherType = useMemo(() => String(entry?.referenceType || 'manual').toUpperCase(), [entry]);
  const monthName = useMemo(() => {
    if (!entry?.date) return '—';
    return new Date(entry.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [entry]);

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!entry) return <Box sx={{ p: 4 }}><Typography>Voucher not found</Typography></Box>;

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
            <Typography fontWeight={700}>Sardar Group of Companies</Typography>
            <Typography fontWeight={700}>Bank Payment Voucher</Typography>
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
            <Typography variant="body2"><strong>Month</strong> {monthName}</Typography>
          </Box>
        </Box>

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
                const slots = [
                  { key: 'accountsOfficerUser', label: 'Accounts Officer / AM' },
                  { key: 'accountsManagerUser', label: 'Sr Manager Accounts' },
                  { key: 'financeControllerUser', label: 'GM Finance' }
                ];
                const approvals = Array.isArray(cashApproval?.financeAuthorityApprovals) ? cashApproval.financeAuthorityApprovals : [];
                const byKey = new Map(approvals.map((a) => [String(a?.authorityKey || '').trim(), a]).filter(([k]) => Boolean(k)));

                return slots.map((slot) => {
                  const approval = byKey.get(slot.key);
                  const assigned = cashApproval?.financeApprovalAuthorities?.[slot.key] || null;
                  const approver = approval?.approver || assigned || null;
                  const decision = String(approval?.decision || (approval ? 'approved' : 'pending')).toLowerCase();
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

        {cashApproval?._id && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Signed Check Evidence
            </Typography>
            {uploadMsg ? (
              <Alert severity={uploadMsg.includes('Failed') ? 'error' : 'success'} sx={{ mb: 1.5 }}>
                {uploadMsg}
              </Alert>
            ) : null}
            <Grid className="app-print-hide" container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Signed Check Number *"
                  value={checkDetails.signedCheckNumber}
                  onChange={(e) => setCheckDetails((prev) => ({ ...prev, signedCheckNumber: e.target.value }))}
                  onBlur={saveSignedCheckDetails}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Signed Check Date"
                  InputLabelProps={{ shrink: true }}
                  value={checkDetails.signedCheckDate}
                  onChange={(e) => setCheckDetails((prev) => ({ ...prev, signedCheckDate: e.target.value }))}
                  onBlur={saveSignedCheckDetails}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Bank Name"
                  value={checkDetails.signedCheckBankName}
                  onChange={(e) => setCheckDetails((prev) => ({ ...prev, signedCheckBankName: e.target.value }))}
                  onBlur={saveSignedCheckDetails}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Button variant="outlined" component="label" fullWidth disabled={uploadingCheck || savingCheckDetails}>
                  {uploadingCheck ? 'Uploading...' : 'Upload Signed Check Evidence'}
                  <input
                    hidden
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={(e) => uploadSignedCheck(e.target.files)}
                  />
                </Button>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  minRows={3}
                  label="Signed Check Remarks"
                  value={checkDetails.signedCheckRemarks}
                  onChange={(e) => setCheckDetails((prev) => ({ ...prev, signedCheckRemarks: e.target.value }))}
                  onBlur={saveSignedCheckDetails}
                />
              </Grid>
            </Grid>
            {Array.isArray(cashApproval?.signedCheckAttachments) && cashApproval.signedCheckAttachments.length > 0 ? (
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {cashApproval.signedCheckAttachments.map((doc, idx) => {
                  const isImage = String(doc?.mimeType || '').startsWith('image/');
                  return (
                    <Paper key={doc._id || doc.url || idx} variant="outlined" sx={{ p: 1.5 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {doc.originalName || doc.filename || `Cheque file ${idx + 1}`}
                      </Typography>
                      {isImage ? (
                        <Box
                          component="img"
                          src={resolveFileUrl(doc.url)}
                          alt={doc.originalName || `Cheque ${idx + 1}`}
                          sx={{ mt: 1, width: '100%', maxHeight: 260, objectFit: 'contain', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                        />
                      ) : (
                        <Button sx={{ mt: 1 }} size="small" variant="outlined" onClick={() => window.open(resolveFileUrl(doc.url), '_blank', 'noopener,noreferrer')}>
                          Open File
                        </Button>
                      )}
                    </Paper>
                  );
                })}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No cheque evidence uploaded yet.</Typography>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default VoucherView;

