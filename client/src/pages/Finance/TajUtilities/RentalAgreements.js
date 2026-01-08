import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  Skeleton
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
import { fetchResidents, createResident } from '../../../services/tajResidentsService';
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
  const fileInputRef = useRef(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [residents, setResidents] = useState([]);
  const [residentsLoading, setResidentsLoading] = useState(false);
  const [properties, setProperties] = useState([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [selectedResident, setSelectedResident] = useState(null);
  
  // New Resident Dialog State
  const defaultNewResidentForm = {
    name: '',
    accountType: 'Resident',
    cnic: '',
    contactNumber: '',
    email: '',
    address: '',
    balance: 0,
    notes: ''
  };
  
  const [newResidentDialog, setNewResidentDialog] = useState(false);
  const [newResidentForm, setNewResidentForm] = useState(defaultNewResidentForm);
  const [savingResident, setSavingResident] = useState(false);

  const fetchAgreements = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/taj-rental-agreements');
      setAgreements(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load rental agreements');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchResidentsData = useCallback(async () => {
    try {
      setResidentsLoading(true);
      const response = await fetchResidents({ isActive: 'true' });
      const allResidents = response.data.data || [];
      
      // Deduplicate residents by name using Map for better performance
      const uniqueMap = new Map();
      allResidents.forEach((resident) => {
        const residentName = resident.name?.trim().toLowerCase();
        if (residentName && !uniqueMap.has(residentName)) {
          uniqueMap.set(residentName, resident);
        }
      });
      
      setResidents(Array.from(uniqueMap.values()));
    } catch (err) {
      console.error('Failed to load residents:', err);
    } finally {
      setResidentsLoading(false);
    }
  }, []);

  const fetchPropertiesForResident = useCallback(async (resident) => {
    try {
      setPropertiesLoading(true);
      // Fetch all properties
      const response = await fetchProperties({});
      const allProperties = response.data?.data || [];
      
      // Filter properties assigned to this resident using Set for O(1) lookup
      if (resident.properties && Array.isArray(resident.properties) && resident.properties.length > 0) {
        const residentPropertyIds = new Set(
          resident.properties.map(p => typeof p === 'object' ? p._id || p : p)
        );
        const filteredProperties = allProperties.filter(property => 
          residentPropertyIds.has(property._id)
        );
        setProperties(filteredProperties);
      } else {
        setProperties([]);
      }
    } catch (err) {
      console.error('Failed to load properties:', err);
      setProperties([]);
    } finally {
      setPropertiesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgreements();
    fetchResidentsData();
  }, [fetchAgreements, fetchResidentsData]);

  const handleOpenDialog = useCallback(async (agreement) => {
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
  }, [residents, fetchPropertiesForResident]);

  const handleSaveNewResident = useCallback(async () => {
    try {
      if (!newResidentForm.name.trim()) {
        setError('Name is required');
        return;
      }

      setSavingResident(true);
      setError('');

      const response = await createResident(newResidentForm);
      const newResident = response.data?.data;

      if (newResident) {
        // Reload residents list
        await fetchResidentsData();
        
        // Auto-select the newly created resident
        setSelectedResident(newResident);
        setFormData((prev) => ({
          ...prev,
          tenantName: newResident.name || '',
          tenantContact: newResident.contactNumber || prev.tenantContact,
          tenantIdCard: newResident.cnic || prev.tenantIdCard
        }));

        // Load properties for this resident
        await fetchPropertiesForResident(newResident);

        // Close dialog and reset form
        setNewResidentDialog(false);
        setNewResidentForm(defaultNewResidentForm);
        setSuccess('New resident created and selected successfully');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create resident');
    } finally {
      setSavingResident(false);
    }
  }, [newResidentForm, fetchResidentsData, fetchPropertiesForResident, defaultNewResidentForm]);

  const handleCloseNewResidentDialog = useCallback(() => {
    setNewResidentDialog(false);
    setNewResidentForm(defaultNewResidentForm);
    setError('');
  }, []);


  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingAgreement(null);
    setFormData(defaultForm);
    setSelectedFile(null);
    setSelectedResident(null);
    setProperties([]);
    setError('');
    setSuccess('');
  }, []);

  const handleInputChange = useCallback((event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const calculateIncreasedRent = useMemo(() => {
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
  }, [formData.monthlyRent, formData.annualRentIncreaseValue, formData.annualRentIncreaseType]);

  const buildPayload = useCallback(() => {
    const payload = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      payload.append(key, value ?? '');
    });
    if (selectedFile) {
      payload.append('agreementImage', selectedFile);
    }
    return payload;
  }, [formData, selectedFile]);

  const handleSave = useCallback(async () => {
    try {
      setError(''); // Clear previous errors
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
      console.error('Error saving agreement:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Unable to save agreement';
      setError(errorMessage);
    }
  }, [editingAgreement, buildPayload, fetchAgreements, handleCloseDialog]);

  const handleDelete = useCallback(async (agreementId) => {
    try {
      setDeletingId(agreementId);
      await api.delete(`/taj-rental-agreements/${agreementId}`);
      fetchAgreements();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete agreement');
    } finally {
      setDeletingId(null);
    }
  }, [fetchAgreements]);

  const summaryStats = useMemo(() => {
    const totalRent = agreements.reduce((sum, agreement) => sum + (agreement.monthlyRent || 0), 0);
    const active = agreements.filter((agreement) => agreement.status === 'Active').length;
    const expired = agreements.filter((agreement) => agreement.status === 'Expired').length;
    const expiredRent = agreements
      .filter((agreement) => agreement.status === 'Expired')
      .reduce((sum, agreement) => sum + (agreement.monthlyRent || agreement.increasedRent || 0), 0);
    return { totalRent, active, expired, expiredRent, total: agreements.length };
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
        <StatCard title="Expired Agreements" value={summaryStats.expired || 0} />
        <StatCard title="Monthly Rent Portfolio" value={`PKR ${summaryStats.totalRent.toLocaleString()}`} />
        {summaryStats.expiredRent > 0 && (
          <StatCard title="Expired Rent Portfolio" value={`PKR ${summaryStats.expiredRent.toLocaleString()}`} />
        )}
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
                  <TableCell>Time Left</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  // Skeleton loading rows
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell>
                        <Skeleton variant="text" width={120} />
                        <Skeleton variant="text" width={100} height={20} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width="60%" />
                        <Skeleton variant="text" width="80%" height={20} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width="60%" />
                        <Skeleton variant="text" width={100} height={20} />
                      </TableCell>
                      <TableCell><Skeleton variant="text" width={80} /></TableCell>
                      <TableCell>
                        <Skeleton variant="text" width={120} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width={100} />
                      </TableCell>
                      <TableCell><Skeleton variant="rectangular" width={80} height={24} /></TableCell>
                      <TableCell align="right">
                        <Skeleton variant="circular" width={32} height={32} />
                        <Skeleton variant="circular" width={32} height={32} sx={{ ml: 1 }} />
                        <Skeleton variant="circular" width={32} height={32} sx={{ ml: 1 }} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
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
                        {(() => {
                          const endDate = dayjs(agreement.endDate);
                          const now = dayjs();
                          const diffDays = endDate.diff(now, 'day');
                          const diffMonths = endDate.diff(now, 'month', true);
                          const diffYears = endDate.diff(now, 'year', true);
                          
                          if (agreement.status === 'Expired' || diffDays < 0) {
                            const daysAgo = Math.abs(diffDays);
                            if (daysAgo === 0) {
                              return <Typography variant="body2" color="error">Expired today</Typography>;
                            } else if (daysAgo === 1) {
                              return <Typography variant="body2" color="error">Expired 1 day ago</Typography>;
                            } else if (daysAgo < 30) {
                              return <Typography variant="body2" color="error">Expired {daysAgo} days ago</Typography>;
                            } else if (daysAgo < 365) {
                              const monthsAgo = Math.floor(daysAgo / 30);
                              return <Typography variant="body2" color="error">Expired {monthsAgo} {monthsAgo === 1 ? 'month' : 'months'} ago</Typography>;
                            } else {
                              const yearsAgo = Math.floor(daysAgo / 365);
                              return <Typography variant="body2" color="error">Expired {yearsAgo} {yearsAgo === 1 ? 'year' : 'years'} ago</Typography>;
                            }
                          } else if (diffDays === 0) {
                            return <Typography variant="body2" color="warning.main" fontWeight={600}>Expires today</Typography>;
                          } else if (diffDays === 1) {
                            return <Typography variant="body2" color="warning.main" fontWeight={600}>1 day left</Typography>;
                          } else if (diffDays < 7) {
                            return <Typography variant="body2" color="warning.main" fontWeight={600}>{diffDays} days left</Typography>;
                          } else if (diffDays < 30) {
                            const weeks = Math.floor(diffDays / 7);
                            const days = diffDays % 7;
                            if (days === 0) {
                              return <Typography variant="body2">{weeks} {weeks === 1 ? 'week' : 'weeks'} left</Typography>;
                            } else {
                              return <Typography variant="body2">{weeks} {weeks === 1 ? 'week' : 'weeks'} {days} {days === 1 ? 'day' : 'days'} left</Typography>;
                            }
                          } else if (diffDays < 365) {
                            const months = Math.floor(diffMonths);
                            const remainingDays = diffDays % 30;
                            if (remainingDays === 0) {
                              return <Typography variant="body2">{months} {months === 1 ? 'month' : 'months'} left</Typography>;
                            } else {
                              return <Typography variant="body2">{months} {months === 1 ? 'month' : 'months'} {remainingDays} {remainingDays === 1 ? 'day' : 'days'} left</Typography>;
                            }
                          } else {
                            const years = Math.floor(diffYears);
                            const remainingMonths = Math.floor((diffDays % 365) / 30);
                            if (remainingMonths === 0) {
                              return <Typography variant="body2">{years} {years === 1 ? 'year' : 'years'} left</Typography>;
                            } else {
                              return <Typography variant="body2">{years} {years === 1 ? 'year' : 'years'} {remainingMonths} {remainingMonths === 1 ? 'month' : 'months'} left</Typography>;
                            }
                          }
                        })()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={agreement.status}
                          size="small"
                          color={
                            agreement.status === 'Active' 
                              ? 'success' 
                              : agreement.status === 'Expired' 
                              ? 'error' 
                              : 'default'
                          }
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
                  ))
                )}
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
                value={editingAgreement ? formData.agreementNumber : (formData.agreementNumber || 'Auto-generated')}
                onChange={handleInputChange}
                fullWidth
                disabled={!editingAgreement}
                helperText={!editingAgreement ? "Agreement number will be auto-generated (last + 1)" : ""}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={[...residents, { _id: 'ADD_NEW', name: 'Add New Resident...', isAddNew: true }]}
                getOptionLabel={(option) => {
                  if (typeof option === 'string') return option;
                  if (option.isAddNew) return option.name;
                  return option.name || '';
                }}
                value={residents.find(r => r.name === formData.tenantName) || null}
                onChange={async (event, newValue) => {
                  if (!newValue) {
                    setSelectedResident(null);
                    setFormData((prev) => ({
                      ...prev,
                      tenantName: '',
                      propertyName: '',
                      propertyAddress: ''
                    }));
                    setProperties([]);
                    return;
                  }
                  
                  // Check if "Add New" option was selected
                  if (newValue.isAddNew) {
                    setNewResidentDialog(true);
                    return;
                  }
                  
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
                }}
                loading={residentsLoading}
                filterOptions={(options, params) => {
                  const { inputValue } = params;
                  const filtered = options.filter((resident) => {
                    if (resident.isAddNew) return true;
                    if (!inputValue) return true;
                    
                    const searchTerm = inputValue.toLowerCase();
                    const nameMatch = resident.name?.toLowerCase().includes(searchTerm);
                    const contactMatch = resident.contactNumber?.toLowerCase().includes(searchTerm);
                    const cnicMatch = resident.cnic?.toLowerCase().includes(searchTerm);
                    return nameMatch || contactMatch || cnicMatch;
                  });
                  
                  // Always show "Add New" at the end
                  const addNewOption = filtered.find(o => o.isAddNew);
                  const regularOptions = filtered.filter(o => !o.isAddNew);
                  return addNewOption ? [...regularOptions, addNewOption] : regularOptions;
                }}
                isOptionEqualToValue={(option, value) => {
                  if (option.isAddNew || value?.isAddNew) return false;
                  return option._id === value?._id;
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
                renderOption={(props, resident) => {
                  if (resident.isAddNew) {
                    return (
                      <Box 
                        component="li" 
                        {...props} 
                        key="ADD_NEW"
                        sx={{
                          borderTop: '1px solid #e0e0e0',
                          backgroundColor: '#f5f5f5',
                          '&:hover': {
                            backgroundColor: '#e3f2fd'
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AddIcon fontSize="small" />
                          <Typography variant="body1">Add New Resident...</Typography>
                        </Box>
                      </Box>
                    );
                  }
                  return (
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
                  );
                }}
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
                  if (!newValue) {
                    setFormData((prev) => ({
                      ...prev,
                      propertyName: '',
                      propertyAddress: ''
                    }));
                    return;
                  }
                  
                  // Auto-fill related fields from property data
                  setFormData((prev) => ({
                    ...prev,
                    propertyName: newValue.propertyName || newValue.plotNumber || '',
                    propertyAddress: newValue.address || newValue.fullAddress || prev.propertyAddress
                  }));
                }}
                loading={propertiesLoading}
                disabled={!selectedResident}
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
                isOptionEqualToValue={(option, value) => {
                  return option._id === value?._id;
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Property Name"
                    placeholder={!selectedResident ? "Select tenant first" : "Search by name, plot, or address"}
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
                value={calculateIncreasedRent.toLocaleString()}
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
              <Box>
                <Button component="label" startIcon={<AddIcon />} sx={{ mb: selectedFile ? 1 : 0 }}>
                  Attach Agreement (optional)
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      if (file) {
                        // Check file size (10MB = 10 * 1024 * 1024 bytes)
                        const maxSize = 10 * 1024 * 1024;
                        if (file.size > maxSize) {
                          setError('File size must be less than 10 MB');
                          event.target.value = ''; // Clear the input
                          return;
                        }
                        setSelectedFile(file);
                        setError(''); // Clear any previous errors
                      } else {
                        setSelectedFile(null);
                      }
                    }}
                  />
                </Button>
                {selectedFile && (
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label={`${selectedFile.name} (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)`}
                      onDelete={() => {
                        setSelectedFile(null);
                        // Clear the file input
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      deleteIcon={<CloseIcon />}
                      color="primary"
                      variant="outlined"
                      sx={{ 
                        fontSize: '0.875rem',
                        '& .MuiChip-deleteIcon': {
                          fontSize: '1.2rem',
                          color: 'error.main',
                          '&:hover': {
                            color: 'error.dark'
                          }
                        }
                      }}
                    />
                  </Box>
                )}
              </Box>
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

      {/* New Resident Dialog */}
      <Dialog 
        open={newResidentDialog} 
        onClose={handleCloseNewResidentDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add New Taj Resident</DialogTitle>
        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Name"
                value={newResidentForm.name}
                onChange={(e) => setNewResidentForm({ ...newResidentForm, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Account Type</InputLabel>
                <Select
                  value={newResidentForm.accountType}
                  label="Account Type"
                  onChange={(e) => setNewResidentForm({ ...newResidentForm, accountType: e.target.value })}
                >
                  <MenuItem value="Resident">Resident</MenuItem>
                  <MenuItem value="Property Dealer">Property Dealer</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="CNIC"
                value={newResidentForm.cnic}
                onChange={(e) => setNewResidentForm({ ...newResidentForm, cnic: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Contact Number"
                value={newResidentForm.contactNumber}
                onChange={(e) => setNewResidentForm({ ...newResidentForm, contactNumber: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newResidentForm.email}
                onChange={(e) => setNewResidentForm({ ...newResidentForm, email: e.target.value.toLowerCase().trim() })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Initial Balance"
                type="number"
                value={newResidentForm.balance}
                onChange={(e) => setNewResidentForm({ ...newResidentForm, balance: parseFloat(e.target.value) || 0 })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={2}
                value={newResidentForm.address}
                onChange={(e) => setNewResidentForm({ ...newResidentForm, address: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={2}
                value={newResidentForm.notes}
                onChange={(e) => setNewResidentForm({ ...newResidentForm, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNewResidentDialog}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveNewResident}
            disabled={savingResident || !newResidentForm.name.trim()}
          >
            {savingResident ? 'Saving...' : 'Save'}
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

