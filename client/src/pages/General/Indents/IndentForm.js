import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
  Autocomplete,
  Popper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  IconButton,
  Divider,
  Chip
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import indentService from '../../../services/indentService';
import api from '../../../services/api';
import dayjs from 'dayjs';

const WidePopper = (props) => {
  const { style, ...rest } = props;
  return (
    <Popper
      {...rest}
      placement="bottom-start"
      style={{
        width: typeof window !== 'undefined' && window.innerWidth < 900 ? 'calc(100vw - 32px)' : 720,
        ...style
      }}
    />
  );
};

const IndentForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { departments, fetchDepartments } = useData();
  const fetchDepartmentsRef = useRef(fetchDepartments);
  const departmentsRef = useRef(departments);
  fetchDepartmentsRef.current = fetchDepartments;
  departmentsRef.current = departments;
  const isEdit = !!id;
  const hasRunCreateLoad = useRef(false);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [itemCategories, setItemCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [itemOptions, setItemOptions] = useState([]);
  const [itemOptionsLoading, setItemOptionsLoading] = useState(false);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [erpRefError, setErpRefError] = useState('');
  const [erpRefChecking, setErpRefChecking] = useState(false);
  const erpRefDebounceRef = useRef(null);
  const [indentNoError, setIndentNoError] = useState('');
  const [indentNoChecking, setIndentNoChecking] = useState(false);
  const indentNoDebounceRef = useRef(null);
  const itemOptionsReqSeq = useRef(0);
  const lastLoadedCategoryRef = useRef('');
  const approverSearchDebounceRef = useRef(null);

  const [indentMeta, setIndentMeta] = useState({ status: null, approvalChain: [] });
  const [approverSlots, setApproverSlots] = useState([null, null, null]);
  const [approverSearchOptions, setApproverSearchOptions] = useState([]);
  const [approverSearchLoading, setApproverSearchLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    erpRef: '',
    date: dayjs().format('YYYY-MM-DD'),
    requiredDate: '',
    indentNumber: '',
    department: '',
    originator: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : '',
    items: [],
    justification: '',
    priority: 'Medium',
    category: '',
    signatures: {
      requester: { name: '', date: '' },
      headOfDepartment: { name: '', date: '' },
      gmPd: { name: '', date: '' },
      svpAvp: { name: '', date: '' }
    }
  });

  // Reset create-load flag when switching to edit
  useEffect(() => {
    if (isEdit) hasRunCreateLoad.current = false;
  }, [isEdit]);

  // Populate originator when user becomes available (fixes issue where user loads after form mount, e.g. non-superusers)
  useEffect(() => {
    if (isEdit || !user) return;
    const name = (user.firstName && user.lastName)
      ? `${user.firstName} ${user.lastName}`.trim()
      : (user.fullName || user.email || '').trim();
    if (name) {
      setFormData((prev) => {
        if (prev.originator?.trim()) return prev;
        return {
          ...prev,
          originator: name,
          signatures: {
            ...prev.signatures,
            requester: {
              ...prev.signatures?.requester,
              name: prev.signatures?.requester?.name?.trim() || name
            }
          }
        };
      });
    }
  }, [user, isEdit]);

  const loadDepartmentsForIndent = useCallback(async () => {
    setDepartmentsLoading(true);
    try {
      const res = await api.get('/indents/departments');
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      if (list.length > 0) {
        setDepartmentOptions(list);
        return list;
      }
    } catch {
      // fallback below
    } finally {
      setDepartmentsLoading(false);
    }
    const fallback = await fetchDepartmentsRef.current(true);
    const out = Array.isArray(fallback) ? fallback : [];
    setDepartmentOptions(out);
    return out;
  }, []);

  // Load indent data if editing, or run next-number/next-erp-ref + departments once for create
  useEffect(() => {
    const loadData = async () => {
      if (isEdit) {
        try {
          setLoadingData(true);
          const response = await indentService.getIndentById(id);
          const indent = response.data;
          
          setIndentMeta({
            status: indent.status || null,
            approvalChain: Array.isArray(indent.approvalChain) ? indent.approvalChain : []
          });
          const draftApprovers = (indent.draftApproverIds || []).slice(0, 3);
          const slots = [0, 1, 2].map((i) => {
            const u = draftApprovers[i];
            return u && typeof u === 'object' && u._id ? u : null;
          });
          setApproverSlots(slots);

          setFormData({
            title: indent.title || '',
            erpRef: indent.erpRef || '',
            date: indent.requestedDate ? dayjs(indent.requestedDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
            requiredDate: indent.requiredDate ? dayjs(indent.requiredDate).format('YYYY-MM-DD') : '',
            indentNumber: indent.indentNumber || '',
            department: indent.department?._id || '',
            originator: indent.requestedBy?.firstName && indent.requestedBy?.lastName 
              ? `${indent.requestedBy.firstName} ${indent.requestedBy.lastName}` 
              : '',
            items: indent.items?.map(item => ({
              ...item,
              brand: item.brand || '',
              estimatedCost: item.estimatedCost ?? 0
            })) || [],
            justification: indent.justification || '',
            priority: indent.priority || 'Medium',
            category: indent.category || 'Other',
            signatures: indent.signatures || {
              requester: { name: '', date: '' },
              headOfDepartment: { name: '', date: '' },
              gmPd: { name: '', date: '' },
              svpAvp: { name: '', date: '' }
            }
          });
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to load indent');
        } finally {
          setLoadingData(false);
        }
        if (departmentsRef.current.length === 0) {
          await loadDepartmentsForIndent();
        }
        return;
      }

      // Create: run only once per mount so we don't loop (fetchDepartments/departments change triggers re-run otherwise)
      if (hasRunCreateLoad.current) return;
      hasRunCreateLoad.current = true;

      try {
        const [indentResponse, erpRefResponse] = await Promise.all([
          indentService.getNextIndentNumber(),
          indentService.getNextERPRef()
        ]);
        if (indentResponse.data?.nextIndentNumber) {
          setFormData(prev => ({ ...prev, indentNumber: indentResponse.data.nextIndentNumber }));
        }
        if (erpRefResponse.data?.nextERPRef) {
          setFormData(prev => ({ ...prev, erpRef: erpRefResponse.data.nextERPRef }));
        }
      } catch (err) {
        // If API fails, backend will generate on save
      }

      if (departmentsRef.current.length === 0) {
        await loadDepartmentsForIndent();
      }
    };

    loadData();
  }, [id, isEdit, loadDepartmentsForIndent]);

  useEffect(() => {
    if (Array.isArray(departments) && departments.length > 0) {
      setDepartmentOptions((prev) => (prev.length > 0 ? prev : departments));
    }
  }, [departments]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (field === 'erpRef') {
      setErpRefError('');
      if (erpRefDebounceRef.current) clearTimeout(erpRefDebounceRef.current);
      const trimmed = String(value || '').trim();
      if (!trimmed) return;
      setErpRefChecking(true);
      erpRefDebounceRef.current = setTimeout(async () => {
        try {
          const params = { value: trimmed };
          if (isEdit && id) params.excludeId = id;
          const res = await api.get('/indents/check-erpref', { params });
          if (res.data?.exists) {
            setErpRefError(`Already used by indent ${res.data.usedBy || '(another indent)'}. Choose a different ERP Ref.`);
          } else {
            setErpRefError('');
          }
        } catch {
          // silently ignore network errors for this check
        } finally {
          setErpRefChecking(false);
        }
      }, 500);
    }

    if (field === 'indentNumber') {
      setIndentNoError('');
      if (indentNoDebounceRef.current) clearTimeout(indentNoDebounceRef.current);
      const trimmed = String(value || '').trim();
      if (!trimmed) return;
      setIndentNoChecking(true);
      indentNoDebounceRef.current = setTimeout(async () => {
        try {
          const params = { value: trimmed };
          if (isEdit && id) params.excludeId = id;
          const res = await api.get('/indents/check-indent-number', { params });
          if (res.data?.exists) {
            setIndentNoError(`Already taken. Choose a different Indent No.`);
          } else {
            setIndentNoError('');
          }
        } catch {
          // silently ignore network errors for this check
        } finally {
          setIndentNoChecking(false);
        }
      }, 500);
    }
  };

  const fetchCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      const res = await api.get('/items/categories');
      const cats = Array.isArray(res.data?.data) ? res.data.data.filter(Boolean) : [];
      setItemCategories(cats);
      if (!isEdit) {
        setFormData((prev) => ({
          ...prev,
          category: prev.category || cats[0] || ''
        }));
      }
    } catch (e) {
      // ignore; user can still type category manually if needed
    } finally {
      setCategoriesLoading(false);
    }
  }, [isEdit]);

  const fetchItemsForCategory = useCallback(async (category) => {
    if (!category) return;
    const seq = ++itemOptionsReqSeq.current;
    lastLoadedCategoryRef.current = category;
    try {
      setItemOptionsLoading(true);
      const res = await api.get('/items', { params: { category, limit: 5000 } });
      if (seq !== itemOptionsReqSeq.current) return;
      setItemOptions(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e) {
      // silently ignore - free typing still works
    } finally {
      if (seq === itemOptionsReqSeq.current) setItemOptionsLoading(false);
    }
  }, []);

  const fetchItemOptions = async (q) => {
    const seq = ++itemOptionsReqSeq.current;
    try {
      setItemOptionsLoading(true);
      const res = await api.get('/items', {
        params: { category: formData.category, q: q || '', limit: 200 }
      });
      if (seq !== itemOptionsReqSeq.current) return;
      setItemOptions(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e) {
      // silently ignore - free typing still works
    } finally {
      if (seq === itemOptionsReqSeq.current) setItemOptionsLoading(false);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      items: updatedItems
    }));
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          itemName: '',
          description: '',
          brand: '',
          quantity: 1,
          unit: 'Piece',
          purpose: '',
          estimatedCost: 0
        }
      ]
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleSignatureChange = (signatureType, field, value) => {
    setFormData(prev => ({
      ...prev,
      signatures: {
        ...prev.signatures,
        [signatureType]: {
          ...prev.signatures[signatureType],
          [field]: value
        }
      }
    }));
  };

  // Refresh suggestions when category changes
  useEffect(() => {
    setItemOptions([]);
    if (formData.category) {
      fetchItemsForCategory(formData.category);
    }
  }, [formData.category, fetchItemsForCategory]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const loadApproverOptions = async (q) => {
    try {
      setApproverSearchLoading(true);
      const res = await api.get('/indents/approver-candidates', {
        params: { search: q || '', limit: 50 }
      });
      setApproverSearchOptions(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setApproverSearchOptions([]);
    } finally {
      setApproverSearchLoading(false);
    }
  };

  useEffect(() => {
    loadApproverOptions('');
  }, []);

  const approverLabel = (u) => {
    if (!u) return '';
    const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return n || u.email || u.employeeId || '';
  };

  const handleApproverSearchInput = (value) => {
    if (approverSearchDebounceRef.current) clearTimeout(approverSearchDebounceRef.current);
    approverSearchDebounceRef.current = setTimeout(() => {
      loadApproverOptions(value);
    }, 300);
  };

  const handleApproverSlotChange = (index, user) => {
    setApproverSlots((prev) => {
      const next = [...prev];
      next[index] = user;
      return next;
    });
  };

  const validateForm = () => {
    if (!formData.title?.trim()) {
      setError('Title is required');
      return false;
    }
    if (!formData.department) {
      setError('Department is required');
      return false;
    }
    if (!formData.requiredDate) {
      setError('Required date is required');
      return false;
    }
    if (!formData.justification?.trim()) {
      setError('Justification is required');
      return false;
    }
    if (!formData.priority) {
      setError('Priority is required');
      return false;
    }
    if (!formData.category) {
      setError('Category is required');
      return false;
    }
    if (!formData.originator.trim()) {
      setError('Originator is required');
      return false;
    }
    if (formData.items.length === 0) {
      setError('At least one item is required');
      return false;
    }
    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (!item.itemName?.trim()) {
        setError(`Item ${i + 1}: Item name is required`);
        return false;
      }
      if (!item.description?.trim()) {
        setError(`Item ${i + 1}: Item description is required`);
        return false;
      }
      if (!item.brand?.trim()) {
        setError(`Item ${i + 1}: Brand is required`);
        return false;
      }
      if (!item.quantity || item.quantity < 1) {
        setError(`Item ${i + 1}: Quantity must be at least 1`);
        return false;
      }
      if (!item.unit?.trim()) {
        setError(`Item ${i + 1}: Unit is required`);
        return false;
      }
      if (!item.purpose?.trim()) {
        setError(`Item ${i + 1}: Purpose is required`);
        return false;
      }
      if (item.estimatedCost === undefined || item.estimatedCost === null || Number(item.estimatedCost) < 0) {
        setError(`Item ${i + 1}: Estimated cost is required and must be 0 or greater`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (submitForApproval = false) => {
    if (!validateForm()) {
      return;
    }

    if (submitForApproval) {
      const ids = approverSlots.map((u) => u?._id).filter(Boolean);
      if (ids.length !== 3) {
        setError('Submitting for approval requires exactly three approvers (Head of Department, GM/PD, SVP/AVP).');
        return;
      }
      if (new Set(ids.map(String)).size !== 3) {
        setError('The three approvers must be different people.');
        return;
      }
    }

    try {
      setLoading(true);
      setError('');

      const draftApproverIds = approverSlots.map((u) => u?._id).filter(Boolean);

      const indentData = {
        title: formData.title.trim(),
        erpRef: formData.erpRef?.trim() || undefined,
        requestedDate: formData.date,
        requiredDate: formData.requiredDate,
        department: formData.department,
        priority: formData.priority,
        category: formData.category,
        items: formData.items.map(item => ({
          itemName: item.itemName,
          description: item.description || '',
          brand: item.brand || '',
          quantity: item.quantity,
          unit: item.unit || 'Piece',
          purpose: item.purpose || '',
          estimatedCost: Number(item.estimatedCost) >= 0 ? Number(item.estimatedCost) : 0
        })),
        justification: formData.justification.trim(),
        signatures: formData.signatures,
        status: 'Draft',
        draftApproverIds
      };
      
      // Include indentNumber if the user has provided one; backend auto-generates if omitted
      if (formData.indentNumber?.trim()) {
        indentData.indentNumber = formData.indentNumber.trim();
      }
      // For new indents, if ERP Ref is empty backend auto-generates it

      let response;
      let savedId;
      if (isEdit) {
        response = await indentService.updateIndent(id, indentData);
        savedId = id;
      } else {
        response = await indentService.createIndent(indentData);
        savedId = response.data?._id;
      }

      if (submitForApproval && savedId) {
        const approverIds = approverSlots.map((u) => u._id);
        await indentService.submitIndent(savedId, { approverIds });
      }

      setSnackbar({
        open: true,
        message: submitForApproval 
          ? 'Indent submitted for approval successfully' 
          : isEdit 
            ? 'Indent updated successfully' 
            : 'Indent created successfully',
        severity: 'success'
      });

      setTimeout(() => {
        navigate('/general/indents');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save indent');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, border: '2px solid #000' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              component="img"
              src="/images/taj-logo.png"
              alt="Taj Residencia Logo"
              sx={{ height: 50, width: 'auto' }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <Typography variant="h5" fontWeight={700} sx={{ textTransform: 'uppercase' }}>
              Taj Residencia
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={() => navigate('/general/indents')}
          >
            Cancel
          </Button>
        </Box>
        <Typography variant="h4" fontWeight={700} align="center" sx={{ textTransform: 'uppercase', mb: 3 }}>
          Purchase Request Form
        </Typography>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper elevation={2} sx={{ p: 3, border: '1px solid #ccc' }}>
        {/* Title */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              required
              size="small"
              placeholder="e.g. Purchase Request - Office Supplies"
            />
          </Grid>
        </Grid>

        {/* Reference Information */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="ERP Ref"
              value={formData.erpRef}
              onChange={(e) => handleChange('erpRef', e.target.value)}
              size="small"
              error={!!erpRefError}
              helperText={
                erpRefChecking
                  ? 'Checking availability…'
                  : erpRefError || 'Editable – must be unique'
              }
              InputProps={{
                endAdornment: erpRefChecking ? (
                  <CircularProgress size={14} sx={{ mr: 0.5 }} />
                ) : undefined
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Required Date"
              type="date"
              value={formData.requiredDate}
              onChange={(e) => handleChange('requiredDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Indent No."
              value={formData.indentNumber}
              onChange={(e) => handleChange('indentNumber', e.target.value)}
              size="small"
              error={!!indentNoError}
              helperText={
                indentNoChecking
                  ? 'Checking availability…'
                  : indentNoError || 'Editable – must be unique'
              }
              InputProps={{
                endAdornment: indentNoChecking ? (
                  <CircularProgress size={14} sx={{ mr: 0.5 }} />
                ) : undefined
              }}
            />
          </Grid>
        </Grid>

        {/* Department, Originator, Priority, Category */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Department</InputLabel>
              <Select
                value={formData.department}
                label="Department"
                onChange={(e) => handleChange('department', e.target.value)}
              >
                {departmentsLoading && (
                  <MenuItem value="" disabled>
                    Loading departments...
                  </MenuItem>
                )}
                {departmentOptions.map((dept) => (
                  <MenuItem key={dept._id} value={dept._id}>
                    {dept.name}
                  </MenuItem>
                ))}
                {!departmentsLoading && departmentOptions.length === 0 && (
                  <MenuItem value="" disabled>
                    No departments available
                  </MenuItem>
                )}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Originator"
              value={formData.originator}
              onChange={(e) => handleChange('originator', e.target.value)}
              required
              size="small"
              InputProps={{
                readOnly: !isEdit
              }}
              helperText={!isEdit ? 'Logged-in user (read-only)' : undefined}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                label="Priority"
                onChange={(e) => handleChange('priority', e.target.value)}
              >
                <MenuItem value="Low">Low</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                label="Category"
                onChange={(e) => handleChange('category', e.target.value)}
              >
                {categoriesLoading ? (
                  <MenuItem value="" disabled>
                    Loading categories...
                  </MenuItem>
                ) : (
                  itemCategories.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Items Table */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Items <span style={{ color: 'red', fontWeight: 400, fontSize: '0.875rem' }}>(all fields required)</span>
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddItem}
            >
              Add Item
            </Button>
          </Box>

          {formData.items.length === 0 ? (
            <Alert severity="info">
              No items added. Click "Add Item" to add items to this indent.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell align="center" sx={{ fontWeight: 700, border: '1px solid #ddd' }}>S#</TableCell>
                    <TableCell sx={{ fontWeight: 700, border: '1px solid #ddd' }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, border: '1px solid #ddd' }}>Item Description</TableCell>
                    <TableCell sx={{ fontWeight: 700, border: '1px solid #ddd' }}>Brand</TableCell>
                    <TableCell sx={{ fontWeight: 700, border: '1px solid #ddd' }}>Unit</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, border: '1px solid #ddd' }}>Qty.</TableCell>
                    <TableCell sx={{ fontWeight: 700, border: '1px solid #ddd' }}>Purpose</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, border: '1px solid #ddd' }}>Est. Cost</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, border: '1px solid #ddd', width: 50 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {formData.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell align="center" sx={{ border: '1px solid #ddd' }}>
                        {(index + 1).toString().padStart(2, '0')}
                      </TableCell>
                      <TableCell sx={{ border: '1px solid #ddd', p: 0.5, minWidth: 360 }}>
                        <Autocomplete
                          freeSolo
                          options={itemOptions}
                          loading={itemOptionsLoading}
                          PopperComponent={WidePopper}
                          getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt?.name || '')}
                          isOptionEqualToValue={(opt, val) => {
                            const optName = typeof opt === 'string' ? opt : opt?.name;
                            const valName = typeof val === 'string' ? val : val?.name;
                            return !!optName && !!valName && optName === valName;
                          }}
                          value={item.itemName || ''}
                          onChange={(_, newValue) => {
                            const name = typeof newValue === 'string' ? newValue : newValue?.name || '';
                            handleItemChange(index, 'itemName', name);
                          }}
                          onInputChange={(_, newInputValue, reason) => {
                            if (reason === 'input') {
                              handleItemChange(index, 'itemName', newInputValue);
                              if (!formData.category) return;
                              // if category list is huge and not loaded for some reason, fetch by search
                              if (!itemOptions.length || lastLoadedCategoryRef.current !== formData.category) {
                                fetchItemOptions(newInputValue);
                              }
                            }
                          }}
                          onOpen={() => {
                            if (formData.category && lastLoadedCategoryRef.current !== formData.category) {
                              fetchItemsForCategory(formData.category);
                            }
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              fullWidth
                              size="small"
                              placeholder="Item name"
                              required
                              variant="standard"
                              InputProps={{
                                ...params.InputProps,
                                disableUnderline: true,
                                endAdornment: (
                                  <>
                                    {itemOptionsLoading ? <CircularProgress color="inherit" size={14} /> : null}
                                    {params.InputProps.endAdornment}
                                  </>
                                )
                              }}
                              sx={{ '& .MuiInputBase-input': { py: 0.5 } }}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ border: '1px solid #ddd', p: 0.5 }}>
                        <TextField
                          fullWidth
                          size="small"
                          value={item.description || ''}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          placeholder="Description"
                          required
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          sx={{ '& .MuiInputBase-input': { py: 0.5 } }}
                        />
                      </TableCell>
                      <TableCell sx={{ border: '1px solid #ddd', p: 0.5 }}>
                        <TextField
                          fullWidth
                          size="small"
                          value={item.brand || ''}
                          onChange={(e) => handleItemChange(index, 'brand', e.target.value)}
                          placeholder="Brand"
                          required
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          sx={{ '& .MuiInputBase-input': { py: 0.5 } }}
                        />
                      </TableCell>
                      <TableCell sx={{ border: '1px solid #ddd', p: 0.5 }}>
                        <TextField
                          fullWidth
                          size="small"
                          value={item.unit ?? 'Piece'}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                          placeholder="Unit"
                          required
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          sx={{ '& .MuiInputBase-input': { py: 0.5 } }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ddd', p: 0.5 }}>
                        <TextField
                          size="small"
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                          inputProps={{ min: 1, style: { textAlign: 'center' } }}
                          required
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          sx={{ width: 60, '& .MuiInputBase-input': { py: 0.5 } }}
                        />
                      </TableCell>
                      <TableCell sx={{ border: '1px solid #ddd', p: 0.5 }}>
                        <TextField
                          fullWidth
                          size="small"
                          value={item.purpose || ''}
                          onChange={(e) => handleItemChange(index, 'purpose', e.target.value)}
                          placeholder="Purpose"
                          required
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          sx={{ '& .MuiInputBase-input': { py: 0.5 } }}
                        />
                      </TableCell>
                      <TableCell sx={{ border: '1px solid #ddd', p: 0.5 }}>
                        <TextField
                          size="small"
                          type="number"
                          value={item.estimatedCost ?? ''}
                          onChange={(e) => handleItemChange(index, 'estimatedCost', parseFloat(e.target.value) >= 0 ? parseFloat(e.target.value) : 0)}
                          inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right' } }}
                          required
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          sx={{ width: 90, '& .MuiInputBase-input': { py: 0.5 } }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ border: '1px solid #ddd' }}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Justification */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            Justification <span style={{ color: 'red' }}>*</span>
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={formData.justification}
            onChange={(e) => handleChange('justification', e.target.value)}
            placeholder="Enter justification for this purchase request..."
            required
            variant="outlined"
            size="small"
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Approvals: requester + dynamic approvers / status */}
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Approvals
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose three distinct approvers before submitting. When each person approves in the system, their name and date appear here automatically.
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Sig of Requester"
              value={formData.signatures.requester.name}
              onChange={(e) => handleSignatureChange('requester', 'name', e.target.value)}
              size="small"
            />
          </Grid>
        </Grid>

        {isEdit && indentMeta.status && indentMeta.status !== 'Draft' && (indentMeta.approvalChain || []).length > 0 ? (
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Approver</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {['Head of Department', 'Approved by GM/PD', 'SVP/AVP Approval'].map((label, idx) => {
                  const step = indentMeta.approvalChain[idx];
                  const approver = step?.approver;
                  const name = approver ? approverLabel(approver) : '—';
                  const st = step?.status || 'pending';
                  return (
                    <TableRow key={label}>
                      <TableCell>{label}</TableCell>
                      <TableCell>{name}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={st === 'pending' ? 'Pending' : st === 'approved' ? 'Approved' : 'Rejected'}
                          color={st === 'approved' ? 'success' : st === 'rejected' ? 'error' : 'default'}
                          variant={st === 'pending' ? 'outlined' : 'filled'}
                        />
                      </TableCell>
                      <TableCell>
                        {step?.actedAt ? dayjs(step.actedAt).format('DD-MMM-YYYY HH:mm') : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : isEdit && indentMeta.status && indentMeta.status !== 'Draft' ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            This indent was submitted before multi-step approvers were enabled. Users with admin or HR manager roles can approve or reject it from the indent list or detail page.
          </Alert>
        ) : (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              'Head of Department approver',
              'GM/PD approver',
              'SVP/AVP approver'
            ].map((label, index) => (
              <Grid item xs={12} sm={6} md={4} key={label}>
                <Autocomplete
                  options={approverSearchOptions}
                  loading={approverSearchLoading}
                  getOptionLabel={(option) => approverLabel(option)}
                  isOptionEqualToValue={(a, b) => !!a && !!b && a._id === b._id}
                  value={approverSlots[index]}
                  onChange={(_, v) => handleApproverSlotChange(index, v)}
                  onInputChange={(_, input, reason) => {
                    if (reason === 'input') handleApproverSearchInput(input);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={label}
                      size="small"
                      placeholder="Search user…"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {approverSearchLoading ? <CircularProgress color="inherit" size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        )
                      }}
                    />
                  )}
                />
              </Grid>
            ))}
          </Grid>
        )}

        {/* Distribution Section */}
        <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid #ccc' }}>
          <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
            <strong>Original:</strong> Procurement
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
            <strong>Green:</strong> Store
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            <strong>Yellow:</strong> For Book Record
          </Typography>
        </Box>

        {/* Action Buttons */}
        <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 4 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/general/indents')}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={() => handleSubmit(false)}
            disabled={loading || !!erpRefError || erpRefChecking || !!indentNoError || indentNoChecking}
            title={indentNoError || erpRefError || ''}
          >
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Save Draft'}
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<SendIcon />}
            onClick={() => handleSubmit(true)}
            disabled={
              loading ||
              !!erpRefError ||
              erpRefChecking ||
              !!indentNoError ||
              indentNoChecking ||
              (isEdit && indentMeta.status && indentMeta.status !== 'Draft')
            }
            title={
              isEdit && indentMeta.status && indentMeta.status !== 'Draft'
                ? 'Only draft indents can be submitted from this form'
                : indentNoError || erpRefError || ''
            }
          >
            {loading ? 'Submitting...' : 'Submit for Approval'}
          </Button>
        </Stack>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
};

export default IndentForm;
