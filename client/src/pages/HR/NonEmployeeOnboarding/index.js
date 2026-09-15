import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Paper, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Grid
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { DigitalSignatureImage } from '../../../components/common/DigitalSignatureImage';
import { formatDateTime } from '../../../utils/dateUtils';
import { alpha, useTheme } from '@mui/material/styles';
import nonEmployeeService from '../../../services/nonEmployeeService';
import NonEmployeeForm from './NonEmployeeForm';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

const NonEmployeeOnboarding = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [approvalDialog, setApprovalDialog] = useState({ open: false, record: null });
  const [approvalComments, setApprovalComments] = useState('');
  const [approvalSignature, setApprovalSignature] = useState('');
  const [approvalAgree, setApprovalAgree] = useState(false);
  const [approvalType, setApprovalType] = useState('HOD'); // 'HOD' or 'AVP'
  const [rejectDialog, setRejectDialog] = useState({ open: false, record: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, record: null });
  const [viewDialog, setViewDialog] = useState({ open: false, record: null });
  const [editData, setEditData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { user } = useAuth();
  const theme = useTheme();

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const response = await nonEmployeeService.getRecords();
      setRecords(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load records');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const openApproveDialog = (record, type) => {
    setApprovalDialog({ open: true, record });
    setApprovalComments('');
    setApprovalSignature(
      user?.digitalSignature ||
      (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || '')
    );
    setApprovalAgree(false);
    setApprovalType(type);
  };

  const handleApproveSubmit = async () => {
    if (!approvalAgree) {
      toast.error('Please confirm approval checkbox');
      return;
    }
    const item = approvalDialog.record;
    if (!item) return;

    setActionLoading(true);
    try {
      if (approvalType === 'HOD') {
        await nonEmployeeService.approveByHOD(item._id, {
          comments: approvalComments,
          signature: approvalSignature.trim()
        });
      } else {
        await nonEmployeeService.approveByAVP(item._id, {
          comments: approvalComments,
          signature: approvalSignature.trim()
        });
      }
      toast.success('Approved successfully');
      setApprovalDialog({ open: false, record: null });
      fetchRecords();
    } catch (error) {
      toast.error('Failed to approve');
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    const item = rejectDialog.record;
    if (!item) return;

    if (!approvalComments.trim()) {
      toast.error('Please provide rejection comments');
      return;
    }

    setActionLoading(true);
    try {
      if (approvalType === 'HOD') {
        await nonEmployeeService.rejectByHOD(item._id, {
          comments: approvalComments,
          signature: approvalSignature.trim()
        });
      } else {
        await nonEmployeeService.rejectByAVP(item._id, {
          comments: approvalComments,
          signature: approvalSignature.trim()
        });
      }
      toast.success('Rejected successfully');
      setRejectDialog({ open: false, record: null });
      fetchRecords();
    } catch (error) {
      toast.error('Failed to reject');
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSubmit = async () => {
    const item = deleteDialog.record;
    if (!item) return;

    setActionLoading(true);
    try {
      await nonEmployeeService.deleteRecord(item._id);
      toast.success('Record deleted successfully');
      setDeleteDialog({ open: false, record: null });
      fetchRecords();
    } catch (error) {
      toast.error('Failed to delete record');
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Non-Employee Onboarding</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={() => {
            setEditData(null);
            setOpenForm(true);
          }}
        >
          New Record
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Record #</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>CNIC</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Approval Authority</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((record) => {
              const authorityMap = {
                'Pending HOD HR': 'HOD HR',
                'Pending AVP': 'AVP (Taj Fahad Farid)',
                'Forwarded to CEO': 'CEO Secretariat',
                'Approved by CEO': 'Approved',
                'Rejected by CEO': 'Rejected',
                'Returned': 'Returned to Initiator'
              };
              const authority = authorityMap[record.workflowStatus] || record.workflowStatus;

              const userId = user?.id || user?._id;
              const isPendingHOD = record.workflowStatus === 'Pending HOD HR' && (userId === record.assignedHod?._id || userId === record.assignedHod);
              const isPendingAVP = record.workflowStatus === 'Pending AVP' && (userId === record.assignedAvp?._id || userId === record.assignedAvp);
              const isPendingAuthority = isPendingHOD || isPendingAVP;
              const currentPendingType = isPendingHOD ? 'HOD' : 'AVP';

              return (
                <TableRow key={record._id}>
                  <TableCell>{record.recordNumber}</TableCell>
                  <TableCell>{`${record.firstName} ${record.lastName || ''}`}</TableCell>
                  <TableCell>{record.role}</TableCell>
                  <TableCell>{record.cnic}</TableCell>
                  <TableCell>
                  <Chip 
                    label={record.workflowStatus} 
                    color={
                      record.workflowStatus === 'Approved by CEO' ? 'success' :
                      record.workflowStatus === 'Rejected by CEO' ? 'error' : 'warning'
                    } 
                    size="small" 
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">
                    {authority}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={1} alignItems="center">
                    <IconButton 
                      color="info" 
                      size="small" 
                      title="View Details"
                      onClick={() => setViewDialog({ open: true, record })}
                    >
                      <ViewIcon fontSize="small" />
                    </IconButton>
                    {isPendingAuthority && (
                      <>
                        <Button 
                          variant="contained" 
                          color="success" 
                          size="small" 
                          onClick={() => openApproveDialog(record, currentPendingType)}
                        >
                          Approve ({currentPendingType})
                        </Button>
                        <Button 
                          variant="contained" 
                          color="error" 
                          size="small" 
                          onClick={() => {
                            setRejectDialog({ open: true, record });
                            setApprovalComments('');
                            setApprovalSignature(user?.digitalSignature || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || ''));
                            setApprovalType(currentPendingType);
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {(() => {
                      const isDeveloper = user?.email === 'developer@tovus.net';
                      const isInitiatorEditable = ['Pending HOD HR', 'Draft', 'Returned'].includes(record.workflowStatus) && (userId === record.initiator?._id || userId === record.initiator);
                      const canEdit = isDeveloper || isInitiatorEditable;
                      const canDelete = isInitiatorEditable; // Maintain existing delete logic
                      
                      if (canEdit || canDelete) {
                        return (
                          <React.Fragment key="actions">
                            {canEdit && (
                              <IconButton 
                                color="primary" 
                                size="small" 
                                onClick={() => {
                                  setEditData(record);
                                  setOpenForm(true);
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            )}
                            {canDelete && (
                              <IconButton 
                                color="error" 
                                size="small" 
                                onClick={() => setDeleteDialog({ open: true, record })}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </React.Fragment>
                        );
                      }
                      return null;
                    })()}
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
            {records.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {loading ? 'Loading...' : 'No records found.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <NonEmployeeForm 
        open={openForm} 
        editData={editData}
        onClose={() => setOpenForm(false)} 
        onSuccess={() => {
          setOpenForm(false);
          fetchRecords();
        }} 
      />

      <Dialog open={approvalDialog.open} onClose={() => setApprovalDialog({ open: false, record: null })} maxWidth="sm" fullWidth>
        <DialogTitle>Approve Non-Employee Onboarding</DialogTitle>
        <DialogContent dividers>
          <Box mb={2}>
            <Typography variant="subtitle1" fontWeight="bold">
              Record: {approvalDialog.record?.recordNumber} - {approvalDialog.record?.firstName} {approvalDialog.record?.lastName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Role: {approvalDialog.record?.role}, CNIC: {approvalDialog.record?.cnic}
            </Typography>
          </Box>
          <TextField
            label="Comments"
            fullWidth
            multiline
            rows={3}
            value={approvalComments}
            onChange={(e) => setApprovalComments(e.target.value)}
            margin="normal"
          />
          <Box mt={2} p={2} bgcolor="background.default" borderRadius={1}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={approvalAgree}
                  onChange={(e) => setApprovalAgree(e.target.checked)}
                  color="primary"
                />
              }
              label="I hereby approve this onboarding record and confirm the details are correct."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialog({ open: false, record: null })}>Cancel</Button>
          <Button
            onClick={handleApproveSubmit}
            variant="contained"
            color="success"
            disabled={!approvalAgree || actionLoading}
          >
            {actionLoading ? 'Approving...' : 'Confirm Approval'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rejectDialog.open} onClose={() => setRejectDialog({ open: false, record: null })} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Non-Employee Onboarding</DialogTitle>
        <DialogContent dividers>
          <Box mb={2}>
            <Typography variant="subtitle1" fontWeight="bold">
              Record: {rejectDialog.record?.recordNumber} - {rejectDialog.record?.firstName} {rejectDialog.record?.lastName}
            </Typography>
          </Box>
          <TextField
            label="Rejection Comments"
            fullWidth
            required
            multiline
            rows={3}
            value={approvalComments}
            onChange={(e) => setApprovalComments(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog({ open: false, record: null })}>Cancel</Button>
          <Button
            onClick={handleRejectSubmit}
            variant="contained"
            color="error"
            disabled={!approvalComments.trim() || actionLoading}
          >
            {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, record: null })} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Record</DialogTitle>
        <DialogContent dividers>
          <Typography>Are you sure you want to delete the onboarding record for <strong>{deleteDialog.record?.firstName} {deleteDialog.record?.lastName}</strong>?</Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, record: null })}>Cancel</Button>
          <Button
            onClick={handleDeleteSubmit}
            variant="contained"
            color="error"
            disabled={actionLoading}
          >
            {actionLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialog.open} onClose={() => setViewDialog({ open: false, record: null })} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05), borderBottom: '1px solid', borderColor: 'divider', fontWeight: 700 }}>
          Non-Employee Onboarding Details
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 2, md: 4 } }}>
          <Box mb={4}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 1, display: 'block', mb: 2 }}>
                    Candidate Profile
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Full Name</Typography>
                      <Typography variant="body1" fontWeight={600}>{viewDialog.record?.firstName} {viewDialog.record?.lastName}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">CNIC</Typography>
                      <Typography variant="body1">{viewDialog.record?.cnic}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Role / Designation</Typography>
                      <Typography variant="body1">{viewDialog.record?.role}</Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 1, display: 'block', mb: 2 }}>
                    Contact & Remuneration
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Phone</Typography>
                      <Typography variant="body1">{viewDialog.record?.phone || 'N/A'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Address</Typography>
                      <Typography variant="body1">{viewDialog.record?.address || 'N/A'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Expected Wages</Typography>
                      <Typography variant="body1" color="success.main" fontWeight={700}>
                        {viewDialog.record?.expectedWages ? `${Number(viewDialog.record.expectedWages).toLocaleString()} PKR` : '0 PKR'}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Box>

          <Box mb={4}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.03), borderColor: alpha(theme.palette.info.main, 0.2) }}>
              <Typography variant="overline" color="info.dark" sx={{ fontWeight: 600, letterSpacing: 1, display: 'block', mb: 1 }}>
                Justification / Remarks
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.7 }}>
                {viewDialog.record?.justification || 'No justification provided.'}
              </Typography>
            </Paper>
          </Box>

          <Box>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 1, display: 'block', mb: 3 }}>
                Approval Authorities
              </Typography>
              <Grid container spacing={4}>
                {/* HOD HR Approval */}
                <Grid item xs={12} sm={4}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>HOD HR</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {viewDialog.record?.hodApprovedBy ? `${viewDialog.record.hodApprovedBy.firstName || ''} ${viewDialog.record.hodApprovedBy.lastName || ''}`.trim() || viewDialog.record.hodApprovedBy.email || 'Approved' : 'Pending'}
                    </Typography>
                    {viewDialog.record?.hodApprovedAt && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        {formatDateTime(viewDialog.record.hodApprovedAt)}
                      </Typography>
                    )}
                    {viewDialog.record?.hodSignature ? (
                      <Box sx={{ mt: 1, borderTop: '1px solid', borderColor: 'divider', pt: 1, display: 'inline-block' }}>
                        <DigitalSignatureImage userOrPath={{ digitalSignature: viewDialog.record.hodSignature }} alt="HOD Signature" />
                      </Box>
                    ) : (
                      <Box sx={{ mt: 1, borderTop: '1px solid', borderColor: 'divider', pt: 1, width: '100px' }}>
                        <Typography variant="caption" color="text.disabled">No Signature</Typography>
                      </Box>
                    )}
                  </Box>
                </Grid>

                {/* AVP Approval */}
                <Grid item xs={12} sm={4}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>AVP (Taj Fahad Farid)</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {viewDialog.record?.avpApprovedBy ? `${viewDialog.record.avpApprovedBy.firstName || ''} ${viewDialog.record.avpApprovedBy.lastName || ''}`.trim() || viewDialog.record.avpApprovedBy.email || 'Approved' : 'Pending'}
                    </Typography>
                    {viewDialog.record?.avpApprovedAt && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        {formatDateTime(viewDialog.record.avpApprovedAt)}
                      </Typography>
                    )}
                    {viewDialog.record?.avpSignature ? (
                      <Box sx={{ mt: 1, borderTop: '1px solid', borderColor: 'divider', pt: 1, display: 'inline-block' }}>
                        <DigitalSignatureImage userOrPath={{ digitalSignature: viewDialog.record.avpSignature }} alt="AVP Signature" />
                      </Box>
                    ) : (
                      <Box sx={{ mt: 1, borderTop: '1px solid', borderColor: 'divider', pt: 1, width: '100px' }}>
                        <Typography variant="caption" color="text.disabled">No Signature</Typography>
                      </Box>
                    )}
                  </Box>
                </Grid>

                {/* CEO Approval */}
                <Grid item xs={12} sm={4}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>CEO Secretariat</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {viewDialog.record?.ceoApprovedBy ? `${viewDialog.record.ceoApprovedBy.firstName || ''} ${viewDialog.record.ceoApprovedBy.lastName || ''}`.trim() || viewDialog.record.ceoApprovedBy.email || 'Approved' : 'Pending'}
                    </Typography>
                    {viewDialog.record?.ceoApprovedAt && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        {formatDateTime(viewDialog.record.ceoApprovedAt)}
                      </Typography>
                    )}
                    {viewDialog.record?.ceoSignature ? (
                      <Box sx={{ mt: 1, borderTop: '1px solid', borderColor: 'divider', pt: 1, display: 'inline-block' }}>
                        <DigitalSignatureImage userOrPath={{ digitalSignature: viewDialog.record.ceoSignature }} alt="CEO Signature" />
                      </Box>
                    ) : (
                      <Box sx={{ mt: 1, borderTop: '1px solid', borderColor: 'divider', pt: 1, width: '100px' }}>
                        <Typography variant="caption" color="text.disabled">No Signature</Typography>
                      </Box>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
          <Button variant="contained" color="inherit" onClick={() => setViewDialog({ open: false, record: null })}>Close window</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NonEmployeeOnboarding;
