import React, { useState, useEffect } from 'react';
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
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Alert,
  CircularProgress,
  Card,
  CardContent
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import api from '../../../../services/api';
import level0ApproversService from '../../../../services/level0ApproversService';

const Level0ApproversTab = () => {
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [formData, setFormData] = useState({
    assignedUser: null,
    assignmentType: 'department_project',
    assignedProjects: [],
    assignedDepartments: [],
    departmentProjectAssignments: []
  });
  const [currentDeptProject, setCurrentDeptProject] = useState({
    project: null,
    department: null
  });

  // Fetch all data
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch assignments, users, projects, and departments in parallel
      const [assignmentsRes, usersRes, projectsRes, departmentsRes] = await Promise.all([
        level0ApproversService.getAll(),
        api.get('/auth/users', { params: { page: 1, limit: 1000 } }),
        api.get('/hr/projects'),
        api.get('/hr/departments')
      ]);

      if (assignmentsRes.data?.success) {
        setAssignments(assignmentsRes.data.data || []);
      }

      if (usersRes.data?.success) {
        setUsers(usersRes.data.data?.users || []);
      } else {
        console.warn('Users response format unexpected:', usersRes.data);
        setUsers([]);
      }

      if (projectsRes.data?.success) {
        setProjects(projectsRes.data.data || []);
      } else {
        console.warn('Projects response format unexpected:', projectsRes.data);
        setProjects([]);
      }

      if (departmentsRes.data?.success) {
        setDepartments(departmentsRes.data.data || []);
      } else {
        console.warn('Departments response format unexpected:', departmentsRes.data);
        setDepartments([]);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      console.error('Error details:', err.response?.data || err.message);
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message || 
                          err.message || 
                          'Failed to load data. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (assignment = null) => {
    if (assignment) {
      setEditingAssignment(assignment);
      setFormData({
        assignedUser: assignment.assignedUser?._id || assignment.assignedUser,
        assignmentType: assignment.assignmentType,
        assignedProjects: assignment.assignedProjects?.map(p => p._id || p) || [],
        assignedDepartments: assignment.assignedDepartments?.map(d => d._id || d) || [],
        departmentProjectAssignments: assignment.departmentProjectAssignments?.map(dp => ({
          project: dp.project?._id || dp.project,
          department: dp.department?._id || dp.department
        })) || []
      });
    } else {
      setEditingAssignment(null);
      setFormData({
        assignedUser: null,
        assignmentType: 'department_project',
        assignedProjects: [],
        assignedDepartments: [],
        departmentProjectAssignments: []
      });
    }
    setCurrentDeptProject({ project: null, department: null });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAssignment(null);
    setFormData({
      assignedUser: null,
      assignmentType: 'department_project',
      assignedProjects: [],
      assignedDepartments: [],
      departmentProjectAssignments: []
    });
    setCurrentDeptProject({ project: null, department: null });
  };

  const handleAddDeptProject = () => {
    if (currentDeptProject.project && currentDeptProject.department) {
      const exists = formData.departmentProjectAssignments.some(
        dp => dp.project === currentDeptProject.project && dp.department === currentDeptProject.department
      );
      if (!exists) {
        setFormData({
          ...formData,
          departmentProjectAssignments: [
            ...formData.departmentProjectAssignments,
            { ...currentDeptProject }
          ]
        });
        setCurrentDeptProject({ project: null, department: null });
      }
    }
  };

  const handleRemoveDeptProject = (index) => {
    setFormData({
      ...formData,
      departmentProjectAssignments: formData.departmentProjectAssignments.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async () => {
    try {
      setError(null);
      const payload = {
        assignedUser: formData.assignedUser,
        assignmentType: formData.assignmentType,
        assignedProjects: formData.assignmentType === 'project' ? formData.assignedProjects : [],
        assignedDepartments: formData.assignmentType === 'department' ? formData.assignedDepartments : [],
        departmentProjectAssignments: formData.assignmentType === 'department_project' ? formData.departmentProjectAssignments : []
      };

      if (editingAssignment) {
        await level0ApproversService.update(editingAssignment._id, payload);
      } else {
        await level0ApproversService.create(payload);
      }

      await fetchAllData();
      handleCloseDialog();
    } catch (err) {
      console.error('Error saving assignment:', err);
      setError(err.response?.data?.error || 'Failed to save assignment. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to deactivate this assignment?')) {
      try {
        await level0ApproversService.delete(id);
        await fetchAllData();
      } catch (err) {
        console.error('Error deleting assignment:', err);
        setError('Failed to delete assignment. Please try again.');
      }
    }
  };

  const getProjectName = (projectId) => {
    const project = projects.find(p => (p._id || p) === projectId);
    return project?.name || project?.projectId || 'Unknown';
  };

  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => (d._id || d) === deptId);
    return dept?.name || dept?.code || 'Unknown';
  };

  const getUserName = (userId) => {
    const user = users.find(u => (u._id || u) === userId);
    return user ? `${user.firstName} ${user.lastName}` : 'Unknown';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
          Level 0 Approvers Management
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

      {assignments.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 5 }}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No Level 0 Approver Assignments
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Click "Add Level 0 Approver" to create your first assignment
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Approver</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Assignment Type</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Projects</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Departments</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Dept-Project Combos</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow key={assignment._id}>
                  <TableCell>
                    {assignment.assignedUser?.firstName} {assignment.assignedUser?.lastName}
                    {assignment.assignedUser?.email && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {assignment.assignedUser.email}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={assignment.assignmentType.replace('_', ' ').toUpperCase()}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {assignment.assignedProjects?.length > 0 ? (
                      <Box>
                        {assignment.assignedProjects.map((project, idx) => (
                          <Chip
                            key={idx}
                            label={project.name || project.projectId}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {assignment.assignedDepartments?.length > 0 ? (
                      <Box>
                        {assignment.assignedDepartments.map((dept, idx) => (
                          <Chip
                            key={idx}
                            label={dept.name || dept.code}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {assignment.departmentProjectAssignments?.length > 0 ? (
                      <Box>
                        {assignment.departmentProjectAssignments.map((dp, idx) => (
                          <Chip
                            key={idx}
                            label={`${dp.department?.name || dp.department?.code || 'Dept'} - ${dp.project?.name || dp.project?.projectId || 'Project'}`}
                            size="small"
                            color="secondary"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={assignment.isActive ? 'Active' : 'Inactive'}
                      size="small"
                      color={assignment.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(assignment)}
                      color="primary"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(assignment._id)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingAssignment ? 'Edit Level 0 Approver Assignment' : 'Add Level 0 Approver Assignment'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Approver</InputLabel>
              <Select
                value={formData.assignedUser || ''}
                onChange={(e) => setFormData({ ...formData, assignedUser: e.target.value })}
                label="Approver"
              >
                {users.map((user) => (
                  <MenuItem key={user._id || user} value={user._id || user}>
                    {user.firstName} {user.lastName} ({user.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Assignment Type</InputLabel>
              <Select
                value={formData.assignmentType}
                onChange={(e) => setFormData({ ...formData, assignmentType: e.target.value })}
                label="Assignment Type"
              >
                <MenuItem value="project">Project Level</MenuItem>
                <MenuItem value="department">Department Level</MenuItem>
                <MenuItem value="department_project">Department-Project Combination</MenuItem>
              </Select>
            </FormControl>

            {formData.assignmentType === 'project' && (
              <Autocomplete
                multiple
                options={projects}
                getOptionLabel={(option) => option.name || option.projectId || ''}
                value={projects.filter(p => formData.assignedProjects.includes(p._id || p))}
                onChange={(event, newValue) => {
                  setFormData({
                    ...formData,
                    assignedProjects: newValue.map(p => p._id || p)
                  });
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Select Projects" placeholder="Projects" />
                )}
              />
            )}

            {formData.assignmentType === 'department' && (
              <Autocomplete
                multiple
                options={departments}
                getOptionLabel={(option) => option.name || option.code || ''}
                value={departments.filter(d => formData.assignedDepartments.includes(d._id || d))}
                onChange={(event, newValue) => {
                  setFormData({
                    ...formData,
                    assignedDepartments: newValue.map(d => d._id || d)
                  });
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Select Departments" placeholder="Departments" />
                )}
              />
            )}

            {formData.assignmentType === 'department_project' && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Department-Project Combinations
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Autocomplete
                    sx={{ flex: 1 }}
                    options={projects}
                    getOptionLabel={(option) => option.name || option.projectId || ''}
                    value={projects.find(p => (p._id || p) === currentDeptProject.project) || null}
                    onChange={(event, newValue) => {
                      setCurrentDeptProject({
                        ...currentDeptProject,
                        project: newValue ? (newValue._id || newValue) : null
                      });
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Project" placeholder="Select Project" />
                    )}
                  />
                  <Autocomplete
                    sx={{ flex: 1 }}
                    options={departments}
                    getOptionLabel={(option) => option.name || option.code || ''}
                    value={departments.find(d => (d._id || d) === currentDeptProject.department) || null}
                    onChange={(event, newValue) => {
                      setCurrentDeptProject({
                        ...currentDeptProject,
                        department: newValue ? (newValue._id || newValue) : null
                      });
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Department" placeholder="Select Department" />
                    )}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleAddDeptProject}
                    disabled={!currentDeptProject.project || !currentDeptProject.department}
                  >
                    Add
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {formData.departmentProjectAssignments.map((dp, index) => (
                    <Chip
                      key={index}
                      label={`${getDepartmentName(dp.department)} - ${getProjectName(dp.project)}`}
                      onDelete={() => handleRemoveDeptProject(index)}
                      color="secondary"
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={
              !formData.assignedUser ||
              (formData.assignmentType === 'project' && formData.assignedProjects.length === 0) ||
              (formData.assignmentType === 'department' && formData.assignedDepartments.length === 0) ||
              (formData.assignmentType === 'department_project' && formData.departmentProjectAssignments.length === 0)
            }
          >
            {editingAssignment ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Level0ApproversTab;

