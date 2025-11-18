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
  TablePagination,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Alert,
  Snackbar,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';

const statusColors = {
  draft: 'default',
  shajra_obtained: 'info',
  boundaries_understood: 'info',
  area_verified: 'info',
  adjacent_mapped: 'info',
  overlap_checked: 'warning',
  completed: 'success',
  on_hold: 'warning',
  rejected: 'error'
};

const priorityColors = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'error'
};

const KhasraMappingList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [khasraMappings, setKhasraMappings] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const fetchKhasraMappings = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage
      };

      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const response = await api.get('/taj-residencia/khasra-mapping', { params });
      
      if (response.data.success) {
        setKhasraMappings(response.data.data.docs || []);
        setTotalItems(response.data.data.totalDocs || 0);
      }
    } catch (error) {
      console.error('Error fetching khasra mappings:', error);
      showSnackbar('Error fetching khasra mappings', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, statusFilter, priorityFilter, showSnackbar]);

  useEffect(() => {
    fetchKhasraMappings();
  }, [fetchKhasraMappings]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleView = (id) => {
    navigate(`/taj-residencia/land-acquisition/khasra-mapping/${id}`);
  };

  const handleEdit = (id) => {
    navigate(`/taj-residencia/land-acquisition/khasra-mapping/${id}`);
  };

  const handleAdd = () => {
    navigate('/taj-residencia/land-acquisition/khasra-mapping/new');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Khasra Mapping
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
        >
          New Khasra Mapping
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search by mapping number, khasra number, or shajra number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="shajra_obtained">Shajra Obtained</MenuItem>
                  <MenuItem value="boundaries_understood">Boundaries Understood</MenuItem>
                  <MenuItem value="area_verified">Area Verified</MenuItem>
                  <MenuItem value="adjacent_mapped">Adjacent Mapped</MenuItem>
                  <MenuItem value="overlap_checked">Overlap Checked</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="on_hold">On Hold</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  label="Priority"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Mapping Number</TableCell>
                <TableCell>Land Identification</TableCell>
                <TableCell>Khasras</TableCell>
                <TableCell>Shajra Number</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Current Step</TableCell>
                <TableCell>Adjacent Khasras</TableCell>
                <TableCell>Overlaps</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : khasraMappings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Alert severity="info">No khasra mappings found</Alert>
                  </TableCell>
                </TableRow>
              ) : (
                khasraMappings.map((mapping) => (
                  <TableRow key={mapping._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {mapping.mappingNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {mapping.landIdentification?.identificationNumber || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {mapping.khasras?.length || 0} khasra(s)
                    </TableCell>
                    <TableCell>
                      {mapping.shajra?.shajraNumber || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={mapping.status?.replace('_', ' ').toUpperCase()}
                        color={statusColors[mapping.status] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={mapping.priority?.toUpperCase()}
                        color={priorityColors[mapping.priority] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {mapping.currentStep?.replace('_', ' ').toUpperCase() || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {mapping.adjacentKhasras?.length || 0}
                    </TableCell>
                    <TableCell align="center">
                      {mapping.overlaps?.length || 0}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleView(mapping._id)}
                        color="primary"
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(mapping._id)}
                        color="secondary"
                      >
                        <EditIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalItems}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default KhasraMappingList;

