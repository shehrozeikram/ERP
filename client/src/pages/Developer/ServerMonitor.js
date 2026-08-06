import React, { useState, useCallback, useEffect } from 'react';
import {
  Box, Card, CardContent, Chip, CircularProgress, Divider, Grid,
  IconButton, LinearProgress, Paper, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tooltip,
  Typography, Alert, Switch, FormControlLabel
} from '@mui/material';
import {
  Memory as MemoryIcon, Storage as DiskIcon, Speed as CpuIcon,
  AccessTime as UptimeIcon, Computer as ServerIcon, Code as CodeIcon,
  Dns as MongoIcon, Refresh as RefreshIcon, CheckCircle as OnlineIcon,
  Error as ErrorIcon, Circle as CircleIcon
} from '@mui/icons-material';
import { getServerStats } from '../../services/developerService';

const fmt = (v, unit = '') => v !== undefined && v !== null ? `${v}${unit}` : 'N/A';

const MeterCard = ({ label, value, percent, color, icon, sub }) => (
  <Card sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', height: '100%' }}>
    <CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.8}>
            {label}
          </Typography>
          <Typography variant="h4" fontWeight={800} color={color || 'primary.main'} sx={{ my: 0.5 }}>
            {percent !== undefined ? `${percent}%` : value}
          </Typography>
          {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
        </Box>
        <Box sx={{ p: 1.2, bgcolor: `${color || 'primary'}.main`, borderRadius: 2, opacity: 0.15, display: 'flex' }}>
          {icon}
        </Box>
      </Stack>
      {percent !== undefined && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress
            variant="determinate"
            value={Math.min(percent, 100)}
            sx={{
              height: 8, borderRadius: 4,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                bgcolor: percent > 80 ? 'error.main' : percent > 60 ? 'warning.main' : 'success.main'
              }
            }}
          />
        </Box>
      )}
    </CardContent>
  </Card>
);

const SectionTitle = ({ icon, children }) => (
  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2, mt: 3 }}>
    <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
    <Typography variant="h6" fontWeight={700}>{children}</Typography>
    <Divider sx={{ flex: 1 }} />
  </Stack>
);

export default function ServerMonitor() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await getServerStats();
      if (res.data?.success) {
        setData(res.data.data);
        setLastUpdated(new Date());
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to fetch server stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, load]);

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
      <CircularProgress />
      <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>Fetching server metrics…</Typography>
    </Box>
  );

  if (error) return (
    <Box p={3}><Alert severity="error" action={
      <IconButton size="small" onClick={load}><RefreshIcon /></IconButton>
    }>{error}</Alert></Box>
  );

  if (!data) return null;

  const { os: osInfo, uptime, cpu, memory, disk, nodeProcess, mongodb, pm2 } = data;

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Paper
        sx={{
          p: 3, mb: 3, borderRadius: 3,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          color: '#fff', border: '1px solid rgba(255,255,255,0.1)'
        }}
        elevation={4}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{ p: 1.5, bgcolor: 'rgba(100,181,246,0.2)', borderRadius: 2, display: 'flex' }}>
              <ServerIcon sx={{ fontSize: 36, color: '#64b5f6' }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ color: '#64b5f6' }}>
                🖥️ Server Monitor
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.3 }}>
                {osInfo?.hostname} · {osInfo?.platform} {osInfo?.arch} · {osInfo?.release}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={2}>
            {lastUpdated && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                Updated {lastUpdated.toLocaleTimeString()}
              </Typography>
            )}
            <FormControlLabel
              control={<Switch checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} size="small" sx={{ '& .MuiSwitch-track': { bgcolor: 'rgba(255,255,255,0.3)' } }} />}
              label={<Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Auto-refresh (30s)</Typography>}
            />
            <Tooltip title="Refresh now">
              <IconButton onClick={load} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Uptime Banner */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: 'success.main', color: '#fff' }} elevation={0}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <UptimeIcon />
          <Typography variant="subtitle1" fontWeight={700}>
            System Uptime: {uptime?.formatted || 'N/A'}
          </Typography>
          <Chip label="ONLINE" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 800 }} />
        </Stack>
      </Paper>

      {/* CPU, Memory, Disk, Heap */}
      <SectionTitle icon={<CpuIcon />}>System Resources</SectionTitle>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <MeterCard label="CPU Usage" percent={cpu?.usage} color="info.main" icon={<CpuIcon sx={{ fontSize: 28 }} />}
            sub={`${cpu?.cores} cores · ${cpu?.model?.split(' ').slice(0, 3).join(' ')}`} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MeterCard label="Memory Usage" percent={memory?.usedPercent} color="warning.main" icon={<MemoryIcon sx={{ fontSize: 28 }} />}
            sub={`${memory?.usedFmt} used of ${memory?.totalFmt}`} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MeterCard label="Disk Usage" percent={disk?.usedPercent} color="error.main" icon={<DiskIcon sx={{ fontSize: 28 }} />}
            sub={`${disk?.used} used · ${disk?.free} free · ${disk?.total} total`} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MeterCard label="Heap Used" percent={nodeProcess?.heapUsedPercent} color="secondary.main" icon={<CodeIcon sx={{ fontSize: 28 }} />}
            sub={`${nodeProcess?.heapUsed} of ${nodeProcess?.heapTotal} · RSS: ${nodeProcess?.rss}`} />
        </Grid>
      </Grid>

      {/* Node.js Info */}
      <SectionTitle icon={<CodeIcon />}>Node.js Process</SectionTitle>
      <Grid container spacing={2}>
        {[
          { label: 'Node Version', value: nodeProcess?.version },
          { label: 'Environment', value: nodeProcess?.env },
          { label: 'PID', value: nodeProcess?.pid },
          { label: 'RSS Memory', value: nodeProcess?.rss },
          { label: 'Heap Used', value: nodeProcess?.heapUsed },
          { label: 'External', value: nodeProcess?.external },
        ].map(({ label, value }) => (
          <Grid item xs={6} sm={4} md={2} key={label}>
            <Card sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">{label}</Typography>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 0.5 }}>{fmt(value)}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* MongoDB Stats */}
      <SectionTitle icon={<MongoIcon />}>MongoDB Database</SectionTitle>
      <Grid container spacing={2}>
        {[
          { label: 'Database', value: mongodb?.db },
          { label: 'Collections', value: mongodb?.collections },
          { label: 'Documents', value: Number(mongodb?.documents || 0).toLocaleString() },
          { label: 'Storage Size', value: mongodb?.storageSize },
          { label: 'Data Size', value: mongodb?.dataSize },
          { label: 'Index Size', value: mongodb?.indexSize },
        ].map(({ label, value }) => (
          <Grid item xs={6} sm={4} md={2} key={label}>
            <Card sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">{label}</Typography>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 0.5 }}>{fmt(value)}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* PM2 Process Table */}
      {pm2?.length > 0 && (
        <>
          <SectionTitle icon={<ServerIcon />}>PM2 Processes</SectionTitle>
          <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }} elevation={0}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  {['Name', 'Status', 'PID', 'Mode', 'CPU', 'Memory', 'Restarts'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {pm2.map((p, i) => (
                  <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell sx={{ fontWeight: 600 }}>{p.name}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        icon={p.status === 'online' ? <OnlineIcon /> : <ErrorIcon />}
                        label={p.status}
                        color={p.status === 'online' ? 'success' : 'error'}
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell>{p.pid || '—'}</TableCell>
                    <TableCell><Chip size="small" label={p.mode} variant="outlined" /></TableCell>
                    <TableCell>{p.cpu}%</TableCell>
                    <TableCell>{p.memory}</TableCell>
                    <TableCell>
                      <Chip size="small" label={p.restarts} color={p.restarts > 10 ? 'warning' : 'default'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
