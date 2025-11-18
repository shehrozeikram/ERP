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
  cnic_checked: 'info',
  nadra_verified: 'info',
  heirs_identified: 'info',
  poa_verified: 'info',
  disputes_checked: 'warning',
  death_cases_verified: 'info',
  interview_completed: 'info',
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

const riskColors = {
  low: 'success',
  medium: 'info',
  high: 'warning',
  critical: 'error'
};

const OwnerDueDiligenceList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ownerDueDiligences, setOwnerDueDiligences] = useState([]);
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

  const fetchOwnerDueDiligences = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage
      };

      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const response = await api.get('/taj-residencia/owner-due-diligence', { params });
      
      if (response.data.success) {
        setOwnerDueDiligences(response.data.data.docs || []);
        setTotalItems(response.data.data.totalDocs || 0);
      }
    } catch (error) {
      console.error('Error fetching owner due diligences:', error);
      showSnackbar('Error fetching owner due diligences', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, statusFilter, priorityFilter, showSnackbar]);

  useEffect(() => {
    fetchOwnerDueDiligences();
  }, [fetchOwnerDueDiligences]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleView = (id) => {
    navigate(`/taj-residencia/land-acquisition/owner-due-diligence/${id}`);
  };

  const handleEdit = (id) => {
    navigate(`/taj-residencia/land-acquisition/owner-due-diligence/${id}`);
  };

  const handleAdd = () => {
    navigate('/taj-residencia/land-acquisition/owner-due-diligence/new');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Owner Due Diligence
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
        >
          New Owner Due Diligence
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search by due diligence number, owner name, or CNIC..."
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
                  <MenuItem value="cnic_checked">CNIC Checked</MenuItem>
                  <MenuItem value="nadra_verified">NADRA Verified</MenuItem>
                  <MenuItem value="heirs_identified">Heirs Identified</MenuItem>
                  <MenuItem value="poa_verified">POA Verified</MenuItem>
                  <MenuItem value="disputes_checked">Disputes Checked</MenuItem>
                  <MenuItem value="death_cases_verified">Death Cases Verified</MenuItem>
                  <MenuItem value="interview_completed">Interview Completed</MenuItem>
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
                <TableCell>Due Diligence Number</TableCell>
                <TableCell>Land Identification</TableCell>
                <TableCell>CNIC Checks</TableCell>
                <TableCell>Heirs</TableCell>
                <TableCell>POA Documents</TableCell>
                <TableCell>Disputes</TableCell>
                <TableCell>Death Cases</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Risk Level</TableCell>
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
              ) : ownerDueDiligences.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    <Alert severity="info">No owner due diligences found</Alert>
                  </TableCell>
                </TableRow>
              ) : (
                ownerDueDiligences.map((odd) => (
                  <TableRow key={odd._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {odd.dueDiligenceNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {odd.landIdentification?.identificationNumber || 'N/A'}
                    </TableCell>
                    <TableCell align="center">
                      {odd.cnicChecks?.cnicVerifications?.length || 0}
                    </TableCell>
                    <TableCell align="center">
                      {odd.multipleHeirs?.heirs?.length || 0}
                    </TableCell>
                    <TableCell align="center">
                      {odd.powerOfAttorney?.poaDocuments?.length || 0}
                    </TableCell>
                    <TableCell align="center">
                      {odd.disputeHistory?.disputes?.length || 0}
                    </TableCell>
                    <TableCell align="center">
                      {odd.deathCases?.deathCases?.length || 0}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={odd.status?.replace('_', ' ').toUpperCase()}
                        color={statusColors[odd.status] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={odd.priority?.toUpperCase()}
                        color={priorityColors[odd.priority] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={odd.riskAssessment?.overallRisk?.toUpperCase() || 'N/A'}
                        color={riskColors[odd.riskAssessment?.overallRisk] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleView(odd._id)}
                        color="primary"
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(odd._id)}
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

export default OwnerDueDiligenceList;

