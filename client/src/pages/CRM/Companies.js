import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Avatar,
  Tooltip,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Skeleton,
  Fab,
  Divider,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  People as PeopleIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Language as WebsiteIcon,
  LocationOn as LocationIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  MoreVert as MoreIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import crmService from '../../services/crmService';
import { formatPKR } from '../../utils/currency';

const Companies = () => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    industry: '',
    type: '',
    status: '',
    size: '',
    assignedTo: ''
  });
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  // Dialog states
  const [companyDialog, setCompanyDialog] = useState({ open: false, mode: 'add', company: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, company: null });

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    website: '',
    phone: '',
    email: '',
    industry: '',
    type: 'Prospect',
    status: 'Prospect',
    size: '1-10',
    annualRevenue: 'Less than ₨100M',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'United States'
    },
    foundedYear: '',
    taxId: '',
    registrationNumber: '',
    socialMedia: {
      linkedin: '',
      twitter: '',
      facebook: '',
      instagram: ''
    },
    description: '',
    notes: '',
    assignedTo: user?.id || ''
  });

  // Load companies
  const loadCompanies = useCallback(async () => {
    try {
      setLoading(true);
      console.log('=== LOADING COMPANIES ===');
      
      // Check authentication
      const token = localStorage.getItem('token');
      console.log('Auth token exists:', !!token);
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('Token payload:', payload);
          console.log('User role:', payload.role);
        } catch (e) {
          console.error('Error parsing token:', e);
        }
      }
      
      console.log('Current page:', page);
      console.log('Search:', search);
      console.log('Filters:', filters);
      
      // Ensure we don't request pages beyond what exists
      const requestedPage = Math.max(1, page + 1); // Convert 0-based to 1-based, minimum 1
      
      const params = {
        page: requestedPage,
        limit: 12,
        search,
        ...filters
      };

      console.log('API params:', params);
      console.log('Requested page:', requestedPage, '(0-based page:', page, ')');
      const response = await crmService.getCompanies(params);
      console.log('Companies response:', response);

      if (response.data.success) {
        const companies = response.data.data.companies || [];
        const pagination = response.data.data.pagination || {};
        
        // Debug pagination
        console.log('Backend pagination:', pagination);
        console.log('Current page state:', page);
        console.log('Companies found:', companies.length);
        
        // Handle empty page scenarios
        if (companies.length === 0) {
          if (page > 0) {
            // If we're not on page 0 and no companies found, go back to page 0
            console.log('No companies found on page', page, '- resetting to page 0');
            setPage(0);
            return; // This will trigger a re-fetch with page 0
          } else {
            // We're on page 0 and no companies - this is valid (empty database)
            console.log('No companies found on page 0 - database is empty');
          }
        }
        
        // Update current page to match backend response (convert from 1-based to 0-based)
        const currentPage = (pagination.currentPage || 1) - 1;
        console.log('Calculated current page:', currentPage);
        
        // Only update page if there's a significant difference to avoid infinite loops
        if (Math.abs(currentPage - page) > 0) {
          console.log('Updating page from', page, 'to', currentPage);
          setPage(currentPage);
        }
        
        setCompanies(companies);
        setTotalPages(pagination.totalPages || 0);
        setTotalItems(pagination.totalItems || 0);
      }
    } catch (err) {
      console.error('Error loading companies:', err);
      console.error('Error status:', err.response?.status);
      console.error('Error message:', err.response?.data?.message);
      console.error('Error details:', err.response?.data);
      
      if (err.response?.status === 401) {
        setError('Authentication failed. Please log in again.');
      } else if (err.response?.status === 403) {
        setError('Access denied. You don\'t have permission to view companies.');
      } else {
        setError(err.response?.data?.message || 'Failed to load companies. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, filters, user]);

  // Load companies on mount and when dependencies change
  useEffect(() => {
    let isMounted = true;
    
    const fetchCompanies = async () => {
      if (isMounted) {
        await loadCompanies();
      }
    };
    
    fetchCompanies();
    
    // Cleanup function to prevent memory leaks
    return () => {
      isMounted = false;
    };
  }, [loadCompanies]);

  // Handle search with debounce
  const handleSearch = (event) => {
    const value = event.target.value;
    setSearch(value);
    setPage(0);
  };

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  };

  // Handle form field changes
  const handleFormChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  // Open add company dialog
  const handleAddCompany = () => {
    setFormData({
      name: '',
      website: '',
      phone: '',
      email: '',
      industry: '',
      type: 'Prospect',
      status: 'Prospect',
      size: '1-10',
      annualRevenue: 'Less than ₨100M',
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'United States'
      },
      foundedYear: '',
      taxId: '',
      registrationNumber: '',
      socialMedia: {
        linkedin: '',
        twitter: '',
        facebook: '',
        instagram: ''
      },
      description: '',
      notes: '',
      assignedTo: user?.id || ''
    });
    setCompanyDialog({ open: true, mode: 'add', company: null });
  };

  // Open edit company dialog
  const handleEditCompany = (company) => {
    console.log('=== EDITING COMPANY ===');
    console.log('Company to edit:', company);
    
    setFormData({
      name: company.name || '',
      website: company.website || '',
      phone: company.phone || '',
      email: company.email || '',
      industry: company.industry || '',
      type: company.type || 'Prospect',
      status: company.status || 'Prospect',
      size: company.size || '1-10',
      annualRevenue: formatRevenueDisplay(company.annualRevenue) || 'Less than ₨100M',
      address: {
        street: company.address?.street || '',
        city: company.address?.city || '',
        state: company.address?.state || '',
        zipCode: company.address?.zipCode || '',
        country: company.address?.country || 'United States'
      },
      foundedYear: company.foundedYear || '',
      taxId: company.taxId || '',
      registrationNumber: company.registrationNumber || '',
      socialMedia: {
        linkedin: company.socialMedia?.linkedin || '',
        twitter: company.socialMedia?.twitter || '',
        facebook: company.socialMedia?.facebook || '',
        instagram: company.socialMedia?.instagram || ''
      },
      description: company.description || '',
      notes: company.notes || '',
      assignedTo: company.assignedTo?._id || user?.id || ''
    });
    setCompanyDialog({ open: true, mode: 'edit', company });
  };

  // Save company
  const handleSaveCompany = async () => {
    try {
      console.log('=== SAVING COMPANY ===');
      console.log('Form data:', formData);
      
      // Frontend validation
      if (!formData.name || !formData.name.trim()) {
        setError('Company name is required');
        return;
      }
      
      if (!formData.industry || !formData.industry.trim()) {
        setError('Industry is required');
        return;
      }
      
      // Check authentication
      const token = localStorage.getItem('token');
      console.log('Auth token exists:', !!token);
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('Token payload:', payload);
          console.log('User role:', payload.role);
        } catch (e) {
          console.error('Error parsing token:', e);
        }
      }
      
      const companyData = {
        ...formData,
        foundedYear: formData.foundedYear ? parseInt(formData.foundedYear) : undefined
      };

      console.log('Company data to send:', companyData);
      console.log('Required fields check:');
      console.log('- name:', companyData.name);
      console.log('- industry:', companyData.industry);
      console.log('- type:', companyData.type);
      console.log('- size:', companyData.size);

      if (companyDialog.mode === 'add') {
        console.log('Creating new company...');
        const response = await crmService.createCompany(companyData);
        console.log('Create company response:', response);
        setSuccess('Company added successfully!');
      } else {
        console.log('Updating existing company...');
        const response = await crmService.updateCompany(companyDialog.company._id, companyData);
        console.log('Update company response:', response);
        setSuccess('Company updated successfully!');
      }

      setCompanyDialog({ open: false, mode: 'add', company: null });
      setPage(0);
      setSearch('');
      setFilters({ industry: '', type: '', status: '', size: '', assignedTo: '' });
      await loadCompanies();
    } catch (err) {
      console.error('Error saving company:', err);
      console.error('Error details:', err.response?.data);
      console.error('Error status:', err.response?.status);
      console.error('Error message:', err.response?.data?.message);
      console.error('Error headers:', err.response?.headers);
      setError(err.response?.data?.message || 'Failed to save company. Please try again.');
    }
  };

  // Delete company
  const handleDeleteCompany = async () => {
    try {
      console.log('=== DELETING COMPANY ===');
      console.log('Company ID:', deleteDialog.company._id);
      
      const response = await crmService.deleteCompany(deleteDialog.company._id);
      console.log('Delete response:', response);
      
      setDeleteDialog({ open: false, company: null });
      setSuccess('Company deleted successfully!');
      setError(null);
      await loadCompanies();
    } catch (err) {
      console.error('Error deleting company:', err);
      console.error('Error details:', err.response?.data);
      setError('Failed to delete company. Please try again.');
      setSuccess(null);
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Inactive': return 'error';
      case 'Lead': return 'info';
      case 'Prospect': return 'warning';
      case 'Customer': return 'success';
      case 'Former Customer': return 'error';
      default: return 'default';
    }
  };

  // Get type color
  const getTypeColor = (type) => {
    switch (type) {
      case 'Customer': return 'success';
      case 'Prospect': return 'warning';
      case 'Partner': return 'info';
      case 'Vendor': return 'secondary';
      case 'Competitor': return 'error';
      case 'Other': return 'default';
      default: return 'default';
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return '₨0';
    return formatPKR(amount);
  };

  // Convert old USD revenue values to PKR format for display
  const formatRevenueDisplay = (revenue) => {
    if (!revenue) return 'Less than ₨100M';
    
    // Convert old USD values to PKR equivalents
    const usdToPkrMap = {
      'Less than $1M': 'Less than ₨100M',
      '$1M - $10M': '₨100M - ₨1B',
      '$10M - $50M': '₨1B - ₨5B',
      '$50M - $100M': '₨5B - ₨10B',
      '$100M+': '₨10B+'
    };
    
    return usdToPkrMap[revenue] || revenue;
  };

  // Company card component
  const CompanyCard = ({ company }) => (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box display="flex" alignItems="center">
            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
              <BusinessIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="h3" noWrap>
                {company.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {company.industry || 'No Industry'}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small">
            <MoreIcon />
          </IconButton>
        </Box>

        <Box mb={2}>
          <Chip 
            label={company.status} 
            size="small" 
            color={getStatusColor(company.status)}
            sx={{ mr: 1 }}
          />
          <Chip 
            label={company.type} 
            size="small" 
            color={getTypeColor(company.type)}
          />
        </Box>

        {company.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {company.description}
          </Typography>
        )}

        <Box mb={2}>
          {company.email && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <EmailIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
              {company.email}
            </Typography>
          )}
          {company.phone && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <PhoneIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
              {company.phone}
            </Typography>
          )}
          {company.website && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <WebsiteIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
              {company.website}
            </Typography>
          )}
          {company.address?.city && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <LocationIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
              {company.address.city}, {company.address.state}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <PeopleIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            {company.size} employees
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <MoneyIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            {formatRevenueDisplay(company.annualRevenue)}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Assigned to: {company.assignedTo?.firstName} {company.assignedTo?.lastName}
          </Typography>
          <Box>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => handleEditCompany(company)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => setDeleteDialog({ open: true, company })}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Loading skeleton
  if (loading && companies.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Companies
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
          Companies
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
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddCompany}
          >
            Add Company
          </Button>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search companies..."
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
                  <InputLabel>Industry</InputLabel>
                  <Select
                    value={filters.industry}
                    onChange={(e) => handleFilterChange('industry', e.target.value)}
                    label="Industry"
                  >
                    <MenuItem value="">All Industries</MenuItem>
                    <MenuItem value="Technology">Technology</MenuItem>
                    <MenuItem value="Healthcare">Healthcare</MenuItem>
                    <MenuItem value="Finance">Finance</MenuItem>
                    <MenuItem value="Manufacturing">Manufacturing</MenuItem>
                    <MenuItem value="Retail">Retail</MenuItem>
                    <MenuItem value="Education">Education</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={filters.type}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    label="Type"
                  >
                    <MenuItem value="">All Types</MenuItem>
                    <MenuItem value="Customer">Customer</MenuItem>
                    <MenuItem value="Prospect">Prospect</MenuItem>
                    <MenuItem value="Partner">Partner</MenuItem>
                    <MenuItem value="Vendor">Vendor</MenuItem>
                    <MenuItem value="Competitor">Competitor</MenuItem>
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
                    <MenuItem value="">All Statuses</MenuItem>
                    <MenuItem value="Active">Active</MenuItem>
                    <MenuItem value="Inactive">Inactive</MenuItem>
                    <MenuItem value="Lead">Lead</MenuItem>
                    <MenuItem value="Prospect">Prospect</MenuItem>
                    <MenuItem value="Customer">Customer</MenuItem>
                    <MenuItem value="Former Customer">Former Customer</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Size</InputLabel>
                  <Select
                    value={filters.size}
                    onChange={(e) => handleFilterChange('size', e.target.value)}
                    label="Size"
                  >
                    <MenuItem value="">All Sizes</MenuItem>
                    <MenuItem value="1-10">1-10</MenuItem>
                    <MenuItem value="11-50">11-50</MenuItem>
                    <MenuItem value="51-200">51-200</MenuItem>
                    <MenuItem value="201-500">201-500</MenuItem>
                    <MenuItem value="501-1000">501-1000</MenuItem>
                    <MenuItem value="1000+">1000+</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setFilters({ industry: '', type: '', status: '', size: '', assignedTo: '' });
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

      {/* Companies Grid */}
      {companies.length > 0 ? (
        <Grid container spacing={3}>
          {companies.map((company) => (
            <Grid item xs={12} sm={6} md={4} key={company._id}>
              <CompanyCard company={company} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <BusinessIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No companies found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {search || Object.values(filters).some(f => f) 
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first company'
            }
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddCompany}
          >
            Add Company
          </Button>
        </Paper>
      )}

      {/* Add/Edit Company Dialog */}
      <Dialog
        open={companyDialog.open}
        onClose={() => setCompanyDialog({ open: false, mode: 'add', company: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {companyDialog.mode === 'add' ? 'Add New Company' : 'Edit Company'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Company Name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Website"
                value={formData.website}
                onChange={(e) => handleFormChange('website', e.target.value)}
                placeholder="https://example.com"
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
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleFormChange('email', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Industry"
                value={formData.industry}
                onChange={(e) => handleFormChange('industry', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => handleFormChange('type', e.target.value)}
                  label="Type"
                >
                  <MenuItem value="Customer">Customer</MenuItem>
                  <MenuItem value="Prospect">Prospect</MenuItem>
                  <MenuItem value="Partner">Partner</MenuItem>
                  <MenuItem value="Vendor">Vendor</MenuItem>
                  <MenuItem value="Competitor">Competitor</MenuItem>
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
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                  <MenuItem value="Lead">Lead</MenuItem>
                  <MenuItem value="Prospect">Prospect</MenuItem>
                  <MenuItem value="Customer">Customer</MenuItem>
                  <MenuItem value="Former Customer">Former Customer</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Company Size</InputLabel>
                <Select
                  value={formData.size}
                  onChange={(e) => handleFormChange('size', e.target.value)}
                  label="Company Size"
                >
                  <MenuItem value="1-10">1-10</MenuItem>
                  <MenuItem value="11-50">11-50</MenuItem>
                  <MenuItem value="51-200">51-200</MenuItem>
                  <MenuItem value="201-500">201-500</MenuItem>
                  <MenuItem value="501-1000">501-1000</MenuItem>
                  <MenuItem value="1000+">1000+</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Annual Revenue</InputLabel>
                <Select
                  value={formData.annualRevenue}
                  onChange={(e) => handleFormChange('annualRevenue', e.target.value)}
                  label="Annual Revenue"
                >
                  <MenuItem value="Less than ₨100M">Less than ₨100M</MenuItem>
                  <MenuItem value="₨100M - ₨1B">₨100M - ₨1B</MenuItem>
                  <MenuItem value="₨1B - ₨5B">₨1B - ₨5B</MenuItem>
                  <MenuItem value="₨5B - ₨10B">₨5B - ₨10B</MenuItem>
                  <MenuItem value="₨10B+">₨10B+</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Founded Year"
                type="number"
                value={formData.foundedYear}
                onChange={(e) => handleFormChange('foundedYear', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Tax ID"
                value={formData.taxId}
                onChange={(e) => handleFormChange('taxId', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Address
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Street Address"
                value={formData.address.street}
                onChange={(e) => handleFormChange('address.street', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="City"
                value={formData.address.city}
                onChange={(e) => handleFormChange('address.city', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="State/Province"
                value={formData.address.state}
                onChange={(e) => handleFormChange('address.state', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="ZIP/Postal Code"
                value={formData.address.zipCode}
                onChange={(e) => handleFormChange('address.zipCode', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Country"
                value={formData.address.country}
                onChange={(e) => handleFormChange('address.country', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Social Media
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="LinkedIn"
                value={formData.socialMedia.linkedin}
                onChange={(e) => handleFormChange('socialMedia.linkedin', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Twitter"
                value={formData.socialMedia.twitter}
                onChange={(e) => handleFormChange('socialMedia.twitter', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Facebook"
                value={formData.socialMedia.facebook}
                onChange={(e) => handleFormChange('socialMedia.facebook', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Instagram"
                value={formData.socialMedia.instagram}
                onChange={(e) => handleFormChange('socialMedia.instagram', e.target.value)}
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
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={formData.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompanyDialog({ open: false, mode: 'add', company: null })}>
            Cancel
          </Button>
          <Button onClick={handleSaveCompany} variant="contained">
            {companyDialog.mode === 'add' ? 'Add Company' : 'Update Company'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, company: null })}
      >
        <DialogTitle>Delete Company</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deleteDialog.company?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, company: null })}>
            Cancel
          </Button>
          <Button onClick={handleDeleteCompany} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleAddCompany}
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

export default Companies; 