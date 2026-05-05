import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import api from '../../services/api';
import ComparativeStatementView from '../../components/Procurement/ComparativeStatementView';
import { useAuth } from '../../contexts/AuthContext';
import { canEditComparativeAuthorityUsers } from '../../utils/comparativeStatementAuthority';

const ComparativeStatements = () => {
  const { user } = useAuth();
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requisitions, setRequisitions] = useState([]);
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const [selectDialog, setSelectDialog] = useState({ open: false, quotation: null });
  const [updating, setUpdating] = useState(false);
  // Editable approval authority (names/designations for signature section)
  const [approvalAuthority, setApprovalAuthority] = useState({
    preparedBy: '',
    verifiedBy: '',
    authorisedRep: '',
    financeRep: '',
    managerProcurement: ''
  });
  // Set to requisition id after user saves approval authorities; vendor Select enabled only then
  const [approvalsSavedForRequisition, setApprovalsSavedForRequisition] = useState(null);
  // Editable note (saved with approval authorities)
  const [comparativeNote, setComparativeNote] = useState('');
  const [creatingSplitPOs, setCreatingSplitPOs] = useState(false);
  const [canManageAssignments, setCanManageAssignments] = useState(false);
  const [approverOptions, setApproverOptions] = useState([]);
  const [approverSearchLoading, setApproverSearchLoading] = useState(false);
  const [authorityUserSelection, setAuthorityUserSelection] = useState({
    preparedBy: null,
    verifiedBy: null,
    authorisedRep: null,
    financeRep: null,
    managerProcurement: null
  });
  const [, setSavingComparativeApprovers] = useState(false);
  const [submittingComparative, setSubmittingComparative] = useState(false);
  const [approvingComparative, setApprovingComparative] = useState(false);
  const [rejectingComparative, setRejectingComparative] = useState(false);
  const [rejectObservation, setRejectObservation] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const authoritySearchDebounceRef = useRef(null);

  // Load requisitions on component mount
  useEffect(() => {
    loadRequisitions();
  }, []);

  const loadRequisitions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page: 1,
        limit: 1000,
        status: 'Approved'
      };
      
      const response = await api.get('/procurement/requisitions', { params });
      if (response.data.success) {
        // The API returns 'indents' not 'requisitions'
        const requisitionsData = response.data.data?.indents || response.data.data?.requisitions || [];
        setRequisitions(requisitionsData);
        setCanManageAssignments(Boolean(response.data.data?.canManageAssignments));
      } else {
        setError('Failed to load requisitions');
      }
    } catch (err) {
      console.error('Error loading requisitions:', err);
      setError(err.response?.data?.message || 'Failed to load requisitions');
      setRequisitions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const [savingApprovals, setSavingApprovals] = useState(false);

  const handleRequisitionSelect = async (requisition) => {
    setSelectedRequisition(requisition);
    setLoadingQuotations(true);
    setError('');
    try {
      // First, get full requisition details with populated fields (includes comparativeStatementApprovals)
      const reqResponse = await api.get(`/indents/${requisition._id}`);
      if (reqResponse.data.success) {
        const fullRequisition = reqResponse.data.data;
        setSelectedRequisition(fullRequisition);
        const approvals = fullRequisition.comparativeStatementApprovals || {};
        const currentUserOption = user
          ? {
              _id: user._id || user.id,
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              email: user.email || '',
              employeeId: user.employeeId || ''
            }
          : null;
        const preparedBySelection = approvals.preparedByUser || currentUserOption || null;
        setApprovalAuthority({
          preparedBy:
            approvals.preparedBy ||
            (preparedBySelection
              ? ([preparedBySelection.firstName, preparedBySelection.lastName].filter(Boolean).join(' ').trim() || preparedBySelection.email || '')
              : ''),
          verifiedBy: approvals.verifiedBy || '',
          authorisedRep: approvals.authorisedRep || '',
          financeRep: approvals.financeRep || '',
          managerProcurement: approvals.managerProcurement || ''
        });
        setAuthorityUserSelection({
          preparedBy: preparedBySelection,
          verifiedBy: approvals.verifiedByUser || null,
          authorisedRep: approvals.authorisedRepUser || null,
          financeRep: approvals.financeRepUser || null,
          managerProcurement: approvals.managerProcurementUser || null
        });
        setComparativeNote(fullRequisition.notes != null ? String(fullRequisition.notes) : '');
        const hasExistingApprovals = approvals.preparedBy || approvals.verifiedBy || approvals.authorisedRep || approvals.financeRep || approvals.managerProcurement;
        setApprovalsSavedForRequisition(hasExistingApprovals ? fullRequisition._id : null);
      }
      
      // Then get quotations
      const response = await api.get(`/procurement/quotations/by-indent/${requisition._id}`);
      if (response.data.success) {
        setQuotations(response.data.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load quotations');
      setQuotations([]);
    } finally {
      setLoadingQuotations(false);
    }
  };

  const loadApproverOptions = async (q = '') => {
    try {
      setApproverSearchLoading(true);
      const res = await api.get('/indents/approver-candidates', { params: { search: q, limit: 100 } });
      setApproverOptions(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setApproverOptions([]);
    } finally {
      setApproverSearchLoading(false);
    }
  };

  const handleAuthoritySearchInput = (value) => {
    if (authoritySearchDebounceRef.current) clearTimeout(authoritySearchDebounceRef.current);
    authoritySearchDebounceRef.current = setTimeout(() => {
      loadApproverOptions(value || '');
    }, 300);
  };

  useEffect(() => {
    if (selectedRequisition?._id) loadApproverOptions('');
  }, [selectedRequisition?._id]);

  useEffect(() => () => {
    if (authoritySearchDebounceRef.current) clearTimeout(authoritySearchDebounceRef.current);
  }, []);

  const comparativeApproval = selectedRequisition?.comparativeApproval || {};
  const comparativeStatus = comparativeApproval?.status || 'not_configured';
  const approvalSteps = Array.isArray(comparativeApproval?.approvers) ? comparativeApproval.approvers : [];
  const userId = user?.id || user?._id;
  const isPendingApprover = approvalSteps.some((s) => {
    const approverId = s?.approver?._id || s?.approver;
    return String(approverId || '') === String(userId || '') && s?.status === 'pending';
  });
  const assignedToId = selectedRequisition?.procurementAssignment?.assignedTo?._id || selectedRequisition?.procurementAssignment?.assignedTo;
  const isAssignedProcurementUser = assignedToId && String(assignedToId) === String(userId || '');
  const canConfigureComparative = Boolean(selectedRequisition?._id) && (canManageAssignments || isAssignedProcurementUser);
  const hasVendorSelection = Boolean(
    (Array.isArray(quotations) && quotations.some((q) => ['Shortlisted', 'Finalized'].includes(q?.status))) ||
    (selectedRequisition?.splitPOAssignments && Object.keys(selectedRequisition.splitPOAssignments).length > 0)
  );
  const canSubmitComparative =
    canConfigureComparative &&
    ['draft', 'rejected'].includes(comparativeStatus) &&
    approvalSteps.length > 0 &&
    hasVendorSelection;
  const canApproveComparative = comparativeStatus === 'submitted' && isPendingApprover;
  const canEditAuthoritySlots =
    Boolean(canConfigureComparative && selectedRequisition && canEditComparativeAuthorityUsers(user, selectedRequisition));

  const handleAuthorityUserChange = (fieldKey, userObj) => {
    if (fieldKey === 'preparedBy') return;
    if (!canEditAuthoritySlots) return;
    setAuthorityUserSelection((prev) => ({ ...prev, [fieldKey]: userObj || null }));
    setApprovalAuthority((prev) => ({
      ...prev,
      [fieldKey]:
        userObj
          ? ([userObj.firstName, userObj.lastName].filter(Boolean).join(' ').trim() || userObj.email || '')
          : ''
    }));
  };

  const handleSaveComparativeApprovers = async () => {
    if (!selectedRequisition?._id) return;
    const approverIds = [...new Set(Object.values(authorityUserSelection).map((u) => u?._id).filter(Boolean))];
    if (!approverIds.length) {
      setError('Select at least one comparative approver.');
      return;
    }
    try {
      setSavingComparativeApprovers(true);
      setError('');
      const res = await api.put(`/procurement/requisitions/${selectedRequisition._id}/comparative-approvers`, {
        approverIds
      });
      if (res.data?.success) {
        const updated = res.data.data;
        setSelectedRequisition((prev) => ({ ...prev, comparativeApproval: updated.comparativeApproval }));
        setSuccess('Comparative approvers configured successfully.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to configure comparative approvers');
    } finally {
      setSavingComparativeApprovers(false);
    }
  };

  const handleSubmitComparative = async () => {
    if (!selectedRequisition?._id) return;
    try {
      setSubmittingComparative(true);
      setError('');
      const res = await api.post(`/procurement/requisitions/${selectedRequisition._id}/comparative-submit`, {
        resolutionNote: resolutionNote.trim()
      });
      if (res.data?.success) {
        const updated = res.data.data;
        setSelectedRequisition((prev) => ({ ...prev, comparativeApproval: updated.comparativeApproval }));
        setSuccess('Comparative statement submitted for approvals.');
        setResolutionNote('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit comparative statement');
    } finally {
      setSubmittingComparative(false);
    }
  };

  const handleApproveComparative = async () => {
    if (!selectedRequisition?._id) return;
    try {
      setApprovingComparative(true);
      setError('');
      const res = await api.post(`/procurement/requisitions/${selectedRequisition._id}/comparative-approve`);
      if (res.data?.success) {
        const updated = res.data.data;
        setSelectedRequisition((prev) => ({ ...prev, comparativeApproval: updated.comparativeApproval }));
        setSuccess(res.data.message || 'Approval recorded.');
        // Server finalizes shortlisted (or split-PO) quotations; refresh list so UI shows Finalized.
        if (updated?.comparativeApproval?.status === 'approved' && selectedRequisition?._id) {
          try {
            const response = await api.get(`/procurement/quotations/by-indent/${selectedRequisition._id}`);
            if (response.data.success) {
              setQuotations(response.data.data || []);
            }
            setSuccess('All authorities approved. Quotation(s) are finalized where a vendor was shortlisted.');
          } catch (refreshErr) {
            console.error('Refresh quotations after comparative approval failed:', refreshErr);
          }
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve comparative statement');
    } finally {
      setApprovingComparative(false);
    }
  };

  const handleRejectComparative = async () => {
    if (!selectedRequisition?._id || !rejectObservation.trim()) return;
    try {
      setRejectingComparative(true);
      setError('');
      const res = await api.post(`/procurement/requisitions/${selectedRequisition._id}/comparative-reject`, {
        observation: rejectObservation.trim()
      });
      if (res.data?.success) {
        const updated = res.data.data;
        setSelectedRequisition((prev) => ({ ...prev, comparativeApproval: updated.comparativeApproval }));
        setRejectDialogOpen(false);
        setRejectObservation('');
        setSuccess(res.data.message || 'Comparative statement rejected.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject comparative statement');
    } finally {
      setRejectingComparative(false);
    }
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0.00';
    return parseFloat(num).toFixed(2);
  };

  const handleSaveApprovals = async () => {
    if (!selectedRequisition?._id) return;
    try {
      setSavingApprovals(true);
      setError('');
      const preparedByUser =
        authorityUserSelection.preparedBy ||
        (user
          ? {
              _id: user._id || user.id,
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              email: user.email || ''
            }
          : null);
      const payload = {
        ...approvalAuthority,
        preparedBy:
          preparedByUser
            ? ([preparedByUser.firstName, preparedByUser.lastName].filter(Boolean).join(' ').trim() || preparedByUser.email || '')
            : '',
        preparedByUser: preparedByUser?._id || null,
        verifiedByUser: authorityUserSelection.verifiedBy?._id || null,
        authorisedRepUser: authorityUserSelection.authorisedRep?._id || null,
        financeRepUser: authorityUserSelection.financeRep?._id || null,
        managerProcurementUser: authorityUserSelection.managerProcurement?._id || null,
        notes: comparativeNote
      };
      await api.put(`/indents/${selectedRequisition._id}/comparative-statement-approvals`, {
        ...payload
      });
      await handleSaveComparativeApprovers();
      setApprovalsSavedForRequisition(selectedRequisition._id);
      setSuccess('Approval authorities and note saved successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save approval authorities');
    } finally {
      setSavingApprovals(false);
    }
  };

  const handleSelectVendor = (quotation) => {
    setSelectDialog({ open: true, quotation });
  };

  const handleCreateSplitPOs = async ({ vendorAssignments }) => {
    if (!selectedRequisition?._id) return;
    try {
      setCreatingSplitPOs(true);
      setError('');
      await api.put(`/indents/${selectedRequisition._id}/split-po-assignments`, { vendorAssignments });
      setSelectedRequisition((prev) => (prev ? { ...prev, splitPOAssignments: vendorAssignments } : prev));
      if (selectedRequisition?._id) {
        const response = await api.get(`/procurement/quotations/by-indent/${selectedRequisition._id}`);
        if (response.data.success) {
          setQuotations(response.data.data || []);
        }
      }
      setSuccess('Vendor assignments saved and quotations shortlisted. Create Split POs from the Quotations page.');
      setTimeout(() => setSuccess(''), 8000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to shortlist vendors');
    } finally {
      setCreatingSplitPOs(false);
    }
  };

  const confirmSelectVendor = async () => {
    if (!selectDialog.quotation) return;

    try {
      setUpdating(true);
      setError('');
      const selectedStatus = comparativeStatus === 'approved' ? 'Finalized' : 'Shortlisted';
      await api.put(`/procurement/quotations/${selectDialog.quotation._id}`, {
        status: selectedStatus
      });

      // Keep only one active preferred vendor marker before approval.
      const otherQuotations = quotations.filter(q => q._id !== selectDialog.quotation._id);
      for (const quote of otherQuotations) {
        if (quote.status === 'Shortlisted') {
          try {
            await api.put(`/procurement/quotations/${quote._id}`, {
              status: 'Received'
            });
          } catch (err) {
            console.error(`Failed to update quotation ${quote._id}:`, err);
          }
        }
      }

      // Reload quotations to reflect the changes
      if (selectedRequisition?._id) {
        const response = await api.get(`/procurement/quotations/by-indent/${selectedRequisition._id}`);
        if (response.data.success) {
          setQuotations(response.data.data || []);
        }
      }

      setSelectDialog({ open: false, quotation: null });
      setSuccess(
        selectedStatus === 'Finalized'
          ? 'Vendor selected successfully. Quotation status updated to Finalized.'
          : 'Vendor preference saved as Shortlisted. It will be finalized after all authorities approve.'
      );
      
      // Auto-dismiss success message after 5 seconds
      setTimeout(() => {
        setSuccess('');
      }, 5000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to select vendor');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight={600}>
            Comparative Statements
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadRequisitions}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {/* Requisition Selection */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <TextField
              select
              fullWidth
              label="Select Requisition"
              value={selectedRequisition?._id || ''}
              onChange={(e) => {
                const req = requisitions.find(r => r._id === e.target.value);
                if (req) handleRequisitionSelect(req);
              }}
              disabled={loading || requisitions.length === 0}
              helperText={loading ? 'Loading requisitions...' : requisitions.length === 0 ? 'No approved requisitions found' : ''}
            >
              {requisitions.length === 0 && !loading && (
                <MenuItem disabled value="">
                  No requisitions available
                </MenuItem>
              )}
              {requisitions.map((req) => (
                <MenuItem key={req._id} value={req._id}>
                  {req.indentNumber || req._id} - {req.title || 'Untitled'} ({req.department?.name || 'N/A'})
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        {/* Comparative Statement Display */}
        {selectedRequisition && (
          <>
            {selectedRequisition?.comparativeApproval?.status === 'rejected' && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Rejection observations
                </Typography>
                {(() => {
                  const observations = Array.isArray(selectedRequisition?.comparativeApproval?.rejectionObservations)
                    ? selectedRequisition.comparativeApproval.rejectionObservations
                    : [];
                  if (observations.length === 0 && selectedRequisition?.comparativeApproval?.rejectionObservation) {
                    return <Typography variant="body2">{selectedRequisition.comparativeApproval.rejectionObservation}</Typography>;
                  }
                  return observations.map((obs, idx) => {
                    const by =
                      [obs?.rejectedBy?.firstName, obs?.rejectedBy?.lastName].filter(Boolean).join(' ').trim() ||
                      obs?.rejectedBy?.email ||
                      'Approver';
                    const at = obs?.rejectedAt ? new Date(obs.rejectedAt).toLocaleString() : '';
                    return (
                      <Box key={`${obs?._id || idx}`} sx={{ mb: 1 }}>
                        <Typography variant="body2">
                          {idx + 1}. <strong>{by}</strong>{at ? ` (${at})` : ''}: {obs?.observation || '—'}
                        </Typography>
                        {obs?.resolutionNote ? (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2 }}>
                            Resolution: {obs.resolutionNote}
                          </Typography>
                        ) : null}
                      </Box>
                    );
                  });
                })()}
              </Alert>
            )}
            {canSubmitComparative && selectedRequisition?.comparativeApproval?.status === 'rejected' && (
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Resolution / corrective actions before resubmission"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                sx={{ mb: 2 }}
              />
            )}
            <ComparativeStatementView
              requisition={selectedRequisition}
              quotations={quotations}
              approvalAuthority={approvalAuthority}
              note={comparativeNote}
              readOnly={false}
              formatNumber={formatNumber}
              loadingQuotations={loadingQuotations}
              onSaveApprovals={canConfigureComparative ? handleSaveApprovals : undefined}
              onSelectVendor={handleSelectVendor}
              savingApprovals={savingApprovals}
              updating={updating}
              approvalsSavedForRequisition={approvalsSavedForRequisition}
              onNoteChange={canConfigureComparative ? setComparativeNote : undefined}
              authorityUserOptions={approverOptions}
              authorityUserLoading={approverSearchLoading}
              authorityUserSelection={authorityUserSelection}
              onAuthorityUserChange={handleAuthorityUserChange}
              onAuthorityUserSearchInput={handleAuthoritySearchInput}
              onCreateSplitPOs={canConfigureComparative ? handleCreateSplitPOs : undefined}
              creatingSplitPOs={creatingSplitPOs}
              showPrintButton
              canSelectVendors={canConfigureComparative}
              onSubmitComparative={handleSubmitComparative}
              submittingComparative={submittingComparative}
              canSubmitComparative={canSubmitComparative}
              onApproveComparative={handleApproveComparative}
              onRejectComparative={() => setRejectDialogOpen(true)}
              canApproveComparative={canApproveComparative}
              approvingComparative={approvingComparative}
              canEditApprovalAuthorities={canEditAuthoritySlots}
            />
          </>
        )}

        {/* Print Styles */}
        <Box
          component="style"
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                @page {
                  size: A4 landscape;
                  margin: 8mm;
                }
                body * {
                  visibility: hidden;
                }
                .print-content,
                .print-content * {
                  visibility: visible;
                }
                .print-content {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  page-break-inside: avoid;
                }
                .comparative-table {
                  font-size: 0.7rem !important;
                }
                .comparative-table th,
                .comparative-table td {
                  padding: 4px 4px !important;
                  font-size: 0.7rem !important;
                  line-height: 1.2 !important;
                }
                .comparative-table thead th {
                  padding: 6px 4px !important;
                }
                .terms-table th,
                .terms-table td {
                  padding: 4px 4px !important;
                  font-size: 0.7rem !important;
                }
                .signature-cell {
                  padding: 10px 5px !important;
                }
                .signature-cell .MuiBox-root {
                  min-height: 30px !important;
                  margin-bottom: 4px !important;
                }
                .signature-cell .MuiTypography-root {
                  font-size: 0.6rem !important;
                }
                * {
                  page-break-inside: avoid;
                  page-break-after: avoid;
                }
                table {
                  page-break-inside: avoid;
                }
                tr {
                  page-break-inside: avoid;
                  page-break-after: avoid;
                }
              }
            `
          }}
        />
      </Paper>

      {/* Select Vendor Confirmation Dialog */}
      <Dialog
        open={selectDialog.open}
        onClose={() => !updating && setSelectDialog({ open: false, quotation: null })}
      >
        <DialogTitle>Select Vendor</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to select <strong>{selectDialog.quotation?.vendor?.name}</strong> as the preferred vendor?
            <br /><br />
            This will:
            <ul>
              <li>Mark this quotation as <strong>{comparativeStatus === 'approved' ? 'Finalized' : 'Shortlisted'}</strong></li>
              <li>Reset any previously shortlisted vendor to <strong>Received</strong></li>
            </ul>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectDialog({ open: false, quotation: null })} disabled={updating}>
            Cancel
          </Button>
          <Button 
            onClick={confirmSelectVendor} 
            variant="contained" 
            color="primary"
            disabled={updating}
            startIcon={updating ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            {updating ? 'Updating...' : (comparativeStatus === 'approved' ? 'Confirm Finalize' : 'Confirm Shortlist')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Comparative Statement</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={4}
            label="Observation (required)"
            value={rejectObservation}
            onChange={(e) => setRejectObservation(e.target.value)}
            inputProps={{ maxLength: 1000 }}
            helperText={`${rejectObservation.length}/1000`}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleRejectComparative} disabled={rejectingComparative || !rejectObservation.trim()}>
            {rejectingComparative ? 'Rejecting...' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ComparativeStatements;
