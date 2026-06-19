import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  Snackbar,
  Alert
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import api from '../../services/authService';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/hr/projects');
      setProjects(response.data.data || []);
    } catch (error) {
      setProjects([]);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to load projects',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDelete = async (project) => {
    const label = project.name || 'this project';
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;

    try {
      setDeletingId(project._id);
      await api.delete(`/hr/projects/${project._id}`);
      setSnackbar({ open: true, message: 'Project deleted successfully', severity: 'success' });
      await fetchProjects();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to delete project',
        severity: 'error'
      });
    } finally {
      setDeletingId(null);
    }
  };

  const paginatedProjects = useMemo(
    () => projects.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [projects, page, rowsPerPage]
  );

  if (loading && projects.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading projects...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Projects</Typography>
        <Typography variant="body2" color="text.secondary">
          All projects listed from HR module
        </Typography>
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Project</TableCell>
              <TableCell>Project ID</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Manager</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Budget</TableCell>
              <TableCell>Departments</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No projects found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedProjects.map((project) => (
                <TableRow key={project._id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{project.name || '—'}</Typography>
                    {project.description && (
                      <Typography variant="caption" color="text.secondary">
                        {project.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{project.projectId || '—'}</TableCell>
                  <TableCell>{project.code || '—'}</TableCell>
                  <TableCell>
                    {project.projectManager
                      ? `${project.projectManager.firstName || ''} ${project.projectManager.lastName || ''}`.trim() || '—'
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={project.status || '—'}
                      size="small"
                      color={project.status === 'Active' ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>${Number(project.budget || 0).toLocaleString()}</TableCell>
                  <TableCell>{Array.isArray(project.departments) ? project.departments.length : 0}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Delete project">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={deletingId === project._id}
                          onClick={() => handleDelete(project)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={projects.length}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(parseInt(event.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 25, 50]}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Projects;
