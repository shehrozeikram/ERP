import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  IconButton,
  Chip,
  Alert,
  Grid,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  fetchChargesSlabs,
  createChargesSlabs,
  updateChargesSlabs
} from '../../../services/chargesSlabsService';
import {
  fetchWaterUtilitySlabs,
  createWaterUtilitySlabs,
  updateWaterUtilitySlabs
} from '../../../services/waterUtilitySlabsService';

// Validation schemas
const camChargesValidationSchema = Yup.object({
  description: Yup.string(),
  isActive: Yup.boolean(),
  slabs: Yup.array().of(
    Yup.object({
      size: Yup.string().required('Size is required'),
      camCharges: Yup.number()
        .required('CAM Charges is required')
        .min(0, 'CAM Charges cannot be negative')
    })
  ).min(1, 'At least one slab is required')
});

const waterUtilityValidationSchema = Yup.object({
  description: Yup.string(),
  isActive: Yup.boolean(),
  slabs: Yup.array().of(
    Yup.object({
      lowerSlab: Yup.number().required('Lower slab is required').min(0, 'Lower slab cannot be negative'),
      higherSlab: Yup.number().required('Higher slab is required').min(0, 'Higher slab cannot be negative'),
      unitsSlab: Yup.string().required('Units slab is required'),
      fixRate: Yup.number().nullable().min(0, 'Fix rate cannot be negative'),
      unitRate: Yup.number().required('Unit rate is required').min(0, 'Unit rate cannot be negative')
    })
  ).min(1, 'At least one slab is required')
});

// Default CAM Charges slabs data
const defaultCamSlabs = [
  { size: '3.5M', camCharges: 1100 },
  { size: '4M', camCharges: 1300 },
  { size: '5M', camCharges: 2500 },
  { size: '8M', camCharges: 3000 },
  { size: '10M', camCharges: 4000 },
  { size: '14M', camCharges: 5000 },
  { size: '20M', camCharges: 5500 },
  { size: '30M', camCharges: 6000 },
  { size: '40M', camCharges: 6500 }
];

// Default Water & Utility Bills slabs data
const defaultWaterUtilitySlabs = [
  { lowerSlab: 0, higherSlab: 100, unitsSlab: '1-100', fixRate: null, unitRate: 22.44 },
  { lowerSlab: 101, higherSlab: 200, unitsSlab: '101-200', fixRate: null, unitRate: 28.91 },
  { lowerSlab: 201, higherSlab: 300, unitsSlab: '201-300', fixRate: null, unitRate: 33.1 },
  { lowerSlab: 301, higherSlab: 400, unitsSlab: '301-400', fixRate: 200, unitRate: 37.99 },
  { lowerSlab: 401, higherSlab: 500, unitsSlab: '401-500', fixRate: 400, unitRate: 40.2 },
  { lowerSlab: 501, higherSlab: 600, unitsSlab: '501-600', fixRate: 600, unitRate: 41.62 },
  { lowerSlab: 601, higherSlab: 700, unitsSlab: '601-700', fixRate: 800, unitRate: 42.76 },
  { lowerSlab: 701, higherSlab: 1000, unitsSlab: 'Above 700', fixRate: 1000, unitRate: 47.69 }
];

const ChargesSlabs = () => {
  const [chargesSlab, setChargesSlab] = useState(null);
  const [waterUtilitySlab, setWaterUtilitySlab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openCamDialog, setOpenCamDialog] = useState(false);
  const [openWaterDialog, setOpenWaterDialog] = useState(false);

  // CAM Charges Formik
  const camFormik = useFormik({
    initialValues: {
      description: '',
      isActive: true,
      slabs: defaultCamSlabs.map(s => ({ size: s.size, camCharges: s.camCharges.toString() }))
    },
    validationSchema: camChargesValidationSchema,
    onSubmit: async (values) => {
      try {
        const data = {
          description: values.description,
          isActive: values.isActive,
          slabs: values.slabs.map(slab => ({
            size: slab.size,
            camCharges: parseFloat(slab.camCharges) || 0
          }))
        };

        if (chargesSlab) {
          await updateChargesSlabs(chargesSlab._id, data);
        } else {
          await createChargesSlabs(data);
        }
        fetchCamSlabs();
        handleCloseCamDialog();
        setError(null);
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to save CAM charges slabs');
      }
    }
  });

  // Water Utility Formik
  const waterFormik = useFormik({
    initialValues: {
      description: '',
      isActive: true,
      status: 'Un-Protect',
      slabs: defaultWaterUtilitySlabs.map(s => ({
        lowerSlab: s.lowerSlab.toString(),
        higherSlab: s.higherSlab.toString(),
        unitsSlab: s.unitsSlab,
        fixRate: s.fixRate !== null ? s.fixRate.toString() : '',
        unitRate: s.unitRate.toString()
      }))
    },
    validationSchema: waterUtilityValidationSchema,
    onSubmit: async (values) => {
      try {
        const data = {
          description: values.description,
          isActive: values.isActive,
          status: values.status,
          slabs: values.slabs.map(slab => ({
            lowerSlab: parseFloat(slab.lowerSlab) || 0,
            higherSlab: parseFloat(slab.higherSlab) || 0,
            unitsSlab: slab.unitsSlab,
            fixRate: slab.fixRate && slab.fixRate.trim() !== '' ? parseFloat(slab.fixRate) : null,
            unitRate: parseFloat(slab.unitRate) || 0
          }))
        };

        if (waterUtilitySlab) {
          await updateWaterUtilitySlabs(waterUtilitySlab._id, data);
        } else {
          await createWaterUtilitySlabs(data);
        }
        fetchWaterSlabs();
        handleCloseWaterDialog();
        setError(null);
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to save water utility slabs');
      }
    }
  });

  const fetchCamSlabs = async () => {
    try {
      const response = await fetchChargesSlabs();
      const slabs = response.data.data || [];
      
      if (slabs.length > 0) {
        const activeSlab = slabs.find(s => s.isActive) || slabs[0];
        setChargesSlab(activeSlab);
      } else {
        setChargesSlab(null);
      }
    } catch (error) {
      console.error('Failed to fetch CAM charges slabs:', error);
    }
  };

  const fetchWaterSlabs = async () => {
    try {
      const response = await fetchWaterUtilitySlabs();
      const slabs = response.data.data || [];
      
      if (slabs.length > 0) {
        const activeSlab = slabs.find(s => s.isActive) || slabs[0];
        setWaterUtilitySlab(activeSlab);
      } else {
        setWaterUtilitySlab(null);
      }
    } catch (error) {
      console.error('Failed to fetch water utility slabs:', error);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchCamSlabs(), fetchWaterSlabs()]);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const handleOpenCamDialog = () => {
    if (chargesSlab) {
      camFormik.setValues({
        description: chargesSlab.description || '',
        isActive: chargesSlab.isActive !== undefined ? chargesSlab.isActive : true,
        slabs: chargesSlab.slabs && chargesSlab.slabs.length > 0 
          ? chargesSlab.slabs.map(s => ({ size: s.size, camCharges: s.camCharges.toString() }))
          : defaultCamSlabs.map(s => ({ size: s.size, camCharges: s.camCharges.toString() }))
      });
    } else {
      camFormik.setValues({
        description: '',
        isActive: true,
        slabs: defaultCamSlabs.map(s => ({ size: s.size, camCharges: s.camCharges.toString() }))
      });
    }
    setOpenCamDialog(true);
  };

  const handleCloseCamDialog = () => {
    setOpenCamDialog(false);
    if (chargesSlab) {
      camFormik.setValues({
        description: chargesSlab.description || '',
        isActive: chargesSlab.isActive !== undefined ? chargesSlab.isActive : true,
        slabs: chargesSlab.slabs && chargesSlab.slabs.length > 0 
          ? chargesSlab.slabs.map(s => ({ size: s.size, camCharges: s.camCharges.toString() }))
          : defaultCamSlabs.map(s => ({ size: s.size, camCharges: s.camCharges.toString() }))
      });
    }
  };

  const handleOpenWaterDialog = () => {
    if (waterUtilitySlab) {
      waterFormik.setValues({
        description: waterUtilitySlab.description || '',
        isActive: waterUtilitySlab.isActive !== undefined ? waterUtilitySlab.isActive : true,
        status: waterUtilitySlab.status || 'Un-Protect',
        slabs: waterUtilitySlab.slabs && waterUtilitySlab.slabs.length > 0 
          ? waterUtilitySlab.slabs.map(s => ({
              lowerSlab: s.lowerSlab.toString(),
              higherSlab: s.higherSlab.toString(),
              unitsSlab: s.unitsSlab,
              fixRate: s.fixRate !== null ? s.fixRate.toString() : '',
              unitRate: s.unitRate.toString()
            }))
          : defaultWaterUtilitySlabs.map(s => ({
              lowerSlab: s.lowerSlab.toString(),
              higherSlab: s.higherSlab.toString(),
              unitsSlab: s.unitsSlab,
              fixRate: s.fixRate !== null ? s.fixRate.toString() : '',
              unitRate: s.unitRate.toString()
            }))
      });
    } else {
      waterFormik.setValues({
        description: '',
        isActive: true,
        status: 'Un-Protect',
        slabs: defaultWaterUtilitySlabs.map(s => ({
          lowerSlab: s.lowerSlab.toString(),
          higherSlab: s.higherSlab.toString(),
          unitsSlab: s.unitsSlab,
          fixRate: s.fixRate !== null ? s.fixRate.toString() : '',
          unitRate: s.unitRate.toString()
        }))
      });
    }
    setOpenWaterDialog(true);
  };

  const handleCloseWaterDialog = () => {
    setOpenWaterDialog(false);
    if (waterUtilitySlab) {
      waterFormik.setValues({
        description: waterUtilitySlab.description || '',
        isActive: waterUtilitySlab.isActive !== undefined ? waterUtilitySlab.isActive : true,
        status: waterUtilitySlab.status || 'Un-Protect',
        slabs: waterUtilitySlab.slabs && waterUtilitySlab.slabs.length > 0 
          ? waterUtilitySlab.slabs.map(s => ({
              lowerSlab: s.lowerSlab.toString(),
              higherSlab: s.higherSlab.toString(),
              unitsSlab: s.unitsSlab,
              fixRate: s.fixRate !== null ? s.fixRate.toString() : '',
              unitRate: s.unitRate.toString()
            }))
          : defaultWaterUtilitySlabs.map(s => ({
              lowerSlab: s.lowerSlab.toString(),
              higherSlab: s.higherSlab.toString(),
              unitsSlab: s.unitsSlab,
              fixRate: s.fixRate !== null ? s.fixRate.toString() : '',
              unitRate: s.unitRate.toString()
            }))
      });
    }
  };

  const addCamSlab = () => {
    const newSlabs = [...camFormik.values.slabs, { size: '', camCharges: '' }];
    camFormik.setFieldValue('slabs', newSlabs);
  };

  const removeCamSlab = (index) => {
    const newSlabs = camFormik.values.slabs.filter((_, i) => i !== index);
    camFormik.setFieldValue('slabs', newSlabs);
  };

  const updateCamSlab = (index, field, value) => {
    const newSlabs = [...camFormik.values.slabs];
    newSlabs[index] = { ...newSlabs[index], [field]: value };
    camFormik.setFieldValue('slabs', newSlabs);
  };

  const addWaterSlab = () => {
    const newSlabs = [...waterFormik.values.slabs, { lowerSlab: '', higherSlab: '', unitsSlab: '', fixRate: '', unitRate: '' }];
    waterFormik.setFieldValue('slabs', newSlabs);
  };

  const removeWaterSlab = (index) => {
    const newSlabs = waterFormik.values.slabs.filter((_, i) => i !== index);
    waterFormik.setFieldValue('slabs', newSlabs);
  };

  const updateWaterSlab = (index, field, value) => {
    const newSlabs = [...waterFormik.values.slabs];
    newSlabs[index] = { ...newSlabs[index], [field]: value };
    waterFormik.setFieldValue('slabs', newSlabs);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDecimal = (value) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Display default data if no data exists yet
  const displayCamSlabs = chargesSlab?.slabs || defaultCamSlabs;
  const displayWaterSlabs = waterUtilitySlab?.slabs || defaultWaterUtilitySlabs;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Typography>Loading Charges Slabs...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          Charges Slabs
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          Manage CAM Charges and Water & Utility Bills slabs
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* CAM Charges Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  CAM Charges by Property Size
                  {chargesSlab?.isActive && (
                    <Chip label="Active" color="success" size="small" sx={{ ml: 1 }} />
                  )}
                </Typography>
                <IconButton onClick={handleOpenCamDialog} size="small">
                  <EditIcon />
                </IconButton>
              </Box>
              
              {chargesSlab?.description && (
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  {chargesSlab.description}
                </Typography>
              )}

              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell sx={{ color: 'primary.contrastText', fontWeight: 600 }}>
                        Size
                      </TableCell>
                      <TableCell sx={{ color: 'primary.contrastText', fontWeight: 600 }}>
                        CAM Charges
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayCamSlabs.map((slab, index) => (
                      <TableRow 
                        key={index}
                        sx={{ 
                          bgcolor: index % 2 === 0 ? 'action.hover' : 'background.paper',
                          '&:hover': {
                            bgcolor: 'action.selected'
                          }
                        }}
                      >
                        <TableCell sx={{ fontWeight: 500 }}>
                          {slab.size}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>
                          Rs {formatCurrency(slab.camCharges || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {chargesSlab && (
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  Created by: {chargesSlab.createdBy?.firstName || 'System'} {chargesSlab.createdBy?.lastName || ''}
                  {chargesSlab.updatedBy && ` | Updated by: ${chargesSlab.updatedBy.firstName || ''} ${chargesSlab.updatedBy.lastName || ''}`}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Water & Utility Bills Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Electricity Bills
                  {waterUtilitySlab?.isActive && (
                    <Chip label="Active" color="success" size="small" sx={{ ml: 1 }} />
                  )}
                </Typography>
                <IconButton onClick={handleOpenWaterDialog} size="small">
                  <EditIcon />
                </IconButton>
              </Box>
              
              {waterUtilitySlab?.description && (
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  {waterUtilitySlab.description}
                </Typography>
              )}

              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell sx={{ color: 'primary.contrastText', fontWeight: 600 }}>
                        STATUS
                      </TableCell>
                      <TableCell sx={{ color: 'primary.contrastText', fontWeight: 600 }}>
                        Lower Slab
                      </TableCell>
                      <TableCell sx={{ color: 'primary.contrastText', fontWeight: 600 }}>
                        Higher Slab
                      </TableCell>
                      <TableCell sx={{ color: 'primary.contrastText', fontWeight: 600 }}>
                        Units Slab
                      </TableCell>
                      <TableCell sx={{ color: 'primary.contrastText', fontWeight: 600 }}>
                        Fix Rate
                      </TableCell>
                      <TableCell sx={{ color: 'primary.contrastText', fontWeight: 600 }}>
                        Unit Rate
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayWaterSlabs.map((slab, index) => (
                      <TableRow 
                        key={index}
                        sx={{ 
                          bgcolor: index % 2 === 0 ? 'action.hover' : 'background.paper',
                          '&:hover': {
                            bgcolor: 'action.selected'
                          }
                        }}
                      >
                        <TableCell sx={{ fontWeight: 500 }}>
                          {waterUtilitySlab?.status || 'Un-Protect'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {slab.lowerSlab}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {slab.higherSlab}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {slab.unitsSlab}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {slab.fixRate !== null && slab.fixRate !== undefined ? formatCurrency(slab.fixRate) : '-'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {formatDecimal(slab.unitRate || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {waterUtilitySlab && (
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  Created by: {waterUtilitySlab.createdBy?.firstName || 'System'} {waterUtilitySlab.createdBy?.lastName || ''}
                  {waterUtilitySlab.updatedBy && ` | Updated by: ${waterUtilitySlab.updatedBy.firstName || ''} ${waterUtilitySlab.updatedBy.lastName || ''}`}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* CAM Charges Edit Dialog */}
      <Dialog open={openCamDialog} onClose={handleCloseCamDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {chargesSlab ? 'Edit CAM Charges Slabs' : 'Configure CAM Charges Slabs'}
        </DialogTitle>
        <form onSubmit={camFormik.handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="description"
                  label="Description"
                  value={camFormik.values.description}
                  onChange={camFormik.handleChange}
                  placeholder="Optional description"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      name="isActive"
                      checked={camFormik.values.isActive}
                      onChange={camFormik.handleChange}
                    />
                  }
                  label="Set as Active"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />
            
            <Typography variant="h6" gutterBottom>
              CAM Charges Slabs
            </Typography>

            {camFormik.values.slabs.map((slab, index) => (
              <Card key={index} sx={{ mb: 2, p: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={5}>
                    <TextField
                      fullWidth
                      label="Size"
                      value={slab.size}
                      onChange={(e) => updateCamSlab(index, 'size', e.target.value)}
                      error={camFormik.touched.slabs?.[index]?.size && Boolean(camFormik.errors.slabs?.[index]?.size)}
                      helperText={camFormik.touched.slabs?.[index]?.size && camFormik.errors.slabs?.[index]?.size}
                      placeholder="e.g., 3.5M, 4M, 5M"
                    />
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <TextField
                      fullWidth
                      label="CAM Charges"
                      type="number"
                      value={slab.camCharges}
                      onChange={(e) => updateCamSlab(index, 'camCharges', e.target.value)}
                      error={camFormik.touched.slabs?.[index]?.camCharges && Boolean(camFormik.errors.slabs?.[index]?.camCharges)}
                      helperText={camFormik.touched.slabs?.[index]?.camCharges && camFormik.errors.slabs?.[index]?.camCharges}
                      placeholder="Enter amount"
                      InputProps={{
                        startAdornment: <Typography sx={{ mr: 1 }}>Rs</Typography>
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <IconButton onClick={() => removeCamSlab(index)} color="error" disabled={camFormik.values.slabs.length === 1}>
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </Card>
            ))}

            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addCamSlab}
              sx={{ mt: 1 }}
            >
              Add Slab
            </Button>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCamDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {chargesSlab ? 'Update' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Water & Utility Bills Edit Dialog */}
      <Dialog open={openWaterDialog} onClose={handleCloseWaterDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          {waterUtilitySlab ? 'Edit Electricity Bills Slabs' : 'Configure Electricity Bills Slabs'}
        </DialogTitle>
        <form onSubmit={waterFormik.handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="description"
                  label="Description"
                  value={waterFormik.values.description}
                  onChange={waterFormik.handleChange}
                  placeholder="Optional description"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="status"
                  label="Status"
                  value={waterFormik.values.status}
                  onChange={waterFormik.handleChange}
                  placeholder="e.g., Un-Protect"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      name="isActive"
                      checked={waterFormik.values.isActive}
                      onChange={waterFormik.handleChange}
                    />
                  }
                  label="Set as Active"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />
            
            <Typography variant="h6" gutterBottom>
              Electricity Bills Slabs
            </Typography>

            {waterFormik.values.slabs.map((slab, index) => (
              <Card key={index} sx={{ mb: 2, p: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label="Lower Slab"
                      type="number"
                      value={slab.lowerSlab}
                      onChange={(e) => updateWaterSlab(index, 'lowerSlab', e.target.value)}
                      error={waterFormik.touched.slabs?.[index]?.lowerSlab && Boolean(waterFormik.errors.slabs?.[index]?.lowerSlab)}
                      helperText={waterFormik.touched.slabs?.[index]?.lowerSlab && waterFormik.errors.slabs?.[index]?.lowerSlab}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label="Higher Slab"
                      type="number"
                      value={slab.higherSlab}
                      onChange={(e) => updateWaterSlab(index, 'higherSlab', e.target.value)}
                      error={waterFormik.touched.slabs?.[index]?.higherSlab && Boolean(waterFormik.errors.slabs?.[index]?.higherSlab)}
                      helperText={waterFormik.touched.slabs?.[index]?.higherSlab && waterFormik.errors.slabs?.[index]?.higherSlab}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label="Units Slab"
                      value={slab.unitsSlab}
                      onChange={(e) => updateWaterSlab(index, 'unitsSlab', e.target.value)}
                      error={waterFormik.touched.slabs?.[index]?.unitsSlab && Boolean(waterFormik.errors.slabs?.[index]?.unitsSlab)}
                      helperText={waterFormik.touched.slabs?.[index]?.unitsSlab && waterFormik.errors.slabs?.[index]?.unitsSlab}
                      placeholder="e.g., 1-100"
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label="Fix Rate"
                      type="number"
                      value={slab.fixRate}
                      onChange={(e) => updateWaterSlab(index, 'fixRate', e.target.value)}
                      error={waterFormik.touched.slabs?.[index]?.fixRate && Boolean(waterFormik.errors.slabs?.[index]?.fixRate)}
                      helperText={waterFormik.touched.slabs?.[index]?.fixRate && waterFormik.errors.slabs?.[index]?.fixRate}
                      placeholder="Optional"
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label="Unit Rate"
                      type="number"
                      value={slab.unitRate}
                      onChange={(e) => updateWaterSlab(index, 'unitRate', e.target.value)}
                      error={waterFormik.touched.slabs?.[index]?.unitRate && Boolean(waterFormik.errors.slabs?.[index]?.unitRate)}
                      helperText={waterFormik.touched.slabs?.[index]?.unitRate && waterFormik.errors.slabs?.[index]?.unitRate}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <IconButton onClick={() => removeWaterSlab(index)} color="error" disabled={waterFormik.values.slabs.length === 1}>
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </Card>
            ))}

            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addWaterSlab}
              sx={{ mt: 1 }}
            >
              Add Slab
            </Button>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseWaterDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {waterUtilitySlab ? 'Update' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ChargesSlabs;
