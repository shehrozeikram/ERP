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
  Alert,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Person as PersonIcon,
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  DoneAll as DoneAllIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { evaluationDocumentsService } from '../../../../services/evaluationDocumentsService';
import api from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';

const DepartmentCard = ({ department, project, hod, documents, onViewDocument, onDocumentUpdate, assignedApprovalLevels = [], onDeleteDepartment }) => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [approvalDialog, setApprovalDialog] = useState({ open: false, doc: null, action: null });
  const [bulkApprovalDialog, setBulkApprovalDialog] = useState({ open: false });
  const [deleteDialog, setDeleteDialog] = useState({ open: false });
  const [selectedDocuments, setSelectedDocuments] = useState(new Set());
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bulkError, setBulkError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

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
      // Check if document is at Level 0 (either currentApprovalLevel === 0 or level0ApprovalStatus === 'pending')
      const isLevel0 = firstDoc.currentApprovalLevel === 0 || 
                       (firstDoc.level0ApprovalStatus === 'pending' && firstDoc.status === 'submitted');
      const currentLevel = isLevel0 ? 0 : (firstDoc.currentApprovalLevel ?? 1);
      
      // Handle Level 0
      if (isLevel0 || currentLevel === 0) {
        return {
          hasPending: true,
          currentLevel: 0,
          currentLevelTitle: 'Level 0/4',
          isLevel0: true,
          totalDocs: pendingDocs.length
        };
      }
      
      const currentLevelData = firstDoc.approvalLevels?.[currentLevel - 1];
      
      return {
        hasPending: true,
        currentLevel,
        currentLevelTitle: currentLevelData?.title || `Level ${currentLevel}/4`,
        isLevel0: false,
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
      
      // Check if this is Level 0 approval
      const isLevel0 = approvalDialog.doc.currentApprovalLevel === 0;
      const serviceMethod = isLevel0 
        ? evaluationDocumentsService.approveLevel0 
        : evaluationDocumentsService.approve;
      
      const response = await serviceMethod(approvalDialog.doc._id, { comments });
      
      if (response.data && onDocumentUpdate) {
        // Call with no arguments to trigger full refresh of all documents
        onDocumentUpdate();
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
      
      // Check if this is Level 0 approval
      const isLevel0 = approvalDialog.doc.currentApprovalLevel === 0;
      const serviceMethod = isLevel0 
        ? evaluationDocumentsService.rejectLevel0 
        : evaluationDocumentsService.reject;
      
      const response = await serviceMethod(approvalDialog.doc._id, { comments });
      
      if (response.data && onDocumentUpdate) {
        // Call with no arguments to trigger full refresh of all documents
        onDocumentUpdate();
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
    // Handle Level 0
    if (doc.currentApprovalLevel === 0) {
      return {
        level: 0,
        title: 'Level 0',
        approvers: doc.level0Approvers || []
      };
    }
    
    if (!doc.approvalLevels?.length) return null;
    const currentLevel = doc.currentApprovalLevel || 1;
    return doc.approvalLevels[currentLevel - 1];
  }, []);

  const getApprovedLevels = useCallback((doc) => {
    const approvedLevels = [];
    
    // Add Level 0 approvals if approved
    if (doc.level0ApprovalStatus === 'approved' && doc.level0Approvers && doc.level0Approvers.length > 0) {
      doc.level0Approvers.forEach(approver => {
        if (approver.status === 'approved') {
          approvedLevels.push({
            level: 0,
            title: 'Level 0',
            approverName: approver.approverName || 'Unknown',
            approver: approver.assignedEmployee || null,
            approvedAt: approver.approvedAt,
            comments: approver.comments
          });
        }
      });
    }
    
    // Add Level 1-4 approvals
    const level1to4Approvals = doc.approvalLevels?.filter(level => level.status === 'approved') || [];
    approvedLevels.push(...level1to4Approvals);
    
    return approvedLevels;
  }, []);

  const canApprove = useCallback((doc) => {
    // Check basic status requirements
    if (doc.status !== 'submitted' || 
        doc.approvalStatus === 'rejected' ||
        doc.approvalStatus === 'approved') {
      return false;
    }

    if (doc.approvalStatus !== 'pending' && doc.approvalStatus !== 'in_progress') {
      return false;
    }

    // Check for Level 0 approval
    // Only check Level 0 if document is actually at Level 0 (not moved to Level 1+)
    const isAtLevel0 = doc.currentApprovalLevel === 0 || 
        (doc.level0ApprovalStatus === 'pending' && doc.status === 'submitted' && (!doc.currentApprovalLevel || doc.currentApprovalLevel === 0));
    
    if (isAtLevel0) {
      // If Level 0 is fully approved, no one can approve it anymore
      if (doc.level0ApprovalStatus === 'approved') {
        return false;
      }
      
      // If document was approved at Level 0 and moved to Level 1+, Level 0 approvers can't approve it
      if (doc.level0ApprovalStatus === 'approved' && doc.currentApprovalLevel >= 1) {
        return false;
      }
      
      // If document has moved to Level 1+ (even if level0ApprovalStatus is still pending), 
      // it's no longer at Level 0, so Level 0 approvers can't approve it
      if (doc.currentApprovalLevel >= 1) {
        return false;
      }
      
      // Check if user is in level0Approvers array
      if (doc.level0Approvers && doc.level0Approvers.length > 0) {
        // Check if current user has already approved this document at Level 0
        if (user) {
          const currentUserId = user._id?.toString() || user.id?.toString();
          
          // Find the user's entry in level0Approvers
          const userApproverEntry = doc.level0Approvers.find(approver => {
            if (!approver.assignedUser) return false;
            
            let approverUserId = null;
            // Handle populated User object (has _id property)
            if (typeof approver.assignedUser === 'object') {
              if (approver.assignedUser._id) {
                approverUserId = approver.assignedUser._id.toString();
              } else if (approver.assignedUser.id) {
                approverUserId = approver.assignedUser.id.toString();
              } else if (approver.assignedUser.toString) {
                approverUserId = approver.assignedUser.toString();
              }
            } else {
              // Handle ObjectId (direct or string)
              approverUserId = approver.assignedUser.toString();
            }
            
            // Compare user IDs (case-insensitive string comparison)
            const matches = approverUserId && currentUserId && 
              (approverUserId === currentUserId || 
               approverUserId.toLowerCase() === currentUserId.toLowerCase());
            
            return matches;
          });
          
          // If user has already approved (status === 'approved'), don't show buttons
          // This is the key check: if the current user has approved, hide buttons even if document is still at Level 0
          if (userApproverEntry) {
            // Check if the user's approval status is 'approved'
            if (userApproverEntry.status === 'approved') {
              return false; // User has already approved - hide buttons
            }
            // Also check if the approver has an approvedAt timestamp (another indicator of approval)
            if (userApproverEntry.approvedAt) {
              return false; // User has already approved - hide buttons
            }
            // If the entry exists but status is not 'pending', it might be approved
            // (some implementations might use different status values)
            if (userApproverEntry.status && userApproverEntry.status !== 'pending') {
              return false; // User has already approved - hide buttons
            }
          }
        }
        
        // User should be able to approve if they're in the level0Approvers list and haven't approved yet
        // The dashboard filtering already ensures only authorized users see these documents
        // Return true only if level0ApprovalStatus is 'pending' (same logic as Level 1-4)
        return doc.level0ApprovalStatus === 'pending';
      }
      // If no level0Approvers array, but document is at Level 0 and status is pending,
      // trust the dashboard filtering (same as Level 1-4 logic)
      if (doc.level0ApprovalStatus === 'pending') {
        return true;
      }
      return false;
    }

    // IMPORTANT: Check if document was approved at Level 0 and current user was a Level 0 approver
    // If so, hide buttons for this user even if document moved to Level 1+
    // This ensures Level 0 approvers don't see buttons after they've approved
    if (doc.level0ApprovalStatus === 'approved' && doc.level0Approvers && doc.level0Approvers.length > 0 && user) {
      const currentUserId = user._id?.toString() || user.id?.toString();
      
      // Check if current user was a Level 0 approver who has already approved
      const userApproverEntry = doc.level0Approvers.find(approver => {
        if (!approver.assignedUser) return false;
        
        let approverUserId = null;
        // Handle populated User object (has _id property)
        if (typeof approver.assignedUser === 'object') {
          if (approver.assignedUser._id) {
            approverUserId = approver.assignedUser._id.toString();
          } else if (approver.assignedUser.id) {
            approverUserId = approver.assignedUser.id.toString();
          } else if (approver.assignedUser.toString) {
            approverUserId = approver.assignedUser.toString();
          }
        } else {
          // Handle ObjectId (direct or string)
          approverUserId = approver.assignedUser.toString();
        }
        
        // Compare user IDs (case-insensitive string comparison)
        const matches = approverUserId && currentUserId && 
          (approverUserId === currentUserId || 
           approverUserId.toLowerCase() === currentUserId.toLowerCase());
        
        return matches;
      });
      
      // If user was a Level 0 approver and has already approved, hide buttons
      // This applies even if document has moved to Level 1+
      if (userApproverEntry && (userApproverEntry.status === 'approved' || userApproverEntry.approvedAt)) {
        return false; // User already approved at Level 0 - hide buttons
      }
    }

    // If document was approved at Level 0 but has moved to Level 1+, 
    // Level 0 approvers cannot approve it again - but Level 1+ approvers CAN approve it
    // So we skip this check and continue to Level 1+ logic below
    // (This check was incorrectly blocking Level 1+ approvers)

    // Check if user is assigned to the current approval level (Level 1+)
    const currentLevel = doc.currentApprovalLevel;
    
    // If currentLevel is null or undefined, document might be in an invalid state
    if (!currentLevel || currentLevel < 1 || currentLevel > 4) {
      return false;
    }

    // For Level 1-4, check if user is assigned to the current level
    // If assignedApprovalLevels is empty, trust the dashboard filtering (user can see it, so they can approve it)
    // If assignedApprovalLevels has values, verify the user is assigned to this level
    // BUT: If approvalLevels array is missing or incomplete, still allow if dashboard shows it (trust backend)
    const isUserAssigned = assignedApprovalLevels.length === 0 || assignedApprovalLevels.includes(currentLevel);
    
    // If user is not assigned to Level 1+ and document is at Level 1+, don't show buttons
    // This ensures Level 0-only approvers don't see buttons for Level 1+ documents
    if (assignedApprovalLevels.length > 0 && !isUserAssigned) {
      return false;
    }
    
    // Check if the approvalLevels array exists and has the current level entry
    // If approvalLevels doesn't exist, the document might have just moved from Level 0 to Level 1
    // In this case, if the dashboard is showing it to the user, they should be able to approve it
    if (!doc.approvalLevels || !Array.isArray(doc.approvalLevels) || doc.approvalLevels.length === 0) {
      // If approvalLevels is not initialized but document is at Level 1+,
      // allow approval if user is assigned (or if assignedApprovalLevels is empty, trust dashboard)
      // The backend will initialize it if needed
      // This handles the case where documents just moved from Level 0 to Level 1
      if (currentLevel >= 1 && currentLevel <= 4 && isUserAssigned) {
        // Trust the dashboard filtering - if user can see it, they can approve it
        // The backend will handle initialization if needed
        return true;
      }
      return false; // Approval levels not initialized and user not assigned
    }

    // Find the level entry for the current level
    const levelEntry = doc.approvalLevels.find(l => l.level === currentLevel);
    
    // Level entry must exist and have status 'pending' to be approvable
    if (!levelEntry) {
      // If level entry doesn't exist but document is at a valid level and user is assigned,
      // allow approval (backend will handle it)
      if (currentLevel >= 1 && currentLevel <= 4 && isUserAssigned) {
        // Trust the dashboard filtering
        return true;
      }
      return false; // Level entry doesn't exist and user not assigned
    }

    // Verify user is assigned to this level (if assignedApprovalLevels is populated)
    if (!isUserAssigned) {
      return false; // User is not assigned to this level
    }

    if (levelEntry.status !== 'pending') {
      return false; // Level is not pending (already approved/rejected)
    }

    return true;
  }, [assignedApprovalLevels, user]);

  // Get all documents that can be approved in this department
  const approvableDocuments = useMemo(() => {
    return documents.filter(doc => canApprove(doc));
  }, [documents, canApprove]);

  // Get approvable documents grouped by level for accurate bulk approve counter
  const approvableDocumentsByLevel = useMemo(() => {
    const byLevel = {};
    approvableDocuments.forEach(doc => {
      // Determine the level of the document
      const docLevel = doc.currentApprovalLevel === 0 || 
        (doc.level0ApprovalStatus === 'pending' && doc.status === 'submitted')
        ? 0 
        : doc.currentApprovalLevel;
      
      if (!byLevel[docLevel]) {
        byLevel[docLevel] = [];
      }
      byLevel[docLevel].push(doc);
    });
    return byLevel;
  }, [approvableDocuments]);

  // Get the count for the most common level (for bulk approve button display)
  // This matches what will be shown in the bulk approval dialog
  const bulkApproveCount = useMemo(() => {
    if (approvableDocuments.length === 0) return 0;
    if (approvableDocuments.length === 1) return 1;
    
    // Get the level of the first approvable document (most common case)
    // The bulk approval dialog filters to show only documents at the same level
    const firstDoc = approvableDocuments[0];
    const targetLevel = firstDoc.currentApprovalLevel === 0 || 
      (firstDoc.level0ApprovalStatus === 'pending' && firstDoc.status === 'submitted')
      ? 0 
      : firstDoc.currentApprovalLevel;
    
    // Return count of documents at the same level (this matches what's shown in the dialog)
    const sameLevelDocs = approvableDocumentsByLevel[targetLevel] || [];
    return sameLevelDocs.length;
  }, [approvableDocuments, approvableDocumentsByLevel]);

  // Initialize selected documents when bulk dialog opens
  const handleOpenBulkApproval = useCallback(() => {
    // Filter to only include documents that are actually approvable and at the same level
    const validDocs = approvableDocuments.filter(doc => canApprove(doc));
    
    if (validDocs.length === 0) {
      setBulkError('No documents available for bulk approval at your current level.');
      return;
    }
    
    // Get the level of the first document (all should be at the same level for bulk approval)
    const targetLevel = validDocs[0].currentApprovalLevel === 0 || 
      (validDocs[0].level0ApprovalStatus === 'pending' && validDocs[0].status === 'submitted')
      ? 0 
      : validDocs[0].currentApprovalLevel;
    
    // Filter to only include documents at the same level
    const sameLevelDocs = validDocs.filter(doc => {
      const docLevel = doc.currentApprovalLevel === 0 || 
        (doc.level0ApprovalStatus === 'pending' && doc.status === 'submitted')
        ? 0 
        : doc.currentApprovalLevel;
      return docLevel === targetLevel;
    });
    
    const allApprovableIds = sameLevelDocs.map(doc => doc._id);
    setSelectedDocuments(new Set(allApprovableIds));
    setBulkError(null);
    setComments('');
    setBulkApprovalDialog({ open: true });
  }, [approvableDocuments, canApprove]);

  const handleCloseBulkApproval = useCallback(() => {
    setBulkApprovalDialog({ open: false });
    setSelectedDocuments(new Set());
    setBulkError(null);
    setComments('');
  }, []);

  const handleToggleDocumentSelection = useCallback((docId) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    // Filter to only include documents that are actually approvable and at the same level
    const validDocs = approvableDocuments.filter(doc => canApprove(doc));
    if (validDocs.length === 0) return;
    
    const targetLevel = validDocs[0].currentApprovalLevel === 0 || 
      (validDocs[0].level0ApprovalStatus === 'pending' && validDocs[0].status === 'submitted')
      ? 0 
      : validDocs[0].currentApprovalLevel;
    
    const sameLevelDocs = validDocs.filter(doc => {
      const docLevel = doc.currentApprovalLevel === 0 || 
        (doc.level0ApprovalStatus === 'pending' && doc.status === 'submitted')
        ? 0 
        : doc.currentApprovalLevel;
      return docLevel === targetLevel;
    });
    
    const allIds = sameLevelDocs.map(doc => doc._id);
    setSelectedDocuments(new Set(allIds));
  }, [approvableDocuments, canApprove]);

  const handleDeselectAll = useCallback(() => {
    setSelectedDocuments(new Set());
  }, []);

  const handleBulkApprove = useCallback(async () => {
    if (selectedDocuments.size === 0) {
      setBulkError('Please select at least one document to approve');
      return;
    }

    try {
      setBulkLoading(true);
      setBulkError(null);

      // Filter selected documents to only include those that are actually approvable
      // This ensures we don't try to approve documents that have moved to different levels
      const selectedDocs = approvableDocuments.filter(doc => 
        selectedDocuments.has(doc._id) && canApprove(doc)
      );

      if (selectedDocs.length === 0) {
        setBulkError('No valid documents selected for approval. Some documents may have moved to a different approval level.');
        setBulkLoading(false);
        return;
      }

      // Get the approval level of the first document (all should be at the same level)
      const targetLevel = selectedDocs[0].currentApprovalLevel === 0 || 
        (selectedDocs[0].level0ApprovalStatus === 'pending' && selectedDocs[0].status === 'submitted')
        ? 0 
        : selectedDocs[0].currentApprovalLevel;

      // Filter to only include documents at the same level
      const sameLevelDocs = selectedDocs.filter(doc => {
        const docLevel = doc.currentApprovalLevel === 0 || 
          (doc.level0ApprovalStatus === 'pending' && doc.status === 'submitted')
          ? 0 
          : doc.currentApprovalLevel;
        return docLevel === targetLevel;
      });

      if (sameLevelDocs.length === 0) {
        setBulkError('Selected documents are at different approval levels. Please select documents at the same level.');
        setBulkLoading(false);
        return;
      }

      const documentIds = sameLevelDocs.map(doc => doc._id);
      
      // Only exclude documents that are at the same level but not selected
      // This ensures we don't exclude documents at different levels
      const excludeDocumentIds = approvableDocuments
        .filter(doc => {
          // Check if document is at the same level
          const docLevel = doc.currentApprovalLevel === 0 || 
            (doc.level0ApprovalStatus === 'pending' && doc.status === 'submitted')
            ? 0 
            : doc.currentApprovalLevel;
          // Only exclude if it's at the same level AND not selected
          return docLevel === targetLevel && !selectedDocuments.has(doc._id);
        })
        .map(doc => doc._id);

      const response = await evaluationDocumentsService.bulkApprove({
        documentIds,
        excludeDocumentIds,
        comments
      });

      if (response.data && response.data.success) {
        handleCloseBulkApproval();
        
        // Refresh documents - the parent component will fetch all documents
        if (onDocumentUpdate) {
          onDocumentUpdate();
        }
        
        // Show success message
        const { successCount, failureCount, excludedCount } = response.data.data;
        let message = `Bulk approval completed: ${successCount} approved`;
        if (excludedCount > 0) {
          message += `, ${excludedCount} excluded document(s) advanced to next level`;
        }
        if (failureCount > 0) {
          message += `, ${failureCount} failed`;
        }
        
        // Show success notification (you might want to use a snackbar here)
        if (failureCount > 0 || excludedCount > 0) {
          setBulkError(message);
        }
      } else {
        setBulkError(response.data?.error || 'Failed to approve documents');
      }
    } catch (err) {
      console.error('Error in bulk approval:', err);
      setBulkError(err.response?.data?.error || err.message || 'Failed to approve documents');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedDocuments, approvableDocuments, comments, onDocumentUpdate, handleCloseBulkApproval, canApprove]);

  const handleDeleteDepartment = async () => {
    if (!department?._id || project) return; // Don't allow deletion if it's a project
    
    try {
      setDeleteLoading(true);
      setDeleteError(null);
      
      await api.delete(`/hr/departments/${department._id}`);
      
      setDeleteDialog({ open: false });
      
      // Notify parent to refresh the list
      if (onDeleteDepartment) {
        onDeleteDepartment(department._id);
      }
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete department');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              {project?.name || department?.name || 'No Group'}
            </Typography>
            {project && (
              <Chip label="Project" size="small" color="info" sx={{ mt: 0.5, mr: 1 }} />
            )}
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
            {hod && !project && (
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
            {approvableDocuments.length > 0 && (
              <>
                {approvableDocuments.length > 1 && (
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<DoneAllIcon />}
                    onClick={handleOpenBulkApproval}
                  >
                    Bulk Approve ({bulkApproveCount})
                  </Button>
                )}
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => {
                    const pendingDoc = approvableDocuments[0];
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
                    const pendingDoc = approvableDocuments[0];
                    if (pendingDoc) openApprovalDialog(pendingDoc, 'reject');
                  }}
                >
                  Reject
                </Button>
                {approvalInfo?.currentLevelTitle && (
                  <Chip
                    label={approvalInfo.isLevel0 
                      ? approvalInfo.currentLevelTitle 
                      : `Level ${approvalInfo.currentLevel}: ${approvalInfo.currentLevelTitle}`}
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
            {department?._id && !project && (
              <IconButton
                onClick={() => setDeleteDialog({ open: true })}
                size="small"
                color="error"
                title="Delete Department"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
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
                        {(doc.currentApprovalLevel === 0 || 
                          (doc.level0ApprovalStatus === 'pending' && doc.status === 'submitted'))
                          ? ' (Level 0/4)' 
                          : doc.currentApprovalLevel 
                            ? ` (Level ${doc.currentApprovalLevel}/4)` 
                            : ''}
                      </Typography>
                    )}
                    {/* Show message if document was approved at Level 0 but moved to Level 1+ */}
                    {doc.level0ApprovalStatus === 'approved' && doc.currentApprovalLevel >= 1 && (
                      <Chip
                        label={`Moved to Level ${doc.currentApprovalLevel}`}
                        size="small"
                        color="info"
                        sx={{ mt: 0.5 }}
                      />
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
                        {/* Edit button for all levels (0-4) */}
                        {((doc.currentApprovalLevel === 0 || 
                          (doc.level0ApprovalStatus === 'pending' && doc.status === 'submitted')) ||
                          (doc.currentApprovalLevel >= 1 && doc.currentApprovalLevel <= 4 && 
                           assignedApprovalLevels.includes(doc.currentApprovalLevel))) && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            startIcon={<EditIcon />}
                            onClick={() => {
                              // Navigate to edit page (authenticated route, no token needed)
                              window.location.href = `/hr/evaluation-appraisal/edit/${doc._id}`;
                            }}
                            title="Edit and resubmit document"
                          >
                            Edit
                          </Button>
                        )}
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
              {approvalDialog.doc.currentApprovalLevel === 0 ? (
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>Current Level:</strong> Level 0/4
                </Typography>
              ) : getCurrentApprovalLevel(approvalDialog.doc) && (
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

      {/* Bulk Approval Dialog */}
      <Dialog open={bulkApprovalDialog.open} onClose={handleCloseBulkApproval} maxWidth="md" fullWidth>
        <DialogTitle>
          Bulk Approve Department Documents
        </DialogTitle>
        <DialogContent>
          {bulkError && <Alert severity="error" sx={{ mb: 2 }}>{bulkError}</Alert>}
          {bulkLoading && <LinearProgress sx={{ mb: 2 }} />}
          
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Select employees to approve (or deselect to exclude):
            </Typography>
            <Box>
              <Button size="small" onClick={handleSelectAll} sx={{ mr: 1 }}>
                Select All
              </Button>
              <Button size="small" onClick={handleDeselectAll}>
                Deselect All
              </Button>
            </Box>
          </Box>

          {(() => {
            // Filter to only show documents that are actually approvable and at the same level
            const validDocs = approvableDocuments.filter(doc => canApprove(doc));
            const targetLevel = validDocs.length > 0 
              ? (validDocs[0].currentApprovalLevel === 0 || 
                 (validDocs[0].level0ApprovalStatus === 'pending' && validDocs[0].status === 'submitted')
                 ? 0 
                 : validDocs[0].currentApprovalLevel)
              : null;
            
            const sameLevelDocs = targetLevel !== null 
              ? validDocs.filter(doc => {
                  const docLevel = doc.currentApprovalLevel === 0 || 
                    (doc.level0ApprovalStatus === 'pending' && doc.status === 'submitted')
                    ? 0 
                    : doc.currentApprovalLevel;
                  return docLevel === targetLevel;
                })
              : [];
            
            return (
              <>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  {selectedDocuments.size} of {sameLevelDocs.length} selected
                </Typography>

                <List sx={{ maxHeight: 400, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  {sameLevelDocs.map((doc, index) => (
              <React.Fragment key={doc._id}>
                <ListItem
                  sx={{
                    py: 1.5,
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedDocuments.has(doc._id)}
                        onChange={() => handleToggleDocumentSelection(doc._id)}
                        disabled={bulkLoading}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {doc.employee?.firstName} {doc.employee?.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {doc.employee?.employeeId} • {doc.formType === 'blue_collar' ? 'Blue Collar' : 'White Collar'}
                          {(doc.currentApprovalLevel === 0 || 
                            (doc.level0ApprovalStatus === 'pending' && doc.status === 'submitted'))
                            ? ' • Level 0/4' 
                            : doc.currentApprovalLevel 
                              ? ` • Level ${doc.currentApprovalLevel}/4` 
                              : ''}
                        </Typography>
                      </Box>
                    }
                    sx={{ flex: 1 }}
                  />
                </ListItem>
                {index < sameLevelDocs.length - 1 && <Divider />}
              </React.Fragment>
                  ))}
                </List>
              </>
            );
          })()}

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Comments (Optional - will apply to all selected documents)"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            sx={{ mt: 2 }}
            disabled={bulkLoading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBulkApproval} disabled={bulkLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkApprove}
            variant="contained"
            color="success"
            disabled={bulkLoading || selectedDocuments.size === 0}
            startIcon={<DoneAllIcon />}
          >
            {bulkLoading ? 'Processing...' : `Approve ${selectedDocuments.size} Document(s)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Department Dialog */}
      <Dialog 
        open={deleteDialog.open} 
        onClose={() => setDeleteDialog({ open: false })} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Delete Department</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <Typography>
            Are you sure you want to delete the department <strong>{department?.name}</strong>?
          </Typography>
          {documents.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This department contains {documents.length} evaluation document{documents.length !== 1 ? 's' : ''}. 
              The department will still be deleted.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDeleteDialog({ open: false })} 
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteDepartment}
            variant="contained"
            color="error"
            disabled={deleteLoading}
            startIcon={<DeleteIcon />}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default React.memo(DepartmentCard);

