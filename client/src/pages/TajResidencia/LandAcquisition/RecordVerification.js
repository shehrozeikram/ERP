import React, { useState, useEffect, useCallback } from 'react';
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
  IconButton,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Autocomplete
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../../services/api';

const workflowSteps = [
  'Jamabandi Review',
  'Fard Verification',
  'Khatauni Verification',
  'Tehsildar Verification',
  'ARC Check',
  'Dispute Identification',
  'Fraud Detection',
  'Completion'
];

const areaUnits = ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'];
const disputeTypes = ['ownership', 'boundary', 'area', 'encumbrance', 'mutation', 'revenue', 'other'];
const disputeSeverities = ['low', 'medium', 'high', 'critical'];
const fraudCheckTypes = ['document_authenticity', 'signature_verification', 'stamp_verification', 'record_tampering', 'identity_verification', 'ownership_chain', 'other'];
const fraudFindings = ['clean', 'suspicious', 'fraudulent'];
const formTypes = ['jamabandi', 'fard', 'khatauni', 'tehsildar_certificate', 'arc_report', 'noc', 'affidavit', 'other'];
const verificationTypes = ['oral', 'written', 'official_letter', 'stamp_paper', 'affidavit'];

const RecordVerification = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [landIdentifications, setLandIdentifications] = useState([]);
  
  const [formData, setFormData] = useState({
    verificationNumber: '',
    landIdentification: '',
    status: 'draft',
    currentStep: 'jamabandi_review',
    priority: 'medium',
    
    // Jamabandi
    jamabandi: {
      jamabandiYear: '',
      jamabandiNumber: '',
      reviewedDate: new Date().toISOString().split('T')[0],
      recordDetails: {
        ownerName: '',
        fatherName: '',
        cnic: '',
        area: { value: 0, unit: 'kanal' },
        landType: '',
        cultivationStatus: '',
        revenueRate: 0,
        totalRevenue: 0
      },
      discrepancies: [],
      isVerified: false,
      verificationNotes: ''
    },
    
    // Fard
    fard: {
      fardNumber: '',
      fardDate: '',
      obtainedDate: new Date().toISOString().split('T')[0],
      issuedBy: {
        name: '',
        designation: '',
        office: '',
        contactNumber: ''
      },
      fardDetails: {
        mauzaName: '',
        mauzaNumber: '',
        khasraNumbers: [],
        totalArea: { value: 0, unit: 'kanal' },
        ownershipDetails: [],
        encumbrances: [],
        mutations: []
      },
      isVerified: false,
      verificationNotes: ''
    },
    
    // Khatauni
    khatauni: {
      khatauniNumber: '',
      khatauniYear: '',
      verifiedDate: new Date().toISOString().split('T')[0],
      khatauniDetails: {
        khatuniNumber: '',
        ownerName: '',
        fatherName: '',
        cnic: '',
        area: { value: 0, unit: 'kanal' },
        khasraNumbers: [],
        cultivationDetails: {
          cropType: '',
          cultivationStatus: '',
          irrigationType: ''
        },
        revenueDetails: {
          revenueRate: 0,
          totalRevenue: 0,
          paymentStatus: ''
        }
      },
      discrepancies: [],
      isVerified: false,
      verificationNotes: ''
    },
    
    // Tehsildar Verification
    tehsildarVerification: {
      tehsildarName: '',
      tehsildarOffice: '',
      tehsildarContact: '',
      verificationDate: new Date().toISOString().split('T')[0],
      verificationType: 'written',
      verificationDetails: {
        recordAccuracy: 'accurate',
        ownershipConfirmed: false,
        areaConfirmed: false,
        boundariesConfirmed: false,
        encumbrancesConfirmed: false,
        remarks: ''
      },
      isVerified: false,
      verificationNotes: ''
    },
    
    // ARC Check
    arcCheck: {
      arcNumber: '',
      checkedDate: new Date().toISOString().split('T')[0],
      arcDetails: {
        mauzaCode: '',
        mauzaName: '',
        khasraNumbers: [],
        ownerName: '',
        cnic: '',
        area: { value: 0, unit: 'kanal' },
        recordStatus: 'active',
        lastUpdated: '',
        mutations: []
      },
      discrepancies: [],
      isVerified: false,
      verificationNotes: ''
    },
    
    // Disputes
    disputes: [],
    
    // Fraud Checks
    fraudChecks: [],
    
    // Forms Checklist
    formsChecklist: [],
    
    // Verification Checklist
    verificationChecklist: {
      jamabandiReviewed: false,
      fardObtained: false,
      khatauniVerified: false,
      tehsildarVerified: false,
      arcChecked: false,
      disputesIdentified: false,
      fraudChecked: false,
      allDocumentsVerified: false,
      ownershipConfirmed: false,
      areaConfirmed: false,
      boundariesConfirmed: false
    },
    
    description: '',
    notes: ''
  });

  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const fetchRecordVerification = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/taj-residencia/record-verification/${id}`);
      if (response.data.success) {
        const data = response.data.data;
        setFormData({
          ...data,
          jamabandi: {
            ...data.jamabandi,
            reviewedDate: data.jamabandi?.reviewedDate ? new Date(data.jamabandi.reviewedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          fard: {
            ...data.fard,
            obtainedDate: data.fard?.obtainedDate ? new Date(data.fard.obtainedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            fardDate: data.fard?.fardDate ? new Date(data.fard.fardDate).toISOString().split('T')[0] : ''
          },
          khatauni: {
            ...data.khatauni,
            verifiedDate: data.khatauni?.verifiedDate ? new Date(data.khatauni.verifiedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          tehsildarVerification: {
            ...data.tehsildarVerification,
            verificationDate: data.tehsildarVerification?.verificationDate ? new Date(data.tehsildarVerification.verificationDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          arcCheck: {
            ...data.arcCheck,
            checkedDate: data.arcCheck?.checkedDate ? new Date(data.arcCheck.checkedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            arcDetails: {
              ...data.arcCheck?.arcDetails,
              lastUpdated: data.arcCheck?.arcDetails?.lastUpdated ? new Date(data.arcCheck.arcDetails.lastUpdated).toISOString().split('T')[0] : ''
            }
          }
        });
        
        const stepIndex = workflowSteps.findIndex(step => 
          data.currentStep === step.toLowerCase().replace(/\s+/g, '_')
        );
        if (stepIndex !== -1) {
          setActiveStep(stepIndex);
        }
      }
    } catch (error) {
      console.error('Error fetching record verification:', error);
      showSnackbar('Error fetching record verification data', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showSnackbar]);

  useEffect(() => {
    fetchLandIdentifications();
    if (id) {
      fetchRecordVerification();
    }
  }, [id, fetchRecordVerification]);

  const fetchLandIdentifications = async () => {
    try {
      const response = await api.get('/taj-residencia/land-identification', { params: { limit: 1000 } });
      if (response.data.success) {
        setLandIdentifications(response.data.data.docs || []);
      }
    } catch (error) {
      console.error('Error fetching land identifications:', error);
    }
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const stepNames = ['jamabandi_review', 'fard_verification', 'khatauni_verification', 'tehsildar_verification', 'arc_check', 'dispute_identification', 'fraud_detection', 'completion'];
      const dataToSave = {
        ...formData,
        currentStep: stepNames[activeStep],
        status: activeStep === workflowSteps.length - 1 ? 'completed' : formData.status
      };

      let response;
      if (id) {
        response = await api.put(`/taj-residencia/record-verification/${id}`, dataToSave);
      } else {
        response = await api.post('/taj-residencia/record-verification', dataToSave);
        if (response.data.success) {
          navigate(`/taj-residencia/land-acquisition/record-verification/${response.data.data._id}`);
        }
      }

      if (response.data.success) {
        showSnackbar('Record verification saved successfully', 'success');
      }
    } catch (error) {
      console.error('Error saving record verification:', error);
      showSnackbar('Error saving record verification', 'error');
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

  const addDiscrepancy = (section) => {
    const newDiscrepancy = {
      field: '',
      description: '',
      severity: 'medium',
      resolution: '',
      resolved: false
    };
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        discrepancies: [...(prev[section].discrepancies || []), newDiscrepancy]
      }
    }));
  };

  const removeDiscrepancy = (section, index) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        discrepancies: prev[section].discrepancies.filter((_, i) => i !== index)
      }
    }));
  };

  const addDispute = () => {
    setFormData(prev => ({
      ...prev,
      disputes: [...prev.disputes, {
        disputeType: 'ownership',
        disputeDescription: '',
        partiesInvolved: [],
        disputeDate: new Date().toISOString().split('T')[0],
        severity: 'medium',
        impact: '',
        resolutionStatus: 'open',
        resolutionNotes: ''
      }]
    }));
  };

  const removeDispute = (index) => {
    setFormData(prev => ({
      ...prev,
      disputes: prev.disputes.filter((_, i) => i !== index)
    }));
  };

  const addFraudCheck = () => {
    setFormData(prev => ({
      ...prev,
      fraudChecks: [...prev.fraudChecks, {
        checkType: 'document_authenticity',
        checkDescription: '',
        checkedDate: new Date().toISOString().split('T')[0],
        findings: 'clean',
        findingsDetails: '',
        redFlags: [],
        recommendations: '',
        actionTaken: ''
      }]
    }));
  };

  const removeFraudCheck = (index) => {
    setFormData(prev => ({
      ...prev,
      fraudChecks: prev.fraudChecks.filter((_, i) => i !== index)
    }));
  };

  const addForm = () => {
    setFormData(prev => ({
      ...prev,
      formsChecklist: [...prev.formsChecklist, {
        formName: '',
        formType: 'other',
        status: 'required'
      }]
    }));
  };

  const removeForm = (index) => {
    setFormData(prev => ({
      ...prev,
      formsChecklist: prev.formsChecklist.filter((_, i) => i !== index)
    }));
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Jamabandi Review
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 1: Jamabandi Review</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Review the Jamabandi (revenue record) for the land. Verify ownership, area, land type, and revenue details.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Jamabandi Year *"
                    value={formData.jamabandi.jamabandiYear}
                    onChange={(e) => handleInputChange('jamabandi.jamabandiYear', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Jamabandi Number"
                    value={formData.jamabandi.jamabandiNumber}
                    onChange={(e) => handleInputChange('jamabandi.jamabandiNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Reviewed Date"
                    value={formData.jamabandi.reviewedDate}
                    onChange={(e) => handleInputChange('jamabandi.reviewedDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Record Details</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Owner Name"
                    value={formData.jamabandi.recordDetails.ownerName}
                    onChange={(e) => handleInputChange('jamabandi.recordDetails.ownerName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Father Name"
                    value={formData.jamabandi.recordDetails.fatherName}
                    onChange={(e) => handleInputChange('jamabandi.recordDetails.fatherName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="CNIC"
                    value={formData.jamabandi.recordDetails.cnic}
                    onChange={(e) => handleInputChange('jamabandi.recordDetails.cnic', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Area Value"
                    value={formData.jamabandi.recordDetails.area.value}
                    onChange={(e) => handleInputChange('jamabandi.recordDetails.area.value', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Area Unit</InputLabel>
                    <Select
                      value={formData.jamabandi.recordDetails.area.unit}
                      onChange={(e) => handleInputChange('jamabandi.recordDetails.area.unit', e.target.value)}
                    >
                      {areaUnits.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Land Type"
                    value={formData.jamabandi.recordDetails.landType}
                    onChange={(e) => handleInputChange('jamabandi.recordDetails.landType', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Cultivation Status"
                    value={formData.jamabandi.recordDetails.cultivationStatus}
                    onChange={(e) => handleInputChange('jamabandi.recordDetails.cultivationStatus', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Revenue Rate"
                    value={formData.jamabandi.recordDetails.revenueRate}
                    onChange={(e) => handleInputChange('jamabandi.recordDetails.revenueRate', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">Discrepancies</Typography>
                    <Button startIcon={<AddIcon />} onClick={() => addDiscrepancy('jamabandi')} variant="outlined" size="small">
                      Add Discrepancy
                    </Button>
                  </Box>
                  {formData.jamabandi.discrepancies?.map((disc, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" fontWeight="bold">Discrepancy #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeDiscrepancy('jamabandi', index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Field"
                              value={disc.field}
                              onChange={(e) => {
                                const newDiscs = [...formData.jamabandi.discrepancies];
                                newDiscs[index].field = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  jamabandi: { ...prev.jamabandi, discrepancies: newDiscs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Severity</InputLabel>
                              <Select
                                value={disc.severity}
                                onChange={(e) => {
                                  const newDiscs = [...formData.jamabandi.discrepancies];
                                  newDiscs[index].severity = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    jamabandi: { ...prev.jamabandi, discrepancies: newDiscs }
                                  }));
                                }}
                              >
                                {disputeSeverities.map(s => <MenuItem key={s} value={s}>{s.toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              rows={2}
                              label="Description"
                              value={disc.description}
                              onChange={(e) => {
                                const newDiscs = [...formData.jamabandi.discrepancies];
                                newDiscs[index].description = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  jamabandi: { ...prev.jamabandi, discrepancies: newDiscs }
                                }));
                              }}
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.jamabandi.isVerified}
                        onChange={(e) => handleInputChange('jamabandi.isVerified', e.target.checked)}
                      />
                    }
                    label="Jamabandi Verified"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Verification Notes"
                    value={formData.jamabandi.verificationNotes}
                    onChange={(e) => handleInputChange('jamabandi.verificationNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 1: // Fard Verification
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 2: Fard Verification</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Obtain and verify the Fard (land record extract). Verify all details including ownership, area, encumbrances, and mutations.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Fard Number"
                    value={formData.fard.fardNumber}
                    onChange={(e) => handleInputChange('fard.fardNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Fard Date"
                    value={formData.fard.fardDate}
                    onChange={(e) => handleInputChange('fard.fardDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Obtained Date"
                    value={formData.fard.obtainedDate}
                    onChange={(e) => handleInputChange('fard.obtainedDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Issued By</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Name"
                    value={formData.fard.issuedBy.name}
                    onChange={(e) => handleInputChange('fard.issuedBy.name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Designation"
                    value={formData.fard.issuedBy.designation}
                    onChange={(e) => handleInputChange('fard.issuedBy.designation', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Office"
                    value={formData.fard.issuedBy.office}
                    onChange={(e) => handleInputChange('fard.issuedBy.office', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Contact Number"
                    value={formData.fard.issuedBy.contactNumber}
                    onChange={(e) => handleInputChange('fard.issuedBy.contactNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Fard Details</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Mauza Name"
                    value={formData.fard.fardDetails.mauzaName}
                    onChange={(e) => handleInputChange('fard.fardDetails.mauzaName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Mauza Number"
                    value={formData.fard.fardDetails.mauzaNumber}
                    onChange={(e) => handleInputChange('fard.fardDetails.mauzaNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Khasra Numbers (comma separated)"
                    value={Array.isArray(formData.fard.fardDetails.khasraNumbers) ? formData.fard.fardDetails.khasraNumbers.join(', ') : ''}
                    onChange={(e) => handleInputChange('fard.fardDetails.khasraNumbers', e.target.value.split(',').map(s => s.trim()))}
                    helperText="Enter khasra numbers separated by commas"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.fard.isVerified}
                        onChange={(e) => handleInputChange('fard.isVerified', e.target.checked)}
                      />
                    }
                    label="Fard Verified"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Verification Notes"
                    value={formData.fard.verificationNotes}
                    onChange={(e) => handleInputChange('fard.verificationNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 2: // Khatauni Verification
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 3: Khatauni Verification</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Verify the Khatauni (record of rights). Check ownership, area, cultivation details, and revenue information.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Khatauni Number"
                    value={formData.khatauni.khatauniNumber}
                    onChange={(e) => handleInputChange('khatauni.khatauniNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Khatauni Year"
                    value={formData.khatauni.khatauniYear}
                    onChange={(e) => handleInputChange('khatauni.khatauniYear', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Verified Date"
                    value={formData.khatauni.verifiedDate}
                    onChange={(e) => handleInputChange('khatauni.verifiedDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Khatauni Details</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Owner Name"
                    value={formData.khatauni.khatauniDetails.ownerName}
                    onChange={(e) => handleInputChange('khatauni.khatauniDetails.ownerName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="CNIC"
                    value={formData.khatauni.khatauniDetails.cnic}
                    onChange={(e) => handleInputChange('khatauni.khatauniDetails.cnic', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Area Value"
                    value={formData.khatauni.khatauniDetails.area.value}
                    onChange={(e) => handleInputChange('khatauni.khatauniDetails.area.value', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Area Unit</InputLabel>
                    <Select
                      value={formData.khatauni.khatauniDetails.area.unit}
                      onChange={(e) => handleInputChange('khatauni.khatauniDetails.area.unit', e.target.value)}
                    >
                      {areaUnits.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Crop Type"
                    value={formData.khatauni.khatauniDetails.cultivationDetails.cropType}
                    onChange={(e) => handleInputChange('khatauni.khatauniDetails.cultivationDetails.cropType', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">Discrepancies</Typography>
                    <Button startIcon={<AddIcon />} onClick={() => addDiscrepancy('khatauni')} variant="outlined" size="small">
                      Add Discrepancy
                    </Button>
                  </Box>
                  {formData.khatauni.discrepancies?.map((disc, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" fontWeight="bold">Discrepancy #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeDiscrepancy('khatauni', index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Field"
                              value={disc.field}
                              onChange={(e) => {
                                const newDiscs = [...formData.khatauni.discrepancies];
                                newDiscs[index].field = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  khatauni: { ...prev.khatauni, discrepancies: newDiscs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Severity</InputLabel>
                              <Select
                                value={disc.severity}
                                onChange={(e) => {
                                  const newDiscs = [...formData.khatauni.discrepancies];
                                  newDiscs[index].severity = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    khatauni: { ...prev.khatauni, discrepancies: newDiscs }
                                  }));
                                }}
                              >
                                {disputeSeverities.map(s => <MenuItem key={s} value={s}>{s.toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              rows={2}
                              label="Description"
                              value={disc.description}
                              onChange={(e) => {
                                const newDiscs = [...formData.khatauni.discrepancies];
                                newDiscs[index].description = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  khatauni: { ...prev.khatauni, discrepancies: newDiscs }
                                }));
                              }}
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.khatauni.isVerified}
                        onChange={(e) => handleInputChange('khatauni.isVerified', e.target.checked)}
                      />
                    }
                    label="Khatauni Verified"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Verification Notes"
                    value={formData.khatauni.verificationNotes}
                    onChange={(e) => handleInputChange('khatauni.verificationNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 3: // Tehsildar Verification
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 4: Tehsildar Verification</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Obtain verification from Tehsildar office. Verify record accuracy, ownership, area, boundaries, and encumbrances.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Tehsildar Name"
                    value={formData.tehsildarVerification.tehsildarName}
                    onChange={(e) => handleInputChange('tehsildarVerification.tehsildarName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Tehsildar Office"
                    value={formData.tehsildarVerification.tehsildarOffice}
                    onChange={(e) => handleInputChange('tehsildarVerification.tehsildarOffice', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Contact Number"
                    value={formData.tehsildarVerification.tehsildarContact}
                    onChange={(e) => handleInputChange('tehsildarVerification.tehsildarContact', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Verification Date"
                    value={formData.tehsildarVerification.verificationDate}
                    onChange={(e) => handleInputChange('tehsildarVerification.verificationDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Verification Type</InputLabel>
                    <Select
                      value={formData.tehsildarVerification.verificationType}
                      onChange={(e) => handleInputChange('tehsildarVerification.verificationType', e.target.value)}
                    >
                      {verificationTypes.map(t => <MenuItem key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Record Accuracy</InputLabel>
                    <Select
                      value={formData.tehsildarVerification.verificationDetails.recordAccuracy}
                      onChange={(e) => handleInputChange('tehsildarVerification.verificationDetails.recordAccuracy', e.target.value)}
                    >
                      <MenuItem value="accurate">Accurate</MenuItem>
                      <MenuItem value="minor_discrepancies">Minor Discrepancies</MenuItem>
                      <MenuItem value="major_discrepancies">Major Discrepancies</MenuItem>
                      <MenuItem value="inaccurate">Inaccurate</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Verification Details</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.tehsildarVerification.verificationDetails.ownershipConfirmed}
                        onChange={(e) => handleInputChange('tehsildarVerification.verificationDetails.ownershipConfirmed', e.target.checked)}
                      />
                    }
                    label="Ownership Confirmed"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.tehsildarVerification.verificationDetails.areaConfirmed}
                        onChange={(e) => handleInputChange('tehsildarVerification.verificationDetails.areaConfirmed', e.target.checked)}
                      />
                    }
                    label="Area Confirmed"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.tehsildarVerification.verificationDetails.boundariesConfirmed}
                        onChange={(e) => handleInputChange('tehsildarVerification.verificationDetails.boundariesConfirmed', e.target.checked)}
                      />
                    }
                    label="Boundaries Confirmed"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.tehsildarVerification.verificationDetails.encumbrancesConfirmed}
                        onChange={(e) => handleInputChange('tehsildarVerification.verificationDetails.encumbrancesConfirmed', e.target.checked)}
                      />
                    }
                    label="Encumbrances Confirmed"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Remarks"
                    value={formData.tehsildarVerification.verificationDetails.remarks}
                    onChange={(e) => handleInputChange('tehsildarVerification.verificationDetails.remarks', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.tehsildarVerification.isVerified}
                        onChange={(e) => handleInputChange('tehsildarVerification.isVerified', e.target.checked)}
                      />
                    }
                    label="Tehsildar Verification Complete"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Verification Notes"
                    value={formData.tehsildarVerification.verificationNotes}
                    onChange={(e) => handleInputChange('tehsildarVerification.verificationNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 4: // ARC Check
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 5: ARC Check (Punjab)</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Check the Automated Record Center (ARC) system for Punjab. Verify digital records, mutations, and record status.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="ARC Number"
                    value={formData.arcCheck.arcNumber}
                    onChange={(e) => handleInputChange('arcCheck.arcNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Checked Date"
                    value={formData.arcCheck.checkedDate}
                    onChange={(e) => handleInputChange('arcCheck.checkedDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>ARC Details</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Mauza Code"
                    value={formData.arcCheck.arcDetails.mauzaCode}
                    onChange={(e) => handleInputChange('arcCheck.arcDetails.mauzaCode', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Mauza Name"
                    value={formData.arcCheck.arcDetails.mauzaName}
                    onChange={(e) => handleInputChange('arcCheck.arcDetails.mauzaName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Khasra Numbers (comma separated)"
                    value={Array.isArray(formData.arcCheck.arcDetails.khasraNumbers) ? formData.arcCheck.arcDetails.khasraNumbers.join(', ') : ''}
                    onChange={(e) => handleInputChange('arcCheck.arcDetails.khasraNumbers', e.target.value.split(',').map(s => s.trim()))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Owner Name"
                    value={formData.arcCheck.arcDetails.ownerName}
                    onChange={(e) => handleInputChange('arcCheck.arcDetails.ownerName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="CNIC"
                    value={formData.arcCheck.arcDetails.cnic}
                    onChange={(e) => handleInputChange('arcCheck.arcDetails.cnic', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Area Value"
                    value={formData.arcCheck.arcDetails.area.value}
                    onChange={(e) => handleInputChange('arcCheck.arcDetails.area.value', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Area Unit</InputLabel>
                    <Select
                      value={formData.arcCheck.arcDetails.area.unit}
                      onChange={(e) => handleInputChange('arcCheck.arcDetails.area.unit', e.target.value)}
                    >
                      {areaUnits.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Record Status</InputLabel>
                    <Select
                      value={formData.arcCheck.arcDetails.recordStatus}
                      onChange={(e) => handleInputChange('arcCheck.arcDetails.recordStatus', e.target.value)}
                    >
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                      <MenuItem value="disputed">Disputed</MenuItem>
                      <MenuItem value="mutated">Mutated</MenuItem>
                      <MenuItem value="encumbered">Encumbered</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">Discrepancies</Typography>
                    <Button startIcon={<AddIcon />} onClick={() => addDiscrepancy('arcCheck')} variant="outlined" size="small">
                      Add Discrepancy
                    </Button>
                  </Box>
                  {formData.arcCheck.discrepancies?.map((disc, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" fontWeight="bold">Discrepancy #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeDiscrepancy('arcCheck', index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Field"
                              value={disc.field}
                              onChange={(e) => {
                                const newDiscs = [...formData.arcCheck.discrepancies];
                                newDiscs[index].field = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  arcCheck: { ...prev.arcCheck, discrepancies: newDiscs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Severity</InputLabel>
                              <Select
                                value={disc.severity}
                                onChange={(e) => {
                                  const newDiscs = [...formData.arcCheck.discrepancies];
                                  newDiscs[index].severity = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    arcCheck: { ...prev.arcCheck, discrepancies: newDiscs }
                                  }));
                                }}
                              >
                                {disputeSeverities.map(s => <MenuItem key={s} value={s}>{s.toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              rows={2}
                              label="Description"
                              value={disc.description}
                              onChange={(e) => {
                                const newDiscs = [...formData.arcCheck.discrepancies];
                                newDiscs[index].description = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  arcCheck: { ...prev.arcCheck, discrepancies: newDiscs }
                                }));
                              }}
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.arcCheck.isVerified}
                        onChange={(e) => handleInputChange('arcCheck.isVerified', e.target.checked)}
                      />
                    }
                    label="ARC Check Verified"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Verification Notes"
                    value={formData.arcCheck.verificationNotes}
                    onChange={(e) => handleInputChange('arcCheck.verificationNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 5: // Dispute Identification
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 6: Dispute Identification</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Identify and document any disputes related to the land. Record dispute type, parties involved, severity, and resolution status.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1">Disputes</Typography>
                <Button startIcon={<AddIcon />} onClick={addDispute} variant="outlined" size="small">
                  Add Dispute
                </Button>
              </Box>
              {formData.disputes.map((dispute, index) => (
                <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle2">Dispute #{index + 1}</Typography>
                      <IconButton size="small" onClick={() => removeDispute(index)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Dispute Type *</InputLabel>
                          <Select
                            value={dispute.disputeType}
                            onChange={(e) => {
                              const newDisputes = [...formData.disputes];
                              newDisputes[index].disputeType = e.target.value;
                              setFormData(prev => ({ ...prev, disputes: newDisputes }));
                            }}
                          >
                            {disputeTypes.map(t => <MenuItem key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Severity</InputLabel>
                          <Select
                            value={dispute.severity}
                            onChange={(e) => {
                              const newDisputes = [...formData.disputes];
                              newDisputes[index].severity = e.target.value;
                              setFormData(prev => ({ ...prev, disputes: newDisputes }));
                            }}
                          >
                            {disputeSeverities.map(s => <MenuItem key={s} value={s}>{s.toUpperCase()}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Resolution Status</InputLabel>
                          <Select
                            value={dispute.resolutionStatus}
                            onChange={(e) => {
                              const newDisputes = [...formData.disputes];
                              newDisputes[index].resolutionStatus = e.target.value;
                              setFormData(prev => ({ ...prev, disputes: newDisputes }));
                            }}
                          >
                            <MenuItem value="open">Open</MenuItem>
                            <MenuItem value="under_investigation">Under Investigation</MenuItem>
                            <MenuItem value="resolved">Resolved</MenuItem>
                            <MenuItem value="escalated">Escalated</MenuItem>
                            <MenuItem value="legal_action">Legal Action</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={3}
                          label="Dispute Description *"
                          value={dispute.disputeDescription}
                          onChange={(e) => {
                            const newDisputes = [...formData.disputes];
                            newDisputes[index].disputeDescription = e.target.value;
                            setFormData(prev => ({ ...prev, disputes: newDisputes }));
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
                          value={dispute.impact || ''}
                          onChange={(e) => {
                            const newDisputes = [...formData.disputes];
                            newDisputes[index].impact = e.target.value;
                            setFormData(prev => ({ ...prev, disputes: newDisputes }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={2}
                          label="Resolution Notes"
                          value={dispute.resolutionNotes || ''}
                          onChange={(e) => {
                            const newDisputes = [...formData.disputes];
                            newDisputes[index].resolutionNotes = e.target.value;
                            setFormData(prev => ({ ...prev, disputes: newDisputes }));
                          }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
              {formData.disputes.length === 0 && (
                <Alert severity="info">No disputes identified yet. Click "Add Dispute" to add one.</Alert>
              )}
            </CardContent>
          </Card>
        );

      case 6: // Fraud Detection
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 7: Fraud Detection</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Conduct fraud detection checks. Verify document authenticity, signatures, stamps, and check for record tampering.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1">Fraud Checks</Typography>
                <Button startIcon={<AddIcon />} onClick={addFraudCheck} variant="outlined" size="small">
                  Add Fraud Check
                </Button>
              </Box>
              {formData.fraudChecks.map((check, index) => (
                <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle2">Fraud Check #{index + 1}</Typography>
                      <IconButton size="small" onClick={() => removeFraudCheck(index)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Check Type *</InputLabel>
                          <Select
                            value={check.checkType}
                            onChange={(e) => {
                              const newChecks = [...formData.fraudChecks];
                              newChecks[index].checkType = e.target.value;
                              setFormData(prev => ({ ...prev, fraudChecks: newChecks }));
                            }}
                          >
                            {fraudCheckTypes.map(t => <MenuItem key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Findings</InputLabel>
                          <Select
                            value={check.findings}
                            onChange={(e) => {
                              const newChecks = [...formData.fraudChecks];
                              newChecks[index].findings = e.target.value;
                              setFormData(prev => ({ ...prev, fraudChecks: newChecks }));
                            }}
                          >
                            {fraudFindings.map(f => <MenuItem key={f} value={f}>{f.toUpperCase()}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          type="date"
                          label="Checked Date"
                          value={check.checkedDate}
                          onChange={(e) => {
                            const newChecks = [...formData.fraudChecks];
                            newChecks[index].checkedDate = e.target.value;
                            setFormData(prev => ({ ...prev, fraudChecks: newChecks }));
                          }}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={2}
                          label="Check Description *"
                          value={check.checkDescription}
                          onChange={(e) => {
                            const newChecks = [...formData.fraudChecks];
                            newChecks[index].checkDescription = e.target.value;
                            setFormData(prev => ({ ...prev, fraudChecks: newChecks }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={2}
                          label="Findings Details"
                          value={check.findingsDetails || ''}
                          onChange={(e) => {
                            const newChecks = [...formData.fraudChecks];
                            newChecks[index].findingsDetails = e.target.value;
                            setFormData(prev => ({ ...prev, fraudChecks: newChecks }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={2}
                          label="Recommendations"
                          value={check.recommendations || ''}
                          onChange={(e) => {
                            const newChecks = [...formData.fraudChecks];
                            newChecks[index].recommendations = e.target.value;
                            setFormData(prev => ({ ...prev, fraudChecks: newChecks }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={2}
                          label="Action Taken"
                          value={check.actionTaken || ''}
                          onChange={(e) => {
                            const newChecks = [...formData.fraudChecks];
                            newChecks[index].actionTaken = e.target.value;
                            setFormData(prev => ({ ...prev, fraudChecks: newChecks }));
                          }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
              {formData.fraudChecks.length === 0 && (
                <Alert severity="info">No fraud checks conducted yet. Click "Add Fraud Check" to add one.</Alert>
              )}
            </CardContent>
          </Card>
        );

      case 7: // Completion
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Forms Checklist</Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Track all required forms and documents for record verification.
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2">Required Forms</Typography>
                    <Button startIcon={<AddIcon />} onClick={addForm} variant="outlined" size="small">
                      Add Form
                    </Button>
                  </Box>
                  {formData.formsChecklist.map((form, index) => (
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
                                const newForms = [...formData.formsChecklist];
                                newForms[index].formName = e.target.value;
                                setFormData(prev => ({ ...prev, formsChecklist: newForms }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Form Type</InputLabel>
                              <Select
                                value={form.formType}
                                onChange={(e) => {
                                  const newForms = [...formData.formsChecklist];
                                  newForms[index].formType = e.target.value;
                                  setFormData(prev => ({ ...prev, formsChecklist: newForms }));
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
                                  const newForms = [...formData.formsChecklist];
                                  newForms[index].status = e.target.value;
                                  setFormData(prev => ({ ...prev, formsChecklist: newForms }));
                                }}
                              >
                                <MenuItem value="required">Required</MenuItem>
                                <MenuItem value="obtained">Obtained</MenuItem>
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
                  {formData.formsChecklist.length === 0 && (
                    <Alert severity="info">No forms added yet. Click "Add Form" to add one.</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Verification Checklist</Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Complete verification checklist to ensure all steps are verified.
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={2}>
                    {Object.entries(formData.verificationChecklist).map(([key, value]) => (
                      <Grid item xs={12} key={key}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={value}
                              onChange={(e) => handleInputChange(`verificationChecklist.${key}`, e.target.checked)}
                            />
                          }
                          label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        />
                      </Grid>
                    ))}
                  </Grid>
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
                      <Autocomplete
                        options={landIdentifications}
                        getOptionLabel={(option) => option.identificationNumber || ''}
                        value={landIdentifications.find(li => li._id === formData.landIdentification) || null}
                        onChange={(e, newValue) => handleInputChange('landIdentification', newValue?._id || '')}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Land Identification *"
                            required
                          />
                        )}
                      />
                    </Grid>
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
        Record Verification {id ? '(Edit)' : '(New)'}
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
              onClick={handleSave}
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

export default RecordVerification;
