import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  TextField,
  Chip,
  InputAdornment,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert,
  Tooltip,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Business as BusinessIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Block as BlockIcon,
  CheckCircle as ActivateIcon
} from '@mui/icons-material';
import api from '../../services/authService';
import { formatDate } from '../../utils/dateUtils';

const COMPANY_TYPES = [
  'Private Limited',
  'Public Limited',
  'Partnership',
  'Sole Proprietorship',
  'Government',
  'NGO',
  'Other'
];

const emptyForm = () => ({
  name: '',
  type: 'Private Limited',
  industry: '',
  website: '',
  description: '',
  notes: '',
  establishedDate: '',
  isActive: true,
  contactInfo: {
    phone: '',
    email: '',
    address: ''
  }
});

const toFormData = (company) => ({
  name: company?.name || '',
  type: company?.type || 'Private Limited',
  industry: company?.industry || '',
  website: company?.website || '',
  description: company?.description || '',
  notes: company?.notes || '',
  establishedDate: company?.establishedDate
    ? String(company.establishedDate).slice(0, 10)
    : '',
  isActive: company?.isActive !== false,
  contactInfo: {
    phone: company?.contactInfo?.phone || '',
    email: company?.contactInfo?.email || '',
    address: company?.contactInfo?.address || ''
  }
});

const buildPayload = (formData) => {
  const payload = {
    name: formData.name.trim(),
    type: formData.type,
    industry: formData.industry.trim() || undefined,
    website: formData.website.trim() || undefined,
    description: formData.description.trim() || undefined,
    notes: formData.notes.trim() || undefined,
    isActive: Boolean(formData.isActive),
    contactInfo: {
      phone: formData.contactInfo.phone.trim() || undefined,
      email: formData.contactInfo.email.trim() || undefined,
      address: formData.contactInfo.address.trim() || undefined
    }
  };
  if (formData.establishedDate) {
    payload.establishedDate = formData.establishedDate;
  }
  return payload;
};

const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const params = { status: statusFilter };
      if (search.trim()) params.search = search.trim();
      const response = await api.get('/hr/companies', { params });
      setCompanies(response.data?.data || []);
    } catch (error) {
      setCompanies([]);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to load companies',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchCompanies();
    }, search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [fetchCompanies, search]);

  const paginatedCompanies = useMemo(
    () => companies.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [companies, page, rowsPerPage]
  );

  const handleOpenCreate = () => {
    setEditingCompany(null);
    setFormData(emptyForm());
    setDialogOpen(true);
  };

  const handleOpenEdit = (company) => {
    setEditingCompany(company);
    setFormData(toFormData(company));
    setDialogOpen(true);
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleContactChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      contactInfo: { ...prev.contactInfo, [field]: value }
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setSnackbar({ open: true, message: 'Company name is required', severity: 'warning' });
      return;
    }

    try {
      setSaving(true);
      const payload = buildPayload(formData);
      if (editingCompany?._id) {
        await api.put(`/hr/companies/${editingCompany._id}`, payload);
        setSnackbar({ open: true, message: 'Company updated successfully', severity: 'success' });
      } else {
        await api.post('/hr/companies', payload);
        setSnackbar({ open: true, message: 'Company created successfully', severity: 'success' });
      }
      setDialogOpen(false);
      fetchCompanies();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to save company',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSetActive = async (company, isActive) => {
    const action = isActive ? 'activate' : 'deactivate';
    const label = company.name || 'this company';
    if (!window.confirm(`${isActive ? 'Activate' : 'Deactivate'} ${label}?`)) return;

    try {
      if (isActive) {
        await api.put(`/hr/companies/${company._id}`, { isActive: true });
      } else {
        await api.delete(`/hr/companies/${company._id}`);
      }
      setSnackbar({
        open: true,
        message: `Company ${isActive ? 'activated' : 'deactivated'} successfully`,
        severity: 'success'
      });
      fetchCompanies();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || `Failed to ${action} company`,
        severity: 'error'
      });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BusinessIcon color="primary" />
          <Box>
            <Typography variant="h4">Companies</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage companies registered in the HR module
            </Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
          Add Company
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by company name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="active">Active only</MenuItem>
                <MenuItem value="inactive">Inactive only</MenuItem>
                <MenuItem value="all">All companies</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Company Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Industry</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Established</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Loading companies...
                </TableCell>
              </TableRow>
            ) : companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No companies found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedCompanies.map((company) => (
                <TableRow key={company._id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{company.name || '—'}</Typography>
                    {company.description && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {company.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{company.type || '—'}</TableCell>
                  <TableCell>{company.industry || '—'}</TableCell>
                  <TableCell>{company.contactInfo?.phone || '—'}</TableCell>
                  <TableCell>{company.contactInfo?.email || '—'}</TableCell>
                  <TableCell>
                    {company.establishedDate ? formatDate(company.establishedDate) : '—'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={company.isActive === false ? 'Inactive' : 'Active'}
                      size="small"
                      color={company.isActive === false ? 'default' : 'success'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleOpenEdit(company)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {company.isActive === false ? (
                      <Tooltip title="Activate">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleSetActive(company, true)}
                        >
                          <ActivateIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Deactivate">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleSetActive(company, false)}
                        >
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={companies.length}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(parseInt(event.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 25, 50]}
      />

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingCompany ? 'Edit Company' : 'Add Company'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Company Name"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Company Type</InputLabel>
                  <Select
                    label="Company Type"
                    value={formData.type}
                    onChange={(e) => handleFormChange('type', e.target.value)}
                  >
                    {COMPANY_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>{type}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Industry"
                  value={formData.industry}
                  onChange={(e) => handleFormChange('industry', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Website"
                  value={formData.website}
                  onChange={(e) => handleFormChange('website', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Established Date"
                  value={formData.establishedDate}
                  onChange={(e) => handleFormChange('establishedDate', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Description"
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Notes"
                  value={formData.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Contact Information</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={formData.contactInfo.phone}
                  onChange={(e) => handleContactChange('phone', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.contactInfo.email}
                  onChange={(e) => handleContactChange('email', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Address"
                  value={formData.contactInfo.address}
                  onChange={(e) => handleContactChange('address', e.target.value)}
                />
              </Grid>

              {editingCompany && (
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.isActive}
                        onChange={(e) => handleFormChange('isActive', e.target.checked)}
                      />
                    }
                    label={formData.isActive ? 'Active' : 'Inactive'}
                  />
                </Grid>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editingCompany ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Companies;
