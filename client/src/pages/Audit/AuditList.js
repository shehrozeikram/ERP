import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
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
  Grid,
  Paper,
  TablePagination,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  Skeleton,
  LinearProgress,
  alpha,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Assessment as AssessmentIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Business as BusinessIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import { formatPKR } from '../../utils/currency';

const AuditList = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    auditType: '',
    module: '',
    riskLevel: ''
  });
  
  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState({ open: false, audit: null });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedAudit, setSelectedAudit] = useState(null);

  useEffect(() => {
    fetchAudits();
  }, [page, rowsPerPage, searchQuery, filters]);

  const fetchAudits = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        ...filters
      });
      
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await api.get(`/audit?${params}`);
      setAudits(response.data.data.audits);
      setTotalCount(response.data.data.pagination.totalCount);
    } catch (error) {
      console.error('Error fetching audits:', error);
      setError('Failed to fetch audits');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
    setPage(0);
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
    setPage(0);
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleMenuOpen = (event, audit) => {
    setAnchorEl(event.currentTarget);
    setSelectedAudit(audit);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedAudit(null);
  };

  const handleViewAudit = (audit) => {
    navigate(`/audit/${audit._id}`);
    handleMenuClose();
  };

  const handleEditAudit = (audit) => {
    navigate(`/audit/${audit._id}/edit`);
    handleMenuClose();
  };

  const handleDeleteAudit = (audit) => {
    setDeleteDialog({ open: true, audit });
    handleMenuClose();
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/audit/${deleteDialog.audit._id}`);
      await fetchAudits();
      setDeleteDialog({ open: false, audit: null });
    } catch (error) {
      console.error('Error deleting audit:', error);
      setError('Failed to delete audit');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'info';
      case 'under_review': return 'warning';
      case 'planned': return 'default';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon />;
      case 'in_progress': return <AssessmentIcon />;
      case 'under_review': return <WarningIcon />;
      case 'planned': return <ScheduleIcon />;
      case 'cancelled': return <WarningIcon />;
      default: return <AssessmentIcon />;
    }
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'critical': return theme.palette.error.main;
      case 'high': return theme.palette.warning.main;
      case 'medium': return theme.palette.info.main;
      case 'low': return theme.palette.success.main;
      default: return theme.palette.grey[500];
    }
  };

  const getAuditTypeIcon = (auditType) => {
    switch (auditType) {
      case 'internal': return <SecurityIcon />;
      case 'departmental': return <BusinessIcon />;
      case 'compliance': return <CheckCircleIcon />;
      case 'financial': return <AssessmentIcon />;
      case 'asset': return <BusinessIcon />;
      default: return <AssessmentIcon />;
    }
  };

  const ListSkeleton = () => (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="text" width={240} height={48} />
      <Skeleton variant="text" width={360} height={24} sx={{ mb: 3 }} />
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          {[4, 2, 2, 2].map((size, idx) => (
            <Grid item xs={12} md={size} key={idx}>
              <Skeleton variant="rounded" height={48} />
            </Grid>
          ))}
        </Grid>
      </Paper>
      {Array.from({ length: 3 }).map((_, idx) => (
        <Card key={idx} sx={{ mb: 2 }}>
          <CardContent>
            <Skeleton variant="text" width="60%" height={32} />
            <Skeleton variant="text" width="30%" />
            <Skeleton variant="rectangular" height={80} sx={{ mt: 2, borderRadius: 2 }} />
          </CardContent>
        </Card>
      ))}
    </Box>
  );

  const AuditCard = ({ audit }) => (
    <Card sx={{ mb: 2, '&:hover': { boxShadow: theme.shadows[4] } }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" gutterBottom>
              {audit.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {audit.auditNumber}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Chip
                icon={getAuditTypeIcon(audit.auditType)}
                label={audit.auditType}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={getStatusIcon(audit.status)}
                label={audit.status.replace('_', ' ')}
                size="small"
                color={getStatusColor(audit.status)}
              />
              <Chip
                label={audit.riskLevel}
                size="small"
                sx={{ 
                  bgcolor: alpha(getRiskColor(audit.riskLevel), 0.1),
                  color: getRiskColor(audit.riskLevel)
                }}
              />
            </Box>
          </Box>
          <IconButton onClick={(e) => handleMenuOpen(e, audit)}>
            <MoreVertIcon />
          </IconButton>
        </Box>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <BusinessIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Department: {audit.department?.name || 'N/A'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <PeopleIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Lead Auditor: {audit.leadAuditor?.firstName} {audit.leadAuditor?.lastName}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <ScheduleIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Start: {formatDate(audit.plannedStartDate)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <ScheduleIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                End: {formatDate(audit.plannedEndDate)}
              </Typography>
            </Box>
          </Grid>
        </Grid>
        
        {audit.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {audit.description}
          </Typography>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {audit.totalFindings} findings • {audit.auditTeam?.length || 0} team members
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Progress: {audit.progress}%
          </Typography>
        </Box>
        
        <LinearProgress 
          variant="determinate" 
          value={audit.progress} 
          sx={{ mt: 1, height: 6, borderRadius: 3 }}
        />
      </CardContent>
    </Card>
  );

  if (loading) {
    return <ListSkeleton />;
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Audit Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/audit/new')}
        >
          New Audit
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search audits..."
              value={searchQuery}
              onChange={handleSearch}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                label="Status"
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="planned">Planned</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="under_review">Under Review</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Audit Type</InputLabel>
              <Select
                value={filters.auditType}
                label="Audit Type"
                onChange={(e) => handleFilterChange('auditType', e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="internal">Internal</MenuItem>
                <MenuItem value="departmental">Departmental</MenuItem>
                <MenuItem value="compliance">Compliance</MenuItem>
                <MenuItem value="financial">Financial</MenuItem>
                <MenuItem value="asset">Asset</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Module</InputLabel>
              <Select
                value={filters.module}
                label="Module"
                onChange={(e) => handleFilterChange('module', e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="hr">HR</MenuItem>
                <MenuItem value="finance">Finance</MenuItem>
                <MenuItem value="procurement">Procurement</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="sales">Sales</MenuItem>
                <MenuItem value="crm">CRM</MenuItem>
                <MenuItem value="general">General</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Risk Level</InputLabel>
              <Select
                value={filters.riskLevel}
                label="Risk Level"
                onChange={(e) => handleFilterChange('riskLevel', e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Audits List */}
      {audits.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <AssessmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No audits found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create your first audit to get started with compliance monitoring.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/audit/new')}
          >
            Create Audit
          </Button>
        </Paper>
      ) : (
        <>
          {(audits || []).map((audit) => (
            <AuditCard key={audit._id} audit={audit} />
          ))}
          
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleViewAudit(selectedAudit)}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleEditAudit(selectedAudit)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleDeleteAudit(selectedAudit)}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, audit: null })}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the audit "{deleteDialog.audit?.title}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, audit: null })}>
            Cancel
          </Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditList;
