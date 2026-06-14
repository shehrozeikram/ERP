import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  HowToVote as PollIcon
} from '@mui/icons-material';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { alpha, useTheme } from '@mui/material/styles';
import surveyService from '../../../services/surveyService';
import DynamicQuestionField from './DynamicQuestionField';

const POLL_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F97316', '#22C55E', '#06B6D4', '#3B82F6'];

const PollVote = ({ survey, surveyId }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const question = survey.questions?.[0];

  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [voted, setVoted] = useState(survey.hasResponded);
  const [results, setResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);

  const loadResults = useCallback(async () => {
    if (!survey.showResultsToVoters && !survey.canManage) return;
    setLoadingResults(true);
    try {
      const res = await surveyService.getPollResults(surveyId);
      setResults(res.data?.data);
    } catch {
      setResults(null);
    } finally {
      setLoadingResults(false);
    }
  }, [surveyId, survey.showResultsToVoters, survey.canManage]);

  useEffect(() => {
    if (voted || survey.hasResponded) {
      loadResults();
    }
  }, [voted, survey.hasResponded, loadResults]);

  useEffect(() => {
    if (survey.myResponse?.answers?.[0]) {
      setAnswer(survey.myResponse.answers[0].value);
    }
  }, [survey]);

  const handleVote = async () => {
    if (!question) return;
    if (!answer && answer !== 0) {
      setError('Please select an option');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await surveyService.submitResponse(surveyId, [{
        questionKey: question.key,
        value: answer
      }]);
      setVoted(true);
      await loadResults();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit vote');
    } finally {
      setSubmitting(false);
    }
  };

  const chartData = (results?.distribution || []).map((row, i) => ({
    name: row.label,
    votes: row.count,
    percent: row.percent,
    fill: POLL_COLORS[i % POLL_COLORS.length]
  }));

  return (
    <Box sx={{ minHeight: '80vh', bgcolor: alpha(theme.palette.primary.main, 0.03), py: { xs: 2, md: 4 } }}>
      <Box sx={{ maxWidth: 640, mx: 'auto', px: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/crm/survey/mine')} sx={{ mb: 2 }}>
          Back to My Surveys
        </Button>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'divider',
            mb: 3,
            textAlign: 'center',
            background: `linear-gradient(135deg, ${alpha('#6366F1', 0.12)} 0%, transparent 100%)`
          }}
        >
          <PollIcon sx={{ fontSize: 48, color: '#6366F1', mb: 1 }} />
          <Chip label="Quick Poll" size="small" color="primary" sx={{ mb: 1, fontWeight: 700 }} />
          <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>{survey.title}</Typography>
          {survey.description && (
            <Typography variant="body1" color="text.secondary">{survey.description}</Typography>
          )}
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!voted && !survey.hasResponded && question && (
          <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
            <DynamicQuestionField
              question={question}
              value={answer}
              onChange={(_, val) => setAnswer(val)}
              variant="wizard"
              disabled={submitting}
            />
            <Button
              variant="contained"
              size="large"
              fullWidth
              sx={{ mt: 3, py: 1.5, fontWeight: 700, borderRadius: 2 }}
              disabled={submitting || survey.status !== 'active'}
              onClick={handleVote}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <PollIcon />}
            >
              {submitting ? 'Submitting vote…' : 'Submit vote'}
            </Button>
          </Paper>
        )}

        {(voted || survey.hasResponded) && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2, borderRadius: 2 }}>
            Your vote has been recorded. Thank you!
          </Alert>
        )}

        {(survey.showResultsToVoters || survey.canManage) && (voted || survey.hasResponded || survey.canManage) && (
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Live results</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {results?.totalVotes || 0} total vote{(results?.totalVotes || 0) === 1 ? '' : 's'}
            </Typography>

            {loadingResults ? (
              <LinearProgress sx={{ my: 4 }} />
            ) : chartData.length > 0 ? (
              <>
                <Stack spacing={1.5} sx={{ mb: 3 }}>
                  {chartData.map((row) => (
                    <Box key={row.name}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.votes} ({row.percent}%)
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={row.percent}
                        sx={{
                          height: 10,
                          borderRadius: 5,
                          bgcolor: alpha(row.fill, 0.15),
                          '& .MuiLinearProgress-bar': { bgcolor: row.fill, borderRadius: 5 }
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(val) => [val, 'Votes']} />
                    <Bar dataKey="votes" radius={[8, 8, 0, 0]} maxBarSize={48}>
                      {chartData.map((row) => (
                        <Cell key={row.name} fill={row.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No votes yet. Results will appear here as people vote.
              </Typography>
            )}
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default PollVote;
