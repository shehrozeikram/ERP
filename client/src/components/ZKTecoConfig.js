import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Divider,
  Grid,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { Refresh, Settings, CheckCircle, Error } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const ZKTecoConfig = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [cookies, setCookies] = useState({
    account_info: '',
    csrftoken: '',
    django_language: 'en',
    sessionid: ''
  });

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchConfig();
    }
  }, [isAdmin]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/zkteco/config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfig(data.data);
        
        // Pre-fill cookies form
        if (data.data.cookies) {
          setCookies({
            account_info: data.data.cookies.account_info || '',
            csrftoken: data.data.cookies.csrftoken || '',
            django_language: data.data.cookies.django_language || 'en',
            sessionid: data.data.cookies.sessionid || ''
          });
        }
      } else {
        setMessage({ type: 'error', text: 'Failed to fetch configuration' });
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      setMessage({ type: 'error', text: 'Error fetching configuration' });
    } finally {
      setLoading(false);
    }
  };

  const updateCookies = async () => {
    try {
      setLoading(true);
      setMessage(null);

      const response = await fetch('/api/zkteco/cookies', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ cookies })
      });

      if (response.ok) {
        const data = await response.json();
        setMessage({ type: 'success', text: data.message });
        fetchConfig(); // Refresh config
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.message || 'Failed to update cookies' });
      }
    } catch (error) {
      console.error('Error updating cookies:', error);
      setMessage({ type: 'error', text: 'Error updating cookies' });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setLoading(true);
      setMessage(null);

      const response = await fetch('/api/zkteco/test-connection', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessage({ type: 'success', text: 'Connection test initiated successfully' });
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.message || 'Failed to test connection' });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setMessage({ type: 'error', text: 'Error testing connection' });
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Access denied. Admin privileges required to manage ZKTeco configuration.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        ZKTeco Device Configuration
      </Typography>
      
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Current Configuration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Settings sx={{ mr: 1 }} />
                <Typography variant="h6">Current Configuration</Typography>
                <Tooltip title="Refresh Configuration">
                  <IconButton onClick={fetchConfig} disabled={loading} sx={{ ml: 'auto' }}>
                    <Refresh />
                  </IconButton>
                </Tooltip>
              </Box>
              
              {config ? (
                <Box>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Device Settings
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Chip 
                      label={`Host: ${config.device?.host}`} 
                      variant="outlined" 
                      size="small" 
                      sx={{ mr: 1, mb: 1 }} 
                    />
                    <Chip 
                      label={`Port: ${config.device?.port}`} 
                      variant="outlined" 
                      size="small" 
                      sx={{ mr: 1, mb: 1 }} 
                    />
                  </Box>
                  
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Connection Status
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Chip 
                      label={`Max Reconnect: ${config.connection?.maxReconnectAttempts}`} 
                      variant="outlined" 
                      size="small" 
                      sx={{ mr: 1, mb: 1 }} 
                    />
                    <Chip 
                      label={`Interval: ${config.connection?.reconnectInterval}ms`} 
                      variant="outlined" 
                      size="small" 
                      sx={{ mr: 1, mb: 1 }} 
                    />
                  </Box>
                  
                  <Button
                    variant="outlined"
                    onClick={testConnection}
                    disabled={loading}
                    startIcon={<CheckCircle />}
                    sx={{ mt: 1 }}
                  >
                    Test Connection
                  </Button>
                </Box>
              ) : (
                <Typography color="textSecondary">
                  {loading ? 'Loading configuration...' : 'No configuration available'}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Cookie Management */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Update Cookies
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Update ZKTeco device authentication cookies when they expire
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Account Info"
                  value={cookies.account_info}
                  onChange={(e) => setCookies({ ...cookies, account_info: e.target.value })}
                  size="small"
                  sx={{ mb: 2 }}
                  helperText="Base64 encoded account information"
                />
                
                <TextField
                  fullWidth
                  label="CSRF Token"
                  value={cookies.csrftoken}
                  onChange={(e) => setCookies({ ...cookies, csrftoken: e.target.value })}
                  size="small"
                  sx={{ mb: 2 }}
                  helperText="Cross-site request forgery token"
                />
                
                <TextField
                  fullWidth
                  label="Django Language"
                  value={cookies.django_language}
                  onChange={(e) => setCookies({ ...cookies, django_language: e.target.value })}
                  size="small"
                  sx={{ mb: 2 }}
                  helperText="Language preference (usually 'en')"
                />
                
                <TextField
                  fullWidth
                  label="Session ID"
                  value={cookies.sessionid}
                  onChange={(e) => setCookies({ ...cookies, sessionid: e.target.value })}
                  size="small"
                  sx={{ mb: 2 }}
                  helperText="Django session identifier"
                />
              </Box>
              
              <Button
                variant="contained"
                onClick={updateCookies}
                disabled={loading || !cookies.account_info || !cookies.csrftoken || !cookies.sessionid}
                fullWidth
              >
                {loading ? 'Updating...' : 'Update Cookies'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Alert severity="info">
          <Typography variant="body2">
            <strong>Note:</strong> After updating cookies, the ZKTeco WebSocket connection will automatically 
            use the new values. If you continue to experience connection issues, restart the server.
          </Typography>
        </Alert>
      </Box>
    </Box>
  );
};

export default ZKTecoConfig;
