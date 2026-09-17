import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
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
  Folder as FolderIcon,
  Refresh as RefreshIcon,
  Category as CategoryIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import centralizedStoreService from '../../../services/centralizedStoreService';
import { formatPKR } from '../../../utils/currency';
import { usePagination } from '../../../hooks/usePagination';
import TablePaginationWrapper from '../../../components/TablePaginationWrapper';


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
  subCategory: '',
  name: '',
  utilityType: 'Electricity',
  meterNumber: '',
  referenceNumber: '',
  location: '',
  company: '',
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

const TYPE_ADD_NEW = '__add_new_type__';

const CentralizedStoreManagement = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [catDialog, setCatDialog] = useState({ open: false, editing: null, name: '', description: '', parentCategory: '', chartOfAccount: '', company: '' });
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [treeDialogOpen, setTreeDialogOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [editDialog, setEditDialog] = useState(emptyEditDialog);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [subCategoryFilter, setSubCategoryFilter] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [utilityTypes, setUtilityTypes] = useState([]);
  const [typeDialog, setTypeDialog] = useState({ open: false, name: '' });

  const pagination = usePagination({
    defaultRowsPerPage: 25,
    resetDependencies: [categoryFilter, subCategoryFilter]
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
      setUtilityTypes(res.data?.utilityTypes || []);
      setCompanies(res.data?.companies || []);
      setAllAccounts(res.data?.accounts || []);
      const catRes = await centralizedStoreService.getCatalog();
      setExpenseAccounts(catRes.data?.expenseAccounts || []);
      if (!res.data?.companies?.length && catRes.data?.companies?.length) {
        setCompanies(catRes.data.companies);
      }
      if (!res.data?.accounts?.length && catRes.data?.accounts?.length) {
        setAllAccounts(catRes.data.accounts);
      }
      if (!res.data?.departments?.length && catRes.data?.departments?.length) {
        setDepartments(catRes.data.departments);
      }
      if (!res.data?.utilityTypes?.length && catRes.data?.utilityTypes?.length) {
        setUtilityTypes(catRes.data.utilityTypes);
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

  const availableCategoryAccounts = useMemo(() => {
    const sourceAccounts = allAccounts.length > 0 ? allAccounts : expenseAccounts;
    if (!catDialog.company || catDialog.company === 'all') {
      return sourceAccounts;
    }
    return sourceAccounts.filter((acc) => {
      const compId = acc.companyId?._id || acc.companyId;
      return String(compId) === String(catDialog.company) || !compId;
    });
  }, [allAccounts, expenseAccounts, catDialog.company]);




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
    
    // First, determine all valid category IDs that belong to the selected top-level category
    const validCatIds = categories
      .filter(c => String(c._id) === categoryFilter || String(c.parentCategory?._id || c.parentCategory) === categoryFilter)
      .map(c => String(c._id));

    return sortedItems.filter((item) => {
      const itemCatId = String(item.category?._id || item.category);
      if (subCategoryFilter && subCategoryFilter !== 'all') {
        return itemCatId === subCategoryFilter;
      }
      return validCatIds.includes(itemCatId);
    });
  }, [sortedItems, categoryFilter, subCategoryFilter, categories]);

  useEffect(() => {
    const total = filteredItems.length;
    const maxPage = Math.max(0, Math.ceil(total / pagination.rowsPerPage) - 1);
    if (total > 0 && pagination.page > maxPage) {
      pagination.setPage(maxPage);
    }
  }, [filteredItems.length, pagination]);

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
      const body = {
        name: catDialog.name,
        description: catDialog.description,
        parentCategory: catDialog.parentCategory,
        chartOfAccount: catDialog.chartOfAccount,
        company: catDialog.company || null
      };
      if (catDialog.editing) {
        await centralizedStoreService.updateCategory(catDialog.editing, body);
      } else {
        await centralizedStoreService.createCategory(body);
      }
      setCatDialog({ open: false, editing: null, name: '', description: '', parentCategory: '', chartOfAccount: '', company: '' });
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
      subCategory: '',
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
      subCategory: '',
      name: usesMeter ? `Meter ${nextMeter}` : '',
      utilityType: mapCategoryToUtilityType(cat?.name),
      meterNumber: usesMeter ? String(nextMeter) : '',
      referenceNumber: '',
      location: 'Main Office',
      company: '',
      department: '',
      expenseAccount: '',
      defaultAmount: 0,
      description: ''
    });
  };

  const buildItemBody = (form) => {
    const finalCategory = form.subCategory || form.category;
    const usesMeter = categoryUsesMeter(categoryNameById.get(String(finalCategory)));
    return {
      category: finalCategory,
      name: form.name,
      utilityType: form.utilityType,
      meterNumber: usesMeter ? form.meterNumber : '',
      referenceNumber: form.referenceNumber || '',
      location: form.location,
      company: form.company,
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
    let catId = item.category?._id || item.category;
    let parentCatId = '';
    let subCatId = '';

    const catObj = categories.find(c => String(c._id) === String(catId));
    if (catObj && catObj.parentCategory) {
      subCatId = catId;
      parentCatId = catObj.parentCategory._id || catObj.parentCategory;
    } else {
      parentCatId = catId;
    }

    setEditDialog({
      open: true,
      editing: item._id,
      code: item.code || '',
      category: parentCatId || '',
      subCategory: subCatId || '',
      name: item.name,
      utilityType: item.utilityType,
      meterNumber: item.meterNumber || '',
      referenceNumber: item.referenceNumber || '',
      location: item.location || '',
      company: item.company?._id || item.company || '',
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



  const saveNewType = async () => {
    const name = typeDialog.name?.trim();
    if (!name) {
      setError('Type name is required');
      return;
    }
    try {
      const res = await centralizedStoreService.addUtilityType(name);
      const types = res.data?.utilityTypes || [];
      setUtilityTypes(types);
      setItemForm((prev) => ({ ...prev, utilityType: name }));
      setTypeDialog({ open: false, name: '' });
      setSuccess(`Type "${name}" added`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add type');
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

  const renderCompanyField = (form, setForm) => (
    <FormControl fullWidth>
      <InputLabel>Company</InputLabel>
      <Select
        value={form.company || ''}
        label="Company"
        onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
      >
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
        {(companies || []).map((c) => (
          <MenuItem key={c._id} value={c._id}>
            {c.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  const handleEditCategoryChange = (categoryId, setForm) => {
    const cat = categories.find((c) => String(c._id) === String(categoryId));
    const usesMeter = categoryUsesMeter(cat?.name);
    setForm((prev) => ({
      ...prev,
      category: categoryId,
      subCategory: '',
      utilityType: mapCategoryToUtilityType(cat?.name),
      meterNumber: usesMeter ? prev.meterNumber : ''
    }));
  };

  const renderItemFields = (form, setForm, { showCode = false, code = '', isEdit = false } = {}) => {
    const finalCat = form.subCategory || form.category;
    const selectedCategoryName = categoryNameById.get(String(finalCat)) || '';
    const showMeterField = categoryUsesMeter(selectedCategoryName);
    const showRefField = ['electricity', 'gas', 'water', 'internet'].includes((form.utilityType || '').toLowerCase());
    const fieldCol = showCode ? 6 : 4;

    const availableSubCategories = categories.filter(c => {
      const parentId = c.parentCategory?._id || c.parentCategory;
      return String(parentId) === String(form.category);
    });

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
              {categories.filter(c => !c.parentCategory).map((c) => (
                <MenuItem key={c._id} value={c._id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth disabled={!form.category || availableSubCategories.length === 0}>
            <InputLabel>Sub Category</InputLabel>
            <Select
              value={form.subCategory || ''}
              label="Sub Category"
              onChange={(e) => setForm(prev => ({ ...prev, subCategory: e.target.value }))}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {availableSubCategories.map((c) => (
                <MenuItem key={c._id} value={c._id}>
                  {c.name}
                </MenuItem>
              ))}
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
            <InputLabel>Type</InputLabel>
            <Select
              value={form.utilityType || ''}
              label="Type"
              onChange={(e) => {
                if (e.target.value === TYPE_ADD_NEW) {
                  setTypeDialog({ open: true, name: '' });
                  return;
                }
                setForm({ ...form, utilityType: e.target.value });
              }}
            >
              {form.utilityType && !(utilityTypes || []).includes(form.utilityType) && (
                <MenuItem value={form.utilityType}>{form.utilityType}</MenuItem>
              )}
              {(utilityTypes || []).map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
              <Divider sx={{ my: 0.5 }} />
              <MenuItem value={TYPE_ADD_NEW} sx={{ color: 'primary.main', fontWeight: 600 }}>
                + Add new type...
              </MenuItem>
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
        {showRefField && (
          <Grid item xs={12} md={fieldCol}>
            <TextField
              label="Reference no."
              value={form.referenceNumber || ''}
              onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
              fullWidth
              placeholder="e.g. 143135..."
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
          {renderCompanyField(form, setForm)}
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

  const renderCategoryNode = (category, level = 0) => {
    const children = categories.filter(c => {
      const parentId = c.parentCategory?._id || c.parentCategory;
      return String(parentId) === String(category._id);
    });
    const isExpanded = expandedNodes[category._id];
    
    return (
      <React.Fragment key={category._id}>
        <ListItem 
          button 
          onClick={() => setExpandedNodes(prev => ({ ...prev, [category._id]: !isExpanded }))}
          sx={{ 
            pl: 2 + level * 4, 
            pr: 2,
            py: 1.5,
            borderBottom: level > 0 ? '1px dashed' : 'none', 
            borderColor: 'divider',
            transition: 'background-color 0.2s',
            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) }
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <FolderIcon color={level === 0 ? "primary" : "action"} fontSize={level === 0 ? "medium" : "small"} />
          </ListItemIcon>
          
          <ListItemText 
            primary={
              <Typography variant={level === 0 ? "subtitle1" : "body2"} fontWeight={level === 0 ? 700 : 500} color={level === 0 ? "text.primary" : "text.secondary"}>
                {category.name}
              </Typography>
            }
          />
          
          <Stack direction="row" spacing={1} alignItems="center" onClick={e => e.stopPropagation()}>
            {category.chartOfAccount && (
              <Chip 
                size="small" 
                label={`COA: ${category.chartOfAccount.accountNumber || accountLabel(category.chartOfAccount).split(' — ')[0]}`} 
                color={level === 0 ? "primary" : "default"}
                variant={level === 0 ? "filled" : "outlined"}
                sx={{ mr: 1, fontWeight: 500 }}
              />
            )}
            <IconButton aria-label="edit" size="small" sx={{ color: 'text.secondary' }} onClick={(e) => {
              e.stopPropagation();
              setCatDialog({
                open: true,
                editing: category._id,
                name: category.name,
                description: category.description || '',
                parentCategory: category.parentCategory?._id || category.parentCategory || '',
                chartOfAccount: category.chartOfAccount?._id || category.chartOfAccount || '',
                company: category.company?._id || category.company || category.chartOfAccount?.companyId?._id || category.chartOfAccount?.companyId || ''
              });
            }}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton aria-label="delete" size="small" color="error" onClick={async (e) => {
              e.stopPropagation();
              if (!window.confirm(`Delete category "${category.name}" and all its items?`)) return;
              await centralizedStoreService.deleteCategory(category._id);
              load();
            }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>

          {children.length > 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
              {isExpanded ? <ExpandMoreIcon color="action" /> : <ChevronRightIcon color="action" />}
            </Box>
          ) : (
            <Box sx={{ width: 24, ml: 1 }} />
          )}
        </ListItem>
        
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List component="div" disablePadding sx={{ bgcolor: alpha(theme.palette.action.hover, 0.2) }}>
            {children.map(child => renderCategoryNode(child, level + 1))}
            {children.length === 0 && level === 0 && (
              <ListItem sx={{ pl: 2 + (level + 1) * 4, py: 2 }}>
                <ListItemText primary={<Typography variant="body2" color="text.disabled" fontStyle="italic">No subcategories</Typography>} />
              </ListItem>
            )}
          </List>
        </Collapse>
      </React.Fragment>
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
            startIcon={<CategoryIcon />}
            variant="outlined"
            color="secondary"
            onClick={() => setTreeDialogOpen(true)}
          >
            View Categories
          </Button>
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            onClick={() => setCatDialog({ open: true, editing: null, name: '', description: '', parentCategory: '', chartOfAccount: '', company: '' })}
          >
            Add category
          </Button>
        </Stack>
      </Stack>



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
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setSubCategoryFilter('all');
              }}
            >
              <MenuItem value="all">All categories</MenuItem>
              {categories.filter(c => !c.parentCategory).map((c) => (
                <MenuItem key={c._id} value={c._id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {categoryFilter !== 'all' && categories.filter(c => String(c.parentCategory?._id || c.parentCategory) === String(categoryFilter)).length > 0 && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Sub Category</InputLabel>
              <Select
                value={subCategoryFilter}
                label="Sub Category"
                onChange={(e) => setSubCategoryFilter(e.target.value)}
              >
                <MenuItem value="all">All sub categories</MenuItem>
                {categories
                  .filter(c => String(c.parentCategory?._id || c.parentCategory) === String(categoryFilter))
                  .map((c) => (
                    <MenuItem key={c._id} value={c._id}>
                      {c.name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          )}
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
              <TableCell><strong>Ref No.</strong></TableCell>
              <TableCell><strong>Location</strong></TableCell>
              <TableCell><strong>Company</strong></TableCell>
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
                    <TableCell>{item.referenceNumber || '—'}</TableCell>
                    <TableCell>{item.location || '—'}</TableCell>
                    <TableCell>{item.company?.name || '—'}</TableCell>
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

            <FormControl fullWidth>
              <InputLabel>Company (Chart of Accounts Filter)</InputLabel>
              <Select
                value={catDialog.company || ''}
                label="Company (Chart of Accounts Filter)"
                onChange={(e) => setCatDialog((prev) => ({ ...prev, company: e.target.value }))}
              >
                <MenuItem value=""><em>All Companies / General</em></MenuItem>
                {companies.map((comp) => (
                  <MenuItem key={comp._id} value={comp._id}>
                    {comp.name} {comp.companyCode ? `(${comp.companyCode})` : ''}
                  </MenuItem>
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
                {availableCategoryAccounts.map((a) => {
                  const isSub = Boolean(a.parentAccount);
                  return (
                    <MenuItem
                      key={a._id}
                      value={a._id}
                      sx={{
                        pl: isSub ? 4 : 2,
                        fontWeight: isSub ? 400 : 600,
                        color: isSub ? 'text.secondary' : 'text.primary'
                      }}
                    >
                      {isSub ? `↳ ${a.accountNumber} — ${a.name} (Sub-account)` : `${a.accountNumber} — ${a.name}`}
                    </MenuItem>
                  );
                })}
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1, display: 'block' }}>
                {catDialog.company
                  ? `Showing accounts for selected company (${availableCategoryAccounts.length} accounts including sub-accounts)`
                  : `Showing all chart of accounts (${availableCategoryAccounts.length} accounts including sub-accounts)`}
              </Typography>
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



      <Dialog open={typeDialog.open} onClose={() => setTypeDialog({ open: false, name: '' })} maxWidth="xs" fullWidth>
        <DialogTitle>Add New Type</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Type Name"
            fullWidth
            value={typeDialog.name}
            onChange={(e) => setTypeDialog({ ...typeDialog, name: e.target.value })}
            autoFocus
            placeholder="e.g. Maintenance, Electricity..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTypeDialog({ open: false, name: '' })}>Cancel</Button>
          <Button variant="contained" onClick={saveNewType}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Category Tree Dialog */}
      <Dialog open={treeDialogOpen} onClose={() => setTreeDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h5" fontWeight="bold">Store Categories</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your centralized store categories and their chart of accounts.
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: 'grey.50', p: 3 }}>
          <List sx={{ p: 0 }}>
            {categories.filter(c => !c.parentCategory).map(parent => (
              <Paper key={parent._id} variant="outlined" sx={{ mb: 2, overflow: 'hidden', bgcolor: 'background.paper', borderRadius: 2 }}>
                {renderCategoryNode(parent, 0)}
              </Paper>
            ))}
            {categories.filter(c => !c.parentCategory).length === 0 && (
              <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 3 }}>
                No categories found.
              </Typography>
            )}
          </List>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="outlined" onClick={() => setTreeDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CentralizedStoreManagement;
