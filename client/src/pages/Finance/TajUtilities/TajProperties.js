import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  Grid,
  IconButton,
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
  MenuItem,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  Collapse,
  Divider,
  Checkbox,
  FormControlLabel,
  Autocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import {
  fetchProperties,
  createProperty,
  updateProperty,
  deleteProperty
} from '../../../services/tajPropertiesService';
import { fetchAvailableAgreements } from '../../../services/tajRentalManagementService';
import { fetchResidents, assignProperties, unassignProperties } from '../../../services/tajResidentsService';

// Default dropdown options - will be managed in state
const defaultPropertyTypes = ['Villa', 'House', 'Building', 'Apartment', 'Shop', 'Office', 'Warehouse', 'Plot', 'Play Ground', 'Other'];
const defaultAreaUnits = ['Sq Ft', 'Sq Yards', 'Marla', 'Kanal', 'Acres'];
const defaultZoneTypes = ['Residential', 'Commercial', 'Agricultural'];
const defaultCategoryTypes = ['Personal', 'Private', 'Personal Rent'];

const defaultMeter = {
  floor: '',
  consumer: '',
  meterNo: '',
  connectionType: '',
  meterType: '',
  dateOfOccupation: '',
  occupiedUnderConstruction: '',
  isActive: true
};

const defaultForm = {
  srNo: '',
  propertyType: 'House',
  propertyName: '',
  zoneType: 'Residential',
  categoryType: 'Personal',
  plotNumber: '',
  rdaNumber: '',
  street: '',
  sector: '',
  block: '',
  floor: '',
  unit: '',
  city: 'Islamabad',
  address: '',
  project: '',
  ownerName: '',
  contactNumber: '',
  tenantName: '',
  tenantPhone: '',
  tenantEmail: '',
  tenantCNIC: '',
  rentalAgreement: '',
  areaValue: '',
  areaUnit: 'Sq Ft',
  bedrooms: '',
  bathrooms: '',
  parking: '',
  expectedRent: '',
  securityDeposit: '',
  description: '',
  notes: '',
  familyStatus: '',
  hasElectricityWater: false,
  meters: []
};

const defaultConnectionTypes = ['Single Phase', 'Two Phase', 'Three Phase'];
const defaultOccupiedUnderConstructionOptions = ['Office', 'Occupied', 'Under-Construction'];

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const getFieldLabel = (fieldType) => {
  const labels = {
    propertyType: 'Property Type',
    zoneType: 'Zone Type',
    categoryType: 'Category Type',
    areaUnit: 'Area Unit',
    connectionType: 'Connection Type',
    occupiedUnderConstruction: 'Occupied / Under-construction',
    sector: 'Sector'
  };
  return labels[fieldType] || 'Option';
};

const TajProperties = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(defaultForm);
  const [editingProperty, setEditingProperty] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [agreements, setAgreements] = useState([]);
  const [agreementsLoading, setAgreementsLoading] = useState(false);
  const [residents, setResidents] = useState([]);
  const [residentsLoading, setResidentsLoading] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    status: '',
    propertyType: '',
    zoneType: '',
    categoryType: '',
    project: '',
    resident: '',
    hasElectricityWater: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Dropdown options state
  const [propertyTypes, setPropertyTypes] = useState(defaultPropertyTypes);
  const [zoneTypes, setZoneTypes] = useState(defaultZoneTypes);
  const [categoryTypes, setCategoryTypes] = useState(defaultCategoryTypes);
  const [areaUnits, setAreaUnits] = useState(defaultAreaUnits);
  const [connectionTypes, setConnectionTypes] = useState(defaultConnectionTypes);
  const [occupiedUnderConstructionOptions, setOccupiedUnderConstructionOptions] = useState(defaultOccupiedUnderConstructionOptions);
  const [sectors, setSectors] = useState([]);
  
  // Add New Dialog State
  const [addNewDialog, setAddNewDialog] = useState({
    open: false,
    type: '', // 'propertyType', 'zoneType', 'categoryType', 'areaUnit', 'connectionType', 'occupiedUnderConstruction', 'sector'
    value: ''
  });

  const loadAgreements = useCallback(async () => {
    try {
      setAgreementsLoading(true);
      const response = await fetchAvailableAgreements();
      setAgreements(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load rental agreements:', err);
    } finally {
      setAgreementsLoading(false);
    }
  }, []);

  const loadResidents = useCallback(async () => {
    try {
      setResidentsLoading(true);
      const response = await fetchResidents({ isActive: 'true' });
      setResidents(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load residents:', err);
    } finally {
      setResidentsLoading(false);
    }
  }, []);

  const loadProperties = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = { search };
      
      // Add filters to params
      Object.keys(filters).forEach(key => {
        if (filters[key] !== '') {
          params[key] = filters[key];
        }
      });
      
      const response = await fetchProperties(params);
      setProperties(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load Taj properties');
    } finally {
      setLoading(false);
    }
  }, [search, filters]);

  useEffect(() => {
    loadProperties();
    loadAgreements();
    loadResidents();
  }, [loadProperties, loadAgreements, loadResidents]);

  const handleOpenDialog = (property) => {
    if (property) {
      setEditingProperty(property);
      // Migrate old single meter data to new array format if needed
      let meters = property.meters || [];
      if (meters.length === 0 && property.hasElectricityWater && (property.electricityWaterMeterNo || property.electricityWaterConsumer)) {
        meters = [{
          floor: property.floor || property.unit || 'Ground Floor',
          consumer: property.electricityWaterConsumer || '',
          meterNo: property.electricityWaterMeterNo || '',
          connectionType: property.connectionType || '',
          meterType: property.meterType || '',
          dateOfOccupation: property.dateOfOccupation ? dayjs(property.dateOfOccupation).format('YYYY-MM-DD') : '',
          occupiedUnderConstruction: property.occupiedUnderConstruction || '',
          isActive: true
        }];
      }
      
      setFormData({
        srNo: property.srNo || '',
        propertyType: property.propertyType || 'House',
        propertyName: property.propertyName || '',
        zoneType: property.zoneType || 'Residential',
        categoryType: property.categoryType || 'Personal',
        plotNumber: property.plotNumber || '',
        rdaNumber: property.rdaNumber || '',
        street: property.street || '',
        sector: property.sector || '',
        block: property.block || '',
        floor: property.floor || '',
        unit: property.unit || '',
        city: property.city || 'Islamabad',
        address: property.address || '',
        project: property.project || '',
        ownerName: property.ownerName || '',
        contactNumber: property.contactNumber || '',
        tenantName: property.tenantName || '',
        tenantPhone: property.tenantPhone || '',
        tenantEmail: property.tenantEmail || '',
        tenantCNIC: property.tenantCNIC || '',
        rentalAgreement:
          property.rentalAgreement?._id ||
          property.rentalAgreement ||
          '',
        areaValue: property.areaValue ?? '',
        areaUnit: property.areaUnit || 'Sq Ft',
        bedrooms: property.bedrooms ?? '',
        bathrooms: property.bathrooms ?? '',
        parking: property.parking ?? '',
        expectedRent: property.expectedRent ?? '',
        securityDeposit: property.securityDeposit ?? '',
        description: property.description || '',
        notes: property.notes || '',
        familyStatus: property.familyStatus || '',
        hasElectricityWater: property.hasElectricityWater || false,
        meters: meters.map(m => ({
          ...m,
          dateOfOccupation: m.dateOfOccupation ? dayjs(m.dateOfOccupation).format('YYYY-MM-DD') : ''
        }))
      });
    } else {
      setEditingProperty(null);
      setFormData({
        ...defaultForm,
        srNo: nextSrNo
      });
    }
    setDialogOpen(true);
    setError('');
    setSuccess('');
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProperty(null);
    setFormData(defaultForm);
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    
    // Handle "Add New" for dropdowns
    if (value === 'add_new') {
      setAddNewDialog({ open: true, type: name, value: '' });
      return;
    }
    
    if (name === 'categoryType') {
      setFormData((prev) => ({
        ...prev,
        categoryType: value,
        rentalAgreement: value === 'Personal Rent' ? prev.rentalAgreement : ''
      }));
      return;
    }
    
    // Handle hasElectricityWater - auto-add meter if enabled and no meters exist
    if (name === 'hasElectricityWater' && checked) {
      setFormData((prev) => ({
        ...prev,
        hasElectricityWater: true,
        meters: prev.meters.length === 0 ? [{ ...defaultMeter }] : prev.meters
      }));
      return;
    }
    
    setFormData((prev) => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };
  
  const handleCloseAddNewDialog = () => {
    setAddNewDialog({ open: false, type: '', value: '' });
  };
  
  const handleSaveNewOption = () => {
    const { type, value } = addNewDialog;
    if (!value.trim()) return;
    
    const trimmedValue = value.trim();
    
    switch (type) {
      case 'propertyType':
        if (!propertyTypes.includes(trimmedValue)) {
          setPropertyTypes([...propertyTypes, trimmedValue]);
        }
        setFormData((prev) => ({ ...prev, propertyType: trimmedValue }));
        break;
      case 'zoneType':
        if (!zoneTypes.includes(trimmedValue)) {
          setZoneTypes([...zoneTypes, trimmedValue]);
        }
        setFormData((prev) => ({ ...prev, zoneType: trimmedValue }));
        break;
      case 'categoryType':
        if (!categoryTypes.includes(trimmedValue)) {
          setCategoryTypes([...categoryTypes, trimmedValue]);
        }
        setFormData((prev) => ({
          ...prev,
          categoryType: trimmedValue,
          rentalAgreement: trimmedValue === 'Personal Rent' ? prev.rentalAgreement : ''
        }));
        break;
      case 'areaUnit':
        if (!areaUnits.includes(trimmedValue)) {
          setAreaUnits([...areaUnits, trimmedValue]);
        }
        setFormData((prev) => ({ ...prev, areaUnit: trimmedValue }));
        break;
      case 'connectionType':
        if (!connectionTypes.includes(trimmedValue)) {
          setConnectionTypes([...connectionTypes, trimmedValue]);
        }
        setFormData((prev) => ({ ...prev, connectionType: trimmedValue }));
        break;
      case 'occupiedUnderConstruction':
        if (!occupiedUnderConstructionOptions.includes(trimmedValue)) {
          setOccupiedUnderConstructionOptions([...occupiedUnderConstructionOptions, trimmedValue]);
        }
        setFormData((prev) => ({ ...prev, occupiedUnderConstruction: trimmedValue }));
        break;
      case 'sector':
        if (!sectors.includes(trimmedValue)) {
          setSectors([...sectors, trimmedValue]);
        }
        setFormData((prev) => ({ ...prev, sector: trimmedValue }));
        break;
      default:
        break;
    }
    
    handleCloseAddNewDialog();
  };

  const handleRentalAgreementChange = (event) => {
    const agreementId = event.target.value;
    setFormData((prev) => ({
      ...prev,
      rentalAgreement: agreementId
    }));
    const agreement = agreements.find((item) => item._id === agreementId);
    if (agreement) {
      setFormData((prev) => {
        // Only populate fields if they are empty (to allow manual overrides)
        const isFieldEmpty = (value) => value === '' || value === null || value === undefined;
        
        return {
        ...prev,
        rentalAgreement: agreementId,
          tenantName: isFieldEmpty(prev.tenantName) ? (agreement.tenantName || agreement.landlordName || '') : prev.tenantName,
          tenantPhone: isFieldEmpty(prev.tenantPhone) ? (agreement.tenantContact || agreement.landlordContact || '') : prev.tenantPhone,
          tenantCNIC: isFieldEmpty(prev.tenantCNIC) ? (agreement.tenantIdCard || '') : prev.tenantCNIC,
          expectedRent: isFieldEmpty(prev.expectedRent) ? (agreement.monthlyRent || '') : prev.expectedRent,
          securityDeposit: isFieldEmpty(prev.securityDeposit) 
            ? (agreement.securityDeposit !== undefined && agreement.securityDeposit !== null ? agreement.securityDeposit : '')
            : prev.securityDeposit
        };
      });
    }
  };

  // Optimized meter handlers
  const handleAddMeter = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      meters: [...prev.meters, { ...defaultMeter }]
    }));
  }, []);

  const handleUpdateMeter = useCallback((index, field, value) => {
    setFormData(prev => ({
      ...prev,
      meters: prev.meters.map((meter, i) => 
        i === index ? { ...meter, [field]: value } : meter
      )
    }));
  }, []);

  const handleRemoveMeter = useCallback((index) => {
    setFormData(prev => ({
      ...prev,
      meters: prev.meters.filter((_, i) => i !== index)
    }));
  }, []);

  const handleSaveProperty = async () => {
    try {
      setError('');
      
      // Validate meters if hasElectricityWater is true
      if (formData.hasElectricityWater && (!formData.meters || formData.meters.length === 0)) {
        setError('Please add at least one meter when Electricity/Water is enabled');
        return;
      }

      const { srNo, meters, ...restForm } = formData;
      const payload = {
        ...restForm,
        areaValue: Number(formData.areaValue) || 0,
        bedrooms: Number(formData.bedrooms) || 0,
        bathrooms: Number(formData.bathrooms) || 0,
        parking: Number(formData.parking) || 0,
        expectedRent: Number(formData.expectedRent) || 0,
        securityDeposit: Number(formData.securityDeposit) || 0,
        rentalAgreement:
          formData.categoryType === 'Personal Rent' && formData.rentalAgreement
            ? formData.rentalAgreement
            : undefined,
        // Process meters array
        meters: formData.hasElectricityWater && meters
          ? meters.map(m => ({
              floor: m.floor || '',
              consumer: m.consumer || '',
              meterNo: m.meterNo || '',
              connectionType: m.connectionType || '',
              meterType: m.meterType || '',
              dateOfOccupation: m.dateOfOccupation || undefined,
              occupiedUnderConstruction: m.occupiedUnderConstruction || '',
              isActive: m.isActive !== false
            }))
          : []
      };

      if (editingProperty && srNo) {
        payload.srNo = Number(srNo);
      }

      let propertyId;
      let oldResidentId = null;

      if (editingProperty) {
        // Store old resident ID for comparison
        oldResidentId = editingProperty.resident?._id || editingProperty.resident || null;
        const response = await updateProperty(editingProperty._id, payload);
        propertyId = editingProperty._id;
        setSuccess('Property updated successfully');
      } else {
        const response = await createProperty(payload);
        // Extract property ID from response - try multiple possible structures
        propertyId = response.data?.data?._id || response.data?._id || response._id;
        if (!propertyId) {
          console.error('Failed to extract property ID from response:', response);
          setError('Property created but ID not found in response');
          return;
        }
        setSuccess('Property created successfully');
      }

      // Auto-assign property to resident if ownerName matches a resident
      if (formData.ownerName && propertyId) {
        const selectedResident = residents.find(r => r.name === formData.ownerName);
        
        if (selectedResident) {
          const selectedResidentId = selectedResident._id.toString();
          const needsAssignment = !oldResidentId || oldResidentId.toString() !== selectedResidentId;
          
          if (needsAssignment) {
            try {
              // If updating and property was assigned to a different resident, unassign first
              if (editingProperty && oldResidentId) {
                const oldResidentIdStr = typeof oldResidentId === 'string' ? oldResidentId : oldResidentId.toString();
                const propertyIdStr = typeof propertyId === 'string' ? propertyId : propertyId.toString();
                await unassignProperties(oldResidentIdStr, [propertyIdStr]);
              }
              
              // Ensure propertyId is a string for the API call
              const propertyIdStr = typeof propertyId === 'string' ? propertyId : propertyId.toString();
              const residentIdStr = typeof selectedResident._id === 'string' ? selectedResident._id : selectedResident._id.toString();
              
              // Assign property to the selected resident
              await assignProperties(residentIdStr, [propertyIdStr]);
              console.log('Successfully assigned property', propertyIdStr, 'to resident', residentIdStr);
            } catch (assignErr) {
              // Log error but don't fail the entire operation
              console.error('Failed to assign property to resident:', assignErr);
              console.error('Error details:', {
                propertyId,
                residentId: selectedResident._id,
                error: assignErr.response?.data || assignErr.message
              });
              setSuccess('Property saved successfully, but assignment to resident failed. Please assign manually.');
            }
          }
        } else {
          console.warn('Resident not found for ownerName:', formData.ownerName);
        }
      } else if (editingProperty && oldResidentId && !formData.ownerName) {
        // If owner name was removed, unassign from old resident
        try {
          const oldResidentIdStr = typeof oldResidentId === 'string' ? oldResidentId : oldResidentId.toString();
          const propertyIdStr = typeof propertyId === 'string' ? propertyId : propertyId.toString();
          await unassignProperties(oldResidentIdStr, [propertyIdStr]);
        } catch (unassignErr) {
          console.error('Failed to unassign property from resident:', unassignErr);
        }
      }

      handleCloseDialog();
      loadProperties();
      // Refresh residents list to update property counts
      loadResidents();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save property');
    }
  };

  const handleDeleteProperty = async (id) => {
    if (!window.confirm('Delete this property record?')) return;
    try {
      await deleteProperty(id);
      setSuccess('Property deleted successfully');
      loadProperties();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete property');
    }
  };

  const filteredProperties = useMemo(() => {
    // Since filters are applied on the backend, we just return properties
    // Client-side search is also handled by backend, so we return all properties
    return properties;
  }, [properties]);
  
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const clearFilters = () => {
    setFilters({
      status: '',
      propertyType: '',
      zoneType: '',
      categoryType: '',
      project: '',
      resident: '',
      hasElectricityWater: ''
    });
    setSearch('');
  };
  
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(value => value !== '') || search !== '';
  }, [filters, search]);
  
  // Get unique values for filter dropdowns
  const uniqueProjects = useMemo(() => {
    const projects = properties
      .map(p => p.project)
      .filter(p => p && p.trim() !== '');
    return [...new Set(projects)].sort();
  }, [properties]);
  
  const uniqueStatuses = useMemo(() => {
    const statuses = properties
      .map(p => p.status)
      .filter(s => s && s.trim() !== '');
    return [...new Set(statuses)].sort();
  }, [properties]);

  const nextSrNo = useMemo(() => {
    if (!properties.length) return 1001;
    const maxSr = Math.max(...properties.map((property) => property.srNo || 0));
    return maxSr >= 1000 ? maxSr + 1 : 1001;
  }, [properties]);

  const showRentalAgreementField = formData.categoryType === 'Personal Rent';
  const selectedAgreement = useMemo(
    () => agreements.find((agreement) => agreement._id === formData.rentalAgreement),
    [agreements, formData.rentalAgreement]
  );

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Taj Utilities — Taj Properties
          </Typography>
          <Typography color="text.secondary">
            Manage Taj Residencia property inventory and financial details.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder="Search properties"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Tooltip title="Refresh">
            <IconButton onClick={loadProperties} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            New Property
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Filters Section */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <FilterListIcon color="action" />
              <Typography variant="h6">Filters</Typography>
              {hasActiveFilters && (
                <Chip 
                  label={`${Object.values(filters).filter(f => f !== '').length + (search ? 1 : 0)} active`}
                  size="small"
                  color="primary"
                />
              )}
            </Stack>
            <Stack direction="row" spacing={1}>
              {hasActiveFilters && (
                <Button
                  size="small"
                  startIcon={<ClearIcon />}
                  onClick={clearFilters}
                >
                  Clear All
                </Button>
              )}
              <Button
                size="small"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? 'Hide' : 'Show'} Filters
              </Button>
            </Stack>
          </Stack>
          
          <Collapse in={showFilters}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    {uniqueStatuses.map((status) => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Property Type</InputLabel>
                  <Select
                    label="Property Type"
                    value={filters.propertyType}
                    onChange={(e) => handleFilterChange('propertyType', e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    {propertyTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Zone Type</InputLabel>
                  <Select
                    label="Zone Type"
                    value={filters.zoneType}
                    onChange={(e) => handleFilterChange('zoneType', e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    {zoneTypes.map((zone) => (
                      <MenuItem key={zone} value={zone}>
                        {zone}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category Type</InputLabel>
                  <Select
                    label="Category Type"
                    value={filters.categoryType}
                    onChange={(e) => handleFilterChange('categoryType', e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    {categoryTypes.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Project</InputLabel>
                  <Select
                    label="Project"
                    value={filters.project}
                    onChange={(e) => handleFilterChange('project', e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    {uniqueProjects.map((project) => (
                      <MenuItem key={project} value={project}>
                        {project}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Autocomplete
                  size="small"
                  options={residents}
                  getOptionLabel={(option) => option.name || ''}
                  value={residents.find(r => String(r._id) === String(filters.resident)) || null}
                  onChange={(event, newValue) => {
                    handleFilterChange('resident', newValue ? String(newValue._id) : '');
                  }}
                  loading={residentsLoading}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Owner / Resident"
                      placeholder="Select resident"
                    />
                  )}
                  renderOption={(props, resident) => (
                    <Box component="li" {...props} key={resident._id}>
                      <Box>
                        <Typography variant="body2">{resident.name}</Typography>
                        {resident.contactNumber && (
                          <Typography variant="caption" color="text.secondary">
                            {resident.contactNumber}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )}
                  isOptionEqualToValue={(option, value) => String(option._id) === String(value._id)}
                  noOptionsText={residentsLoading ? 'Loading...' : 'No residents found'}
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Has Electricity/Water</InputLabel>
                  <Select
                    label="Has Electricity/Water"
                    value={filters.hasElectricityWater}
                    onChange={(e) => handleFilterChange('hasElectricityWater', e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="true">Yes</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Sr. No</TableCell>
                  <TableCell>Property</TableCell>
                  <TableCell>Zone / Category</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Owner / Tenant</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProperties.map((property) => (
                  <TableRow key={property._id} hover>
                    <TableCell>{property.srNo || '—'}</TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{property.propertyName || '—'}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {(property.propertyType || '—')} • Plot {property.plotNumber || '—'} • RDA {property.rdaNumber || '—'}
                      </Typography>
                      {property.hasElectricityWater && property.meters && property.meters.length > 0 && (
                        <Chip 
                          label={`${property.meters.length} Meter${property.meters.length > 1 ? 's' : ''}`}
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Chip
                          label={property.zoneType || 'Personal'}
                          size="small"
                          variant="outlined"
                          color="info"
                        />
                        <Typography variant="caption" color="text.secondary">
                          Category: {property.categoryType || '—'}
                        </Typography>
                        {property.project && (
                          <Typography variant="caption" color="text.secondary">
                            Project: {property.project}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography>{property.address || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Street {property.street || '—'} • Sector {property.sector || '—'}
                        {property.city ? ` • ${property.city}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>
                        {property.resident?.name || property.ownerName || '—'}
                      </Typography>
                      {property.resident && (
                        <Chip 
                          label={property.resident.accountType || 'Resident'} 
                          size="small" 
                          color="primary" 
                          sx={{ mt: 0.5, mb: 0.5 }}
                        />
                      )}
                      <Typography variant="body2" color="text.secondary">
                        {property.resident?.contactNumber || property.contactNumber || '—'}
                      </Typography>
                      {property.tenantName && (
                        <Typography variant="caption" color="text.secondary">
                          Tenant: {property.tenantName}
                        </Typography>
                      )}
                      {property.familyStatus && (
                        <Typography variant="caption" color="text.secondary">
                          Family: {property.familyStatus}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={property.status || 'Pending'} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => navigate(`/finance/taj-utilities-charges/taj-properties/${property._id}`)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleOpenDialog(property)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDeleteProperty(property._id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredProperties.length && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary">No properties found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="md">
        <DialogTitle>{editingProperty ? 'Update Property' : 'New Property'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                label="Sr. No"
                value={formData.srNo || nextSrNo}
                fullWidth
                InputProps={{ readOnly: true }}
                helperText="Auto-assigned when saving"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Property Type</InputLabel>
                <Select
                  label="Property Type"
                  name="propertyType"
                  value={formData.propertyType}
                  onChange={handleInputChange}
                >
                  {propertyTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                  <MenuItem 
                    value="add_new" 
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
                      Add New
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Property Name"
                name="propertyName"
                value={formData.propertyName}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Zone Type</InputLabel>
                <Select
                  label="Zone Type"
                  name="zoneType"
                  value={formData.zoneType}
                  onChange={handleInputChange}
                >
                  {zoneTypes.map((zone) => (
                    <MenuItem key={zone} value={zone}>
                      {zone}
                    </MenuItem>
                  ))}
                  <MenuItem 
                    value="add_new" 
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
                      Add New
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Category Type</InputLabel>
                <Select
                  label="Category Type"
                  name="categoryType"
                  value={formData.categoryType}
                  onChange={handleInputChange}
                >
                  {categoryTypes.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                  <MenuItem 
                    value="add_new" 
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
                      Add New
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Project"
                name="project"
                value={formData.project}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                options={residents}
                getOptionLabel={(option) => {
                  if (typeof option === 'string') return option;
                  return option.name || '';
                }}
                value={residents.find(r => r.name === formData.ownerName) || null}
                onChange={(event, newValue) => {
                  setFormData((prev) => ({
                    ...prev,
                    ownerName: newValue ? newValue.name : ''
                  }));
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
                    label="Owner Name"
                    placeholder="Search by name, contact, or CNIC"
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
            <Grid item xs={12} md={4}>
              <TextField
                label="Contact No"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Family Status"
                name="familyStatus"
                value={formData.familyStatus}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>

            {/* Electricity & Water Checkbox */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.hasElectricityWater || false}
                    onChange={handleInputChange}
                    name="hasElectricityWater"
                  />
                }
                label="Electricity"
              />
            </Grid>

            {/* Dynamic Meters Section */}
            <Grid item xs={12}>
              <Collapse in={formData.hasElectricityWater}>
                <Box sx={{ mt: 2, mb: 2 }}>
                  <Divider sx={{ mb: 2 }} />
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h6">
                      Electricity & Water Meters
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={handleAddMeter}
                    >
                      Add Meter
                    </Button>
                  </Stack>

                  {formData.meters && formData.meters.length > 0 ? (
                    <Stack spacing={2}>
                      {formData.meters.map((meter, index) => (
                        <Card key={index} variant="outlined">
                          <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                              <Typography variant="subtitle1" fontWeight={600}>
                                Meter {index + 1}
                                {meter.floor && ` - ${meter.floor}`}
                              </Typography>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveMeter(index)}
                                disabled={formData.meters.length === 1}
                              >
                                <RemoveIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                            <Grid container spacing={2}>
                              <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                  label="Floor/Unit *"
                                  value={meter.floor}
                                  onChange={(e) => handleUpdateMeter(index, 'floor', e.target.value)}
                                  fullWidth
                                  size="small"
                                  required
                                />
                              </Grid>
                              <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                  label="Consumer"
                                  value={meter.consumer}
                                  onChange={(e) => handleUpdateMeter(index, 'consumer', e.target.value)}
                                  fullWidth
                                  size="small"
                                />
                              </Grid>
                              <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                  label="Meter No"
                                  value={meter.meterNo}
                                  onChange={(e) => handleUpdateMeter(index, 'meterNo', e.target.value)}
                                  fullWidth
                                  size="small"
                                />
                              </Grid>
                              <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Connection Type</InputLabel>
                                  <Select
                                    label="Connection Type"
                                    value={meter.connectionType || ''}
                                    onChange={(e) => handleUpdateMeter(index, 'connectionType', e.target.value)}
                                  >
                                    {connectionTypes.map((type) => (
                                      <MenuItem key={type} value={type}>
                                        {type}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                  label="Meter Type"
                                  value={meter.meterType}
                                  onChange={(e) => handleUpdateMeter(index, 'meterType', e.target.value)}
                                  fullWidth
                                  size="small"
                                />
                              </Grid>
                              <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Occupied / Under-construction</InputLabel>
                                  <Select
                                    label="Occupied / Under-construction"
                                    value={meter.occupiedUnderConstruction || ''}
                                    onChange={(e) => handleUpdateMeter(index, 'occupiedUnderConstruction', e.target.value)}
                                  >
                                    {occupiedUnderConstructionOptions.map((option) => (
                                      <MenuItem key={option} value={option}>
                                        {option}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                  label="Date of Occupation"
                                  type="date"
                                  value={meter.dateOfOccupation || ''}
                                  onChange={(e) => handleUpdateMeter(index, 'dateOfOccupation', e.target.value)}
                                  fullWidth
                                  size="small"
                                  InputLabelProps={{ shrink: true }}
                                />
                              </Grid>
                              <Grid item xs={12} sm={6} md={3}>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={meter.isActive !== false}
                                      onChange={(e) => handleUpdateMeter(index, 'isActive', e.target.checked)}
                                    />
                                  }
                                  label="Active"
                                />
                              </Grid>
                            </Grid>
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  ) : (
                    <Alert severity="info">
                      No meters added. Click "Add Meter" to add meter information.
                    </Alert>
                  )}
                  <Divider sx={{ mt: 2 }} />
                </Box>
              </Collapse>
            </Grid>

            {/* Personal Rent Section */}
            <Grid item xs={12}>
              <Collapse in={showRentalAgreementField}>
                <Box sx={{ mt: 2, mb: 2 }}>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                    Personal Rent Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Rental Agreement</InputLabel>
                        <Select
                          label="Rental Agreement"
                          value={formData.rentalAgreement}
                          onChange={handleRentalAgreementChange}
                          disabled={agreementsLoading || !agreements.length}
                        >
                          <MenuItem value="">
                            {agreementsLoading ? 'Loading agreements...' : 'Select agreement'}
                          </MenuItem>
                          {agreements.map((agreement) => (
                            <MenuItem key={agreement._id} value={agreement._id}>
                              {agreement.agreementNumber} — {agreement.propertyName}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {selectedAgreement && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          Monthly Rent: {formatCurrency(selectedAgreement.monthlyRent)} | Period:{' '}
                          {dayjs(selectedAgreement.startDate).format('MMM YYYY')} -{' '}
                          {dayjs(selectedAgreement.endDate).format('MMM YYYY')}
                        </Typography>
                      )}
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Tenant Name"
                        name="tenantName"
                        value={formData.tenantName}
                        onChange={handleInputChange}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Tenant Phone"
                        name="tenantPhone"
                        value={formData.tenantPhone}
                        onChange={handleInputChange}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Tenant Email"
                        name="tenantEmail"
                        value={formData.tenantEmail}
                        onChange={handleInputChange}
                        type="email"
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Tenant CNIC"
                        name="tenantCNIC"
                        value={formData.tenantCNIC}
                        onChange={handleInputChange}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Expected Rent (PKR)"
                        type="number"
                        name="expectedRent"
                        value={formData.expectedRent}
                        onChange={handleInputChange}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Security Deposit (PKR)"
                        type="number"
                        name="securityDeposit"
                        value={formData.securityDeposit}
                        onChange={handleInputChange}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                  <Divider sx={{ mt: 2 }} />
                </Box>
              </Collapse>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Plot No"
                name="plotNumber"
                value={formData.plotNumber}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="RDA No"
                name="rdaNumber"
                value={formData.rdaNumber}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Block"
                name="block"
                value={formData.block}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Street"
                name="street"
                value={formData.street}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Sector</InputLabel>
                <Select
                  label="Sector"
                  name="sector"
                  value={formData.sector}
                  onChange={handleInputChange}
                >
                  {sectors.map((sector) => (
                    <MenuItem key={sector} value={sector}>
                      {sector}
                    </MenuItem>
                  ))}
                  <MenuItem 
                    value="add_new" 
                    sx={{ 
                      borderTop: sectors.length > 0 ? '1px solid #e0e0e0' : 'none',
                      backgroundColor: '#f5f5f5',
                      '&:hover': {
                        backgroundColor: '#e3f2fd'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AddIcon fontSize="small" />
                      Add New
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="City"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Floor"
                name="floor"
                value={formData.floor}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Unit"
                name="unit"
                value={formData.unit}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Full Address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                fullWidth
                multiline
                rows={2}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Area Value"
                type="number"
                name="areaValue"
                value={formData.areaValue}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Area Unit</InputLabel>
                <Select
                  label="Area Unit"
                  name="areaUnit"
                  value={formData.areaUnit}
                  onChange={handleInputChange}
                >
                  {areaUnits.map((unitOption) => (
                    <MenuItem key={unitOption} value={unitOption}>
                      {unitOption}
                    </MenuItem>
                  ))}
                  <MenuItem 
                    value="add_new" 
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
                      Add New
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Bedrooms"
                type="number"
                name="bedrooms"
                value={formData.bedrooms}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Bathrooms"
                type="number"
                name="bathrooms"
                value={formData.bathrooms}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Parking Spaces"
                type="number"
                name="parking"
                value={formData.parking}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                fullWidth
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveProperty}>
            {editingProperty ? 'Save Changes' : 'Create Property'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add New Option Dialog */}
      <Dialog 
        open={addNewDialog.open} 
        onClose={handleCloseAddNewDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Add New {getFieldLabel(addNewDialog.type)}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Name"
            value={addNewDialog.value}
            onChange={(e) => setAddNewDialog({ ...addNewDialog, value: e.target.value })}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSaveNewOption();
              }
            }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddNewDialog}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveNewOption}
            disabled={!addNewDialog.value.trim()}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TajProperties;


