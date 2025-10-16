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
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  MoreVert as MoreIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import crmService from '../../services/crmService';
import api from '../../services/api';
import { PageLoading, CardsSkeleton } from '../../components/LoadingSpinner';

const Contacts = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  // State management
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  
  // Filters and search
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    company: '',
    assignedTo: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Dialog states
  const [contactDialog, setContactDialog] = useState({
    open: false,
    mode: 'add', // 'add' or 'edit'
    contact: null
  });
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    contact: null
  });
  
  // Form data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    mobile: '',
    jobTitle: '',
    department: '',
    company: '',
    type: 'Customer',
    status: 'Active',
    preferredContactMethod: 'Email',
    doNotContact: false,
    marketingOptIn: true,
    notes: ''
  });

  // Load contacts data
  const loadContacts = useCallback(async () => {
    try {
      
      setLoading(true);
      setError(null);
      
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search,
        ...filters
      };
      
      // Add cache busting to URL directly
      const url = `/crm/contacts?_t=${Date.now()}`;

      
      if (!token || !user) {
        setError('Please log in to view contacts');
        setContacts([]);
        setTotalItems(0);
        setTotalPages(0);
        return;
      }
      
      const response = await api.get(url, { 
        params,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      // API response structure identified: {success: true, data: {contacts: [], pagination: {}}}
      
              if (response && response.data && response.data.data) {
          const contactsArray = response.data.data.contacts || [];
          const totalItems = response.data.data.pagination?.totalItems || 0;
          const totalPages = response.data.data.pagination?.totalPages || 0;
          
          
          setContacts(contactsArray);
          setTotalItems(totalItems);
          setTotalPages(totalPages);
        } else {
          setContacts([]);
          setTotalItems(0);
          setTotalPages(0);
        }
    } catch (err) {
      setError('Failed to load contacts. Please try again.');
      setContacts([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, filters, user, token]);

  // Load departments
  const loadDepartments = useCallback(async () => {
    try {
      const response = await crmService.getDepartments();
      const departmentsData = response.data?.data || response.data || [];
      setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
    } catch (err) {
      setDepartments([]);
    }
  }, []);

  // Load companies
  const loadCompanies = useCallback(async () => {
    try {
      const response = await crmService.getCompanies({ page: 1, limit: 1000 });
      const companiesData = response.data?.data?.companies || response.data?.companies || response.data || [];
      setCompanies(Array.isArray(companiesData) ? companiesData : []);
    } catch (err) {
      setCompanies([]);
    }
  }, []);

  useEffect(() => {
    
    loadContacts();
    loadDepartments();
    loadCompanies();
  }, [loadContacts, loadDepartments, loadCompanies, user, token]);

  useEffect(() => {
  }, [contacts]);

  // Handle pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle search
  const handleSearch = (event) => {
    setSearch(event.target.value);
    setPage(0);
  };

  // Handle filters
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPage(0);
  };

  // Handle form data changes
  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Open add contact dialog
  const handleAddContact = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      mobile: '',
      jobTitle: '',
      department: '',
      company: '',
      type: 'Customer',
      status: 'Active',
      preferredContactMethod: 'Email',
      doNotContact: false,
      marketingOptIn: true,
      notes: ''
    });
    setContactDialog({ open: true, mode: 'add', contact: null });
  };

  // Open edit contact dialog
  const handleEditContact = (contact) => {
    
    setFormData({
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      email: contact.email || '',
      phone: contact.phone || '',
      mobile: contact.mobile || '',
      jobTitle: contact.jobTitle || '',
      department: contact.department?._id || '',
      company: contact.company?._id || '',
      type: contact.type || 'Customer',
      status: contact.status || 'Active',
      preferredContactMethod: contact.preferredContactMethod || 'Email',
      doNotContact: contact.doNotContact || false,
      marketingOptIn: contact.marketingOptIn || true,
      notes: contact.notes || ''
    });
    setContactDialog({ open: true, mode: 'edit', contact });
  };

  // Save contact
  const handleSaveContact = async () => {
    try {
      
      const contactData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        mobile: formData.mobile,
        jobTitle: formData.jobTitle,
        department: formData.department,
        company: formData.company,
        type: formData.type,
        status: formData.status,
        preferredContactMethod: formData.preferredContactMethod,
        doNotContact: Boolean(formData.doNotContact),
        marketingOptIn: Boolean(formData.marketingOptIn),
        notes: formData.notes
      };


      if (contactDialog.mode === 'add') {
        const response = await crmService.createContact(contactData);
        setSuccess('Contact added successfully!');
      } else {
        const response = await crmService.updateContact(contactDialog.contact._id, contactData);
        setSuccess('Contact updated successfully!');
      }

      setContactDialog({ open: false, mode: 'add', contact: null });
      // Reset to first page and force immediate refresh
      setPage(0);
      setSearch(''); // Clear any search filters
      setFilters({ type: '', status: '', company: '', assignedTo: '' }); // Clear filters
      await loadContacts();
    } catch (err) {
      setError('Failed to save contact. Please try again.');
    }
  };

  // Delete contact
  const handleDeleteContact = async () => {
    try {
      
      const response = await crmService.deleteContact(deleteDialog.contact._id);
      
      setDeleteDialog({ open: false, contact: null });
      setSuccess('Contact deleted successfully!');
      setError(null); // Clear any previous errors
      await loadContacts();
    } catch (err) {
      setError('Failed to delete contact. Please try again.');
      setSuccess(null);
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Inactive': return 'error';
      case 'Lead': return 'warning';
      case 'Prospect': return 'info';
      default: return 'default';
    }
  };

  // Get type color
  const getTypeColor = (type) => {
    switch (type) {
      case 'Customer': return 'primary';
      case 'Prospect': return 'warning';
      case 'Partner': return 'success';
      case 'Vendor': return 'info';
      case 'Other': return 'default';
      default: return 'default';
    }
  };

  // Get lead status color
  const getLeadStatusColor = (status) => {
    switch (status) {
      case 'New': return 'info';
      case 'Contacted': return 'primary';
      case 'Qualified': return 'success';
      case 'Proposal': return 'warning';
      case 'Negotiation': return 'secondary';
      case 'Won': return 'success';
      case 'Lost': return 'error';
      case 'On Hold': return 'default';
      default: return 'default';
    }
  };

  // Contact card component
  const ContactCard = ({ contact }) => (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box display="flex" alignItems="center">
            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
              {contact.firstName?.charAt(0)}{contact.lastName?.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="h6" component="h3">
                {contact.firstName} {contact.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {contact.jobTitle}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small">
            <MoreIcon />
          </IconButton>
        </Box>

        <Box mb={2}>
          <Chip 
            label={contact.type} 
            size="small" 
            color={getTypeColor(contact.type)}
            sx={{ mr: 1 }}
          />
          <Chip 
            label={contact.status} 
            size="small" 
            color={getStatusColor(contact.status)}
            sx={{ mr: 1 }}
          />
          {contact.leadId && (
            <Chip 
              label={`Lead: ${contact.leadId.status}`}
              size="small" 
              color={getLeadStatusColor(contact.leadId.status)}
              variant="outlined"
            />
          )}
        </Box>

        <Box mb={2}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <BusinessIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            {contact.company?.name || 'No Company'}
          </Typography>
          {contact.email && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <EmailIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
              {contact.email}
            </Typography>
          )}
          {contact.phone && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <PhoneIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
              {contact.phone}
            </Typography>
          )}
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Created: {new Date(contact.createdAt).toLocaleDateString()}
          </Typography>
          <Box>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => handleEditContact(contact)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => setDeleteDialog({ open: true, contact })}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Loading skeleton
  if (loading && contacts.length === 0) {
    return (
      <PageLoading 
        message="Loading contacts..." 
        showSkeleton={true}
        skeletonType="cards"
      />
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
          Contacts
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
            onClick={loadContacts}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddContact}
          >
            Add Contact
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
              placeholder="Search contacts..."
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
                <FormControl fullWidth size="small">
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
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="">All Status</MenuItem>
                    <MenuItem value="Active">Active</MenuItem>
                    <MenuItem value="Inactive">Inactive</MenuItem>
                    <MenuItem value="Lead">Lead</MenuItem>
                    <MenuItem value="Prospect">Prospect</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Company"
                  value={filters.company}
                  onChange={(e) => handleFilterChange('company', e.target.value)}
                />
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      {/* Contacts Grid */}
      <Grid container spacing={3}>
        {contacts && contacts.length > 0 ? (
          contacts.map((contact) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={contact._id}>
              <ContactCard contact={contact} />
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Box 
              display="flex" 
              justifyContent="center" 
              alignItems="center" 
              minHeight="200px"
              flexDirection="column"
            >
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No contacts found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {loading ? 'Loading contacts...' : 'Try adjusting your search or filters'}
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>

      {/* Pagination */}
      {totalItems > 0 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Box>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Showing {page * rowsPerPage + 1} to {Math.min((page + 1) * rowsPerPage, totalItems)} of {totalItems} contacts
            </Typography>
            <Box display="flex" justifyContent="center" mt={1}>
              <Button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                sx={{ mr: 1 }}
              >
                Previous
              </Button>
              <Button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Add/Edit Contact Dialog */}
      <Dialog 
        open={contactDialog.open} 
        onClose={() => setContactDialog({ open: false, mode: 'add', contact: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {contactDialog.mode === 'add' ? 'Add New Contact' : 'Edit Contact'}
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
                label="Mobile"
                value={formData.mobile}
                onChange={(e) => handleFormChange('mobile', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Job Title"
                value={formData.jobTitle}
                onChange={(e) => handleFormChange('jobTitle', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  value={formData.department}
                  onChange={(e) => handleFormChange('department', e.target.value)}
                  label="Department"
                >
                  <MenuItem value="">None</MenuItem>
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
                <InputLabel>Company</InputLabel>
                <Select
                  value={formData.company}
                  onChange={(e) => handleFormChange('company', e.target.value)}
                  label="Company"
                >
                  <MenuItem value="">None</MenuItem>
                  {!companies || companies.length === 0 ? (
                    <MenuItem disabled>Loading companies...</MenuItem>
                  ) : (
                    companies.map((company) => (
                      <MenuItem key={company._id} value={company._id}>
                        {company.name}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
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
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Preferred Contact Method</InputLabel>
                <Select
                  value={formData.preferredContactMethod}
                  onChange={(e) => handleFormChange('preferredContactMethod', e.target.value)}
                  label="Preferred Contact Method"
                >
                  <MenuItem value="Email">Email</MenuItem>
                  <MenuItem value="Phone">Phone</MenuItem>
                  <MenuItem value="Mobile">Mobile</MenuItem>
                  <MenuItem value="Mail">Mail</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.doNotContact}
                    onChange={(e) => handleFormChange('doNotContact', e.target.checked)}
                  />
                }
                label="Do Not Contact"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.marketingOptIn}
                    onChange={(e) => handleFormChange('marketingOptIn', e.target.checked)}
                  />
                }
                label="Marketing Opt-in"
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
          <Button onClick={() => setContactDialog({ open: false, mode: 'add', contact: null })}>
            Cancel
          </Button>
          <Button onClick={handleSaveContact} variant="contained">
            {contactDialog.mode === 'add' ? 'Add Contact' : 'Update Contact'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, contact: null })}
      >
        <DialogTitle>Delete Contact</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {deleteDialog.contact?.firstName} {deleteDialog.contact?.lastName}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, contact: null })}>
            Cancel
          </Button>
          <Button onClick={handleDeleteContact} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleAddContact}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default Contacts; 