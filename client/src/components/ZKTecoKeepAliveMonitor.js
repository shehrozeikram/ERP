import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
  Grid
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { api } from '../services/api';

const ZKTecoKeepAliveMonitor = () => {
  const [keepAliveStatus, setKeepAliveStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [customInterval, setCustomInterval] = useState(300);

  // Fetch keep-alive status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/zkteco/keep-alive/status');
      setKeepAliveStatus(response.data.data);
      
    } catch (err) {
      setError('Failed to fetch keep-alive status');
      console.error('Error fetching keep-alive status:', err);
    } finally {
      setLoading(false);
    }
  };

  // Force keep-alive refresh
  const forceRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await api.post('/zkteco/keep-alive/refresh');
      await fetchStatus(); // Refresh status after forcing refresh
      
    } catch (err) {
      setError('Failed to force keep-alive refresh');
      console.error('Error forcing keep-alive refresh:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update keep-alive interval
  const updateInterval = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await api.put('/zkteco/keep-alive/interval', {
        intervalMs: customInterval * 1000
      });
      
      await fetchStatus(); // Refresh status after updating interval
      setShowSettings(false);
      
    } catch (err) {
      setError('Failed to update keep-alive interval');
      console.error('Error updating keep-alive interval:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh status every 10 seconds
  useEffect(() => {
    fetchStatus();
    
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Calculate progress for next keep-alive
  const getProgressValue = () => {
    if (!keepAliveStatus?.lastKeepAlive || !keepAliveStatus?.nextKeepAlive) {
      return 0;
    }
    
    const now = new Date().getTime();
    const last = new Date(keepAliveStatus.lastKeepAlive).getTime();
    const next = new Date(keepAliveStatus.nextKeepAlive).getTime();
    
    if (now >= next) return 100;
    
    const total = next - last;
    const elapsed = now - last;
    return (elapsed / total) * 100;
  };

  // Get status icon and color
  const getStatusIcon = () => {
    if (!keepAliveStatus) return <WarningIcon color="warning" />;
    
    if (keepAliveStatus.isActive && keepAliveStatus.sessionValid) {
      return <CheckIcon color="success" />;
    } else if (keepAliveStatus.isActive) {
      return <WarningIcon color="warning" />;
    } else {
      return <ErrorIcon color="error" />;
    }
  };

  const getStatusColor = () => {
    if (!keepAliveStatus) return 'warning';
    
    if (keepAliveStatus.isActive && keepAliveStatus.sessionValid) {
      return 'success';
    } else if (keepAliveStatus.isActive) {
      return 'warning';
    } else {
      return 'error';
    }
  };

  const getStatusText = () => {
    if (!keepAliveStatus) return 'Unknown';
    
    if (keepAliveStatus.isActive && keepAliveStatus.sessionValid) {
      return 'Active & Healthy';
    } else if (keepAliveStatus.isActive) {
      return 'Active but Session Invalid';
    } else {
      return 'Inactive';
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            ZKTeco Keep-Alive Monitor
          </Typography>
          
          <Box>
            <Tooltip title="Refresh Status">
              <IconButton onClick={fetchStatus} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Settings">
              <IconButton onClick={() => setShowSettings(!showSettings)}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {keepAliveStatus && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Status
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getStatusIcon()}
                  <Chip 
                    label={getStatusText()} 
                    color={getStatusColor()} 
                    size="small" 
                  />
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Keep-Alive Count
                </Typography>
                <Typography variant="h6">
                  {keepAliveStatus.keepAliveCount}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Interval
                </Typography>
                <Typography variant="body2">
                  {Math.round(keepAliveStatus.intervalMs / 1000)} seconds
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Last Keep-Alive
                </Typography>
                <Typography variant="body2">
                  {keepAliveStatus.lastKeepAlive ? 
                    new Date(keepAliveStatus.lastKeepAlive).toLocaleString() : 
                    'Never'
                  }
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Next Keep-Alive
                </Typography>
                <Typography variant="body2">
                  {keepAliveStatus.nextKeepAlive ? 
                    new Date(keepAliveStatus.nextKeepAlive).toLocaleString() : 
                    'N/A'
                  }
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Progress to Next Keep-Alive
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={getProgressValue()} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            </Grid>
          </Grid>
        )}

        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={forceRefresh}
            disabled={loading}
            color="primary"
          >
            Force Refresh
          </Button>
        </Box>

        {showSettings && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Custom Keep-Alive Interval
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <input
                type="number"
                value={customInterval}
                onChange={(e) => setCustomInterval(parseInt(e.target.value) || 300)}
                min="30"
                max="3600"
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  width: '100px'
                }}
              />
              <Typography variant="body2">seconds</Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={updateInterval}
                disabled={loading}
              >
                Update
              </Button>
            </Box>
            <Typography variant="caption" color="textSecondary">
              Minimum: 30 seconds, Maximum: 1 hour
            </Typography>
          </Box>
        )}

        {loading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ZKTecoKeepAliveMonitor;
