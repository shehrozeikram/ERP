import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Divider,
  Stack,
  Alert,
  CircularProgress,
  Paper
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../services/api';

const RentalManagementDetail = ({ onEdit }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecord();
  }, [id]);

  const fetchRecord = async () => {
    try {
      const response = await api.get(`/rental-management/${id}`);
      setRecord(response.data);
    } catch (error) {
      console.error('Error fetching record:', error);
      setError('Failed to fetch rental management record details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved': return 'success';
      case 'Pending': return 'warning';
      case 'Rejected': return 'error';
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
        <CircularProgress />
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

  if (!record) {
    return (
      <Box>
        <Alert severity="warning" sx={{ mb: 2 }}>Rental management record not found</Alert>
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
          Rental Management Details
        </Typography>
        {onEdit && (
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => onEdit(record)}
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
                Record Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    label={record.status}
                    color={getStatusColor(record.status)}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Amount
                  </Typography>
                  <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                    {formatPKR(record.amount)}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Advance Payment
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {formatPKR(record.advancePayment || 0)}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Agreement Date
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {record.agreementDate ? format(new Date(record.agreementDate), 'dd/MM/yyyy') : 'N/A'}
                  </Typography>
                </Grid>
                
                {record.vendorIdCard && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Vendor ID Card
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {record.vendorIdCard}
                    </Typography>
                  </Grid>
                )}
                
                {record.title && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Title
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {record.title}
                    </Typography>
                  </Grid>
                )}
                
                {record.subtitle && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Subtitle
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {record.subtitle}
                    </Typography>
                  </Grid>
                )}
                
                {record.location && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Location
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {record.location}
                    </Typography>
                  </Grid>
                )}
                
                {record.custodian && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Custodian
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {record.custodian.firstName} {record.custodian.lastName} ({record.custodian.employeeId})
                    </Typography>
                  </Grid>
                )}
                
                {record.description && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Description
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                      {record.description}
                    </Typography>
                  </Grid>
                )}
                
                {record.rentalAgreement?.agreementImage && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Rental Agreement Document
                    </Typography>
                    <Paper 
                      elevation={2} 
                      sx={{ 
                        p: 2, 
                        backgroundColor: '#f5f5f5',
                        borderRadius: 2,
                        overflow: 'hidden'
                      }}
                    >
                      <Box
                        component="img"
                        src={`${window.location.origin}${record.rentalAgreement.agreementImage}`}
                        alt="Rental Agreement"
                        sx={{
                          width: '100%',
                          height: 'auto',
                          maxHeight: '600px',
                          objectFit: 'contain',
                          borderRadius: 1
                        }}
                      />
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Rental Agreement Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {record.rentalAgreement ? (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Property Name
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {record.rentalAgreement.propertyName}
                  </Typography>
                  
                  <Typography variant="subtitle2" color="text.secondary">
                    Agreement Number
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {record.rentalAgreement.agreementNumber}
                  </Typography>
                  
                  <Typography variant="subtitle2" color="text.secondary">
                    Monthly Rent
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {formatPKR(record.rentalAgreement.monthlyRent)}
                  </Typography>
                  
                  <Typography variant="subtitle2" color="text.secondary">
                    Property Address
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {record.rentalAgreement.propertyAddress}
                  </Typography>
                  
                  <Typography variant="subtitle2" color="text.secondary">
                    Landlord Name
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {record.rentalAgreement.landlordName}
                  </Typography>
                  
                  <Typography variant="subtitle2" color="text.secondary">
                    Landlord Contact
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {record.rentalAgreement.landlordContact}
                  </Typography>
                  
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => navigate(`/admin/rental-agreements/${record.rentalAgreement._id}`)}
                    sx={{ mt: 2 }}
                  >
                    View Full Agreement
                  </Button>
                </Box>
              ) : (
                <Box textAlign="center" py={4}>
                  <Typography variant="body2" color="text.secondary">
                    No rental agreement linked
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
                {record.createdBy?.firstName} {record.createdBy?.lastName}
              </Typography>
              
              <Typography variant="subtitle2" color="text.secondary">
                Created Date
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {format(new Date(record.createdAt), 'dd/MM/yyyy HH:mm')}
              </Typography>
              
              <Typography variant="subtitle2" color="text.secondary">
                Last Updated
              </Typography>
              <Typography variant="body1">
                {format(new Date(record.updatedAt), 'dd/MM/yyyy HH:mm')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default RentalManagementDetail;
