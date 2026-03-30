import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Button, CircularProgress, Alert, Stack, List, ListItem, ListItemText, Divider
} from '@mui/material';
import { QrCode2 as QrIcon, Inventory2 as InvIcon, FactCheck as VerifyIcon, History as HistoryIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function AssetTaggingDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const res = await api.get('/asset-tagging/dashboard-stats');
      setData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data && !error) {
    return (
      <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" gap={1} mb={3}>
        <QrIcon color="primary" fontSize="large" />
        <Typography variant="h5" fontWeight={700}>Asset Tagging</Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Link physical fixed assets to QR labels, record scans, update custody, and run physical verification counts.
        Create assets under <strong>Finance → Review → Fixed Assets</strong>, then issue tags here.
      </Typography>

      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Active assets (register)', value: data?.activeAssets ?? '—', icon: <InvIcon />, color: 'primary.main' },
          { label: 'Tagged (active labels)', value: data?.taggedActive ?? '—', icon: <QrIcon />, color: 'success.main' },
          { label: 'Untagged active', value: data?.untaggedActive ?? '—', icon: <InvIcon />, color: 'warning.main' },
          { label: 'Open verification sessions', value: data?.openVerificationSessions ?? '—', icon: <VerifyIcon />, color: 'info.main' }
        ].map((c) => (
          <Grid item xs={12} sm={6} md={3} key={c.label}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" gap={1} mb={1} sx={{ color: c.color }}>
                  {c.icon}
                  <Typography variant="caption" fontWeight={600}>{c.label}</Typography>
                </Stack>
                <Typography variant="h4" fontWeight={800}>{c.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
        <Button variant="contained" onClick={() => navigate('/asset-tagging/assets')}>Tagged Assets</Button>
        <Button variant="outlined" onClick={() => navigate('/asset-tagging/verification')}>Physical Verification</Button>
        <Button variant="outlined" onClick={() => navigate('/asset-tagging/events')}>Tag Events</Button>
        <Button variant="outlined" onClick={() => navigate('/finance/fixed-assets')}>Fixed Assets (Finance)</Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon fontSize="small" /> Recent activity
        </Typography>
        <Divider sx={{ mb: 1 }} />
        {!data?.recentEvents?.length ? (
          <Typography color="text.secondary">No events yet — issue a tag to get started.</Typography>
        ) : (
          <List dense disablePadding>
            {data.recentEvents.map((ev) => (
              <ListItem key={ev._id} disableGutters>
                <ListItemText
                  primary={`${ev.eventType?.replace(/_/g, ' ')} — ${ev.tagCode || '—'}`}
                  secondary={`${ev.asset?.assetNumber || ''} ${ev.asset?.name || ''} · ${new Date(ev.createdAt).toLocaleString()}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}
