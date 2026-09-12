import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  AccountTree as AccountTreeIcon,
  Folder as FolderIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import centralizedStoreService from '../../../services/centralizedStoreService';
import { formatPKR } from '../../../utils/currency';
import { usePagination } from '../../../hooks/usePagination';
import TablePaginationWrapper from '../../../components/TablePaginationWrapper';

const UTILITY_TYPES = ['Electricity', 'Water', 'Gas', 'Internet', 'Phone', 'Maintenance', 'Security', 'Cleaning', 'Rent', 'Other'];

const mapCategoryToUtilityType = (categoryName = '') => {
  const n = String(categoryName).toLowerCase();
  if (n === 'iesco' || n.includes('electric')) return 'Electricity';
  if (n === 'sngpl' || n.includes('gas')) return 'Gas';
  if (n === 'cda water' || n.includes('water')) return 'Water';
  if (n.includes('ptcl') || n.includes('nayatel')) return 'Phone';
  if (n.includes('rent')) return 'Rent';
  if (n.includes('vehicle')) return 'Other';
  if (n.includes('repair') || n.includes('maintain')) return 'Maintenance';
  return 'Other';
};

/** Meter no. applies only to Electricity and Gas categories */
const categoryUsesMeter = (categoryName = '') => {
  const n = String(categoryName).toLowerCase();
  return n === 'iesco' || n === 'sngpl' || n.includes('electric') || n.includes('gas');
};

const emptyItemForm = {
  category: '',
  name: '',
  utilityType: 'Electricity',
  meterNumber: '',
  location: '',
  site: '',
  department: '',
  expenseAccount: '',
  defaultAmount: 0,
  description: ''
};

const emptyEditDialog = {
  open: false,
  editing: null,
  code: '',
  ...emptyItemForm
};

const SITE_ADD_NEW = '__add_new_site__';

const CentralizedStoreManagement = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [catDialog, setCatDialog] = useState({ open: false, editing: null, name: '', description: '', parentCategory: '', chartOfAccount: '' });
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [treeDialogOpen, setTreeDialogOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [editDialog, setEditDialog] = useState(emptyEditDialog);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [siteOptions, setSiteOptions] = useState([]);
  const [siteDialog, setSiteDialog] = useState({ open: false, name: '' });
  const [siteDialogTarget, setSiteDialogTarget] = useState('item');

  const pagination = usePagination({
    defaultRowsPerPage: 25,
    resetDependencies: [categoryFilter]
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await centralizedStoreService.getAll();
      setStore(res.data?.store);
      setCategories(res.data?.categories || []);
      setItems(res.data?.items || []);
      setDepartments(res.data?.departments || []);
      setSiteOptions(res.data?.siteOptions || []);
      const catRes = await centralizedStoreService.getCatalog();
      setExpenseAccounts(catRes.data?.expenseAccounts || []);
      if (!res.data?.departments?.length && catRes.data?.departments?.length) {
        setDepartments(catRes.data.departments);
      }
      if (!res.data?.siteOptions?.length && catRes.data?.siteOptions?.length) {
        setSiteOptions(catRes.data.siteOptions);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load centralized store');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const defaultExpenseAccountId = useMemo(
    () => expenseAccounts.find((a) => a.accountNumber === '6200')?._id || expenseAccounts[0]?._id || '',
    [expenseAccounts]
  );



  const categoryNameById = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(String(c._id), c.name));
    return map;
  }, [categories]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const catA = categoryNameById.get(String(a.category?._id || a.category)) || '';
      const catB = categoryNameById.get(String(b.category?._id || b.category)) || '';
      if (catA !== catB) return catA.localeCompare(catB);
      return (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name);
    });
  }, [items, categoryNameById]);

  const filteredItems = useMemo(() => {
    if (categoryFilter === 'all') return sortedItems;
    return sortedItems.filter(
      (item) => String(item.category?._id || item.category) === String(categoryFilter)
    );
  }, [sortedItems, categoryFilter]);

  useEffect(() => {
    const total = filteredItems.length;
    const maxPage = Math.max(0, Math.ceil(total / pagination.rowsPerPage) - 1);
    if (total > 0 && pagination.page > maxPage) {
      pagination.setPage(maxPage);
    }
  }, [filteredItems.length, pagination.rowsPerPage, pagination.page, pagination.setPage]);

  const pagedItems = useMemo(() => {
    const start = pagination.page * pagination.rowsPerPage;
    return filteredItems.slice(start, start + pagination.rowsPerPage);
  }, [filteredItems, pagination.page, pagination.rowsPerPage]);

  const handleSeed = async () => {
    try {
      const res = await centralizedStoreService.seedDefaults();
      setSuccess(res.message || 'Defaults created');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Seed failed');
    }
  };

  const handleImportUtility2026 = async () => {
    const confirmed = window.confirm(
      'Import 2026 utility data (IESCO, SNGPL, PTCL-Nayatel, CDA Water)?\n\n'
      + 'Existing items with the same name in these categories will be updated.'
    );
    if (!confirmed) return;
    try {
      setSaving(true);
      setError('');
      const res = await centralizedStoreService.importUtility2026(false);
      setSuccess(res.message || '2026 utility data imported');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Import failed');
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async () => {
    if (!catDialog.parentCategory && !catDialog.chartOfAccount) {
      setError('Chart of Account is required for top-level categories');
      return;
    }
    try {
      const body = { name: catDialog.name, description: catDialog.description, parentCategory: catDialog.parentCategory, chartOfAccount: catDialog.chartOfAccount };
      if (catDialog.editing) {
        await centralizedStoreService.updateCategory(catDialog.editing, body);
      } else {
        await centralizedStoreService.createCategory(body);
      }
      setCatDialog({ open: false, editing: null, name: '', description: '', parentCategory: '', chartOfAccount: '' });
      setSuccess('Category saved');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save category');
    }
  };

  const handleCategoryChange = (categoryId) => {
    const cat = categories.find((c) => String(c._id) === String(categoryId));
    const usesMeter = categoryUsesMeter(cat?.name);
    const catItems = items.filter((i) => String(i.category?._id || i.category) === String(categoryId));
    const nextMeter = catItems.length + 1;
    setItemForm((prev) => ({
      ...prev,
      category: categoryId,
      utilityType: mapCategoryToUtilityType(cat?.name),
      name: prev.name || (usesMeter ? `Meter ${nextMeter}` : ''),
      meterNumber: usesMeter ? (prev.meterNumber || String(nextMeter)) : '',
      location: prev.location || 'Main Office'
    }));
  };

  const resetItemForm = (keepCategory = false) => {
    const category = keepCategory ? itemForm.category : '';
    const cat = categories.find((c) => String(c._id) === String(category));
    const usesMeter = categoryUsesMeter(cat?.name);
    const catItems = items.filter((i) => String(i.category?._id || i.category) === String(category));
    const nextMeter = catItems.length + 1;
    setItemForm({
      category,
      name: usesMeter ? `Meter ${nextMeter}` : '',
      utilityType: mapCategoryToUtilityType(cat?.name),
      meterNumber: usesMeter ? String(nextMeter) : '',
      location: 'Main Office',
      site: '',
      department: '',
      expenseAccount: '',
      defaultAmount: 0,
      description: ''
    });
  };

  const buildItemBody = (form) => {
    const usesMeter = categoryUsesMeter(categoryNameById.get(String(form.category)));
    return {
      category: form.category,
      name: form.name,
      utilityType: form.utilityType,
      meterNumber: usesMeter ? form.meterNumber : '',
      location: form.location,
      site: form.site,
      department: form.department,
      expenseAccount: form.expenseAccount,
      defaultAmount: Number(form.defaultAmount) || 0,
      description: form.description
    };
  };

  const saveNewItem = async () => {
    if (!itemForm.category) {
      setError('Please select a category');
      return;
    }
    if (!itemForm.name?.trim()) {
      setError('Item name is required');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await centralizedStoreService.createItem(buildItemBody(itemForm));
      setSuccess('Item added to the list');
      resetItemForm(true);
      setAddItemDialogOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const openEditItem = (item) => {
    setEditDialog({
      open: true,
      editing: item._id,
      code: item.code || '',
      category: item.category?._id || item.category,
      name: item.name,
      utilityType: item.utilityType,
      meterNumber: item.meterNumber || '',
      location: item.location || '',
      site: item.site || '',
      department: item.department || '',
      expenseAccount: item.expenseAccount?._id || item.expenseAccount,
      defaultAmount: item.defaultAmount || 0,
      description: item.description || ''
    });
  };

  const saveEditItem = async () => {
    try {
      setSaving(true);
      await centralizedStoreService.updateItem(editDialog.editing, buildItemBody(editDialog));
      setEditDialog(emptyEditDialog);
      setSuccess('Item updated');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const accountLabel = (acc) => (acc ? `${acc.accountNumber} — ${acc.name}` : '—');

  const openAddSiteDialog = (target) => {
    setSiteDialogTarget(target);
    setSiteDialog({ open: true, name: '' });
  };

  const saveNewSiteOption = async () => {
    const name = siteDialog.name?.trim();
    if (!name) {
      setError('Account name is required');
      return;
    }
    try {
      const res = await centralizedStoreService.addSiteOption(name);
      const options = res.data?.siteOptions || [];
      setSiteOptions(options);
      if (siteDialogTarget === 'edit') {
        setEditDialog((prev) => ({ ...prev, site: name }));
      } else {
        setItemForm((prev) => ({ ...prev, site: name }));
      }
      setSiteDialog({ open: false, name: '' });
      setSuccess(`Account "${name}" added`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add account');
    }
  };

  const renderDepartmentField = (form, setForm) => (
    <FormControl fullWidth>
      <InputLabel>Department</InputLabel>
      <Select
        value={form.department || ''}
        label="Department"
        onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
      >
        <MenuItem value="">
          <em>Select department</em>
        </MenuItem>
        {form.department && !(departments || []).some((d) => d?.name === form.department) && (
          <MenuItem value={form.department}>{form.department}</MenuItem>
        )}
        {(departments || []).map((d) => (
          <MenuItem key={d?._id || d?.name} value={d?.name}>
            {d?.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  const renderAccountField = (form, setForm, isEdit = false) => (
    <FormControl fullWidth>
      <InputLabel>Account</InputLabel>
      <Select
        value={form.site || ''}
        label="Account"
        onChange={(e) => {
          if (e.target.value === SITE_ADD_NEW) {
            openAddSiteDialog(isEdit ? 'edit' : 'item');
            return;
          }
          setForm((prev) => ({ ...prev, site: e.target.value }));
        }}
      >
        <MenuItem value="">
          <em>Select account</em>
        </MenuItem>
        {form.site && !(siteOptions || []).includes(form.site) && (
          <MenuItem value={form.site}>{form.site}</MenuItem>
        )}
        {(siteOptions || []).map((site) => (
          <MenuItem key={site} value={site}>
            {site}
          </MenuItem>
        ))}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem value={SITE_ADD_NEW} sx={{ color: 'primary.main', fontWeight: 600 }}>
          + Add new account…
        </MenuItem>
      </Select>
    </FormControl>
  );

  const handleEditCategoryChange = (categoryId, setForm) => {
    const cat = categories.find((c) => String(c._id) === String(categoryId));
    const usesMeter = categoryUsesMeter(cat?.name);
    setForm((prev) => ({
      ...prev,
      category: categoryId,
      utilityType: mapCategoryToUtilityType(cat?.name),
      meterNumber: usesMeter ? prev.meterNumber : ''
    }));
  };

  const renderItemFields = (form, setForm, { showCode = false, code = '', isEdit = false } = {}) => {
    const selectedCategoryName = categoryNameById.get(String(form.category)) || '';
    const showMeterField = categoryUsesMeter(selectedCategoryName);
    const fieldCol = showCode ? 6 : showMeterField ? 4 : 6;

    return (
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth required>
            <InputLabel>Category</InputLabel>
            <Select
              value={form.category}
              label="Category"
              onChange={(e) => {
                if (isEdit) {
                  handleEditCategoryChange(e.target.value, setForm);
                } else {
                  handleCategoryChange(e.target.value);
                }
              }}
            >
              {categories.map((c) => {
                const isSub = Boolean(c.parentCategory);
                const parentName = isSub ? (c.parentCategory?.name || '') : '';
                return (
                  <MenuItem key={c._id} value={c._id}>
                    {isSub ? `${parentName} > ${c.name}` : c.name}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="Item name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            fullWidth
            placeholder="e.g. Meter 1, Main building"
          />
        </Grid>
        {showCode && (
          <Grid item xs={12} md={6}>
            <TextField label="Item code" value={code} fullWidth disabled />
          </Grid>
        )}
        <Grid item xs={12} md={fieldCol}>
          <FormControl fullWidth>
            <InputLabel>Utility type</InputLabel>
            <Select
              value={form.utilityType}
              label="Utility type"
              onChange={(e) => setForm({ ...form, utilityType: e.target.value })}
            >
              {UTILITY_TYPES.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        {showMeterField && (
          <Grid item xs={12} md={fieldCol}>
            <TextField
              label="Meter no."
              value={form.meterNumber}
              onChange={(e) => setForm({ ...form, meterNumber: e.target.value })}
              fullWidth
              placeholder="e.g. 1, 2, 3"
            />
          </Grid>
        )}
        <Grid item xs={12} md={fieldCol}>
          <TextField
            label="Default amount"
            type="number"
            value={form.defaultAmount}
            onChange={(e) => setForm({ ...form, defaultAmount: e.target.value })}
            fullWidth
            inputProps={{ min: 0, step: 0.01 }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={4}>
          {renderAccountField(form, setForm, isEdit)}
        </Grid>
        <Grid item xs={12} md={4}>
          {renderDepartmentField(form, setForm)}
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Notes"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            fullWidth
            multiline
            rows={2}
          />
        </Grid>
      </Grid>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => {
            if (window.location.pathname.startsWith('/general')) {
              navigate('/general/centralized-store/bills');
            } else {
              navigate('/admin/utility-bills');
            }
          }}
        >
          {window.location.pathname.startsWith('/general') ? 'Back to Bills' : 'Back to Utility Bills'}
        </Button>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button variant="outlined" onClick={handleImportUtility2026} disabled={saving || loading}>
            Import 2026 utilities
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
        Select a category, fill in the item details below, and save — the record appears in the items list.
        Use saved items when creating centralized store bills.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} mb={2}>
        <Typography variant="subtitle1" fontWeight={600}>
          Categories ({categories.length})
        </Typography>
        <Stack direction="row" gap={1}>
          <Button
            startIcon={<AccountTreeIcon />}
            variant="outlined"
            color="secondary"
            onClick={() => setTreeDialogOpen(true)}
          >
            View Hierarchy
          </Button>
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            onClick={() => setCatDialog({ open: true, editing: null, name: '', description: '', parentCategory: '', chartOfAccount: '' })}
          >
            Add category
          </Button>
        </Stack>
      </Stack>

      {categories.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={1} mb={3}>
          {categories.map((category) => (
            <Chip
              key={category._id}
              label={category.parentCategory ? `${category.parentCategory.name} > ${category.name}` : category.name}
              onClick={() => handleCategoryChange(category._id)}
              onDelete={async () => {
                if (!window.confirm(`Delete category "${category.name}" and all its items?`)) return;
                await centralizedStoreService.deleteCategory(category._id);
                load();
              }}
              color={String(itemForm.category) === String(category._id) ? 'primary' : 'default'}
              variant={String(itemForm.category) === String(category._id) ? 'filled' : 'outlined'}
            />
          ))}
        </Stack>
      )}

      {!categories.length && !loading && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography color="text.secondary">
              No categories yet. Click &quot;Setup defaults&quot; or &quot;Add category&quot; to get started.
            </Typography>
          </CardContent>
        </Card>
      )}

      <Dialog open={addItemDialogOpen} onClose={() => setAddItemDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add item</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Item code (CSI-######) is assigned automatically when you save.
          </Typography>
          {renderItemFields(itemForm, setItemForm)}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { resetItemForm(false); setAddItemDialogOpen(false); }} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveNewItem} disabled={saving || !categories.length}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} mb={1.5}>
        <Typography variant="h6" fontWeight={700}>
          Items list ({filteredItems.length})
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => setAddItemDialogOpen(true)}
            disabled={!categories.length}
          >
            Add item
          </Button>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Filter by category</InputLabel>
            <Select
              value={categoryFilter}
              label="Filter by category"
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="all">All categories</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c._id} value={c._id}>
                  {c.parentCategory ? `${c.parentCategory.name} > ${c.name}` : c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
              <TableCell><strong>Category</strong></TableCell>
              <TableCell><strong>Code</strong></TableCell>
              <TableCell><strong>Item name</strong></TableCell>
              <TableCell><strong>Type</strong></TableCell>
              <TableCell><strong>Meter</strong></TableCell>
              <TableCell><strong>Location</strong></TableCell>
              <TableCell><strong>Account</strong></TableCell>
              <TableCell align="right"><strong>Amount</strong></TableCell>
              <TableCell><strong>COA</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  Loading…
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }} color="text.secondary">
                  No items yet. Select a category above, fill the form, and click Save to list.
                </TableCell>
              </TableRow>
            ) : (
              pagedItems.map((item) => {
                const catId = String(item.category?._id || item.category);
                return (
                  <TableRow key={item._id} hover>
                    <TableCell>{categoryNameById.get(catId) || '—'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="primary" fontWeight={600}>
                        {item.code || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.utilityType}</TableCell>
                    <TableCell>{item.meterNumber || '—'}</TableCell>
                    <TableCell>{item.location || '—'}</TableCell>
                    <TableCell>{item.site || '—'}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {formatPKR(item.defaultAmount || 0)}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 180 }}>
                      <Typography variant="caption" noWrap title={accountLabel(item.expenseAccount)}>
                        {accountLabel(item.expenseAccount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEditItem(item)} aria-label="Edit item">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={async () => {
                          if (!window.confirm(`Delete "${item.name}"?`)) return;
                          await centralizedStoreService.deleteItem(item._id);
                          load();
                        }}
                        aria-label="Delete item"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredItems.length > 0 && (
        <TablePaginationWrapper
          page={pagination.page}
          rowsPerPage={pagination.rowsPerPage}
          total={filteredItems.length}
          onPageChange={pagination.handleChangePage}
          onRowsPerPageChange={pagination.handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
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
            <FormControl fullWidth>
              <InputLabel>Parent Category (Optional)</InputLabel>
              <Select
                value={catDialog.parentCategory || ''}
                label="Parent Category (Optional)"
                onChange={(e) => setCatDialog({ ...catDialog, parentCategory: e.target.value })}
              >
                <MenuItem value=""><em>None (Top Level)</em></MenuItem>
                {categories.filter(c => !c.parentCategory && c._id !== catDialog.editing).map((c) => (
                  <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required={!catDialog.parentCategory}>
              <InputLabel>Chart of Account {!catDialog.parentCategory ? '' : '(Optional)'}</InputLabel>
              <Select
                value={catDialog.chartOfAccount || ''}
                label={`Chart of Account ${!catDialog.parentCategory ? '' : '(Optional)'}`}
                onChange={(e) => setCatDialog({ ...catDialog, chartOfAccount: e.target.value })}
              >
                <MenuItem value=""><em>{catDialog.parentCategory ? 'Inherit' : 'Select an account'}</em></MenuItem>
                {expenseAccounts.map((a) => (
                  <MenuItem key={a._id} value={a._id}>{accountLabel(a)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatDialog({ ...catDialog, open: false })}>Cancel</Button>
          <Button variant="contained" onClick={saveCategory}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialog.open} onClose={() => setEditDialog(emptyEditDialog)} maxWidth="md" fullWidth>
        <DialogTitle>Edit item</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            {renderItemFields(editDialog, setEditDialog, { showCode: true, code: editDialog.code, isEdit: true })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(emptyEditDialog)}>Cancel</Button>
          <Button variant="contained" onClick={saveEditItem} disabled={saving}>
            {saving ? 'Saving…' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={siteDialog.open} onClose={() => setSiteDialog({ open: false, name: '' })} maxWidth="xs" fullWidth>
        <DialogTitle>Add account option</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Account name"
            value={siteDialog.name}
            onChange={(e) => setSiteDialog({ ...siteDialog, name: e.target.value })}
            fullWidth
            sx={{ mt: 1 }}
            placeholder="e.g. SGC, Head Office"
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveNewSiteOption();
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            This account will be saved and available in the dropdown for all future items.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSiteDialog({ open: false, name: '' })}>Cancel</Button>
          <Button onClick={saveNewSiteOption} variant="contained" disabled={saving}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Category Tree Dialog */}
      <Dialog open={treeDialogOpen} onClose={() => setTreeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Category Hierarchy</DialogTitle>
        <DialogContent dividers>
          <List>
            {categories.filter(c => !c.parentCategory).map(parent => {
              const children = categories.filter(c => c.parentCategory?._id === parent._id);
              const isExpanded = expandedNodes[parent._id];
              return (
                <React.Fragment key={parent._id}>
                  <ListItem 
                    button 
                    onClick={() => setExpandedNodes(prev => ({ ...prev, [parent._id]: !isExpanded }))}
                  >
                    <ListItemIcon>
                      <FolderIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={parent.name} 
                      secondary={parent.chartOfAccount ? `COA: ${parent.chartOfAccount.accountNumber}` : 'No COA'} 
                    />
                    {children.length > 0 ? (isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />) : null}
                  </ListItem>
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {children.map(child => (
                        <ListItem key={child._id} sx={{ pl: 4 }}>
                          <ListItemIcon>
                            <FolderIcon color="action" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText 
                            primary={child.name} 
                            secondary={child.chartOfAccount ? `COA: ${child.chartOfAccount.accountNumber}` : 'Inherited COA'} 
                          />
                        </ListItem>
                      ))}
                      {children.length === 0 && (
                        <ListItem sx={{ pl: 4 }}>
                          <ListItemText secondary="No subcategories" />
                        </ListItem>
                      )}
                    </List>
                  </Collapse>
                </React.Fragment>
              );
            })}
            {categories.filter(c => !c.parentCategory).length === 0 && (
              <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 3 }}>
                No categories found.
              </Typography>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTreeDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CentralizedStoreManagement;
