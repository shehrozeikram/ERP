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

const newQuestion = (order = 0) => ({
  key: `q_${Date.now()}_${order}`,
  type: 'text',
  label: '',
  description: '',
  required: false,
  options: [{ label: 'Option 1', value: 'option_1' }],
  min: 1,
  max: 5,
  order
});

const SurveyBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'draft',
    questions: [newQuestion(0)],
    closesAt: '',
    allowMultipleResponses: false
  });

  const loadSurvey = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await surveyService.getSurvey(id);
      const survey = res.data?.data;
      setForm({
        title: survey.title || '',
        description: survey.description || '',
        status: survey.status || 'draft',
        questions: (survey.questions || []).length ? survey.questions : [newQuestion(0)],
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

  const updateQuestion = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? { ...q, ...patch } : q))
    }));
  };

  const addQuestion = () => {
    setForm((prev) => ({
      ...prev,
      questions: [...prev.questions, newQuestion(prev.questions.length)]
    }));
  };

  const removeQuestion = (index) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const addOption = (qIndex) => {
    const question = form.questions[qIndex];
    const next = (question.options?.length || 0) + 1;
    updateQuestion(qIndex, {
      options: [...(question.options || []), { label: `Option ${next}`, value: `option_${next}` }]
    });
  };

  const buildPayload = () => ({
    title: form.title.trim(),
    description: form.description.trim(),
    status: 'draft',
    questions: form.questions.map((q, index) => ({
      ...q,
      order: index,
      options: ['single_choice', 'multiple_choice'].includes(q.type) ? q.options : []
    })),
    closesAt: form.closesAt ? form.closesAt : null,
    allowMultipleResponses: form.allowMultipleResponses
  });

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!form.title.trim()) {
      setError('Survey title is required');
      return;
    }
    if (!form.questions.some((q) => q.label.trim())) {
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

  const validQuestionCount = form.questions.filter((q) => q.label.trim()).length;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/crm/survey')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={700}>
          {isEdit ? 'Edit Survey' : 'Create Survey'}
        </Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

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
        <Typography variant="h6">2. Questions ({validQuestionCount})</Typography>
        <Button startIcon={<AddIcon />} onClick={addQuestion}>Add question</Button>
      </Stack>

      <Stack spacing={2} sx={{ mb: 3 }}>
        {form.questions.map((question, index) => (
          <Card key={question.key} variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <DragIcon color="disabled" fontSize="small" />
                <Chip size="small" label={`Q${index + 1}`} />
                <Box sx={{ flex: 1 }} />
                <IconButton
                  size="small"
                  color="error"
                  disabled={form.questions.length === 1}
                  onClick={() => removeQuestion(index)}
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
                      onChange={(e) => updateQuestion(index, { type: e.target.value })}
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
                        onChange={(e) => updateQuestion(index, { required: e.target.checked })}
                      />
                    )}
                    label="Required"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Question label"
                    fullWidth
                    required
                    value={question.label}
                    onChange={(e) => updateQuestion(index, { label: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Help text (optional)"
                    fullWidth
                    value={question.description}
                    onChange={(e) => updateQuestion(index, { description: e.target.value })}
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
                            updateQuestion(index, { options });
                          }}
                        />
                      ))}
                      <Button size="small" onClick={() => addOption(index)}>Add option</Button>
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
                        onChange={(e) => updateQuestion(index, { min: Number(e.target.value) })}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        label="Max"
                        type="number"
                        fullWidth
                        value={question.max}
                        onChange={(e) => updateQuestion(index, { max: Number(e.target.value) })}
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        After saving, go to <strong>Manage Surveys</strong> and use the <strong>Send</strong> icon to
        select users and deliver the complete survey ({validQuestionCount} questions).
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
