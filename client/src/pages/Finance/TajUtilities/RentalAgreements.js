import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Stack,
  Autocomplete,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { fetchResidents } from '../../../services/tajResidentsService';
import { fetchProperties } from '../../../services/tajPropertiesService';

const defaultForm = {
  agreementNumber: '',
  propertyName: '',
  propertyAddress: '',
  tenantName: '',
  tenantContact: '',
  tenantIdCard: '',
  monthlyRent: '',
  securityDeposit: '',
  annualRentIncreaseType: 'percentage',
  annualRentIncreaseValue: '',
  startDate: dayjs().format('YYYY-MM-DD'),
  endDate: dayjs().add(1, 'year').format('YYYY-MM-DD'),
  terms: '',
  status: 'Active'
};

const statusOptions = ['Active', 'Expired', 'Terminated'];

const RentalAgreements = () => {
  const navigate = useNavigate();
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(defaultForm);
  const [editingAgreement, setEditingAgreement] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [residents, setResidents] = useState([]);
  const [residentsLoading, setResidentsLoading] = useState(false);
  const [properties, setProperties] = useState([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [selectedResident, setSelectedResident] = useState(null);

  useEffect(() => {
    fetchAgreements();
    fetchResidentsData();
  }, []);

  const fetchResidentsData = async () => {
    try {
      setResidentsLoading(true);
      const response = await fetchResidents({ isActive: 'true' });
      const allResidents = response.data.data || [];
      
      // Deduplicate residents by name to ensure each resident appears only once
      const uniqueResidents = [];
      const seenNames = new Set();
      
      allResidents.forEach((resident) => {
        const residentName = resident.name?.trim().toLowerCase();
        if (residentName && !seenNames.has(residentName)) {
          seenNames.add(residentName);
          uniqueResidents.push(resident);
        }
      });
      
      setResidents(uniqueResidents);
    } catch (err) {
      console.error('Failed to load residents:', err);
    } finally {
      setResidentsLoading(false);
    }
  };

  const fetchPropertiesForResident = async (resident) => {
    try {
      setPropertiesLoading(true);
      // Fetch all properties
      const response = await fetchProperties({});
      const allProperties = response.data?.data || [];
      
      // Filter properties assigned to this resident
      if (resident.properties && Array.isArray(resident.properties) && resident.properties.length > 0) {
        const residentPropertyIds = resident.properties.map(p => 
          typeof p === 'object' ? p._id || p : p
        );
        const filteredProperties = allProperties.filter(property => 
          residentPropertyIds.includes(property._id)
        );
        setProperties(filteredProperties);
      } else {
        // If resident has no properties assigned, show empty list
        setProperties([]);
      }
    } catch (err) {
      console.error('Failed to load properties:', err);
      setProperties([]);
    } finally {
      setPropertiesLoading(false);
    }
  };

  const fetchAgreements = async () => {
    try {
      const response = await api.get('/taj-rental-agreements');
      setAgreements(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load rental agreements');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = async (agreement) => {
    if (agreement) {
      setEditingAgreement(agreement);
      const tenantName = agreement.tenantName || agreement.landlordName || '';
      setFormData({
        agreementNumber: agreement.agreementNumber,
        propertyName: agreement.propertyName,
        propertyAddress: agreement.propertyAddress,
        tenantName: tenantName,
        tenantContact: agreement.tenantContact || agreement.landlordContact || '',
        tenantIdCard: agreement.tenantIdCard || agreement.landlordIdCard || '',
        monthlyRent: agreement.monthlyRent,
        securityDeposit: agreement.securityDeposit || '',
        annualRentIncreaseType: agreement.annualRentIncreaseType || 'percentage',
        annualRentIncreaseValue: agreement.annualRentIncreaseValue || '',
        startDate: agreement.startDate ? dayjs(agreement.startDate).format('YYYY-MM-DD') : '',
        endDate: agreement.endDate ? dayjs(agreement.endDate).format('YYYY-MM-DD') : '',
        terms: agreement.terms || '',
        status: agreement.status || 'Active'
      });
      
      // If tenant name exists, find the resident and load their properties
      // Wait a bit to ensure residents are loaded
      if (tenantName && residents.length > 0) {
        const matchingResident = residents.find(r => r.name === tenantName);
        if (matchingResident) {
          setSelectedResident(matchingResident);
          await fetchPropertiesForResident(matchingResident);
        } else {
          setSelectedResident(null);
          setProperties([]);
        }
      } else {
        setSelectedResident(null);
        setProperties([]);
      }
    } else {
      setEditingAgreement(null);
      setFormData(defaultForm);
      setSelectedResident(null);
      setProperties([]);
    }
    setSelectedFile(null);
    setDialogOpen(true);
    setError('');
    setSuccess('');
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAgreement(null);
    setFormData(defaultForm);
    setSelectedFile(null);
    setSelectedResident(null);
    setProperties([]);
    setError('');
    setSuccess('');
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const calculateIncreasedRent = () => {
    const monthlyRent = Number(formData.monthlyRent) || 0;
    const increaseValue = Number(formData.annualRentIncreaseValue) || 0;
    
    if (monthlyRent > 0 && increaseValue > 0) {
      if (formData.annualRentIncreaseType === 'percentage') {
        return Math.round(monthlyRent * (1 + increaseValue / 100));
      } else {
        return monthlyRent + increaseValue;
      }
    }
    return monthlyRent;
  };

  const buildPayload = () => {
    const payload = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      payload.append(key, value ?? '');
    });
    if (selectedFile) {
      payload.append('agreementImage', selectedFile);
    }
    return payload;
  };

  const handleSave = async () => {
    try {
      const payload = buildPayload();
      if (editingAgreement) {
        await api.put(`/taj-rental-agreements/${editingAgreement._id}`, payload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setSuccess('Agreement updated successfully');
      } else {
        await api.post('/taj-rental-agreements', payload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setSuccess('Agreement created successfully');
      }
      handleCloseDialog();
      fetchAgreements();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save agreement');
    }
  };

  const handleDelete = async (agreementId) => {
    try {
      setDeletingId(agreementId);
      await api.delete(`/taj-rental-agreements/${agreementId}`);
      fetchAgreements();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete agreement');
    } finally {
      setDeletingId(null);
    }
  };

  const summaryStats = useMemo(() => {
    const totalRent = agreements.reduce((sum, agreement) => sum + (agreement.monthlyRent || 0), 0);
    const active = agreements.filter((agreement) => agreement.status === 'Active').length;
    return { totalRent, active, total: agreements.length };
  }, [agreements]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Taj Utilities — Rental Agreements
          </Typography>
          <Typography color="text.secondary">
            Create property agreements before generating rental payments.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          New Agreement
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <StatCard title="Total Agreements" value={summaryStats.total} />
        <StatCard title="Active Agreements" value={summaryStats.active} />
        <StatCard title="Monthly Rent Portfolio" value={`PKR ${summaryStats.totalRent.toLocaleString()}`} />
      </Stack>

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Agreement</TableCell>
                  <TableCell>Property</TableCell>
                  <TableCell>Tenant</TableCell>
                  <TableCell>Rent</TableCell>
                  <TableCell>Timeline</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!loading &&
                  agreements.map((agreement) => (
                    <TableRow key={agreement._id} hover>
                      <TableCell>
                        <Typography fontWeight={600}>{agreement.agreementNumber}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Created {dayjs(agreement.createdAt).format('MMM D, YYYY')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={600}>{agreement.propertyName}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {agreement.propertyAddress}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography>{agreement.tenantName || agreement.landlordName}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {agreement.tenantContact || agreement.landlordContact}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        PKR {Number(agreement.monthlyRent || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {dayjs(agreement.startDate).format('MMM D, YYYY')} -{' '}
                        {dayjs(agreement.endDate).format('MMM D, YYYY')}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={agreement.status}
                          size="small"
                          color={agreement.status === 'Active' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => navigate(`/finance/taj-utilities-charges/rental-agreements/${agreement._id}`)}
                          title="View Details"
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleOpenDialog(agreement)} title="Edit">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={deletingId === agreement._id}
                          onClick={() => handleDelete(agreement._id)}
                          title="Delete"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            {!agreements.length && !loading && (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">No rental agreements yet.</Typography>
              </Box>
            )}
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="md">
        <DialogTitle>{editingAgreement ? 'Update Agreement' : 'New Agreement'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Agreement Number"
                name="agreementNumber"
                value={formData.agreementNumber}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={residents}
                getOptionLabel={(option) => {
                  if (typeof option === 'string') return option;
                  return option.name || '';
                }}
                value={residents.find(r => r.name === formData.tenantName) || null}
                onChange={async (event, newValue) => {
                  if (newValue) {
                    setSelectedResident(newValue);
                    // Auto-fill related fields from resident data
                    setFormData((prev) => ({
                      ...prev,
                      tenantName: newValue.name || '',
                      tenantContact: newValue.contactNumber || prev.tenantContact,
                      tenantIdCard: newValue.cnic || prev.tenantIdCard
                    }));
                    
                    // Load properties for this resident
                    await fetchPropertiesForResident(newValue);
                  } else {
                    setSelectedResident(null);
                    // Clear tenant name and properties if resident is deselected
                    setFormData((prev) => ({
                      ...prev,
                      tenantName: '',
                      propertyName: '',
                      propertyAddress: ''
                    }));
                    setProperties([]);
                  }
                }}
                loading={residentsLoading}
                filterOptions={(options, params) => {
                  const { inputValue } = params;
                  if (!inputValue) return options;
                  
                  const searchTerm = inputValue.toLowerCase();
                  return options.filter((resident) => {
                    const nameMatch = resident.name?.toLowerCase().includes(searchTerm);
                    const contactMatch = resident.contactNumber?.toLowerCase().includes(searchTerm);
                    const cnicMatch = resident.cnic?.toLowerCase().includes(searchTerm);
                    return nameMatch || contactMatch || cnicMatch;
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tenant Name"
                    placeholder="Search by name, contact, or CNIC"
                    required
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {residentsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, resident) => (
                  <Box component="li" {...props} key={resident._id}>
                    <Box>
                      <Typography variant="body1">{resident.name}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        {resident.accountType && resident.accountType !== 'Resident' && (
                          <Chip 
                            label={resident.accountType} 
                            size="small" 
                            variant="outlined"
                            sx={{ height: '20px', fontSize: '0.7rem' }}
                          />
                        )}
                        {resident.contactNumber && (
                          <Typography variant="caption" color="text.secondary">
                            {resident.contactNumber}
                          </Typography>
                        )}
                        {resident.cnic && (
                          <Typography variant="caption" color="text.secondary">
                            CNIC: {resident.cnic}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </Box>
                )}
                isOptionEqualToValue={(option, value) => option._id === value._id}
                noOptionsText={residentsLoading ? 'Loading residents...' : 'No residents found'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Tenant Contact"
                name="tenantContact"
                value={formData.tenantContact}
                onChange={handleInputChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Tenant CNIC"
                name="tenantIdCard"
                value={formData.tenantIdCard}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={properties}
                getOptionLabel={(option) => {
                  if (typeof option === 'string') return option;
                  return option.propertyName || option.plotNumber || option.address || '';
                }}
                value={properties.find(p => p.propertyName === formData.propertyName || p.plotNumber === formData.propertyName) || null}
                onChange={(event, newValue) => {
                  if (newValue) {
                    // Auto-fill related fields from property data
                    setFormData((prev) => ({
                      ...prev,
                      propertyName: newValue.propertyName || newValue.plotNumber || '',
                      propertyAddress: newValue.address || newValue.fullAddress || prev.propertyAddress
                    }));
                  } else {
                    // Clear property fields if property is deselected
                    setFormData((prev) => ({
                      ...prev,
                      propertyName: '',
                      propertyAddress: ''
                    }));
                  }
                }}
                loading={propertiesLoading}
                disabled={!selectedResident || properties.length === 0}
                filterOptions={(options, params) => {
                  const { inputValue } = params;
                  if (!inputValue) return options;
                  
                  const searchTerm = inputValue.toLowerCase();
                  return options.filter((property) => {
                    const nameMatch = property.propertyName?.toLowerCase().includes(searchTerm);
                    const plotMatch = property.plotNumber?.toLowerCase().includes(searchTerm);
                    const addressMatch = property.address?.toLowerCase().includes(searchTerm) || 
                                       property.fullAddress?.toLowerCase().includes(searchTerm);
                    return nameMatch || plotMatch || addressMatch;
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Property Name"
                    placeholder={!selectedResident ? "Select tenant first" : properties.length === 0 ? "No properties found for this tenant" : "Search by name, plot, or address"}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {propertiesLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, property) => (
                  <Box component="li" {...props} key={property._id}>
                    <Box>
                      <Typography variant="body1">
                        {property.propertyName || property.plotNumber || 'Unnamed Property'}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        {property.plotNumber && (
                          <Typography variant="caption" color="text.secondary">
                            Plot: {property.plotNumber}
                          </Typography>
                        )}
                        {property.sector && (
                          <Typography variant="caption" color="text.secondary">
                            Sector: {property.sector}
                          </Typography>
                        )}
                        {(property.address || property.fullAddress) && (
                          <Typography variant="caption" color="text.secondary">
                            {property.address || property.fullAddress}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </Box>
                )}
                isOptionEqualToValue={(option, value) => option._id === value._id}
                noOptionsText={propertiesLoading ? 'Loading properties...' : !selectedResident ? 'Select a tenant first' : 'No properties found for this tenant'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Property Address"
                name="propertyAddress"
                value={formData.propertyAddress}
                onChange={handleInputChange}
                fullWidth
                multiline
                minRows={2}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Monthly Rent (PKR)"
                name="monthlyRent"
                type="number"
                value={formData.monthlyRent}
                onChange={handleInputChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Security Deposit (PKR)"
                name="securityDeposit"
                type="number"
                value={formData.securityDeposit}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                fullWidth
              >
                {statusOptions.map((option) => (
                  <MenuItem value={option} key={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Annual Rent Increase
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Increase Type"
                name="annualRentIncreaseType"
                value={formData.annualRentIncreaseType}
                onChange={handleInputChange}
                fullWidth
              >
                <MenuItem value="percentage">Percentage (%)</MenuItem>
                <MenuItem value="fixed">Fixed Amount (PKR)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label={formData.annualRentIncreaseType === 'percentage' ? 'Increase Percentage (%)' : 'Increase Amount (PKR)'}
                name="annualRentIncreaseValue"
                type="number"
                value={formData.annualRentIncreaseValue}
                onChange={handleInputChange}
                fullWidth
                inputProps={{ min: 0, step: formData.annualRentIncreaseType === 'percentage' ? 0.1 : 1 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Rent After One Year (PKR)"
                value={calculateIncreasedRent().toLocaleString()}
                fullWidth
                disabled
                sx={{
                  '& .MuiInputBase-input': {
                    fontWeight: 600,
                    color: 'primary.main'
                  }
                }}
                helperText="Calculated automatically based on current rent and increase settings"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Start Date"
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="End Date"
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Terms"
                name="terms"
                value={formData.terms}
                onChange={handleInputChange}
                fullWidth
                multiline
                minRows={3}
              />
            </Grid>
            <Grid item xs={12}>
              <Button component="label" startIcon={<AddIcon />}>
                Attach Agreement (optional)
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                />
              </Button>
              {selectedFile && (
                <Chip
                  label={selectedFile.name}
                  onDelete={() => setSelectedFile(null)}
                  sx={{ ml: 1 }}
                  deleteIcon={<CloseIcon />}
                />
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {editingAgreement ? 'Save Changes' : 'Create Agreement'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const StatCard = ({ title, value }) => (
  <Paper sx={{ flex: 1, p: 2, borderRadius: 3 }} elevation={0}>
    <Typography variant="body2" color="text.secondary">
      {title}
    </Typography>
    <Typography variant="h5" fontWeight={700}>
      {value}
    </Typography>
  </Paper>
);

export default RentalAgreements;

