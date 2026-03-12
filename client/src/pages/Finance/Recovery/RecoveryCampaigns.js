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
  Alert,
  Snackbar,
  CircularProgress,
  Chip
} from '@mui/material';
import { Campaign as CampaignIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import {
  fetchRecoveryCampaigns,
  createRecoveryCampaign,
  updateRecoveryCampaign,
  deleteRecoveryCampaign
} from '../../../services/recoveryCampaignService';

const getCreatedByName = (doc) => {
  const u = doc.createdBy;
  if (!u) return '—';
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.employeeId || '—';
};

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
  const [form, setForm] = useState({ name: '', message: '' });

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
  }, [loadCampaigns]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({ name: '', message: '' });
    setDialogOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditingId(c._id);
    setForm({ name: c.name || '', message: c.message || '' });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      setSnackbar({ open: true, message: 'Campaign name is required', severity: 'warning' });
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await updateRecoveryCampaign(editingId, { name: form.name.trim(), message: form.message?.trim() || '' });
        setSnackbar({ open: true, message: 'Campaign updated', severity: 'success' });
      } else {
        await createRecoveryCampaign({ name: form.name.trim(), message: form.message?.trim() || '' });
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

  const handleCopyMessage = (message) => {
    if (!message?.trim()) {
      setSnackbar({ open: true, message: 'No message to copy', severity: 'warning' });
      return;
    }
    navigator.clipboard.writeText(message).then(
      () => setSnackbar({ open: true, message: 'Message copied to clipboard. Paste in WhatsApp to send.', severity: 'success' }),
      () => setSnackbar({ open: true, message: 'Failed to copy', severity: 'error' })
    );
  };

  const preview = (msg, max = 80) => {
    if (!msg) return '—';
    const t = String(msg).trim();
    return t.length <= max ? t : t.slice(0, max) + '…';
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
        Create WhatsApp message templates here. Recovery members can select a campaign and copy the message to send via WhatsApp. Use <strong>{'{{customerName}}'}</strong> and <strong>{'{{mobileNumber}}'}</strong> in the message for personalization when sending from Recovery Assignments.
      </Alert>

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : campaigns.length === 0 ? (
            <Typography color="text.secondary">No campaigns yet. Click <strong>Add campaign</strong> to create a WhatsApp message template.</Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Name</strong></TableCell>
                    <TableCell><strong>Message preview</strong></TableCell>
                    <TableCell><strong>Created by</strong></TableCell>
                    <TableCell><strong>Created</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow key={c._id}>
                      <TableCell><Typography fontWeight={500}>{c.name}</Typography></TableCell>
                      <TableCell sx={{ maxWidth: 320 }}><Typography variant="body2" color="text.secondary" noWrap title={c.message}>{preview(c.message, 60)}</Typography></TableCell>
                      <TableCell>{getCreatedByName(c)}</TableCell>
                      <TableCell>{formatDate(c.createdAt)}</TableCell>
                      <TableCell><Chip size="small" label={c.isActive !== false ? 'Active' : 'Inactive'} color={c.isActive !== false ? 'success' : 'default'} variant="outlined" /></TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleCopyMessage(c.message)} title="Copy message to clipboard">
                          <CopyIcon />
                        </IconButton>
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
            label="Campaign name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            margin="normal"
            required
            placeholder="e.g. Payment reminder"
          />
          <TextField
            fullWidth
            label="WhatsApp message template"
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            margin="normal"
            multiline
            rows={6}
            placeholder="Type your message here. Use {{customerName}} and {{mobileNumber}} for personalization when sending from Recovery Assignments."
          />
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
