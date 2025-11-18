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
  Autocomplete,
  Tabs,
  Tab
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../../services/api';

const workflowSteps = [
  'Patwari + Qanoongo Visit',
  'Ground Measurement',
  'Boundary Pillars',
  'Encroachment Detection',
  'Creating Ground Sketch',
  'Society Alignment',
  'Demarcation Report'
];

const areaUnits = ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'];
const measurementMethods = ['gps', 'total_station', 'tape_measurement', 'chain_measurement', 'drone_survey', 'satellite', 'other'];
const weatherConditions = ['clear', 'cloudy', 'rainy', 'foggy', 'other'];
const siteAccessibility = ['accessible', 'partially_accessible', 'difficult_access', 'inaccessible'];
const pillarTypes = ['concrete', 'stone', 'iron', 'wooden', 'cement_block', 'other'];
const pillarConditions = ['good', 'damaged', 'missing', 'needs_repair', 'replaced'];
const verificationStatuses = ['verified', 'pending', 'rejected'];
const pillarLocations = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'corner', 'intermediate'];
const encroachmentTypes = ['structure', 'fence', 'wall', 'crop', 'tree', 'path', 'other'];
const encroachmentSeverities = ['minor', 'moderate', 'major', 'critical'];
const resolutionStatuses = ['open', 'under_investigation', 'resolved', 'escalated', 'legal_action', 'removed'];
const sketchTypes = ['hand_drawn', 'digital', 'cad', 'gis', 'satellite_overlay', 'other'];
const alignmentTypes = ['plot_layout', 'road_alignment', 'boundary_alignment', 'infrastructure_alignment', 'master_plan', 'other'];
const formTypes = ['visit_report', 'measurement_certificate', 'pillar_verification', 'encroachment_report', 'sketch_approval', 'alignment_certificate', 'demarcation_certificate', 'other'];

const Demarcation = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [landIdentifications, setLandIdentifications] = useState([]);
  const [recordVerifications, setRecordVerifications] = useState([]);
  const [khasraMappings, setKhasraMappings] = useState([]);
  const [selectedKhasraIndex, setSelectedKhasraIndex] = useState(0);
  const [selectedPillarIndex, setSelectedPillarIndex] = useState(0);
  const [selectedEncroachmentIndex, setSelectedEncroachmentIndex] = useState(0);
  
  const [formData, setFormData] = useState({
    demarcationNumber: '',
    landIdentification: '',
    recordVerification: '',
    khasraMapping: '',
    status: 'draft',
    currentStep: 'patwari_qanoongo_visit',
    priority: 'medium',
    
    // Patwari and Qanoongo Visit
    patwariQanoongoVisit: {
      visitDate: new Date().toISOString().split('T')[0],
      visitTime: '',
      visitDuration: 0,
      patwari: {
        name: '',
        designation: '',
        office: '',
        contactNumber: '',
        cnic: '',
        present: false
      },
      qanoongo: {
        name: '',
        designation: '',
        office: '',
        contactNumber: '',
        cnic: '',
        present: false
      },
      societyRepresentatives: [],
      landOwnerRepresentative: {
        name: '',
        cnic: '',
        contactNumber: '',
        relationship: '',
        present: false
      },
      visitPurpose: '',
      observations: '',
      weatherConditions: 'clear',
      siteAccessibility: 'accessible',
      visitNotes: '',
      visitCompleted: false
    },
    
    // Ground Measurement
    groundMeasurement: {
      measurementDate: new Date().toISOString().split('T')[0],
      measurementTime: '',
      measurementMethod: 'total_station',
      equipmentUsed: [],
      khasraMeasurements: [],
      totalRecordedArea: { value: 0, unit: 'kanal' },
      totalMeasuredArea: { value: 0, unit: 'kanal' },
      overallDiscrepancy: { value: 0, percentage: 0, type: 'match' },
      measurementCompleted: false,
      measurementNotes: ''
    },
    
    // Boundary Pillars
    boundaryPillars: {
      pillarsInstalled: false,
      installationDate: new Date().toISOString().split('T')[0],
      pillars: [],
      totalPillars: 0,
      verifiedPillars: 0,
      damagedPillars: 0,
      missingPillars: 0,
      installationNotes: ''
    },
    
    // Encroachment Detection
    encroachmentDetection: {
      checked: false,
      checkDate: new Date().toISOString().split('T')[0],
      encroachments: [],
      totalEncroachments: 0,
      totalEncroachmentArea: { value: 0, unit: 'square_feet' },
      criticalEncroachments: 0,
      checkNotes: ''
    },
    
    // Ground Sketch
    groundSketch: {
      sketchCreated: false,
      createdDate: new Date().toISOString().split('T')[0],
      sketchType: 'hand_drawn',
      sketchScale: '',
      sketchDimensions: { width: 0, height: 0, unit: 'meter' },
      sketchElements: {
        boundaries: true,
        pillars: true,
        structures: true,
        roads: true,
        waterBodies: true,
        trees: false,
        encroachments: true,
        adjacentProperties: true,
        coordinates: true
      },
      verified: false,
      verificationNotes: '',
      sketchNotes: ''
    },
    
    // Society Alignment
    societyAlignment: {
      alignmentDone: false,
      alignmentDate: new Date().toISOString().split('T')[0],
      alignmentType: 'plot_layout',
      masterPlanReference: '',
      alignmentCoordinates: [],
      verified: false,
      verificationNotes: '',
      alignmentNotes: ''
    },
    
    // Demarcation Report
    demarcationReport: {
      reportGenerated: false,
      reportDate: new Date().toISOString().split('T')[0],
      reportNumber: '',
      reportSections: {
        executiveSummary: { included: true, content: '' },
        visitDetails: { included: true, content: '' },
        measurementDetails: { included: true, content: '' },
        boundaryPillars: { included: true, content: '' },
        encroachments: { included: true, content: '' },
        groundSketch: { included: true, content: '' },
        societyAlignment: { included: true, content: '' },
        recommendations: { included: true, content: '' },
        conclusions: { included: true, content: '' }
      },
      approved: false,
      approvalNotes: '',
      reportNotes: ''
    },
    
    // Forms Checklist
    formsChecklist: [],
    
    description: '',
    notes: ''
  });

  useEffect(() => {
    fetchLandIdentifications();
    fetchRecordVerifications();
    fetchKhasraMappings();
    if (id) {
      fetchDemarcation();
    }
  }, [id]);

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

  const fetchRecordVerifications = async () => {
    try {
      const response = await api.get('/taj-residencia/record-verification', { params: { limit: 1000 } });
      if (response.data.success) {
        setRecordVerifications(response.data.data.docs || []);
      }
    } catch (error) {
      console.error('Error fetching record verifications:', error);
    }
  };

  const fetchKhasraMappings = async () => {
    try {
      const response = await api.get('/taj-residencia/khasra-mapping', { params: { limit: 1000 } });
      if (response.data.success) {
        setKhasraMappings(response.data.data.docs || []);
      }
    } catch (error) {
      console.error('Error fetching khasra mappings:', error);
    }
  };

  const fetchDemarcation = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/taj-residencia/demarcation/${id}`);
      if (response.data.success) {
        const data = response.data.data;
        setFormData({
          ...data,
          patwariQanoongoVisit: {
            ...data.patwariQanoongoVisit,
            visitDate: data.patwariQanoongoVisit?.visitDate ? new Date(data.patwariQanoongoVisit.visitDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          groundMeasurement: {
            ...data.groundMeasurement,
            measurementDate: data.groundMeasurement?.measurementDate ? new Date(data.groundMeasurement.measurementDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          boundaryPillars: {
            ...data.boundaryPillars,
            installationDate: data.boundaryPillars?.installationDate ? new Date(data.boundaryPillars.installationDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          encroachmentDetection: {
            ...data.encroachmentDetection,
            checkDate: data.encroachmentDetection?.checkDate ? new Date(data.encroachmentDetection.checkDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          groundSketch: {
            ...data.groundSketch,
            createdDate: data.groundSketch?.createdDate ? new Date(data.groundSketch.createdDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          societyAlignment: {
            ...data.societyAlignment,
            alignmentDate: data.societyAlignment?.alignmentDate ? new Date(data.societyAlignment.alignmentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          demarcationReport: {
            ...data.demarcationReport,
            reportDate: data.demarcationReport?.reportDate ? new Date(data.demarcationReport.reportDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          }
        });
        
        const stepIndex = workflowSteps.findIndex(step => 
          data.currentStep === step.toLowerCase().replace(/\s+/g, '_').replace('+', '_')
        );
        if (stepIndex !== -1) {
          setActiveStep(stepIndex);
        }
      }
    } catch (error) {
      console.error('Error fetching demarcation:', error);
      showSnackbar('Error fetching demarcation data', 'error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

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
      const stepNames = ['patwari_qanoongo_visit', 'ground_measurement', 'boundary_pillars', 'encroachment_detection', 'ground_sketch', 'society_alignment', 'demarcation_report'];
      const dataToSave = {
        ...formData,
        currentStep: stepNames[activeStep],
        status: activeStep === workflowSteps.length - 1 ? 'completed' : formData.status
      };

      let response;
      if (id) {
        response = await api.put(`/taj-residencia/demarcation/${id}`, dataToSave);
      } else {
        response = await api.post('/taj-residencia/demarcation', dataToSave);
        if (response.data.success) {
          navigate(`/taj-residencia/land-acquisition/demarcation/${response.data.data._id}`);
        }
      }

      if (response.data.success) {
        showSnackbar('Demarcation saved successfully', 'success');
      }
    } catch (error) {
      console.error('Error saving demarcation:', error);
      showSnackbar('Error saving demarcation', 'error');
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

  const addSocietyRepresentative = () => {
    setFormData(prev => ({
      ...prev,
      patwariQanoongoVisit: {
        ...prev.patwariQanoongoVisit,
        societyRepresentatives: [...prev.patwariQanoongoVisit.societyRepresentatives, {
          name: '',
          designation: '',
          contactNumber: '',
          present: false
        }]
      }
    }));
  };

  const removeSocietyRepresentative = (index) => {
    setFormData(prev => ({
      ...prev,
      patwariQanoongoVisit: {
        ...prev.patwariQanoongoVisit,
        societyRepresentatives: prev.patwariQanoongoVisit.societyRepresentatives.filter((_, i) => i !== index)
      }
    }));
  };

  const addKhasraMeasurement = () => {
    setFormData(prev => ({
      ...prev,
      groundMeasurement: {
        ...prev.groundMeasurement,
        khasraMeasurements: [...prev.groundMeasurement.khasraMeasurements, {
          khasraNumber: '',
          recordedArea: { value: 0, unit: 'kanal' },
          measuredArea: { value: 0, unit: 'kanal' },
          discrepancy: { value: 0, percentage: 0, type: 'match', explanation: '' },
          coordinates: [],
          boundaryLength: { value: 0, unit: 'feet' },
          measurementNotes: ''
        }]
      }
    }));
  };

  const removeKhasraMeasurement = (index) => {
    setFormData(prev => ({
      ...prev,
      groundMeasurement: {
        ...prev.groundMeasurement,
        khasraMeasurements: prev.groundMeasurement.khasraMeasurements.filter((_, i) => i !== index)
      }
    }));
  };

  const addPillar = () => {
    setFormData(prev => ({
      ...prev,
      boundaryPillars: {
        ...prev.boundaryPillars,
        pillars: [...prev.boundaryPillars.pillars, {
          pillarNumber: '',
          location: 'north',
          coordinates: { latitude: 0, longitude: 0, elevation: 0 },
          pillarType: 'concrete',
          pillarSize: { height: 0, width: 0, depth: 0, unit: 'feet' },
          pillarMarking: '',
          installationDate: new Date().toISOString().split('T')[0],
          condition: 'good',
          verificationStatus: 'pending',
          notes: ''
        }]
      }
    }));
  };

  const removePillar = (index) => {
    setFormData(prev => ({
      ...prev,
      boundaryPillars: {
        ...prev.boundaryPillars,
        pillars: prev.boundaryPillars.pillars.filter((_, i) => i !== index)
      }
    }));
  };

  const addEncroachment = () => {
    setFormData(prev => ({
      ...prev,
      encroachmentDetection: {
        ...prev.encroachmentDetection,
        encroachments: [...prev.encroachmentDetection.encroachments, {
          encroachmentNumber: '',
          location: { direction: 'north', coordinates: { latitude: 0, longitude: 0 }, description: '' },
          encroachmentType: 'structure',
          encroachmentArea: { value: 0, unit: 'square_feet' },
          encroachedBy: { name: '', cnic: '', contactNumber: '', address: '' },
          severity: 'moderate',
          detectedDate: new Date().toISOString().split('T')[0],
          resolutionStatus: 'open',
          resolutionNotes: '',
          notes: ''
        }]
      }
    }));
  };

  const removeEncroachment = (index) => {
    setFormData(prev => ({
      ...prev,
      encroachmentDetection: {
        ...prev.encroachmentDetection,
        encroachments: prev.encroachmentDetection.encroachments.filter((_, i) => i !== index)
      }
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
      case 0: // Patwari + Qanoongo Visit
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 1: Patwari + Qanoongo Visit</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Schedule and conduct visit with Patwari and Qanoongo. Record all participants, observations, and site conditions.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Visit Date *"
                    value={formData.patwariQanoongoVisit.visitDate}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.visitDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="time"
                    label="Visit Time"
                    value={formData.patwariQanoongoVisit.visitTime}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.visitTime', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Duration (minutes)"
                    value={formData.patwariQanoongoVisit.visitDuration}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.visitDuration', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Patwari Details</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Patwari Name *"
                    value={formData.patwariQanoongoVisit.patwari.name}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.patwari.name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Designation"
                    value={formData.patwariQanoongoVisit.patwari.designation}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.patwari.designation', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Office"
                    value={formData.patwariQanoongoVisit.patwari.office}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.patwari.office', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Contact Number"
                    value={formData.patwariQanoongoVisit.patwari.contactNumber}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.patwari.contactNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="CNIC"
                    value={formData.patwariQanoongoVisit.patwari.cnic}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.patwari.cnic', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.patwariQanoongoVisit.patwari.present}
                        onChange={(e) => handleInputChange('patwariQanoongoVisit.patwari.present', e.target.checked)}
                      />
                    }
                    label="Present at Visit"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Qanoongo Details</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Qanoongo Name *"
                    value={formData.patwariQanoongoVisit.qanoongo.name}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.qanoongo.name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Designation"
                    value={formData.patwariQanoongoVisit.qanoongo.designation}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.qanoongo.designation', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Office"
                    value={formData.patwariQanoongoVisit.qanoongo.office}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.qanoongo.office', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Contact Number"
                    value={formData.patwariQanoongoVisit.qanoongo.contactNumber}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.qanoongo.contactNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="CNIC"
                    value={formData.patwariQanoongoVisit.qanoongo.cnic}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.qanoongo.cnic', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.patwariQanoongoVisit.qanoongo.present}
                        onChange={(e) => handleInputChange('patwariQanoongoVisit.qanoongo.present', e.target.checked)}
                      />
                    }
                    label="Present at Visit"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1">Society Representatives</Typography>
                    <Button startIcon={<AddIcon />} onClick={addSocietyRepresentative} variant="outlined" size="small">
                      Add Representative
                    </Button>
                  </Box>
                  {formData.patwariQanoongoVisit.societyRepresentatives.map((rep, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" fontWeight="bold">Representative #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeSocietyRepresentative(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Name"
                              value={rep.name}
                              onChange={(e) => {
                                const newReps = [...formData.patwariQanoongoVisit.societyRepresentatives];
                                newReps[index].name = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  patwariQanoongoVisit: { ...prev.patwariQanoongoVisit, societyRepresentatives: newReps }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Designation"
                              value={rep.designation}
                              onChange={(e) => {
                                const newReps = [...formData.patwariQanoongoVisit.societyRepresentatives];
                                newReps[index].designation = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  patwariQanoongoVisit: { ...prev.patwariQanoongoVisit, societyRepresentatives: newReps }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Contact Number"
                              value={rep.contactNumber}
                              onChange={(e) => {
                                const newReps = [...formData.patwariQanoongoVisit.societyRepresentatives];
                                newReps[index].contactNumber = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  patwariQanoongoVisit: { ...prev.patwariQanoongoVisit, societyRepresentatives: newReps }
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
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Land Owner/Representative</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Name"
                    value={formData.patwariQanoongoVisit.landOwnerRepresentative.name}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.landOwnerRepresentative.name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="CNIC"
                    value={formData.patwariQanoongoVisit.landOwnerRepresentative.cnic}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.landOwnerRepresentative.cnic', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Contact Number"
                    value={formData.patwariQanoongoVisit.landOwnerRepresentative.contactNumber}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.landOwnerRepresentative.contactNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Relationship"
                    value={formData.patwariQanoongoVisit.landOwnerRepresentative.relationship}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.landOwnerRepresentative.relationship', e.target.value)}
                    placeholder="owner, representative, attorney, etc."
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.patwariQanoongoVisit.landOwnerRepresentative.present}
                        onChange={(e) => handleInputChange('patwariQanoongoVisit.landOwnerRepresentative.present', e.target.checked)}
                      />
                    }
                    label="Present at Visit"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Visit Details</Typography>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Visit Purpose"
                    value={formData.patwariQanoongoVisit.visitPurpose}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.visitPurpose', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Observations"
                    value={formData.patwariQanoongoVisit.observations}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.observations', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Weather Conditions</InputLabel>
                    <Select
                      value={formData.patwariQanoongoVisit.weatherConditions}
                      onChange={(e) => handleInputChange('patwariQanoongoVisit.weatherConditions', e.target.value)}
                    >
                      {weatherConditions.map(w => <MenuItem key={w} value={w}>{w.toUpperCase()}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Site Accessibility</InputLabel>
                    <Select
                      value={formData.patwariQanoongoVisit.siteAccessibility}
                      onChange={(e) => handleInputChange('patwariQanoongoVisit.siteAccessibility', e.target.value)}
                    >
                      {siteAccessibility.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Visit Notes"
                    value={formData.patwariQanoongoVisit.visitNotes}
                    onChange={(e) => handleInputChange('patwariQanoongoVisit.visitNotes', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.patwariQanoongoVisit.visitCompleted}
                        onChange={(e) => handleInputChange('patwariQanoongoVisit.visitCompleted', e.target.checked)}
                      />
                    }
                    label="Visit Completed"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 1: // Ground Measurement
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 2: Ground Measurement</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Conduct ground measurement using appropriate equipment. Record measurements for each Khasra and calculate discrepancies.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Measurement Date"
                    value={formData.groundMeasurement.measurementDate}
                    onChange={(e) => handleInputChange('groundMeasurement.measurementDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="time"
                    label="Measurement Time"
                    value={formData.groundMeasurement.measurementTime}
                    onChange={(e) => handleInputChange('groundMeasurement.measurementTime', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Measurement Method</InputLabel>
                    <Select
                      value={formData.groundMeasurement.measurementMethod}
                      onChange={(e) => handleInputChange('groundMeasurement.measurementMethod', e.target.value)}
                    >
                      {measurementMethods.map(m => <MenuItem key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">Khasra Measurements</Typography>
                    <Button startIcon={<AddIcon />} onClick={addKhasraMeasurement} variant="outlined" size="small">
                      Add Khasra Measurement
                    </Button>
                  </Box>
                  {formData.groundMeasurement.khasraMeasurements.map((measurement, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="subtitle2">Khasra Measurement #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeKhasraMeasurement(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Khasra Number *"
                              value={measurement.khasraNumber}
                              onChange={(e) => {
                                const newMeasurements = [...formData.groundMeasurement.khasraMeasurements];
                                newMeasurements[index].khasraNumber = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  groundMeasurement: { ...prev.groundMeasurement, khasraMeasurements: newMeasurements }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label="Recorded Area Value"
                              value={measurement.recordedArea?.value || 0}
                              onChange={(e) => {
                                const newMeasurements = [...formData.groundMeasurement.khasraMeasurements];
                                if (!newMeasurements[index].recordedArea) newMeasurements[index].recordedArea = {};
                                newMeasurements[index].recordedArea.value = parseFloat(e.target.value) || 0;
                                setFormData(prev => ({
                                  ...prev,
                                  groundMeasurement: { ...prev.groundMeasurement, khasraMeasurements: newMeasurements }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Recorded Area Unit</InputLabel>
                              <Select
                                value={measurement.recordedArea?.unit || 'kanal'}
                                onChange={(e) => {
                                  const newMeasurements = [...formData.groundMeasurement.khasraMeasurements];
                                  if (!newMeasurements[index].recordedArea) newMeasurements[index].recordedArea = {};
                                  newMeasurements[index].recordedArea.unit = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    groundMeasurement: { ...prev.groundMeasurement, khasraMeasurements: newMeasurements }
                                  }));
                                }}
                              >
                                {areaUnits.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label="Measured Area Value"
                              value={measurement.measuredArea?.value || 0}
                              onChange={(e) => {
                                const newMeasurements = [...formData.groundMeasurement.khasraMeasurements];
                                if (!newMeasurements[index].measuredArea) newMeasurements[index].measuredArea = {};
                                newMeasurements[index].measuredArea.value = parseFloat(e.target.value) || 0;
                                setFormData(prev => ({
                                  ...prev,
                                  groundMeasurement: { ...prev.groundMeasurement, khasraMeasurements: newMeasurements }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Measured Area Unit</InputLabel>
                              <Select
                                value={measurement.measuredArea?.unit || 'kanal'}
                                onChange={(e) => {
                                  const newMeasurements = [...formData.groundMeasurement.khasraMeasurements];
                                  if (!newMeasurements[index].measuredArea) newMeasurements[index].measuredArea = {};
                                  newMeasurements[index].measuredArea.unit = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    groundMeasurement: { ...prev.groundMeasurement, khasraMeasurements: newMeasurements }
                                  }));
                                }}
                              >
                                {areaUnits.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Discrepancy Type</InputLabel>
                              <Select
                                value={measurement.discrepancy?.type || 'match'}
                                onChange={(e) => {
                                  const newMeasurements = [...formData.groundMeasurement.khasraMeasurements];
                                  if (!newMeasurements[index].discrepancy) newMeasurements[index].discrepancy = {};
                                  newMeasurements[index].discrepancy.type = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    groundMeasurement: { ...prev.groundMeasurement, khasraMeasurements: newMeasurements }
                                  }));
                                }}
                              >
                                <MenuItem value="match">Match</MenuItem>
                                <MenuItem value="excess">Excess</MenuItem>
                                <MenuItem value="deficit">Deficit</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              rows={2}
                              label="Measurement Notes"
                              value={measurement.measurementNotes || ''}
                              onChange={(e) => {
                                const newMeasurements = [...formData.groundMeasurement.khasraMeasurements];
                                newMeasurements[index].measurementNotes = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  groundMeasurement: { ...prev.groundMeasurement, khasraMeasurements: newMeasurements }
                                }));
                              }}
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                  {formData.groundMeasurement.khasraMeasurements.length === 0 && (
                    <Alert severity="info">No khasra measurements added yet. Click "Add Khasra Measurement" to add one.</Alert>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Measurement Notes"
                    value={formData.groundMeasurement.measurementNotes}
                    onChange={(e) => handleInputChange('groundMeasurement.measurementNotes', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.groundMeasurement.measurementCompleted}
                        onChange={(e) => handleInputChange('groundMeasurement.measurementCompleted', e.target.checked)}
                      />
                    }
                    label="Measurement Completed"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 2: // Boundary Pillars
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 3: Boundary Pillars</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Install and verify boundary pillars. Record pillar details including location, type, size, marking, and condition.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Installation Date"
                    value={formData.boundaryPillars.installationDate}
                    onChange={(e) => handleInputChange('boundaryPillars.installationDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.boundaryPillars.pillarsInstalled}
                        onChange={(e) => handleInputChange('boundaryPillars.pillarsInstalled', e.target.checked)}
                      />
                    }
                    label="Pillars Installed"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">Pillars</Typography>
                    <Button startIcon={<AddIcon />} onClick={addPillar} variant="outlined" size="small">
                      Add Pillar
                    </Button>
                  </Box>
                  {formData.boundaryPillars.pillars.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Tabs value={selectedPillarIndex} onChange={(e, newValue) => setSelectedPillarIndex(newValue)}>
                        {formData.boundaryPillars.pillars.map((pillar, index) => (
                          <Tab key={index} label={`Pillar ${pillar.pillarNumber || index + 1}`} />
                        ))}
                      </Tabs>
                    </Box>
                  )}
                  {formData.boundaryPillars.pillars.map((pillar, index) => (
                    index === selectedPillarIndex && (
                      <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="subtitle2">Pillar #{index + 1}</Typography>
                            <IconButton size="small" onClick={() => removePillar(index)} color="error">
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Pillar Number *"
                                value={pillar.pillarNumber}
                                onChange={(e) => {
                                  const newPillars = [...formData.boundaryPillars.pillars];
                                  newPillars[index].pillarNumber = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    boundaryPillars: { ...prev.boundaryPillars, pillars: newPillars }
                                  }));
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Location *</InputLabel>
                                <Select
                                  value={pillar.location}
                                  onChange={(e) => {
                                    const newPillars = [...formData.boundaryPillars.pillars];
                                    newPillars[index].location = e.target.value;
                                    setFormData(prev => ({
                                      ...prev,
                                      boundaryPillars: { ...prev.boundaryPillars, pillars: newPillars }
                                    }));
                                  }}
                                >
                                  {pillarLocations.map(l => <MenuItem key={l} value={l}>{l.toUpperCase()}</MenuItem>)}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Pillar Marking"
                                value={pillar.pillarMarking || ''}
                                onChange={(e) => {
                                  const newPillars = [...formData.boundaryPillars.pillars];
                                  newPillars[index].pillarMarking = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    boundaryPillars: { ...prev.boundaryPillars, pillars: newPillars }
                                  }));
                                }}
                                placeholder="e.g., TR-001"
                              />
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Pillar Type</InputLabel>
                                <Select
                                  value={pillar.pillarType || 'concrete'}
                                  onChange={(e) => {
                                    const newPillars = [...formData.boundaryPillars.pillars];
                                    newPillars[index].pillarType = e.target.value;
                                    setFormData(prev => ({
                                      ...prev,
                                      boundaryPillars: { ...prev.boundaryPillars, pillars: newPillars }
                                    }));
                                  }}
                                >
                                  {pillarTypes.map(t => <MenuItem key={t} value={t}>{t.toUpperCase()}</MenuItem>)}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Condition</InputLabel>
                                <Select
                                  value={pillar.condition || 'good'}
                                  onChange={(e) => {
                                    const newPillars = [...formData.boundaryPillars.pillars];
                                    newPillars[index].condition = e.target.value;
                                    setFormData(prev => ({
                                      ...prev,
                                      boundaryPillars: { ...prev.boundaryPillars, pillars: newPillars }
                                    }));
                                  }}
                                >
                                  {pillarConditions.map(c => <MenuItem key={c} value={c}>{c.toUpperCase()}</MenuItem>)}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Verification Status</InputLabel>
                                <Select
                                  value={pillar.verificationStatus || 'pending'}
                                  onChange={(e) => {
                                    const newPillars = [...formData.boundaryPillars.pillars];
                                    newPillars[index].verificationStatus = e.target.value;
                                    setFormData(prev => ({
                                      ...prev,
                                      boundaryPillars: { ...prev.boundaryPillars, pillars: newPillars }
                                    }));
                                  }}
                                >
                                  {verificationStatuses.map(s => <MenuItem key={s} value={s}>{s.toUpperCase()}</MenuItem>)}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="Latitude"
                                value={pillar.coordinates?.latitude || ''}
                                onChange={(e) => {
                                  const newPillars = [...formData.boundaryPillars.pillars];
                                  if (!newPillars[index].coordinates) newPillars[index].coordinates = {};
                                  newPillars[index].coordinates.latitude = parseFloat(e.target.value) || 0;
                                  setFormData(prev => ({
                                    ...prev,
                                    boundaryPillars: { ...prev.boundaryPillars, pillars: newPillars }
                                  }));
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="Longitude"
                                value={pillar.coordinates?.longitude || ''}
                                onChange={(e) => {
                                  const newPillars = [...formData.boundaryPillars.pillars];
                                  if (!newPillars[index].coordinates) newPillars[index].coordinates = {};
                                  newPillars[index].coordinates.longitude = parseFloat(e.target.value) || 0;
                                  setFormData(prev => ({
                                    ...prev,
                                    boundaryPillars: { ...prev.boundaryPillars, pillars: newPillars }
                                  }));
                                }}
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <TextField
                                fullWidth
                                size="small"
                                multiline
                                rows={2}
                                label="Notes"
                                value={pillar.notes || ''}
                                onChange={(e) => {
                                  const newPillars = [...formData.boundaryPillars.pillars];
                                  newPillars[index].notes = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    boundaryPillars: { ...prev.boundaryPillars, pillars: newPillars }
                                  }));
                                }}
                              />
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    )
                  ))}
                  {formData.boundaryPillars.pillars.length === 0 && (
                    <Alert severity="info">No pillars added yet. Click "Add Pillar" to add one.</Alert>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Installation Notes"
                    value={formData.boundaryPillars.installationNotes}
                    onChange={(e) => handleInputChange('boundaryPillars.installationNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 3: // Encroachment Detection
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 4: Encroachment Detection</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Detect and document any encroachments on the land. Record encroachment type, area, encroached by, severity, and resolution status.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Check Date"
                    value={formData.encroachmentDetection.checkDate}
                    onChange={(e) => handleInputChange('encroachmentDetection.checkDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.encroachmentDetection.checked}
                        onChange={(e) => handleInputChange('encroachmentDetection.checked', e.target.checked)}
                      />
                    }
                    label="Encroachment Check Completed"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">Encroachments</Typography>
                    <Button startIcon={<AddIcon />} onClick={addEncroachment} variant="outlined" size="small">
                      Add Encroachment
                    </Button>
                  </Box>
                  {formData.encroachmentDetection.encroachments.map((encroachment, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="subtitle2">Encroachment #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeEncroachment(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Encroachment Number *"
                              value={encroachment.encroachmentNumber}
                              onChange={(e) => {
                                const newEncroachments = [...formData.encroachmentDetection.encroachments];
                                newEncroachments[index].encroachmentNumber = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  encroachmentDetection: { ...prev.encroachmentDetection, encroachments: newEncroachments }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Encroachment Type *</InputLabel>
                              <Select
                                value={encroachment.encroachmentType}
                                onChange={(e) => {
                                  const newEncroachments = [...formData.encroachmentDetection.encroachments];
                                  newEncroachments[index].encroachmentType = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    encroachmentDetection: { ...prev.encroachmentDetection, encroachments: newEncroachments }
                                  }));
                                }}
                              >
                                {encroachmentTypes.map(t => <MenuItem key={t} value={t}>{t.toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Severity</InputLabel>
                              <Select
                                value={encroachment.severity}
                                onChange={(e) => {
                                  const newEncroachments = [...formData.encroachmentDetection.encroachments];
                                  newEncroachments[index].severity = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    encroachmentDetection: { ...prev.encroachmentDetection, encroachments: newEncroachments }
                                  }));
                                }}
                              >
                                {encroachmentSeverities.map(s => <MenuItem key={s} value={s}>{s.toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Encroached By - Name"
                              value={encroachment.encroachedBy?.name || ''}
                              onChange={(e) => {
                                const newEncroachments = [...formData.encroachmentDetection.encroachments];
                                if (!newEncroachments[index].encroachedBy) newEncroachments[index].encroachedBy = {};
                                newEncroachments[index].encroachedBy.name = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  encroachmentDetection: { ...prev.encroachmentDetection, encroachments: newEncroachments }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="CNIC"
                              value={encroachment.encroachedBy?.cnic || ''}
                              onChange={(e) => {
                                const newEncroachments = [...formData.encroachmentDetection.encroachments];
                                if (!newEncroachments[index].encroachedBy) newEncroachments[index].encroachedBy = {};
                                newEncroachments[index].encroachedBy.cnic = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  encroachmentDetection: { ...prev.encroachmentDetection, encroachments: newEncroachments }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Contact Number"
                              value={encroachment.encroachedBy?.contactNumber || ''}
                              onChange={(e) => {
                                const newEncroachments = [...formData.encroachmentDetection.encroachments];
                                if (!newEncroachments[index].encroachedBy) newEncroachments[index].encroachedBy = {};
                                newEncroachments[index].encroachedBy.contactNumber = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  encroachmentDetection: { ...prev.encroachmentDetection, encroachments: newEncroachments }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label="Encroachment Area Value"
                              value={encroachment.encroachmentArea?.value || 0}
                              onChange={(e) => {
                                const newEncroachments = [...formData.encroachmentDetection.encroachments];
                                if (!newEncroachments[index].encroachmentArea) newEncroachments[index].encroachmentArea = {};
                                newEncroachments[index].encroachmentArea.value = parseFloat(e.target.value) || 0;
                                setFormData(prev => ({
                                  ...prev,
                                  encroachmentDetection: { ...prev.encroachmentDetection, encroachments: newEncroachments }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Area Unit</InputLabel>
                              <Select
                                value={encroachment.encroachmentArea?.unit || 'square_feet'}
                                onChange={(e) => {
                                  const newEncroachments = [...formData.encroachmentDetection.encroachments];
                                  if (!newEncroachments[index].encroachmentArea) newEncroachments[index].encroachmentArea = {};
                                  newEncroachments[index].encroachmentArea.unit = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    encroachmentDetection: { ...prev.encroachmentDetection, encroachments: newEncroachments }
                                  }));
                                }}
                              >
                                {areaUnits.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Resolution Status</InputLabel>
                              <Select
                                value={encroachment.resolutionStatus}
                                onChange={(e) => {
                                  const newEncroachments = [...formData.encroachmentDetection.encroachments];
                                  newEncroachments[index].resolutionStatus = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    encroachmentDetection: { ...prev.encroachmentDetection, encroachments: newEncroachments }
                                  }));
                                }}
                              >
                                {resolutionStatuses.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <TextField
                              fullWidth
                              size="small"
                              type="date"
                              label="Detected Date"
                              value={encroachment.detectedDate}
                              onChange={(e) => {
                                const newEncroachments = [...formData.encroachmentDetection.encroachments];
                                newEncroachments[index].detectedDate = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  encroachmentDetection: { ...prev.encroachmentDetection, encroachments: newEncroachments }
                                }));
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
                              label="Location Description"
                              value={encroachment.location?.description || ''}
                              onChange={(e) => {
                                const newEncroachments = [...formData.encroachmentDetection.encroachments];
                                if (!newEncroachments[index].location) newEncroachments[index].location = {};
                                newEncroachments[index].location.description = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  encroachmentDetection: { ...prev.encroachmentDetection, encroachments: newEncroachments }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              rows={2}
                              label="Resolution Notes"
                              value={encroachment.resolutionNotes || ''}
                              onChange={(e) => {
                                const newEncroachments = [...formData.encroachmentDetection.encroachments];
                                newEncroachments[index].resolutionNotes = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  encroachmentDetection: { ...prev.encroachmentDetection, encroachments: newEncroachments }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              rows={2}
                              label="Notes"
                              value={encroachment.notes || ''}
                              onChange={(e) => {
                                const newEncroachments = [...formData.encroachmentDetection.encroachments];
                                newEncroachments[index].notes = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  encroachmentDetection: { ...prev.encroachmentDetection, encroachments: newEncroachments }
                                }));
                              }}
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                  {formData.encroachmentDetection.encroachments.length === 0 && (
                    <Alert severity="info">No encroachments detected yet. Click "Add Encroachment" to add one.</Alert>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Check Notes"
                    value={formData.encroachmentDetection.checkNotes}
                    onChange={(e) => handleInputChange('encroachmentDetection.checkNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 4: // Creating Ground Sketch
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 5: Creating Ground Sketch</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Create ground sketch showing boundaries, pillars, structures, roads, encroachments, and adjacent properties.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Created Date"
                    value={formData.groundSketch.createdDate}
                    onChange={(e) => handleInputChange('groundSketch.createdDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Sketch Type</InputLabel>
                    <Select
                      value={formData.groundSketch.sketchType}
                      onChange={(e) => handleInputChange('groundSketch.sketchType', e.target.value)}
                    >
                      {sketchTypes.map(t => <MenuItem key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Sketch Scale"
                    value={formData.groundSketch.sketchScale}
                    onChange={(e) => handleInputChange('groundSketch.sketchScale', e.target.value)}
                    placeholder="e.g., 1:5000"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Sketch Elements</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.groundSketch.sketchElements.boundaries}
                        onChange={(e) => handleInputChange('groundSketch.sketchElements.boundaries', e.target.checked)}
                      />
                    }
                    label="Boundaries"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.groundSketch.sketchElements.pillars}
                        onChange={(e) => handleInputChange('groundSketch.sketchElements.pillars', e.target.checked)}
                      />
                    }
                    label="Pillars"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.groundSketch.sketchElements.structures}
                        onChange={(e) => handleInputChange('groundSketch.sketchElements.structures', e.target.checked)}
                      />
                    }
                    label="Structures"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.groundSketch.sketchElements.roads}
                        onChange={(e) => handleInputChange('groundSketch.sketchElements.roads', e.target.checked)}
                      />
                    }
                    label="Roads"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.groundSketch.sketchElements.waterBodies}
                        onChange={(e) => handleInputChange('groundSketch.sketchElements.waterBodies', e.target.checked)}
                      />
                    }
                    label="Water Bodies"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.groundSketch.sketchElements.trees}
                        onChange={(e) => handleInputChange('groundSketch.sketchElements.trees', e.target.checked)}
                      />
                    }
                    label="Trees"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.groundSketch.sketchElements.encroachments}
                        onChange={(e) => handleInputChange('groundSketch.sketchElements.encroachments', e.target.checked)}
                      />
                    }
                    label="Encroachments"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.groundSketch.sketchElements.adjacentProperties}
                        onChange={(e) => handleInputChange('groundSketch.sketchElements.adjacentProperties', e.target.checked)}
                      />
                    }
                    label="Adjacent Properties"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.groundSketch.sketchElements.coordinates}
                        onChange={(e) => handleInputChange('groundSketch.sketchElements.coordinates', e.target.checked)}
                      />
                    }
                    label="Coordinates"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Sketch Notes"
                    value={formData.groundSketch.sketchNotes}
                    onChange={(e) => handleInputChange('groundSketch.sketchNotes', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.groundSketch.verified}
                        onChange={(e) => handleInputChange('groundSketch.verified', e.target.checked)}
                      />
                    }
                    label="Sketch Verified"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Verification Notes"
                    value={formData.groundSketch.verificationNotes}
                    onChange={(e) => handleInputChange('groundSketch.verificationNotes', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.groundSketch.sketchCreated}
                        onChange={(e) => handleInputChange('groundSketch.sketchCreated', e.target.checked)}
                      />
                    }
                    label="Sketch Created"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 5: // Society Alignment
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 6: Society Alignment</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Align the demarcated land with society master plan. Record alignment type, coordinates, and verification.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Alignment Date"
                    value={formData.societyAlignment.alignmentDate}
                    onChange={(e) => handleInputChange('societyAlignment.alignmentDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Alignment Type</InputLabel>
                    <Select
                      value={formData.societyAlignment.alignmentType}
                      onChange={(e) => handleInputChange('societyAlignment.alignmentType', e.target.value)}
                    >
                      {alignmentTypes.map(t => <MenuItem key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Master Plan Reference"
                    value={formData.societyAlignment.masterPlanReference}
                    onChange={(e) => handleInputChange('societyAlignment.masterPlanReference', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Alignment Notes"
                    value={formData.societyAlignment.alignmentNotes}
                    onChange={(e) => handleInputChange('societyAlignment.alignmentNotes', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.societyAlignment.verified}
                        onChange={(e) => handleInputChange('societyAlignment.verified', e.target.checked)}
                      />
                    }
                    label="Alignment Verified"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Verification Notes"
                    value={formData.societyAlignment.verificationNotes}
                    onChange={(e) => handleInputChange('societyAlignment.verificationNotes', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.societyAlignment.alignmentDone}
                        onChange={(e) => handleInputChange('societyAlignment.alignmentDone', e.target.checked)}
                      />
                    }
                    label="Alignment Done"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 6: // Demarcation Report
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Step 7: Demarcation Report</Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Generate comprehensive demarcation report with all sections including executive summary, visit details, measurements, pillars, encroachments, sketch, alignment, recommendations, and conclusions.
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="date"
                        label="Report Date"
                        value={formData.demarcationReport.reportDate}
                        onChange={(e) => handleInputChange('demarcationReport.reportDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Report Number"
                        value={formData.demarcationReport.reportNumber}
                        onChange={(e) => handleInputChange('demarcationReport.reportNumber', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1" gutterBottom>Report Sections</Typography>
                    </Grid>
                    {Object.entries(formData.demarcationReport.reportSections).map(([key, section]) => (
                      <React.Fragment key={key}>
                        <Grid item xs={12} md={3}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={section.included}
                                onChange={(e) => {
                                  const newSections = { ...formData.demarcationReport.reportSections };
                                  newSections[key].included = e.target.checked;
                                  setFormData(prev => ({
                                    ...prev,
                                    demarcationReport: { ...prev.demarcationReport, reportSections: newSections }
                                  }));
                                }}
                              />
                            }
                            label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          />
                        </Grid>
                        {section.included && (
                          <Grid item xs={12} md={9}>
                            <TextField
                              fullWidth
                              multiline
                              rows={3}
                              label={`${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} Content`}
                              value={section.content}
                              onChange={(e) => {
                                const newSections = { ...formData.demarcationReport.reportSections };
                                newSections[key].content = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  demarcationReport: { ...prev.demarcationReport, reportSections: newSections }
                                }));
                              }}
                            />
                          </Grid>
                        )}
                      </React.Fragment>
                    ))}
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Report Notes"
                        value={formData.demarcationReport.reportNotes}
                        onChange={(e) => handleInputChange('demarcationReport.reportNotes', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.demarcationReport.approved}
                            onChange={(e) => handleInputChange('demarcationReport.approved', e.target.checked)}
                          />
                        }
                        label="Report Approved"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Approval Notes"
                        value={formData.demarcationReport.approvalNotes}
                        onChange={(e) => handleInputChange('demarcationReport.approvalNotes', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.demarcationReport.reportGenerated}
                            onChange={(e) => handleInputChange('demarcationReport.reportGenerated', e.target.checked)}
                          />
                        }
                        label="Report Generated"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Forms Checklist</Typography>
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
                      <Autocomplete
                        options={recordVerifications}
                        getOptionLabel={(option) => option.verificationNumber || ''}
                        value={recordVerifications.find(rv => rv._id === formData.recordVerification) || null}
                        onChange={(e, newValue) => handleInputChange('recordVerification', newValue?._id || '')}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Record Verification"
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Autocomplete
                        options={khasraMappings}
                        getOptionLabel={(option) => option.mappingNumber || ''}
                        value={khasraMappings.find(km => km._id === formData.khasraMapping) || null}
                        onChange={(e, newValue) => handleInputChange('khasraMapping', newValue?._id || '')}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Khasra Mapping"
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
        Demarcation {id ? '(Edit)' : '(New)'}
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

export default Demarcation;
