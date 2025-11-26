import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Box,
  IconButton,
  Alert
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

/**
 * Reusable Movement Dialog Component
 * Handles sending/receiving documents with user and department selection
 */
const MovementDialog = ({
  open,
  onClose,
  onSubmit,
  document,
  users = [],
  departments = [],
  loading = false,
  error = ''
}) => {
  const [formData, setFormData] = useState({
    toUser: '',
    toDepartment: '',
    reason: '',
    comments: '',
    statusAfter: document?.status || 'Sent'
  });

  // Reset form when dialog opens/closes or document changes
  React.useEffect(() => {
    if (open && document) {
      setFormData({
        toUser: '',
        toDepartment: '',
        reason: '',
        comments: '',
        statusAfter: document.status === 'Completed' ? 'Completed' : 'Sent'
      });
    }
  }, [open, document]);

  // Filter users by selected department
  const filteredUsers = useMemo(() => {
    if (!formData.toDepartment) return users;
    return users.filter(user => {
      const userDept = typeof user.department === 'object' 
        ? user.department?._id 
        : user.department;
      return userDept === formData.toDepartment;
    });
  }, [users, formData.toDepartment]);

  // Auto-select department when user is selected
  const handleUserChange = (userId) => {
    const selectedUser = users.find(u => u._id === userId);
    const userDept = selectedUser?.department 
      ? (typeof selectedUser.department === 'object' 
          ? selectedUser.department._id 
          : selectedUser.department)
      : '';
    
    setFormData(prev => ({
      ...prev,
      toUser: userId,
      toDepartment: userDept || prev.toDepartment
    }));
  };

  const handleSubmit = () => {
    if (!formData.toUser || !formData.reason.trim()) {
      return;
    }
    onSubmit({
      toUser: formData.toUser,
      toDepartment: formData.toDepartment || undefined,
      reason: formData.reason.trim(),
      comments: formData.comments.trim() || undefined,
      statusAfter: formData.statusAfter
    });
  };

  const isValid = formData.toUser && formData.reason.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Move Document
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {document && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Document
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {document.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Tracking ID: {document.trackingId}
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => {}}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <FormControl fullWidth required>
              <InputLabel>To User</InputLabel>
              <Select
                value={formData.toUser}
                label="To User"
                onChange={(e) => handleUserChange(e.target.value)}
              >
                <MenuItem value="">Select User</MenuItem>
                {filteredUsers.map(user => (
                  <MenuItem key={user._id} value={user._id}>
                    {user.firstName} {user.lastName}
                    {user.email && ` (${user.email})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>To Department</InputLabel>
              <Select
                value={formData.toDepartment}
                label="To Department"
                onChange={(e) => setFormData({ ...formData, toDepartment: e.target.value })}
              >
                <MenuItem value="">Select Department (Optional)</MenuItem>
                {departments.map(dept => (
                  <MenuItem key={dept._id} value={dept._id}>
                    {dept.name} {dept.code && `(${dept.code})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Status After Movement</InputLabel>
              <Select
                value={formData.statusAfter}
                label="Status After Movement"
                onChange={(e) => setFormData({ ...formData, statusAfter: e.target.value })}
              >
                <MenuItem value="Sent">Sent</MenuItem>
                <MenuItem value="In Review">In Review</MenuItem>
                <MenuItem value="In Approval">In Approval</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="Registered">Registered</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              multiline
              rows={3}
              label="Reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Enter reason for moving this document..."
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Comments (Optional)"
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              placeholder="Additional comments..."
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!isValid || loading}
        >
          {loading ? 'Moving...' : 'Move Document'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MovementDialog;


