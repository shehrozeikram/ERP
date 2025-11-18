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
  Map as MapIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../../services/api';

const workflowSteps = [
  'Obtaining Shajra',
  'Understanding Khasra Boundaries',
  'Verifying Area on Map',
  'Adjacent Khasras',
  'Land Overlap Detection',
  'Completion'
];

const areaUnits = ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'];
const shajraTypes = ['revenue_map', 'survey_map', 'satellite_map', 'cadastral_map', 'other'];
const landTypes = ['agricultural', 'residential', 'commercial', 'industrial', 'mixed_use', 'vacant', 'barren', 'forest', 'water_body', 'other'];
const directions = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'];
const boundaryStatuses = ['clear', 'disputed', 'unclear', 'encroached'];
const markerTypes = ['pillar', 'tree', 'wall', 'fence', 'natural', 'other'];
const markerConditions = ['good', 'damaged', 'missing', 'needs_repair'];
const measurementMethods = ['gps', 'total_station', 'tape', 'map_calculation', 'other'];
const overlapTypes = ['area_overlap', 'boundary_overlap', 'ownership_overlap', 'record_overlap', 'other'];
const overlapSeverities = ['minor', 'moderate', 'major', 'critical'];
const verificationMethods = ['physical_inspection', 'gps_verification', 'satellite_imagery', 'survey', 'other'];
const mapAccuracies = ['accurate', 'minor_discrepancies', 'major_discrepancies', 'inaccurate'];
const formTypes = ['shajra', 'boundary_certificate', 'area_certificate', 'adjacent_consent', 'overlap_report', 'mapping_certificate', 'other'];
const noteTypes = ['boundary', 'area', 'adjacent', 'overlap', 'general', 'other'];

const KhasraMapping = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [landIdentifications, setLandIdentifications] = useState([]);
  const [recordVerifications, setRecordVerifications] = useState([]);
  const [selectedKhasraIndex, setSelectedKhasraIndex] = useState(0);
  
  const [formData, setFormData] = useState({
    mappingNumber: '',
    landIdentification: '',
    recordVerification: '',
    status: 'draft',
    currentStep: 'shajra_obtaining',
    priority: 'medium',
    
    // Shajra
    shajra: {
      shajraNumber: '',
      shajraYear: '',
      obtainedDate: new Date().toISOString().split('T')[0],
      obtainedFrom: {
        name: '',
        designation: '',
        office: '',
        contactNumber: ''
      },
      shajraType: 'revenue_map',
      mapScale: '',
      mapDate: '',
      isOriginal: false,
      isCertified: false,
      certificationDate: '',
      notes: ''
    },
    
    // Khasras
    khasras: [],
    
    // Adjacent Khasras
    adjacentKhasras: [],
    
    // Overlaps
    overlaps: [],
    
    // Map Verification
    mapVerification: {
      verifiedOnMap: false,
      verificationDate: new Date().toISOString().split('T')[0],
      verificationMethod: 'physical_inspection',
      mapAccuracy: 'accurate',
      discrepancies: [],
      verificationNotes: ''
    },
    
    // Mapping Notes
    mappingNotes: [],
    
    // Forms Checklist
    formsChecklist: [],
    
    description: '',
    notes: ''
  });

  useEffect(() => {
    fetchLandIdentifications();
    fetchRecordVerifications();
    if (id) {
      fetchKhasraMapping();
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

  const fetchKhasraMapping = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/taj-residencia/khasra-mapping/${id}`);
      if (response.data.success) {
        const data = response.data.data;
        setFormData({
          ...data,
          shajra: {
            ...data.shajra,
            obtainedDate: data.shajra?.obtainedDate ? new Date(data.shajra.obtainedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            mapDate: data.shajra?.mapDate ? new Date(data.shajra.mapDate).toISOString().split('T')[0] : '',
            certificationDate: data.shajra?.certificationDate ? new Date(data.shajra.certificationDate).toISOString().split('T')[0] : ''
          },
          mapVerification: {
            ...data.mapVerification,
            verificationDate: data.mapVerification?.verificationDate ? new Date(data.mapVerification.verificationDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          khasras: (data.khasras || []).map(k => ({
            ...k,
            area: {
              ...k.area,
              measuredArea: {
                ...k.area?.measuredArea,
                measuredDate: k.area?.measuredArea?.measuredDate ? new Date(k.area.measuredArea.measuredDate).toISOString().split('T')[0] : ''
              }
            },
            mappedDate: k.mappedDate ? new Date(k.mappedDate).toISOString().split('T')[0] : ''
          })),
          adjacentKhasras: (data.adjacentKhasras || []).map(a => ({
            ...a,
            verifiedDate: a.verifiedDate ? new Date(a.verifiedDate).toISOString().split('T')[0] : ''
          })),
          overlaps: (data.overlaps || []).map(o => ({
            ...o,
            detectedDate: o.detectedDate ? new Date(o.detectedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            resolvedDate: o.resolvedDate ? new Date(o.resolvedDate).toISOString().split('T')[0] : ''
          }))
        });
        
        const stepIndex = workflowSteps.findIndex(step => 
          data.currentStep === step.toLowerCase().replace(/\s+/g, '_')
        );
        if (stepIndex !== -1) {
          setActiveStep(stepIndex);
        }
      }
    } catch (error) {
      console.error('Error fetching khasra mapping:', error);
      showSnackbar('Error fetching khasra mapping data', 'error');
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
      const stepNames = ['shajra_obtaining', 'boundary_understanding', 'area_verification', 'adjacent_khasras', 'overlap_detection', 'completion'];
      const dataToSave = {
        ...formData,
        currentStep: stepNames[activeStep],
        status: activeStep === workflowSteps.length - 1 ? 'completed' : formData.status
      };

      let response;
      if (id) {
        response = await api.put(`/taj-residencia/khasra-mapping/${id}`, dataToSave);
      } else {
        response = await api.post('/taj-residencia/khasra-mapping', dataToSave);
        if (response.data.success) {
          navigate(`/taj-residencia/land-acquisition/khasra-mapping/${response.data.data._id}`);
        }
      }

      if (response.data.success) {
        showSnackbar('Khasra mapping saved successfully', 'success');
      }
    } catch (error) {
      console.error('Error saving khasra mapping:', error);
      showSnackbar('Error saving khasra mapping', 'error');
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
      khasras: [...prev.khasras, {
        khasraNumber: '',
        khatuniNumber: '',
        mauzaName: '',
        boundaries: {
          north: { khasraNumber: '', ownerName: '', description: '', verified: false },
          south: { khasraNumber: '', ownerName: '', description: '', verified: false },
          east: { khasraNumber: '', ownerName: '', description: '', verified: false },
          west: { khasraNumber: '', ownerName: '', description: '', verified: false }
        },
        area: {
          recordedArea: { value: 0, unit: 'kanal' },
          measuredArea: { value: 0, unit: 'kanal', measurementMethod: 'map_calculation', measuredDate: '' },
          discrepancy: { value: 0, percentage: 0, type: 'match', explanation: '' },
          isVerified: false
        },
        mapCoordinates: {
          latitude: 0,
          longitude: 0,
          coordinates: [],
          polygonPoints: []
        },
        landType: 'agricultural',
        currentUse: '',
        mappingStatus: 'pending',
        mappedDate: new Date().toISOString().split('T')[0],
        mappingNotes: ''
      }]
    }));
  };

  const removeKhasra = (index) => {
    setFormData(prev => ({
      ...prev,
      khasras: prev.khasras.filter((_, i) => i !== index)
    }));
  };

  const addAdjacentKhasra = () => {
    setFormData(prev => ({
      ...prev,
      adjacentKhasras: [...prev.adjacentKhasras, {
        khasraNumber: '',
        direction: 'north',
        ownerName: '',
        ownerCNIC: '',
        contactNumber: '',
        area: { value: 0, unit: 'kanal' },
        landType: '',
        boundaryStatus: 'clear',
        boundaryMarkers: [],
        verified: false,
        verifiedDate: new Date().toISOString().split('T')[0],
        notes: ''
      }]
    }));
  };

  const removeAdjacentKhasra = (index) => {
    setFormData(prev => ({
      ...prev,
      adjacentKhasras: prev.adjacentKhasras.filter((_, i) => i !== index)
    }));
  };

  const addOverlap = () => {
    setFormData(prev => ({
      ...prev,
      overlaps: [...prev.overlaps, {
        overlapType: 'area_overlap',
        description: '',
        affectedKhasras: [],
        overlapArea: { value: 0, unit: 'kanal' },
        severity: 'moderate',
        detectedDate: new Date().toISOString().split('T')[0],
        resolutionStatus: 'open',
        resolutionNotes: ''
      }]
    }));
  };

  const removeOverlap = (index) => {
    setFormData(prev => ({
      ...prev,
      overlaps: prev.overlaps.filter((_, i) => i !== index)
    }));
  };

  const addMappingNote = () => {
    setFormData(prev => ({
      ...prev,
      mappingNotes: [...prev.mappingNotes, {
        noteType: 'general',
        note: '',
        khasraNumber: '',
        createdDate: new Date().toISOString().split('T')[0]
      }]
    }));
  };

  const removeMappingNote = (index) => {
    setFormData(prev => ({
      ...prev,
      mappingNotes: prev.mappingNotes.filter((_, i) => i !== index)
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
      case 0: // Obtaining Shajra
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 1: Obtaining Shajra</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Obtain the Shajra (revenue map) from the Patwari or revenue office. Record all details including map number, year, type, and certification status.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Shajra Number"
                    value={formData.shajra.shajraNumber}
                    onChange={(e) => handleInputChange('shajra.shajraNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Shajra Year"
                    value={formData.shajra.shajraYear}
                    onChange={(e) => handleInputChange('shajra.shajraYear', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Obtained Date"
                    value={formData.shajra.obtainedDate}
                    onChange={(e) => handleInputChange('shajra.obtainedDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Shajra Type</InputLabel>
                    <Select
                      value={formData.shajra.shajraType}
                      onChange={(e) => handleInputChange('shajra.shajraType', e.target.value)}
                    >
                      {shajraTypes.map(t => <MenuItem key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Map Scale"
                    value={formData.shajra.mapScale}
                    onChange={(e) => handleInputChange('shajra.mapScale', e.target.value)}
                    placeholder="e.g., 1:5000"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Map Date"
                    value={formData.shajra.mapDate}
                    onChange={(e) => handleInputChange('shajra.mapDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Obtained From</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Name"
                    value={formData.shajra.obtainedFrom.name}
                    onChange={(e) => handleInputChange('shajra.obtainedFrom.name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Designation"
                    value={formData.shajra.obtainedFrom.designation}
                    onChange={(e) => handleInputChange('shajra.obtainedFrom.designation', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Office"
                    value={formData.shajra.obtainedFrom.office}
                    onChange={(e) => handleInputChange('shajra.obtainedFrom.office', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Contact Number"
                    value={formData.shajra.obtainedFrom.contactNumber}
                    onChange={(e) => handleInputChange('shajra.obtainedFrom.contactNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.shajra.isOriginal}
                        onChange={(e) => handleInputChange('shajra.isOriginal', e.target.checked)}
                      />
                    }
                    label="Is Original Map"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.shajra.isCertified}
                        onChange={(e) => handleInputChange('shajra.isCertified', e.target.checked)}
                      />
                    }
                    label="Is Certified"
                  />
                </Grid>
                {formData.shajra.isCertified && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Certification Date"
                      value={formData.shajra.certificationDate}
                      onChange={(e) => handleInputChange('shajra.certificationDate', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                )}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Notes"
                    value={formData.shajra.notes}
                    onChange={(e) => handleInputChange('shajra.notes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 1: // Understanding Khasra Boundaries
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 2: Understanding Khasra Boundaries</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Map each Khasra with its boundaries. Record boundary details for North, South, East, and West sides including adjacent khasra numbers and owners.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1">Khasras</Typography>
                <Button startIcon={<AddIcon />} onClick={addKhasra} variant="outlined" size="small">
                  Add Khasra
                </Button>
              </Box>
              {formData.khasras.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Tabs value={selectedKhasraIndex} onChange={(e, newValue) => setSelectedKhasraIndex(newValue)}>
                    {formData.khasras.map((khasra, index) => (
                      <Tab key={index} label={`Khasra ${khasra.khasraNumber || index + 1}`} />
                    ))}
                  </Tabs>
                </Box>
              )}
              {formData.khasras.map((khasra, index) => (
                index === selectedKhasraIndex && (
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
                              const newKhasras = [...formData.khasras];
                              newKhasras[index].khasraNumber = e.target.value;
                              setFormData(prev => ({ ...prev, khasras: newKhasras }));
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Khatuni Number"
                            value={khasra.khatuniNumber || ''}
                            onChange={(e) => {
                              const newKhasras = [...formData.khasras];
                              newKhasras[index].khatuniNumber = e.target.value;
                              setFormData(prev => ({ ...prev, khasras: newKhasras }));
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Mauza Name"
                            value={khasra.mauzaName || ''}
                            onChange={(e) => {
                              const newKhasras = [...formData.khasras];
                              newKhasras[index].mauzaName = e.target.value;
                              setFormData(prev => ({ ...prev, khasras: newKhasras }));
                            }}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="subtitle2" gutterBottom>Boundaries</Typography>
                        </Grid>
                        {['north', 'south', 'east', 'west'].map(direction => (
                          <React.Fragment key={direction}>
                            <Grid item xs={12}>
                              <Typography variant="body2" fontWeight="bold" sx={{ textTransform: 'capitalize', mb: 1 }}>
                                {direction} Boundary
                              </Typography>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Adjacent Khasra Number"
                                value={khasra.boundaries?.[direction]?.khasraNumber || ''}
                                onChange={(e) => {
                                  const newKhasras = [...formData.khasras];
                                  if (!newKhasras[index].boundaries) newKhasras[index].boundaries = {};
                                  if (!newKhasras[index].boundaries[direction]) newKhasras[index].boundaries[direction] = {};
                                  newKhasras[index].boundaries[direction].khasraNumber = e.target.value;
                                  setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Adjacent Owner Name"
                                value={khasra.boundaries?.[direction]?.ownerName || ''}
                                onChange={(e) => {
                                  const newKhasras = [...formData.khasras];
                                  if (!newKhasras[index].boundaries) newKhasras[index].boundaries = {};
                                  if (!newKhasras[index].boundaries[direction]) newKhasras[index].boundaries[direction] = {};
                                  newKhasras[index].boundaries[direction].ownerName = e.target.value;
                                  setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Description"
                                value={khasra.boundaries?.[direction]?.description || ''}
                                onChange={(e) => {
                                  const newKhasras = [...formData.khasras];
                                  if (!newKhasras[index].boundaries) newKhasras[index].boundaries = {};
                                  if (!newKhasras[index].boundaries[direction]) newKhasras[index].boundaries[direction] = {};
                                  newKhasras[index].boundaries[direction].description = e.target.value;
                                  setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={khasra.boundaries?.[direction]?.verified || false}
                                    onChange={(e) => {
                                      const newKhasras = [...formData.khasras];
                                      if (!newKhasras[index].boundaries) newKhasras[index].boundaries = {};
                                      if (!newKhasras[index].boundaries[direction]) newKhasras[index].boundaries[direction] = {};
                                      newKhasras[index].boundaries[direction].verified = e.target.checked;
                                      setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                    }}
                                  />
                                }
                                label="Verified"
                              />
                            </Grid>
                          </React.Fragment>
                        ))}
                        <Grid item xs={12} md={4}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Land Type</InputLabel>
                            <Select
                              value={khasra.landType || 'agricultural'}
                              onChange={(e) => {
                                const newKhasras = [...formData.khasras];
                                newKhasras[index].landType = e.target.value;
                                setFormData(prev => ({ ...prev, khasras: newKhasras }));
                              }}
                            >
                              {landTypes.map(t => <MenuItem key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</MenuItem>)}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Current Use"
                            value={khasra.currentUse || ''}
                            onChange={(e) => {
                              const newKhasras = [...formData.khasras];
                              newKhasras[index].currentUse = e.target.value;
                              setFormData(prev => ({ ...prev, khasras: newKhasras }));
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Mapping Status</InputLabel>
                            <Select
                              value={khasra.mappingStatus || 'pending'}
                              onChange={(e) => {
                                const newKhasras = [...formData.khasras];
                                newKhasras[index].mappingStatus = e.target.value;
                                setFormData(prev => ({ ...prev, khasras: newKhasras }));
                              }}
                            >
                              <MenuItem value="pending">Pending</MenuItem>
                              <MenuItem value="in_progress">In Progress</MenuItem>
                              <MenuItem value="completed">Completed</MenuItem>
                              <MenuItem value="disputed">Disputed</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            size="small"
                            multiline
                            rows={2}
                            label="Mapping Notes"
                            value={khasra.mappingNotes || ''}
                            onChange={(e) => {
                              const newKhasras = [...formData.khasras];
                              newKhasras[index].mappingNotes = e.target.value;
                              setFormData(prev => ({ ...prev, khasras: newKhasras }));
                            }}
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                )
              ))}
              {formData.khasras.length === 0 && (
                <Alert severity="info">No Khasras added yet. Click "Add Khasra" to add one.</Alert>
              )}
            </CardContent>
          </Card>
        );

      case 2: // Verifying Area on Map
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 3: Verifying Area on Map</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Verify the area of each Khasra by comparing recorded area with measured area. Record discrepancies and verify on map.
              </Typography>
              <Divider sx={{ my: 2 }} />
              {formData.khasras.length > 0 ? (
                <Box>
                  <Tabs value={selectedKhasraIndex} onChange={(e, newValue) => setSelectedKhasraIndex(newValue)}>
                    {formData.khasras.map((khasra, index) => (
                      <Tab key={index} label={`Khasra ${khasra.khasraNumber || index + 1}`} />
                    ))}
                  </Tabs>
                  {formData.khasras.map((khasra, index) => (
                    index === selectedKhasraIndex && (
                      <Card key={index} sx={{ mt: 2, border: '1px solid #e0e0e0' }}>
                        <CardContent>
                          <Typography variant="subtitle2" gutterBottom>Khasra: {khasra.khasraNumber || `#${index + 1}`}</Typography>
                          <Divider sx={{ my: 2 }} />
                          <Grid container spacing={3}>
                            <Grid item xs={12}>
                              <Typography variant="subtitle2" gutterBottom>Recorded Area</Typography>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="Area Value"
                                value={khasra.area?.recordedArea?.value || 0}
                                onChange={(e) => {
                                  const newKhasras = [...formData.khasras];
                                  if (!newKhasras[index].area) newKhasras[index].area = {};
                                  if (!newKhasras[index].area.recordedArea) newKhasras[index].area.recordedArea = {};
                                  newKhasras[index].area.recordedArea.value = parseFloat(e.target.value) || 0;
                                  setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Area Unit</InputLabel>
                                <Select
                                  value={khasra.area?.recordedArea?.unit || 'kanal'}
                                  onChange={(e) => {
                                    const newKhasras = [...formData.khasras];
                                    if (!newKhasras[index].area) newKhasras[index].area = {};
                                    if (!newKhasras[index].area.recordedArea) newKhasras[index].area.recordedArea = {};
                                    newKhasras[index].area.recordedArea.unit = e.target.value;
                                    setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                  }}
                                >
                                  {areaUnits.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12}>
                              <Divider sx={{ my: 2 }} />
                              <Typography variant="subtitle2" gutterBottom>Measured Area</Typography>
                            </Grid>
                            <Grid item xs={12} md={3}>
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="Measured Value"
                                value={khasra.area?.measuredArea?.value || 0}
                                onChange={(e) => {
                                  const newKhasras = [...formData.khasras];
                                  if (!newKhasras[index].area) newKhasras[index].area = {};
                                  if (!newKhasras[index].area.measuredArea) newKhasras[index].area.measuredArea = {};
                                  newKhasras[index].area.measuredArea.value = parseFloat(e.target.value) || 0;
                                  setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} md={3}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Area Unit</InputLabel>
                                <Select
                                  value={khasra.area?.measuredArea?.unit || 'kanal'}
                                  onChange={(e) => {
                                    const newKhasras = [...formData.khasras];
                                    if (!newKhasras[index].area) newKhasras[index].area = {};
                                    if (!newKhasras[index].area.measuredArea) newKhasras[index].area.measuredArea = {};
                                    newKhasras[index].area.measuredArea.unit = e.target.value;
                                    setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                  }}
                                >
                                  {areaUnits.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={3}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Measurement Method</InputLabel>
                                <Select
                                  value={khasra.area?.measuredArea?.measurementMethod || 'map_calculation'}
                                  onChange={(e) => {
                                    const newKhasras = [...formData.khasras];
                                    if (!newKhasras[index].area) newKhasras[index].area = {};
                                    if (!newKhasras[index].area.measuredArea) newKhasras[index].area.measuredArea = {};
                                    newKhasras[index].area.measuredArea.measurementMethod = e.target.value;
                                    setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                  }}
                                >
                                  {measurementMethods.map(m => <MenuItem key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</MenuItem>)}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={3}>
                              <TextField
                                fullWidth
                                size="small"
                                type="date"
                                label="Measured Date"
                                value={khasra.area?.measuredArea?.measuredDate || ''}
                                onChange={(e) => {
                                  const newKhasras = [...formData.khasras];
                                  if (!newKhasras[index].area) newKhasras[index].area = {};
                                  if (!newKhasras[index].area.measuredArea) newKhasras[index].area.measuredArea = {};
                                  newKhasras[index].area.measuredArea.measuredDate = e.target.value;
                                  setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                }}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <Divider sx={{ my: 2 }} />
                              <Typography variant="subtitle2" gutterBottom>Area Discrepancy</Typography>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Discrepancy Type</InputLabel>
                                <Select
                                  value={khasra.area?.discrepancy?.type || 'match'}
                                  onChange={(e) => {
                                    const newKhasras = [...formData.khasras];
                                    if (!newKhasras[index].area) newKhasras[index].area = {};
                                    if (!newKhasras[index].area.discrepancy) newKhasras[index].area.discrepancy = {};
                                    newKhasras[index].area.discrepancy.type = e.target.value;
                                    setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                  }}
                                >
                                  <MenuItem value="match">Match</MenuItem>
                                  <MenuItem value="excess">Excess</MenuItem>
                                  <MenuItem value="deficit">Deficit</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="Discrepancy Value"
                                value={khasra.area?.discrepancy?.value || 0}
                                onChange={(e) => {
                                  const newKhasras = [...formData.khasras];
                                  if (!newKhasras[index].area) newKhasras[index].area = {};
                                  if (!newKhasras[index].area.discrepancy) newKhasras[index].area.discrepancy = {};
                                  newKhasras[index].area.discrepancy.value = parseFloat(e.target.value) || 0;
                                  setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="Discrepancy Percentage"
                                value={khasra.area?.discrepancy?.percentage || 0}
                                onChange={(e) => {
                                  const newKhasras = [...formData.khasras];
                                  if (!newKhasras[index].area) newKhasras[index].area = {};
                                  if (!newKhasras[index].area.discrepancy) newKhasras[index].area.discrepancy = {};
                                  newKhasras[index].area.discrepancy.percentage = parseFloat(e.target.value) || 0;
                                  setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                }}
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <TextField
                                fullWidth
                                size="small"
                                multiline
                                rows={2}
                                label="Discrepancy Explanation"
                                value={khasra.area?.discrepancy?.explanation || ''}
                                onChange={(e) => {
                                  const newKhasras = [...formData.khasras];
                                  if (!newKhasras[index].area) newKhasras[index].area = {};
                                  if (!newKhasras[index].area.discrepancy) newKhasras[index].area.discrepancy = {};
                                  newKhasras[index].area.discrepancy.explanation = e.target.value;
                                  setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                }}
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={khasra.area?.isVerified || false}
                                    onChange={(e) => {
                                      const newKhasras = [...formData.khasras];
                                      if (!newKhasras[index].area) newKhasras[index].area = {};
                                      newKhasras[index].area.isVerified = e.target.checked;
                                      setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                    }}
                                  />
                                }
                                label="Area Verified"
                              />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="Latitude (if GPS)"
                                value={khasra.mapCoordinates?.latitude || ''}
                                onChange={(e) => {
                                  const newKhasras = [...formData.khasras];
                                  if (!newKhasras[index].mapCoordinates) newKhasras[index].mapCoordinates = {};
                                  newKhasras[index].mapCoordinates.latitude = parseFloat(e.target.value) || 0;
                                  setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="Longitude (if GPS)"
                                value={khasra.mapCoordinates?.longitude || ''}
                                onChange={(e) => {
                                  const newKhasras = [...formData.khasras];
                                  if (!newKhasras[index].mapCoordinates) newKhasras[index].mapCoordinates = {};
                                  newKhasras[index].mapCoordinates.longitude = parseFloat(e.target.value) || 0;
                                  setFormData(prev => ({ ...prev, khasras: newKhasras }));
                                }}
                              />
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    )
                  ))}
                </Box>
              ) : (
                <Alert severity="info">Please add Khasras in Step 2 first.</Alert>
              )}
            </CardContent>
          </Card>
        );

      case 3: // Adjacent Khasras
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 4: Adjacent Khasras</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Document all adjacent Khasras with their owners, boundaries, and boundary markers. Verify boundary status and markers condition.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1">Adjacent Khasras</Typography>
                <Button startIcon={<AddIcon />} onClick={addAdjacentKhasra} variant="outlined" size="small">
                  Add Adjacent Khasra
                </Button>
              </Box>
              {formData.adjacentKhasras.map((adjacent, index) => (
                <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle2">Adjacent Khasra #{index + 1}</Typography>
                      <IconButton size="small" onClick={() => removeAdjacentKhasra(index)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Khasra Number *"
                          value={adjacent.khasraNumber}
                          onChange={(e) => {
                            const newAdjacents = [...formData.adjacentKhasras];
                            newAdjacents[index].khasraNumber = e.target.value;
                            setFormData(prev => ({ ...prev, adjacentKhasras: newAdjacents }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Direction *</InputLabel>
                          <Select
                            value={adjacent.direction}
                            onChange={(e) => {
                              const newAdjacents = [...formData.adjacentKhasras];
                              newAdjacents[index].direction = e.target.value;
                              setFormData(prev => ({ ...prev, adjacentKhasras: newAdjacents }));
                            }}
                          >
                            {directions.map(d => <MenuItem key={d} value={d}>{d.toUpperCase()}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Owner Name"
                          value={adjacent.ownerName || ''}
                          onChange={(e) => {
                            const newAdjacents = [...formData.adjacentKhasras];
                            newAdjacents[index].ownerName = e.target.value;
                            setFormData(prev => ({ ...prev, adjacentKhasras: newAdjacents }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Owner CNIC"
                          value={adjacent.ownerCNIC || ''}
                          onChange={(e) => {
                            const newAdjacents = [...formData.adjacentKhasras];
                            newAdjacents[index].ownerCNIC = e.target.value;
                            setFormData(prev => ({ ...prev, adjacentKhasras: newAdjacents }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Contact Number"
                          value={adjacent.contactNumber || ''}
                          onChange={(e) => {
                            const newAdjacents = [...formData.adjacentKhasras];
                            newAdjacents[index].contactNumber = e.target.value;
                            setFormData(prev => ({ ...prev, adjacentKhasras: newAdjacents }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="Area Value"
                          value={adjacent.area?.value || 0}
                          onChange={(e) => {
                            const newAdjacents = [...formData.adjacentKhasras];
                            if (!newAdjacents[index].area) newAdjacents[index].area = {};
                            newAdjacents[index].area.value = parseFloat(e.target.value) || 0;
                            setFormData(prev => ({ ...prev, adjacentKhasras: newAdjacents }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Area Unit</InputLabel>
                          <Select
                            value={adjacent.area?.unit || 'kanal'}
                            onChange={(e) => {
                              const newAdjacents = [...formData.adjacentKhasras];
                              if (!newAdjacents[index].area) newAdjacents[index].area = {};
                              newAdjacents[index].area.unit = e.target.value;
                              setFormData(prev => ({ ...prev, adjacentKhasras: newAdjacents }));
                            }}
                          >
                            {areaUnits.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Land Type"
                          value={adjacent.landType || ''}
                          onChange={(e) => {
                            const newAdjacents = [...formData.adjacentKhasras];
                            newAdjacents[index].landType = e.target.value;
                            setFormData(prev => ({ ...prev, adjacentKhasras: newAdjacents }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Boundary Status</InputLabel>
                          <Select
                            value={adjacent.boundaryStatus || 'clear'}
                            onChange={(e) => {
                              const newAdjacents = [...formData.adjacentKhasras];
                              newAdjacents[index].boundaryStatus = e.target.value;
                              setFormData(prev => ({ ...prev, adjacentKhasras: newAdjacents }));
                            }}
                          >
                            {boundaryStatuses.map(s => <MenuItem key={s} value={s}>{s.toUpperCase()}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={adjacent.verified || false}
                              onChange={(e) => {
                                const newAdjacents = [...formData.adjacentKhasras];
                                newAdjacents[index].verified = e.target.checked;
                                setFormData(prev => ({ ...prev, adjacentKhasras: newAdjacents }));
                              }}
                            />
                          }
                          label="Verified"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={2}
                          label="Notes"
                          value={adjacent.notes || ''}
                          onChange={(e) => {
                            const newAdjacents = [...formData.adjacentKhasras];
                            newAdjacents[index].notes = e.target.value;
                            setFormData(prev => ({ ...prev, adjacentKhasras: newAdjacents }));
                          }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
              {formData.adjacentKhasras.length === 0 && (
                <Alert severity="info">No adjacent Khasras added yet. Click "Add Adjacent Khasra" to add one.</Alert>
              )}
            </CardContent>
          </Card>
        );

      case 4: // Land Overlap Detection
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 5: Land Overlap Detection</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Detect and document any overlaps in area, boundaries, ownership, or records. Record severity and resolution status.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1">Overlaps</Typography>
                <Button startIcon={<AddIcon />} onClick={addOverlap} variant="outlined" size="small">
                  Add Overlap
                </Button>
              </Box>
              {formData.overlaps.map((overlap, index) => (
                <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle2">Overlap #{index + 1}</Typography>
                      <IconButton size="small" onClick={() => removeOverlap(index)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Overlap Type *</InputLabel>
                          <Select
                            value={overlap.overlapType}
                            onChange={(e) => {
                              const newOverlaps = [...formData.overlaps];
                              newOverlaps[index].overlapType = e.target.value;
                              setFormData(prev => ({ ...prev, overlaps: newOverlaps }));
                            }}
                          >
                            {overlapTypes.map(t => <MenuItem key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Severity</InputLabel>
                          <Select
                            value={overlap.severity}
                            onChange={(e) => {
                              const newOverlaps = [...formData.overlaps];
                              newOverlaps[index].severity = e.target.value;
                              setFormData(prev => ({ ...prev, overlaps: newOverlaps }));
                            }}
                          >
                            {overlapSeverities.map(s => <MenuItem key={s} value={s}>{s.toUpperCase()}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Resolution Status</InputLabel>
                          <Select
                            value={overlap.resolutionStatus}
                            onChange={(e) => {
                              const newOverlaps = [...formData.overlaps];
                              newOverlaps[index].resolutionStatus = e.target.value;
                              setFormData(prev => ({ ...prev, overlaps: newOverlaps }));
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
                          label="Overlap Description *"
                          value={overlap.description}
                          onChange={(e) => {
                            const newOverlaps = [...formData.overlaps];
                            newOverlaps[index].description = e.target.value;
                            setFormData(prev => ({ ...prev, overlaps: newOverlaps }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="Overlap Area Value"
                          value={overlap.overlapArea?.value || 0}
                          onChange={(e) => {
                            const newOverlaps = [...formData.overlaps];
                            if (!newOverlaps[index].overlapArea) newOverlaps[index].overlapArea = {};
                            newOverlaps[index].overlapArea.value = parseFloat(e.target.value) || 0;
                            setFormData(prev => ({ ...prev, overlaps: newOverlaps }));
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Area Unit</InputLabel>
                          <Select
                            value={overlap.overlapArea?.unit || 'kanal'}
                            onChange={(e) => {
                              const newOverlaps = [...formData.overlaps];
                              if (!newOverlaps[index].overlapArea) newOverlaps[index].overlapArea = {};
                              newOverlaps[index].overlapArea.unit = e.target.value;
                              setFormData(prev => ({ ...prev, overlaps: newOverlaps }));
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
                          type="date"
                          label="Detected Date"
                          value={overlap.detectedDate}
                          onChange={(e) => {
                            const newOverlaps = [...formData.overlaps];
                            newOverlaps[index].detectedDate = e.target.value;
                            setFormData(prev => ({ ...prev, overlaps: newOverlaps }));
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
                          label="Resolution Notes"
                          value={overlap.resolutionNotes || ''}
                          onChange={(e) => {
                            const newOverlaps = [...formData.overlaps];
                            newOverlaps[index].resolutionNotes = e.target.value;
                            setFormData(prev => ({ ...prev, overlaps: newOverlaps }));
                          }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
              {formData.overlaps.length === 0 && (
                <Alert severity="info">No overlaps detected yet. Click "Add Overlap" to add one.</Alert>
              )}
            </CardContent>
          </Card>
        );

      case 5: // Completion
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Map Verification</Typography>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="date"
                        label="Verification Date"
                        value={formData.mapVerification.verificationDate}
                        onChange={(e) => handleInputChange('mapVerification.verificationDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Verification Method</InputLabel>
                        <Select
                          value={formData.mapVerification.verificationMethod}
                          onChange={(e) => handleInputChange('mapVerification.verificationMethod', e.target.value)}
                        >
                          {verificationMethods.map(m => <MenuItem key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Map Accuracy</InputLabel>
                        <Select
                          value={formData.mapVerification.mapAccuracy}
                          onChange={(e) => handleInputChange('mapVerification.mapAccuracy', e.target.value)}
                        >
                          {mapAccuracies.map(a => <MenuItem key={a} value={a}>{a.replace('_', ' ').toUpperCase()}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.mapVerification.verifiedOnMap}
                            onChange={(e) => handleInputChange('mapVerification.verifiedOnMap', e.target.checked)}
                          />
                        }
                        label="Verified on Map"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Verification Notes"
                        value={formData.mapVerification.verificationNotes}
                        onChange={(e) => handleInputChange('mapVerification.verificationNotes', e.target.value)}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Mapping Notes</Typography>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2">Notes</Typography>
                    <Button startIcon={<AddIcon />} onClick={addMappingNote} variant="outlined" size="small">
                      Add Note
                    </Button>
                  </Box>
                  {formData.mappingNotes.map((note, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" fontWeight="bold">Note #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeMappingNote(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Note Type</InputLabel>
                              <Select
                                value={note.noteType}
                                onChange={(e) => {
                                  const newNotes = [...formData.mappingNotes];
                                  newNotes[index].noteType = e.target.value;
                                  setFormData(prev => ({ ...prev, mappingNotes: newNotes }));
                                }}
                              >
                                {noteTypes.map(t => <MenuItem key={t} value={t}>{t.toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Khasra Number (if applicable)"
                              value={note.khasraNumber || ''}
                              onChange={(e) => {
                                const newNotes = [...formData.mappingNotes];
                                newNotes[index].khasraNumber = e.target.value;
                                setFormData(prev => ({ ...prev, mappingNotes: newNotes }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              rows={3}
                              label="Note *"
                              value={note.note}
                              onChange={(e) => {
                                const newNotes = [...formData.mappingNotes];
                                newNotes[index].note = e.target.value;
                                setFormData(prev => ({ ...prev, mappingNotes: newNotes }));
                              }}
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                  {formData.mappingNotes.length === 0 && (
                    <Alert severity="info">No mapping notes added yet. Click "Add Note" to add one.</Alert>
                  )}
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
        Khasra Mapping {id ? '(Edit)' : '(New)'}
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

export default KhasraMapping;
