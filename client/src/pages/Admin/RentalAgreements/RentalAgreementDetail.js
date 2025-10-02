import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Avatar,
  Divider,
  Stack,
  Alert,
  Skeleton,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Image as ImageIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { getImageUrl, handleImageError } from '../../../utils/imageService';

const RentalAgreementDetail = ({ onEdit }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageModalOpen, setImageModalOpen] = useState(false);

  useEffect(() => {
    fetchAgreement();
  }, [id]);


  const fetchAgreement = async () => {
    try {
      const response = await api.get(`/rental-agreements/${id}`);
      setAgreement(response.data);
    } catch (error) {
      console.error('Error fetching agreement:', error);
      setError('Failed to fetch rental agreement details');
    } finally {
      setLoading(false);
    }
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
      <Box sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <Skeleton variant="rectangular" width={100} height={36} borderRadius={1} />
          <Skeleton variant="text" width="35%" height={40} />
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Grid container spacing={3}>
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <Grid item xs={12} sm={6} key={item}>
                      <Skeleton variant="text" height={16} width="40%" sx={{ mb: 1 }} />
                      <Skeleton variant="text" height={20} width="70%" />
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Skeleton variant="text" width="50%" height={28} sx={{ mb: 2 }} />
                <Box sx={{ textAlign: 'center' }}>
                  <Skeleton variant="rectangular" width={120} height={80} sx={{ mb: 2, mx: 'auto' }} />
                  <Skeleton variant="rectangular" height={24} width={80} sx={{ mx: 'auto' }} />
                </Box>
              </CardContent>
            </Card>

            <Stack spacing={2}>
              <Skeleton variant="rectangular" width={120} height={36} borderRadius={1} />
              <Skeleton variant="rectangular" width={100} height={36} borderRadius={1} />
            </Stack>
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </Box>
    );
  }

  if (!agreement) {
    return (
      <Box>
        <Alert severity="warning" sx={{ mb: 2 }}>Rental agreement not found</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" mb={3}>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>
          Back
        </Button>
        <Typography variant="h4" component="h1">
          Rental Agreement Details
        </Typography>
        {onEdit && (
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => onEdit(agreement)}
            sx={{ ml: 'auto' }}
          >
            Edit
          </Button>
        )}
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Agreement Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Agreement Number
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {agreement.agreementNumber}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    label={agreement.status}
                    color={getStatusColor(agreement.status)}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Property Name
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {agreement.propertyName}
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Property Address
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {agreement.propertyAddress}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Landlord Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Landlord Name
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {agreement.landlordName}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Contact
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {agreement.landlordContact}
                  </Typography>
                </Grid>
                
                {agreement.landlordIdCard && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      ID Card
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {agreement.landlordIdCard}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Financial Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Monthly Rent
                  </Typography>
                  <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                    {formatPKR(agreement.monthlyRent)}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Security Deposit
                  </Typography>
                  <Typography variant="h6" color="secondary" sx={{ mb: 2 }}>
                    {formatPKR(agreement.securityDeposit || 0)}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Agreement Period
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Start Date
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {format(new Date(agreement.startDate), 'dd/MM/yyyy')}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    End Date
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {format(new Date(agreement.endDate), 'dd/MM/yyyy')}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {agreement.terms && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Terms & Conditions
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {agreement.terms}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Agreement Image
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {agreement.agreementImage ? (
                <Box>
                  <Box
                    component="img"
                    src={getImageUrl(agreement.agreementImage)}
                    alt="Rental Agreement"
                    sx={{
                      width: '100%',
                      height: 200,
                      objectFit: 'cover',
                      borderRadius: 1,
                      mb: 2,
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                    onError={(e) => handleImageError(e)}
                  />
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<ImageIcon />}
                    onClick={() => setImageModalOpen(true)}
                  >
                    View Full Image
                  </Button>
                </Box>
              ) : (
                <Box textAlign="center" py={4}>
                  <ImageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    No image uploaded
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Created Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Typography variant="subtitle2" color="text.secondary">
                Created By
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {agreement.createdBy?.firstName} {agreement.createdBy?.lastName}
              </Typography>
              
              <Typography variant="subtitle2" color="text.secondary">
                Created Date
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {format(new Date(agreement.createdAt), 'dd/MM/yyyy HH:mm')}
              </Typography>
              
              <Typography variant="subtitle2" color="text.secondary">
                Last Updated
              </Typography>
              <Typography variant="body1">
                {format(new Date(agreement.updatedAt), 'dd/MM/yyyy HH:mm')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Image Modal */}
      <Dialog
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'transparent',
            boxShadow: 'none'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: 'white'
        }}>
          <Typography variant="h6">Agreement Image</Typography>
          <IconButton
            onClick={() => setImageModalOpen(false)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <Box
            component="img"
            src={getImageUrl(agreement?.agreementImage)}
            alt="Rental Agreement"
            sx={{
              width: '100%',
              height: 'auto',
              maxHeight: '80vh',
              objectFit: 'contain',
              display: 'block'
            }}
            onError={(e) => handleImageError(e)}
          />
        </DialogContent>
        <DialogActions sx={{ 
          backgroundColor: 'rgba(0,0,0,0.8)',
          justifyContent: 'center'
        }}>
          <Button
            onClick={() => setImageModalOpen(false)}
            variant="contained"
            color="primary"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RentalAgreementDetail;
