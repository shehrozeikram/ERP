import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Avatar
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Send as SendIcon,
  ArrowBack as ArrowBackIcon,
  Comment as CommentIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import indentService from '../../../services/indentService';
import dayjs from 'dayjs';

const IndentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [indent, setIndent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [commentText, setCommentText] = useState('');

  // Load indent data
  const loadIndent = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await indentService.getIndentById(id);
      setIndent(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load indent');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadIndent();
  }, [loadIndent]);

  // Handle actions
  const handleApprove = async () => {
    try {
      await indentService.approveIndent(id);
      setSnackbar({
        open: true,
        message: 'Indent approved successfully',
        severity: 'success'
      });
      loadIndent();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error approving indent',
        severity: 'error'
      });
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('Please enter rejection reason:');
    if (!reason) return;
    
    try {
      await indentService.rejectIndent(id, reason);
      setSnackbar({
        open: true,
        message: 'Indent rejected successfully',
        severity: 'success'
      });
      loadIndent();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error rejecting indent',
        severity: 'error'
      });
    }
  };

  const handleSubmit = async () => {
    try {
      await indentService.submitIndent(id);
      setSnackbar({
        open: true,
        message: 'Indent submitted for approval successfully',
        severity: 'success'
      });
      loadIndent();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error submitting indent',
        severity: 'error'
      });
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    
    try {
      await indentService.addComment(id, commentText);
      setSnackbar({
        open: true,
        message: 'Comment added successfully',
        severity: 'success'
      });
      setCommentText('');
      setCommentDialogOpen(false);
      loadIndent();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error adding comment',
        severity: 'error'
      });
    }
  };

  // Format currency
  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 0
    }).format(value || 0);

  // Format date
  const formatDate = (date) => {
    if (!date) return '—';
    return dayjs(date).format('DD-MMM-YYYY');
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'default',
      'Submitted': 'info',
      'Under Review': 'warning',
      'Approved': 'success',
      'Rejected': 'error',
      'Partially Fulfilled': 'info',
      'Fulfilled': 'success',
      'Cancelled': 'default'
    };
    return colors[status] || 'default';
  };

  // Check permissions
  const canEdit = indent?.status === 'Draft' && indent?.requestedBy?._id === user?.id;
  const canApproveReject = ['super_admin', 'admin', 'hr_manager'].includes(user?.role) &&
                           ['Submitted', 'Under Review'].includes(indent?.status);
  const canSubmit = indent?.status === 'Draft' && indent?.requestedBy?._id === user?.id;

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !indent) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Indent not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton onClick={() => navigate('/general/indents')}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4" fontWeight={700}>
              {indent.indentNumber}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {indent.title}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={2}>
          {canEdit && (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/general/indents/${id}/edit`)}
            >
              Edit
            </Button>
          )}
          {canSubmit && (
            <Button
              variant="contained"
              color="success"
              startIcon={<SendIcon />}
              onClick={handleSubmit}
            >
              Submit for Approval
            </Button>
          )}
          {canApproveReject && (
            <>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={handleApprove}
              >
                Approve
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<CancelIcon />}
                onClick={handleReject}
              >
                Reject
              </Button>
            </>
          )}
          <Button
            variant="outlined"
            startIcon={<CommentIcon />}
            onClick={() => setCommentDialogOpen(true)}
          >
            Add Comment
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        {/* Main Details */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip 
                    label={indent.status} 
                    color={getStatusColor(indent.status)}
                    sx={{ mt: 0.5 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Priority
                  </Typography>
                  <Chip 
                    label={indent.priority} 
                    variant="outlined"
                    sx={{ mt: 0.5 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Department
                  </Typography>
                  <Typography variant="body1">
                    {indent.department?.name || '—'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Category
                  </Typography>
                  <Typography variant="body1">
                    {indent.category || '—'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Requested By
                  </Typography>
                  <Typography variant="body1">
                    {indent.requestedBy?.firstName} {indent.requestedBy?.lastName}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Requested Date
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(indent.requestedDate)}
                  </Typography>
                </Grid>
                {indent.requiredDate && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Required Date
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(indent.requiredDate)}
                    </Typography>
                  </Grid>
                )}
                {indent.approvedBy && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Approved By
                    </Typography>
                    <Typography variant="body1">
                      {indent.approvedBy?.firstName} {indent.approvedBy?.lastName}
                    </Typography>
                  </Grid>
                )}
                {indent.approvedDate && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Approved Date
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(indent.approvedDate)}
                    </Typography>
                  </Grid>
                )}
                {indent.description && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Description
                    </Typography>
                    <Typography variant="body1">
                      {indent.description}
                    </Typography>
                  </Grid>
                )}
                {indent.rejectionReason && (
                  <Grid item xs={12}>
                    <Alert severity="error">
                      <Typography variant="body2" fontWeight={600}>
                        Rejection Reason:
                      </Typography>
                      <Typography variant="body2">
                        {indent.rejectionReason}
                      </Typography>
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Items ({indent.items?.length || 0})
              </Typography>
              {indent.items && indent.items.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Item Name</strong></TableCell>
                        <TableCell><strong>Description</strong></TableCell>
                        <TableCell align="right"><strong>Quantity</strong></TableCell>
                        <TableCell><strong>Unit</strong></TableCell>
                        <TableCell align="right"><strong>Est. Cost</strong></TableCell>
                        <TableCell><strong>Priority</strong></TableCell>
                        <TableCell align="right"><strong>Total</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {indent.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>{item.description || '—'}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell align="right">{formatCurrency(item.estimatedCost)}</TableCell>
                          <TableCell>
                            <Chip label={item.priority} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={600}>
                              {formatCurrency((item.estimatedCost || 0) * (item.quantity || 0))}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No items found
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Financial Summary
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Estimated Cost
                  </Typography>
                  <Typography variant="h5" color="primary" fontWeight={700}>
                    {formatCurrency(indent.totalEstimatedCost)}
                  </Typography>
                </Box>
                {indent.amount > 0 && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Amount
                      </Typography>
                      <Typography variant="h6">
                        {formatCurrency(indent.amount)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Remaining Amount
                      </Typography>
                      <Typography 
                        variant="h6" 
                        color={indent.amount - indent.totalEstimatedCost < 0 ? 'error' : 'success'}
                      >
                        {formatCurrency(indent.amount - indent.totalEstimatedCost)}
                      </Typography>
                    </Box>
                  </>
                )}
                {indent.referenceNo && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Reference No
                      </Typography>
                      <Typography variant="body1">
                        {indent.referenceNo}
                      </Typography>
                    </Box>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Comments */}
          {indent.comments && indent.comments.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Comments ({indent.comments.length})
                </Typography>
                <Stack spacing={2}>
                  {indent.comments.map((comment, index) => (
                    <Box key={index}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {comment.user?.firstName?.[0]}{comment.user?.lastName?.[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {comment.user?.firstName} {comment.user?.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {dayjs(comment.createdAt).format('DD-MMM-YYYY HH:mm')}
                          </Typography>
                        </Box>
                      </Stack>
                      <Typography variant="body2" sx={{ pl: 5 }}>
                        {comment.comment}
                      </Typography>
                      {index < indent.comments.length - 1 && <Divider sx={{ mt: 2 }} />}
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Comment Dialog */}
      <Dialog open={commentDialogOpen} onClose={() => setCommentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Comment</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Enter your comment..."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddComment} variant="contained" disabled={!commentText.trim()}>
            Add Comment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
};

export default IndentDetail;

