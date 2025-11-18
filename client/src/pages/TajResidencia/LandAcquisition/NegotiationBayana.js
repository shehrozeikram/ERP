import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Stepper, Step, StepLabel, Button, Grid, TextField,
  FormControl, InputLabel, Select, MenuItem, Card, CardContent, Divider,
  Alert, Snackbar, IconButton, CircularProgress, Checkbox, FormControlLabel,
  Autocomplete, Tabs, Tab
} from '@mui/material';
import {
  Save as SaveIcon, ArrowBack as ArrowBackIcon, ArrowForward as ArrowForwardIcon,
  Add as AddIcon, Delete as DeleteIcon, AttachMoney as MoneyIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../../services/api';

const workflowSteps = [
  'Market Rate Study',
  'Offer Sheet',
  'Token',
  'Bayana',
  'Payment Terms',
  'Completion'
];

const areaUnits = ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'];
const marketTrends = ['rising', 'stable', 'declining', 'volatile'];
const offerStatuses = ['draft', 'sent', 'under_review', 'accepted', 'rejected', 'counter_offered', 'expired'];
const paymentModes = ['cash', 'cheque', 'bank_transfer', 'online', 'other'];
const riskTypes = ['price_dispute', 'terms_dispute', 'possession_dispute', 'document_dispute', 'payment_dispute', 'other'];
const riskSeverities = ['low', 'medium', 'high', 'critical'];
const riskProbabilities = ['low', 'medium', 'high'];
const riskStatuses = ['open', 'mitigated', 'resolved', 'escalated'];
const commissionTypes = ['percentage', 'fixed', 'negotiated', 'none'];
const commissionBases = ['total_price', 'bayana_amount', 'per_kanal', 'per_marla', 'other'];
const scheduleTypes = ['lump_sum', 'installments', 'milestone_based', 'custom'];
const frequencies = ['monthly', 'quarterly', 'semi_annually', 'annually', 'custom'];
const formTypes = ['market_study_report', 'offer_sheet', 'token_receipt', 'bayana_agreement', 'commission_agreement', 'payment_receipt', 'other'];

const NegotiationBayana = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [landIdentifications, setLandIdentifications] = useState([]);
  const [ownerDueDiligences, setOwnerDueDiligences] = useState([]);
  
  const [formData, setFormData] = useState({
    negotiationNumber: '',
    landIdentification: '',
    ownerDueDiligence: '',
    status: 'draft',
    currentStep: 'market_rate_study',
    priority: 'medium',
    
    marketRateStudy: {
      studyDate: new Date().toISOString().split('T')[0],
      marketAnalysis: {
        location: { area: '', city: '', district: '', proximityToMainRoad: '', nearbyDevelopments: '', infrastructure: '' },
        comparableProperties: [],
        marketTrends: { currentTrend: 'stable', trendAnalysis: '', futureProjection: '' },
        priceRange: { minimum: 0, maximum: 0, average: 0, recommended: 0 },
        factors: []
      },
      studyReport: { reportDate: '', reportUrl: '', summary: '', recommendations: '', approved: false },
      studyNotes: ''
    },
    
    offerSheet: {
      offerDate: new Date().toISOString().split('T')[0],
      offerNumber: '',
      offerDetails: {
        offeredPrice: { value: 0, currency: 'PKR', pricePerKanal: 0, pricePerMarla: 0 },
        paymentTerms: { downPayment: { value: 0, percentage: 0 }, installments: [], totalInstallments: 0, paymentSchedule: '' },
        conditions: [],
        validityPeriod: { startDate: '', endDate: '', days: 0 },
        specialTerms: ''
      },
      offerStatus: 'draft',
      sentDate: '',
      responseDate: '',
      responseNotes: '',
      counterOffer: { received: false, counterPrice: { value: 0, currency: 'PKR' }, counterTerms: '', counterDate: '', response: 'under_negotiation' },
      offerNotes: ''
    },
    
    token: {
      tokenReceived: false,
      tokenDate: new Date().toISOString().split('T')[0],
      tokenAmount: { value: 0, currency: 'PKR' },
      tokenMode: 'cash',
      tokenReceiptNumber: '',
      tokenReceiptUrl: '',
      tokenNotes: '',
      tokenRefundable: true,
      tokenRefundConditions: ''
    },
    
    bayana: {
      bayanaExecuted: false,
      bayanaDate: new Date().toISOString().split('T')[0],
      bayanaNumber: '',
      bayanaAmount: { value: 0, currency: 'PKR' },
      bayanaMode: 'cash',
      parties: {
        seller: { name: '', cnic: '', contactNumber: '', address: '', signature: '', signatureDate: '' },
        buyer: { name: '', cnic: '', contactNumber: '', address: '', signature: '', signatureDate: '' },
        witnesses: []
      },
      bayanaTerms: {
        totalPrice: { value: 0, currency: 'PKR' },
        bayanaPercentage: 0,
        remainingAmount: { value: 0, currency: 'PKR' },
        possessionDate: '',
        registryDate: '',
        conditions: [],
        cancellationTerms: { sellerCancellation: '', buyerCancellation: '', penaltyClause: '' }
      },
      bayanaDocuments: [],
      bayanaNotes: ''
    },
    
    verbalSettlementRisks: {
      identified: false,
      identifiedDate: new Date().toISOString().split('T')[0],
      risks: [],
      riskMitigation: { writtenAgreement: false, witnessPresent: false, documentation: false, legalReview: false, otherMeasures: '' },
      riskNotes: ''
    },
    
    landAgentCommission: {
      agentInvolved: false,
      agentDetails: { name: '', cnic: '', contactNumber: '', licenseNumber: '', agencyName: '', address: '' },
      commission: {
        commissionType: 'percentage',
        commissionRate: 0,
        commissionAmount: { value: 0, currency: 'PKR' },
        commissionBasis: 'total_price',
        paymentTerms: { paymentSchedule: '', installments: [] },
        commissionAgreement: { agreementDate: '', agreementUrl: '', terms: '' }
      },
      commissionNotes: ''
    },
    
    paymentTermsStructure: {
      totalPrice: { value: 0, currency: 'PKR' },
      paymentBreakdown: {
        token: { amount: 0, percentage: 0, paid: false, paidDate: '' },
        bayana: { amount: 0, percentage: 0, paid: false, paidDate: '' },
        installments: [],
        finalPayment: { amount: 0, percentage: 0, dueDate: '', paid: false, paidDate: '' }
      },
      paymentSchedule: {
        scheduleType: 'installments',
        totalInstallments: 0,
        installmentFrequency: 'monthly',
        firstInstallmentDate: '',
        lastInstallmentDate: '',
        gracePeriod: 0,
        latePaymentPenalty: { percentage: 0, fixedAmount: 0, description: '' }
      },
      paymentTracking: {
        totalPaid: { value: 0, currency: 'PKR' },
        totalPending: { value: 0, currency: 'PKR' },
        paymentPercentage: 0,
        nextDueDate: '',
        nextDueAmount: 0,
        overduePayments: []
      },
      paymentNotes: ''
    },
    
    formsChecklist: [],
    description: '',
    notes: ''
  });

  useEffect(() => {
    fetchLandIdentifications();
    fetchOwnerDueDiligences();
    if (id) {
      fetchNegotiationBayana();
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

  const fetchOwnerDueDiligences = async () => {
    try {
      const response = await api.get('/taj-residencia/owner-due-diligence', { params: { limit: 1000 } });
      if (response.data.success) {
        setOwnerDueDiligences(response.data.data.docs || []);
      }
    } catch (error) {
      console.error('Error fetching owner due diligences:', error);
    }
  };

  const fetchNegotiationBayana = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/taj-residencia/negotiation-bayana/${id}`);
      if (response.data.success) {
        const data = response.data.data;
        setFormData({
          ...data,
          marketRateStudy: {
            ...data.marketRateStudy,
            studyDate: data.marketRateStudy?.studyDate ? new Date(data.marketRateStudy.studyDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          offerSheet: {
            ...data.offerSheet,
            offerDate: data.offerSheet?.offerDate ? new Date(data.offerSheet.offerDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            sentDate: data.offerSheet?.sentDate ? new Date(data.offerSheet.sentDate).toISOString().split('T')[0] : '',
            responseDate: data.offerSheet?.responseDate ? new Date(data.offerSheet.responseDate).toISOString().split('T')[0] : ''
          },
          token: {
            ...data.token,
            tokenDate: data.token?.tokenDate ? new Date(data.token.tokenDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          bayana: {
            ...data.bayana,
            bayanaDate: data.bayana?.bayanaDate ? new Date(data.bayana.bayanaDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          },
          verbalSettlementRisks: {
            ...data.verbalSettlementRisks,
            identifiedDate: data.verbalSettlementRisks?.identifiedDate ? new Date(data.verbalSettlementRisks.identifiedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
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
      console.error('Error fetching negotiation & bayana:', error);
      showSnackbar('Error fetching negotiation & bayana data', 'error');
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
      const stepNames = ['market_rate_study', 'offer_sheet', 'token', 'bayana', 'payment_terms', 'completion'];
      const dataToSave = {
        ...formData,
        currentStep: stepNames[activeStep],
        status: activeStep === workflowSteps.length - 1 ? 'negotiation_completed' : formData.status
      };

      let response;
      if (id) {
        response = await api.put(`/taj-residencia/negotiation-bayana/${id}`, dataToSave);
      } else {
        response = await api.post('/taj-residencia/negotiation-bayana', dataToSave);
        if (response.data.success) {
          navigate(`/taj-residencia/land-acquisition/negotiation-bayana/${response.data.data._id}`);
        }
      }

      if (response.data.success) {
        showSnackbar('Negotiation & Bayana saved successfully', 'success');
      }
    } catch (error) {
      console.error('Error saving negotiation & bayana:', error);
      showSnackbar('Error saving negotiation & bayana', 'error');
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

  const addComparableProperty = () => {
    setFormData(prev => ({
      ...prev,
      marketRateStudy: {
        ...prev.marketRateStudy,
        marketAnalysis: {
          ...prev.marketRateStudy.marketAnalysis,
          comparableProperties: [...prev.marketRateStudy.marketAnalysis.comparableProperties, {
            propertyLocation: '',
            propertyType: '',
            area: { value: 0, unit: 'kanal' },
            salePrice: 0,
            pricePerUnit: 0,
            saleDate: '',
            notes: ''
          }]
        }
      }
    }));
  };

  const removeComparableProperty = (index) => {
    setFormData(prev => ({
      ...prev,
      marketRateStudy: {
        ...prev.marketRateStudy,
        marketAnalysis: {
          ...prev.marketRateStudy.marketAnalysis,
          comparableProperties: prev.marketRateStudy.marketAnalysis.comparableProperties.filter((_, i) => i !== index)
        }
      }
    }));
  };

  const addInstallment = (section) => {
    if (section === 'offer') {
      setFormData(prev => ({
        ...prev,
        offerSheet: {
          ...prev.offerSheet,
          offerDetails: {
            ...prev.offerSheet.offerDetails,
            paymentTerms: {
              ...prev.offerSheet.offerDetails.paymentTerms,
              installments: [...prev.offerSheet.offerDetails.paymentTerms.installments, {
                installmentNumber: prev.offerSheet.offerDetails.paymentTerms.installments.length + 1,
                amount: 0,
                dueDate: '',
                description: ''
              }]
            }
          }
        }
      }));
    } else if (section === 'payment') {
      setFormData(prev => ({
        ...prev,
        paymentTermsStructure: {
          ...prev.paymentTermsStructure,
          paymentBreakdown: {
            ...prev.paymentTermsStructure.paymentBreakdown,
            installments: [...prev.paymentTermsStructure.paymentBreakdown.installments, {
              installmentNumber: prev.paymentTermsStructure.paymentBreakdown.installments.length + 1,
              amount: 0,
              percentage: 0,
              dueDate: '',
              paid: false,
              paidDate: '',
              paymentMode: 'bank_transfer',
              receiptNumber: '',
              receiptUrl: '',
              notes: ''
            }]
          }
        }
      }));
    }
  };

  const removeInstallment = (section, index) => {
    if (section === 'offer') {
      setFormData(prev => ({
        ...prev,
        offerSheet: {
          ...prev.offerSheet,
          offerDetails: {
            ...prev.offerSheet.offerDetails,
            paymentTerms: {
              ...prev.offerSheet.offerDetails.paymentTerms,
              installments: prev.offerSheet.offerDetails.paymentTerms.installments.filter((_, i) => i !== index)
            }
          }
        }
      }));
    } else if (section === 'payment') {
      setFormData(prev => ({
        ...prev,
        paymentTermsStructure: {
          ...prev.paymentTermsStructure,
          paymentBreakdown: {
            ...prev.paymentTermsStructure.paymentBreakdown,
            installments: prev.paymentTermsStructure.paymentBreakdown.installments.filter((_, i) => i !== index)
          }
        }
      }));
    }
  };

  const addRisk = () => {
    setFormData(prev => ({
      ...prev,
      verbalSettlementRisks: {
        ...prev.verbalSettlementRisks,
        risks: [...prev.verbalSettlementRisks.risks, {
          riskNumber: '',
          riskType: 'price_dispute',
          riskDescription: '',
          severity: 'medium',
          probability: 'medium',
          mitigation: '',
          status: 'open',
          notes: ''
        }]
      }
    }));
  };

  const removeRisk = (index) => {
    setFormData(prev => ({
      ...prev,
      verbalSettlementRisks: {
        ...prev.verbalSettlementRisks,
        risks: prev.verbalSettlementRisks.risks.filter((_, i) => i !== index)
      }
    }));
  };

  const addWitness = () => {
    setFormData(prev => ({
      ...prev,
      bayana: {
        ...prev.bayana,
        parties: {
          ...prev.bayana.parties,
          witnesses: [...prev.bayana.parties.witnesses, {
            name: '',
            cnic: '',
            contactNumber: '',
            relationship: '',
            signature: '',
            signatureDate: ''
          }]
        }
      }
    }));
  };

  const removeWitness = (index) => {
    setFormData(prev => ({
      ...prev,
      bayana: {
        ...prev.bayana,
        parties: {
          ...prev.bayana.parties,
          witnesses: prev.bayana.parties.witnesses.filter((_, i) => i !== index)
        }
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
      case 0: // Market Rate Study
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 1: Market Rate Study</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Conduct market rate study. Analyze comparable properties, market trends, and determine recommended price range.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Study Date"
                    value={formData.marketRateStudy.studyDate}
                    onChange={(e) => handleInputChange('marketRateStudy.studyDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Location Analysis</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Area"
                    value={formData.marketRateStudy.marketAnalysis.location.area}
                    onChange={(e) => handleInputChange('marketRateStudy.marketAnalysis.location.area', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="City"
                    value={formData.marketRateStudy.marketAnalysis.location.city}
                    onChange={(e) => handleInputChange('marketRateStudy.marketAnalysis.location.city', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="District"
                    value={formData.marketRateStudy.marketAnalysis.location.district}
                    onChange={(e) => handleInputChange('marketRateStudy.marketAnalysis.location.district', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Proximity to Main Road"
                    value={formData.marketRateStudy.marketAnalysis.location.proximityToMainRoad}
                    onChange={(e) => handleInputChange('marketRateStudy.marketAnalysis.location.proximityToMainRoad', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Nearby Developments"
                    value={formData.marketRateStudy.marketAnalysis.location.nearbyDevelopments}
                    onChange={(e) => handleInputChange('marketRateStudy.marketAnalysis.location.nearbyDevelopments', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Infrastructure"
                    value={formData.marketRateStudy.marketAnalysis.location.infrastructure}
                    onChange={(e) => handleInputChange('marketRateStudy.marketAnalysis.location.infrastructure', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">Comparable Properties</Typography>
                    <Button startIcon={<AddIcon />} onClick={addComparableProperty} variant="outlined" size="small">
                      Add Property
                    </Button>
                  </Box>
                  {formData.marketRateStudy.marketAnalysis.comparableProperties.map((prop, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="subtitle2">Property #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeComparableProperty(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Property Location"
                              value={prop.propertyLocation}
                              onChange={(e) => {
                                const newProps = [...formData.marketRateStudy.marketAnalysis.comparableProperties];
                                newProps[index].propertyLocation = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  marketRateStudy: {
                                    ...prev.marketRateStudy,
                                    marketAnalysis: { ...prev.marketRateStudy.marketAnalysis, comparableProperties: newProps }
                                  }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label="Sale Price"
                              value={prop.salePrice || 0}
                              onChange={(e) => {
                                const newProps = [...formData.marketRateStudy.marketAnalysis.comparableProperties];
                                newProps[index].salePrice = parseFloat(e.target.value) || 0;
                                setFormData(prev => ({
                                  ...prev,
                                  marketRateStudy: {
                                    ...prev.marketRateStudy,
                                    marketAnalysis: { ...prev.marketRateStudy.marketAnalysis, comparableProperties: newProps }
                                  }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <TextField
                              fullWidth
                              size="small"
                              type="date"
                              label="Sale Date"
                              value={prop.saleDate || ''}
                              onChange={(e) => {
                                const newProps = [...formData.marketRateStudy.marketAnalysis.comparableProperties];
                                newProps[index].saleDate = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  marketRateStudy: {
                                    ...prev.marketRateStudy,
                                    marketAnalysis: { ...prev.marketRateStudy.marketAnalysis, comparableProperties: newProps }
                                  }
                                }));
                              }}
                              InputLabelProps={{ shrink: true }}
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Price Range</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Minimum Price"
                    value={formData.marketRateStudy.marketAnalysis.priceRange.minimum}
                    onChange={(e) => handleInputChange('marketRateStudy.marketAnalysis.priceRange.minimum', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Maximum Price"
                    value={formData.marketRateStudy.marketAnalysis.priceRange.maximum}
                    onChange={(e) => handleInputChange('marketRateStudy.marketAnalysis.priceRange.maximum', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Average Price"
                    value={formData.marketRateStudy.marketAnalysis.priceRange.average}
                    onChange={(e) => handleInputChange('marketRateStudy.marketAnalysis.priceRange.average', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Recommended Price"
                    value={formData.marketRateStudy.marketAnalysis.priceRange.recommended}
                    onChange={(e) => handleInputChange('marketRateStudy.marketAnalysis.priceRange.recommended', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Market Trend</InputLabel>
                    <Select
                      value={formData.marketRateStudy.marketAnalysis.marketTrends.currentTrend}
                      onChange={(e) => handleInputChange('marketRateStudy.marketAnalysis.marketTrends.currentTrend', e.target.value)}
                    >
                      {marketTrends.map(t => <MenuItem key={t} value={t}>{t.toUpperCase()}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Trend Analysis"
                    value={formData.marketRateStudy.marketAnalysis.marketTrends.trendAnalysis}
                    onChange={(e) => handleInputChange('marketRateStudy.marketAnalysis.marketTrends.trendAnalysis', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Study Notes"
                    value={formData.marketRateStudy.studyNotes}
                    onChange={(e) => handleInputChange('marketRateStudy.studyNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 1: // Offer Sheet
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 2: Offer Sheet</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Prepare and send offer sheet with price, payment terms, and conditions. Track offer status and counter offers.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Offer Date"
                    value={formData.offerSheet.offerDate}
                    onChange={(e) => handleInputChange('offerSheet.offerDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Offer Number"
                    value={formData.offerSheet.offerNumber}
                    onChange={(e) => handleInputChange('offerSheet.offerNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Offer Details</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Offered Price *"
                    value={formData.offerSheet.offerDetails.offeredPrice.value}
                    onChange={(e) => handleInputChange('offerSheet.offerDetails.offeredPrice.value', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Price per Kanal"
                    value={formData.offerSheet.offerDetails.offeredPrice.pricePerKanal || 0}
                    onChange={(e) => handleInputChange('offerSheet.offerDetails.offeredPrice.pricePerKanal', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Price per Marla"
                    value={formData.offerSheet.offerDetails.offeredPrice.pricePerMarla || 0}
                    onChange={(e) => handleInputChange('offerSheet.offerDetails.offeredPrice.pricePerMarla', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Down Payment Amount"
                    value={formData.offerSheet.offerDetails.paymentTerms.downPayment.value}
                    onChange={(e) => handleInputChange('offerSheet.offerDetails.paymentTerms.downPayment.value', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Down Payment Percentage"
                    value={formData.offerSheet.offerDetails.paymentTerms.downPayment.percentage}
                    onChange={(e) => handleInputChange('offerSheet.offerDetails.paymentTerms.downPayment.percentage', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">Payment Installments</Typography>
                    <Button startIcon={<AddIcon />} onClick={() => addInstallment('offer')} variant="outlined" size="small">
                      Add Installment
                    </Button>
                  </Box>
                  {formData.offerSheet.offerDetails.paymentTerms.installments.map((inst, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" fontWeight="bold">Installment #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeInstallment('offer', index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label="Amount"
                              value={inst.amount || 0}
                              onChange={(e) => {
                                const newInsts = [...formData.offerSheet.offerDetails.paymentTerms.installments];
                                newInsts[index].amount = parseFloat(e.target.value) || 0;
                                setFormData(prev => ({
                                  ...prev,
                                  offerSheet: {
                                    ...prev.offerSheet,
                                    offerDetails: {
                                      ...prev.offerSheet.offerDetails,
                                      paymentTerms: { ...prev.offerSheet.offerDetails.paymentTerms, installments: newInsts }
                                    }
                                  }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              type="date"
                              label="Due Date"
                              value={inst.dueDate || ''}
                              onChange={(e) => {
                                const newInsts = [...formData.offerSheet.offerDetails.paymentTerms.installments];
                                newInsts[index].dueDate = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  offerSheet: {
                                    ...prev.offerSheet,
                                    offerDetails: {
                                      ...prev.offerSheet.offerDetails,
                                      paymentTerms: { ...prev.offerSheet.offerDetails.paymentTerms, installments: newInsts }
                                    }
                                  }
                                }));
                              }}
                              InputLabelProps={{ shrink: true }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Description"
                              value={inst.description || ''}
                              onChange={(e) => {
                                const newInsts = [...formData.offerSheet.offerDetails.paymentTerms.installments];
                                newInsts[index].description = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  offerSheet: {
                                    ...prev.offerSheet,
                                    offerDetails: {
                                      ...prev.offerSheet.offerDetails,
                                      paymentTerms: { ...prev.offerSheet.offerDetails.paymentTerms, installments: newInsts }
                                    }
                                  }
                                }));
                              }}
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Validity Start Date"
                    value={formData.offerSheet.offerDetails.validityPeriod.startDate || ''}
                    onChange={(e) => handleInputChange('offerSheet.offerDetails.validityPeriod.startDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Validity End Date"
                    value={formData.offerSheet.offerDetails.validityPeriod.endDate || ''}
                    onChange={(e) => handleInputChange('offerSheet.offerDetails.validityPeriod.endDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Offer Status</InputLabel>
                    <Select
                      value={formData.offerSheet.offerStatus}
                      onChange={(e) => handleInputChange('offerSheet.offerStatus', e.target.value)}
                    >
                      {offerStatuses.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Special Terms"
                    value={formData.offerSheet.offerDetails.specialTerms}
                    onChange={(e) => handleInputChange('offerSheet.offerDetails.specialTerms', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Counter Offer</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.offerSheet.counterOffer.received}
                        onChange={(e) => handleInputChange('offerSheet.counterOffer.received', e.target.checked)}
                      />
                    }
                    label="Counter Offer Received"
                  />
                </Grid>
                {formData.offerSheet.counterOffer.received && (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Counter Price"
                        value={formData.offerSheet.counterOffer.counterPrice.value}
                        onChange={(e) => handleInputChange('offerSheet.counterOffer.counterPrice.value', parseFloat(e.target.value) || 0)}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="date"
                        label="Counter Offer Date"
                        value={formData.offerSheet.counterOffer.counterDate || ''}
                        onChange={(e) => handleInputChange('offerSheet.counterOffer.counterDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label="Counter Terms"
                        value={formData.offerSheet.counterOffer.counterTerms}
                        onChange={(e) => handleInputChange('offerSheet.counterOffer.counterTerms', e.target.value)}
                      />
                    </Grid>
                  </>
                )}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Offer Notes"
                    value={formData.offerSheet.offerNotes}
                    onChange={(e) => handleInputChange('offerSheet.offerNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 2: // Token
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 3: Token</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Record token amount received. Track token receipt, mode of payment, and refund conditions.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Token Date"
                    value={formData.token.tokenDate}
                    onChange={(e) => handleInputChange('token.tokenDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.token.tokenReceived}
                        onChange={(e) => handleInputChange('token.tokenReceived', e.target.checked)}
                      />
                    }
                    label="Token Received"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Token Amount *"
                    value={formData.token.tokenAmount.value}
                    onChange={(e) => handleInputChange('token.tokenAmount.value', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Mode</InputLabel>
                    <Select
                      value={formData.token.tokenMode}
                      onChange={(e) => handleInputChange('token.tokenMode', e.target.value)}
                    >
                      {paymentModes.map(m => <MenuItem key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Token Receipt Number"
                    value={formData.token.tokenReceiptNumber}
                    onChange={(e) => handleInputChange('token.tokenReceiptNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.token.tokenRefundable}
                        onChange={(e) => handleInputChange('token.tokenRefundable', e.target.checked)}
                      />
                    }
                    label="Token Refundable"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Refund Conditions"
                    value={formData.token.tokenRefundConditions}
                    onChange={(e) => handleInputChange('token.tokenRefundConditions', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Token Notes"
                    value={formData.token.tokenNotes}
                    onChange={(e) => handleInputChange('token.tokenNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 3: // Bayana
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Step 4: Bayana</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Execute Bayana agreement. Record parties, terms, conditions, and cancellation terms.
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Bayana Date"
                    value={formData.bayana.bayanaDate}
                    onChange={(e) => handleInputChange('bayana.bayanaDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Bayana Number"
                    value={formData.bayana.bayanaNumber}
                    onChange={(e) => handleInputChange('bayana.bayanaNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.bayana.bayanaExecuted}
                        onChange={(e) => handleInputChange('bayana.bayanaExecuted', e.target.checked)}
                      />
                    }
                    label="Bayana Executed"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Bayana Amount *"
                    value={formData.bayana.bayanaAmount.value}
                    onChange={(e) => handleInputChange('bayana.bayanaAmount.value', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Seller Details</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Seller Name"
                    value={formData.bayana.parties.seller.name}
                    onChange={(e) => handleInputChange('bayana.parties.seller.name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Seller CNIC"
                    value={formData.bayana.parties.seller.cnic}
                    onChange={(e) => handleInputChange('bayana.parties.seller.cnic', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Seller Contact"
                    value={formData.bayana.parties.seller.contactNumber}
                    onChange={(e) => handleInputChange('bayana.parties.seller.contactNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Seller Address"
                    value={formData.bayana.parties.seller.address}
                    onChange={(e) => handleInputChange('bayana.parties.seller.address', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Buyer Details</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Buyer Name"
                    value={formData.bayana.parties.buyer.name}
                    onChange={(e) => handleInputChange('bayana.parties.buyer.name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Buyer CNIC"
                    value={formData.bayana.parties.buyer.cnic}
                    onChange={(e) => handleInputChange('bayana.parties.buyer.cnic', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Buyer Contact"
                    value={formData.bayana.parties.buyer.contactNumber}
                    onChange={(e) => handleInputChange('bayana.parties.buyer.contactNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Buyer Address"
                    value={formData.bayana.parties.buyer.address}
                    onChange={(e) => handleInputChange('bayana.parties.buyer.address', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">Witnesses</Typography>
                    <Button startIcon={<AddIcon />} onClick={addWitness} variant="outlined" size="small">
                      Add Witness
                    </Button>
                  </Box>
                  {formData.bayana.parties.witnesses.map((witness, index) => (
                    <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" fontWeight="bold">Witness #{index + 1}</Typography>
                          <IconButton size="small" onClick={() => removeWitness(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Name"
                              value={witness.name}
                              onChange={(e) => {
                                const newWitnesses = [...formData.bayana.parties.witnesses];
                                newWitnesses[index].name = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  bayana: {
                                    ...prev.bayana,
                                    parties: { ...prev.bayana.parties, witnesses: newWitnesses }
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
                              value={witness.cnic}
                              onChange={(e) => {
                                const newWitnesses = [...formData.bayana.parties.witnesses];
                                newWitnesses[index].cnic = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  bayana: {
                                    ...prev.bayana,
                                    parties: { ...prev.bayana.parties, witnesses: newWitnesses }
                                  }
                                }));
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Relationship"
                              value={witness.relationship}
                              onChange={(e) => {
                                const newWitnesses = [...formData.bayana.parties.witnesses];
                                newWitnesses[index].relationship = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  bayana: {
                                    ...prev.bayana,
                                    parties: { ...prev.bayana.parties, witnesses: newWitnesses }
                                  }
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
                  <Typography variant="subtitle1" gutterBottom>Bayana Terms</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Total Price"
                    value={formData.bayana.bayanaTerms.totalPrice.value}
                    onChange={(e) => handleInputChange('bayana.bayanaTerms.totalPrice.value', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Bayana Percentage"
                    value={formData.bayana.bayanaTerms.bayanaPercentage}
                    onChange={(e) => handleInputChange('bayana.bayanaTerms.bayanaPercentage', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Possession Date"
                    value={formData.bayana.bayanaTerms.possessionDate || ''}
                    onChange={(e) => handleInputChange('bayana.bayanaTerms.possessionDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Registry Date"
                    value={formData.bayana.bayanaTerms.registryDate || ''}
                    onChange={(e) => handleInputChange('bayana.bayanaTerms.registryDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Seller Cancellation Terms"
                    value={formData.bayana.bayanaTerms.cancellationTerms.sellerCancellation}
                    onChange={(e) => handleInputChange('bayana.bayanaTerms.cancellationTerms.sellerCancellation', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Buyer Cancellation Terms"
                    value={formData.bayana.bayanaTerms.cancellationTerms.buyerCancellation}
                    onChange={(e) => handleInputChange('bayana.bayanaTerms.cancellationTerms.buyerCancellation', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Penalty Clause"
                    value={formData.bayana.bayanaTerms.cancellationTerms.penaltyClause}
                    onChange={(e) => handleInputChange('bayana.bayanaTerms.cancellationTerms.penaltyClause', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Bayana Notes"
                    value={formData.bayana.bayanaNotes}
                    onChange={(e) => handleInputChange('bayana.bayanaNotes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 4: // Payment Terms Structure
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Verbal Settlement Risks</Typography>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="date"
                        label="Identified Date"
                        value={formData.verbalSettlementRisks.identifiedDate}
                        onChange={(e) => handleInputChange('verbalSettlementRisks.identifiedDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.verbalSettlementRisks.identified}
                            onChange={(e) => handleInputChange('verbalSettlementRisks.identified', e.target.checked)}
                          />
                        }
                        label="Risks Identified"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1">Risks</Typography>
                        <Button startIcon={<AddIcon />} onClick={addRisk} variant="outlined" size="small">
                          Add Risk
                        </Button>
                      </Box>
                      {formData.verbalSettlementRisks.risks.map((risk, index) => (
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
                                      const newRisks = [...formData.verbalSettlementRisks.risks];
                                      newRisks[index].riskType = e.target.value;
                                      setFormData(prev => ({
                                        ...prev,
                                        verbalSettlementRisks: { ...prev.verbalSettlementRisks, risks: newRisks }
                                      }));
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
                                      const newRisks = [...formData.verbalSettlementRisks.risks];
                                      newRisks[index].severity = e.target.value;
                                      setFormData(prev => ({
                                        ...prev,
                                        verbalSettlementRisks: { ...prev.verbalSettlementRisks, risks: newRisks }
                                      }));
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
                                      const newRisks = [...formData.verbalSettlementRisks.risks];
                                      newRisks[index].probability = e.target.value;
                                      setFormData(prev => ({
                                        ...prev,
                                        verbalSettlementRisks: { ...prev.verbalSettlementRisks, risks: newRisks }
                                      }));
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
                                    const newRisks = [...formData.verbalSettlementRisks.risks];
                                    newRisks[index].riskDescription = e.target.value;
                                    setFormData(prev => ({
                                      ...prev,
                                      verbalSettlementRisks: { ...prev.verbalSettlementRisks, risks: newRisks }
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
                                  label="Mitigation"
                                  value={risk.mitigation || ''}
                                  onChange={(e) => {
                                    const newRisks = [...formData.verbalSettlementRisks.risks];
                                    newRisks[index].mitigation = e.target.value;
                                    setFormData(prev => ({
                                      ...prev,
                                      verbalSettlementRisks: { ...prev.verbalSettlementRisks, risks: newRisks }
                                    }));
                                  }}
                                />
                              </Grid>
                            </Grid>
                          </CardContent>
                        </Card>
                      ))}
                      {formData.verbalSettlementRisks.risks.length === 0 && (
                        <Alert severity="info">No risks identified yet. Click "Add Risk" to add one.</Alert>
                      )}
                    </Grid>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1" gutterBottom>Risk Mitigation Measures</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.verbalSettlementRisks.riskMitigation.writtenAgreement}
                            onChange={(e) => handleInputChange('verbalSettlementRisks.riskMitigation.writtenAgreement', e.target.checked)}
                          />
                        }
                        label="Written Agreement"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.verbalSettlementRisks.riskMitigation.witnessPresent}
                            onChange={(e) => handleInputChange('verbalSettlementRisks.riskMitigation.witnessPresent', e.target.checked)}
                          />
                        }
                        label="Witness Present"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.verbalSettlementRisks.riskMitigation.documentation}
                            onChange={(e) => handleInputChange('verbalSettlementRisks.riskMitigation.documentation', e.target.checked)}
                          />
                        }
                        label="Documentation"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.verbalSettlementRisks.riskMitigation.legalReview}
                            onChange={(e) => handleInputChange('verbalSettlementRisks.riskMitigation.legalReview', e.target.checked)}
                          />
                        }
                        label="Legal Review"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label="Other Measures"
                        value={formData.verbalSettlementRisks.riskMitigation.otherMeasures}
                        onChange={(e) => handleInputChange('verbalSettlementRisks.riskMitigation.otherMeasures', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Risk Notes"
                        value={formData.verbalSettlementRisks.riskNotes}
                        onChange={(e) => handleInputChange('verbalSettlementRisks.riskNotes', e.target.value)}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Land Agent Commission</Typography>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.landAgentCommission.agentInvolved}
                            onChange={(e) => handleInputChange('landAgentCommission.agentInvolved', e.target.checked)}
                          />
                        }
                        label="Agent Involved"
                      />
                    </Grid>
                    {formData.landAgentCommission.agentInvolved && (
                      <>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Agent Name"
                            value={formData.landAgentCommission.agentDetails.name}
                            onChange={(e) => handleInputChange('landAgentCommission.agentDetails.name', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Agent CNIC"
                            value={formData.landAgentCommission.agentDetails.cnic}
                            onChange={(e) => handleInputChange('landAgentCommission.agentDetails.cnic', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Contact Number"
                            value={formData.landAgentCommission.agentDetails.contactNumber}
                            onChange={(e) => handleInputChange('landAgentCommission.agentDetails.contactNumber', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="License Number"
                            value={formData.landAgentCommission.agentDetails.licenseNumber}
                            onChange={(e) => handleInputChange('landAgentCommission.agentDetails.licenseNumber', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="subtitle1" gutterBottom>Commission Structure</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth>
                            <InputLabel>Commission Type</InputLabel>
                            <Select
                              value={formData.landAgentCommission.commission.commissionType}
                              onChange={(e) => handleInputChange('landAgentCommission.commission.commissionType', e.target.value)}
                            >
                              {commissionTypes.map(t => <MenuItem key={t} value={t}>{t.toUpperCase()}</MenuItem>)}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth>
                            <InputLabel>Commission Basis</InputLabel>
                            <Select
                              value={formData.landAgentCommission.commission.commissionBasis}
                              onChange={(e) => handleInputChange('landAgentCommission.commission.commissionBasis', e.target.value)}
                            >
                              {commissionBases.map(b => <MenuItem key={b} value={b}>{b.replace('_', ' ').toUpperCase()}</MenuItem>)}
                            </Select>
                          </FormControl>
                        </Grid>
                        {formData.landAgentCommission.commission.commissionType === 'percentage' && (
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Commission Rate (%)"
                              value={formData.landAgentCommission.commission.commissionRate}
                              onChange={(e) => handleInputChange('landAgentCommission.commission.commissionRate', parseFloat(e.target.value) || 0)}
                            />
                          </Grid>
                        )}
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Commission Amount"
                            value={formData.landAgentCommission.commission.commissionAmount.value}
                            onChange={(e) => handleInputChange('landAgentCommission.commission.commissionAmount.value', parseFloat(e.target.value) || 0)}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            multiline
                            rows={2}
                            label="Payment Schedule"
                            value={formData.landAgentCommission.commission.paymentTerms.paymentSchedule}
                            onChange={(e) => handleInputChange('landAgentCommission.commission.paymentTerms.paymentSchedule', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Commission Notes"
                            value={formData.landAgentCommission.commissionNotes}
                            onChange={(e) => handleInputChange('landAgentCommission.commissionNotes', e.target.value)}
                          />
                        </Grid>
                      </>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Payment Terms Structure</Typography>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Total Price *"
                        value={formData.paymentTermsStructure.totalPrice.value}
                        onChange={(e) => handleInputChange('paymentTermsStructure.totalPrice.value', parseFloat(e.target.value) || 0)}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1" gutterBottom>Payment Breakdown</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Token Amount"
                        value={formData.paymentTermsStructure.paymentBreakdown.token.amount}
                        onChange={(e) => handleInputChange('paymentTermsStructure.paymentBreakdown.token.amount', parseFloat(e.target.value) || 0)}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Bayana Amount"
                        value={formData.paymentTermsStructure.paymentBreakdown.bayana.amount}
                        onChange={(e) => handleInputChange('paymentTermsStructure.paymentBreakdown.bayana.amount', parseFloat(e.target.value) || 0)}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1">Payment Installments</Typography>
                        <Button startIcon={<AddIcon />} onClick={() => addInstallment('payment')} variant="outlined" size="small">
                          Add Installment
                        </Button>
                      </Box>
                      {formData.paymentTermsStructure.paymentBreakdown.installments.map((inst, index) => (
                        <Card key={index} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" fontWeight="bold">Installment #{index + 1}</Typography>
                              <IconButton size="small" onClick={() => removeInstallment('payment', index)} color="error">
                                <DeleteIcon />
                              </IconButton>
                            </Box>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={4}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="number"
                                  label="Amount"
                                  value={inst.amount || 0}
                                  onChange={(e) => {
                                    const newInsts = [...formData.paymentTermsStructure.paymentBreakdown.installments];
                                    newInsts[index].amount = parseFloat(e.target.value) || 0;
                                    setFormData(prev => ({
                                      ...prev,
                                      paymentTermsStructure: {
                                        ...prev.paymentTermsStructure,
                                        paymentBreakdown: { ...prev.paymentTermsStructure.paymentBreakdown, installments: newInsts }
                                      }
                                    }));
                                  }}
                                />
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="date"
                                  label="Due Date"
                                  value={inst.dueDate || ''}
                                  onChange={(e) => {
                                    const newInsts = [...formData.paymentTermsStructure.paymentBreakdown.installments];
                                    newInsts[index].dueDate = e.target.value;
                                    setFormData(prev => ({
                                      ...prev,
                                      paymentTermsStructure: {
                                        ...prev.paymentTermsStructure,
                                        paymentBreakdown: { ...prev.paymentTermsStructure.paymentBreakdown, installments: newInsts }
                                      }
                                    }));
                                  }}
                                  InputLabelProps={{ shrink: true }}
                                />
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Payment Mode</InputLabel>
                                  <Select
                                    value={inst.paymentMode || 'bank_transfer'}
                                    onChange={(e) => {
                                      const newInsts = [...formData.paymentTermsStructure.paymentBreakdown.installments];
                                      newInsts[index].paymentMode = e.target.value;
                                      setFormData(prev => ({
                                        ...prev,
                                        paymentTermsStructure: {
                                          ...prev.paymentTermsStructure,
                                          paymentBreakdown: { ...prev.paymentTermsStructure.paymentBreakdown, installments: newInsts }
                                        }
                                      }));
                                    }}
                                  >
                                    {paymentModes.map(m => <MenuItem key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</MenuItem>)}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={inst.paid || false}
                                      onChange={(e) => {
                                        const newInsts = [...formData.paymentTermsStructure.paymentBreakdown.installments];
                                        newInsts[index].paid = e.target.checked;
                                        setFormData(prev => ({
                                          ...prev,
                                          paymentTermsStructure: {
                                            ...prev.paymentTermsStructure,
                                            paymentBreakdown: { ...prev.paymentTermsStructure.paymentBreakdown, installments: newInsts }
                                          }
                                        }));
                                      }}
                                    />
                                  }
                                  label="Paid"
                                />
                              </Grid>
                            </Grid>
                          </CardContent>
                        </Card>
                      ))}
                    </Grid>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1" gutterBottom>Payment Schedule</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Schedule Type</InputLabel>
                        <Select
                          value={formData.paymentTermsStructure.paymentSchedule.scheduleType}
                          onChange={(e) => handleInputChange('paymentTermsStructure.paymentSchedule.scheduleType', e.target.value)}
                        >
                          {scheduleTypes.map(t => <MenuItem key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Installment Frequency</InputLabel>
                        <Select
                          value={formData.paymentTermsStructure.paymentSchedule.installmentFrequency}
                          onChange={(e) => handleInputChange('paymentTermsStructure.paymentSchedule.installmentFrequency', e.target.value)}
                        >
                          {frequencies.map(f => <MenuItem key={f} value={f}>{f.replace('_', ' ').toUpperCase()}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="date"
                        label="First Installment Date"
                        value={formData.paymentTermsStructure.paymentSchedule.firstInstallmentDate || ''}
                        onChange={(e) => handleInputChange('paymentTermsStructure.paymentSchedule.firstInstallmentDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="date"
                        label="Last Installment Date"
                        value={formData.paymentTermsStructure.paymentSchedule.lastInstallmentDate || ''}
                        onChange={(e) => handleInputChange('paymentTermsStructure.paymentSchedule.lastInstallmentDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Grace Period (days)"
                        value={formData.paymentTermsStructure.paymentSchedule.gracePeriod}
                        onChange={(e) => handleInputChange('paymentTermsStructure.paymentSchedule.gracePeriod', parseFloat(e.target.value) || 0)}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Late Payment Penalty (%)"
                        value={formData.paymentTermsStructure.paymentSchedule.latePaymentPenalty.percentage}
                        onChange={(e) => handleInputChange('paymentTermsStructure.paymentSchedule.latePaymentPenalty.percentage', parseFloat(e.target.value) || 0)}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Payment Notes"
                        value={formData.paymentTermsStructure.paymentNotes}
                        onChange={(e) => handleInputChange('paymentTermsStructure.paymentNotes', e.target.value)}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        );

      case 5: // Completion
        return (
          <Grid container spacing={3}>
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
                        options={ownerDueDiligences}
                        getOptionLabel={(option) => option.dueDiligenceNumber || ''}
                        value={ownerDueDiligences.find(odd => odd._id === formData.ownerDueDiligence) || null}
                        onChange={(e, newValue) => handleInputChange('ownerDueDiligence', newValue?._id || '')}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Owner Due Diligence"
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
        Negotiation & Bayana {id ? '(Edit)' : '(New)'}
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

export default NegotiationBayana;
