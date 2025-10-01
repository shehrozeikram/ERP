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
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Alert,
  Avatar,
  FormControl,
  InputLabel,
  OutlinedInput,
  InputAdornment,
  CardMedia,
  Stack,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CloudUpload as UploadIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  PhotoCamera as PhotoCameraIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { getImageUrl } from '../../../utils/imageService';

const RentalAgreementList = () => {
  const navigate = useNavigate();
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState(null);
  const [formData, setFormData] = useState({
    agreementNumber: '',
    propertyName: '',
    propertyAddress: '',
    landlordName: '',
    landlordContact: '',
    landlordIdCard: '',
    monthlyRent: '',
    securityDeposit: '',
    startDate: '',
    endDate: '',
    terms: '',
    status: 'Active'
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchAgreements();
  }, []);

  const fetchAgreements = async () => {
    try {
      const response = await api.get('/rental-agreements');
      setAgreements(response.data);
    } catch (error) {
      console.error('Error fetching agreements:', error);
      setError('Failed to fetch rental agreements');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (agreement = null) => {
    if (agreement) {
      setEditingAgreement(agreement);
      setFormData({
        agreementNumber: agreement.agreementNumber,
        propertyName: agreement.propertyName,
        propertyAddress: agreement.propertyAddress,
        landlordName: agreement.landlordName,
        landlordContact: agreement.landlordContact,
        landlordIdCard: agreement.landlordIdCard || '',
        monthlyRent: agreement.monthlyRent,
        securityDeposit: agreement.securityDeposit || '',
        startDate: agreement.startDate ? format(new Date(agreement.startDate), 'yyyy-MM-dd') : '',
        endDate: agreement.endDate ? format(new Date(agreement.endDate), 'yyyy-MM-dd') : '',
        terms: agreement.terms || '',
        status: agreement.status
      });
      setImagePreview(agreement.agreementImage || null);
    } else {
      setEditingAgreement(null);
      setFormData({
        agreementNumber: '',
        propertyName: '',
        propertyAddress: '',
        landlordName: '',
        landlordContact: '',
        landlordIdCard: '',
        monthlyRent: '',
        securityDeposit: '',
        startDate: '',
        endDate: '',
        terms: '',
        status: 'Active'
      });
      setImagePreview(null);
    }
    setSelectedImage(null);
    setDialogOpen(true);
    setError('');
    setSuccess('');
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAgreement(null);
    setFormData({});
    setSelectedImage(null);
    setImagePreview(null);
    setError('');
    setSuccess('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }
      
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
      setError(''); // Clear any previous errors
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const event = {
        target: {
          files: [file]
        }
      };
      handleImageChange(event);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      
      // Append form data
      Object.keys(formData).forEach(key => {
        formDataToSend.append(key, formData[key]);
      });

      // Append image if selected
      if (selectedImage) {
        formDataToSend.append('agreementImage', selectedImage);
      }

      if (editingAgreement) {
        await api.put(`/rental-agreements/${editingAgreement._id}`, formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        setSuccess('Rental agreement updated successfully');
      } else {
        await api.post('/rental-agreements', formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        setSuccess('Rental agreement created successfully');
      }
      fetchAgreements();
      setTimeout(() => {
        handleCloseDialog();
      }, 1500);
    } catch (error) {
      console.error('Error saving agreement:', error);
      setError(error.response?.data?.message || 'Failed to save rental agreement');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this rental agreement?')) {
      try {
        await api.delete(`/rental-agreements/${id}`);
        setSuccess('Rental agreement deleted successfully');
        fetchAgreements();
      } catch (error) {
        console.error('Error deleting agreement:', error);
        setError('Failed to delete rental agreement');
      }
    }
  };

  const handleViewDetail = (id) => {
    navigate(`/admin/rental-agreements/${id}`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Expired': return 'error';
      case 'Terminated': return 'warning';
      default: return 'default';
    }
  };

  const formatPKR = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(amount);
  };


  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading rental agreements...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Rental Agreements
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add New Agreement
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Agreement #</TableCell>
                  <TableCell>Property Name</TableCell>
                  <TableCell>Landlord</TableCell>
                  <TableCell>Monthly Rent</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                  <TableCell>Image</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {agreements.map((agreement) => (
                  <TableRow key={agreement._id}>
                    <TableCell>{agreement.agreementNumber}</TableCell>
                    <TableCell>{agreement.propertyName}</TableCell>
                    <TableCell>{agreement.landlordName}</TableCell>
                    <TableCell>{formatPKR(agreement.monthlyRent)}</TableCell>
                    <TableCell>{format(new Date(agreement.startDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{format(new Date(agreement.endDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      {agreement.agreementImage ? (
                        <Avatar
                          src={getImageUrl(agreement.agreementImage)}
                          sx={{ width: 40, height: 40 }}
                          variant="rounded"
                        />
                      ) : (
                        <Avatar sx={{ width: 40, height: 40 }}>
                          <ImageIcon />
                        </Avatar>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={agreement.status}
                        color={getStatusColor(agreement.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetail(agreement._id)}
                        color="info"
                        title="View Details"
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(agreement)}
                        color="primary"
                        title="Edit"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(agreement._id)}
                        color="error"
                        title="Delete"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingAgreement ? 'Edit Rental Agreement' : 'Add New Rental Agreement'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Agreement Number"
                  name="agreementNumber"
                  value={formData.agreementNumber}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Property Name"
                  name="propertyName"
                  value={formData.propertyName}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Property Address"
                  name="propertyAddress"
                  value={formData.propertyAddress}
                  onChange={handleInputChange}
                  required
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Landlord Name"
                  name="landlordName"
                  value={formData.landlordName}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Landlord Contact"
                  name="landlordContact"
                  value={formData.landlordContact}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Landlord ID Card"
                  name="landlordIdCard"
                  value={formData.landlordIdCard}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Monthly Rent"
                  name="monthlyRent"
                  type="number"
                  value={formData.monthlyRent}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Security Deposit"
                  name="securityDeposit"
                  type="number"
                  value={formData.securityDeposit}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Status"
                  name="status"
                  select
                  value={formData.status}
                  onChange={handleInputChange}
                  required
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Expired">Expired</MenuItem>
                  <MenuItem value="Terminated">Terminated</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Start Date"
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="End Date"
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Terms & Conditions"
                  name="terms"
                  value={formData.terms}
                  onChange={handleInputChange}
                  multiline
                  rows={4}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Agreement Image
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                {!imagePreview ? (
                  <Card
                    sx={{
                      border: '2px dashed #ccc',
                      borderRadius: 2,
                      p: 3,
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        backgroundColor: 'action.hover'
                      }
                    }}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => document.getElementById('image-upload').click()}
                  >
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      style={{ display: 'none' }}
                    />
                    <Stack spacing={2} alignItems="center">
                      <PhotoCameraIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                      <Typography variant="h6" color="text.secondary">
                        Upload Agreement Image
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Drag and drop an image here, or click to select
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Supported formats: JPG, PNG, GIF (Max 5MB)
                      </Typography>
                    </Stack>
                  </Card>
                ) : (
                  <Card sx={{ maxWidth: 400, mx: 'auto' }}>
                    <Box position="relative">
                      <CardMedia
                        component="img"
                        height="300"
                        image={imagePreview}
                        alt="Agreement preview"
                        sx={{ borderRadius: 1 }}
                      />
                      <IconButton
                        onClick={handleRemoveImage}
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          color: 'white',
                          '&:hover': {
                            backgroundColor: 'rgba(0,0,0,0.7)'
                          }
                        }}
                        size="small"
                      >
                        <CloseIcon />
                      </IconButton>
                    </Box>
                    <CardContent>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Button
                          variant="outlined"
                          startIcon={<UploadIcon />}
                          onClick={() => document.getElementById('image-upload').click()}
                          size="small"
                        >
                          Change Image
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                          {selectedImage?.name}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                )}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {editingAgreement ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default RentalAgreementList;
