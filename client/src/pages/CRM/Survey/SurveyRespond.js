import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Typography,
  Zoom
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Assignment as SurveyIcon,
  AssignmentTurnedIn as CompletedIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Event as EventIcon,
  Person as PersonIcon,
  PlayArrow as StartIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
import surveyService from '../../../services/surveyService';
import DynamicQuestionField from './DynamicQuestionField';
import PollVote from './PollVote';
import SurveySectionHeader from './SurveySectionHeader';
import {
  buildQuestionFlow,
  questionsFromSections,
  resolveSurveySections
} from '../../../utils/surveySections';

const pulse = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.08); opacity: 0.9; }
  100% { transform: scale(1); opacity: 1; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
`;

const AUTO_ADVANCE_TYPES = new Set(['yes_no', 'single_choice']);

const isEmptyAnswer = (value) =>
  value === undefined || value === null || value === ''
  || (Array.isArray(value) && value.length === 0);

const validateQuestion = (question, value) => {
  if (question.required && isEmptyAnswer(value)) {
    return 'This question is required';
  }
  if (isEmptyAnswer(value)) return '';

  if (question.type === 'number' && Number.isNaN(Number(value))) {
    return 'Please enter a valid number';
  }

  if (question.type === 'rating') {
    const num = Number(value);
    if (Number.isNaN(num) || num < (question.min || 1) || num > (question.max || 5)) {
      return `Rating must be between ${question.min || 1} and ${question.max || 5}`;
    }
  }

  return '';
};

const validateSurveyAnswers = (questions, answers) => {
  const fieldErrors = {};
  questions.forEach((question) => {
    const err = validateQuestion(question, answers[question.key]);
    if (err) fieldErrors[question.key] = err;
  });
  return fieldErrors;
};

const answersFromResponse = (response) => {
  if (!response?.answers?.length) return {};
  return Object.fromEntries(response.answers.map((a) => [a.questionKey, a.value]));
};

const formatAnswerDisplay = (question, value) => {
  if (isEmptyAnswer(value)) return '—';

  if (question.type === 'yes_no') {
    return value === 'yes' ? 'Yes' : value === 'no' ? 'No' : String(value);
  }

  if (question.type === 'single_choice' || question.type === 'multiple_choice') {
    const options = question.options || [];
    const values = Array.isArray(value) ? value : [value];
    return values
      .map((v) => options.find((o) => o.value === v)?.label || v)
      .join(', ');
  }

  if (question.type === 'rating') {
    return `${value} / ${question.max || 5}`;
  }

  return String(value);
};

const estimateMinutes = (count) => Math.max(1, Math.ceil(count * 0.75));

const SurveyRespond = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [survey, setSurvey] = useState(null);
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideKey, setSlideKey] = useState(0);

  const loadSurvey = useCallback(async () => {
    setLoading(true);
    try {
      const res = await surveyService.getSurvey(id);
      const data = res.data?.data;
      setSurvey(data);
      if (data?.myResponse?.answers) {
        setAnswers(answersFromResponse(data.myResponse));
      }
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load survey');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  const sortedSections = useMemo(
    () => resolveSurveySections(survey),
    [survey]
  );

  const questionFlow = useMemo(
    () => buildQuestionFlow(sortedSections),
    [sortedSections]
  );

  const sortedQuestions = useMemo(
    () => questionsFromSections(sortedSections),
    [sortedSections]
  );

  const isReadOnly = Boolean(
    survey?.hasResponded && !survey?.allowMultipleResponses
  );

  const creatorName = survey?.createdBy
    ? `${survey.createdBy.firstName || ''} ${survey.createdBy.lastName || ''}`.trim()
    : null;

  const currentQuestion = questionFlow[currentIndex]?.question;
  const currentSection = questionFlow[currentIndex]?.section;
  const showSectionHeader = Boolean(
    currentSection
    && (currentIndex === 0 || questionFlow[currentIndex - 1]?.section?.key !== currentSection.key)
  );
  const totalSteps = questionFlow.length + 2;
  const currentStep = phase === 'intro' ? 1 : phase === 'review' ? totalSteps : currentIndex + 2;
  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  const answeredCount = useMemo(
    () => sortedQuestions.filter((q) => !isEmptyAnswer(answers[q.key])).length,
    [sortedQuestions, answers]
  );

  const bumpSlide = () => setSlideKey((k) => k + 1);

  const goToQuestion = (index) => {
    setFieldError('');
    setCurrentIndex(index);
    setPhase('questions');
    bumpSlide();
  };

  const handleAnswerChange = (questionKey, value) => {
    setAnswers((prev) => ({ ...prev, [questionKey]: value }));
    if (fieldError) setFieldError('');

    const question = questionFlow.find((item) => item.question.key === questionKey)?.question
      || sortedQuestions.find((q) => q.key === questionKey);
    if (
      question
      && AUTO_ADVANCE_TYPES.has(question.type)
      && !isEmptyAnswer(value)
      && currentIndex < sortedQuestions.length - 1
    ) {
      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        bumpSlide();
      }, 450);
    }
  };

  const validateCurrent = () => {
    if (!currentQuestion) return true;
    const err = validateQuestion(currentQuestion, answers[currentQuestion.key]);
    if (err) {
      setFieldError(err);
      return false;
    }
    setFieldError('');
    return true;
  };

  const handleNext = () => {
    if (phase === 'intro') {
      setPhase('questions');
      bumpSlide();
      return;
    }

    if (!validateCurrent()) return;

    if (currentIndex < questionFlow.length - 1) {
      setCurrentIndex((i) => i + 1);
      bumpSlide();
    } else {
      setPhase('review');
      bumpSlide();
    }
  };

  const handleBack = () => {
    setFieldError('');
    if (phase === 'review') {
      setPhase('questions');
      setCurrentIndex(questionFlow.length - 1);
      bumpSlide();
      return;
    }
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      bumpSlide();
    } else {
      setPhase('intro');
      bumpSlide();
    }
  };

  const handleSubmit = async () => {
    setError('');
    const errors = validateSurveyAnswers(sortedQuestions, answers);
    if (Object.keys(errors).length) {
      const firstKey = sortedQuestions.find((q) => errors[q.key])?.key;
      const idx = questionFlow.findIndex((item) => item.question.key === firstKey);
      if (idx >= 0) {
        setCurrentIndex(idx);
        setPhase('questions');
        setFieldError(errors[firstKey]);
        bumpSlide();
      }
      return;
    }

    setSubmitting(true);
    try {
      const payload = sortedQuestions.map((q) => ({
        questionKey: q.key,
        value: answers[q.key] ?? (q.type === 'multiple_choice' ? [] : '')
      }));
      await surveyService.submitResponse(id, payload);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit survey');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (submitted || isReadOnly || submitting) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        const tag = e.target?.tagName?.toLowerCase();
        if (tag === 'textarea') return;
        e.preventDefault();
        if (phase === 'review') handleSubmit();
        else handleNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pageBg = {
    minHeight: '100vh',
    background: `
      radial-gradient(ellipse 80% 50% at 50% -10%, ${alpha(theme.palette.primary.main, 0.14)} 0%, transparent 60%),
      ${theme.palette.background.default}
    `
  };

  if (loading) {
    return (
      <Box sx={{ ...pageBg, p: { xs: 2, md: 3 }, maxWidth: 720, mx: 'auto' }}>
        <Skeleton variant="rounded" height={320} sx={{ borderRadius: 4 }} />
      </Box>
    );
  }

  if (!survey) {
    return (
      <Box sx={{ ...pageBg, p: 3, maxWidth: 600, mx: 'auto' }}>
        <Alert severity="error">{error || 'Survey not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/crm/survey/mine')}>
          Back to My Surveys
        </Button>
      </Box>
    );
  }

  if (survey.kind === 'poll') {
    return <PollVote survey={survey} surveyId={id} />;
  }

  if (submitted) {
    return (
      <Box sx={{ ...pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, minHeight: '80vh' }}>
        <Zoom in>
          <Paper
            elevation={0}
            sx={{
              maxWidth: 520,
              width: '100%',
              p: { xs: 4, md: 6 },
              textAlign: 'center',
              borderRadius: 4,
              border: '1px solid',
              borderColor: alpha(theme.palette.success.main, 0.3),
              background: `linear-gradient(180deg, ${alpha(theme.palette.success.main, 0.12)} 0%, ${theme.palette.background.paper} 55%)`,
              animation: `${slideUp} 0.5s ease`
            }}
          >
            <CheckCircleIcon
              sx={{
                fontSize: 88,
                color: 'success.main',
                mb: 2,
                animation: `${pulse} 1.5s ease infinite`
              }}
            />
            <Typography variant="h4" fontWeight={800} gutterBottom>
              All done!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              Thank you for completing
            </Typography>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
              {survey.title}
            </Typography>
            <Chip
              label={`${sortedQuestions.length} questions answered`}
              color="success"
              variant="outlined"
              sx={{ mb: 3 }}
            />
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/crm/survey/mine')}
              sx={{ borderRadius: 3, px: 4, textTransform: 'none', fontWeight: 700 }}
            >
              Back to My Surveys
            </Button>
          </Paper>
        </Zoom>
      </Box>
    );
  }

  /* ── Read-only completed view ── */
  if (isReadOnly) {
    return (
      <Box sx={pageBg}>
        <Box sx={{ maxWidth: 720, mx: 'auto', p: { xs: 2, md: 3 }, pb: 6 }}>
          <IconButton onClick={() => navigate('/crm/survey/mine')} sx={{ mb: 2 }}>
            <ArrowBackIcon />
          </IconButton>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              mb: 3,
              borderRadius: 4,
              border: '1px solid',
              borderColor: alpha(theme.palette.success.main, 0.3),
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, transparent 100%)`
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
              <CompletedIcon color="success" />
              <Typography variant="h5" fontWeight={800}>{survey.title}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Submitted
              {survey.myResponse?.submittedAt
                ? ` on ${new Date(survey.myResponse.submittedAt).toLocaleString()}`
                : ''}
            </Typography>
          </Paper>

          <Stack spacing={3}>
            {sortedSections.map((section, sectionIndex) => (
              <Paper key={section.key} variant="outlined" sx={{ overflow: 'hidden' }}>
                <SurveySectionHeader
                  sectionNumber={sectionIndex + 1}
                  title={section.title}
                />
                <Stack spacing={2} sx={{ p: 2 }}>
                  {(section.questions || []).map((question, index) => (
                    <Paper
                      key={question.key}
                      elevation={0}
                      sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
                    >
                      <Typography variant="caption" color="primary.main" fontWeight={700}>
                        Question {index + 1}
                      </Typography>
                      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                        {question.label}
                      </Typography>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.primary.main, 0.04),
                          borderLeft: '4px solid',
                          borderColor: 'primary.main'
                        }}
                      >
                        <Typography variant="body1">
                          {formatAnswerDisplay(question, answers[question.key])}
                        </Typography>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>
      </Box>
    );
  }

  /* ── Wizard flow ── */
  return (
    <Box sx={pageBg}>
      {/* Top bar */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backdropFilter: 'blur(12px)',
          bgcolor: alpha(theme.palette.background.default, 0.85),
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: { xs: 2, md: 3 },
          py: 1.25
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2} sx={{ maxWidth: 720, mx: 'auto' }}>
          <IconButton size="small" onClick={() => navigate('/crm/survey/mine')}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                {survey.title}
              </Typography>
              <Typography variant="caption" fontWeight={700} color="primary.main">
                {progressPercent}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progressPercent}
              sx={{
                height: 5,
                borderRadius: 4,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                '& .MuiLinearProgress-bar': { borderRadius: 4, transition: 'transform 0.4s ease' }
              }}
            />
          </Box>
        </Stack>
      </Box>

      <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 3, md: 5 }, pb: 14 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {survey.hasResponded && survey.allowMultipleResponses && (
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            You previously submitted this survey. Update your answers and submit again if needed.
          </Alert>
        )}

        <Box key={slideKey} sx={{ animation: `${slideUp} 0.35s ease` }}>
          {/* INTRO */}
          {phase === 'intro' && (
            <Paper
              elevation={0}
              sx={{
                p: { xs: 4, md: 6 },
                borderRadius: 4,
                border: '1px solid',
                borderColor: 'divider',
                textAlign: 'center'
              }}
            >
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  mx: 'auto',
                  mb: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.12)
                }}
              >
                <SurveyIcon sx={{ fontSize: 36, color: 'primary.main' }} />
              </Box>

              <Typography variant="h4" fontWeight={800} sx={{ mb: 1.5, lineHeight: 1.25 }}>
                {survey.title}
              </Typography>

              {survey.description && (
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 480, mx: 'auto' }}>
                  {survey.description}
                </Typography>
              )}

              <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" sx={{ mb: 3 }}>
                <Chip label={`${sortedSections.length} section${sortedSections.length === 1 ? '' : 's'}`} variant="outlined" />
                <Chip label={`${sortedQuestions.length} questions`} color="primary" variant="outlined" />
                <Chip label={`~${estimateMinutes(sortedQuestions.length)} min`} variant="outlined" />
                {survey.closesAt && (
                  <Chip
                    icon={<EventIcon />}
                    label={`Closes ${new Date(survey.closesAt).toLocaleDateString()}`}
                    variant="outlined"
                  />
                )}
              </Stack>

              {creatorName && (
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.75} sx={{ mb: 4 }}>
                  <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Requested by {creatorName}
                  </Typography>
                </Stack>
              )}

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                One question at a time · Review before submitting
              </Typography>

              <Button
                variant="contained"
                size="large"
                endIcon={<StartIcon />}
                onClick={handleNext}
                sx={{
                  borderRadius: 3,
                  px: 5,
                  py: 1.5,
                  fontWeight: 700,
                  textTransform: 'none',
                  fontSize: '1.05rem'
                }}
              >
                Start survey
              </Button>
            </Paper>
          )}

          {/* QUESTION */}
          {phase === 'questions' && currentQuestion && (
            <Box>
              {showSectionHeader && currentSection && (
                <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
                  <SurveySectionHeader
                    sectionNumber={(questionFlow[currentIndex]?.sectionIndex || 0) + 1}
                    title={currentSection.title}
                    dense
                  />
                </Paper>
              )}

              <Typography
                variant="overline"
                color="primary.main"
                fontWeight={700}
                letterSpacing={1.2}
                sx={{ mb: 1, display: 'block' }}
              >
                Question {currentIndex + 1} of {questionFlow.length}
              </Typography>

              <DynamicQuestionField
                question={currentQuestion}
                value={answers[currentQuestion.key]}
                onChange={handleAnswerChange}
                disabled={submitting}
                error={fieldError}
                variant="wizard"
              />

              <Collapse in={Boolean(fieldError)}>
                <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                  {fieldError}
                </Alert>
              </Collapse>

              {/* Dot navigator */}
              <Stack direction="row" spacing={0.75} justifyContent="center" flexWrap="wrap" sx={{ mt: 4 }}>
                {questionFlow.map((item, i) => {
                  const done = !isEmptyAnswer(answers[item.question.key]);
                  const active = i === currentIndex;
                  return (
                    <Box
                      key={item.question.key}
                      onClick={() => goToQuestion(i)}
                      sx={{
                        width: active ? 24 : 8,
                        height: 8,
                        borderRadius: 4,
                        bgcolor: active
                          ? 'primary.main'
                          : done
                            ? alpha(theme.palette.primary.main, 0.4)
                            : alpha(theme.palette.grey[500], 0.2),
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                    />
                  );
                })}
              </Stack>
            </Box>
          )}

          {/* REVIEW */}
          {phase === 'review' && (
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>
                Review your answers
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {answeredCount} of {sortedQuestions.length} questions answered · Edit any answer before submitting
              </Typography>

              <Stack spacing={3}>
                {sortedSections.map((section, sectionIndex) => (
                  <Paper key={section.key} variant="outlined" sx={{ overflow: 'hidden' }}>
                    <SurveySectionHeader
                      sectionNumber={sectionIndex + 1}
                      title={section.title}
                    />
                    <Stack spacing={2} sx={{ p: 2 }}>
                      {(section.questions || []).map((question, index) => {
                        const flowIndex = questionFlow.findIndex((item) => item.question.key === question.key);
                        const empty = isEmptyAnswer(answers[question.key]);
                        return (
                          <Paper
                            key={question.key}
                            elevation={0}
                            sx={{
                              p: 2.5,
                              borderRadius: 3,
                              border: '1px solid',
                              borderColor: empty ? 'warning.light' : 'divider',
                              bgcolor: empty ? alpha(theme.palette.warning.main, 0.04) : 'background.paper'
                            }}
                          >
                            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                  Q{index + 1}
                                  {question.required && ' · Required'}
                                </Typography>
                                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.75 }}>
                                  {question.label}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color={empty ? 'warning.main' : 'text.primary'}
                                  fontWeight={empty ? 600 : 400}
                                >
                                  {empty ? 'Not answered' : formatAnswerDisplay(question, answers[question.key])}
                                </Typography>
                              </Box>
                              <IconButton size="small" onClick={() => goToQuestion(flowIndex)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      </Box>

      {/* Footer navigation */}
      {phase !== 'intro' && (
        <Paper
          elevation={12}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            px: { xs: 2, md: 3 },
            py: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            backdropFilter: 'blur(16px)',
            bgcolor: alpha(theme.palette.background.paper, 0.92),
            zIndex: 11
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ maxWidth: 720, mx: 'auto' }}
          >
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={handleBack}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Back
            </Button>

            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {phase === 'review' ? 'Press Enter to submit' : 'Press Enter to continue'}
            </Typography>

            {phase === 'review' ? (
              <Button
                variant="contained"
                size="large"
                endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                disabled={submitting || survey.status !== 'active'}
                onClick={handleSubmit}
                sx={{
                  borderRadius: 3,
                  px: 3,
                  fontWeight: 700,
                  textTransform: 'none'
                }}
              >
                {submitting ? 'Submitting…' : 'Submit survey'}
              </Button>
            ) : (
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                onClick={handleNext}
                sx={{
                  borderRadius: 3,
                  px: 3,
                  fontWeight: 700,
                  textTransform: 'none'
                }}
              >
                {currentIndex === sortedQuestions.length - 1 ? 'Review' : 'Next'}
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      {phase === 'intro' && (
        <Box sx={{ textAlign: 'center', pb: 4 }}>
          <Typography variant="caption" color="text.secondary">
            Your responses are confidential
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default SurveyRespond;
