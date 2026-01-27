import React, { useState, useEffect } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  IconButton,
  Divider
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import indentService from '../../../services/indentService';
import dayjs from 'dayjs';

const IndentForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { departments, fetchDepartments } = useData();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [formData, setFormData] = useState({
    erpRef: '',
    date: dayjs().format('YYYY-MM-DD'),
    requiredDate: '',
    indentNumber: '',
    department: '',
    originator: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : '',
    items: [],
    justification: '',
    signatures: {
      requester: { name: '', date: '' },
      headOfDepartment: { name: '', date: '' },
      gmPd: { name: '', date: '' },
      svpAvp: { name: '', date: '' }
    }
  });

  // Load indent data if editing
  useEffect(() => {
    const loadData = async () => {
      if (isEdit) {
        try {
          setLoadingData(true);
          const response = await indentService.getIndentById(id);
          const indent = response.data;
          
          setFormData({
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
              brand: item.brand || ''
            })) || [],
            justification: indent.justification || '',
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
      } else {
        // Generate next indent number and ERP Ref for new indent
        const generateNumbers = async () => {
          try {
            const [indentResponse, erpRefResponse] = await Promise.all([
              indentService.getNextIndentNumber(),
              indentService.getNextERPRef()
            ]);
            
            if (indentResponse.data?.nextIndentNumber) {
              setFormData(prev => ({
                ...prev,
                indentNumber: indentResponse.data.nextIndentNumber
              }));
            }
            
            if (erpRefResponse.data?.nextERPRef) {
              setFormData(prev => ({
                ...prev,
                erpRef: erpRefResponse.data.nextERPRef
              }));
            }
          } catch (err) {
            // If API fails, backend will generate it
          }
        };
        generateNumbers();
      }
      
      if (departments.length === 0) {
        await fetchDepartments();
      }
    };

    loadData();
  }, [id, isEdit, fetchDepartments, departments.length, user]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
          purpose: ''
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

  const validateForm = () => {
    if (!formData.department) {
      setError('Department is required');
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
        setError(`Item ${i + 1}: Description is required`);
        return false;
      }
      if (!item.quantity || item.quantity < 1) {
        setError(`Item ${i + 1}: Quantity must be at least 1`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (submitForApproval = false) => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const indentData = {
        title: `Purchase Request - ${formData.department ? departments.find(d => d._id === formData.department)?.name : ''}`,
        requestedDate: formData.date,
        requiredDate: formData.requiredDate || undefined,
        department: formData.department,
        items: formData.items.map(item => ({
          itemName: item.itemName,
          description: item.description || '',
          brand: item.brand || '',
          quantity: item.quantity,
          unit: item.unit || 'Piece',
          purpose: item.purpose || ''
        })),
        justification: formData.justification || undefined,
        signatures: formData.signatures,
        status: submitForApproval ? 'Submitted' : 'Draft'
      };
      
      // Only include indentNumber and erpRef if editing (backend auto-generates them for new indents)
      if (isEdit) {
        if (formData.indentNumber) {
          indentData.indentNumber = formData.indentNumber;
        }
        if (formData.erpRef) {
          indentData.erpRef = formData.erpRef;
        }
      }
      // For new indents, don't send indentNumber or erpRef - backend will auto-generate them

      let response;
      if (isEdit) {
        response = await indentService.updateIndent(id, indentData);
      } else {
        response = await indentService.createIndent(indentData);
      }

      if (submitForApproval && response.data?._id) {
        await indentService.submitIndent(response.data._id);
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
        {/* Reference Information */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="ERP Ref"
              value={formData.erpRef}
              InputProps={{ readOnly: true }}
              size="small"
              helperText="Auto-generated"
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
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Indent No."
              value={formData.indentNumber}
              InputProps={{ readOnly: true }}
              size="small"
              helperText="Auto-generated"
            />
          </Grid>
        </Grid>

        {/* Department and Originator */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Department</InputLabel>
              <Select
                value={formData.department}
                label="Department"
                onChange={(e) => handleChange('department', e.target.value)}
              >
                {departments.map((dept) => (
                  <MenuItem key={dept._id} value={dept._id}>
                    {dept.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Originator"
              value={formData.originator}
              onChange={(e) => handleChange('originator', e.target.value)}
              required
              size="small"
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Items Table */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Items
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
                    <TableCell sx={{ fontWeight: 700, border: '1px solid #ddd' }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 700, border: '1px solid #ddd' }}>Brand</TableCell>
                    <TableCell sx={{ fontWeight: 700, border: '1px solid #ddd' }}>Unit</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, border: '1px solid #ddd' }}>Qty.</TableCell>
                    <TableCell sx={{ fontWeight: 700, border: '1px solid #ddd' }}>Purpose</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, border: '1px solid #ddd', width: 50 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {formData.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell align="center" sx={{ border: '1px solid #ddd' }}>
                        {(index + 1).toString().padStart(2, '0')}
                      </TableCell>
                      <TableCell sx={{ border: '1px solid #ddd', p: 0.5 }}>
                        <TextField
                          fullWidth
                          size="small"
                          value={item.itemName}
                          onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                          placeholder="Item description"
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
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          sx={{ '& .MuiInputBase-input': { py: 0.5 } }}
                        />
                      </TableCell>
                      <TableCell sx={{ border: '1px solid #ddd', p: 0.5 }}>
                        <TextField
                          fullWidth
                          size="small"
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                          placeholder="Unit"
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
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          sx={{ '& .MuiInputBase-input': { py: 0.5 } }}
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
            Justification:
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={formData.justification}
            onChange={(e) => handleChange('justification', e.target.value)}
            placeholder="Enter justification for this purchase request..."
            variant="outlined"
            size="small"
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Signatures Section */}
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Approvals
        </Typography>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Sig of Requester"
              value={formData.signatures.requester.name}
              onChange={(e) => handleSignatureChange('requester', 'name', e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Head of Department"
              value={formData.signatures.headOfDepartment.name}
              onChange={(e) => handleSignatureChange('headOfDepartment', 'name', e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Approved by GM/PD"
              value={formData.signatures.gmPd.name}
              onChange={(e) => handleSignatureChange('gmPd', 'name', e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="SVP/AVP Approval"
              value={formData.signatures.svpAvp.name}
              onChange={(e) => handleSignatureChange('svpAvp', 'name', e.target.value)}
              size="small"
            />
          </Grid>
        </Grid>

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
            disabled={loading}
          >
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Save Draft'}
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<SendIcon />}
            onClick={() => handleSubmit(true)}
            disabled={loading}
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
