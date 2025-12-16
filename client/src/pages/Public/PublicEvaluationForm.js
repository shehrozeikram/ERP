import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Button,
  Container,
  Grid,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { evaluationDocumentsService } from '../../services/evaluationDocumentsService';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import dayjs from 'dayjs';
import EmployeeInfoSection from '../HR/EvaluationAppraisal/components/EmployeeInfoSection';
import MarksDescriptionSection from '../HR/EvaluationAppraisal/components/MarksDescriptionSection';
import OverallResultSection from '../HR/EvaluationAppraisal/components/OverallResultSection';
import EvaluationTable from '../HR/EvaluationAppraisal/components/EvaluationTable';
import {
  evaluationCategories,
  whiteCollarProfessionalAttributes,
  whiteCollarPersonalAttributes,
  initializeScores
} from '../HR/EvaluationAppraisal/constants';

const validationSchema = Yup.object({
  code: Yup.string().required('Code is required'),
  date: Yup.date().required('Date is required'),
  name: Yup.string().required('Name is required'),
  reviewPeriodFrom: Yup.date().required('Review period start date is required'),
  reviewPeriodTo: Yup.date().required('Review period end date is required'),
  designation: Yup.string().required('Designation is required'),
  department: Yup.string().required('Department/Section is required'),
  immediateBoss: Yup.string().required('Immediate Boss/Evaluator is required'),
  overallResult: Yup.string().required('Overall result is required'),
  strength: Yup.string(),
  weakness: Yup.string(),
  otherComments: Yup.string()
});

const PublicEvaluationForm = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user } = useAuth(); // Get authenticated user for Level 0 editing
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [isLevelEdit, setIsLevelEdit] = useState(false);
  const [editLevel, setEditLevel] = useState(null);
  const [assignedApprovalLevels, setAssignedApprovalLevels] = useState([]);

  // Fetch user's assigned approval levels
  useEffect(() => {
    const fetchAssignedLevels = async () => {
      if (!user) {
        setAssignedApprovalLevels([]);
        return;
      }
      try {
        const response = await evaluationDocumentsService.getAssignedApprovalLevels();
        if (response.data?.success) {
          const levels = response.data.data.assignedLevels || [];
          setAssignedApprovalLevels(levels.map(l => l.level));
        }
      } catch (err) {
        console.error('Error fetching assigned approval levels:', err);
        setAssignedApprovalLevels([]);
      }
    };
    fetchAssignedLevels();
  }, [user]);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        setError(null);

        // Allow access with token (public) OR if user is authenticated (for level editing)
        const accessToken = token || (user ? 'authenticated' : null);
        
        if (!accessToken) {
          setError('Access token is required to view this evaluation form.');
          setLoading(false);
          return;
        }
        
        // Fetch document - use token if available, otherwise use authenticated API
        const response = token 
          ? await evaluationDocumentsService.getById(id, token)
          : await evaluationDocumentsService.getById(id);
        
        const doc = response.data?.data || response.data;

        // Check if this is a level editing scenario (Level 0-4)
        // For Level 0: check level0ApprovalStatus
        // For Level 1-4: check if document is at that level and user is assigned
        let isEdit = false;
        let level = null;
        
        if (user && doc.status === 'submitted') {
          // Check Level 0
          if (doc.currentApprovalLevel === 0 && doc.level0ApprovalStatus === 'pending') {
            // Check if user is in level0Approvers
            const currentUserId = user._id?.toString() || user.id?.toString();
            const userInApprovers = doc.level0Approvers?.some(approver => {
              const approverUserId = approver.assignedUser?._id?.toString() || 
                                     approver.assignedUser?.toString();
              return approverUserId && currentUserId && approverUserId === currentUserId;
            });
            if (userInApprovers) {
              isEdit = true;
              level = 0;
            }
          }
          // Check Level 1-4
          else if (doc.currentApprovalLevel >= 1 && doc.currentApprovalLevel <= 4) {
            // Check if user is assigned to this level
            if (assignedApprovalLevels.includes(doc.currentApprovalLevel)) {
              isEdit = true;
              level = doc.currentApprovalLevel;
            }
          }
        }
        
        setIsLevelEdit(isEdit);
        setEditLevel(level);

        // For public access with token, check if already submitted (unless level edit)
        if (token && !isEdit && (doc.status === 'submitted' || doc.status === 'completed')) {
          setError('This evaluation form has already been submitted and cannot be accessed again.');
          setLoading(false);
          return;
        }

        setDocument(doc);
        setActiveTab(doc.formType === 'blue_collar' ? 0 : 1);
      } catch (err) {
        console.error('Error fetching document:', err);
        const errorMsg = err.response?.data?.error || 'Failed to load evaluation form.';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchDocument();
    }
  }, [id, token, user, assignedApprovalLevels]);

  // Initialize form values based on document
  const initialValues = useMemo(() => {
    if (!document) {
      return {
        code: '',
        date: dayjs().format('YYYY-MM-DD'),
        name: '',
        reviewPeriodFrom: '2023-01-01',
        reviewPeriodTo: '2023-12-31',
        designation: '',
        department: '',
        immediateBoss: '',
        appraisalHistory: '',
        overallResult: '',
        strength: '',
        weakness: '',
        otherComments: '',
        evaluationScores: initializeScores(evaluationCategories),
        whiteCollarProfessionalScores: initializeScores(whiteCollarProfessionalAttributes),
        whiteCollarPersonalScores: initializeScores(whiteCollarPersonalAttributes),
        reportingOfficerComments: '',
        reportingOfficerName: '',
        reportingOfficerDate: '',
        counterSigningOfficerComments: '',
        counterSigningOfficerName: '',
        counterSigningOfficerDate: '',
        developmentPlan: '',
        recommendedByHOD: '',
        recommendedByHR: '',
        developmentPlanObjectives: [{ objective: '', who: '', when: '', where: '' }],
        developmentPlanResult: '',
        employeeSignature: '',
        employeeSignatureDate: '',
        headOfHRSignature: '',
        headOfHRDate: ''
      };
    }

    return {
      code: document.code || document.employee?.employeeId || '',
      date: document.date ? dayjs(document.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      name: document.name || `${document.employee?.firstName || ''} ${document.employee?.lastName || ''}`.trim(),
      reviewPeriodFrom: document.reviewPeriodFrom ? dayjs(document.reviewPeriodFrom).format('YYYY-MM-DD') : '2023-01-01',
      reviewPeriodTo: document.reviewPeriodTo ? dayjs(document.reviewPeriodTo).format('YYYY-MM-DD') : '2023-12-31',
      designation: document.designation || document.employee?.placementDesignation?.title || '',
      department: document.department?.name || document.employee?.placementDepartment?.name || '',
      immediateBoss: document.immediateBoss || `${document.evaluator?.firstName || ''} ${document.evaluator?.lastName || ''}`.trim(),
      appraisalHistory: document.appraisalHistory || '',
      overallResult: document.overallResult || '',
      strength: document.strength || '',
      weakness: document.weakness || '',
      otherComments: document.otherComments || '',
      evaluationScores: document.evaluationScores || initializeScores(evaluationCategories),
      whiteCollarProfessionalScores: document.whiteCollarProfessionalScores || initializeScores(whiteCollarProfessionalAttributes),
      whiteCollarPersonalScores: document.whiteCollarPersonalScores || initializeScores(whiteCollarPersonalAttributes),
      reportingOfficerComments: document.reportingOfficerComments || '',
      reportingOfficerName: document.reportingOfficerName || '',
      reportingOfficerDate: document.reportingOfficerDate ? dayjs(document.reportingOfficerDate).format('YYYY-MM-DD') : '',
      counterSigningOfficerComments: document.counterSigningOfficerComments || '',
      counterSigningOfficerName: document.counterSigningOfficerName || '',
      counterSigningOfficerDate: document.counterSigningOfficerDate ? dayjs(document.counterSigningOfficerDate).format('YYYY-MM-DD') : '',
      developmentPlan: document.developmentPlan || '',
      recommendedByHOD: document.recommendedByHOD || '',
      recommendedByHR: document.recommendedByHR || '',
      developmentPlanObjectives: document.developmentPlanObjectives || [{ objective: '', who: '', when: '', where: '' }],
      developmentPlanResult: document.developmentPlanResult || '',
      employeeSignature: document.employeeSignature || '',
      employeeSignatureDate: document.employeeSignatureDate ? dayjs(document.employeeSignatureDate).format('YYYY-MM-DD') : '',
      headOfHRSignature: document.headOfHRSignature || '',
      headOfHRDate: document.headOfHRDate ? dayjs(document.headOfHRDate).format('YYYY-MM-DD') : ''
    };
  }, [document]);

  const formik = useFormik({
    initialValues,
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      try {
        setSubmitting(true);
        setError(null);

        let totalObtainedScore, totalScore, percentage;

        if (activeTab === 0) {
          totalObtainedScore = Object.values(values.evaluationScores).reduce((sum, item) => {
            return sum + (parseInt(item.score) || 0);
          }, 0);
          totalScore = 50;
          percentage = (totalObtainedScore / totalScore) * 100;
        } else {
          const professionalScore = Object.values(values.whiteCollarProfessionalScores).reduce((sum, item) => {
            return sum + (parseInt(item.score) || 0);
          }, 0);
          const personalScore = Object.values(values.whiteCollarPersonalScores).reduce((sum, item) => {
            return sum + (parseInt(item.score) || 0);
          }, 0);
          totalObtainedScore = professionalScore + personalScore;
          totalScore = 100;
          percentage = (totalObtainedScore / totalScore) * 100;
        }

        // Only send evaluation data, exclude reference fields and system fields
        const {
          department, // Exclude - already set in document, might be string
          employee, // Exclude - reference field
          evaluator, // Exclude - reference field
          accessToken, // Exclude - system field
          createdAt, // Exclude - system field
          updatedAt, // Exclude - system field
          ...evaluationData
        } = values;

        const updateData = {
          ...evaluationData,
          totalScore: totalObtainedScore,
          percentage: Math.round(percentage * 100) / 100,
        };

        // Check if this is a level edit (0-4)
        if (isLevelEdit && editLevel !== null) {
          // Use appropriate resubmit endpoint based on level
          if (editLevel === 0) {
            await evaluationDocumentsService.resubmitLevel0(id, updateData);
          } else if (editLevel === 1) {
            await evaluationDocumentsService.resubmitLevel1(id, updateData);
          } else if (editLevel === 2) {
            await evaluationDocumentsService.resubmitLevel2(id, updateData);
          } else if (editLevel === 3) {
            await evaluationDocumentsService.resubmitLevel3(id, updateData);
          } else if (editLevel === 4) {
            await evaluationDocumentsService.resubmitLevel4(id, updateData);
          }
          setSuccessModalOpen(true);
        } else {
          // Public form submission - set status to submitted
          updateData.status = 'submitted';
          updateData.submittedAt = new Date();

          await evaluationDocumentsService.update(id, updateData, token);
          setSuccessModalOpen(true);
        }
      } catch (err) {
        console.error('Error submitting form:', err);
        setError(err.response?.data?.error || 'Failed to submit evaluation form. Please try again.');
      } finally {
        setSubmitting(false);
      }
    }
  });

  const calculateTotalScore = useMemo(() => {
    if (activeTab === 0) {
      return Object.values(formik.values.evaluationScores || {}).reduce((sum, item) => {
        return sum + (parseInt(item?.score) || 0);
      }, 0);
    } else {
      const professionalScore = Object.values(formik.values.whiteCollarProfessionalScores || {}).reduce((sum, item) => {
        return sum + (parseInt(item?.score) || 0);
      }, 0);
      const personalScore = Object.values(formik.values.whiteCollarPersonalScores || {}).reduce((sum, item) => {
        return sum + (parseInt(item?.score) || 0);
      }, 0);
      return professionalScore + personalScore;
    }
  }, [formik.values, activeTab]);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        sx={{ bgcolor: 'background.default' }}
      >
        <Box textAlign="center">
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6">Loading evaluation form...</Typography>
        </Box>
      </Box>
    );
  }

  if (error && !document) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => window.location.href = '/'}
            variant="outlined"
          >
            Go to Home
          </Button>
        </Paper>
      </Container>
    );
  }

  if (!document) {
    return null;
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 3 }}>
      <Container maxWidth="lg">
        <Paper sx={{ p: 3 }}>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4" fontWeight="bold">
              Employee Evaluation Form
            </Typography>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => window.location.href = '/'}
              variant="outlined"
            >
              Close
            </Button>
          </Box>
          
          <Alert severity="info" sx={{ mb: 3 }}>
            {isLevelEdit && editLevel !== null ? (
              <>
                <strong>Level {editLevel} Edit Mode:</strong> You are editing the evaluation for{' '}
                <strong>{document.employee?.firstName} {document.employee?.lastName}</strong> 
                ({document.employee?.employeeId}) - {document.formType === 'blue_collar' ? 'Blue Collar' : 'White Collar'}.
                After editing, you can approve or resubmit this document.
              </>
            ) : (
              <>
                You are evaluating: <strong>{document.employee?.firstName} {document.employee?.lastName}</strong> 
                ({document.employee?.employeeId}) - {document.formType === 'blue_collar' ? 'Blue Collar' : 'White Collar'}
              </>
            )}
          </Alert>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={formik.handleSubmit}>
            <EmployeeInfoSection formik={formik} />
            <MarksDescriptionSection />
            <OverallResultSection formik={formik} />
            
            {activeTab === 0 ? (
              <EvaluationTable
                categories={evaluationCategories}
                scores={formik.values.evaluationScores}
                onScoreChange={(category, score) => {
                  formik.setFieldValue(`evaluationScores.${category}.score`, score);
                }}
                onCommentChange={(category, comment) => {
                  formik.setFieldValue(`evaluationScores.${category}.comments`, comment);
                }}
              />
            ) : (
              <>
                <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2 }}>
                  Professional Attributes
                </Typography>
                <EvaluationTable
                  categories={whiteCollarProfessionalAttributes}
                  scores={formik.values.whiteCollarProfessionalScores}
                  onScoreChange={(category, score) => {
                    formik.setFieldValue(`whiteCollarProfessionalScores.${category}.score`, score);
                  }}
                  onCommentChange={(category, comment) => {
                    formik.setFieldValue(`whiteCollarProfessionalScores.${category}.comments`, comment);
                  }}
                  showDescription
                />
                <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2 }}>
                  Personal Attributes
                </Typography>
                <EvaluationTable
                  categories={whiteCollarPersonalAttributes}
                  scores={formik.values.whiteCollarPersonalScores}
                  onScoreChange={(category, score) => {
                    formik.setFieldValue(`whiteCollarPersonalScores.${category}.score`, score);
                  }}
                  onCommentChange={(category, comment) => {
                    formik.setFieldValue(`whiteCollarPersonalScores.${category}.comments`, comment);
                  }}
                  showDescription
                />
              </>
            )}

            {/* Comments Section */}
            <Grid container spacing={2} sx={{ mt: 3 }}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Strength"
                  name="strength"
                  value={formik.values.strength}
                  onChange={formik.handleChange}
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Weakness"
                  name="weakness"
                  value={formik.values.weakness}
                  onChange={formik.handleChange}
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Other Comments"
                  name="otherComments"
                  value={formik.values.otherComments}
                  onChange={formik.handleChange}
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={submitting || (document?.status === 'completed' && !token)}
                size="large"
              >
                {submitting 
                  ? 'Submitting...' 
                  : isLevelEdit
                    ? 'Resubmit Evaluation'
                    : !token && document?.status === 'submitted' 
                      ? 'Resubmit Evaluation' 
                      : document?.status === 'completed' 
                        ? 'Already Completed' 
                        : 'Submit Evaluation'}
              </Button>
            </Box>
          </form>
        </Paper>
      </Container>

      {/* Success Modal */}
      <Dialog
        open={successModalOpen}
        onClose={() => {}}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2
          }
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', pt: 4 }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" component="div" fontWeight="bold">
            Thank You!
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', pb: 2 }}>
          <DialogContentText sx={{ fontSize: '1.1rem', mb: 2 }}>
            {isLevelEdit && editLevel !== null
              ? `Evaluation document has been updated and resubmitted successfully at Level ${editLevel}.`
              : 'Your evaluation has been submitted successfully.'}
          </DialogContentText>
          <DialogContentText sx={{ fontSize: '0.95rem', color: 'text.secondary' }}>
            {isLevelEdit && editLevel !== null
              ? `The document has been resubmitted at Level ${editLevel}. Please approve it to move to Level ${editLevel + 1}.`
              : 'The form has been received and will be processed. This link will no longer be accessible.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={() => {
              setSuccessModalOpen(false);
              window.location.href = '/';
            }}
            sx={{ minWidth: 120 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PublicEvaluationForm;
