import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import surveyService from '../../../services/surveyService';
import SurveySectionHeader from './SurveySectionHeader';
import {
  countSectionQuestions,
  legacyQuestionsToSections,
  newQuestion,
  newSection
} from '../../../utils/surveySections';

const QUESTION_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'single_choice', label: 'Single choice' },
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'rating', label: 'Rating scale' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'date', label: 'Date' }
];

const SurveyBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    sections: [newSection(0)],
    closesAt: '',
    allowMultipleResponses: false
  });

  const loadSurvey = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await surveyService.getSurvey(id);
      const survey = res.data?.data;
      const sections = survey.sections?.length
        ? survey.sections
        : legacyQuestionsToSections(survey.questions || []);

      setForm({
        title: survey.title || '',
        description: survey.description || '',
        sections: sections.length ? sections : [newSection(0)],
        closesAt: survey.closesAt ? survey.closesAt.slice(0, 10) : '',
        allowMultipleResponses: Boolean(survey.allowMultipleResponses)
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load survey');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  const updateSection = (sectionIndex, patch) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((section, index) => (
        index === sectionIndex ? { ...section, ...patch } : section
      ))
    }));
  };

  const updateQuestion = (sectionIndex, questionIndex, patch) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIdx) => {
        if (sIdx !== sectionIndex) return section;
        return {
          ...section,
          questions: section.questions.map((question, qIdx) => (
            qIdx === questionIndex ? { ...question, ...patch } : question
          ))
        };
      })
    }));
  };

  const addSection = () => {
    setForm((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection(prev.sections.length)]
    }));
  };

  const removeSection = (sectionIndex) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, index) => index !== sectionIndex)
    }));
  };

  const addQuestion = (sectionIndex) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((section, index) => {
        if (index !== sectionIndex) return section;
        return {
          ...section,
          questions: [...section.questions, newQuestion(section.questions.length)]
        };
      })
    }));
  };

  const removeQuestion = (sectionIndex, questionIndex) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIdx) => {
        if (sIdx !== sectionIndex) return section;
        return {
          ...section,
          questions: section.questions.filter((_, qIdx) => qIdx !== questionIndex)
        };
      })
    }));
  };

  const addOption = (sectionIndex, questionIndex) => {
    const question = form.sections[sectionIndex]?.questions?.[questionIndex];
    if (!question) return;
    const next = (question.options?.length || 0) + 1;
    updateQuestion(sectionIndex, questionIndex, {
      options: [...(question.options || []), { label: `Option ${next}`, value: `option_${next}` }]
    });
  };

  const buildPayload = () => ({
    title: form.title.trim(),
    description: form.description.trim(),
    status: 'draft',
    sections: form.sections.map((section, sectionIndex) => ({
      ...section,
      title: section.title.trim() || `Section ${sectionIndex + 1}`,
      order: sectionIndex,
      questions: section.questions.map((question, questionIndex) => ({
        ...question,
        order: questionIndex,
        options: ['single_choice', 'multiple_choice'].includes(question.type) ? question.options : []
      }))
    })),
    closesAt: form.closesAt ? form.closesAt : null,
    allowMultipleResponses: form.allowMultipleResponses
  });

  const handleSave = async () => {
    setError('');
    if (!form.title.trim()) {
      setError('Survey title is required');
      return;
    }
    if (!form.sections.length) {
      setError('Add at least one section');
      return;
    }
    if (!form.sections.every((section) => String(section.title || '').trim())) {
      setError('Each section needs a title');
      return;
    }
    if (countSectionQuestions(form.sections) === 0) {
      setError('Add at least one question with a label');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await surveyService.updateSurvey(id, buildPayload());
      } else {
        await surveyService.createSurvey(buildPayload());
      }
      navigate('/crm/survey', {
        state: { message: 'Survey saved. Use the Send icon to assign users.' }
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save survey');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Typography sx={{ p: 3 }}>Loading survey…</Typography>;
  }

  const validQuestionCount = countSectionQuestions(form.sections);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/crm/survey')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={700}>
          {isEdit ? 'Edit Survey' : 'Create Market Intelligence Form'}
        </Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>1. Survey details</Typography>
        <Stack spacing={2}>
          <TextField
            label="Title"
            required
            fullWidth
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            minRows={2}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          <TextField
            label="Close date (optional)"
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={form.closesAt}
            onChange={(e) => setForm((p) => ({ ...p, closesAt: e.target.value }))}
          />
          <FormControlLabel
            control={(
              <Switch
                checked={form.allowMultipleResponses}
                onChange={(e) => setForm((p) => ({ ...p, allowMultipleResponses: e.target.checked }))}
              />
            )}
            label="Allow users to submit multiple times"
          />
        </Stack>
      </Paper>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6">2. Sections &amp; questions ({validQuestionCount})</Typography>
          <Typography variant="body2" color="text.secondary">
            Group questions under each section, like the monthly intelligence report layout.
          </Typography>
        </Box>
        <Button startIcon={<AddIcon />} onClick={addSection}>Add section</Button>
      </Stack>

      <Stack spacing={3} sx={{ mb: 3 }}>
        {form.sections.map((section, sectionIndex) => (
          <Paper key={section.key} variant="outlined" sx={{ overflow: 'hidden' }}>
            <SurveySectionHeader
              sectionNumber={sectionIndex + 1}
              title={section.title || `Section ${sectionIndex + 1}`}
              subtitle={`${section.questions.length} question${section.questions.length === 1 ? '' : 's'}`}
            />

            <Box sx={{ p: 2.5 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <TextField
                  label="Section title"
                  required
                  fullWidth
                  placeholder="e.g. Customer & Stakeholder Intelligence"
                  value={section.title}
                  onChange={(e) => updateSection(sectionIndex, { title: e.target.value })}
                />
                <IconButton
                  color="error"
                  disabled={form.sections.length === 1}
                  onClick={() => removeSection(sectionIndex)}
                  aria-label="Remove section"
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>

              <Stack spacing={2}>
                {section.questions.map((question, questionIndex) => (
                  <Card key={question.key} variant="outlined">
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                        <DragIcon color="disabled" fontSize="small" />
                        <Chip size="small" label={`Q${questionIndex + 1}`} />
                        <Box sx={{ flex: 1 }} />
                        <IconButton
                          size="small"
                          color="error"
                          disabled={section.questions.length === 1}
                          onClick={() => removeQuestion(sectionIndex, questionIndex)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>

                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth>
                            <InputLabel>Question type</InputLabel>
                            <Select
                              label="Question type"
                              value={question.type}
                              onChange={(e) => updateQuestion(sectionIndex, questionIndex, { type: e.target.value })}
                            >
                              {QUESTION_TYPES.map((t) => (
                                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={(
                              <Switch
                                checked={question.required}
                                onChange={(e) => updateQuestion(sectionIndex, questionIndex, { required: e.target.checked })}
                              />
                            )}
                            label="Required"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Question"
                            fullWidth
                            required
                            multiline
                            minRows={2}
                            placeholder="What were the most common customer concerns this month?"
                            value={question.label}
                            onChange={(e) => updateQuestion(sectionIndex, questionIndex, { label: e.target.value })}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Help text (optional)"
                            fullWidth
                            value={question.description}
                            onChange={(e) => updateQuestion(sectionIndex, questionIndex, { description: e.target.value })}
                          />
                        </Grid>

                        {['single_choice', 'multiple_choice'].includes(question.type) && (
                          <Grid item xs={12}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Options</Typography>
                            <Stack spacing={1}>
                              {(question.options || []).map((opt, optIndex) => (
                                <TextField
                                  key={`${question.key}-opt-${optIndex}`}
                                  size="small"
                                  fullWidth
                                  label={`Option ${optIndex + 1}`}
                                  value={opt.label}
                                  onChange={(e) => {
                                    const options = [...question.options];
                                    options[optIndex] = {
                                      label: e.target.value,
                                      value: e.target.value.toLowerCase().replace(/\s+/g, '_') || `option_${optIndex + 1}`
                                    };
                                    updateQuestion(sectionIndex, questionIndex, { options });
                                  }}
                                />
                              ))}
                              <Button size="small" onClick={() => addOption(sectionIndex, questionIndex)}>
                                Add option
                              </Button>
                            </Stack>
                          </Grid>
                        )}

                        {question.type === 'rating' && (
                          <>
                            <Grid item xs={6}>
                              <TextField
                                label="Min"
                                type="number"
                                fullWidth
                                value={question.min}
                                onChange={(e) => updateQuestion(sectionIndex, questionIndex, { min: Number(e.target.value) })}
                              />
                            </Grid>
                            <Grid item xs={6}>
                              <TextField
                                label="Max"
                                type="number"
                                fullWidth
                                value={question.max}
                                onChange={(e) => updateQuestion(sectionIndex, questionIndex, { max: Number(e.target.value) })}
                              />
                            </Grid>
                          </>
                        )}
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
              </Stack>

              <Button
                startIcon={<AddIcon />}
                sx={{ mt: 2 }}
                onClick={() => addQuestion(sectionIndex)}
              >
                Add question to this section
              </Button>
            </Box>
          </Paper>
        ))}
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        After saving, go to <strong>Manage Surveys</strong> and use the <strong>Send</strong> icon to
        select users and deliver the complete survey ({validQuestionCount} questions in {form.sections.length} section{form.sections.length === 1 ? '' : 's'}).
      </Alert>

      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={saving}
          onClick={handleSave}
        >
          Save survey
        </Button>
      </Stack>
    </Box>
  );
};

export default SurveyBuilder;
