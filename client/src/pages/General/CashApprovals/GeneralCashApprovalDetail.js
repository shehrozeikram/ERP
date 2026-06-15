import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Snackbar,
  TextField,
  Tooltip
} from '@mui/material';
import {
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import generalCashApprovalService from '../../../services/generalCashApprovalService';
import CashApprovalGeneralDetailShell from '../../../components/CashApprovals/CashApprovalGeneralDetailShell';
import {
  canEditGeneralCashApproval,
  canResubmitGeneralCashApproval,
  canSubmitGeneralCashApprovalDraft,
  isGeneralCashApprovalRejected,
  rejectedApproverLabel,
  hasPreservedDepartmentApprovals,
  getResubmitDestinationLabel,
  isDepartmentStageRejection,
  resubmitCashApprovalMessage
} from '../../../utils/generalCashApprovalWorkflow';

const GeneralCashApprovalDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ca, setCa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const load = useCallback(async () => {
    const res = await generalCashApprovalService.getById(id);
    setCa(res.data);
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        await load();
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load cash approval');
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const uid = String(user?._id || user?.id || '');
  const firstPendingStep = (ca?.departmentApprovalChain || []).find((s) => s.status === 'pending');
  const pendingApproverId = String(firstPendingStep?.approver?._id || firstPendingStep?.approver || '');
  const isCurrentPendingApprover = pendingApproverId && pendingApproverId === uid && uid !== String(ca?.createdBy?._id || ca?.createdBy);
  const canApprove =
    ca?.status === 'Pending Approval' &&
    ca?.departmentApprovalStatus === 'Submitted' &&
    isCurrentPendingApprover;
  const canEdit = canEditGeneralCashApproval(ca, user);
  const canSubmitDraft = canSubmitGeneralCashApprovalDraft(ca, user);
  const canResubmit = canResubmitGeneralCashApproval(ca, user);
  const auditBlocksEdit = ['Pending Audit', 'Forwarded to Audit Director'].includes(ca?.status);

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      await generalCashApprovalService.approve(id);
      toast.success('Approved');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approve failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    try {
      setActionLoading(true);
      await generalCashApprovalService.reject(id, rejectReason.trim());
      toast.success('Rejected');
      setRejectOpen(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reject failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmit = async () => {
    try {
      setActionLoading(true);
      const approverIds = (ca.departmentApprovalChain || [])
        .map((step) => String(step?.approver?._id || step?.approver || ''))
        .filter(Boolean);
      await generalCashApprovalService.submit(id, { approverIds });
      toast.success(resubmitCashApprovalMessage(ca));
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Resubmit failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setActionLoading(true);
      const approverIds = (ca.draftApproverIds || []).map((a) => String(a._id || a));
      await generalCashApprovalService.submit(id, { approverIds });
      toast.success('Submitted for approval');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submit failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width="30%" height={48} />
        <Skeleton variant="rectangular" height={620} sx={{ mt: 2 }} />
      </Box>
    );
  }

  if (!ca) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Cash approval not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/general/cash-approvals')}>
          Back to list
        </Button>
      </Box>
    );
  }

  return (
    <>
      <CashApprovalGeneralDetailShell
        ca={ca}
        onBack={() => navigate('/general/cash-approvals')}
        backLabel="Back to Cash Approvals"
        topAlerts={
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            {ca.status === 'Returned from Audit' && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Returned from audit. Update the request if needed, then resubmit when available.
              </Alert>
            )}
            {isGeneralCashApprovalRejected(ca) && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Rejected by {rejectedApproverLabel(ca)}. Review the observations below, edit if needed, then resubmit.
                {isDepartmentStageRejection(ca) && hasPreservedDepartmentApprovals(ca)
                  ? ` Prior department approvals are preserved — resubmit goes directly to ${getResubmitDestinationLabel(ca)}.`
                  : ` Resubmit will return the request to ${getResubmitDestinationLabel(ca)}.`}
              </Alert>
            )}
          </>
        }
        toolbarActions={
          <>
            {canSubmitDraft && (
              <Button variant="contained" color="info" startIcon={<SendIcon />} disabled={actionLoading} onClick={handleSubmit}>
                Submit
              </Button>
            )}
            {canResubmit && (
              <>
                <Button
                  variant="contained"
                  color="info"
                  startIcon={<SendIcon />}
                  disabled={actionLoading}
                  onClick={handleResubmit}
                >
                  Resubmit
                </Button>
              </>
            )}
            {canApprove && (
              <>
                <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} disabled={actionLoading} onClick={handleApprove}>
                  Approve
                </Button>
                <Button variant="outlined" color="error" startIcon={<CancelIcon />} disabled={actionLoading} onClick={() => setRejectOpen(true)}>
                  Reject
                </Button>
              </>
            )}
            <Tooltip title={auditBlocksEdit ? 'Cannot edit while in audit' : (canEdit ? 'Edit request' : 'Only the requester can edit rejected or draft requests')}>
              <span>
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  disabled={!canEdit || auditBlocksEdit}
                  onClick={() => navigate(`/general/cash-approvals/${id}/edit`)}
                >
                  Edit
                </Button>
              </span>
            </Tooltip>
          </>
        }
      />

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject cash approval</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Rejection reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={actionLoading} onClick={handleReject}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        message={snackbar.message}
      />
    </>
  );
};

export default GeneralCashApprovalDetail;
