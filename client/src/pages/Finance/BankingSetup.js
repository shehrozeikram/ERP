import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
  alpha,
  useTheme,
  Snackbar,
  Alert
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Settings as SettingsIcon } from '@mui/icons-material';
import api from '../../services/api';

const BankingSetup = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setupData, setSetupData] = useState({
    paymentTypes: [],
    mainAccountHeads: [],
    subAccountHeads: []
  });
  const [inputs, setInputs] = useState({
    paymentTypes: '',
    mainAccountHeads: '',
    subAccountHeads: ''
  });
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchSetup();
  }, []);

  const fetchSetup = async () => {
    try {
      setLoading(true);
      const res = await api.get('/finance/banking-setup');
      if (res.data.success && res.data.data) {
        setSetupData({
          paymentTypes: res.data.data.paymentTypes || [],
          mainAccountHeads: res.data.data.mainAccountHeads || [],
          subAccountHeads: res.data.data.subAccountHeads || []
        });
      }
    } catch (err) {
      console.error('Error fetching banking setup:', err);
      showToast('Failed to load setup data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updatedData) => {
    try {
      setSaving(true);
      const res = await api.put('/finance/banking-setup', updatedData);
      if (res.data.success) {
        showToast('Banking setup updated successfully', 'success');
        setSetupData({
          paymentTypes: res.data.data.paymentTypes || [],
          mainAccountHeads: res.data.data.mainAccountHeads || [],
          subAccountHeads: res.data.data.subAccountHeads || []
        });
      }
    } catch (err) {
      console.error('Error saving banking setup:', err);
      showToast('Failed to save setup data', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (field) => {
    const val = inputs[field].trim();
    if (!val) return;
    if (setupData[field].includes(val)) {
      showToast('Item already exists', 'warning');
      return;
    }
    const updated = { ...setupData, [field]: [...setupData[field], val] };
    setSetupData(updated);
    setInputs({ ...inputs, [field]: '' });
    handleSave(updated);
  };

  const handleDelete = (field, index) => {
    const updatedList = [...setupData[field]];
    updatedList.splice(index, 1);
    const updated = { ...setupData, [field]: updatedList };
    setSetupData(updated);
    handleSave(updated);
  };

  const showToast = (message, severity) => {
    setToast({ open: true, message, severity });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const renderCategoryCard = (title, field, placeholder) => (
    <Card elevation={2}>
      <CardHeader 
        title={title} 
        titleTypographyProps={{ variant: 'h6', color: 'primary' }} 
        sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05), borderBottom: `1px solid ${theme.palette.divider}` }}
      />
      <CardContent>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder={placeholder}
            value={inputs[field]}
            onChange={(e) => setInputs({ ...inputs, [field]: e.target.value })}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleAdd(field);
            }}
            disabled={saving}
          />
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => handleAdd(field)}
            disabled={saving || !inputs[field].trim()}
          >
            Add
          </Button>
        </Box>
        <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
          <List dense>
            {setupData[field].length === 0 ? (
              <ListItem>
                <ListItemText primary={<Typography color="text.secondary" variant="body2" sx={{ fontStyle: 'italic' }}>No items added yet</Typography>} />
              </ListItem>
            ) : (
              setupData[field].map((item, idx) => (
                <ListItem key={idx} divider={idx !== setupData[field].length - 1}>
                  <ListItemText primary={item} />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(field, idx)} disabled={saving} size="small" color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))
            )}
          </List>
        </Paper>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SettingsIcon color="primary" sx={{ fontSize: 40 }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
              Banking Setup
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Manage dropdown options for the Banking module
            </Typography>
          </Box>
        </Box>
      </Paper>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          {renderCategoryCard('Payment Types', 'paymentTypes', 'e.g. BPV, Online, Cheque')}
        </Grid>
        <Grid item xs={12} md={4}>
          {renderCategoryCard('Main Account Heads', 'mainAccountHeads', 'e.g. Current Assets')}
        </Grid>
        <Grid item xs={12} md={4}>
          {renderCategoryCard('Sub Account Heads', 'subAccountHeads', 'e.g. Cash in Hand')}
        </Grid>
      </Grid>

      <Snackbar 
        open={toast.open} 
        autoHideDuration={4000} 
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setToast({ ...toast, open: false })} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BankingSetup;
