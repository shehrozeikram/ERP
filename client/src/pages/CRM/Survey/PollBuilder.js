import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
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
  HowToVote as PollIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import surveyService from '../../../services/surveyService';

const newPollQuestion = () => ({
  key: `q_${Date.now()}`,
  type: 'single_choice',
  label: '',
  description: '',
  required: true,
  options: [
    { label: 'Option 1', value: 'option_1' },
    { label: 'Option 2', value: 'option_2' }
  ],
  order: 0
});

const PollBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    closesAt: '',
    showResultsToVoters: true,
    question: newPollQuestion()
  });

  const loadPoll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await surveyService.getSurvey(id);
      const poll = res.data?.data;
      if (poll.kind !== 'poll') {
        navigate(`/crm/survey/${id}/edit`, { replace: true });
        return;
      }
      const q = poll.questions?.[0] || newPollQuestion();
      setForm({
        title: poll.title || '',
        description: poll.description || '',
        closesAt: poll.closesAt ? poll.closesAt.slice(0, 10) : '',
        showResultsToVoters: poll.showResultsToVoters !== false,
        question: q
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load poll');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadPoll();
  }, [loadPoll]);

  const updateQuestion = (patch) => {
    setForm((prev) => ({ ...prev, question: { ...prev.question, ...patch } }));
  };

  const addOption = () => {
    const next = (form.question.options?.length || 0) + 1;
    updateQuestion({
      options: [...(form.question.options || []), { label: `Option ${next}`, value: `option_${next}` }]
    });
  };

  const removeOption = (index) => {
    if ((form.question.options?.length || 0) <= 2) return;
    updateQuestion({
      options: form.question.options.filter((_, i) => i !== index)
    });
  };

  const buildPayload = () => ({
    title: form.title.trim(),
    description: form.description.trim(),
    kind: 'poll',
    status: 'draft',
    showResultsToVoters: form.showResultsToVoters,
    closesAt: form.closesAt ? form.closesAt : null,
    allowMultipleResponses: false,
    questions: [{
      ...form.question,
      required: true,
      options: form.question.type === 'yes_no'
        ? []
        : form.question.options.map((opt, i) => ({
          label: opt.label,
          value: opt.value || `option_${i + 1}`
        }))
    }]
  });

  const handleSave = async () => {
    setError('');
    if (!form.title.trim()) {
      setError('Poll title is required');
      return;
    }
    if (!form.question.label.trim()) {
      setError('Poll question is required');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await surveyService.updateSurvey(id, buildPayload());
      } else {
        await surveyService.createSurvey(buildPayload());
      }
      navigate('/crm/survey', { state: { message: 'Poll saved. Use Send to assign voters.' } });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save poll');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Typography sx={{ p: 3 }}>Loading poll…</Typography>;
  }

  const question = form.question;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 720, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/crm/survey')}>
          <ArrowBackIcon />
        </IconButton>
        <PollIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
          {isEdit ? 'Edit Poll' : 'Create Poll'}
        </Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Alert severity="info" sx={{ mb: 2 }}>
        Polls are quick — one question, instant results. Save first, then send to users from Manage Surveys.
      </Alert>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Poll details</Typography>
        <Stack spacing={2}>
          <TextField
            label="Poll title"
            required
            fullWidth
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
          <TextField
            label="Description (optional)"
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
                checked={form.showResultsToVoters}
                onChange={(e) => setForm((p) => ({ ...p, showResultsToVoters: e.target.checked }))}
              />
            )}
            label="Show live results to voters after they vote"
          />
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Poll question</Typography>
        <Stack spacing={2}>
          <TextField
            label="Question"
            required
            fullWidth
            placeholder="e.g. Which team building activity do you prefer?"
            value={question.label}
            onChange={(e) => updateQuestion({ label: e.target.value })}
          />
          <FormControl fullWidth>
            <InputLabel>Answer type</InputLabel>
            <Select
              label="Answer type"
              value={question.type}
              onChange={(e) => updateQuestion({
                type: e.target.value,
                options: e.target.value === 'yes_no'
                  ? []
                  : question.options?.length
                    ? question.options
                    : [{ label: 'Option 1', value: 'option_1' }, { label: 'Option 2', value: 'option_2' }]
              })}
            >
              <MenuItem value="single_choice">Multiple options (pick one)</MenuItem>
              <MenuItem value="yes_no">Yes / No</MenuItem>
            </Select>
          </FormControl>

          {question.type === 'single_choice' && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Options</Typography>
              <Stack spacing={1}>
                {(question.options || []).map((opt, index) => (
                  <Stack key={`opt-${index}`} direction="row" spacing={1} alignItems="center">
                    <TextField
                      fullWidth
                      size="small"
                      label={`Option ${index + 1}`}
                      value={opt.label}
                      onChange={(e) => {
                        const options = [...question.options];
                        options[index] = {
                          label: e.target.value,
                          value: e.target.value.toLowerCase().replace(/\s+/g, '_') || `option_${index + 1}`
                        };
                        updateQuestion({ options });
                      }}
                    />
                    <IconButton
                      size="small"
                      color="error"
                      disabled={(question.options?.length || 0) <= 2}
                      onClick={() => removeOption(index)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
                <Button size="small" startIcon={<AddIcon />} onClick={addOption} sx={{ alignSelf: 'flex-start' }}>
                  Add option
                </Button>
              </Stack>
            </Box>
          )}
        </Stack>
      </Paper>

      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" startIcon={<SaveIcon />} disabled={saving} onClick={handleSave}>
          Save poll
        </Button>
      </Stack>
    </Box>
  );
};

export default PollBuilder;
