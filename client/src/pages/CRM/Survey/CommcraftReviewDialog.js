import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Save as SaveIcon,
  FactCheck as ReviewIcon
} from '@mui/icons-material';
import surveyService from '../../../services/surveyService';

const ACCENT = '#1565C0';
const ACCENT_LIGHT = '#E3F2FD';
const BORDER = '1px solid #e0e7ef';

const RISK_OPTIONS = [
  { value: 'Low', color: '#16A34A', bg: '#DCFCE7' },
  { value: 'Medium', color: '#D97706', bg: '#FEF3C7' },
  { value: 'High', color: '#DC2626', bg: '#FEE2E2' }
];

const ACTION_OPTIONS = [
  { value: 'Immediate', color: '#DC2626', bg: '#FEE2E2' },
  { value: 'This Month', color: '#2563EB', bg: '#DBEAFE' },
  { value: 'Monitor Only', color: '#64748B', bg: '#F1F5F9' }
];

const EMPTY_FORM = {
  crossCompanyObservations: '',
  requiredFollowUp: '',
  riskLevel: null,
  actionRequired: null
};

const SectionCard = ({ title, subtitle, children }) => (
  <Paper
    elevation={0}
    sx={{
      height: '100%',
      border: BORDER,
      borderRadius: 2,
      overflow: 'hidden',
      bgcolor: '#fff',
      display: 'flex',
      flexDirection: 'column'
    }}
  >
    <Box
      sx={{
        px: 2,
        py: 1.25,
        borderBottom: BORDER,
        background: `linear-gradient(135deg, ${ACCENT_LIGHT} 0%, #fff 100%)`
      }}
    >
      <Typography sx={{ color: ACCENT, fontWeight: 700, fontSize: '0.95rem' }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
    <Box sx={{ p: 2, flex: 1 }}>{children}</Box>
  </Paper>
);

const OptionTile = ({ label, selected, onSelect, color, bg }) => (
  <Box
    onClick={onSelect}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') onSelect();
    }}
    sx={{
      px: 1.5,
      py: 1.25,
      borderRadius: 2,
      border: selected ? `2px solid ${color}` : BORDER,
      bgcolor: selected ? bg : '#fafbfc',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      transition: 'all 0.18s ease',
      '&:hover': {
        borderColor: color,
        bgcolor: selected ? bg : '#f8fafc',
        boxShadow: `0 4px 12px ${color}18`
      }
    }}
  >
    <Typography fontWeight={selected ? 700 : 600} sx={{ color: selected ? color : '#475569' }}>
      {label}
    </Typography>
    {selected && <CheckCircleIcon sx={{ fontSize: 20, color }} />}
  </Box>
);

const CommcraftReviewDialog = ({ open, survey, onClose, onSaved }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);

  const loadReview = useCallback(async () => {
    if (!survey?._id) return;
    setLoading(true);
    setError('');
    try {
      const res = await surveyService.getCommcraftReview(survey._id);
      const review = res.data?.data?.review || EMPTY_FORM;
      setForm({
        crossCompanyObservations: review.crossCompanyObservations || '',
        requiredFollowUp: review.requiredFollowUp || '',
        riskLevel: review.riskLevel || null,
        actionRequired: review.actionRequired || null
      });
      setMeta(res.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load Commcraft review');
      setForm(EMPTY_FORM);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [survey?._id]);

  useEffect(() => {
    if (open && survey?._id) {
      loadReview();
    } else if (!open) {
      setForm(EMPTY_FORM);
      setError('');
      setMeta(null);
    }
  }, [open, survey?._id, loadReview]);

  const handleSave = async () => {
    if (!survey?._id) return;
    setSaving(true);
    setError('');
    try {
      await surveyService.saveCommcraftReview(survey._id, form);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save Commcraft review');
    } finally {
      setSaving(false);
    }
  };

  const reviewedByName = meta?.review?.reviewedBy
    ? `${meta.review.reviewedBy.firstName || ''} ${meta.review.reviewedBy.lastName || ''}`.trim()
    : '';

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, overflow: 'hidden' }
      }}
    >
      <Box
        sx={{
          px: 3,
          py: 2,
          background: `linear-gradient(135deg, ${ACCENT} 0%, #1976D2 55%, #42A5F5 100%)`,
          color: '#fff'
        }}
      >
        <Stack direction="row" alignItems="flex-start" spacing={1.5}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ReviewIcon />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="overline" sx={{ opacity: 0.9, fontWeight: 700, letterSpacing: 1.2 }}>
              COMMCRAFT REVIEW SECTION
            </Typography>
            <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.3 }}>
              {survey?.title || 'Survey review'}
            </Typography>
            {meta?.responseCount != null && (
              <Chip
                size="small"
                label={`${meta.responseCount} response(s) received`}
                sx={{
                  mt: 0.75,
                  bgcolor: 'rgba(255,255,255,0.22)',
                  color: '#fff',
                  fontWeight: 600,
                  border: '1px solid rgba(255,255,255,0.35)'
                }}
              />
            )}
          </Box>
        </Stack>
      </Box>

      <DialogContent sx={{ bgcolor: '#f8fafc', pt: 2.5 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress size={32} sx={{ color: ACCENT }} />
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <SectionCard title="Cross-Company Observations" subtitle="Summary of insights across companies">
                  <TextField
                    fullWidth
                    multiline
                    minRows={8}
                    value={form.crossCompanyObservations}
                    onChange={(e) => setForm((prev) => ({ ...prev, crossCompanyObservations: e.target.value }))}
                    placeholder="Enter cross-company observations, patterns, and key findings…"
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#fff',
                        borderRadius: 1.5,
                        fontSize: '0.95rem',
                        lineHeight: 1.7
                      }
                    }}
                  />
                </SectionCard>
              </Grid>

              <Grid item xs={12} md={6}>
                <SectionCard title="Required Follow-up" subtitle="Actions and next steps to pursue">
                  <TextField
                    fullWidth
                    multiline
                    minRows={8}
                    value={form.requiredFollowUp}
                    onChange={(e) => setForm((prev) => ({ ...prev, requiredFollowUp: e.target.value }))}
                    placeholder="Describe follow-up items, owners, and timelines…"
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#fff',
                        borderRadius: 1.5,
                        fontSize: '0.95rem',
                        lineHeight: 1.7
                      }
                    }}
                  />
                </SectionCard>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <SectionCard title="Risk Level" subtitle="Select one assessment">
                  <Stack spacing={1}>
                    {RISK_OPTIONS.map((option) => (
                      <OptionTile
                        key={option.value}
                        label={option.value}
                        color={option.color}
                        bg={option.bg}
                        selected={form.riskLevel === option.value}
                        onSelect={() => setForm((prev) => ({
                          ...prev,
                          riskLevel: prev.riskLevel === option.value ? null : option.value
                        }))}
                      />
                    ))}
                  </Stack>
                </SectionCard>
              </Grid>

              <Grid item xs={12} md={6}>
                <SectionCard title="Action Required" subtitle="Select one priority">
                  <Stack spacing={1}>
                    {ACTION_OPTIONS.map((option) => (
                      <OptionTile
                        key={option.value}
                        label={option.value}
                        color={option.color}
                        bg={option.bg}
                        selected={form.actionRequired === option.value}
                        onSelect={() => setForm((prev) => ({
                          ...prev,
                          actionRequired: prev.actionRequired === option.value ? null : option.value
                        }))}
                      />
                    ))}
                  </Stack>
                </SectionCard>
              </Grid>
            </Grid>
          </Stack>
        )}

        {meta?.review?.reviewedAt && !loading && (
          <Paper
            elevation={0}
            sx={{
              mt: 2,
              px: 2,
              py: 1,
              borderRadius: 1.5,
              border: BORDER,
              bgcolor: '#fff'
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Last saved {new Date(meta.review.reviewedAt).toLocaleString()}
              {reviewedByName ? ` · ${reviewedByName}` : ''}
            </Typography>
          </Paper>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#fff', borderTop: BORDER }}>
        <Button onClick={onClose} disabled={saving} sx={{ fontWeight: 600 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || loading}
          sx={{
            fontWeight: 700,
            px: 2.5,
            bgcolor: ACCENT,
            '&:hover': { bgcolor: '#0D47A1' }
          }}
        >
          Save review
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CommcraftReviewDialog;
