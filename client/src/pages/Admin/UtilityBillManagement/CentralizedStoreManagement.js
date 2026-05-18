import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import centralizedStoreService from '../../../services/centralizedStoreService';

const UTILITY_TYPES = ['Electricity', 'Water', 'Gas', 'Internet', 'Phone', 'Maintenance', 'Security', 'Cleaning', 'Rent', 'Other'];

const CentralizedStoreManagement = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [catDialog, setCatDialog] = useState({ open: false, editing: null, name: '', description: '' });

  const mapCategoryToUtilityType = (categoryName = '') => {
    const n = String(categoryName).toLowerCase();
    if (n.includes('electric')) return 'Electricity';
    if (n.includes('gas')) return 'Gas';
    if (n.includes('water')) return 'Water';
    if (n.includes('rent')) return 'Rent';
    if (n.includes('vehicle')) return 'Other';
    if (n.includes('repair') || n.includes('maintain')) return 'Maintenance';
    return 'Other';
  };
  const [itemDialog, setItemDialog] = useState({
    open: false,
    editing: null,
    category: '',
    name: '',
    utilityType: 'Electricity',
    meterNumber: '',
    location: '',
    site: '',
    expenseAccount: '',
    defaultAmount: 0,
    description: ''
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await centralizedStoreService.getAll();
      setStore(res.data?.store);
      setCategories(res.data?.categories || []);
      setItems(res.data?.items || []);
      const catRes = await centralizedStoreService.getCatalog();
      setExpenseAccounts(catRes.data?.expenseAccounts || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load centralized store');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSeed = async () => {
    try {
      const res = await centralizedStoreService.seedDefaults();
      setSuccess(res.message || 'Defaults created');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Seed failed');
    }
  };

  const saveCategory = async () => {
    try {
      const body = {
        name: catDialog.name,
        description: catDialog.description
      };
      if (catDialog.editing) {
        await centralizedStoreService.updateCategory(catDialog.editing, body);
      } else {
        await centralizedStoreService.createCategory(body);
      }
      setCatDialog({ open: false, editing: null, name: '', description: '' });
      setSuccess('Category saved');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save category');
    }
  };

  const saveItem = async () => {
    try {
      const body = {
        category: itemDialog.category,
        name: itemDialog.name,
        utilityType: itemDialog.utilityType,
        meterNumber: itemDialog.meterNumber,
        location: itemDialog.location,
        site: itemDialog.site,
        expenseAccount: itemDialog.expenseAccount,
        defaultAmount: Number(itemDialog.defaultAmount) || 0,
        description: itemDialog.description
      };
      if (itemDialog.editing) {
        await centralizedStoreService.updateItem(itemDialog.editing, body);
      } else {
        await centralizedStoreService.createItem(body);
      }
      setItemDialog({ open: false, editing: null, category: '', name: '', utilityType: 'Electricity', meterNumber: '', location: '', site: '', expenseAccount: '', defaultAmount: 0, description: '' });
      setSuccess('Item saved');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save item');
    }
  };

  const accountLabel = (acc) => (acc ? `${acc.accountNumber} — ${acc.name}` : '');

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/utility-bills')}>
          Back to Utility Bills
        </Button>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button variant="contained" onClick={handleSeed}>
            Setup defaults
          </Button>
          <Button variant="contained" color="primary" onClick={() => navigate('/admin/utility-bills/new')}>
            Create bill
          </Button>
        </Stack>
      </Stack>

      <Typography variant="h5" gutterBottom>
        {store?.name || 'Centralized Store'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Categories are Electricity, Gas, Water, Vehicles, Rent, Repair &amp; Maintenance, and so on.
        Under each category, add items Meter 1, Meter 2, Meter 3 (each linked to Chart of Accounts).
        When creating a bill, pick a vendor and add meter lines from this catalog.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Categories" />
        <Tab label="Items (Meter 1, Meter 2…)" />
      </Tabs>

      {tab === 0 && (
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" mb={2}>
              <Typography variant="h6">Categories</Typography>
              <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setCatDialog({ open: true, editing: null, name: '', description: '' })}>
                Add category
              </Button>
            </Stack>
            {categories.map((c) => (
              <Stack key={c._id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box>
                  <Typography fontWeight={600}>{c.name}</Typography>
                  {c.description && <Typography variant="caption" color="text.secondary">{c.description}</Typography>}
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => setCatDialog({ open: true, editing: c._id, name: c.name, description: c.description || '' })}>Edit</Button>
                  <IconButton size="small" color="error" onClick={async () => { await centralizedStoreService.deleteCategory(c._id); load(); }}><DeleteIcon /></IconButton>
                </Stack>
              </Stack>
            ))}
            {!categories.length && !loading && (
              <Typography color="text.secondary">
                No categories yet. Click &quot;Setup defaults&quot; for Electricity, Gas, Water, Vehicles, Rent, Repair &amp; Maintenance — or add your own.
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" mb={2}>
              <Typography variant="h6">Store items</Typography>
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                size="small"
                disabled={!categories.length}
                onClick={() => {
                  const cat = categories[0];
                  const catItems = items.filter((i) => String(i.category?._id || i.category) === String(cat?._id));
                  const nextMeter = catItems.length + 1;
                  setItemDialog({
                    open: true,
                    editing: null,
                    category: cat?._id || '',
                    name: `Meter ${nextMeter}`,
                    utilityType: mapCategoryToUtilityType(cat?.name),
                    meterNumber: String(nextMeter),
                    location: 'Main Office',
                    site: '',
                    expenseAccount: expenseAccounts.find((a) => a.accountNumber === '6200')?._id || expenseAccounts[0]?._id || '',
                    defaultAmount: 0,
                    description: ''
                  });
                }}
              >
                Add item
              </Button>
            </Stack>
            {items.map((item) => (
              <Stack key={item._id} direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box>
                  <Typography fontWeight={600}>
                    {item.category?.name ? `${item.category.name} — ` : ''}{item.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.utilityType}
                    {item.meterNumber ? ` · Ref ${item.meterNumber}` : ''}
                    {item.site ? ` · ${item.site}` : ''}
                  </Typography>
                  <Typography variant="caption">
                    COA: {accountLabel(item.expenseAccount)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => setItemDialog({
                    open: true,
                    editing: item._id,
                    category: item.category?._id || item.category,
                    name: item.name,
                    utilityType: item.utilityType,
                    meterNumber: item.meterNumber || '',
                    location: item.location || '',
                    site: item.site || '',
                    expenseAccount: item.expenseAccount?._id || item.expenseAccount,
                    defaultAmount: item.defaultAmount || 0,
                    description: item.description || ''
                  })}>Edit</Button>
                  <IconButton size="small" color="error" onClick={async () => { await centralizedStoreService.deleteItem(item._id); load(); }}><DeleteIcon /></IconButton>
                </Stack>
              </Stack>
            ))}
            {!items.length && !loading && (
              <Typography color="text.secondary">Add categories first, then items named Meter 1, Meter 2, Meter 3 under each category.</Typography>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={catDialog.open} onClose={() => setCatDialog({ ...catDialog, open: false })} maxWidth="sm" fullWidth>
        <DialogTitle>{catDialog.editing ? 'Edit category' : 'New category'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Category name"
              value={catDialog.name}
              onChange={(e) => setCatDialog({ ...catDialog, name: e.target.value })}
              required
              fullWidth
              placeholder="e.g. Electricity, Gas, Water, Rent"
            />
            <TextField label="Description" value={catDialog.description} onChange={(e) => setCatDialog({ ...catDialog, description: e.target.value })} fullWidth multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatDialog({ ...catDialog, open: false })}>Cancel</Button>
          <Button variant="contained" onClick={saveCategory}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={itemDialog.open} onClose={() => setItemDialog({ ...itemDialog, open: false })} maxWidth="md" fullWidth>
        <DialogTitle>{itemDialog.editing ? 'Edit item' : 'New store item'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={itemDialog.category}
                  label="Category"
                  onChange={(e) => {
                    const catId = e.target.value;
                    const cat = categories.find((c) => c._id === catId);
                    setItemDialog({
                      ...itemDialog,
                      category: catId,
                      utilityType: mapCategoryToUtilityType(cat?.name)
                    });
                  }}
                >
                  {categories.map((c) => (
                    <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Item name"
                value={itemDialog.name}
                onChange={(e) => setItemDialog({ ...itemDialog, name: e.target.value })}
                required
                fullWidth
                placeholder="e.g. Meter 1, Meter 2, Meter 3"
                helperText="Use Meter 1, Meter 2, etc. under each category"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Utility type</InputLabel>
                <Select value={itemDialog.utilityType} label="Utility type" onChange={(e) => setItemDialog({ ...itemDialog, utilityType: e.target.value })}>
                  {UTILITY_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField label="Meter no." value={itemDialog.meterNumber} onChange={(e) => setItemDialog({ ...itemDialog, meterNumber: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField label="Location" value={itemDialog.location} onChange={(e) => setItemDialog({ ...itemDialog, location: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField label="Site" value={itemDialog.site} onChange={(e) => setItemDialog({ ...itemDialog, site: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Chart of accounts (expense)</InputLabel>
                <Select value={itemDialog.expenseAccount} label="Chart of accounts (expense)" onChange={(e) => setItemDialog({ ...itemDialog, expenseAccount: e.target.value })}>
                  {expenseAccounts.map((a) => (
                    <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Notes" value={itemDialog.description} onChange={(e) => setItemDialog({ ...itemDialog, description: e.target.value })} fullWidth multiline rows={2} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDialog({ ...itemDialog, open: false })}>Cancel</Button>
          <Button variant="contained" onClick={saveItem}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CentralizedStoreManagement;
