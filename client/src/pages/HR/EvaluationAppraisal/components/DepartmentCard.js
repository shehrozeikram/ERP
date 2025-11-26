import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Collapse,
  Chip,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Person as PersonIcon,
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { evaluationDocumentsService } from '../../../../services/evaluationDocumentsService';

const DepartmentCard = ({ department, hod, documents, onViewDocument, onDocumentUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const [approvalDialog, setApprovalDialog] = useState({ open: false, doc: null, action: null });
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const statusColors = useMemo(() => ({
      draft: 'default',
      sent: 'info',
      in_progress: 'warning',
      submitted: 'primary',
      completed: 'success',
      archived: 'secondary'
  }), []);

  const getStatusColor = useCallback((status) => statusColors[status] || 'default', [statusColors]);

  const getStatusLabel = useCallback((status) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }, []);

  // Get review period from documents (use first document's review period if available)
  const reviewPeriod = useMemo(() => {
    const docWithReviewPeriod = documents.find(doc => doc.reviewPeriodFrom && doc.reviewPeriodTo);
    return docWithReviewPeriod ? {
        from: docWithReviewPeriod.reviewPeriodFrom,
        to: docWithReviewPeriod.reviewPeriodTo
    } : null;
  }, [documents]);

  // Get submitted documents with evaluator info
  const submittedEvaluators = useMemo(() => {
    const submittedDocs = documents.filter(doc => doc.status === 'submitted' && doc.evaluator);
    if (submittedDocs.length === 0) return [];
    
      const evaluators = submittedDocs.map(doc => ({
        name: `${doc.evaluator.firstName} ${doc.evaluator.lastName}`,
        id: doc.evaluator._id
      }));
    
    return evaluators.filter((evaluator, index, self) => 
        index === self.findIndex(e => e.id === evaluator.id)
      );
  }, [documents]);

  // Get approval info for department
  const approvalInfo = useMemo(() => {
    const submittedDocs = documents.filter(doc => doc.status === 'submitted' && doc.approvalStatus);
    if (submittedDocs.length === 0) return { hasPending: false };
    
    const pendingDocs = submittedDocs.filter(doc => 
      doc.approvalStatus === 'pending' || doc.approvalStatus === 'in_progress'
    );
    
    if (pendingDocs.length > 0) {
      const firstDoc = pendingDocs[0];
      const currentLevel = firstDoc.currentApprovalLevel || 1;
      const currentLevelData = firstDoc.approvalLevels?.[currentLevel - 1];
      
      return {
        hasPending: true,
        currentLevel,
        currentLevelTitle: currentLevelData?.title || `Level ${currentLevel}`,
        totalDocs: pendingDocs.length
      };
    }
    
    return { hasPending: false };
  }, [documents]);

  const handleApprove = async () => {
    if (!approvalDialog.doc) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await evaluationDocumentsService.approve(approvalDialog.doc._id, { comments });
      
      if (response.data && onDocumentUpdate) {
        onDocumentUpdate(response.data.data);
      }
      
      setApprovalDialog({ open: false, doc: null, action: null });
      setComments('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve document');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!approvalDialog.doc) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await evaluationDocumentsService.reject(approvalDialog.doc._id, { comments });
      
      if (response.data && onDocumentUpdate) {
        onDocumentUpdate(response.data.data);
      }
      
      setApprovalDialog({ open: false, doc: null, action: null });
      setComments('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject document');
    } finally {
      setLoading(false);
    }
  };

  const openApprovalDialog = (doc, action) => {
    setApprovalDialog({ open: true, doc, action });
    setComments('');
    setError(null);
  };

  const getCurrentApprovalLevel = useCallback((doc) => {
    if (!doc.approvalLevels?.length) return null;
    const currentLevel = doc.currentApprovalLevel || 1;
    return doc.approvalLevels[currentLevel - 1];
  }, []);

  const getApprovedLevels = useCallback((doc) => {
    return doc.approvalLevels?.filter(level => level.status === 'approved') || [];
  }, []);

  const canApprove = useCallback((doc) => {
    return doc.status === 'submitted' && 
           (doc.approvalStatus === 'pending' || doc.approvalStatus === 'in_progress') &&
           doc.approvalStatus !== 'rejected' &&
           doc.approvalStatus !== 'approved';
  }, []);

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              {department?.name || 'No Department'}
            </Typography>
            {reviewPeriod && (
              <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 'bold' }}>
                Review Period: {dayjs(reviewPeriod.from).format('DD MMM YYYY')} to {dayjs(reviewPeriod.to).format('DD MMM YYYY')}
              </Typography>
            )}
            {submittedEvaluators.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Submitted by: {submittedEvaluators.map(e => e.name).join(', ')}
              </Typography>
            )}
            {hod && (
              <Box display="flex" alignItems="center" mt={1}>
                <Avatar sx={{ width: 32, height: 32, mr: 1 }}>
                  <PersonIcon fontSize="small" />
                </Avatar>
                <Typography variant="body2" color="text.secondary">
                  HOD: {hod.firstName} {hod.lastName}
                </Typography>
              </Box>
            )}
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            {approvalInfo?.hasPending && (
              <>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => {
                    const pendingDoc = documents.find(doc => canApprove(doc));
                    if (pendingDoc) openApprovalDialog(pendingDoc, 'approve');
                  }}
                >
                  Approve
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={() => {
                    const pendingDoc = documents.find(doc => canApprove(doc));
                    if (pendingDoc) openApprovalDialog(pendingDoc, 'reject');
                  }}
                >
                  Reject
                </Button>
                {approvalInfo.currentLevelTitle && (
                  <Chip
                    label={`Level ${approvalInfo.currentLevel}: ${approvalInfo.currentLevelTitle}`}
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                )}
              </>
            )}
            <Chip 
              label={`${documents.length} Document${documents.length !== 1 ? 's' : ''}`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <IconButton
              onClick={() => setExpanded(!expanded)}
              size="small"
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Box>
            {documents.length === 0 ? (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                No documents found
              </Typography>
            ) : (
              documents.map((doc) => (
                <Box
                  key={doc._id}
                  sx={{
                    p: 2,
                    mb: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                >
                  <Box flex={1}>
                    <Typography variant="body1" fontWeight="medium">
                      {doc.employee?.firstName} {doc.employee?.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ID: {doc.employee?.employeeId} • {doc.formType === 'blue_collar' ? 'Blue Collar' : 'White Collar'}
                    </Typography>
                    {doc.status === 'submitted' && doc.evaluator && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Submitted by: {doc.evaluator.firstName} {doc.evaluator.lastName}
                      </Typography>
                    )}
                    {doc.status === 'sent' && doc.evaluator && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Sent to: {doc.evaluator.firstName} {doc.evaluator.lastName}
                      </Typography>
                    )}
                    {doc.evaluator && doc.status !== 'submitted' && doc.status !== 'sent' && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Evaluator: {doc.evaluator.firstName} {doc.evaluator.lastName}
                      </Typography>
                    )}
                    {doc.submittedAt && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Submitted: {dayjs(doc.submittedAt).format('DD MMM YYYY')}
                      </Typography>
                    )}
                    {doc.totalScore !== undefined && doc.percentage !== undefined && (
                      <Typography 
                        variant="caption" 
                        color="primary" 
                        sx={{ 
                          display: 'block', 
                          mt: 0.5, 
                          fontWeight: 700,
                          '& strong': { fontWeight: 700 }
                        }}
                      >
                        <strong>Score: {doc.totalScore} ({doc.percentage}%)</strong>
                      </Typography>
                    )}
                    {doc.approvalStatus && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Approval: {doc.approvalStatus === 'pending' ? 'Pending' : doc.approvalStatus === 'approved' ? 'Approved' : doc.approvalStatus === 'rejected' ? 'Rejected' : 'In Progress'}
                        {doc.currentApprovalLevel && ` (Level ${doc.currentApprovalLevel}/4)`}
                      </Typography>
                    )}
                    {getApprovedLevels(doc).length > 0 && (
                      <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                          Approved by:
                        </Typography>
                        {getApprovedLevels(doc).map((level) => (
                          <Box key={level.level} sx={{ mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: level.comments ? 0.25 : 0 }}>
                              <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                              <Typography variant="caption" color="text.secondary">
                                <strong>Level {level.level}:</strong> {level.approver 
                                  ? `${level.approver.firstName} ${level.approver.lastName}${level.approver.placementDesignation?.title ? ` (${level.approver.placementDesignation.title})` : ''}`
                                  : level.approverName || level.title
                                }
                                {level.approvedAt && ` - ${dayjs(level.approvedAt).format('DD MMM YYYY')}`}
                              </Typography>
                            </Box>
                            {level.comments && (
                              <Typography 
                                variant="caption" 
                                color="text.secondary" 
                                sx={{ 
                                  display: 'block', 
                                  ml: 2.5, 
                                  fontStyle: 'italic',
                                  color: 'text.secondary'
                                }}
                              >
                                Reason: {level.comments}
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    {canApprove(doc) && (
                      <>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<CheckCircleIcon />}
                          onClick={() => openApprovalDialog(doc, 'approve')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="error"
                          startIcon={<CancelIcon />}
                          onClick={() => openApprovalDialog(doc, 'reject')}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    <Chip
                      label={getStatusLabel(doc.status)}
                      size="small"
                      color={getStatusColor(doc.status)}
                    />
                    <IconButton
                      size="small"
                      onClick={() => onViewDocument(doc)}
                      color="primary"
                      title="View Document"
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </Box>
                </Box>
              ))
            )}
          </Box>
        </Collapse>
      </CardContent>

      {/* Approval Dialog */}
      <Dialog open={approvalDialog.open} onClose={() => setApprovalDialog({ open: false, doc: null, action: null })} maxWidth="sm" fullWidth>
        <DialogTitle>
          {approvalDialog.action === 'approve' ? 'Approve Evaluation Document' : 'Reject Evaluation Document'}
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {approvalDialog.doc && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Employee:</strong> {approvalDialog.doc.employee?.firstName} {approvalDialog.doc.employee?.lastName}
              </Typography>
              {getCurrentApprovalLevel(approvalDialog.doc) && (
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>Current Level:</strong> {getCurrentApprovalLevel(approvalDialog.doc).title}
                </Typography>
              )}
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Comments (Optional)"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                sx={{ mt: 2 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialog({ open: false, doc: null, action: null })}>
            Cancel
          </Button>
          <Button
            onClick={approvalDialog.action === 'approve' ? handleApprove : handleReject}
            variant="contained"
            color={approvalDialog.action === 'approve' ? 'success' : 'error'}
            disabled={loading}
          >
            {loading ? 'Processing...' : approvalDialog.action === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default React.memo(DepartmentCard);

