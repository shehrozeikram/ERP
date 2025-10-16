import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
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
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
  Skeleton,
  alpha,
  useTheme,
  Tooltip,
  Avatar,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  BugReport as BugReportIcon,
  Assignment as AssignmentIcon,
  AttachFile as AttachFileIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

const AuditFindings = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    auditId: '',
    severity: '',
    status: ''
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedFindingId, setSelectedFindingId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState(null);

  const fetchFindings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery,
        ...filters
      });
      const response = await api.get(`/audit/findings?${params.toString()}`);
      const responseData = response.data.data;
      
      // Handle different response structures
      if (responseData && responseData.findings) {
        // New structure: { findings: [...], pagination: {...} }
        setFindings(responseData.findings || []);
        setTotalItems(responseData.pagination?.totalCount || 0);
      } else if (Array.isArray(responseData)) {
        // Old structure: direct array
        setFindings(responseData);
        setTotalItems(response.data.total || responseData.length);
      } else {
        // Fallback
        setFindings([]);
        setTotalItems(0);
      }
    } catch (err) {
      console.error('Error fetching audit findings:', err);
      setError(err.response?.data?.message || 'Failed to fetch audit findings.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchQuery, filters]);

  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleFilterChange = (event) => {
    setFilters({
      ...filters,
      [event.target.name]: event.target.value,
    });
  };

  const handleMenuOpen = (event, findingId) => {
    setAnchorEl(event.currentTarget);
    setSelectedFindingId(findingId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedFindingId(null);
  };

  const handleViewFinding = async () => {
    try {
      const response = await api.get(`/audit/findings/${selectedFindingId}`);
      setSelectedFinding(response.data.data);
      setViewDialogOpen(true);
    } catch (err) {
      console.error('Error fetching finding details:', err);
      setError(err.response?.data?.message || 'Failed to fetch finding details.');
    }
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleConfirmDelete = async () => {
    try {
      await api.delete(`/audit/findings/${selectedFindingId}`);
      fetchFindings();
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error('Error deleting finding:', err);
      setError(err.response?.data?.message || 'Failed to delete finding.');
      setDeleteDialogOpen(false);
    }
  };

  const getSeverityChip = (severity) => {
    let color = 'default';
    let icon = null;
    switch (severity) {
      case 'Critical':
        color = 'error';
        icon = <ErrorIcon />;
        break;
      case 'High':
        color = 'error';
        icon = <WarningIcon />;
        break;
      case 'Medium':
        color = 'warning';
        icon = <InfoIcon />;
        break;
      case 'Low':
        color = 'success';
        icon = <CheckCircleIcon />;
        break;
      default:
        break;
    }
    return <Chip label={severity} color={color} icon={icon} size="small" />;
  };

  const getStatusChip = (status) => {
    let color = 'default';
    switch (status) {
      case 'Open':
        color = 'error';
        break;
      case 'Under Review':
        color = 'warning';
        break;
      case 'Closed':
        color = 'success';
        break;
      case 'Resolved':
        color = 'info';
        break;
      default:
        break;
    }
    return <Chip label={status} color={color} size="small" />;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading Audit Findings...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: theme.palette.primary.dark }}>
        <BugReportIcon sx={{ mr: 1, verticalAlign: 'middle' }} /> Audit Findings
      </Typography>
      <Typography variant="subtitle1" color="textSecondary" sx={{ mb: 3 }}>
        Manage and track audit findings with corrective actions.
      </Typography>

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              label="Search Findings"
              variant="outlined"
              size="small"
              fullWidth
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Severity</InputLabel>
              <Select
                value={filters.severity}
                label="Severity"
                name="severity"
                onChange={handleFilterChange}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="Critical">Critical</MenuItem>
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="Low">Low</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                label="Status"
                name="status"
                onChange={handleFilterChange}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="Open">Open</MenuItem>
                <MenuItem value="Under Review">Under Review</MenuItem>
                <MenuItem value="Closed">Closed</MenuItem>
                <MenuItem value="Resolved">Resolved</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/audit/findings/new')}
              fullWidth
            >
              Add Finding
            </Button>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              fullWidth
            >
              Export
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Findings Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Finding</TableCell>
              <TableCell>Audit</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Attachments</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(findings || []).map((finding) => (
              <TableRow key={finding._id} hover>
                <TableCell>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                      {finding.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ 
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {finding.description}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {finding.audit?.objective || 'N/A'}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {finding.audit?.auditType || ''}
                  </Typography>
                </TableCell>
                <TableCell>
                  {getSeverityChip(finding.severity)}
                </TableCell>
                <TableCell>
                  {getStatusChip(finding.status)}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(finding.createdAt)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    by {finding.createdBy?.firstName} {finding.createdBy?.lastName}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    {finding.attachments?.map((attachment, index) => (
                      <Tooltip key={index} title={attachment.filename}>
                        <IconButton size="small">
                          <AttachFileIcon />
                        </IconButton>
                      </Tooltip>
                    ))}
                    {(!finding.attachments || finding.attachments.length === 0) && (
                      <Typography variant="caption" color="textSecondary">
                        None
                      </Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    onClick={(e) => handleMenuOpen(e, finding._id)}
                    size="small"
                  >
                    <MoreVertIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {findings.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="textSecondary">
                    No audit findings found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={totalItems}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
      />

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewFinding}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => navigate(`/audit/findings/${selectedFindingId}/edit`)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* View Finding Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BugReportIcon />
            {selectedFinding?.title}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedFinding && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Severity
                  </Typography>
                  {getSeverityChip(selectedFinding.severity)}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Status
                  </Typography>
                  {getStatusChip(selectedFinding.status)}
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Description
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {selectedFinding.description}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Audit
                  </Typography>
                  <Typography variant="body2">
                    {selectedFinding.audit?.objective}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {selectedFinding.audit?.auditType}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Created
                  </Typography>
                  <Typography variant="body2">
                    {formatDate(selectedFinding.createdAt)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    by {selectedFinding.createdBy?.firstName} {selectedFinding.createdBy?.lastName}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          <Button variant="contained" onClick={() => navigate(`/audit/findings/${selectedFinding?._id}/edit`)}>
            Edit Finding
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Finding</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this audit finding? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditFindings;
