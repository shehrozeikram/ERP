import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import {
  NotificationsActive as NotificationsActiveIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import api from '../../services/api';

const MobileApprovalNotifications = () => {
  const { user } = useAuth();
  const [notifyEmails, setNotifyEmails] = useState([]);
  const [notifyEmailOptions, setNotifyEmailOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [listRes, usersRes] = await Promise.all([
        api.get('/settings/approval-mobile-notify-emails'),
        authService.getUsers({ page: 1, limit: 500, status: 'active' }).catch(() => null)
      ]);
      const emails = listRes.data?.data?.emails || [];
      setNotifyEmails(emails);
      const optionUsers = usersRes?.data?.data?.users || [];
      const optionEmails = [
        ...new Set([
          ...emails,
          ...optionUsers.map((u) => String(u.email || '').trim().toLowerCase()).filter(Boolean)
        ])
      ].sort();
      setNotifyEmailOptions(optionEmails);
    } catch (err) {
      console.error('Error loading approval notify emails:', err);
      setError(err.response?.data?.message || 'Failed to load mobile approval notify list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const cleaned = [...new Set(
        (notifyEmails || [])
          .map((e) => String(e || '').trim().toLowerCase())
          .filter((e) => e.includes('@'))
      )];
      const res = await api.put('/settings/approval-mobile-notify-emails', { emails: cleaned });
      setNotifyEmails(res.data?.data?.emails || cleaned);
      setSuccess('Mobile approval notification list saved');
    } catch (err) {
      console.error('Failed to save approval notify emails:', err);
      setError(err.response?.data?.message || 'Failed to save mobile approval notify list');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'super_admin' && user?.role !== 'developer' && user?.role !== 'admin') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Access denied. Admin privileges required.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 3 }}>
        <NotificationsActiveIcon color="primary" sx={{ mt: 0.5, fontSize: 32 }} />
        <Box>
          <Typography variant="h4">Mobile Approval Notifications</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Users on this list can receive approval chat / push messages — but only when they are the selected approver on that document.
          </Typography>
        </Box>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: { xs: 2, sm: 3 }, border: '1px solid', borderColor: 'divider' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Recipient emails
          </Typography>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={loading || saving}
            sx={{ minHeight: 40 }}
          >
            Save List
          </Button>
        </Stack>

        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 3 }}>
            <CircularProgress size={22} />
            <Typography variant="body2" color="text.secondary">Loading recipients…</Typography>
          </Box>
        ) : (
          <Autocomplete
            multiple
            freeSolo
            options={notifyEmailOptions}
            value={notifyEmails}
            onChange={(_e, value) => {
              const next = [...new Set(
                (value || [])
                  .map((v) => String(v || '').trim().toLowerCase())
                  .filter((v) => v.includes('@'))
              )];
              setNotifyEmails(next);
            }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  variant="outlined"
                  color="primary"
                  label={option}
                  size="small"
                  {...getTagProps({ index })}
                  key={`${option}-${index}`}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Emails"
                placeholder="Type or select email and press Enter"
                helperText="Add or remove emails here. Example: ceo@sgc.com"
              />
            )}
          />
        )}
      </Paper>
    </Box>
  );
};

export default MobileApprovalNotifications;
