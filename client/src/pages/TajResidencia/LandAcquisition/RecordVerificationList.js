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
  jamabandi_reviewed: 'info',
  fard_obtained: 'info',
  khatauni_verified: 'info',
  tehsildar_verified: 'info',
  arc_checked: 'info',
  disputes_identified: 'warning',
  fraud_checked: 'warning',
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

const RecordVerificationList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [recordVerifications, setRecordVerifications] = useState([]);
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

  const fetchRecordVerifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage
      };

      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const response = await api.get('/taj-residencia/record-verification', { params });
      
      if (response.data.success) {
        setRecordVerifications(response.data.data.docs || []);
        setTotalItems(response.data.data.totalDocs || 0);
      }
    } catch (error) {
      console.error('Error fetching record verifications:', error);
      showSnackbar('Error fetching record verifications', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, statusFilter, priorityFilter, showSnackbar]);

  useEffect(() => {
    fetchRecordVerifications();
  }, [fetchRecordVerifications]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleView = (id) => {
    navigate(`/taj-residencia/land-acquisition/record-verification/${id}`);
  };

  const handleEdit = (id) => {
    navigate(`/taj-residencia/land-acquisition/record-verification/${id}`);
  };

  const handleAdd = () => {
    navigate('/taj-residencia/land-acquisition/record-verification/new');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Record Verification
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
        >
          New Record Verification
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search by verification number, owner, or mauza..."
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
                  <MenuItem value="jamabandi_reviewed">Jamabandi Reviewed</MenuItem>
                  <MenuItem value="fard_obtained">Fard Obtained</MenuItem>
                  <MenuItem value="khatauni_verified">Khatauni Verified</MenuItem>
                  <MenuItem value="tehsildar_verified">Tehsildar Verified</MenuItem>
                  <MenuItem value="arc_checked">ARC Checked</MenuItem>
                  <MenuItem value="disputes_identified">Disputes Identified</MenuItem>
                  <MenuItem value="fraud_checked">Fraud Checked</MenuItem>
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
                <TableCell>Verification Number</TableCell>
                <TableCell>Land Identification</TableCell>
                <TableCell>Mauza Name</TableCell>
                <TableCell>Owner Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Current Step</TableCell>
                <TableCell>Disputes</TableCell>
                <TableCell>Fraud Checks</TableCell>
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
              ) : recordVerifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Alert severity="info">No record verifications found</Alert>
                  </TableCell>
                </TableRow>
              ) : (
                recordVerifications.map((record) => (
                  <TableRow key={record._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {record.verificationNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {record.landIdentification?.identificationNumber || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {record.landIdentification?.mauzaIdentification?.mauzaName || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {record.jamabandi?.recordDetails?.ownerName || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record.status?.replace('_', ' ').toUpperCase()}
                        color={statusColors[record.status] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record.priority?.toUpperCase()}
                        color={priorityColors[record.priority] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {record.currentStep?.replace('_', ' ').toUpperCase() || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {record.disputes?.length || 0}
                    </TableCell>
                    <TableCell align="center">
                      {record.fraudChecks?.length || 0}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleView(record._id)}
                        color="primary"
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(record._id)}
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

export default RecordVerificationList;

