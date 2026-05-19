import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  TextField,
  Typography,
  alpha,
  useTheme
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

const emptyItemDialog = {
  open: false,
  editing: null,
  category: '',
  categoryLocked: false,
  code: '',
  name: '',
  utilityType: 'Electricity',
  meterNumber: '',
  location: '',
  site: '',
  expenseAccount: '',
  defaultAmount: 0,
  description: ''
};

const CentralizedStoreManagement = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [catDialog, setCatDialog] = useState({ open: false, editing: null, name: '', description: '' });
  const [itemDialog, setItemDialog] = useState(emptyItemDialog);

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

  const itemsByCategoryId = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(String(c._id), []));
    items.forEach((item) => {
      const catId = String(item.category?._id || item.category || '');
      if (!map.has(catId)) map.set(catId, []);
      map.get(catId).push(item);
    });
    map.forEach((list) => list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name)));
    return map;
  }, [categories, items]);

  const defaultExpenseAccountId = useMemo(
    () => expenseAccounts.find((a) => a.accountNumber === '6200')?._id || expenseAccounts[0]?._id || '',
    [expenseAccounts]
  );

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
      const body = { name: catDialog.name, description: catDialog.description };
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

  const openAddItemForCategory = (category) => {
    const catId = String(category._id);
    const catItems = itemsByCategoryId.get(catId) || [];
    const nextMeter = catItems.length + 1;
    setItemDialog({
      open: true,
      editing: null,
      category: catId,
      categoryLocked: true,
      name: `Meter ${nextMeter}`,
      utilityType: mapCategoryToUtilityType(category.name),
      meterNumber: String(nextMeter),
      location: 'Main Office',
      site: '',
      expenseAccount: defaultExpenseAccountId,
      defaultAmount: 0,
      description: ''
    });
  };

  const openEditItem = (item) => {
    setItemDialog({
      open: true,
      editing: item._id,
      category: item.category?._id || item.category,
      categoryLocked: true,
      code: item.code || '',
      name: item.name,
      utilityType: item.utilityType,
      meterNumber: item.meterNumber || '',
      location: item.location || '',
      site: item.site || '',
      expenseAccount: item.expenseAccount?._id || item.expenseAccount,
      defaultAmount: item.defaultAmount || 0,
      description: item.description || ''
    });
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
      setItemDialog(emptyItemDialog);
      setSuccess('Item saved');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save item');
    }
  };

  const accountLabel = (acc) => (acc ? `${acc.accountNumber} — ${acc.name}` : '');

  const itemDialogCategory = categories.find((c) => String(c._id) === String(itemDialog.category));

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
        </Stack>
      </Stack>

      <Typography variant="h5" gutterBottom>
        {store?.name || 'Centralized Store'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Each category (Electricity, Gas, Water, Rent, etc.) lists its items below.
        Use <strong>Add Item</strong> under a category, then create bills from <strong>Create Bill</strong> and view them under <strong>Bills</strong>.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Stack direction="row" justifyContent="flex-end" mb={2}>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={() => setCatDialog({ open: true, editing: null, name: '', description: '' })}
        >
          Add category
        </Button>
      </Stack>

      {!categories.length && !loading ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">
              No categories yet. Click &quot;Setup defaults&quot; for Electricity, Gas, Water, Vehicles, Rent, Repair &amp; Maintenance — or add your own.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {categories.map((category) => {
            const catId = String(category._id);
            const categoryItems = itemsByCategoryId.get(catId) || [];
            return (
              <Card
                key={category._id}
                variant="outlined"
                sx={{
                  borderColor: alpha(theme.palette.primary.main, 0.25),
                  overflow: 'hidden'
                }}
              >
                <Box
                  sx={{
                    px: 2,
                    py: 1.5,
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                    <Box>
                      <Typography variant="h6" fontWeight={700}>
                        {category.name}
                      </Typography>
                      {category.description && (
                        <Typography variant="body2" color="text.secondary">
                          {category.description}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {categoryItems.length} item{categoryItems.length === 1 ? '' : 's'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button size="small" startIcon={<AddIcon />} variant="contained" onClick={() => openAddItemForCategory(category)}>
                        Add Item
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setCatDialog({ open: true, editing: category._id, name: category.name, description: category.description || '' })}
                      >
                        Edit
                      </Button>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={async () => {
                          if (!window.confirm(`Delete category "${category.name}" and all its items?`)) return;
                          await centralizedStoreService.deleteCategory(category._id);
                          load();
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </Box>

                <CardContent sx={{ py: 1, '&:last-child': { pb: 1.5 } }}>
                  {categoryItems.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1, pl: 1 }}>
                      No items yet — click Add Item to add Meter 1, Meter 2, etc.
                    </Typography>
                  ) : (
                    <Stack spacing={0}>
                      {categoryItems.map((item) => (
                        <Stack
                          key={item._id}
                          direction="row"
                          justifyContent="space-between"
                          alignItems="flex-start"
                          sx={{
                            py: 1.25,
                            pl: 2,
                            pr: 1,
                            borderLeft: '3px solid',
                            borderLeftColor: alpha(theme.palette.primary.main, 0.35),
                            ml: 0.5,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            '&:last-child': { borderBottom: 'none' }
                          }}
                        >
                          <Box>
                            <Typography fontWeight={600}>{item.name}</Typography>
                            <Typography variant="caption" color="primary" sx={{ fontWeight: 600, display: 'block' }}>
                              Item code: {item.code || '—'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {item.utilityType}
                              {item.meterNumber ? ` · Meter #${item.meterNumber}` : ''}
                              {item.location ? ` · ${item.location}` : ''}
                              {item.site ? ` · ${item.site}` : ''}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              COA: {accountLabel(item.expenseAccount)}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={0.5}>
                            <Button size="small" onClick={() => openEditItem(item)}>Edit</Button>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={async () => {
                                if (!window.confirm(`Delete "${item.name}"?`)) return;
                                await centralizedStoreService.deleteItem(item._id);
                                load();
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
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
            <TextField
              label="Description"
              value={catDialog.description}
              onChange={(e) => setCatDialog({ ...catDialog, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatDialog({ ...catDialog, open: false })}>Cancel</Button>
          <Button variant="contained" onClick={saveCategory}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={itemDialog.open} onClose={() => setItemDialog(emptyItemDialog)} maxWidth="md" fullWidth>
        <DialogTitle>
          {itemDialog.editing ? 'Edit item' : 'Add Item'}
          {itemDialogCategory ? ` — ${itemDialogCategory.name}` : ''}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {!itemDialog.categoryLocked && (
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
            )}
            <Grid item xs={12}>
              {itemDialog.editing ? (
                <TextField
                  label="Item code"
                  value={itemDialog.code}
                  fullWidth
                  disabled
                  helperText="Unique catalog identifier; used as the product code on centralized store bills."
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  A unique item code (CSI-######) is assigned automatically when you save. It is used as the product code on centralized store bills.
                </Typography>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Item name"
                value={itemDialog.name}
                onChange={(e) => setItemDialog({ ...itemDialog, name: e.target.value })}
                required
                fullWidth
                placeholder="e.g. Meter 1, Meter 2"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Utility type</InputLabel>
                <Select
                  value={itemDialog.utilityType}
                  label="Utility type"
                  onChange={(e) => setItemDialog({ ...itemDialog, utilityType: e.target.value })}
                >
                  {UTILITY_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Meter no."
                value={itemDialog.meterNumber}
                onChange={(e) => setItemDialog({ ...itemDialog, meterNumber: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Location"
                value={itemDialog.location}
                onChange={(e) => setItemDialog({ ...itemDialog, location: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Site"
                value={itemDialog.site}
                onChange={(e) => setItemDialog({ ...itemDialog, site: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Chart of accounts (expense)</InputLabel>
                <Select
                  value={itemDialog.expenseAccount}
                  label="Chart of accounts (expense)"
                  onChange={(e) => setItemDialog({ ...itemDialog, expenseAccount: e.target.value })}
                >
                  {expenseAccounts.map((a) => (
                    <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes"
                value={itemDialog.description}
                onChange={(e) => setItemDialog({ ...itemDialog, description: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDialog(emptyItemDialog)}>Cancel</Button>
          <Button variant="contained" onClick={saveItem}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CentralizedStoreManagement;
