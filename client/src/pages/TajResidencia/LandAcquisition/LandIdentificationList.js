import React, { useState, useEffect } from 'react';
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
  Search as SearchIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';

const statusColors = {
  draft: 'default',
  patwari_contacted: 'info',
  mauza_identified: 'info',
  khasra_extracted: 'info',
  survey_completed: 'info',
  owner_details_collected: 'info',
  risk_assessed: 'warning',
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

const LandIdentificationList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [landIdentifications, setLandIdentifications] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchLandIdentifications();
  }, [page, rowsPerPage, searchTerm, statusFilter, priorityFilter, districtFilter]);

  const fetchLandIdentifications = async () => {
    setLoading(true);
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage
      };

      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (districtFilter) params.district = districtFilter;

      const response = await api.get('/taj-residencia/land-identification', { params });
      
      if (response.data.success) {
        setLandIdentifications(response.data.data.docs || []);
        setTotalItems(response.data.data.totalDocs || 0);
      }
    } catch (error) {
      console.error('Error fetching land identifications:', error);
      showSnackbar('Error fetching land identifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleView = (id) => {
    navigate(`/taj-residencia/land-acquisition/land-identification/${id}`);
  };

  const handleEdit = (id) => {
    navigate(`/taj-residencia/land-acquisition/land-identification/${id}`);
  };

  const handleAdd = () => {
    navigate('/taj-residencia/land-acquisition/land-identification/new');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Land Identification
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
        >
          New Land Identification
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search by ID, Mauza, Patwari, or Owner..."
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
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="patwari_contacted">Patwari Contacted</MenuItem>
                  <MenuItem value="mauza_identified">Mauza Identified</MenuItem>
                  <MenuItem value="khasra_extracted">Khasra Extracted</MenuItem>
                  <MenuItem value="survey_completed">Survey Completed</MenuItem>
                  <MenuItem value="owner_details_collected">Owner Details Collected</MenuItem>
                  <MenuItem value="risk_assessed">Risk Assessed</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="on_hold">On Hold</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
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
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Filter by District..."
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID Number</TableCell>
                <TableCell>Mauza Name</TableCell>
                <TableCell>District/Tehsil</TableCell>
                <TableCell>Patwari</TableCell>
                <TableCell>Khasra Count</TableCell>
                <TableCell>Owner Count</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Current Step</TableCell>
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
              ) : landIdentifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Alert severity="info">No land identifications found</Alert>
                  </TableCell>
                </TableRow>
              ) : (
                landIdentifications.map((land) => (
                  <TableRow key={land._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {land.identificationNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {land.mauzaIdentification?.mauzaName || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {land.mauzaIdentification?.district || 'N/A'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {land.mauzaIdentification?.tehsil || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {land.patwariContact?.patwariName || 'N/A'}
                    </TableCell>
                    <TableCell align="center">
                      {land.khasraDetails?.length || 0}
                    </TableCell>
                    <TableCell align="center">
                      {land.ownerDetails?.length || 0}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={land.status?.replace('_', ' ').toUpperCase()}
                        color={statusColors[land.status] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={land.priority?.toUpperCase()}
                        color={priorityColors[land.priority] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {land.currentStep?.replace('_', ' ').toUpperCase() || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleView(land._id)}
                        color="primary"
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(land._id)}
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

export default LandIdentificationList;

