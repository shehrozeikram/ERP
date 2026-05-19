import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  FormControlLabel,
  Switch
} from '@mui/material';
import { Campaign as CampaignIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import {
  fetchRecoveryCampaigns,
  createRecoveryCampaign,
  updateRecoveryCampaign,
  deleteRecoveryCampaign,
  fetchRecoveryFollowUpSettings,
  saveRecoveryFollowUpSettings,
  runRecoveryFollowUpNow
} from '../../../services/recoveryCampaignService';

const getCreatedByName = (doc) => {
  const u = doc.createdBy;
  if (!u) return '—';
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.employeeId || '—';
};

const WHATSAPP_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'en_AE', label: 'English (UAE)' },
  { code: 'en_AU', label: 'English (AUS)' },
  { code: 'en_CA', label: 'English (CAN)' },
  { code: 'en_GH', label: 'English (GHA)' },
  { code: 'en_IE', label: 'English (IRL)' },
  { code: 'en_IN', label: 'English (IND)' },
  { code: 'en_MY', label: 'English (MYS)' },
  { code: 'en_NZ', label: 'English (NZL)' },
  { code: 'en_SG', label: 'English (SGP)' },
  { code: 'ur', label: 'Urdu' },
  { code: 'ar', label: 'Arabic' },
  { code: 'bn', label: 'Bengali' },
  { code: 'hi', label: 'Hindi' },
  { code: 'pa', label: 'Punjabi' }
];

const formatDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en', { day: '2-digit', month: 'short', year: 'numeric' });
};

const RecoveryCampaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [form, setForm] = useState({
    whatsappTemplateName: '',
    whatsappLanguageCode: '',
    messagePreview: '',
    followUpCampaignId: ''
  });
  const [followUp, setFollowUp] = useState({
    enabled: false,
    defaultCampaignId: '',
    delayHours: 14
  });
  const [rowFollowUpSaving, setRowFollowUpSaving] = useState(null);
  const [followUpMeta, setFollowUpMeta] = useState(null);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [followUpRunning, setFollowUpRunning] = useState(false);

  const loadFollowUpSettings = useCallback(async () => {
    try {
      const res = await fetchRecoveryFollowUpSettings();
      const data = res.data?.data || {};
      setFollowUp({
        enabled: !!data.enabled,
        defaultCampaignId: data.campaignId?._id || data.campaignId || '',
        delayHours: data.delayHours ?? 14
      });
      setFollowUpMeta({
        lastRunAt: data.lastRunAt,
        lastRunSentCount: data.lastRunSentCount,
        lastRunSkippedCount: data.lastRunSkippedCount,
        lastRunError: data.lastRunError
      });
    } catch {
      setFollowUpMeta(null);
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetchRecoveryCampaigns();
      setCampaigns(res.data?.data || []);
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to load campaigns', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
    loadFollowUpSettings();
  }, [loadCampaigns, loadFollowUpSettings]);

  const handleSaveFollowUp = async () => {
    try {
      setFollowUpSaving(true);
      const res = await saveRecoveryFollowUpSettings({
        enabled: followUp.enabled,
        campaignId: followUp.defaultCampaignId || null,
        delayHours: Number(followUp.delayHours) || 14
      });
      setSnackbar({ open: true, message: 'Automatic follow-up settings saved', severity: 'success' });
      const data = res.data?.data || {};
      setFollowUpMeta({
        lastRunAt: data.lastRunAt,
        lastRunSentCount: data.lastRunSentCount,
        lastRunSkippedCount: data.lastRunSkippedCount,
        lastRunError: data.lastRunError
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to save follow-up settings',
        severity: 'error'
      });
    } finally {
      setFollowUpSaving(false);
    }
  };

  const handleRunFollowUpNow = async () => {
    try {
      setFollowUpRunning(true);
      const res = await runRecoveryFollowUpNow();
      const d = res.data?.data || {};
      if (d.skipped && d.reason === 'disabled') {
        setSnackbar({ open: true, message: 'Enable automatic follow-up and save first', severity: 'warning' });
      } else if (d.skipped && d.reason === 'no_mappings') {
        setSnackbar({
          open: true,
          message: 'Set a follow-up on each campaign (table below) or choose a default fallback',
          severity: 'warning'
        });
      } else {
        setSnackbar({
          open: true,
          message: `Run complete: ${d.sent ?? 0} sent, ${d.skippedCount ?? 0} skipped`,
          severity: 'success'
        });
      }
      loadFollowUpSettings();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Run failed', severity: 'error' });
    } finally {
      setFollowUpRunning(false);
    }
  };

  const activeCampaignOptions = campaigns.filter((c) => c.isActive !== false && c.whatsappTemplateName);

  const getFollowUpLabel = (c) => {
    const fu = c.followUpCampaignId;
    if (!fu) return null;
    const id = fu._id || fu;
    const match = campaigns.find((x) => x._id === id);
    return match?.whatsappTemplateName || '—';
  };

  const handleRowFollowUpChange = async (campaignId, followUpCampaignId) => {
    try {
      setRowFollowUpSaving(campaignId);
      await updateRecoveryCampaign(campaignId, {
        followUpCampaignId: followUpCampaignId || null
      });
      await loadCampaigns();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to update follow-up',
        severity: 'error'
      });
    } finally {
      setRowFollowUpSaving(null);
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({ whatsappTemplateName: '', whatsappLanguageCode: '', messagePreview: '', followUpCampaignId: '' });
    setDialogOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditingId(c._id);
    setForm({
      whatsappTemplateName: c.whatsappTemplateName || '',
      whatsappLanguageCode: c.whatsappLanguageCode || '',
      messagePreview: c.messagePreview || '',
      followUpCampaignId: c.followUpCampaignId?._id || c.followUpCampaignId || ''
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.whatsappTemplateName?.trim()) {
      setSnackbar({ open: true, message: 'WhatsApp template name (Meta) is required', severity: 'warning' });
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await updateRecoveryCampaign(editingId, {
          whatsappTemplateName: form.whatsappTemplateName.trim(),
          whatsappLanguageCode: form.whatsappLanguageCode?.trim() || '',
          messagePreview: form.messagePreview?.trim() || '',
          followUpCampaignId: form.followUpCampaignId || null
        });
        setSnackbar({ open: true, message: 'Campaign updated', severity: 'success' });
      } else {
        await createRecoveryCampaign({
          whatsappTemplateName: form.whatsappTemplateName.trim(),
          whatsappLanguageCode: form.whatsappLanguageCode?.trim() || '',
          messagePreview: form.messagePreview?.trim() || '',
          followUpCampaignId: form.followUpCampaignId || null
        });
        setSnackbar({ open: true, message: 'Campaign created', severity: 'success' });
      }
      handleCloseDialog();
      loadCampaigns();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to save campaign', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this campaign?')) return;
    try {
      await deleteRecoveryCampaign(id);
      setSnackbar({ open: true, message: 'Campaign deleted', severity: 'success' });
      loadCampaigns();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to delete', severity: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CampaignIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" fontWeight={600}>
            Campaigns
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd} disabled={loading}>
          Add campaign
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Create Meta WhatsApp templates here. Use the exact template name and language code from your Meta Business account. Recovery members can select a campaign to send via WhatsApp API from My Tasks.
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ScheduleIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Automatic session follow-up (My Tasks)
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            If a customer has no reply after your message, WhatsApp&apos;s 24-hour window closes. Enable this to send a
            <strong> follow-up template per campaign</strong> (set in the table below) after the delay — only when they have not replied.
            Use the default fallback only when the original campaign has no follow-up assigned.
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={followUp.enabled}
                onChange={(e) => setFollowUp((f) => ({ ...f, enabled: e.target.checked }))}
              />
            }
            label="Enable automatic follow-up"
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2, alignItems: 'flex-start' }}>
            <FormControl size="small" sx={{ minWidth: 280 }} disabled={!followUp.enabled}>
              <InputLabel>Default fallback follow-up</InputLabel>
              <Select
                label="Default fallback follow-up"
                value={followUp.defaultCampaignId}
                onChange={(e) => setFollowUp((f) => ({ ...f, defaultCampaignId: e.target.value }))}
              >
                <MenuItem value="">— None —</MenuItem>
                {activeCampaignOptions.map((c) => (
                  <MenuItem key={c._id} value={c._id}>
                    {c.whatsappTemplateName}
                    {c.messagePreview ? ` — ${String(c.messagePreview).slice(0, 40)}` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="number"
              label="Hours after send"
              value={followUp.delayHours}
              onChange={(e) => setFollowUp((f) => ({ ...f, delayHours: e.target.value }))}
              disabled={!followUp.enabled}
              inputProps={{ min: 1, max: 23 }}
              sx={{ width: 140 }}
              helperText="1–23 (default 14)"
            />
            <Button variant="contained" onClick={handleSaveFollowUp} disabled={followUpSaving}>
              {followUpSaving ? <CircularProgress size={22} /> : 'Save settings'}
            </Button>
            <Button variant="outlined" onClick={handleRunFollowUpNow} disabled={followUpRunning}>
              {followUpRunning ? <CircularProgress size={22} /> : 'Run now'}
            </Button>
          </Box>
          {followUpMeta?.lastRunAt && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              Last run: {formatDate(followUpMeta.lastRunAt)} — sent {followUpMeta.lastRunSentCount ?? 0}, skipped{' '}
              {followUpMeta.lastRunSkippedCount ?? 0}
              {followUpMeta.lastRunError ? ` · Error: ${followUpMeta.lastRunError}` : ''}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : campaigns.length === 0 ? (
            <Typography color="text.secondary">No campaigns yet. Click <strong>Add campaign</strong> to create a Meta WhatsApp template.</Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Template name (Meta)</strong></TableCell>
                    <TableCell><strong>Language</strong></TableCell>
                    <TableCell><strong>Message preview</strong></TableCell>
                    <TableCell><strong>Auto follow-up</strong></TableCell>
                    <TableCell><strong>Created by</strong></TableCell>
                    <TableCell><strong>Created</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow key={c._id}>
                      <TableCell><Typography fontWeight={500}>{c.whatsappTemplateName || '—'}</Typography></TableCell>
                      <TableCell>{c.whatsappLanguageCode || '—'}</TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {String(c.messagePreview || '').trim() || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 220 }}>
                        <FormControl size="small" fullWidth disabled={rowFollowUpSaving === c._id}>
                          <Select
                            displayEmpty
                            value={c.followUpCampaignId?._id || c.followUpCampaignId || ''}
                            onChange={(e) => handleRowFollowUpChange(c._id, e.target.value)}
                            renderValue={(v) => {
                              if (!v) return <Typography variant="body2" color="text.secondary">— None —</Typography>;
                              const match = campaigns.find((x) => x._id === v);
                              return match?.whatsappTemplateName || getFollowUpLabel(c) || '—';
                            }}
                          >
                            <MenuItem value="">— None —</MenuItem>
                            {activeCampaignOptions
                              .filter((opt) => opt._id !== c._id)
                              .map((opt) => (
                                <MenuItem key={opt._id} value={opt._id}>
                                  {opt.whatsappTemplateName}
                                </MenuItem>
                              ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>{getCreatedByName(c)}</TableCell>
                      <TableCell>{formatDate(c.createdAt)}</TableCell>
                      <TableCell><Chip size="small" label={c.isActive !== false ? 'Active' : 'Inactive'} color={c.isActive !== false ? 'success' : 'default'} variant="outlined" /></TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleOpenEdit(c)} title="Edit">
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(c._id)} title="Delete">
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit campaign' : 'Add campaign'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="WhatsApp template name (Meta)"
            required
            value={form.whatsappTemplateName}
            onChange={(e) => setForm((f) => ({ ...f, whatsappTemplateName: e.target.value }))}
            margin="normal"
            placeholder="Exact Meta template name, e.g. taj_marketing_offer"
          />
          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Language</InputLabel>
            <Select
              label="Language"
              value={form.whatsappLanguageCode}
              onChange={(e) => setForm((f) => ({ ...f, whatsappLanguageCode: e.target.value || '' }))}
            >
              <MenuItem value="">— Select language —</MenuItem>
              {WHATSAPP_LANGUAGES.map(({ code, label }) => (
                <MenuItem key={code} value={code}>{label} ({code})</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Message preview shown in replies"
            value={form.messagePreview}
            onChange={(e) => setForm((f) => ({ ...f, messagePreview: e.target.value }))}
            margin="normal"
            multiline
            minRows={3}
            placeholder="Write the exact campaign message text you want visible in View replies."
          />
          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Auto follow-up campaign</InputLabel>
            <Select
              label="Auto follow-up campaign"
              value={form.followUpCampaignId}
              onChange={(e) => setForm((f) => ({ ...f, followUpCampaignId: e.target.value }))}
            >
              <MenuItem value="">— None —</MenuItem>
              {activeCampaignOptions
                .filter((opt) => opt._id !== editingId)
                .map((opt) => (
                  <MenuItem key={opt._id} value={opt._id}>
                    {opt.whatsappTemplateName}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Sent automatically if no reply after the delay (when auto follow-up is enabled).
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={24} /> : (editingId ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RecoveryCampaigns;
