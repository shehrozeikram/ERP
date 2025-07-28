import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Skeleton,
  Tooltip,
  Badge,
  Fab,
  InputAdornment,
  Collapse,
  CardHeader,
  Divider,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  MoreVert as MoreIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Home as HomeIcon,
  PhoneAndroid as PhoneAndroidIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import crmService from '../../services/crmService';
import { formatPKR } from '../../utils/currency';

const Leads = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [businessFilter, setBusinessFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [leadDialog, setLeadDialog] = useState({ open: false, mode: 'add', lead: null });
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    source: 'Website',
    status: 'New',
    priority: 'Medium',
    business: 'SGC General',
    assignedTo: ''
  });

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Debug: Check if user is authenticated
      const token = localStorage.getItem('token');
      console.log('Auth token exists:', !!token);
      
      // Debug: Check user role from token
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('User role:', payload.role);
          console.log('User ID:', payload.id);
        } catch (e) {
          console.log('Could not decode token');
        }
      }
      
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search,
        status: statusFilter,
        source: sourceFilter,
        assignedTo: assignedToFilter,
        priority: priorityFilter,
        business: businessFilter
      };

      console.log('Requesting leads with params:', params);
      const response = await crmService.getLeads(params);
      console.log('Leads API response:', response);
      
      // The API returns { success: true, data: { leads, pagination } }
      const leadsData = response.data?.data || response.data;
      console.log('Leads data:', leadsData);
      
      setLeads(leadsData?.leads || []);
      setTotalItems(leadsData?.pagination?.totalItems || 0);
    } catch (err) {
      console.error('Error loading leads:', err);
      console.error('Error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data
      });
      setError(`Failed to load leads: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, statusFilter, sourceFilter, assignedToFilter, priorityFilter, businessFilter]);

  const loadUsers = useCallback(async () => {
    try {
      const response = await crmService.getUsers();
      console.log('Users API response:', response);
      // The API returns { success: true, data: users }
      const usersData = response.data?.data || response.data || [];
      console.log('Users data:', usersData);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      console.error('Error loading users:', err);
      setUsers([]); // Set empty array on error
    }
  }, []);

  useEffect(() => {
    loadLeads();
    loadUsers();
  }, [loadLeads, loadUsers]);

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearch = (event) => {
    setSearch(event.target.value);
    setPage(0);
  };

  const handleFilterChange = (filterType, value) => {
    switch (filterType) {
      case 'status':
        setStatusFilter(value);
        break;
      case 'source':
        setSourceFilter(value);
        break;
      case 'assignedTo':
        setAssignedToFilter(value);
        break;
      case 'priority':
        setPriorityFilter(value);
        break;
      case 'business':
        setBusinessFilter(value);
        break;
      default:
        break;
    }
    setPage(0);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setSourceFilter('');
    setAssignedToFilter('');
    setPriorityFilter('');
    setBusinessFilter('');
    setPage(0);
  };

  const handleDeleteLead = async () => {
    try {
      await crmService.deleteLead(leadToDelete._id);
      setDeleteDialogOpen(false);
      setLeadToDelete(null);
      loadLeads();
    } catch (err) {
      console.error('Error deleting lead:', err);
      setError('Failed to delete lead. Please try again.');
    }
  };

  const openDeleteDialog = (lead) => {
    setLeadToDelete(lead);
    setDeleteDialogOpen(true);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddLead = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      company: '',
      source: 'Website',
      status: 'New',
      priority: 'Medium',
      business: 'SGC General',
      assignedTo: ''
    });
    setLeadDialog({ open: true, mode: 'add', lead: null });
  };

  const handleEditLead = (lead) => {
    setFormData({
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      source: lead.source || 'Website',
      status: lead.status || 'New',
      priority: lead.priority || 'Medium',
      business: lead.business || 'SGC General',
      assignedTo: lead.assignedTo?._id || ''
    });
    setLeadDialog({ open: true, mode: 'edit', lead });
  };

  const handleSaveLead = async () => {
    try {
      if (leadDialog.mode === 'add') {
        await crmService.createLead(formData);
        setSuccess('Lead added successfully!');
      } else {
        await crmService.updateLead(leadDialog.lead._id, formData);
        setSuccess('Lead updated successfully!');
      }
      setLeadDialog({ open: false, mode: 'add', lead: null });
      loadLeads();
    } catch (err) {
      console.error('Error saving lead:', err);
      setError('Failed to save lead. Please try again.');
    }
  };

  const getStatusColor = (status) => {
    return crmService.getStatusColor(status);
  };

  const getPriorityColor = (priority) => {
    return crmService.getPriorityColor(priority);
  };

  const getScoreColor = (score) => {
    return crmService.getScoreColor(score);
  };

  const formatDate = (date) => {
    return crmService.formatDate(date);
  };

  const getInitials = (firstName, lastName) => {
    return crmService.getInitials(firstName, lastName);
  };

  const truncateText = (text, maxLength = 30) => {
    return crmService.truncateText(text, maxLength);
  };

  const getSalesStageColor = (stage) => {
    const colors = {
      'Initial Contact': '#2196F3',
      'Property Shown': '#FF9800',
      'Price Negotiation': '#9C27B0',
      'Documentation': '#FF5722',
      'Payment Processing': '#4CAF50',
      'Deal Closed': '#4CAF50',
      'Deal Lost': '#F44336'
    };
    return colors[stage] || '#9E9E9E';
  };

  const formatCurrency = (amount) => {
    if (!amount) return '₨0';
    return formatPKR(amount);
  };

  const getDaysUntilFollowUp = (followUpDate) => {
    const today = new Date();
    const followUp = new Date(followUpDate);
    const diffTime = followUp - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `${diffDays} days`;
  };

  const FilterSection = () => (
    <Collapse in={showFilters}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Business</InputLabel>
                <Select
                  value={businessFilter}
                  label="Business"
                  onChange={(e) => handleFilterChange('business', e.target.value)}
                >
                  <MenuItem value="">All Businesses</MenuItem>
                  <MenuItem value="Taj Residencia">Taj Residencia</MenuItem>
                  <MenuItem value="Boly.pk">Boly.pk</MenuItem>
                  <MenuItem value="SGC General">SGC General</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="New">New</MenuItem>
                  <MenuItem value="Contacted">Contacted</MenuItem>
                  <MenuItem value="Qualified">Qualified</MenuItem>
                  <MenuItem value="Proposal Sent">Proposal Sent</MenuItem>
                  <MenuItem value="Negotiation">Negotiation</MenuItem>
                  <MenuItem value="Won">Won</MenuItem>
                  <MenuItem value="Lost">Lost</MenuItem>
                  <MenuItem value="Unqualified">Unqualified</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Source</InputLabel>
                <Select
                  value={sourceFilter}
                  label="Source"
                  onChange={(e) => handleFilterChange('source', e.target.value)}
                >
                  <MenuItem value="">All Sources</MenuItem>
                  <MenuItem value="Website">Website</MenuItem>
                  <MenuItem value="Social Media">Social Media</MenuItem>
                  <MenuItem value="Referral">Referral</MenuItem>
                  <MenuItem value="Cold Call">Cold Call</MenuItem>
                  <MenuItem value="Trade Show">Trade Show</MenuItem>
                  <MenuItem value="Advertisement">Advertisement</MenuItem>
                  <MenuItem value="Email Campaign">Email Campaign</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Assigned To</InputLabel>
                <Select
                  value={assignedToFilter}
                  label="Assigned To"
                  onChange={(e) => handleFilterChange('assignedTo', e.target.value)}
                >
                  <MenuItem value="">All Users</MenuItem>
                  {!users || users.length === 0 ? (
                    <MenuItem disabled>Loading users...</MenuItem>
                  ) : (
                    users.map((user) => (
                      <MenuItem key={user._id} value={user._id}>
                        {user.firstName} {user.lastName}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={priorityFilter}
                  label="Priority"
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                >
                  <MenuItem value="">All Priorities</MenuItem>
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" justifyContent="flex-end" gap={1}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Collapse>
  );

  if (loading && leads.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Leads Management
        </Typography>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rectangular" height={400} sx={{ mt: 3 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
          Leads Management
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={loadLeads} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddLead}
          >
            Add New Lead
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: '#2196F3' }}>
                    {totalItems}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Leads
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#2196F3', width: 56, height: 56 }}>
                  <PersonIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>
                    {leads?.filter(lead => lead.status === 'New')?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    New Leads
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#4CAF50', width: 56, height: 56 }}>
                  <TrendingUpIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: '#FF9800' }}>
                    {leads?.filter(lead => lead.status === 'Qualified')?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Qualified
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#FF9800', width: 56, height: 56 }}>
                  <CheckCircleIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>
                    {leads?.filter(lead => lead.business === 'Taj Residencia')?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Taj Residencia
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#4CAF50', width: 56, height: 56 }}>
                  <HomeIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: '#2196F3' }}>
                    {leads?.filter(lead => lead.business === 'Boly.pk')?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Boly.pk
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#2196F3', width: 56, height: 56 }}>
                  <PhoneAndroidIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: '#9C27B0' }}>
                    {leads?.filter(lead => lead.priority === 'High' || lead.priority === 'Urgent')?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    High Priority
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#9C27B0', width: 56, height: 56 }}>
                  <WarningIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search leads by name, email, company..."
                value={search}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box display="flex" justifyContent="flex-end" gap={1}>
                <Button
                  variant="outlined"
                  startIcon={<FilterIcon />}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  Filters
                </Button>
                                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => crmService.exportToCSV(leads || [], 'leads')}
                    disabled={!leads || leads.length === 0}
                  >
                    Export
                  </Button>
              </Box>
            </Grid>
          </Grid>
          <FilterSection />
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Leads Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Lead</TableCell>
                <TableCell>Business</TableCell>
                <TableCell>Property Details</TableCell>
                <TableCell>Sales Stage</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Next Follow-up</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                // Loading skeleton rows
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton variant="text" width={150} /></TableCell>
                    <TableCell><Skeleton variant="text" width={100} /></TableCell>
                    <TableCell><Skeleton variant="text" width={120} /></TableCell>
                    <TableCell><Skeleton variant="text" width={100} /></TableCell>
                    <TableCell><Skeleton variant="text" width={80} /></TableCell>
                    <TableCell><Skeleton variant="text" width={80} /></TableCell>
                    <TableCell><Skeleton variant="text" width={100} /></TableCell>
                    <TableCell><Skeleton variant="text" width={100} /></TableCell>
                    <TableCell><Skeleton variant="text" width={100} /></TableCell>
                  </TableRow>
                ))
              ) : leads?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      No leads found. Create your first lead to get started!
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                                leads?.map((lead) => (
                  <TableRow key={lead._id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Avatar sx={{ mr: 2, bgcolor: getStatusColor(lead.status) }}>
                          {getInitials(lead.firstName, lead.lastName)}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {lead.firstName} {lead.lastName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {lead.email}
                          </Typography>
                          {lead.phone && (
                            <Box display="flex" alignItems="center" mt={0.5}>
                              <PhoneIcon sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {lead.phone}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={lead.business}
                        size="small"
                        sx={{
                          backgroundColor: lead.business === 'Taj Residencia' ? '#4CAF50' : 
                                          lead.business === 'Boly.pk' ? '#2196F3' : '#9E9E9E',
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {lead.business === 'Taj Residencia' ? (
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {lead.propertyType} - {lead.plotSize}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {lead.propertyPhase}, {lead.propertyBlock}
                          </Typography>
                          {lead.propertyNumber && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              #{lead.propertyNumber}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Box display="flex" alignItems="center">
                          <BusinessIcon sx={{ mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {truncateText(lead.company, 25)}
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.business === 'Taj Residencia' ? (
                        <Chip
                          label={lead.salesStage || 'Initial Contact'}
                          size="small"
                          sx={{
                            backgroundColor: getSalesStageColor(lead.salesStage),
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                      ) : (
                        <Typography variant="body2">
                          {lead.source}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={lead.status}
                        size="small"
                        sx={{
                          backgroundColor: getStatusColor(lead.status),
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {lead.source}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={lead.priority}
                        size="small"
                        sx={{
                          backgroundColor: getPriorityColor(lead.priority),
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {lead.business === 'Taj Residencia' && lead.propertyPrice ? (
                        <Typography variant="body2" fontWeight="bold" color="primary">
                          {formatCurrency(lead.propertyPrice)}
                        </Typography>
                      ) : (
                        <Box display="flex" alignItems="center">
                          <Typography
                            variant="body2"
                            sx={{
                              color: getScoreColor(lead.score),
                              fontWeight: 'bold',
                              mr: 1
                            }}
                          >
                            {lead.score}
                          </Typography>
                          <Box
                            sx={{
                              width: 40,
                              height: 4,
                              backgroundColor: '#E0E0E0',
                              borderRadius: 2,
                              overflow: 'hidden'
                            }}
                          >
                            <Box
                              sx={{
                                width: `${lead.score}%`,
                                height: '100%',
                                backgroundColor: getScoreColor(lead.score)
                              }}
                            />
                          </Box>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.business === 'Taj Residencia' && lead.nextFollowUp ? (
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {formatDate(lead.nextFollowUp)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {getDaysUntilFollowUp(lead.nextFollowUp)}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2">
                          {formatDate(lead.createdAt)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/crm/leads/${lead._id}`)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Lead">
                          <IconButton
                            size="small"
                            onClick={() => handleEditLead(lead)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Lead">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => openDeleteDialog(lead)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalItems}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </Card>

      {/* Add/Edit Lead Dialog */}
      <Dialog
        open={leadDialog.open}
        onClose={() => setLeadDialog({ open: false, mode: 'add', lead: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {leadDialog.mode === 'add' ? 'Add New Lead' : 'Edit Lead'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={formData.firstName}
                onChange={(e) => handleFormChange('firstName', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => handleFormChange('lastName', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleFormChange('email', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => handleFormChange('phone', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company"
                value={formData.company}
                onChange={(e) => handleFormChange('company', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Business</InputLabel>
                <Select
                  value={formData.business}
                  onChange={(e) => handleFormChange('business', e.target.value)}
                  label="Business"
                >
                  <MenuItem value="Taj Residencia">Taj Residencia</MenuItem>
                  <MenuItem value="Boly.pk">Boly.pk</MenuItem>
                  <MenuItem value="SGC General">SGC General</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Source</InputLabel>
                <Select
                  value={formData.source}
                  onChange={(e) => handleFormChange('source', e.target.value)}
                  label="Source"
                >
                  <MenuItem value="Website">Website</MenuItem>
                  <MenuItem value="Social Media">Social Media</MenuItem>
                  <MenuItem value="Referral">Referral</MenuItem>
                  <MenuItem value="Cold Call">Cold Call</MenuItem>
                  <MenuItem value="Trade Show">Trade Show</MenuItem>
                  <MenuItem value="Advertisement">Advertisement</MenuItem>
                  <MenuItem value="Email Campaign">Email Campaign</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => handleFormChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="New">New</MenuItem>
                  <MenuItem value="Contacted">Contacted</MenuItem>
                  <MenuItem value="Qualified">Qualified</MenuItem>
                  <MenuItem value="Proposal Sent">Proposal Sent</MenuItem>
                  <MenuItem value="Negotiation">Negotiation</MenuItem>
                  <MenuItem value="Won">Won</MenuItem>
                  <MenuItem value="Lost">Lost</MenuItem>
                  <MenuItem value="Unqualified">Unqualified</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) => handleFormChange('priority', e.target.value)}
                  label="Priority"
                >
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Assigned To</InputLabel>
                <Select
                  value={formData.assignedTo}
                  onChange={(e) => handleFormChange('assignedTo', e.target.value)}
                  label="Assigned To"
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user._id} value={user._id}>
                      {user.firstName} {user.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeadDialog({ open: false, mode: 'add', lead: null })}>
            Cancel
          </Button>
          <Button onClick={handleSaveLead} variant="contained">
            {leadDialog.mode === 'add' ? 'Add Lead' : 'Update Lead'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Lead</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the lead "{leadToDelete?.firstName} {leadToDelete?.lastName}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteLead} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleAddLead}
      >
        <AddIcon />
      </Fab>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Leads; 