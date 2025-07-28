import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  Avatar,
  Tooltip,
  Alert,
  Skeleton,
  Fab,
  Switch,
  FormControlLabel,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Campaign as CampaignIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  MoreVert as MoreIcon,
  CalendarToday as CalendarIcon,
  Business as BusinessIcon,
  Assessment as AssessmentIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';

const Campaigns = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  // State management
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Filters and search
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    assignedTo: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Dialog states
  const [campaignDialog, setCampaignDialog] = useState({
    open: false,
    mode: 'add', // 'add' or 'edit'
    campaign: null
  });
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    campaign: null
  });
  const [metricsDialog, setMetricsDialog] = useState({
    open: false,
    campaign: null
  });
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'Email',
    status: 'Draft',
    startDate: '',
    endDate: '',
    budget: '',
    currency: 'PKR',
    targetAudience: '',
    goals: '',
    expectedRevenue: '',
    assignedTo: ''
  });

  // Metrics form data
  const [metricsData, setMetricsData] = useState({
    impressions: '',
    clicks: '',
    opens: '',
    responses: '',
    meetings: '',
    opportunities: '',
    deals: '',
    totalLeads: '',
    qualifiedLeads: '',
    actualRevenue: ''
  });

  // Load campaigns data
  const loadCampaigns = useCallback(async () => {
    try {
      console.log('=== LOADING CAMPAIGNS ===');
      setLoading(true);
      setError(null);
      
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search,
        ...filters,
        _t: Date.now()
      };

      console.log('API params:', params);
      const response = await api.get('/campaigns', { 
        params,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      console.log('API response:', response);
      
      if (response && response.data && response.data.data) {
        const campaignsArray = response.data.data.campaigns || [];
        const totalItems = response.data.data.pagination?.totalItems || 0;
        const totalPages = response.data.data.pagination?.totalPages || 0;
        
        console.log('Setting campaigns:', campaignsArray.length, 'campaigns');
        setCampaigns(campaignsArray);
        setTotalItems(totalItems);
        setTotalPages(totalPages);
      } else {
        console.log('No valid response data');
        setCampaigns([]);
        setTotalItems(0);
        setTotalPages(0);
      }
    } catch (err) {
      console.error('Error loading campaigns:', err);
      setError('Failed to load campaigns. Please try again.');
      setCampaigns([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, filters, user, token]);

  useEffect(() => {
    console.log('=== CAMPAIGNS COMPONENT MOUNTED ===');
    loadCampaigns();
  }, [loadCampaigns]);

  // Handle search
  const handleSearch = (event) => {
    setSearch(event.target.value);
    setPage(0);
  };

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  };

  // Handle form field changes
  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle metrics form changes
  const handleMetricsChange = (field, value) => {
    setMetricsData(prev => ({ ...prev, [field]: value }));
  };

  // Open add campaign dialog
  const handleAddCampaign = () => {
    setFormData({
      name: '',
      description: '',
      type: 'Email',
      status: 'Draft',
      startDate: '',
      endDate: '',
      budget: '',
      currency: 'PKR',
      targetAudience: '',
      goals: '',
      expectedRevenue: '',
      assignedTo: user.id
    });
    setCampaignDialog({ open: true, mode: 'add', campaign: null });
  };

  // Open edit campaign dialog
  const handleEditCampaign = (campaign) => {
    console.log('=== EDITING CAMPAIGN ===');
    console.log('Campaign to edit:', campaign);
    
    setFormData({
      name: campaign.name || '',
      description: campaign.description || '',
      type: campaign.type || 'Email',
      status: campaign.status || 'Draft',
      startDate: campaign.startDate ? new Date(campaign.startDate).toISOString().split('T')[0] : '',
      endDate: campaign.endDate ? new Date(campaign.endDate).toISOString().split('T')[0] : '',
      budget: campaign.budget || '',
      currency: campaign.currency || 'PKR',
      targetAudience: campaign.targetAudience || '',
      goals: campaign.goals || '',
      expectedRevenue: campaign.expectedRevenue || '',
      assignedTo: campaign.assignedTo?._id || user.id
    });
    setCampaignDialog({ open: true, mode: 'edit', campaign });
  };

  // Open metrics dialog
  const handleUpdateMetrics = (campaign) => {
    setMetricsData({
      impressions: campaign.metrics?.impressions || '',
      clicks: campaign.metrics?.clicks || '',
      opens: campaign.metrics?.opens || '',
      responses: campaign.metrics?.responses || '',
      meetings: campaign.metrics?.meetings || '',
      opportunities: campaign.metrics?.opportunities || '',
      deals: campaign.metrics?.deals || '',
      totalLeads: campaign.totalLeads || '',
      qualifiedLeads: campaign.qualifiedLeads || '',
      actualRevenue: campaign.actualRevenue || ''
    });
    setMetricsDialog({ open: true, campaign });
  };

  // Save campaign
  const handleSaveCampaign = async () => {
    try {
      console.log('=== SAVING CAMPAIGN ===');
      console.log('Form data:', formData);
      
      const campaignData = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        status: formData.status,
        startDate: formData.startDate,
        endDate: formData.endDate,
        budget: parseFloat(formData.budget) || 0,
        currency: formData.currency,
        targetAudience: formData.targetAudience,
        goals: formData.goals,
        expectedRevenue: parseFloat(formData.expectedRevenue) || 0,
        assignedTo: formData.assignedTo
      };

      console.log('Campaign data to send:', campaignData);

      if (campaignDialog.mode === 'add') {
        console.log('Creating new campaign...');
        const response = await api.post('/campaigns', campaignData);
        console.log('Create campaign response:', response);
        setSuccess('Campaign added successfully!');
      } else {
        console.log('Updating existing campaign...');
        const response = await api.put(`/campaigns/${campaignDialog.campaign._id}`, campaignData);
        console.log('Update campaign response:', response);
        setSuccess('Campaign updated successfully!');
      }

      setCampaignDialog({ open: false, mode: 'add', campaign: null });
      setPage(0);
      setSearch('');
      setFilters({ type: '', status: '', assignedTo: '' });
      await loadCampaigns();
    } catch (err) {
      console.error('Error saving campaign:', err);
      console.error('Error details:', err.response?.data);
      setError('Failed to save campaign. Please try again.');
    }
  };

  // Update metrics
  const handleSaveMetrics = async () => {
    try {
      console.log('=== UPDATING METRICS ===');
      console.log('Metrics data:', metricsData);
      
      const metricsUpdate = {
        metrics: {
          impressions: parseInt(metricsData.impressions) || 0,
          clicks: parseInt(metricsData.clicks) || 0,
          opens: parseInt(metricsData.opens) || 0,
          responses: parseInt(metricsData.responses) || 0,
          meetings: parseInt(metricsData.meetings) || 0,
          opportunities: parseInt(metricsData.opportunities) || 0,
          deals: parseInt(metricsData.deals) || 0
        },
        totalLeads: parseInt(metricsData.totalLeads) || 0,
        qualifiedLeads: parseInt(metricsData.qualifiedLeads) || 0,
        actualRevenue: parseFloat(metricsData.actualRevenue) || 0
      };

      const response = await api.put(`/campaigns/${metricsDialog.campaign._id}/metrics`, metricsUpdate);
      console.log('Update metrics response:', response);
      
      setMetricsDialog({ open: false, campaign: null });
      setSuccess('Campaign metrics updated successfully!');
      await loadCampaigns();
    } catch (err) {
      console.error('Error updating metrics:', err);
      setError('Failed to update metrics. Please try again.');
    }
  };

  // Delete campaign
  const handleDeleteCampaign = async () => {
    try {
      console.log('=== DELETING CAMPAIGN ===');
      console.log('Campaign ID:', deleteDialog.campaign._id);
      
      const response = await api.delete(`/campaigns/${deleteDialog.campaign._id}`);
      console.log('Delete response:', response);
      
      setDeleteDialog({ open: false, campaign: null });
      setSuccess('Campaign deleted successfully!');
      setError(null);
      await loadCampaigns();
    } catch (err) {
      console.error('Error deleting campaign:', err);
      console.error('Error details:', err.response?.data);
      setError('Failed to delete campaign. Please try again.');
      setSuccess(null);
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Draft': return 'default';
      case 'Paused': return 'warning';
      case 'Completed': return 'info';
      case 'Cancelled': return 'error';
      default: return 'default';
    }
  };

  // Get type color
  const getTypeColor = (type) => {
    switch (type) {
      case 'Email': return 'primary';
      case 'Social Media': return 'secondary';
      case 'Direct Mail': return 'warning';
      case 'Telemarketing': return 'error';
      case 'Event': return 'info';
      case 'Webinar': return 'success';
      default: return 'default';
    }
  };

  // Format currency
  const formatCurrency = (amount, currency = 'PKR') => {
    if (!amount) return '₨0';
    return formatPKR(amount);
  };

  // Calculate ROI
  const calculateROI = (revenue, budget) => {
    if (budget > 0) {
      return ((revenue - budget) / budget) * 100;
    }
    return 0;
  };

  // Campaign card component
  const CampaignCard = ({ campaign }) => (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box display="flex" alignItems="center">
            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
              <CampaignIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="h3" noWrap>
                {campaign.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {campaign.type} Campaign
              </Typography>
            </Box>
          </Box>
          <IconButton size="small">
            <MoreIcon />
          </IconButton>
        </Box>

        <Box mb={2}>
          <Chip 
            label={campaign.type} 
            size="small" 
            color={getTypeColor(campaign.type)}
            sx={{ mr: 1 }}
          />
          <Chip 
            label={campaign.status} 
            size="small" 
            color={getStatusColor(campaign.status)}
          />
        </Box>

        {campaign.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {campaign.description}
          </Typography>
        )}

        <Box mb={2}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <CalendarIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <MoneyIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            Budget: {formatCurrency(campaign.budget, campaign.currency)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <PeopleIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            {campaign.totalLeads || 0} Leads • {campaign.qualifiedLeads || 0} Qualified
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            ROI: {calculateROI(campaign.actualRevenue, campaign.budget).toFixed(1)}%
          </Typography>
        </Box>

        {/* Progress bar */}
        <Box mb={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="caption" color="text.secondary">
              Progress
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {campaign.progress || 0}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={campaign.progress || 0} 
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Assigned to: {campaign.assignedTo?.firstName} {campaign.assignedTo?.lastName}
          </Typography>
          <Box>
            <Tooltip title="Update Metrics">
              <IconButton size="small" onClick={() => handleUpdateMetrics(campaign)}>
                <AssessmentIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => handleEditCampaign(campaign)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => setDeleteDialog({ open: true, campaign })}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Loading skeleton
  if (loading && campaigns.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Campaigns
        </Typography>
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item}>
              <Skeleton variant="rectangular" height={300} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
          Campaigns
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => setShowFilters(!showFilters)}
            sx={{ mr: 1 }}
          >
            Filters
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            sx={{ mr: 1 }}
          >
            Export
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadCampaigns}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddCampaign}
          >
            Add Campaign
          </Button>
        </Box>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search campaigns..."
              value={search}
              onChange={handleSearch}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          {showFilters && (
            <>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={filters.type}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    label="Type"
                  >
                    <MenuItem value="">All Types</MenuItem>
                    <MenuItem value="Email">Email</MenuItem>
                    <MenuItem value="Social Media">Social Media</MenuItem>
                    <MenuItem value="Direct Mail">Direct Mail</MenuItem>
                    <MenuItem value="Telemarketing">Telemarketing</MenuItem>
                    <MenuItem value="Event">Event</MenuItem>
                    <MenuItem value="Webinar">Webinar</MenuItem>
                    <MenuItem value="Content Marketing">Content Marketing</MenuItem>
                    <MenuItem value="Paid Advertising">Paid Advertising</MenuItem>
                    <MenuItem value="Referral Program">Referral Program</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="">All Status</MenuItem>
                    <MenuItem value="Draft">Draft</MenuItem>
                    <MenuItem value="Active">Active</MenuItem>
                    <MenuItem value="Paused">Paused</MenuItem>
                    <MenuItem value="Completed">Completed</MenuItem>
                    <MenuItem value="Cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setFilters({ type: '', status: '', assignedTo: '' });
                    setSearch('');
                  }}
                  fullWidth
                >
                  Clear
                </Button>
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      {/* Campaigns Grid */}
      {campaigns.length > 0 ? (
        <Grid container spacing={3}>
          {campaigns.map((campaign) => (
            <Grid item xs={12} sm={6} md={4} key={campaign._id}>
              <CampaignCard campaign={campaign} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CampaignIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No campaigns found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {search || Object.values(filters).some(f => f) 
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first campaign'
            }
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddCampaign}
          >
            Add Campaign
          </Button>
        </Paper>
      )}

      {/* Add/Edit Campaign Dialog */}
      <Dialog
        open={campaignDialog.open}
        onClose={() => setCampaignDialog({ open: false, mode: 'add', campaign: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {campaignDialog.mode === 'add' ? 'Add New Campaign' : 'Edit Campaign'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Campaign Name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Campaign Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => handleFormChange('type', e.target.value)}
                  label="Campaign Type"
                >
                  <MenuItem value="Email">Email</MenuItem>
                  <MenuItem value="Social Media">Social Media</MenuItem>
                  <MenuItem value="Direct Mail">Direct Mail</MenuItem>
                  <MenuItem value="Telemarketing">Telemarketing</MenuItem>
                  <MenuItem value="Event">Event</MenuItem>
                  <MenuItem value="Webinar">Webinar</MenuItem>
                  <MenuItem value="Content Marketing">Content Marketing</MenuItem>
                  <MenuItem value="Paid Advertising">Paid Advertising</MenuItem>
                  <MenuItem value="Referral Program">Referral Program</MenuItem>
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
                  <MenuItem value="Draft">Draft</MenuItem>
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Paused">Paused</MenuItem>
                  <MenuItem value="Completed">Completed</MenuItem>
                  <MenuItem value="Cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleFormChange('startDate', e.target.value)}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleFormChange('endDate', e.target.value)}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Budget"
                type="number"
                value={formData.budget}
                onChange={(e) => handleFormChange('budget', e.target.value)}
                InputProps={{
                  startAdornment: <Typography variant="body2" sx={{ mr: 1 }}>$</Typography>
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select
                  value={formData.currency}
                  onChange={(e) => handleFormChange('currency', e.target.value)}
                  label="Currency"
                >
                  <MenuItem value="PKR">PKR</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="EUR">EUR</MenuItem>
                  <MenuItem value="GBP">GBP</MenuItem>
                  <MenuItem value="CAD">CAD</MenuItem>
                  <MenuItem value="AUD">AUD</MenuItem>
                  <MenuItem value="INR">INR</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Expected Revenue"
                type="number"
                value={formData.expectedRevenue}
                onChange={(e) => handleFormChange('expectedRevenue', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Target Audience"
                value={formData.targetAudience}
                onChange={(e) => handleFormChange('targetAudience', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Goals"
                multiline
                rows={2}
                value={formData.goals}
                onChange={(e) => handleFormChange('goals', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCampaignDialog({ open: false, mode: 'add', campaign: null })}>
            Cancel
          </Button>
          <Button onClick={handleSaveCampaign} variant="contained">
            {campaignDialog.mode === 'add' ? 'Add Campaign' : 'Update Campaign'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Metrics Dialog */}
      <Dialog
        open={metricsDialog.open}
        onClose={() => setMetricsDialog({ open: false, campaign: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Update Campaign Metrics</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                {metricsDialog.campaign?.name}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Impressions"
                type="number"
                value={metricsData.impressions}
                onChange={(e) => handleMetricsChange('impressions', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Clicks"
                type="number"
                value={metricsData.clicks}
                onChange={(e) => handleMetricsChange('clicks', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Opens"
                type="number"
                value={metricsData.opens}
                onChange={(e) => handleMetricsChange('opens', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Responses"
                type="number"
                value={metricsData.responses}
                onChange={(e) => handleMetricsChange('responses', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Meetings"
                type="number"
                value={metricsData.meetings}
                onChange={(e) => handleMetricsChange('meetings', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Opportunities"
                type="number"
                value={metricsData.opportunities}
                onChange={(e) => handleMetricsChange('opportunities', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Deals"
                type="number"
                value={metricsData.deals}
                onChange={(e) => handleMetricsChange('deals', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Total Leads"
                type="number"
                value={metricsData.totalLeads}
                onChange={(e) => handleMetricsChange('totalLeads', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Qualified Leads"
                type="number"
                value={metricsData.qualifiedLeads}
                onChange={(e) => handleMetricsChange('qualifiedLeads', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Actual Revenue"
                type="number"
                value={metricsData.actualRevenue}
                onChange={(e) => handleMetricsChange('actualRevenue', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMetricsDialog({ open: false, campaign: null })}>
            Cancel
          </Button>
          <Button onClick={handleSaveMetrics} variant="contained">
            Update Metrics
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, campaign: null })}
      >
        <DialogTitle>Delete Campaign</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deleteDialog.campaign?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, campaign: null })}>
            Cancel
          </Button>
          <Button onClick={handleDeleteCampaign} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleAddCampaign}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default Campaigns; 