import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { evaluationLevel0AuthoritiesService } from '../../../../services/evaluationLevel0AuthoritiesService';
import api from '../../../../services/api';

const Level0AuthoritiesManager = () => {
  const [authorities, setAuthorities] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAuthority, setEditingAuthority] = useState(null);
  const [formData, setFormData] = useState({
    assignedUser: '',
    authorities: [{ project: '', departments: [], allDepartments: true }],
    isActive: true
  });
  const [selectedProjectDepartments, setSelectedProjectDepartments] = useState({});

  // Fetch data
  const fetchAuthorities = useCallback(async () => {
    try {
      setLoading(true);
      const response = await evaluationLevel0AuthoritiesService.getAll();
      if (response.data.success) {
        setAuthorities(response.data.data || []);
      }
    } catch (err) {
      setError('Failed to load Level 0 authorities');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      // Try /auth/users endpoint first (standard endpoint)
      const response = await api.get('/auth/users', { params: { limit: 1000 } });
      
      // Handle different response structures
      let usersList = [];
      if (response.data?.success && response.data?.data) {
        // Check if data has users array (paginated) or is direct array
        if (response.data.data.users) {
          usersList = response.data.data.users;
        } else if (Array.isArray(response.data.data)) {
          usersList = response.data.data;
        }
      } else if (Array.isArray(response.data)) {
        usersList = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        usersList = response.data.data;
      }
      
      setUsers(usersList);
      
      if (usersList.length === 0) {
        console.warn('No users found in response:', response.data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      console.error('Error details:', err.response?.data);
      setError('Failed to load users. Please check console for details.');
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await api.get('/hr/projects');
      if (response.data.success) {
        setProjects(response.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await api.get('/hr/departments');
      if (response.data.success) {
        setDepartments(response.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  }, []);

  useEffect(() => {
    fetchAuthorities();
    fetchUsers();
    fetchProjects();
    fetchDepartments();
  }, [fetchAuthorities, fetchUsers, fetchProjects, fetchDepartments]);

  const handleOpenDialog = (authority = null) => {
    if (authority) {
      setEditingAuthority(authority);
      setFormData({
        assignedUser: authority.assignedUser?.id || authority.assignedUser?._id || '',
        authorities: authority.authorities.map(auth => ({
          project: auth.project?.id || auth.project?._id || '',
          departments: auth.departments ? auth.departments.map(d => d.id || d._id) : [],
          allDepartments: !auth.departments || auth.departments.length === 0
        })),
        isActive: authority.isActive
      });
    } else {
      setEditingAuthority(null);
      setFormData({
        assignedUser: '',
        authorities: [{ project: '', departments: [], allDepartments: true }],
        isActive: true
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAuthority(null);
    setFormData({
      assignedUser: '',
      authorities: [{ project: '', departments: [], allDepartments: true }],
      isActive: true
    });
  };

  const handleAddAuthority = () => {
    setFormData(prev => ({
      ...prev,
      authorities: [...prev.authorities, { project: '', departments: [], allDepartments: true }]
    }));
  };

  const handleRemoveAuthority = (index) => {
    setFormData(prev => ({
      ...prev,
      authorities: prev.authorities.filter((_, i) => i !== index)
    }));
  };

  const handleAuthorityChange = (index, field, value) => {
    setFormData(prev => {
      const newAuthorities = [...prev.authorities];
      if (field === 'allDepartments') {
        newAuthorities[index] = {
          ...newAuthorities[index],
          allDepartments: value,
          departments: value ? [] : newAuthorities[index].departments
        };
      } else if (field === 'project') {
        newAuthorities[index] = {
          ...newAuthorities[index],
          project: value,
          departments: [],
          allDepartments: true
        };
        // Load departments for this project
        const project = projects.find(p => (p.id || p._id) === value);
        if (project) {
          setSelectedProjectDepartments(prev => ({
            ...prev,
            [index]: project.departments || []
          }));
        }
      } else {
        newAuthorities[index] = {
          ...newAuthorities[index],
          [field]: value
        };
      }
      return {
        ...prev,
        authorities: newAuthorities
      };
    });
  };

  const handleSubmit = async () => {
    try {
      const submitData = {
        assignedUser: formData.assignedUser,
        authorities: formData.authorities.map(auth => ({
          project: auth.project,
          departments: auth.allDepartments ? [] : auth.departments
        })),
        isActive: formData.isActive
      };

      if (editingAuthority) {
        const authorityId = editingAuthority.id || editingAuthority._id;
        await evaluationLevel0AuthoritiesService.update(authorityId, submitData);
      } else {
        await evaluationLevel0AuthoritiesService.create(submitData);
      }

      await fetchAuthorities();
      handleCloseDialog();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save Level 0 authority');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this Level 0 authority?')) {
      try {
        await evaluationLevel0AuthoritiesService.delete(id);
        await fetchAuthorities();
      } catch (err) {
        setError('Failed to delete Level 0 authority');
      }
    }
  };

  const getProjectDepartments = (projectId) => {
    const project = projects.find(p => (p.id || p._id) === projectId);
    if (project && project.departments) {
      return departments.filter(d => {
        const deptId = d.id || d._id;
        return project.departments.includes(deptId) || project.departments.includes(d._id);
      });
    }
    return [];
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Level 0 Approvers
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Level 0 Approver
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>User</strong></TableCell>
              <TableCell><strong>Authorities</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {authorities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No Level 0 approvers configured
                </TableCell>
              </TableRow>
            ) : (
              authorities.map((authority) => {
                const authorityId = authority.id || authority._id;
                return (
                <TableRow key={authorityId}>
                  <TableCell>
                    {authority.assignedUser
                      ? `${authority.assignedUser.firstName} ${authority.assignedUser.lastName}`
                      : 'Unknown'}
                  </TableCell>
                  <TableCell>
                    {authority.authorities.map((auth, idx) => (
                      <Box key={idx} sx={{ mb: 1 }}>
                        <Chip
                          label={`${auth.project?.name || 'Unknown Project'}${
                            !auth.departments || auth.departments.length === 0
                              ? ' (All Departments)'
                              : ` - ${auth.departments.length} Department(s)`
                          }`}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                      </Box>
                    ))}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={authority.isActive ? 'Active' : 'Inactive'}
                      color={authority.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(authority)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(authorityId)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingAuthority ? 'Edit Level 0 Approver' : 'Add Level 0 Approver'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>User</InputLabel>
              <Select
                value={formData.assignedUser}
                onChange={(e) => setFormData(prev => ({ ...prev, assignedUser: e.target.value }))}
                label="User"
              >
                {users.length === 0 ? (
                  <MenuItem disabled>No users available</MenuItem>
                ) : (
                  users.map((user) => {
                    const userId = user.id || user._id;
                    const userName = user.firstName && user.lastName 
                      ? `${user.firstName} ${user.lastName}` 
                      : user.name || user.email || 'Unknown User';
                    const userEmail = user.email || '';
                    return (
                      <MenuItem key={userId} value={userId}>
                        {userName} {userEmail ? `(${userEmail})` : ''}
                      </MenuItem>
                    );
                  })
                )}
              </Select>
              {users.length === 0 && (
                <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                  No users found. Please check if users exist in the system.
                </Typography>
              )}
            </FormControl>

            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Authorities
            </Typography>

            {formData.authorities.map((auth, index) => (
              <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2">Authority {index + 1}</Typography>
                  {formData.authorities.length > 1 && (
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleRemoveAuthority(index)}
                    >
                      Remove
                    </Button>
                  )}
                </Box>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Project</InputLabel>
                  <Select
                    value={auth.project}
                    onChange={(e) => handleAuthorityChange(index, 'project', e.target.value)}
                    label="Project"
                  >
                    {projects.map((project) => {
                      const projectId = project.id || project._id;
                      return (
                        <MenuItem key={projectId} value={projectId}>
                          {project.name}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={auth.allDepartments}
                      onChange={(e) => handleAuthorityChange(index, 'allDepartments', e.target.checked)}
                    />
                  }
                  label="All Departments in this Project"
                  sx={{ mb: 2 }}
                />

                {!auth.allDepartments && auth.project && (
                  <FormControl fullWidth>
                    <InputLabel>Departments</InputLabel>
                    <Select
                      multiple
                      value={auth.departments}
                      onChange={(e) => handleAuthorityChange(index, 'departments', e.target.value)}
                      label="Departments"
                      renderValue={(selected) => {
                        const selectedDepts = departments.filter(d => selected.includes(d.id || d._id));
                        return selectedDepts.map(d => d.name).join(', ');
                      }}
                    >
                      {getProjectDepartments(auth.project).map((dept) => {
                        const deptId = dept.id || dept._id;
                        return (
                          <MenuItem key={deptId} value={deptId}>
                            {dept.name}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                )}
              </Box>
            ))}

            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddAuthority}
              sx={{ mt: 2 }}
            >
              Add Another Authority
            </Button>

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                />
              }
              label="Active"
              sx={{ mt: 2, display: 'block' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingAuthority ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Level0AuthoritiesManager;

