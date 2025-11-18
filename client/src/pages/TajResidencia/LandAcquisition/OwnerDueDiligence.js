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
  Delete as DeleteIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../../services/api';

const workflowSteps = [
  'CNIC Checks',
  'NADRA Family Tree',
  'Multiple Heirs',
  'Power of Attorney',
  'Dispute History',
  'Death Cases',
  'Owner Interview',
  'Completion'
];

const cnicTypes = ['original', 'renewed', 'duplicate', 'smart_card'];
const verificationMethods = ['nadra_online', 'nadra_office', 'manual_check', 'third_party', 'other'];
const verificationStatuses = ['valid', 'invalid', 'expired', 'suspicious', 'pending'];
const redFlagTypes = ['expired', 'mismatch', 'duplicate', 'suspicious_activity', 'blacklisted', 'other'];
const relationships = ['father', 'mother', 'spouse', 'son', 'daughter', 'brother', 'sister', 'grandfather', 'grandmother', 'uncle', 'aunt', 'cousin', 'other'];
const heirRelationships = ['son', 'daughter', 'spouse', 'father', 'mother', 'brother', 'sister', 'grandson', 'granddaughter', 'other'];
const consentStatuses = ['consented', 'not_consented', 'pending', 'disputed', 'deceased'];
const poaTypes = ['general', 'special', 'irrevocable', 'limited', 'other'];
const disputeTypes = ['ownership', 'inheritance', 'partition', 'boundary', 'encumbrance', 'mutation', 'revenue', 'legal', 'other'];
const caseStatuses = ['pending', 'ongoing', 'resolved', 'dismissed', 'appealed', 'settled'];
const impacts = ['none', 'low', 'medium', 'high', 'critical'];
const inheritanceRights = ['full', 'partial', 'none', 'disputed'];
const mutationStatuses = ['not_applied', 'applied', 'in_process', 'completed', 'rejected'];
const formTypes = ['cnic_copy', 'nadra_report', 'family_tree', 'poa', 'death_certificate', 'succession_certificate', 'heir_consent', 'interview_report', 'other'];

const OwnerDueDiligence = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [landIdentifications, setLandIdentifications] = useState([]);
  const [recordVerifications, setRecordVerifications] = useState([]);
  
  const [formData, setFormData] = useState({
    dueDiligenceNumber: '',
    landIdentification: '',
    recordVerification: '',
    status: 'draft',
    currentStep: 'cnic_checks',
    priority: 'medium',
    
    // CNIC Checks
    cnicChecks: {
      checked: false,
      checkDate: new Date().toISOString().split('T')[0],
      cnicVerifications: [],
      checkNotes: ''
    },
    
    // NADRA Family Tree
    nadraFamilyTree: {
      verified: false,
      verificationDate: new Date().toISOString().split('T')[0],
      familyTree: {
        primaryOwner: { name: '', cnic: '', relationship: 'self' },
        familyMembers: [],
        treeStructure: '',
        nadraReportUrl: '',
        verificationNotes: ''
      },
      verificationNotes: ''
    },
    
    // Multiple Heirs
    multipleHeirs: {
      identified: false,
      identificationDate: new Date().toISOString().split('T')[0],
      heirs: [],
      totalHeirs: 0,
      consentedHeirs: 0,
      disputedHeirs: 0,
      deceasedHeirs: 0,
      identificationNotes: ''
    },
    
    // Power of Attorney
    powerOfAttorney: {
      verified: false,
      verificationDate: new Date().toISOString().split('T')[0],
      poaDocuments: [],
      verificationNotes: ''
    },
    
    // Dispute History
    disputeHistory: {
      checked: false,
      checkDate: new Date().toISOString().split('T')[0],
      disputes: [],
      totalDisputes: 0,
      activeDisputes: 0,
      resolvedDisputes: 0,
      criticalDisputes: 0,
      checkNotes: ''
    },
    
    // Death Cases
    deathCases: {
      verified: false,
      verificationDate: new Date().toISOString().split('T')[0],
      deathCases: [],
      totalDeathCases: 0,
      verifiedDeathCases: 0,
      verificationNotes: ''
    },
    
    // Owner Interview
    ownerInterview: {
      conducted: false,
      interviewDate: new Date().toISOString().split('T')[0],
      interviewTime: '',
      interviewLocation: '',
      participants: [],
      checklist: {
        identityVerification: { checked: false, notes: '' },
        ownershipConfirmation: { checked: false, notes: '' },
        cnicVerification: { checked: false, notes: '' },
        familyTreeConfirmation: { checked: false, notes: '' },
        heirsConsent: { checked: false, notes: '' },
        poaVerification: { checked: false, notes: '' },
        disputeDisclosure: { checked: false, notes: '' },
        deathCaseDisclosure: { checked: false, notes: '' },
        landDetailsConfirmation: { checked: false, notes: '' },
        saleIntent: { checked: false, notes: '' },
        priceExpectation: { checked: false, notes: '' },
        encumbrancesDisclosure: { checked: false, notes: '' },
        documentsProvided: { checked: false, notes: '' }
      },
      qa: [],
      observations: '',
      redFlags: [],
      interviewNotes: ''
    },
    
    // Forms Checklist
    formsChecklist: [],
    
    // Risk Assessment
    riskAssessment: {
      overallRisk: 'low',
      riskFactors: [],
      recommendations: ''
    },
    
    description: '',
    notes: ''
  });

  useEffect(() => {
    fetchLandIdentifications();
    fetchRecordVerifications();
    if (id) {
      fetchOwnerDueDiligence();
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

  const fetchOwnerDueDiligence = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/taj-residencia/owner-due-diligence/${id}`);
      if (response.data.success) {
        const data = response.data.data;
        setFormData({
          ...data,
          cnicChecks: {
            ...data.cnicChecks,
            checkDate: data.cnicChecks?.checkDate ? new Date(data.cnicChecks.checkDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          nadraFamilyTree: {
            ...data.nadraFamilyTree,
            verificationDate: data.nadraFamilyTree?.verificationDate ? new Date(data.nadraFamilyTree.verificationDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          multipleHeirs: {
            ...data.multipleHeirs,
            identificationDate: data.multipleHeirs?.identificationDate ? new Date(data.multipleHeirs.identificationDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          powerOfAttorney: {
            ...data.powerOfAttorney,
            verificationDate: data.powerOfAttorney?.verificationDate ? new Date(data.powerOfAttorney.verificationDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          disputeHistory: {
            ...data.disputeHistory,
            checkDate: data.disputeHistory?.checkDate ? new Date(data.disputeHistory.checkDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          deathCases: {
            ...data.deathCases,
            verificationDate: data.deathCases?.verificationDate ? new Date(data.deathCases.verificationDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            deathCases: (data.deathCases?.deathCases || []).map(dc => ({
              ...dc,
              dateOfDeath: dc.dateOfDeath ? new Date(dc.dateOfDeath).toISOString().split('T')[0] : '',
              deathCertificateDate: dc.deathCertificateDate ? new Date(dc.deathCertificateDate).toISOString().split('T')[0] : '',
              mutationDate: dc.mutationDate ? new Date(dc.mutationDate).toISOString().split('T')[0] : ''
            }))
          },
          ownerInterview: {
            ...data.ownerInterview,
            interviewDate: data.ownerInterview?.interviewDate ? new Date(data.ownerInterview.interviewDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
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
      console.error('Error fetching owner due diligence:', error);
      showSnackbar('Error fetching owner due diligence data', 'error');
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
      const stepNames = ['cnic_checks', 'nadra_family_tree', 'multiple_heirs', 'power_of_attorney', 'dispute_history', 'death_cases', 'owner_interview', 'completion'];
      const dataToSave = {
        ...formData,
        currentStep: stepNames[activeStep],
        status: activeStep === workflowSteps.length - 1 ? 'completed' : formData.status
      };

      let response;
      if (id) {
        response = await api.put(`/taj-residencia/owner-due-diligence/${id}`, dataToSave);
      } else {
        response = await api.post('/taj-residencia/owner-due-diligence', dataToSave);
        if (response.data.success) {
          navigate(`/taj-residencia/land-acquisition/owner-due-diligence/${response.data.data._id}`);
        }
      }

      if (response.data.success) {
        showSnackbar('Owner due diligence saved successfully', 'success');
      }
    } catch (error) {
      console.error('Error saving owner due diligence:', error);
      showSnackbar('Error saving owner due diligence', 'error');
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

  const addCNICVerification = () => {
    setFormData(prev => ({
      ...prev,
      cnicChecks: {
        ...prev.cnicChecks,
        cnicVerifications: [...prev.cnicChecks.cnicVerifications, {
          ownerName: '',
          cnic: '',
          cnicIssueDate: '',
          cnicExpiryDate: '',
          cnicType: 'original',
          verificationMethod: 'nadra_online',
          verificationDate: new Date().toISOString().split('T')[0],
          verificationStatus: 'pending',
          verificationNotes: '',
          redFlags: []
        }]
      }
    }));
  };

  const removeCNICVerification = (index) => {
    setFormData(prev => ({
      ...prev,
      cnicChecks: {
        ...prev.cnicChecks,
        cnicVerifications: prev.cnicChecks.cnicVerifications.filter((_, i) => i !== index)
      }
    }));
  };

  const addFamilyMember = () => {
    setFormData(prev => ({
      ...prev,
      nadraFamilyTree: {
        ...prev.nadraFamilyTree,
        familyTree: {
          ...prev.nadraFamilyTree.familyTree,
          familyMembers: [...prev.nadraFamilyTree.familyTree.familyMembers, {
            name: '',
            cnic: '',
            relationship: 'son',
            dateOfBirth: '',
            dateOfDeath: '',
            isAlive: true,
            isLegalHeir: false,
            nadraVerified: false,
            notes: ''
          }]
        }
      }
    }));
  };

  const removeFamilyMember = (index) => {
    setFormData(prev => ({
      ...prev,
      nadraFamilyTree: {
        ...prev.nadraFamilyTree,
        familyTree: {
          ...prev.nadraFamilyTree.familyTree,
          familyMembers: prev.nadraFamilyTree.familyTree.familyMembers.filter((_, i) => i !== index)
        }
      }
    }));
  };

  const addHeir = () => {
    setFormData(prev => ({
      ...prev,
      multipleHeirs: {
        ...prev.multipleHeirs,
        heirs: [...prev.multipleHeirs.heirs, {
          heirNumber: '',
          name: '',
          cnic: '',
          relationship: 'son',
          share: { numerator: 1, denominator: 1, percentage: 0 },
          dateOfBirth: '',
          dateOfDeath: '',
          isAlive: true,
          contactNumber: '',
          address: { street: '', city: '', district: '', province: '', postalCode: '' },
          consentStatus: 'pending',
          consentDate: '',
          verified: false,
          notes: ''
        }]
      }
    }));
  };

  const removeHeir = (index) => {
    setFormData(prev => ({
      ...prev,
      multipleHeirs: {
        ...prev.multipleHeirs,
        heirs: prev.multipleHeirs.heirs.filter((_, i) => i !== index)
      }
    }));
  };

  const addPOA = () => {
    setFormData(prev => ({
      ...prev,
      powerOfAttorney: {
        ...prev.powerOfAttorney,
        poaDocuments: [...prev.powerOfAttorney.poaDocuments, {
          poaNumber: '',
          principalName: '',
          principalCNIC: '',
          attorneyName: '',
          attorneyCNIC: '',
          poaType: 'general',
          executionDate: new Date().toISOString().split('T')[0],
          expiryDate: '',
          isExpired: false,
          notarized: false,
          notaryName: '',
          notaryLicense: '',
          notarizationDate: '',
          stampPaperValue: 0,
          stampPaperNumber: '',
          registrationNumber: '',
          registrationOffice: '',
          registrationDate: '',
          verificationStatus: 'pending',
          verificationNotes: '',
          redFlags: [],
          notes: ''
        }]
      }
    }));
  };

  const removePOA = (index) => {
    setFormData(prev => ({
      ...prev,
      powerOfAttorney: {
        ...prev.powerOfAttorney,
        poaDocuments: prev.powerOfAttorney.poaDocuments.filter((_, i) => i !== index)
      }
    }));
  };

  const addDispute = () => {
    setFormData(prev => ({
      ...prev,
      disputeHistory: {
        ...prev.disputeHistory,
        disputes: [...prev.disputeHistory.disputes, {
          disputeNumber: '',
          disputeType: 'ownership',
          disputeDescription: '',
          partiesInvolved: [],
          disputeDate: new Date().toISOString().split('T')[0],
          courtName: '',
          caseNumber: '',
          caseStatus: 'pending',
          resolutionDate: '',
          resolutionDetails: '',
          impact: 'medium',
          notes: ''
        }]
      }
    }));
  };

  const removeDispute = (index) => {
    setFormData(prev => ({
      ...prev,
      disputeHistory: {
        ...prev.disputeHistory,
        disputes: prev.disputeHistory.disputes.filter((_, i) => i !== index)
      }
    }));
  };

  const addDeathCase = () => {
    setFormData(prev => ({
      ...prev,
      deathCases: {
        ...prev.deathCases,
        deathCases: [...prev.deathCases.deathCases, {
          caseNumber: '',
          deceasedName: '',
          deceasedCNIC: '',
          dateOfDeath: new Date().toISOString().split('T')[0],
          placeOfDeath: '',
          deathCertificateNumber: '',
          deathCertificateIssuedBy: '',
          deathCertificateDate: '',
          survivingSpouse: {
            name: '',
            cnic: '',
            dateOfBirth: '',
            contactNumber: '',
            address: '',
            isAlive: true,
            inheritanceRights: 'partial'
          },
          legalHeirs: [],
          inheritanceDocuments: [],
          mutationStatus: 'not_applied',
          mutationNumber: '',
          mutationDate: '',
          verified: false,
          notes: ''
        }]
      }
    }));
  };

  const removeDeathCase = (index) => {
    setFormData(prev => ({
      ...prev,
      deathCases: {
        ...prev.deathCases,
        deathCases: prev.deathCases.deathCases.filter((_, i) => i !== index)
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
      case 0: // CNIC Checks
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 1: CNIC Checks</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Verify CNIC of all owners through NADRA. Check validity, expiry, and identify any red flags.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Check Date"
                    value={formData.cnicChecks.checkDate}
                    onChange={(e) => handleInputChange('cnicChecks.checkDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.cnicChecks.checked}
                        onChange={(e) => handleInputChange('cnicChecks.checked', e.target.checked)}
                      />
                    }
                    label="CNIC Check Completed"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">CNIC Verifications</Typography>
                    <Button startIcon={<AddIcon />} onClick={addCNICVerification} variant="outlined" size="small">
                      Add CNIC Verification
                    </Button>
                  </Box>
                  {formData.cnicChecks.cnicVerifications.map((cnic, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="subtitle2">CNIC Verification #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeCNICVerification(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Owner Name *"
                              value={cnic.ownerName}
                              onChange={(e) => {
                                const newCNICs = [...formData.cnicChecks.cnicVerifications];
                                newCNICs[index].ownerName = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  cnicChecks: { ...prev.cnicChecks, cnicVerifications: newCNICs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="CNIC *"
                              value={cnic.cnic}
                              onChange={(e) => {
                                const newCNICs = [...formData.cnicChecks.cnicVerifications];
                                newCNICs[index].cnic = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  cnicChecks: { ...prev.cnicChecks, cnicVerifications: newCNICs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>CNIC Type</InputLabel>
                              <Select
                                value={cnic.cnicType || 'original'}
                                onChange={(e) => {
                                  const newCNICs = [...formData.cnicChecks.cnicVerifications];
                                  newCNICs[index].cnicType = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    cnicChecks: { ...prev.cnicChecks, cnicVerifications: newCNICs }
                                  }));
                                }}
                              >
                                {cnicTypes.map(t => <MenuItem key={t} value={t}>{t.toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Verification Method</InputLabel>
                              <Select
                                value={cnic.verificationMethod || 'nadra_online'}
                                onChange={(e) => {
                                  const newCNICs = [...formData.cnicChecks.cnicVerifications];
                                  newCNICs[index].verificationMethod = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    cnicChecks: { ...prev.cnicChecks, cnicVerifications: newCNICs }
                                  }));
                                }}
                              >
                                {verificationMethods.map(m => <MenuItem key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Verification Status</InputLabel>
                              <Select
                                value={cnic.verificationStatus || 'pending'}
                                onChange={(e) => {
                                  const newCNICs = [...formData.cnicChecks.cnicVerifications];
                                  newCNICs[index].verificationStatus = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    cnicChecks: { ...prev.cnicChecks, cnicVerifications: newCNICs }
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
                              type="date"
                              label="CNIC Issue Date"
                              value={cnic.cnicIssueDate || ''}
                              onChange={(e) => {
                                const newCNICs = [...formData.cnicChecks.cnicVerifications];
                                newCNICs[index].cnicIssueDate = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  cnicChecks: { ...prev.cnicChecks, cnicVerifications: newCNICs }
                                }));
                              }}
                              InputLabelProps={{ shrink: true }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              type="date"
                              label="CNIC Expiry Date"
                              value={cnic.cnicExpiryDate || ''}
                              onChange={(e) => {
                                const newCNICs = [...formData.cnicChecks.cnicVerifications];
                                newCNICs[index].cnicExpiryDate = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  cnicChecks: { ...prev.cnicChecks, cnicVerifications: newCNICs }
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
                              label="Verification Notes"
                              value={cnic.verificationNotes || ''}
                              onChange={(e) => {
                                const newCNICs = [...formData.cnicChecks.cnicVerifications];
                                newCNICs[index].verificationNotes = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  cnicChecks: { ...prev.cnicChecks, cnicVerifications: newCNICs }
                                }));
                              }}
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                  {formData.cnicChecks.cnicVerifications.length === 0 && (
                    <Alert severity="info">No CNIC verifications added yet. Click "Add CNIC Verification" to add one.</Alert>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Check Notes"
                    value={formData.cnicChecks.checkNotes}
                    onChange={(e) => handleInputChange('cnicChecks.checkNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 1: // NADRA Family Tree
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 2: NADRA Family Tree</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Obtain and verify NADRA family tree. Map all family members and identify legal heirs.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Verification Date"
                    value={formData.nadraFamilyTree.verificationDate}
                    onChange={(e) => handleInputChange('nadraFamilyTree.verificationDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.nadraFamilyTree.verified}
                        onChange={(e) => handleInputChange('nadraFamilyTree.verified', e.target.checked)}
                      />
                    }
                    label="NADRA Family Tree Verified"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Primary Owner</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Name"
                    value={formData.nadraFamilyTree.familyTree.primaryOwner.name}
                    onChange={(e) => handleInputChange('nadraFamilyTree.familyTree.primaryOwner.name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="CNIC"
                    value={formData.nadraFamilyTree.familyTree.primaryOwner.cnic}
                    onChange={(e) => handleInputChange('nadraFamilyTree.familyTree.primaryOwner.cnic', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">Family Members</Typography>
                    <Button startIcon={<AddIcon />} onClick={addFamilyMember} variant="outlined" size="small">
                      Add Family Member
                    </Button>
                  </Box>
                  {formData.nadraFamilyTree.familyTree.familyMembers.map((member, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="subtitle2">Family Member #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeFamilyMember(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Name *"
                              value={member.name}
                              onChange={(e) => {
                                const newMembers = [...formData.nadraFamilyTree.familyTree.familyMembers];
                                newMembers[index].name = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  nadraFamilyTree: {
                                    ...prev.nadraFamilyTree,
                                    familyTree: { ...prev.nadraFamilyTree.familyTree, familyMembers: newMembers }
                                  }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="CNIC"
                              value={member.cnic || ''}
                              onChange={(e) => {
                                const newMembers = [...formData.nadraFamilyTree.familyTree.familyMembers];
                                newMembers[index].cnic = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  nadraFamilyTree: {
                                    ...prev.nadraFamilyTree,
                                    familyTree: { ...prev.nadraFamilyTree.familyTree, familyMembers: newMembers }
                                  }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Relationship *</InputLabel>
                              <Select
                                value={member.relationship}
                                onChange={(e) => {
                                  const newMembers = [...formData.nadraFamilyTree.familyTree.familyMembers];
                                  newMembers[index].relationship = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    nadraFamilyTree: {
                                      ...prev.nadraFamilyTree,
                                      familyTree: { ...prev.nadraFamilyTree.familyTree, familyMembers: newMembers }
                                    }
                                  }));
                                }}
                              >
                                {relationships.map(r => <MenuItem key={r} value={r}>{r.toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={member.isAlive !== false}
                                  onChange={(e) => {
                                    const newMembers = [...formData.nadraFamilyTree.familyTree.familyMembers];
                                    newMembers[index].isAlive = e.target.checked;
                                    setFormData(prev => ({
                                      ...prev,
                                      nadraFamilyTree: {
                                        ...prev.nadraFamilyTree,
                                        familyTree: { ...prev.nadraFamilyTree.familyTree, familyMembers: newMembers }
                                      }
                                    }));
                                  }}
                                />
                              }
                              label="Is Alive"
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={member.isLegalHeir || false}
                                  onChange={(e) => {
                                    const newMembers = [...formData.nadraFamilyTree.familyTree.familyMembers];
                                    newMembers[index].isLegalHeir = e.target.checked;
                                    setFormData(prev => ({
                                      ...prev,
                                      nadraFamilyTree: {
                                        ...prev.nadraFamilyTree,
                                        familyTree: { ...prev.nadraFamilyTree.familyTree, familyMembers: newMembers }
                                      }
                                    }));
                                  }}
                                />
                              }
                              label="Is Legal Heir"
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                  {formData.nadraFamilyTree.familyTree.familyMembers.length === 0 && (
                    <Alert severity="info">No family members added yet. Click "Add Family Member" to add one.</Alert>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="NADRA Report URL"
                    value={formData.nadraFamilyTree.familyTree.nadraReportUrl || ''}
                    onChange={(e) => handleInputChange('nadraFamilyTree.familyTree.nadraReportUrl', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Verification Notes"
                    value={formData.nadraFamilyTree.verificationNotes}
                    onChange={(e) => handleInputChange('nadraFamilyTree.verificationNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 2: // Multiple Heirs
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 3: Multiple Heirs</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Identify all legal heirs, their shares, consent status, and verify their details.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Identification Date"
                    value={formData.multipleHeirs.identificationDate}
                    onChange={(e) => handleInputChange('multipleHeirs.identificationDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.multipleHeirs.identified}
                        onChange={(e) => handleInputChange('multipleHeirs.identified', e.target.checked)}
                      />
                    }
                    label="Heirs Identified"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">Heirs</Typography>
                    <Button startIcon={<AddIcon />} onClick={addHeir} variant="outlined" size="small">
                      Add Heir
                    </Button>
                  </Box>
                  {formData.multipleHeirs.heirs.map((heir, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="subtitle2">Heir #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeHeir(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Heir Number *"
                              value={heir.heirNumber}
                              onChange={(e) => {
                                const newHeirs = [...formData.multipleHeirs.heirs];
                                newHeirs[index].heirNumber = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  multipleHeirs: { ...prev.multipleHeirs, heirs: newHeirs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Name *"
                              value={heir.name}
                              onChange={(e) => {
                                const newHeirs = [...formData.multipleHeirs.heirs];
                                newHeirs[index].name = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  multipleHeirs: { ...prev.multipleHeirs, heirs: newHeirs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="CNIC *"
                              value={heir.cnic}
                              onChange={(e) => {
                                const newHeirs = [...formData.multipleHeirs.heirs];
                                newHeirs[index].cnic = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  multipleHeirs: { ...prev.multipleHeirs, heirs: newHeirs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Relationship *</InputLabel>
                              <Select
                                value={heir.relationship}
                                onChange={(e) => {
                                  const newHeirs = [...formData.multipleHeirs.heirs];
                                  newHeirs[index].relationship = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    multipleHeirs: { ...prev.multipleHeirs, heirs: newHeirs }
                                  }));
                                }}
                              >
                                {heirRelationships.map(r => <MenuItem key={r} value={r}>{r.toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Consent Status</InputLabel>
                              <Select
                                value={heir.consentStatus || 'pending'}
                                onChange={(e) => {
                                  const newHeirs = [...formData.multipleHeirs.heirs];
                                  newHeirs[index].consentStatus = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    multipleHeirs: { ...prev.multipleHeirs, heirs: newHeirs }
                                  }));
                                }}
                              >
                                {consentStatuses.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label="Share Numerator"
                              value={heir.share?.numerator || 1}
                              onChange={(e) => {
                                const newHeirs = [...formData.multipleHeirs.heirs];
                                if (!newHeirs[index].share) newHeirs[index].share = {};
                                newHeirs[index].share.numerator = parseFloat(e.target.value) || 1;
                                setFormData(prev => ({
                                  ...prev,
                                  multipleHeirs: { ...prev.multipleHeirs, heirs: newHeirs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label="Share Denominator"
                              value={heir.share?.denominator || 1}
                              onChange={(e) => {
                                const newHeirs = [...formData.multipleHeirs.heirs];
                                if (!newHeirs[index].share) newHeirs[index].share = {};
                                newHeirs[index].share.denominator = parseFloat(e.target.value) || 1;
                                setFormData(prev => ({
                                  ...prev,
                                  multipleHeirs: { ...prev.multipleHeirs, heirs: newHeirs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label="Share Percentage"
                              value={heir.share?.percentage || 0}
                              onChange={(e) => {
                                const newHeirs = [...formData.multipleHeirs.heirs];
                                if (!newHeirs[index].share) newHeirs[index].share = {};
                                newHeirs[index].share.percentage = parseFloat(e.target.value) || 0;
                                setFormData(prev => ({
                                  ...prev,
                                  multipleHeirs: { ...prev.multipleHeirs, heirs: newHeirs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={heir.isAlive !== false}
                                  onChange={(e) => {
                                    const newHeirs = [...formData.multipleHeirs.heirs];
                                    newHeirs[index].isAlive = e.target.checked;
                                    setFormData(prev => ({
                                      ...prev,
                                      multipleHeirs: { ...prev.multipleHeirs, heirs: newHeirs }
                                    }));
                                  }}
                                />
                              }
                              label="Is Alive"
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={heir.verified || false}
                                  onChange={(e) => {
                                    const newHeirs = [...formData.multipleHeirs.heirs];
                                    newHeirs[index].verified = e.target.checked;
                                    setFormData(prev => ({
                                      ...prev,
                                      multipleHeirs: { ...prev.multipleHeirs, heirs: newHeirs }
                                    }));
                                  }}
                                />
                              }
                              label="Verified"
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                  {formData.multipleHeirs.heirs.length === 0 && (
                    <Alert severity="info">No heirs added yet. Click "Add Heir" to add one.</Alert>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Identification Notes"
                    value={formData.multipleHeirs.identificationNotes}
                    onChange={(e) => handleInputChange('multipleHeirs.identificationNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 3: // Power of Attorney
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 4: Power of Attorney Verification</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Verify all Power of Attorney documents. Check notarization, registration, validity, and identify red flags.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Verification Date"
                    value={formData.powerOfAttorney.verificationDate}
                    onChange={(e) => handleInputChange('powerOfAttorney.verificationDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.powerOfAttorney.verified}
                        onChange={(e) => handleInputChange('powerOfAttorney.verified', e.target.checked)}
                      />
                    }
                    label="POA Verified"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">POA Documents</Typography>
                    <Button startIcon={<AddIcon />} onClick={addPOA} variant="outlined" size="small">
                      Add POA Document
                    </Button>
                  </Box>
                  {formData.powerOfAttorney.poaDocuments.map((poa, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="subtitle2">POA Document #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removePOA(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="POA Number *"
                              value={poa.poaNumber}
                              onChange={(e) => {
                                const newPOAs = [...formData.powerOfAttorney.poaDocuments];
                                newPOAs[index].poaNumber = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  powerOfAttorney: { ...prev.powerOfAttorney, poaDocuments: newPOAs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Principal Name *"
                              value={poa.principalName}
                              onChange={(e) => {
                                const newPOAs = [...formData.powerOfAttorney.poaDocuments];
                                newPOAs[index].principalName = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  powerOfAttorney: { ...prev.powerOfAttorney, poaDocuments: newPOAs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Principal CNIC *"
                              value={poa.principalCNIC}
                              onChange={(e) => {
                                const newPOAs = [...formData.powerOfAttorney.poaDocuments];
                                newPOAs[index].principalCNIC = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  powerOfAttorney: { ...prev.powerOfAttorney, poaDocuments: newPOAs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Attorney Name *"
                              value={poa.attorneyName}
                              onChange={(e) => {
                                const newPOAs = [...formData.powerOfAttorney.poaDocuments];
                                newPOAs[index].attorneyName = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  powerOfAttorney: { ...prev.powerOfAttorney, poaDocuments: newPOAs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Attorney CNIC *"
                              value={poa.attorneyCNIC}
                              onChange={(e) => {
                                const newPOAs = [...formData.powerOfAttorney.poaDocuments];
                                newPOAs[index].attorneyCNIC = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  powerOfAttorney: { ...prev.powerOfAttorney, poaDocuments: newPOAs }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>POA Type</InputLabel>
                              <Select
                                value={poa.poaType || 'general'}
                                onChange={(e) => {
                                  const newPOAs = [...formData.powerOfAttorney.poaDocuments];
                                  newPOAs[index].poaType = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    powerOfAttorney: { ...prev.powerOfAttorney, poaDocuments: newPOAs }
                                  }));
                                }}
                              >
                                {poaTypes.map(t => <MenuItem key={t} value={t}>{t.toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              type="date"
                              label="Execution Date"
                              value={poa.executionDate || ''}
                              onChange={(e) => {
                                const newPOAs = [...formData.powerOfAttorney.poaDocuments];
                                newPOAs[index].executionDate = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  powerOfAttorney: { ...prev.powerOfAttorney, poaDocuments: newPOAs }
                                }));
                              }}
                              InputLabelProps={{ shrink: true }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              type="date"
                              label="Expiry Date"
                              value={poa.expiryDate || ''}
                              onChange={(e) => {
                                const newPOAs = [...formData.powerOfAttorney.poaDocuments];
                                newPOAs[index].expiryDate = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  powerOfAttorney: { ...prev.powerOfAttorney, poaDocuments: newPOAs }
                                }));
                              }}
                              InputLabelProps={{ shrink: true }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={poa.notarized || false}
                                  onChange={(e) => {
                                    const newPOAs = [...formData.powerOfAttorney.poaDocuments];
                                    newPOAs[index].notarized = e.target.checked;
                                    setFormData(prev => ({
                                      ...prev,
                                      powerOfAttorney: { ...prev.powerOfAttorney, poaDocuments: newPOAs }
                                    }));
                                  }}
                                />
                              }
                              label="Notarized"
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Verification Status</InputLabel>
                              <Select
                                value={poa.verificationStatus || 'pending'}
                                onChange={(e) => {
                                  const newPOAs = [...formData.powerOfAttorney.poaDocuments];
                                  newPOAs[index].verificationStatus = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    powerOfAttorney: { ...prev.powerOfAttorney, poaDocuments: newPOAs }
                                  }));
                                }}
                              >
                                <MenuItem value="verified">Verified</MenuItem>
                                <MenuItem value="pending">Pending</MenuItem>
                                <MenuItem value="rejected">Rejected</MenuItem>
                                <MenuItem value="expired">Expired</MenuItem>
                                <MenuItem value="suspicious">Suspicious</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              rows={2}
                              label="Verification Notes"
                              value={poa.verificationNotes || ''}
                              onChange={(e) => {
                                const newPOAs = [...formData.powerOfAttorney.poaDocuments];
                                newPOAs[index].verificationNotes = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  powerOfAttorney: { ...prev.powerOfAttorney, poaDocuments: newPOAs }
                                }));
                              }}
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                  {formData.powerOfAttorney.poaDocuments.length === 0 && (
                    <Alert severity="info">No POA documents added yet. Click "Add POA Document" to add one.</Alert>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Verification Notes"
                    value={formData.powerOfAttorney.verificationNotes}
                    onChange={(e) => handleInputChange('powerOfAttorney.verificationNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 4: // Dispute History
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 5: Dispute History</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Check for any disputes related to the land or owners. Record court cases, legal disputes, and their resolution status.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Check Date"
                    value={formData.disputeHistory.checkDate}
                    onChange={(e) => handleInputChange('disputeHistory.checkDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.disputeHistory.checked}
                        onChange={(e) => handleInputChange('disputeHistory.checked', e.target.checked)}
                      />
                    }
                    label="Dispute Check Completed"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">Disputes</Typography>
                    <Button startIcon={<AddIcon />} onClick={addDispute} variant="outlined" size="small">
                      Add Dispute
                    </Button>
                  </Box>
                  {formData.disputeHistory.disputes.map((dispute, index) => (
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
                            <TextField
                              fullWidth
                              size="small"
                              label="Dispute Number *"
                              value={dispute.disputeNumber}
                              onChange={(e) => {
                                const newDisputes = [...formData.disputeHistory.disputes];
                                newDisputes[index].disputeNumber = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  disputeHistory: { ...prev.disputeHistory, disputes: newDisputes }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Dispute Type *</InputLabel>
                              <Select
                                value={dispute.disputeType}
                                onChange={(e) => {
                                  const newDisputes = [...formData.disputeHistory.disputes];
                                  newDisputes[index].disputeType = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    disputeHistory: { ...prev.disputeHistory, disputes: newDisputes }
                                  }));
                                }}
                              >
                                {disputeTypes.map(t => <MenuItem key={t} value={t}>{t.toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Case Status</InputLabel>
                              <Select
                                value={dispute.caseStatus || 'pending'}
                                onChange={(e) => {
                                  const newDisputes = [...formData.disputeHistory.disputes];
                                  newDisputes[index].caseStatus = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    disputeHistory: { ...prev.disputeHistory, disputes: newDisputes }
                                  }));
                                }}
                              >
                                {caseStatuses.map(s => <MenuItem key={s} value={s}>{s.toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Court Name"
                              value={dispute.courtName || ''}
                              onChange={(e) => {
                                const newDisputes = [...formData.disputeHistory.disputes];
                                newDisputes[index].courtName = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  disputeHistory: { ...prev.disputeHistory, disputes: newDisputes }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Case Number"
                              value={dispute.caseNumber || ''}
                              onChange={(e) => {
                                const newDisputes = [...formData.disputeHistory.disputes];
                                newDisputes[index].caseNumber = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  disputeHistory: { ...prev.disputeHistory, disputes: newDisputes }
                                }));
                              }}
                            />
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
                                const newDisputes = [...formData.disputeHistory.disputes];
                                newDisputes[index].disputeDescription = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  disputeHistory: { ...prev.disputeHistory, disputes: newDisputes }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Impact</InputLabel>
                              <Select
                                value={dispute.impact || 'medium'}
                                onChange={(e) => {
                                  const newDisputes = [...formData.disputeHistory.disputes];
                                  newDisputes[index].impact = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    disputeHistory: { ...prev.disputeHistory, disputes: newDisputes }
                                  }));
                                }}
                              >
                                {impacts.map(i => <MenuItem key={i} value={i}>{i.toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              type="date"
                              label="Dispute Date"
                              value={dispute.disputeDate || ''}
                              onChange={(e) => {
                                const newDisputes = [...formData.disputeHistory.disputes];
                                newDisputes[index].disputeDate = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  disputeHistory: { ...prev.disputeHistory, disputes: newDisputes }
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
                              label="Resolution Details"
                              value={dispute.resolutionDetails || ''}
                              onChange={(e) => {
                                const newDisputes = [...formData.disputeHistory.disputes];
                                newDisputes[index].resolutionDetails = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  disputeHistory: { ...prev.disputeHistory, disputes: newDisputes }
                                }));
                              }}
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                  {formData.disputeHistory.disputes.length === 0 && (
                    <Alert severity="info">No disputes found yet. Click "Add Dispute" to add one.</Alert>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Check Notes"
                    value={formData.disputeHistory.checkNotes}
                    onChange={(e) => handleInputChange('disputeHistory.checkNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 5: // Death Cases
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 6: Death Cases / Widow Inheritance</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Verify death cases, widow inheritance rights, legal heirs, and mutation status.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Verification Date"
                    value={formData.deathCases.verificationDate}
                    onChange={(e) => handleInputChange('deathCases.verificationDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.deathCases.verified}
                        onChange={(e) => handleInputChange('deathCases.verified', e.target.checked)}
                      />
                    }
                    label="Death Cases Verified"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">Death Cases</Typography>
                    <Button startIcon={<AddIcon />} onClick={addDeathCase} variant="outlined" size="small">
                      Add Death Case
                    </Button>
                  </Box>
                  {formData.deathCases.deathCases.map((deathCase, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="subtitle2">Death Case #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeDeathCase(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Case Number *"
                              value={deathCase.caseNumber}
                              onChange={(e) => {
                                const newCases = [...formData.deathCases.deathCases];
                                newCases[index].caseNumber = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  deathCases: { ...prev.deathCases, deathCases: newCases }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Deceased Name *"
                              value={deathCase.deceasedName}
                              onChange={(e) => {
                                const newCases = [...formData.deathCases.deathCases];
                                newCases[index].deceasedName = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  deathCases: { ...prev.deathCases, deathCases: newCases }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Deceased CNIC *"
                              value={deathCase.deceasedCNIC}
                              onChange={(e) => {
                                const newCases = [...formData.deathCases.deathCases];
                                newCases[index].deceasedCNIC = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  deathCases: { ...prev.deathCases, deathCases: newCases }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              type="date"
                              label="Date of Death *"
                              value={deathCase.dateOfDeath || ''}
                              onChange={(e) => {
                                const newCases = [...formData.deathCases.deathCases];
                                newCases[index].dateOfDeath = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  deathCases: { ...prev.deathCases, deathCases: newCases }
                                }));
                              }}
                              InputLabelProps={{ shrink: true }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Death Certificate Number"
                              value={deathCase.deathCertificateNumber || ''}
                              onChange={(e) => {
                                const newCases = [...formData.deathCases.deathCases];
                                newCases[index].deathCertificateNumber = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  deathCases: { ...prev.deathCases, deathCases: newCases }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle2" gutterBottom>Surviving Spouse</Typography>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Spouse Name"
                              value={deathCase.survivingSpouse?.name || ''}
                              onChange={(e) => {
                                const newCases = [...formData.deathCases.deathCases];
                                if (!newCases[index].survivingSpouse) newCases[index].survivingSpouse = {};
                                newCases[index].survivingSpouse.name = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  deathCases: { ...prev.deathCases, deathCases: newCases }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Spouse CNIC"
                              value={deathCase.survivingSpouse?.cnic || ''}
                              onChange={(e) => {
                                const newCases = [...formData.deathCases.deathCases];
                                if (!newCases[index].survivingSpouse) newCases[index].survivingSpouse = {};
                                newCases[index].survivingSpouse.cnic = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  deathCases: { ...prev.deathCases, deathCases: newCases }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Inheritance Rights</InputLabel>
                              <Select
                                value={deathCase.survivingSpouse?.inheritanceRights || 'partial'}
                                onChange={(e) => {
                                  const newCases = [...formData.deathCases.deathCases];
                                  if (!newCases[index].survivingSpouse) newCases[index].survivingSpouse = {};
                                  newCases[index].survivingSpouse.inheritanceRights = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    deathCases: { ...prev.deathCases, deathCases: newCases }
                                  }));
                                }}
                              >
                                {inheritanceRights.map(r => <MenuItem key={r} value={r}>{r.toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Mutation Status</InputLabel>
                              <Select
                                value={deathCase.mutationStatus || 'not_applied'}
                                onChange={(e) => {
                                  const newCases = [...formData.deathCases.deathCases];
                                  newCases[index].mutationStatus = e.target.value;
                                  setFormData(prev => ({
                                    ...prev,
                                    deathCases: { ...prev.deathCases, deathCases: newCases }
                                  }));
                                }}
                              >
                                {mutationStatuses.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Mutation Number"
                              value={deathCase.mutationNumber || ''}
                              onChange={(e) => {
                                const newCases = [...formData.deathCases.deathCases];
                                newCases[index].mutationNumber = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  deathCases: { ...prev.deathCases, deathCases: newCases }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={deathCase.verified || false}
                                  onChange={(e) => {
                                    const newCases = [...formData.deathCases.deathCases];
                                    newCases[index].verified = e.target.checked;
                                    setFormData(prev => ({
                                      ...prev,
                                      deathCases: { ...prev.deathCases, deathCases: newCases }
                                    }));
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
                              value={deathCase.notes || ''}
                              onChange={(e) => {
                                const newCases = [...formData.deathCases.deathCases];
                                newCases[index].notes = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  deathCases: { ...prev.deathCases, deathCases: newCases }
                                }));
                              }}
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                  {formData.deathCases.deathCases.length === 0 && (
                    <Alert severity="info">No death cases added yet. Click "Add Death Case" to add one.</Alert>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Verification Notes"
                    value={formData.deathCases.verificationNotes}
                    onChange={(e) => handleInputChange('deathCases.verificationNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 6: // Owner Interview
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 7: Owner Interview Checklist</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Conduct comprehensive interview with owner(s). Verify all information, check disclosures, and document responses.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Interview Date"
                    value={formData.ownerInterview.interviewDate}
                    onChange={(e) => handleInputChange('ownerInterview.interviewDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="time"
                    label="Interview Time"
                    value={formData.ownerInterview.interviewTime}
                    onChange={(e) => handleInputChange('ownerInterview.interviewTime', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Interview Location"
                    value={formData.ownerInterview.interviewLocation}
                    onChange={(e) => handleInputChange('ownerInterview.interviewLocation', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Interview Checklist</Typography>
                </Grid>
                {Object.entries(formData.ownerInterview.checklist).map(([key, item]) => (
                  <React.Fragment key={key}>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={item.checked}
                            onChange={(e) => {
                              const newChecklist = { ...formData.ownerInterview.checklist };
                              newChecklist[key].checked = e.target.checked;
                              setFormData(prev => ({
                                ...prev,
                                ownerInterview: { ...prev.ownerInterview, checklist: newChecklist }
                              }));
                            }}
                          />
                        }
                        label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      />
                    </Grid>
                    {item.checked && (
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={2}
                          label="Notes"
                          value={item.notes || ''}
                          onChange={(e) => {
                            const newChecklist = { ...formData.ownerInterview.checklist };
                            newChecklist[key].notes = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              ownerInterview: { ...prev.ownerInterview, checklist: newChecklist }
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
                    rows={4}
                    label="Observations"
                    value={formData.ownerInterview.observations}
                    onChange={(e) => handleInputChange('ownerInterview.observations', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Interview Notes"
                    value={formData.ownerInterview.interviewNotes}
                    onChange={(e) => handleInputChange('ownerInterview.interviewNotes', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.ownerInterview.conducted}
                        onChange={(e) => handleInputChange('ownerInterview.conducted', e.target.checked)}
                      />
                    }
                    label="Interview Conducted"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 7: // Completion
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Risk Assessment</Typography>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Overall Risk</InputLabel>
                        <Select
                          value={formData.riskAssessment.overallRisk}
                          onChange={(e) => handleInputChange('riskAssessment.overallRisk', e.target.value)}
                        >
                          <MenuItem value="low">Low</MenuItem>
                          <MenuItem value="medium">Medium</MenuItem>
                          <MenuItem value="high">High</MenuItem>
                          <MenuItem value="critical">Critical</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Recommendations"
                        value={formData.riskAssessment.recommendations}
                        onChange={(e) => handleInputChange('riskAssessment.recommendations', e.target.value)}
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
        Owner Due Diligence {id ? '(Edit)' : '(New)'}
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

export default OwnerDueDiligence;
