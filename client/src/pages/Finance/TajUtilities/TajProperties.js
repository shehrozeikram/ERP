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
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon
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

const propertyTypes = ['Villa', 'House', 'Building', 'Apartment', 'Shop', 'Office', 'Warehouse', 'Plot', 'Play Ground', 'Other'];
const areaUnits = ['Sq Ft', 'Sq Yards', 'Marla', 'Kanal', 'Acres'];
const zoneTypes = ['Residential', 'Commercial', 'Agricultural'];
const categoryTypes = ['Personal', 'Private', 'Personal Rent'];

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
  electricityWaterConsumer: '',
  electricityWaterMeterNo: '',
  connectionType: '',
  occupiedUnderConstruction: '',
  dateOfOccupation: '',
  meterType: ''
};

const connectionTypes = ['Single Phase', 'Two Phase', 'Three Phase'];
const occupiedUnderConstructionOptions = ['Office', 'Occupied', 'Under-Construction'];

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

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

  const loadProperties = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetchProperties({ search });
      setProperties(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load Taj properties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProperties();
    loadAgreements();
  }, []);

  const loadAgreements = async () => {
    try {
      setAgreementsLoading(true);
      const response = await fetchAvailableAgreements();
      setAgreements(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load rental agreements:', err);
    } finally {
      setAgreementsLoading(false);
    }
  };

  const handleOpenDialog = (property) => {
    if (property) {
      setEditingProperty(property);
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
        electricityWaterConsumer: property.electricityWaterConsumer || '',
        electricityWaterMeterNo: property.electricityWaterMeterNo || '',
        connectionType: property.connectionType || '',
        occupiedUnderConstruction: property.occupiedUnderConstruction || '',
        dateOfOccupation: property.dateOfOccupation ? dayjs(property.dateOfOccupation).format('YYYY-MM-DD') : '',
        meterType: property.meterType || ''
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
    if (name === 'categoryType') {
      setFormData((prev) => ({
        ...prev,
        categoryType: value,
        rentalAgreement: value === 'Personal Rent' ? prev.rentalAgreement : ''
      }));
      return;
    }
    setFormData((prev) => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleRentalAgreementChange = (event) => {
    const agreementId = event.target.value;
    setFormData((prev) => ({
      ...prev,
      rentalAgreement: agreementId
    }));
    const agreement = agreements.find((item) => item._id === agreementId);
    if (agreement) {
      setFormData((prev) => ({
        ...prev,
        rentalAgreement: agreementId,
        tenantName: prev.tenantName || agreement.tenantName || agreement.landlordName || '',
        tenantPhone: prev.tenantPhone || agreement.tenantContact || agreement.landlordContact || '',
        expectedRent: prev.expectedRent || agreement.monthlyRent || ''
      }));
    }
  };

  const handleSaveProperty = async () => {
    try {
      setError('');
      const { srNo, ...restForm } = formData;
      const payload = {
        ...restForm,
        areaValue: Number(formData.areaValue) || 0,
        bedrooms: Number(formData.bedrooms) || 0,
        bathrooms: Number(formData.bathrooms) || 0,
        parking: Number(formData.parking) || 0,
        expectedRent: Number(formData.expectedRent) || 0,
        securityDeposit: Number(formData.securityDeposit) || 0,
        dateOfOccupation: formData.dateOfOccupation || undefined,
        rentalAgreement:
          formData.categoryType === 'Personal Rent' && formData.rentalAgreement
            ? formData.rentalAgreement
            : undefined
      };

      if (editingProperty && srNo) {
        payload.srNo = Number(srNo);
      }

      if (editingProperty) {
        await updateProperty(editingProperty._id, payload);
        setSuccess('Property updated successfully');
      } else {
        await createProperty(payload);
        setSuccess('Property created successfully');
      }
      handleCloseDialog();
      loadProperties();
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
    if (!search) return properties;
    const pattern = new RegExp(search, 'i');
    return properties.filter(
      (property) =>
        pattern.test(property.propertyName || '') ||
        pattern.test(property.propertyType || '') ||
        pattern.test(property.categoryType || '') ||
        pattern.test(property.plotNumber || '') ||
        pattern.test(property.ownerName || '') ||
        pattern.test(property.project || '')
    );
  }, [properties, search]);

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
                  <TableCell align="right">Rent / Deposit</TableCell>
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
                      <Typography fontWeight={600}>{property.ownerName || '—'}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {property.contactNumber || '—'}
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
                      <Typography fontWeight={600}>{formatCurrency(property.expectedRent)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Deposit: {formatCurrency(property.securityDeposit)}
                      </Typography>
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
                    <TableCell colSpan={10} align="center">
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
              <TextField
                label="Owner Name"
                name="ownerName"
                value={formData.ownerName}
                onChange={handleInputChange}
                fullWidth
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
                label="Electricity & Water"
              />
            </Grid>

            {/* Electricity & Water Section */}
            <Grid item xs={12}>
              <Collapse in={formData.hasElectricityWater}>
                <Box sx={{ mt: 2, mb: 2 }}>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                    Electricity & Water Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Consumer"
                        name="electricityWaterConsumer"
                        value={formData.electricityWaterConsumer}
                        onChange={handleInputChange}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Meter No"
                        name="electricityWaterMeterNo"
                        value={formData.electricityWaterMeterNo}
                        onChange={handleInputChange}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Connection Type</InputLabel>
                        <Select
                          label="Connection Type"
                          name="connectionType"
                          value={formData.connectionType}
                          onChange={handleInputChange}
                        >
                          {connectionTypes.map((type) => (
                            <MenuItem key={type} value={type}>
                              {type}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Occupied / Under-construction</InputLabel>
                        <Select
                          label="Occupied / Under-construction"
                          name="occupiedUnderConstruction"
                          value={formData.occupiedUnderConstruction}
                          onChange={handleInputChange}
                        >
                          {occupiedUnderConstructionOptions.map((option) => (
                            <MenuItem key={option} value={option}>
                              {option}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Date of Occupation / Start Date"
                        type="date"
                        name="dateOfOccupation"
                        value={formData.dateOfOccupation}
                        onChange={handleInputChange}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Meter Type"
                        name="meterType"
                        value={formData.meterType}
                        onChange={handleInputChange}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
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
              <TextField
                label="Sector"
                name="sector"
                value={formData.sector}
                onChange={handleInputChange}
                fullWidth
              />
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
    </Box>
  );
};

export default TajProperties;


