import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Test as TestIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import api from '../services/api';

const ZKTecoConfig = () => {
  const [config, setConfig] = useState({
    deviceIP: '',
    devicePort: 4370,
    username: 'admin',
    password: '',
    enableRealTime: false,
    enableKeepAlive: false,
    keepAliveInterval: 30,
    enableLogging: true,
    logLevel: 'info'
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [deviceStatus, setDeviceStatus] = useState('unknown');
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    loadConfiguration();
    checkDeviceStatus();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const response = await api.get('/zkteco/config');
      if (response.data.success) {
        setConfig(response.data.data);
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
      setMessage({ type: 'error', text: 'Failed to load configuration' });
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    try {
      setSaving(true);
      const response = await api.post('/zkteco/config', config);
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Configuration saved successfully' });
        setLastSync(new Date());
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      setMessage({ type: 'error', text: 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    try {
      setTesting(true);
      const response = await api.post('/zkteco/test-connection', config);
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Connection test successful' });
        setDeviceStatus('online');
      } else {
        setMessage({ type: 'error', text: response.data.message || 'Connection test failed' });
        setDeviceStatus('offline');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setMessage({ type: 'error', text: 'Connection test failed' });
      setDeviceStatus('offline');
    } finally {
      setTesting(false);
    }
  };

  const checkDeviceStatus = async () => {
    try {
      const response = await api.get('/zkteco/status');
      if (response.data.success) {
        setDeviceStatus(response.data.data.status);
        setLastSync(response.data.data.lastSync);
      }
    } catch (error) {
      console.error('Error checking device status:', error);
      setDeviceStatus('unknown');
    }
  };

  const handleInputChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'error';
      case 'warning': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online': return <CheckCircleIcon />;
      case 'offline': return <ErrorIcon />;
      case 'warning': return <WarningIcon />;
      default: return <WarningIcon />;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        ZKTeco Device Configuration
      </Typography>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Device Configuration */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Device Settings
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Device IP Address"
                    value={config.deviceIP}
                    onChange={(e) => handleInputChange('deviceIP', e.target.value)}
                    placeholder="192.168.1.100"
                    margin="normal"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Device Port"
                    type="number"
                    value={config.devicePort}
                    onChange={(e) => handleInputChange('devicePort', parseInt(e.target.value))}
                    margin="normal"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Username"
                    value={config.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    margin="normal"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    value={config.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    margin="normal"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Feature Settings
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableRealTime}
                        onChange={(e) => handleInputChange('enableRealTime', e.target.checked)}
                      />
                    }
                    label="Enable Real-time Attendance"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableKeepAlive}
                        onChange={(e) => handleInputChange('enableKeepAlive', e.target.checked)}
                      />
                    }
                    label="Enable Keep Alive"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableLogging}
                        onChange={(e) => handleInputChange('enableLogging', e.target.checked)}
                      />
                    }
                    label="Enable Logging"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Keep Alive Interval (seconds)"
                    type="number"
                    value={config.keepAliveInterval}
                    onChange={(e) => handleInputChange('keepAliveInterval', parseInt(e.target.value))}
                    disabled={!config.enableKeepAlive}
                    margin="normal"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Log Level"
                    value={config.logLevel}
                    onChange={(e) => handleInputChange('logLevel', e.target.value)}
                    disabled={!config.enableLogging}
                    margin="normal"
                  >
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                  </TextField>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Status and Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Device Status
              </Typography>
              
              <Box display="flex" alignItems="center" mb={2}>
                <Chip
                  icon={getStatusIcon(deviceStatus)}
                  label={deviceStatus.toUpperCase()}
                  color={getStatusColor(deviceStatus)}
                  variant="outlined"
                />
              </Box>
              
              {lastSync && (
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Last Sync: {new Date(lastSync).toLocaleString()}
                </Typography>
              )}
              
              <Divider sx={{ my: 2 }} />
              
              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  variant="contained"
                  startIcon={<TestIcon />}
                  onClick={testConnection}
                  disabled={testing}
                  fullWidth
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={checkDeviceStatus}
                  fullWidth
                >
                  Refresh Status
                </Button>
                
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={saveConfiguration}
                  disabled={saving}
                  fullWidth
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              
              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  variant="outlined"
                  onClick={() => window.open('/zkteco/health', '_blank')}
                  fullWidth
                >
                  Health Check
                </Button>
                
                <Button
                  variant="outlined"
                  onClick={() => window.open('/zkteco/logs', '_blank')}
                  fullWidth
                >
                  View Logs
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ZKTecoConfig;
