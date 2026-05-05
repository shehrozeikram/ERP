import React, { useEffect, useState } from 'react';
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
  Chip
} from '@mui/material';
import api from '../../services/authService';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await api.get('/hr/projects');
        setProjects(response.data.data || []);
      } catch (error) {
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading projects...</Typography>
      </Box>
    );
  }

  const paginatedProjects = projects.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

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
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No projects found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedProjects.map((project) => (
                <TableRow key={project._id}>
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
    </Box>
  );
};

export default Projects;
