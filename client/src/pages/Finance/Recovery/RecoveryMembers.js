import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  Alert,
  Snackbar,
  Chip,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  fetchRecoveryMembers,
  createRecoveryMember,
  updateRecoveryMember,
  deleteRecoveryMember
} from '../../../services/recoveryMemberService';

const validationSchema = Yup.object({
  name: Yup.string().required('Member name is required').trim(),
  contactNumber: Yup.string().trim(),
  email: Yup.string().email('Invalid email format').trim(),
  notes: Yup.string().trim()
});

const RecoveryMembers = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const loadMembers = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      const response = await fetchRecoveryMembers(params);
      setMembers(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching recovery members:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error fetching recovery members',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const formik = useFormik({
    initialValues: {
      name: '',
      contactNumber: '',
      email: '',
      notes: ''
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        if (isEditing && selectedMember) {
          await updateRecoveryMember(selectedMember._id, values);
          setSnackbar({
            open: true,
            message: 'Recovery member updated successfully',
            severity: 'success'
          });
        } else {
          await createRecoveryMember(values);
          setSnackbar({
            open: true,
            message: 'Recovery member added successfully',
            severity: 'success'
          });
        }
        loadMembers();
        handleCloseDialog();
      } catch (error) {
        setSnackbar({
          open: true,
          message: error.response?.data?.message || 'Error saving recovery member',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    }
  });

  const handleOpenDialog = (member = null) => {
    if (member) {
      setSelectedMember(member);
      setIsEditing(true);
      formik.setValues({
        name: member.name || '',
        contactNumber: member.contactNumber || '',
        email: member.email || '',
        notes: member.notes || ''
      });
    } else {
      setSelectedMember(null);
      setIsEditing(false);
      formik.resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedMember(null);
    setIsEditing(false);
    formik.resetForm();
  };

  const handleDeleteClick = (member) => {
    setSelectedMember(member);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedMember) return;
    try {
      setLoading(true);
      await deleteRecoveryMember(selectedMember._id);
      setSnackbar({
        open: true,
        message: 'Recovery member removed successfully',
        severity: 'success'
      });
      loadMembers();
      setDeleteDialogOpen(false);
      setSelectedMember(null);
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error removing recovery member',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const activeMembers = members.filter((m) => m.isActive !== false);
  const inactiveCount = members.length - activeMembers.length;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PeopleIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" fontWeight={600}>
            Recovery Members
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          disabled={loading}
        >
          Add Member
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search by name, contact, or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
          </Grid>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : members.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                No recovery members found. Click &quot;Add Member&quot; to create one.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Name</strong></TableCell>
                    <TableCell><strong>Contact Number</strong></TableCell>
                    <TableCell><strong>Email</strong></TableCell>
                    <TableCell><strong>Notes</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member._id} hover>
                      <TableCell>{member.name || '-'}</TableCell>
                      <TableCell>{member.contactNumber || '-'}</TableCell>
                      <TableCell>{member.email || '-'}</TableCell>
                      <TableCell sx={{ maxWidth: 200 }}>{member.notes || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={member.isActive !== false ? 'Active' : 'Inactive'}
                          color={member.isActive !== false ? 'success' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleOpenDialog(member)}
                          title="Edit"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {member.isActive !== false && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(member)}
                            disabled={loading}
                            title="Remove"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {!loading && members.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {activeMembers.length} active member{activeMembers.length !== 1 ? 's' : ''}
              {inactiveCount > 0 && ` • ${inactiveCount} inactive`}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{isEditing ? 'Edit Recovery Member' : 'Add Recovery Member'}</DialogTitle>
        <form onSubmit={formik.handleSubmit}>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="name"
                  label="Name"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.name && Boolean(formik.errors.name)}
                  helperText={formik.touched.name && formik.errors.name}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="contactNumber"
                  label="Contact Number"
                  value={formik.values.contactNumber}
                  onChange={formik.handleChange}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="email"
                  label="Email"
                  type="email"
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.email && Boolean(formik.errors.email)}
                  helperText={formik.touched.email && formik.errors.email}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="notes"
                  label="Notes"
                  multiline
                  rows={2}
                  value={formik.values.notes}
                  onChange={formik.handleChange}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={loading || !formik.values.name?.trim()}>
              {loading ? 'Saving...' : isEditing ? 'Update' : 'Add Member'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Remove Recovery Member</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove &quot;{selectedMember?.name}&quot;? This will mark the member as inactive.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={loading}>
            {loading ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RecoveryMembers;
