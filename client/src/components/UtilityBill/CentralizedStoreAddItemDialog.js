import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography
} from '@mui/material';
import centralizedStoreService from '../../services/centralizedStoreService';

export const mapCategoryToUtilityType = (categoryName = '') => {
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
export const categoryUsesMeter = (categoryName = '') => {
  const n = String(categoryName).toLowerCase();
  return n === 'iesco' || n === 'sngpl' || n.includes('electric') || n.includes('gas');
};

export const emptyCentralizedStoreItemForm = () => ({
  category: '',
  subCategory: '',
  name: '',
  utilityType: 'Electricity',
  meterNumber: '',
  referenceNumber: '',
  location: 'Main Office',
  company: '',
  department: '',
  defaultAmount: 0,
  description: ''
});

const TYPE_ADD_NEW = '__add_new_type__';

/**
 * Same Add Item modal as Centralized Store Setup.
 * When initialCategory / initialSubCategory are provided (bill form), those are preselected.
 * lockCategory keeps them fixed so the item lands in the bill's selected category.
 */
const CentralizedStoreAddItemDialog = ({
  open,
  onClose,
  onCreated,
  categories = [],
  items = [],
  companies = [],
  departments = [],
  utilityTypes: utilityTypesProp = [],
  initialCategory = '',
  initialSubCategory = '',
  initialDepartment = '',
  initialLocation = 'Main Office',
  lockCategory = false,
  title = 'Add item'
}) => {
  const [form, setForm] = useState(emptyCentralizedStoreItemForm());
  const [utilityTypes, setUtilityTypes] = useState(utilityTypesProp || []);
  const [typeDialog, setTypeDialog] = useState({ open: false, name: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const categoryNameById = useMemo(() => {
    const map = new Map();
    (categories || []).forEach((c) => map.set(String(c._id), c.name));
    return map;
  }, [categories]);

  const availableSubCategories = useMemo(() => {
    if (!form.category) return [];
    return (categories || []).filter((c) => {
      const parentId = c.parentCategory?._id || c.parentCategory;
      return String(parentId) === String(form.category);
    });
  }, [categories, form.category]);

  const finalCategoryId = form.subCategory || form.category;
  const selectedCategoryName = categoryNameById.get(String(finalCategoryId)) || '';
  const showMeterField = categoryUsesMeter(selectedCategoryName);
  const showRefField = ['electricity', 'gas', 'water', 'internet'].includes(
    String(form.utilityType || '').toLowerCase()
  );

  useEffect(() => {
    setUtilityTypes(utilityTypesProp || []);
  }, [utilityTypesProp]);

  useEffect(() => {
    if (!open) return;
    setError('');
    const parentId = initialCategory || '';
    const subId = initialSubCategory || '';
    const finalId = subId || parentId;
    const catName = categoryNameById.get(String(finalId)) || '';
    const usesMeter = categoryUsesMeter(catName);
    const countInCat = (items || []).filter(
      (i) => String(i.category?._id || i.category) === String(finalId)
    ).length;
    const nextMeter = countInCat + 1;
    setForm({
      ...emptyCentralizedStoreItemForm(),
      category: parentId,
      subCategory: subId,
      utilityType: mapCategoryToUtilityType(catName),
      name: usesMeter ? `Meter ${nextMeter}` : '',
      meterNumber: usesMeter ? String(nextMeter) : '',
      location: initialLocation || 'Main Office',
      department: initialDepartment || ''
    });
  }, [
    open,
    initialCategory,
    initialSubCategory,
    initialDepartment,
    initialLocation,
    items,
    categoryNameById
  ]);

  const handleCategoryChange = (categoryId) => {
    if (lockCategory) return;
    const catName = categoryNameById.get(String(categoryId)) || '';
    const usesMeter = categoryUsesMeter(catName);
    const countInCat = (items || []).filter(
      (i) => String(i.category?._id || i.category) === String(categoryId)
    ).length;
    const nextMeter = countInCat + 1;
    setForm((prev) => ({
      ...prev,
      category: categoryId,
      subCategory: '',
      utilityType: mapCategoryToUtilityType(catName),
      name: prev.name || (usesMeter ? `Meter ${nextMeter}` : prev.name),
      meterNumber: usesMeter ? (prev.meterNumber || String(nextMeter)) : ''
    }));
  };

  const handleSubCategoryChange = (subCategoryId) => {
    if (lockCategory) return;
    const finalId = subCategoryId || form.category;
    const catName = categoryNameById.get(String(finalId)) || '';
    setForm((prev) => ({
      ...prev,
      subCategory: subCategoryId,
      utilityType: mapCategoryToUtilityType(catName)
    }));
  };

  const handleAddUtilityType = async () => {
    const name = String(typeDialog.name || '').trim();
    if (!name) return;
    try {
      const res = await centralizedStoreService.addUtilityType(name);
      const nextTypes = res?.data?.utilityTypes || [...utilityTypes, name];
      setUtilityTypes(nextTypes);
      setForm((prev) => ({ ...prev, utilityType: name }));
      setTypeDialog({ open: false, name: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add type');
    }
  };

  const handleSave = async () => {
    if (!form.category) {
      setError('Please select a category');
      return;
    }
    if (!String(form.name || '').trim()) {
      setError('Item name is required');
      return;
    }
    try {
      setSaving(true);
      setError('');
      const finalCategory = form.subCategory || form.category;
      const usesMeter = categoryUsesMeter(categoryNameById.get(String(finalCategory)));
      const res = await centralizedStoreService.createItem({
        category: finalCategory,
        name: String(form.name).trim(),
        utilityType: form.utilityType || 'Other',
        meterNumber: usesMeter ? String(form.meterNumber || '').trim() : '',
        referenceNumber: String(form.referenceNumber || '').trim(),
        location: String(form.location || '').trim(),
        company: form.company || null,
        department: form.department || '',
        defaultAmount: Number(form.defaultAmount) || 0,
        description: String(form.description || '').trim()
      });
      const created = res?.data;
      if (!created?._id) {
        throw new Error('Item was not returned from server');
      }
      if (onCreated) onCreated(created);
      if (onClose) onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={() => !saving && onClose?.()} maxWidth="md" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Item code (CSI-######) is assigned automatically when you save.
            {lockCategory
              ? ' Category / sub category are taken from the bill selection.'
              : ''}
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required disabled={lockCategory}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={form.category}
                  label="Category"
                  onChange={(e) => handleCategoryChange(e.target.value)}
                >
                  {(categories || []).filter((c) => !c.parentCategory).map((c) => (
                    <MenuItem key={c._id} value={c._id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl
                fullWidth
                disabled={lockCategory || !form.category || availableSubCategories.length === 0}
              >
                <InputLabel>Sub Category</InputLabel>
                <Select
                  value={form.subCategory || ''}
                  label="Sub Category"
                  onChange={(e) => handleSubCategoryChange(e.target.value)}
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
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                fullWidth
                placeholder="e.g. Meter 1, Main building"
                autoFocus
              />
            </Grid>
            <Grid item xs={12} md={6}>
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
                    setForm((prev) => ({ ...prev, utilityType: e.target.value }));
                  }}
                >
                  {form.utilityType && !(utilityTypes || []).includes(form.utilityType) && (
                    <MenuItem value={form.utilityType}>{form.utilityType}</MenuItem>
                  )}
                  {(utilityTypes || []).map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                  <Divider sx={{ my: 0.5 }} />
                  <MenuItem value={TYPE_ADD_NEW} sx={{ color: 'primary.main', fontWeight: 600 }}>
                    + Add new type...
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {showMeterField && (
              <Grid item xs={12} md={4}>
                <TextField
                  label="Meter no."
                  value={form.meterNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, meterNumber: e.target.value }))}
                  fullWidth
                  placeholder="e.g. 1, 2, 3"
                />
              </Grid>
            )}
            {showRefField && (
              <Grid item xs={12} md={4}>
                <TextField
                  label="Reference no."
                  value={form.referenceNumber || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                  fullWidth
                  placeholder="e.g. 143135..."
                />
              </Grid>
            )}
            <Grid item xs={12} md={4}>
              <TextField
                label="Default amount"
                type="number"
                value={form.defaultAmount}
                onChange={(e) => setForm((prev) => ({ ...prev, defaultAmount: e.target.value }))}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Location"
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
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
            </Grid>
            <Grid item xs={12} md={4}>
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
                  {form.department
                    && !(departments || []).some((d) => d?.name === form.department) && (
                    <MenuItem value={form.department}>{form.department}</MenuItem>
                  )}
                  {(departments || []).map((d) => (
                    <MenuItem key={d?._id || d?.name} value={d?.name}>
                      {d?.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                fullWidth
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose?.()} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !categories.length || !String(form.name || '').trim()}
          >
            {saving ? <CircularProgress size={22} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={typeDialog.open}
        onClose={() => setTypeDialog({ open: false, name: '' })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Add new type</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            autoFocus
            label="Type name"
            value={typeDialog.name}
            onChange={(e) => setTypeDialog((p) => ({ ...p, name: e.target.value }))}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTypeDialog({ open: false, name: '' })}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddUtilityType}
            disabled={!String(typeDialog.name || '').trim()}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CentralizedStoreAddItemDialog;
