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
  Alert,
  Chip,
  InputAdornment,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Public as PublicIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import api from '../../services/api';

const BankingSetup = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState(null);
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
  const [searchFilter, setSearchFilter] = useState({
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

  const handleSaveField = async (field, updatedList) => {
    try {
      setSavingField(field);
      const payload = {
        ...setupData,
        [field]: updatedList
      };
      const res = await api.put('/finance/banking-setup', payload);
      if (res.data.success && res.data.data) {
        setSetupData({
          paymentTypes: res.data.data.paymentTypes || [],
          mainAccountHeads: res.data.data.mainAccountHeads || [],
          subAccountHeads: res.data.data.subAccountHeads || []
        });
        showToast('Saved successfully (Active across all companies)', 'success');
      }
    } catch (err) {
      console.error('Error saving banking setup:', err);
      showToast('Failed to save data. Please try again.', 'error');
      // Re-fetch to sync
      fetchSetup();
    } finally {
      setSavingField(null);
    }
  };

  const handleAdd = (field) => {
    const val = (inputs[field] || '').trim();
    if (!val) return;

    // Check duplicate case-insensitively
    const exists = setupData[field].some(
      (item) => item.toLowerCase() === val.toLowerCase()
    );
    if (exists) {
      showToast(`"${val}" already exists in this category`, 'warning');
      return;
    }

    const updated = [...setupData[field], val];
    setInputs((prev) => ({ ...prev, [field]: '' }));
    handleSaveField(field, updated);
  };

  const handleDelete = (field, itemToDelete) => {
    const updated = setupData[field].filter((item) => item !== itemToDelete);
    handleSaveField(field, updated);
  };

  const showToast = (message, severity) => {
    setToast({ open: true, message, severity });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const renderCategoryCard = (title, field, placeholder, helperText) => {
    const currentList = setupData[field] || [];
    const filterTerm = (searchFilter[field] || '').toLowerCase().trim();
    const displayList = filterTerm
      ? currentList.filter((item) => item.toLowerCase().includes(filterTerm))
      : currentList;

    const isSaving = savingField === field;

    return (
      <Card elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardHeader 
          title={
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight={700} color="primary">
                {title}
              </Typography>
              <Chip 
                label={`${currentList.length} Options`} 
                size="small" 
                color="primary" 
                variant="outlined" 
                sx={{ fontWeight: 700 }}
              />
            </Box>
          } 
          subheader={helperText}
          subheaderTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
          sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04), borderBottom: `1px solid ${theme.palette.divider}`, pb: 1.5 }}
        />
        <CardContent sx={{ p: 2.5, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Add input */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder={placeholder}
              value={inputs[field]}
              onChange={(e) => setInputs({ ...inputs, [field]: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd(field);
                }
              }}
              disabled={isSaving}
            />
            <Button 
              variant="contained" 
              startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />} 
              onClick={() => handleAdd(field)}
              disabled={isSaving || !inputs[field].trim()}
              sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}
            >
              Add
            </Button>
          </Box>

          {/* Quick search inside category */}
          {currentList.length > 5 && (
            <TextField
              size="small"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={searchFilter[field]}
              onChange={(e) => setSearchFilter({ ...searchFilter, [field]: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                )
              }}
              sx={{ mb: 1.5 }}
            />
          )}

          {/* Options List */}
          <Paper variant="outlined" sx={{ flexGrow: 1, maxHeight: 380, overflow: 'auto', borderRadius: 1.5 }}>
            <List dense sx={{ p: 0 }}>
              {displayList.length === 0 ? (
                <ListItem sx={{ py: 3, textAlign: 'center' }}>
                  <ListItemText 
                    primary={
                      <Typography color="text.secondary" variant="body2" sx={{ fontStyle: 'italic' }}>
                        {filterTerm ? 'No matching items found' : 'No items added yet. Type above and click Add.'}
                      </Typography>
                    } 
                  />
                </ListItem>
              ) : (
                displayList.map((item, idx) => (
                  <ListItem 
                    key={idx} 
                    divider={idx !== displayList.length - 1}
                    sx={{
                      '&:hover': { bgcolor: 'action.hover' },
                      transition: 'background-color 0.15s'
                    }}
                  >
                    <ListItemText 
                      primary={item} 
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    />
                    <ListItemSecondaryAction>
                      <IconButton 
                        edge="end" 
                        aria-label="delete" 
                        onClick={() => handleDelete(field, item)} 
                        disabled={isSaving} 
                        size="small" 
                        color="error"
                      >
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
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, margin: '0 auto' }}>
      {/* Global Setting Banner */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 2,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.info.main, 0.08)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SettingsIcon color="primary" sx={{ fontSize: 42 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: -0.5 }}>
                Banking Setup
              </Typography>
              <Box display="flex" alignItems="center" gap={1} sx={{ mt: 0.5 }}>
                <PublicIcon color="success" sx={{ fontSize: 18 }} />
                <Typography variant="body2" color="text.secondary" fontWeight={600}>
                  Global Configuration — Options set here are automatically shared & active across <u>ALL companies and entities</u>.
                </Typography>
              </Box>
            </Box>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={fetchSetup}
          >
            Refresh
          </Button>
        </Box>
      </Paper>

      {/* 3 Categories Grid */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          {renderCategoryCard(
            'Payment Types', 
            'paymentTypes', 
            'e.g. BPV, BRV, Online Transfer',
            'Used to classify transactions (e.g. BPV, Online, Cheque, Misc Receipt)'
          )}
        </Grid>
        <Grid item xs={12} md={4}>
          {renderCategoryCard(
            'Main Account Heads', 
            'mainAccountHeads', 
            'e.g. Current Assets, Bank Charges',
            'Primary classification heads for your reconciled bank book entries'
          )}
        </Grid>
        <Grid item xs={12} md={4}>
          {renderCategoryCard(
            'Sub Account Heads', 
            'subAccountHeads', 
            'e.g. Petty Cash, Bank Charges',
            'Secondary line item sub-heads for accurate banking reconciliations'
          )}
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

