import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Divider,
  Alert,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormHelperText,
  CircularProgress
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../../services/api';

const workflowSteps = [
  'Patwari Contact',
  'Mauza Identification',
  'Khasra Extraction',
  'Land Type Classification',
  'Initial Survey',
  'Owner Preliminary Details',
  'Risk Identification',
  'Completion'
];

const provinces = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory', 'Gilgit-Baltistan', 'Azad Jammu and Kashmir'];
const landTypes = ['agricultural', 'residential', 'commercial', 'industrial', 'mixed_use', 'vacant', 'barren', 'forest', 'water_body', 'other'];
const areaUnits = ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'];
const riskTypes = ['legal', 'title', 'encroachment', 'dispute', 'environmental', 'access', 'utility', 'zoning', 'financial', 'other'];
const riskSeverities = ['low', 'medium', 'high', 'critical'];
const riskProbabilities = ['low', 'medium', 'high'];
const formTypes = ['fard', 'mutation', 'registry', 'noc', 'survey_report', 'ownership_certificate', 'tax_clearance', 'other'];
const roles = ['land_acquisition_manager', 'patwari', 'surveyor', 'legal_officer', 'finance_officer', 'field_officer', 'verification_officer', 'senior_manager', 'other'];

const LandIdentification = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [landData, setLandData] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    identificationNumber: '',
    status: 'draft',
    currentStep: 'patwari_contact',
    priority: 'medium',
    
    // Patwari Contact
    patwariContact: {
      patwariName: '',
      patwariContactNumber: '',
      patwariCNIC: '',
      patwariDesignation: '',
      tehsil: '',
      district: '',
      province: 'Punjab',
      contactDate: new Date().toISOString().split('T')[0],
      contactMethod: 'phone',
      contactNotes: '',
      isVerified: false
    },
    
    // Mauza Identification
    mauzaIdentification: {
      mauzaName: '',
      mauzaNumber: '',
      mauzaCode: '',
      unionCouncil: '',
      tehsil: '',
      district: '',
      province: 'Punjab',
      identifiedDate: new Date().toISOString().split('T')[0],
      verificationStatus: 'pending'
    },
    
    // Khasra Details
    khasraDetails: [],
    
    // Land Type
    landType: {
      primaryType: 'agricultural',
      secondaryType: '',
      currentUse: '',
      zoningStatus: 'pending'
    },
    
    // Initial Survey
    initialSurvey: {
      surveyDate: new Date().toISOString().split('T')[0],
      surveyTeam: [],
      physicalInspection: {
        conducted: false,
        inspectionDate: '',
        accessRoad: 'no',
        accessRoadDetails: '',
        topography: 'flat',
        soilCondition: 'fertile',
        waterAvailability: 'not_available',
        electricityAvailability: 'not_available',
        gasAvailability: 'not_available',
        nearbyFacilities: [],
        environmentalFactors: [],
        photographs: [],
        surveyReport: ''
      }
    },
    
    // Owner Details
    ownerDetails: [],
    
    // Risks
    risks: [],
    
    // Forms Required
    formsRequired: [],
    
    // Roles Involved
    rolesInvolved: [],
    
    description: '',
    notes: ''
  });

  useEffect(() => {
    if (id) {
      fetchLandIdentification();
    }
  }, [id]);

  const fetchLandIdentification = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/taj-residencia/land-identification/${id}`);
      if (response.data.success) {
        const data = response.data.data;
        setLandData(data);
        setFormData({
          ...data,
          patwariContact: {
            ...data.patwariContact,
            contactDate: data.patwariContact?.contactDate ? new Date(data.patwariContact.contactDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          mauzaIdentification: {
            ...data.mauzaIdentification,
            identifiedDate: data.mauzaIdentification?.identifiedDate ? new Date(data.mauzaIdentification.identifiedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          initialSurvey: {
            ...data.initialSurvey,
            surveyDate: data.initialSurvey?.surveyDate ? new Date(data.initialSurvey.surveyDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            physicalInspection: {
              ...data.initialSurvey?.physicalInspection,
              inspectionDate: data.initialSurvey?.physicalInspection?.inspectionDate ? new Date(data.initialSurvey.physicalInspection.inspectionDate).toISOString().split('T')[0] : ''
            }
          }
        });
        
        // Set active step based on currentStep
        const stepIndex = workflowSteps.findIndex(step => 
          data.currentStep === step.toLowerCase().replace(/\s+/g, '_')
        );
        if (stepIndex !== -1) {
          setActiveStep(stepIndex);
        }
      }
    } catch (error) {
      console.error('Error fetching land identification:', error);
      showSnackbar('Error fetching land identification data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleNext = () => {
    if (activeStep < workflowSteps.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleSave = async (updateStep = false) => {
    setSaving(true);
    try {
      const stepNames = ['patwari_contact', 'mauza_identification', 'khasra_extraction', 'land_type_classification', 'initial_survey', 'owner_preliminary_details', 'risk_identification', 'completion'];
      const dataToSave = {
        ...formData,
        currentStep: stepNames[activeStep],
        status: activeStep === workflowSteps.length - 1 ? 'completed' : formData.status
      };

      let response;
      if (id) {
        response = await api.put(`/taj-residencia/land-identification/${id}`, dataToSave);
      } else {
        response = await api.post('/taj-residencia/land-identification', dataToSave);
        if (response.data.success) {
          navigate(`/taj-residencia/land-acquisition/land-identification/${response.data.data._id}`);
        }
      }

      if (response.data.success) {
        showSnackbar('Land identification saved successfully', 'success');
        if (!id && response.data.data._id) {
          setLandData(response.data.data);
        }
      }
    } catch (error) {
      console.error('Error saving land identification:', error);
      showSnackbar('Error saving land identification', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (path, value) => {
    const keys = path.split('.');
    setFormData(prev => {
      const newData = { ...prev };
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const addKhasra = () => {
    setFormData(prev => ({
      ...prev,
      khasraDetails: [...prev.khasraDetails, {
        khasraNumber: '',
        khatuniNumber: '',
        area: { value: 0, unit: 'kanal' },
        location: '',
        boundaries: { north: '', south: '', east: '', west: '' }
      }]
    }));
  };

  const removeKhasra = (index) => {
    setFormData(prev => ({
      ...prev,
      khasraDetails: prev.khasraDetails.filter((_, i) => i !== index)
    }));
  };

  const addOwner = () => {
    setFormData(prev => ({
      ...prev,
      ownerDetails: [...prev.ownerDetails, {
        ownerName: '',
        ownerCNIC: '',
        ownerContactNumber: '',
        ownerAddress: { street: '', city: '', district: '', province: '', postalCode: '' },
        ownershipType: 'sole_owner',
        ownershipPercentage: 100,
        isPrimaryOwner: false
      }]
    }));
  };

  const removeOwner = (index) => {
    setFormData(prev => ({
      ...prev,
      ownerDetails: prev.ownerDetails.filter((_, i) => i !== index)
    }));
  };

  const addRisk = () => {
    setFormData(prev => ({
      ...prev,
      risks: [...prev.risks, {
        riskType: 'legal',
        riskDescription: '',
        severity: 'medium',
        probability: 'medium',
        impact: '',
        mitigationStrategy: '',
        status: 'open'
      }]
    }));
  };

  const removeRisk = (index) => {
    setFormData(prev => ({
      ...prev,
      risks: prev.risks.filter((_, i) => i !== index)
    }));
  };

  const addForm = () => {
    setFormData(prev => ({
      ...prev,
      formsRequired: [...prev.formsRequired, {
        formName: '',
        formType: 'other',
        status: 'required'
      }]
    }));
  };

  const removeForm = (index) => {
    setFormData(prev => ({
      ...prev,
      formsRequired: prev.formsRequired.filter((_, i) => i !== index)
    }));
  };

  const addRole = () => {
    setFormData(prev => ({
      ...prev,
      rolesInvolved: [...prev.rolesInvolved, {
        role: 'other',
        personName: '',
        contactNumber: '',
        involvementDate: new Date().toISOString().split('T')[0],
        responsibilities: []
      }]
    }));
  };

  const removeRole = (index) => {
    setFormData(prev => ({
      ...prev,
      rolesInvolved: prev.rolesInvolved.filter((_, i) => i !== index)
    }));
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Patwari Contact
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 1: Patwari Contact</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Contact the local Patwari to initiate land identification process. Record all contact details and verification status.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Patwari Name *"
                    value={formData.patwariContact.patwariName}
                    onChange={(e) => handleInputChange('patwariContact.patwariName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Contact Number *"
                    value={formData.patwariContact.patwariContactNumber}
                    onChange={(e) => handleInputChange('patwariContact.patwariContactNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="CNIC"
                    value={formData.patwariContact.patwariCNIC}
                    onChange={(e) => handleInputChange('patwariContact.patwariCNIC', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Designation"
                    value={formData.patwariContact.patwariDesignation}
                    onChange={(e) => handleInputChange('patwariContact.patwariDesignation', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Province *</InputLabel>
                    <Select
                      value={formData.patwariContact.province}
                      onChange={(e) => handleInputChange('patwariContact.province', e.target.value)}
                    >
                      {provinces.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="District *"
                    value={formData.patwariContact.district}
                    onChange={(e) => handleInputChange('patwariContact.district', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Tehsil *"
                    value={formData.patwariContact.tehsil}
                    onChange={(e) => handleInputChange('patwariContact.tehsil', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Contact Date *"
                    value={formData.patwariContact.contactDate}
                    onChange={(e) => handleInputChange('patwariContact.contactDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Contact Method</InputLabel>
                    <Select
                      value={formData.patwariContact.contactMethod}
                      onChange={(e) => handleInputChange('patwariContact.contactMethod', e.target.value)}
                    >
                      <MenuItem value="phone">Phone</MenuItem>
                      <MenuItem value="in_person">In Person</MenuItem>
                      <MenuItem value="official_letter">Official Letter</MenuItem>
                      <MenuItem value="email">Email</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Contact Notes"
                    value={formData.patwariContact.contactNotes}
                    onChange={(e) => handleInputChange('patwariContact.contactNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 1: // Mauza Identification
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 2: Mauza Identification</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Identify and verify the Mauza (revenue estate) where the land is located. Record Mauza name, number, and administrative details.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Mauza Name *"
                    value={formData.mauzaIdentification.mauzaName}
                    onChange={(e) => handleInputChange('mauzaIdentification.mauzaName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Mauza Number"
                    value={formData.mauzaIdentification.mauzaNumber}
                    onChange={(e) => handleInputChange('mauzaIdentification.mauzaNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Mauza Code"
                    value={formData.mauzaIdentification.mauzaCode}
                    onChange={(e) => handleInputChange('mauzaIdentification.mauzaCode', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Union Council"
                    value={formData.mauzaIdentification.unionCouncil}
                    onChange={(e) => handleInputChange('mauzaIdentification.unionCouncil', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Province *</InputLabel>
                    <Select
                      value={formData.mauzaIdentification.province}
                      onChange={(e) => handleInputChange('mauzaIdentification.province', e.target.value)}
                    >
                      {provinces.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="District *"
                    value={formData.mauzaIdentification.district}
                    onChange={(e) => handleInputChange('mauzaIdentification.district', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Tehsil *"
                    value={formData.mauzaIdentification.tehsil}
                    onChange={(e) => handleInputChange('mauzaIdentification.tehsil', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Identified Date"
                    value={formData.mauzaIdentification.identifiedDate}
                    onChange={(e) => handleInputChange('mauzaIdentification.identifiedDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Verification Status</InputLabel>
                    <Select
                      value={formData.mauzaIdentification.verificationStatus}
                      onChange={(e) => handleInputChange('mauzaIdentification.verificationStatus', e.target.value)}
                    >
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="verified">Verified</MenuItem>
                      <MenuItem value="rejected">Rejected</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 2: // Khasra Extraction
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 3: Khasra Extraction</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Extract Khasra numbers from revenue records. Record all Khasra numbers, areas, and boundary details.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1">Khasra Details</Typography>
                <Button startIcon={<AddIcon />} onClick={addKhasra} variant="outlined" size="small">
                  Add Khasra
                </Button>
              </Box>
              {formData.khasraDetails.map((khasra, index) => (
                <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle2">Khasra #{index + 1}</Typography>
                      <IconButton size="small" onClick={() => removeKhasra(index)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Khasra Number *"
                          value={khasra.khasraNumber}
                          onChange={(e) => {
                            const newKhasras = [...formData.khasraDetails];
                            newKhasras[index].khasraNumber = e.target.value;
                            setFormData(prev => ({ ...prev, khasraDetails: newKhasras }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Khatuni Number"
                          value={khasra.khatuniNumber}
                          onChange={(e) => {
                            const newKhasras = [...formData.khasraDetails];
                            newKhasras[index].khatuniNumber = e.target.value;
                            setFormData(prev => ({ ...prev, khasraDetails: newKhasras }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Grid container spacing={1}>
                          <Grid item xs={8}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label="Area Value"
                              value={khasra.area?.value || 0}
                              onChange={(e) => {
                                const newKhasras = [...formData.khasraDetails];
                                newKhasras[index].area = { ...newKhasras[index].area, value: parseFloat(e.target.value) || 0 };
                                setFormData(prev => ({ ...prev, khasraDetails: newKhasras }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Unit</InputLabel>
                              <Select
                                value={khasra.area?.unit || 'kanal'}
                                onChange={(e) => {
                                  const newKhasras = [...formData.khasraDetails];
                                  newKhasras[index].area = { ...newKhasras[index].area, unit: e.target.value };
                                  setFormData(prev => ({ ...prev, khasraDetails: newKhasras }));
                                }}
                              >
                                {areaUnits.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                        </Grid>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Location"
                          value={khasra.location || ''}
                          onChange={(e) => {
                            const newKhasras = [...formData.khasraDetails];
                            newKhasras[index].location = e.target.value;
                            setFormData(prev => ({ ...prev, khasraDetails: newKhasras }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="North Boundary"
                          value={khasra.boundaries?.north || ''}
                          onChange={(e) => {
                            const newKhasras = [...formData.khasraDetails];
                            if (!newKhasras[index].boundaries) newKhasras[index].boundaries = {};
                            newKhasras[index].boundaries.north = e.target.value;
                            setFormData(prev => ({ ...prev, khasraDetails: newKhasras }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="South Boundary"
                          value={khasra.boundaries?.south || ''}
                          onChange={(e) => {
                            const newKhasras = [...formData.khasraDetails];
                            if (!newKhasras[index].boundaries) newKhasras[index].boundaries = {};
                            newKhasras[index].boundaries.south = e.target.value;
                            setFormData(prev => ({ ...prev, khasraDetails: newKhasras }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="East Boundary"
                          value={khasra.boundaries?.east || ''}
                          onChange={(e) => {
                            const newKhasras = [...formData.khasraDetails];
                            if (!newKhasras[index].boundaries) newKhasras[index].boundaries = {};
                            newKhasras[index].boundaries.east = e.target.value;
                            setFormData(prev => ({ ...prev, khasraDetails: newKhasras }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="West Boundary"
                          value={khasra.boundaries?.west || ''}
                          onChange={(e) => {
                            const newKhasras = [...formData.khasraDetails];
                            if (!newKhasras[index].boundaries) newKhasras[index].boundaries = {};
                            newKhasras[index].boundaries.west = e.target.value;
                            setFormData(prev => ({ ...prev, khasraDetails: newKhasras }));
                          }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
              {formData.khasraDetails.length === 0 && (
                <Alert severity="info">No Khasra details added yet. Click "Add Khasra" to add one.</Alert>
              )}
            </CardContent>
          </Card>
        );

      case 3: // Land Type Classification
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 4: Land Type Classification</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Classify the land type and current use. Determine zoning status and any secondary classifications.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Primary Land Type *</InputLabel>
                    <Select
                      value={formData.landType.primaryType}
                      onChange={(e) => handleInputChange('landType.primaryType', e.target.value)}
                    >
                      {landTypes.map(t => <MenuItem key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Secondary Type"
                    value={formData.landType.secondaryType}
                    onChange={(e) => handleInputChange('landType.secondaryType', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Current Use"
                    value={formData.landType.currentUse}
                    onChange={(e) => handleInputChange('landType.currentUse', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Zoning Status</InputLabel>
                    <Select
                      value={formData.landType.zoningStatus}
                      onChange={(e) => handleInputChange('landType.zoningStatus', e.target.value)}
                    >
                      <MenuItem value="approved">Approved</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="not_zoned">Not Zoned</MenuItem>
                      <MenuItem value="under_review">Under Review</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 4: // Initial Survey
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 5: Initial Survey</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Conduct physical inspection and initial survey. Record topography, soil condition, utility availability, and nearby facilities.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Survey Date"
                    value={formData.initialSurvey.surveyDate}
                    onChange={(e) => handleInputChange('initialSurvey.surveyDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Topography</InputLabel>
                    <Select
                      value={formData.initialSurvey.physicalInspection.topography}
                      onChange={(e) => handleInputChange('initialSurvey.physicalInspection.topography', e.target.value)}
                    >
                      <MenuItem value="flat">Flat</MenuItem>
                      <MenuItem value="sloping">Sloping</MenuItem>
                      <MenuItem value="hilly">Hilly</MenuItem>
                      <MenuItem value="mixed">Mixed</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Soil Condition</InputLabel>
                    <Select
                      value={formData.initialSurvey.physicalInspection.soilCondition}
                      onChange={(e) => handleInputChange('initialSurvey.physicalInspection.soilCondition', e.target.value)}
                    >
                      <MenuItem value="fertile">Fertile</MenuItem>
                      <MenuItem value="barren">Barren</MenuItem>
                      <MenuItem value="rocky">Rocky</MenuItem>
                      <MenuItem value="sandy">Sandy</MenuItem>
                      <MenuItem value="clay">Clay</MenuItem>
                      <MenuItem value="mixed">Mixed</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Water Availability</InputLabel>
                    <Select
                      value={formData.initialSurvey.physicalInspection.waterAvailability}
                      onChange={(e) => handleInputChange('initialSurvey.physicalInspection.waterAvailability', e.target.value)}
                    >
                      <MenuItem value="available">Available</MenuItem>
                      <MenuItem value="not_available">Not Available</MenuItem>
                      <MenuItem value="partial">Partial</MenuItem>
                      <MenuItem value="under_construction">Under Construction</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Access Road</InputLabel>
                    <Select
                      value={formData.initialSurvey.physicalInspection.accessRoad}
                      onChange={(e) => handleInputChange('initialSurvey.physicalInspection.accessRoad', e.target.value)}
                    >
                      <MenuItem value="yes">Yes</MenuItem>
                      <MenuItem value="no">No</MenuItem>
                      <MenuItem value="partial">Partial</MenuItem>
                      <MenuItem value="under_construction">Under Construction</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Survey Report"
                    value={formData.initialSurvey.physicalInspection.surveyReport}
                    onChange={(e) => handleInputChange('initialSurvey.physicalInspection.surveyReport', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 5: // Owner Preliminary Details
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 6: Owner Preliminary Details</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Collect preliminary owner information including name, CNIC, contact details, and ownership type.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1">Owner Details</Typography>
                <Button startIcon={<AddIcon />} onClick={addOwner} variant="outlined" size="small">
                  Add Owner
                </Button>
              </Box>
              {formData.ownerDetails.map((owner, index) => (
                <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle2">Owner #{index + 1}</Typography>
                      <IconButton size="small" onClick={() => removeOwner(index)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Owner Name *"
                          value={owner.ownerName}
                          onChange={(e) => {
                            const newOwners = [...formData.ownerDetails];
                            newOwners[index].ownerName = e.target.value;
                            setFormData(prev => ({ ...prev, ownerDetails: newOwners }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="CNIC *"
                          value={owner.ownerCNIC}
                          onChange={(e) => {
                            const newOwners = [...formData.ownerDetails];
                            newOwners[index].ownerCNIC = e.target.value;
                            setFormData(prev => ({ ...prev, ownerDetails: newOwners }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Contact Number"
                          value={owner.ownerContactNumber}
                          onChange={(e) => {
                            const newOwners = [...formData.ownerDetails];
                            newOwners[index].ownerContactNumber = e.target.value;
                            setFormData(prev => ({ ...prev, ownerDetails: newOwners }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Ownership Type</InputLabel>
                          <Select
                            value={owner.ownershipType}
                            onChange={(e) => {
                              const newOwners = [...formData.ownerDetails];
                              newOwners[index].ownershipType = e.target.value;
                              setFormData(prev => ({ ...prev, ownerDetails: newOwners }));
                            }}
                          >
                            <MenuItem value="sole_owner">Sole Owner</MenuItem>
                            <MenuItem value="joint_owner">Joint Owner</MenuItem>
                            <MenuItem value="heirs">Heirs</MenuItem>
                            <MenuItem value="power_of_attorney">Power of Attorney</MenuItem>
                            <MenuItem value="trust">Trust</MenuItem>
                            <MenuItem value="company">Company</MenuItem>
                            <MenuItem value="government">Government</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="Ownership Percentage"
                          value={owner.ownershipPercentage || 100}
                          onChange={(e) => {
                            const newOwners = [...formData.ownerDetails];
                            newOwners[index].ownershipPercentage = parseFloat(e.target.value) || 0;
                            setFormData(prev => ({ ...prev, ownerDetails: newOwners }));
                          }}
                          inputProps={{ min: 0, max: 100 }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
              {formData.ownerDetails.length === 0 && (
                <Alert severity="info">No owner details added yet. Click "Add Owner" to add one.</Alert>
              )}
            </CardContent>
          </Card>
        );

      case 6: // Risk Identification
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 7: Risk Identification</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Identify and assess risks associated with the land acquisition. Document risk type, severity, probability, and mitigation strategies.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1">Risks</Typography>
                <Button startIcon={<AddIcon />} onClick={addRisk} variant="outlined" size="small">
                  Add Risk
                </Button>
              </Box>
              {formData.risks.map((risk, index) => (
                <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle2">Risk #{index + 1}</Typography>
                      <IconButton size="small" onClick={() => removeRisk(index)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Risk Type *</InputLabel>
                          <Select
                            value={risk.riskType}
                            onChange={(e) => {
                              const newRisks = [...formData.risks];
                              newRisks[index].riskType = e.target.value;
                              setFormData(prev => ({ ...prev, risks: newRisks }));
                            }}
                          >
                            {riskTypes.map(t => <MenuItem key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Severity</InputLabel>
                          <Select
                            value={risk.severity}
                            onChange={(e) => {
                              const newRisks = [...formData.risks];
                              newRisks[index].severity = e.target.value;
                              setFormData(prev => ({ ...prev, risks: newRisks }));
                            }}
                          >
                            {riskSeverities.map(s => <MenuItem key={s} value={s}>{s.toUpperCase()}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Probability</InputLabel>
                          <Select
                            value={risk.probability}
                            onChange={(e) => {
                              const newRisks = [...formData.risks];
                              newRisks[index].probability = e.target.value;
                              setFormData(prev => ({ ...prev, risks: newRisks }));
                            }}
                          >
                            {riskProbabilities.map(p => <MenuItem key={p} value={p}>{p.toUpperCase()}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={2}
                          label="Risk Description *"
                          value={risk.riskDescription}
                          onChange={(e) => {
                            const newRisks = [...formData.risks];
                            newRisks[index].riskDescription = e.target.value;
                            setFormData(prev => ({ ...prev, risks: newRisks }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={2}
                          label="Impact"
                          value={risk.impact || ''}
                          onChange={(e) => {
                            const newRisks = [...formData.risks];
                            newRisks[index].impact = e.target.value;
                            setFormData(prev => ({ ...prev, risks: newRisks }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={2}
                          label="Mitigation Strategy"
                          value={risk.mitigationStrategy || ''}
                          onChange={(e) => {
                            const newRisks = [...formData.risks];
                            newRisks[index].mitigationStrategy = e.target.value;
                            setFormData(prev => ({ ...prev, risks: newRisks }));
                          }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
              {formData.risks.length === 0 && (
                <Alert severity="info">No risks identified yet. Click "Add Risk" to add one.</Alert>
              )}
            </CardContent>
          </Card>
        );

      case 7: // Completion - Forms Required & Roles
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Forms Required</Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    List all forms and documents required for this land identification process.
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2">Required Forms</Typography>
                    <Button startIcon={<AddIcon />} onClick={addForm} variant="outlined" size="small">
                      Add Form
                    </Button>
                  </Box>
                  {formData.formsRequired.map((form, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" fontWeight="bold">Form #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeForm(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Form Name *"
                              value={form.formName}
                              onChange={(e) => {
                                const newForms = [...formData.formsRequired];
                                newForms[index].formName = e.target.value;
                                setFormData(prev => ({ ...prev, formsRequired: newForms }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Form Type</InputLabel>
                              <Select
                                value={form.formType}
                                onChange={(e) => {
                                  const newForms = [...formData.formsRequired];
                                  newForms[index].formType = e.target.value;
                                  setFormData(prev => ({ ...prev, formsRequired: newForms }));
                                }}
                              >
                                {formTypes.map(t => <MenuItem key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Status</InputLabel>
                              <Select
                                value={form.status}
                                onChange={(e) => {
                                  const newForms = [...formData.formsRequired];
                                  newForms[index].status = e.target.value;
                                  setFormData(prev => ({ ...prev, formsRequired: newForms }));
                                }}
                              >
                                <MenuItem value="required">Required</MenuItem>
                                <MenuItem value="submitted">Submitted</MenuItem>
                                <MenuItem value="verified">Verified</MenuItem>
                                <MenuItem value="rejected">Rejected</MenuItem>
                                <MenuItem value="pending_verification">Pending Verification</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                  {formData.formsRequired.length === 0 && (
                    <Alert severity="info">No forms added yet. Click "Add Form" to add one.</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Roles Involved</Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Document all personnel and their roles in the land identification process.
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2">Personnel</Typography>
                    <Button startIcon={<AddIcon />} onClick={addRole} variant="outlined" size="small">
                      Add Role
                    </Button>
                  </Box>
                  {formData.rolesInvolved.map((role, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" fontWeight="bold">Role #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeRole(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Role</InputLabel>
                              <Select
                                value={role.role}
                                onChange={(e) => {
                                  const newRoles = [...formData.rolesInvolved];
                                  newRoles[index].role = e.target.value;
                                  setFormData(prev => ({ ...prev, rolesInvolved: newRoles }));
                                }}
                              >
                                {roles.map(r => <MenuItem key={r} value={r}>{r.replace('_', ' ').toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Person Name *"
                              value={role.personName}
                              onChange={(e) => {
                                const newRoles = [...formData.rolesInvolved];
                                newRoles[index].personName = e.target.value;
                                setFormData(prev => ({ ...prev, rolesInvolved: newRoles }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Contact Number"
                              value={role.contactNumber || ''}
                              onChange={(e) => {
                                const newRoles = [...formData.rolesInvolved];
                                newRoles[index].contactNumber = e.target.value;
                                setFormData(prev => ({ ...prev, rolesInvolved: newRoles }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              type="date"
                              label="Involvement Date"
                              value={role.involvementDate}
                              onChange={(e) => {
                                const newRoles = [...formData.rolesInvolved];
                                newRoles[index].involvementDate = e.target.value;
                                setFormData(prev => ({ ...prev, rolesInvolved: newRoles }));
                              }}
                              InputLabelProps={{ shrink: true }}
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                  {formData.rolesInvolved.length === 0 && (
                    <Alert severity="info">No roles added yet. Click "Add Role" to add one.</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>General Information</Typography>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Priority</InputLabel>
                        <Select
                          value={formData.priority}
                          onChange={(e) => handleInputChange('priority', e.target.value)}
                        >
                          <MenuItem value="low">Low</MenuItem>
                          <MenuItem value="medium">Medium</MenuItem>
                          <MenuItem value="high">High</MenuItem>
                          <MenuItem value="urgent">Urgent</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Description"
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Notes"
                        value={formData.notes}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Land Identification {id ? '(Edit)' : '(New)'}
      </Typography>
      
      <Paper sx={{ p: 3, mt: 2 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {workflowSteps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ mt: 4 }}>
          {renderStepContent()}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            disabled={activeStep === 0}
          >
            Back
          </Button>
          <Box>
            <Button
              startIcon={<SaveIcon />}
              onClick={() => handleSave()}
              variant="outlined"
              sx={{ mr: 2 }}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              endIcon={<ArrowForwardIcon />}
              onClick={handleNext}
              variant="contained"
              disabled={activeStep === workflowSteps.length - 1}
            >
              Next
            </Button>
          </Box>
        </Box>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default LandIdentification;
