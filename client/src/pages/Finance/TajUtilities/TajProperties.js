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
  Autocomplete,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Remove as RemoveIcon,
  Close as CloseIcon
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
import { fetchResidents, createResident, assignProperties, unassignProperties } from '../../../services/tajResidentsService';
import { fetchSectors, createSector } from '../../../services/tajSectorsService';
import api from '../../../services/api';
import { updatePropertyStatus } from '../../../services/tajPropertiesService';

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
const defaultOccupiedUnderConstructionOptions = ['Office', 'Occupied', 'Under-Construction', 'Un-occupied'];

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
  const [sectorsLoading, setSectorsLoading] = useState(false);
  
  // Add New Dialog State
  const [addNewDialog, setAddNewDialog] = useState({
    open: false,
    type: '', // 'propertyType', 'zoneType', 'categoryType', 'areaUnit', 'connectionType', 'occupiedUnderConstruction', 'sector'
    value: ''
  });

  // New Resident Dialog State
  const [newResidentDialog, setNewResidentDialog] = useState(false);
  const [newResidentDialogContext, setNewResidentDialogContext] = useState(null); // 'property' or 'agreement'
  const [newResidentForm, setNewResidentForm] = useState({
    name: '',
    accountType: 'Resident',
    cnic: '',
    contactNumber: '',
    email: '',
    address: '',
    balance: 0,
    notes: ''
  });
  const [savingResident, setSavingResident] = useState(false);
  
  // Agreement Dialog State
  const [agreementDialog, setAgreementDialog] = useState(false);
  const [draftPropertyId, setDraftPropertyId] = useState(null);
  const [agreementForm, setAgreementForm] = useState({
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
  });
  const [savingAgreement, setSavingAgreement] = useState(false);
  const [selectedAgreementFile, setSelectedAgreementFile] = useState(null);
  const agreementFileInputRef = useRef(null);

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

  const loadSectors = useCallback(async () => {
    try {
      setSectorsLoading(true);
      const response = await fetchSectors({ isActive: 'true' });
      setSectors(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load sectors:', err);
    } finally {
      setSectorsLoading(false);
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
    loadSectors();
  }, [loadProperties, loadAgreements, loadResidents, loadSectors]);

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
        // This case is now handled by Autocomplete, but keeping for backward compatibility
        if (trimmedValue) {
          handleCreateNewSector(trimmedValue);
        }
        break;
      default:
        break;
    }
    
    handleCloseAddNewDialog();
  };

  const handleSaveNewResident = async () => {
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
        await loadResidents();
        
        // Auto-select the newly created resident based on context
        if (newResidentDialogContext === 'agreement') {
          // Update agreement form
          setAgreementForm((prev) => ({
            ...prev,
            tenantName: newResident.name || '',
            tenantContact: newResident.contactNumber || prev.tenantContact,
            tenantIdCard: newResident.cnic || prev.tenantIdCard
          }));
        } else {
          // Update property form
          setFormData((prev) => ({
            ...prev,
            ownerName: newResident.name || '',
            contactNumber: newResident.contactNumber || prev.contactNumber,
            address: newResident.address || prev.address
          }));
        }

        // Close dialog and reset form
        setNewResidentDialog(false);
        setNewResidentDialogContext(null);
        setNewResidentForm({
          name: '',
          accountType: 'Resident',
          cnic: '',
          contactNumber: '',
          email: '',
          address: '',
          balance: 0,
          notes: ''
        });
        setSuccess('New resident created and selected successfully');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create resident');
    } finally {
      setSavingResident(false);
    }
  };

  const handleCloseNewResidentDialog = () => {
    setNewResidentDialog(false);
    setNewResidentDialogContext(null);
    setNewResidentForm({
      name: '',
      accountType: 'Resident',
      cnic: '',
      contactNumber: '',
      email: '',
      address: '',
      balance: 0,
      notes: ''
    });
    setError('');
  };

  const handleCreateNewSector = async (sectorName) => {
    if (!sectorName || !sectorName.trim()) {
      return;
    }

    const trimmedName = sectorName.trim();
    
    // Check if sector already exists
    const existingSector = sectors.find(s => 
      (s.name || s).toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (existingSector) {
      // Sector already exists, just set it
      setFormData((prev) => ({ ...prev, sector: existingSector.name || existingSector }));
      return;
    }

    try {
      // Create new sector
      const response = await createSector({ name: trimmedName });
      const newSector = response.data?.data;
      
      if (newSector) {
        // Add to sectors list
        setSectors((prev) => [...prev, newSector].sort((a, b) => {
          const nameA = (a.name || a).toLowerCase();
          const nameB = (b.name || b).toLowerCase();
          return nameA.localeCompare(nameB);
        }));
        
        // Set in form data
        setFormData((prev) => ({ ...prev, sector: newSector.name }));
        setSuccess(`Sector "${trimmedName}" created successfully`);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to create sector';
      setError(errorMsg);
      console.error('Failed to create sector:', err);
    }
  };

  const handleCreateAgreement = async () => {
    try {
      setError('');
      
      // Validate required fields
      if (!formData.propertyName && !formData.plotNumber) {
        setError('Property Name or Plot Number is required');
        return;
      }

      // Save property as DRAFT first
      const { srNo, meters, rentalAgreement, ...restForm } = formData;
      const payload = {
        ...restForm,
        status: 'DRAFT',
        areaValue: Number(formData.areaValue) || 0,
        bedrooms: Number(formData.bedrooms) || 0,
        bathrooms: Number(formData.bathrooms) || 0,
        parking: Number(formData.parking) || 0,
        expectedRent: Number(formData.expectedRent) || 0,
        securityDeposit: Number(formData.securityDeposit) || 0,
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

      let propertyId;
      let createdProperty = null;
      
      if (editingProperty) {
        // If editing, update existing property to DRAFT
        const response = await updateProperty(editingProperty._id, payload);
        propertyId = editingProperty._id;
        createdProperty = editingProperty; // Keep existing property as editing
      } else {
        // Create new property as DRAFT
        const response = await createProperty(payload);
        propertyId = response.data?.data?._id || response.data?._id || response._id;
        if (!propertyId) {
          setError('Property created but ID not found in response');
          return;
        }
        // Set the created property as editingProperty to prevent duplicate creation
        createdProperty = response.data?.data || response.data || { _id: propertyId };
      }

      // Store draft property ID
      setDraftPropertyId(propertyId);
      
      // Set as editing property so subsequent saves will update instead of create
      if (createdProperty) {
        setEditingProperty(createdProperty);
      }

      // Pre-fill agreement form with property data (agreementNumber will be auto-generated)
      setAgreementForm({
        agreementNumber: '', // Will be auto-generated by backend
        propertyName: formData.propertyName || formData.plotNumber || '',
        propertyAddress: formData.address || '',
        tenantName: formData.tenantName || '',
        tenantContact: formData.tenantPhone || '',
        tenantIdCard: formData.tenantCNIC || '',
        monthlyRent: formData.expectedRent || '',
        securityDeposit: formData.securityDeposit || '',
        annualRentIncreaseType: 'percentage',
        annualRentIncreaseValue: '',
        startDate: dayjs().format('YYYY-MM-DD'),
        endDate: dayjs().add(1, 'year').format('YYYY-MM-DD'),
        terms: '',
        status: 'Active'
      });

      // Open agreement dialog
      setAgreementDialog(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create property as DRAFT');
    }
  };

  const handleSaveAgreement = async () => {
    try {
      if (!draftPropertyId) {
        setError('Draft property ID not found');
        return;
      }

      setSavingAgreement(true);
      setError('');

      // Validate required fields
      if (!agreementForm.tenantName?.trim()) {
        setError('Tenant Name is required');
        setSavingAgreement(false);
        return;
      }
      if (!agreementForm.tenantContact?.trim()) {
        setError('Tenant Contact is required');
        setSavingAgreement(false);
        return;
      }
      if (!agreementForm.propertyAddress?.trim()) {
        setError('Property Address is required');
        setSavingAgreement(false);
        return;
      }

      const payload = new FormData();
      Object.entries(agreementForm).forEach(([key, value]) => {
        payload.append(key, value ?? '');
      });
      
      // Ensure propertyAddress is always included (required field)
      // Get from agreementForm first, then fallback to formData
      const propertyAddress = agreementForm.propertyAddress || formData.address || formData.propertyAddress || '';
      payload.set('propertyAddress', propertyAddress);
      
      // Ensure propertyName is included
      const propertyName = agreementForm.propertyName || formData.propertyName || formData.plotNumber || '';
      payload.set('propertyName', propertyName);
      
      if (selectedAgreementFile) {
        payload.append('agreementImage', selectedAgreementFile);
      }

      // Create agreement
      const response = await api.post('/taj-rental-agreements', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const agreementId = response.data?._id || response.data?.data?._id;
      if (!agreementId) {
        setError('Agreement created but ID not found');
        return;
      }

      // Update property with agreement_id and set status to ACTIVE
      const updateResponse = await updateProperty(draftPropertyId, {
        rentalAgreement: agreementId,
        status: 'Active'
      });
      
      // Update editingProperty so form knows it's editing existing property
      // This prevents duplicate creation if user clicks Save on property form
      if (updateResponse?.data?.data) {
        setEditingProperty(updateResponse.data.data);
      } else if (updateResponse?.data) {
        setEditingProperty(updateResponse.data);
      } else if (editingProperty) {
        // If response doesn't have data, update the existing editingProperty
        setEditingProperty({
          ...editingProperty,
          rentalAgreement: agreementId,
          status: 'Active'
        });
      }

      // Update form data with agreement_id, status, and tenant fields
      setFormData((prev) => ({
        ...prev,
        rentalAgreement: agreementId,
        status: 'Active',
        tenantName: agreementForm.tenantName || prev.tenantName,
        tenantPhone: agreementForm.tenantContact || prev.tenantPhone,
        tenantCNIC: agreementForm.tenantIdCard || prev.tenantCNIC,
        expectedRent: agreementForm.monthlyRent || prev.expectedRent,
        securityDeposit: agreementForm.securityDeposit || prev.securityDeposit
      }));

      // Reload agreements
      await loadAgreements();

      // Close dialog and reset
      setAgreementDialog(false);
      setDraftPropertyId(null);
      setSelectedAgreementFile(null);
      setSuccess('Agreement created and property updated successfully');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create agreement');
    } finally {
      setSavingAgreement(false);
    }
  };

  const handleCloseAgreementDialog = () => {
    setAgreementDialog(false);
    setDraftPropertyId(null);
    setSelectedAgreementFile(null);
    setAgreementForm({
      agreementNumber: '', // Will be auto-generated
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
    });
    setError('');
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
                options={[...residents, { _id: 'ADD_NEW', name: 'Add New Resident...', isAddNew: true }]}
                getOptionLabel={(option) => {
                  if (typeof option === 'string') return option;
                  if (option.isAddNew) return option.name;
                  return option.name || '';
                }}
                value={residents.find(r => r.name === formData.ownerName) || null}
                onChange={(event, newValue) => {
                  if (!newValue) {
                    // Clear owner name if resident is deselected
                    setFormData((prev) => ({
                      ...prev,
                      ownerName: ''
                    }));
                    return;
                  }
                  
                  // Check if "Add New" option was selected
                  if (newValue.isAddNew) {
                    setNewResidentDialogContext('property');
                    setNewResidentDialog(true);
                    return;
                  }
                  
                  // Auto-fill related fields from resident data
                  setFormData((prev) => ({
                    ...prev,
                    ownerName: newValue.name || '',
                    contactNumber: newValue.contactNumber || prev.contactNumber,
                    address: newValue.address || prev.address
                  }));
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
                    label="Owner Name"
                    placeholder="Search by name, contact, or CNIC"
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
                          disabled={true}
                        >
                          <MenuItem value="">
                            {formData.rentalAgreement ? 'Agreement linked' : 'No agreement'}
                          </MenuItem>
                          {agreements.map((agreement) => (
                            <MenuItem key={agreement._id} value={agreement._id}>
                              {agreement.agreementNumber} — {agreement.propertyName}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleCreateAgreement}
                        sx={{ mt: 1 }}
                        fullWidth
                      >
                        Create Agreement
                      </Button>
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
              <Autocomplete
                freeSolo
                options={sectors}
                getOptionLabel={(option) => {
                  if (typeof option === 'string') {
                    return option;
                  }
                  return option.name || '';
                }}
                value={formData.sector || null}
                inputValue={formData.sector || ''}
                onInputChange={(event, newInputValue, reason) => {
                  // Update form data as user types
                  if (reason === 'input' || reason === 'clear') {
                    setFormData({ ...formData, sector: newInputValue });
                  }
                }}
                onChange={async (event, newValue) => {
                  if (typeof newValue === 'string') {
                    // User typed a new value - check if it exists, if not create it
                    const trimmedValue = newValue.trim();
                    if (trimmedValue) {
                      const exists = sectors.some(s => 
                        (s.name || s).toLowerCase() === trimmedValue.toLowerCase()
                      );
                      if (!exists) {
                        // Create new sector
                        await handleCreateNewSector(trimmedValue);
                      } else {
                        setFormData({ ...formData, sector: trimmedValue });
                      }
                    }
                  } else if (newValue) {
                    // User selected an existing sector
                    setFormData({ ...formData, sector: newValue.name || newValue });
                  } else {
                    // Cleared
                    setFormData({ ...formData, sector: '' });
                  }
                }}
                onBlur={async (event) => {
                  // When user leaves the field, if value doesn't exist, create it
                  const inputValue = event.target.value?.trim();
                  if (inputValue && inputValue !== formData.sector) {
                    const exists = sectors.some(s => 
                      (s.name || s).toLowerCase() === inputValue.toLowerCase()
                    );
                    if (!exists) {
                      await handleCreateNewSector(inputValue);
                    } else {
                      setFormData({ ...formData, sector: inputValue });
                    }
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Sector"
                    placeholder="Type to search or add new"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {sectorsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      )
                    }}
                  />
                )}
                loading={sectorsLoading}
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

      {/* Agreement Dialog */}
      <Dialog 
        open={agreementDialog} 
        onClose={handleCloseAgreementDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Rental Agreement</DialogTitle>
        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Agreement Number"
                value={agreementForm.agreementNumber || 'Auto-generated'}
                fullWidth
                disabled
                helperText="Agreement number will be auto-generated (last + 1)"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Property Name"
                value={agreementForm.propertyName}
                onChange={(e) => setAgreementForm({ ...agreementForm, propertyName: e.target.value })}
                fullWidth
                disabled
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Property Address"
                value={agreementForm.propertyAddress}
                onChange={(e) => setAgreementForm({ ...agreementForm, propertyAddress: e.target.value })}
                fullWidth
                multiline
                rows={2}
                disabled
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
                value={residents.find(r => r.name === agreementForm.tenantName) || null}
                onChange={async (event, newValue) => {
                  if (!newValue) {
                    setAgreementForm((prev) => ({
                      ...prev,
                      tenantName: '',
                      tenantContact: ''
                    }));
                    return;
                  }
                  
                  // Check if "Add New" option was selected
                  if (newValue.isAddNew) {
                    setNewResidentDialog(true);
                    return;
                  }
                  
                  // Auto-fill related fields from resident data
                  setAgreementForm((prev) => ({
                    ...prev,
                    tenantName: newValue.name || '',
                    tenantContact: newValue.contactNumber || prev.tenantContact,
                    tenantIdCard: newValue.cnic || prev.tenantIdCard
                  }));
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
                value={agreementForm.tenantContact}
                onChange={(e) => setAgreementForm({ ...agreementForm, tenantContact: e.target.value })}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Tenant CNIC"
                value={agreementForm.tenantIdCard}
                onChange={(e) => setAgreementForm({ ...agreementForm, tenantIdCard: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Monthly Rent (PKR)"
                type="number"
                value={agreementForm.monthlyRent}
                onChange={(e) => setAgreementForm({ ...agreementForm, monthlyRent: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Security Deposit (PKR)"
                type="number"
                value={agreementForm.securityDeposit}
                onChange={(e) => setAgreementForm({ ...agreementForm, securityDeposit: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Annual Rent Increase Type</InputLabel>
                <Select
                  value={agreementForm.annualRentIncreaseType}
                  label="Annual Rent Increase Type"
                  onChange={(e) => setAgreementForm({ ...agreementForm, annualRentIncreaseType: e.target.value })}
                >
                  <MenuItem value="percentage">Percentage</MenuItem>
                  <MenuItem value="fixed">Fixed Amount</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Annual Rent Increase Value"
                type="number"
                value={agreementForm.annualRentIncreaseValue}
                onChange={(e) => setAgreementForm({ ...agreementForm, annualRentIncreaseValue: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Start Date"
                type="date"
                value={agreementForm.startDate}
                onChange={(e) => setAgreementForm({ ...agreementForm, startDate: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="End Date"
                type="date"
                value={agreementForm.endDate}
                onChange={(e) => setAgreementForm({ ...agreementForm, endDate: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Terms & Conditions"
                multiline
                rows={4}
                value={agreementForm.terms}
                onChange={(e) => setAgreementForm({ ...agreementForm, terms: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <Box>
                <Button
                  variant="outlined"
                  component="label"
                  fullWidth
                  startIcon={<AddIcon />}
                  sx={{ mb: selectedAgreementFile ? 1 : 0 }}
                >
                  Upload Agreement Document
                  <input
                    ref={agreementFileInputRef}
                    type="file"
                    hidden
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file) {
                        // Check file size (10MB = 10 * 1024 * 1024 bytes)
                        const maxSize = 10 * 1024 * 1024;
                        if (file.size > maxSize) {
                          setError('File size must be less than 10 MB');
                          e.target.value = ''; // Clear the input
                          return;
                        }
                        setSelectedAgreementFile(file);
                        setError(''); // Clear any previous errors
                      } else {
                        setSelectedAgreementFile(null);
                      }
                    }}
                  />
                </Button>
                {selectedAgreementFile && (
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label={`${selectedAgreementFile.name} (${(selectedAgreementFile.size / (1024 * 1024)).toFixed(2)} MB)`}
                      onDelete={() => {
                        setSelectedAgreementFile(null);
                        // Clear the file input
                        if (agreementFileInputRef.current) {
                          agreementFileInputRef.current.value = '';
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
          <Button onClick={handleCloseAgreementDialog}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveAgreement}
            disabled={savingAgreement || !agreementForm.tenantName.trim() || !agreementForm.tenantContact.trim()}
          >
            {savingAgreement ? 'Saving...' : 'Create Agreement'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TajProperties;


