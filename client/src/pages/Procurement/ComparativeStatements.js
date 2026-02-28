import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  MenuItem,
  Chip,
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
  Print as PrintIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import dayjs from 'dayjs';
import ComparativeStatementView from '../../components/Procurement/ComparativeStatementView';

const ComparativeStatements = () => {
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
        setApprovalAuthority({
          preparedBy: approvals.preparedBy || '',
          verifiedBy: approvals.verifiedBy || '',
          authorisedRep: approvals.authorisedRep || '',
          financeRep: approvals.financeRep || '',
          managerProcurement: approvals.managerProcurement || ''
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

  const formatDateForPrint = (date) => {
    if (!date) return '';
    return dayjs(date).format('DD/MM/YYYY');
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
      await api.put(`/indents/${selectedRequisition._id}/comparative-statement-approvals`, {
        ...approvalAuthority,
        notes: comparativeNote
      });
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
      
      // Update selected quotation to Finalized
      await api.put(`/procurement/quotations/${selectDialog.quotation._id}`, {
        status: 'Finalized'
      });

      // Update other quotations to Rejected (optional - you can remove this if you want to keep them as is)
      const otherQuotations = quotations.filter(q => q._id !== selectDialog.quotation._id);
      for (const quote of otherQuotations) {
        if (quote.status !== 'Finalized') {
          try {
            await api.put(`/procurement/quotations/${quote._id}`, {
              status: 'Rejected'
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
      setSuccess('Vendor selected successfully. Quotation status updated to Finalized.');
      
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
          <ComparativeStatementView
            requisition={selectedRequisition}
            quotations={quotations}
            approvalAuthority={approvalAuthority}
            note={comparativeNote}
            readOnly={false}
            formatNumber={formatNumber}
            loadingQuotations={loadingQuotations}
            onSaveApprovals={handleSaveApprovals}
            onSelectVendor={handleSelectVendor}
            savingApprovals={savingApprovals}
            updating={updating}
            approvalsSavedForRequisition={approvalsSavedForRequisition}
            onNoteChange={setComparativeNote}
            onApprovalChange={(key, value) => setApprovalAuthority((prev) => ({ ...prev, [key]: value }))}
            onCreateSplitPOs={handleCreateSplitPOs}
            creatingSplitPOs={creatingSplitPOs}
            showPrintButton
          />
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
              <li>Update this quotation status to <strong>Finalized</strong></li>
              <li>Update other quotations status to <strong>Rejected</strong></li>
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
            {updating ? 'Updating...' : 'Confirm Selection'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ComparativeStatements;
