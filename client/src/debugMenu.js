import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  TextField,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  BugReport as BugIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import api from './services/api';

const DebugMenu = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [systemInfo, setSystemInfo] = useState({});
  const [debugMode, setDebugMode] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadSystemInfo();
    loadLogs();
  }, []);

  const loadSystemInfo = async () => {
    try {
      setLoading(true);
      const response = await api.get('/debug/system-info');
      if (response.data.success) {
        setSystemInfo(response.data.data);
      }
    } catch (error) {
      console.error('Error loading system info:', error);
      setMessage({ type: 'error', text: 'Failed to load system information' });
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const response = await api.get('/debug/logs');
      if (response.data.success) {
        setLogs(response.data.data);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const clearLogs = async () => {
    try {
      const response = await api.post('/debug/clear-logs');
      if (response.data.success) {
        setLogs([]);
        setMessage({ type: 'success', text: 'Logs cleared successfully' });
      }
    } catch (error) {
      console.error('Error clearing logs:', error);
      setMessage({ type: 'error', text: 'Failed to clear logs' });
    }
  };

  const downloadLogs = async () => {
    try {
      const response = await api.get('/debug/download-logs', {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `debug-logs-${new Date().toISOString()}.txt`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setMessage({ type: 'success', text: 'Logs downloaded successfully' });
    } catch (error) {
      console.error('Error downloading logs:', error);
      setMessage({ type: 'error', text: 'Failed to download logs' });
    }
  };

  const toggleDebugMode = async () => {
    try {
      const response = await api.post('/debug/toggle-mode', {
        debugMode: !debugMode
      });
      if (response.data.success) {
        setDebugMode(!debugMode);
        setMessage({ type: 'success', text: `Debug mode ${!debugMode ? 'enabled' : 'disabled'}` });
      }
    } catch (error) {
      console.error('Error toggling debug mode:', error);
      setMessage({ type: 'error', text: 'Failed to toggle debug mode' });
    }
  };

  const getLogLevelColor = (level) => {
    switch (level.toLowerCase()) {
      case 'error': return 'error';
      case 'warn': return 'warning';
      case 'info': return 'info';
      case 'debug': return 'default';
      default: return 'default';
    }
  };

  const getLogLevelIcon = (level) => {
    switch (level.toLowerCase()) {
      case 'error': return <ErrorIcon />;
      case 'warn': return <WarningIcon />;
      case 'info': return <InfoIcon />;
      case 'debug': return <BugIcon />;
      default: return <InfoIcon />;
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
        <BugIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Debug Menu
      </Typography>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* System Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Information
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <InfoIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Node.js Version"
                    secondary={systemInfo.nodeVersion || 'Unknown'}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <InfoIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="MongoDB Version"
                    secondary={systemInfo.mongoVersion || 'Unknown'}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <InfoIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Uptime"
                    secondary={systemInfo.uptime || 'Unknown'}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <InfoIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Memory Usage"
                    secondary={systemInfo.memoryUsage || 'Unknown'}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <InfoIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="CPU Usage"
                    secondary={systemInfo.cpuUsage || 'Unknown'}
                  />
                </ListItem>
              </List>
              
              <Box mt={2}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadSystemInfo}
                  fullWidth
                >
                  Refresh System Info
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Debug Controls */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Debug Controls
              </Typography>
              
              <Box display="flex" alignItems="center" mb={2}>
                <Chip
                  icon={<BugIcon />}
                  label={debugMode ? 'DEBUG MODE ON' : 'DEBUG MODE OFF'}
                  color={debugMode ? 'warning' : 'default'}
                  variant="outlined"
                />
              </Box>
              
              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  variant="contained"
                  color={debugMode ? 'warning' : 'primary'}
                  onClick={toggleDebugMode}
                  fullWidth
                >
                  {debugMode ? 'Disable Debug Mode' : 'Enable Debug Mode'}
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={clearLogs}
                  fullWidth
                >
                  Clear Logs
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={downloadLogs}
                  fullWidth
                >
                  Download Logs
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* System Logs */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  System Logs
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadLogs}
                  size="small"
                >
                  Refresh
                </Button>
              </Box>
              
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Recent Logs ({logs.length} entries)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {logs.slice(0, 50).map((log, index) => (
                      <ListItem key={index} divider>
                        <ListItemIcon>
                          {getLogLevelIcon(log.level)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Chip
                                label={log.level.toUpperCase()}
                                color={getLogLevelColor(log.level)}
                                size="small"
                              />
                              <Typography variant="body2" color="textSecondary">
                                {new Date(log.timestamp).toLocaleString()}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" component="span">
                                {log.message}
                              </Typography>
                              {log.metadata && (
                                <Typography variant="caption" display="block" color="textSecondary">
                                  {JSON.stringify(log.metadata)}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DebugMenu;
