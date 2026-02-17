import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  FormControlLabel,
  Switch,
  Slider,
  Button,
  Alert
} from '@mui/material';
import api from '../../services/api';

const SettingsPage = () => {
  const [announcement, setAnnouncement] = useState({ enabled: false, text: '', speed: 80 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get('/settings');
        const a = res.data?.data?.announcement || { enabled: false, text: '', speed: 80 };
        if (!cancelled) setAnnouncement(a);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || e.message || 'Failed to load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await api.put('/settings/announcement', announcement);
      setSuccess('Announcement updated.');
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Settings
      </Typography>

      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Announcement / News Line
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={!!announcement.enabled}
              onChange={(e) => setAnnouncement((p) => ({ ...p, enabled: e.target.checked }))}
            />
          }
          label="Enable announcement bar"
          sx={{ mb: 2 }}
        />

        <TextField
          label="Announcement text"
          value={announcement.text || ''}
          onChange={(e) => setAnnouncement((p) => ({ ...p, text: e.target.value }))}
          fullWidth
          multiline
          minRows={2}
          disabled={loading}
          helperText="This message will scroll at the top for all users."
          sx={{ mb: 3 }}
        />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Scroll speed
        </Typography>
        <Slider
          value={Number(announcement.speed || 80)}
          onChange={(_, v) => setAnnouncement((p) => ({ ...p, speed: Number(v) }))}
          min={20}
          max={300}
          step={10}
          valueLabelDisplay="auto"
          disabled={loading}
          sx={{ mb: 3, maxWidth: 420 }}
        />

        <Button variant="contained" onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Paper>
    </Box>
  );
};

export default SettingsPage;

