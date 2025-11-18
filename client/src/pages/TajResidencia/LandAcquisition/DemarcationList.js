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
  visit_scheduled: 'info',
  visit_completed: 'info',
  measurement_done: 'info',
  pillars_installed: 'info',
  encroachment_checked: 'warning',
  sketch_created: 'info',
  alignment_done: 'info',
  report_generated: 'success',
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

const DemarcationList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [demarcations, setDemarcations] = useState([]);
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

  const fetchDemarcations = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage
      };

      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const response = await api.get('/taj-residencia/demarcation', { params });
      
      if (response.data.success) {
        setDemarcations(response.data.data.docs || []);
        setTotalItems(response.data.data.totalDocs || 0);
      }
    } catch (error) {
      console.error('Error fetching demarcations:', error);
      showSnackbar('Error fetching demarcations', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, statusFilter, priorityFilter, showSnackbar]);

  useEffect(() => {
    fetchDemarcations();
  }, [fetchDemarcations]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleView = (id) => {
    navigate(`/taj-residencia/land-acquisition/demarcation/${id}`);
  };

  const handleEdit = (id) => {
    navigate(`/taj-residencia/land-acquisition/demarcation/${id}`);
  };

  const handleAdd = () => {
    navigate('/taj-residencia/land-acquisition/demarcation/new');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Demarcation
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
        >
          New Demarcation
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search by demarcation number, patwari, or qanoongo..."
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
                  <MenuItem value="visit_scheduled">Visit Scheduled</MenuItem>
                  <MenuItem value="visit_completed">Visit Completed</MenuItem>
                  <MenuItem value="measurement_done">Measurement Done</MenuItem>
                  <MenuItem value="pillars_installed">Pillars Installed</MenuItem>
                  <MenuItem value="encroachment_checked">Encroachment Checked</MenuItem>
                  <MenuItem value="sketch_created">Sketch Created</MenuItem>
                  <MenuItem value="alignment_done">Alignment Done</MenuItem>
                  <MenuItem value="report_generated">Report Generated</MenuItem>
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
                <TableCell>Demarcation Number</TableCell>
                <TableCell>Land Identification</TableCell>
                <TableCell>Patwari</TableCell>
                <TableCell>Qanoongo</TableCell>
                <TableCell>Visit Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Current Step</TableCell>
                <TableCell>Pillars</TableCell>
                <TableCell>Encroachments</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : demarcations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    <Alert severity="info">No demarcations found</Alert>
                  </TableCell>
                </TableRow>
              ) : (
                demarcations.map((demarcation) => (
                  <TableRow key={demarcation._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {demarcation.demarcationNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {demarcation.landIdentification?.identificationNumber || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {demarcation.patwariQanoongoVisit?.patwari?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {demarcation.patwariQanoongoVisit?.qanoongo?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {demarcation.patwariQanoongoVisit?.visitDate ? new Date(demarcation.patwariQanoongoVisit.visitDate).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={demarcation.status?.replace('_', ' ').toUpperCase()}
                        color={statusColors[demarcation.status] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={demarcation.priority?.toUpperCase()}
                        color={priorityColors[demarcation.priority] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {demarcation.currentStep?.replace('_', ' ').toUpperCase() || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {demarcation.boundaryPillars?.pillars?.length || 0}
                    </TableCell>
                    <TableCell align="center">
                      {demarcation.encroachmentDetection?.encroachments?.length || 0}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleView(demarcation._id)}
                        color="primary"
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(demarcation._id)}
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

export default DemarcationList;

