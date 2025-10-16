import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Snackbar,
  ToggleButton,
  ToggleButtonGroup
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
  PhoneAndroid as PhoneAndroidIcon,
  ArrowBack as ArrowBackIcon,
  ViewList as ViewListIcon,
  ViewKanban as ViewKanbanIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import crmService from '../../services/crmService';
import { formatPKR } from '../../utils/currency';

const Leads = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [leads, setLeads] = useState([]);
  const [leadDetail, setLeadDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isDetailView, setIsDetailView] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [leadDialog, setLeadDialog] = useState({ open: false, mode: 'add', lead: null });
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'kanban'
  const [draggedLead, setDraggedLead] = useState(null);
  const draggedLeadRef = useRef(null); // Use ref to avoid re-render during drag
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    source: 'Website',
    status: 'New',
    priority: 'Medium',
    department: '',
    assignedTo: ''
  });

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Debug: Check if user is authenticated
      const token = localStorage.getItem('token');
      
      // Debug: Check user role from token
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
        }
      }
      
      // In Kanban view, load all leads (no pagination)
      const params = {
        page: viewMode === 'kanban' ? 1 : page + 1,
        limit: viewMode === 'kanban' ? 1000 : rowsPerPage,
        search,
        status: statusFilter,
        source: sourceFilter,
        assignedTo: assignedToFilter,
        priority: priorityFilter,
        department: departmentFilter
      };

      const response = await crmService.getLeads(params);
      
      // The API returns { success: true, data: { leads, pagination } }
      const leadsData = response.data?.data || response.data;
      
      setLeads(leadsData?.leads || []);
      setTotalItems(leadsData?.pagination?.totalItems || 0);
    } catch (err) {
      setError(`Failed to load leads: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, statusFilter, sourceFilter, assignedToFilter, priorityFilter, departmentFilter, viewMode]);

  const loadUsers = useCallback(async () => {
    try {
      const response = await crmService.getUsers();
      // The API returns { success: true, data: users }
      const usersData = response.data?.data || response.data || [];
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      setUsers([]); // Set empty array on error
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const response = await crmService.getDepartments();
      // The API returns { success: true, data: departments }
      const departmentsData = response.data?.data || response.data || [];
      setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
    } catch (err) {
      setDepartments([]); // Set empty array on error
    }
  }, []);

  // Load lead detail if ID is present
  useEffect(() => {
    if (id) {
      loadLeadDetail();
    } else {
      setIsDetailView(false);
      loadLeads();
      loadUsers();
      loadDepartments();
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      loadLeads();
      loadUsers();
      loadDepartments();
    }
  }, [loadLeads, loadUsers, loadDepartments, id]);

  const loadLeadDetail = async () => {
    try {
      setLoading(true);
      setIsDetailView(true);
      const response = await crmService.getLead(id);
      setLeadDetail(response.data.data || response.data);
    } catch (err) {
      setError('Failed to load lead details');
      // Navigate back to list if lead not found
      navigate('/crm/leads');
    } finally {
      setLoading(false);
    }
  };

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
      case 'department':
        setDepartmentFilter(value);
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
    setDepartmentFilter('');
    setPage(0);
  };

  const handleDeleteLead = async () => {
    try {
      await crmService.deleteLead(leadToDelete._id);
      setDeleteDialogOpen(false);
      setLeadToDelete(null);
      loadLeads();
    } catch (err) {
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
      department: '',
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
      department: lead.department?._id || '',
      assignedTo: lead.assignedTo?._id || ''
    });
    setLeadDialog({ open: true, mode: 'edit', lead });
  };

  const handleSaveLead = async () => {
    try {
      // Validate required fields
      if (!formData.firstName || !formData.lastName || !formData.email) {
        setError('Please fill in all required fields');
        return;
      }

      if (!formData.department || formData.department === '') {
        setError('Please select a department');
        return;
      }

      // Clean formData - remove empty strings for ObjectId fields
      const cleanedData = { ...formData };
      if (!cleanedData.assignedTo || cleanedData.assignedTo === '') {
        delete cleanedData.assignedTo;
      }

      if (leadDialog.mode === 'add') {
        await crmService.createLead(cleanedData);
        setSuccess('Lead added successfully!');
      } else {
        await crmService.updateLead(leadDialog.lead._id, cleanedData);
        setSuccess('Lead updated successfully!');
      }
      setLeadDialog({ open: false, mode: 'add', lead: null });
      loadLeads();
    } catch (err) {
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

  // Get display name for lead - show company name if auto-created from company
  const getLeadDisplayName = (lead) => {
    if (lead.autoCreatedFromContact && lead.company) {
      return lead.company;
    }
    return `${lead.firstName} ${lead.lastName}`;
  };

  // Get initials for lead - show company initials if auto-created from company
  const getLeadInitials = (lead) => {
    if (lead.autoCreatedFromContact && lead.company) {
      const words = lead.company.split(' ');
      if (words.length >= 2) {
        return words[0].charAt(0) + words[1].charAt(0);
      }
      return lead.company.substring(0, 2).toUpperCase();
    }
    return getInitials(lead.firstName, lead.lastName);
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

  // Kanban board statuses configuration
  const kanbanStatuses = useMemo(() => [
    { id: 'New', label: 'New', color: '#2196F3' },
    { id: 'Contacted', label: 'Contacted', color: '#FF9800' },
    { id: 'Qualified', label: 'Qualified', color: '#4CAF50' },
    { id: 'Proposal Sent', label: 'Proposal Sent', color: '#9C27B0' },
    { id: 'Negotiation', label: 'Negotiation', color: '#FF5722' },
    { id: 'Won', label: 'Won', color: '#4CAF50' },
    { id: 'Lost', label: 'Lost', color: '#F44336' },
    { id: 'Unqualified', label: 'Unqualified', color: '#9E9E9E' }
  ], []);

  // Group leads by status for Kanban view
  const groupedLeads = useMemo(() => {
    const grouped = {};
    kanbanStatuses.forEach(status => {
      grouped[status.id] = leads.filter(lead => lead.status === status.id);
    });
    return grouped;
  }, [leads, kanbanStatuses]);

  // Drag and drop handlers
  const handleDragStart = (e, lead) => {
    // Use ref immediately to avoid re-render blocking drag
    draggedLeadRef.current = lead;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', lead._id);
    
    // Defer state update to not interfere with drag start
    requestAnimationFrame(() => {
      setDraggedLead(lead);
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const lead = draggedLeadRef.current;
    
    if (!lead || lead.status === newStatus) {
      setDraggedLead(null);
      draggedLeadRef.current = null;
      return;
    }

    try {
      // Update lead status
      await crmService.updateLead(lead._id, { status: newStatus });
      setSuccess(`Lead moved to ${newStatus}`);
      loadLeads();
    } catch (err) {
      setError('Failed to update lead status');
    } finally {
      setDraggedLead(null);
      draggedLeadRef.current = null;
    }
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
    draggedLeadRef.current = null;
  };

  // Kanban Lead Card Component
  const LeadCard = ({ lead }) => (
    <Card
      draggable={true}
      onDragStart={(e) => handleDragStart(e, lead)}
      onDragEnd={handleDragEnd}
      sx={{
        mb: 2,
        cursor: 'grab',
        opacity: draggedLead?._id === lead._id ? 0.5 : 1,
        userSelect: 'none',
        WebkitUserDrag: 'element',
        '&:hover': {
          boxShadow: 3,
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease'
        },
        '&:active': {
          cursor: 'grabbing'
        }
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
          <Box display="flex" alignItems="center" gap={1}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: getStatusColor(lead.status),
                fontSize: '0.875rem'
              }}
            >
              {getLeadInitials(lead)}
            </Avatar>
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" noWrap>
                {getLeadDisplayName(lead)}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {lead.email}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={0.5}>
            <Tooltip title="View Details">
              <IconButton 
                size="small" 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/crm/leads/${lead._id}`);
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <ViewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton 
                size="small" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditLead(lead);
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Department & Priority */}
        <Box display="flex" gap={1} mb={1.5}>
          <Chip
            label={lead.department?.name || 'No Department'}
            size="small"
            sx={{
              backgroundColor: '#2196F3',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.7rem',
              height: 20
            }}
          />
          <Chip
            label={lead.priority}
            size="small"
            sx={{
              backgroundColor: getPriorityColor(lead.priority),
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.7rem',
              height: 20
            }}
          />
        </Box>

        {/* Company Details */}
        {lead.company && (
          <Box display="flex" alignItems="center" mb={1}>
            <BusinessIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
            <Typography variant="body2" noWrap>
              {truncateText(lead.company, 25)}
            </Typography>
          </Box>
        )}

        {/* Contact Info */}
        {lead.phone && (
          <Box display="flex" alignItems="center" mb={0.5}>
            <PhoneIcon sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {lead.phone}
            </Typography>
          </Box>
        )}

        {/* Source & Follow-up */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mt={1.5} pt={1.5} borderTop="1px solid #f0f0f0">
          <Typography variant="caption" color="text.secondary">
            {lead.source}
          </Typography>
          {lead.nextFollowUp ? (
            <Typography variant="caption" color="primary" fontWeight="bold">
              {getDaysUntilFollowUp(lead.nextFollowUp)}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">
              {formatDate(lead.createdAt)}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  // Kanban Column Component
  const KanbanColumn = ({ status, leads: columnLeads }) => (
    <Paper
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, status.id)}
      sx={{
        minHeight: '70vh',
        backgroundColor: '#f5f5f5',
        p: 2,
        minWidth: 280,
        maxWidth: 320
      }}
    >
      {/* Column Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          pb: 1.5,
          borderBottom: `3px solid ${status.color}`
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: status.color
            }}
          />
          <Typography variant="subtitle2" fontWeight="bold">
            {status.label}
          </Typography>
          <Chip
            label={columnLeads.length}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.7rem',
              fontWeight: 'bold',
              backgroundColor: status.color,
              color: 'white'
            }}
          />
        </Box>
      </Box>

      {/* Column Content */}
      <Box sx={{ overflowY: 'auto', maxHeight: 'calc(70vh - 80px)' }}>
        {columnLeads.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
              border: '2px dashed #ddd',
              borderRadius: 1,
              backgroundColor: 'white'
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Drop leads here
            </Typography>
          </Box>
        ) : (
          columnLeads.map((lead) => <LeadCard key={lead._id} lead={lead} />)
        )}
      </Box>
    </Paper>
  );

  const FilterSection = () => (
    <Collapse in={showFilters}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select
                  value={departmentFilter}
                  label="Department"
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                >
                  <MenuItem value="">All Departments</MenuItem>
                  {!departments || departments.length === 0 ? (
                    <MenuItem disabled>Loading...</MenuItem>
                  ) : (
                    departments.map((dept) => (
                      <MenuItem key={dept._id} value={dept._id}>
                        {dept.name}
                      </MenuItem>
                    ))
                  )}
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

  // Render detail view if viewing a specific lead
  if (isDetailView && leadDetail) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/crm/leads')}
              sx={{ mb: 1 }}
            >
              Back to Leads
            </Button>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              Lead Details
            </Typography>
          </Box>
          <Box>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => handleEditLead(leadDetail)}
              sx={{ mr: 1 }}
            >
              Edit
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => openDeleteDialog(leadDetail)}
            >
              Delete
            </Button>
          </Box>
        </Box>

        {/* Lead Information */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Contact Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Name</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {leadDetail.firstName} {leadDetail.lastName}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Email</Typography>
                  <Typography variant="body1">{leadDetail.email}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Phone</Typography>
                  <Typography variant="body1">{leadDetail.phone || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Company</Typography>
                  <Typography variant="body1">{leadDetail.company || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Source</Typography>
                  <Typography variant="body1">{leadDetail.source}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Department</Typography>
                  <Typography variant="body1">{leadDetail.department?.name || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Status</Typography>
                  <Chip label={leadDetail.status} color="primary" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Priority</Typography>
                  <Chip label={leadDetail.priority} color={
                    leadDetail.priority === 'Urgent' ? 'error' :
                    leadDetail.priority === 'High' ? 'warning' : 'default'
                  } />
                </Grid>
                {leadDetail.assignedTo && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Assigned To</Typography>
                    <Typography variant="body1">
                      {leadDetail.assignedTo.firstName} {leadDetail.assignedTo.lastName}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Additional Information
              </Typography>
              <Typography variant="body2" color="text.secondary">Created</Typography>
              <Typography variant="body1" gutterBottom>
                {new Date(leadDetail.createdAt).toLocaleDateString()}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Updated</Typography>
              <Typography variant="body1">
                {new Date(leadDetail.updatedAt).toLocaleDateString()}
              </Typography>
            </Paper>
          </Grid>
          {leadDetail.notes && leadDetail.notes.length > 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Notes
                </Typography>
                {leadDetail.notes.map((note, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(note.createdAt).toLocaleString()} - {note.createdBy?.firstName} {note.createdBy?.lastName}
                    </Typography>
                    <Typography variant="body1">{note.content}</Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>
          )}
        </Grid>
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
        <Box display="flex" alignItems="center" gap={2}>
          {/* View Toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newView) => newView && setViewMode(newView)}
            size="small"
          >
            <ToggleButton value="table">
              <Tooltip title="Table View">
                <ViewListIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="kanban">
              <Tooltip title="Kanban View">
                <ViewKanbanIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          <Tooltip title="Refresh">
            <IconButton onClick={loadLeads}>
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
                  <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: '#00BCD4' }}>
                    {leads?.filter(lead => lead.status === 'Contacted')?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Contacted
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#00BCD4', width: 56, height: 56 }}>
                  <PhoneIcon />
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
                    {leads?.filter(lead => lead.status === 'Proposal Sent')?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Proposal Sent
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#9C27B0', width: 56, height: 56 }}>
                  <EmailIcon />
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

      {/* Kanban Board View */}
      {viewMode === 'kanban' ? (
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            overflowX: 'auto',
            pb: 2,
            '&::-webkit-scrollbar': {
              height: 8
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: '#f1f1f1'
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#888',
              borderRadius: 4
            },
            '&::-webkit-scrollbar-thumb:hover': {
              backgroundColor: '#555'
            }
          }}
        >
          {loading ? (
            // Loading skeleton for Kanban
            kanbanStatuses.map((status) => (
              <Paper key={status.id} sx={{ minWidth: 280, maxWidth: 320, p: 2, minHeight: '70vh' }}>
                <Skeleton variant="text" width={150} height={30} sx={{ mb: 2 }} />
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="rectangular" height={200} sx={{ mb: 2, borderRadius: 1 }} />
                ))}
              </Paper>
            ))
          ) : (
            kanbanStatuses.map((status) => (
              <KanbanColumn
                key={status.id}
                status={status}
                leads={groupedLeads[status.id] || []}
              />
            ))
          )}
        </Box>
      ) : (
        /* Table View */
        <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Lead</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Created</TableCell>
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
                          {getLeadInitials(lead)}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {getLeadDisplayName(lead)}
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
                        label={lead.department?.name || 'No Department'}
                        size="small"
                        sx={{
                          backgroundColor: '#2196F3',
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <BusinessIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {truncateText(lead.company, 25) || 'N/A'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {lead.source}
                      </Typography>
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
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(lead.createdAt)}
                      </Typography>
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
      )}

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
                <InputLabel>Department</InputLabel>
                <Select
                  value={formData.department}
                  onChange={(e) => handleFormChange('department', e.target.value)}
                  label="Department"
                  required
                >
                  <MenuItem value="">Select Department</MenuItem>
                  {!departments || departments.length === 0 ? (
                    <MenuItem disabled>Loading departments...</MenuItem>
                  ) : (
                    departments.map((dept) => (
                      <MenuItem key={dept._id} value={dept._id}>
                        {dept.name} ({dept.code})
                      </MenuItem>
                    ))
                  )}
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