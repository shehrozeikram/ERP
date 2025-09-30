import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Grid,
  Alert,
  CircularProgress,
  Divider,
  Paper
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import incrementService from '../../services/incrementService';

const IncrementDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [increment, setIncrement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchIncrementDetail();
    }
  }, [id]);

  const fetchIncrementDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await incrementService.getIncrementById(id);
      
      if (response.success) {
        setIncrement(response.data);
      } else {
        setError(response.error || 'Failed to fetch increment details');
      }
    } catch (error) {
      console.error('Error fetching increment detail:', error);
      setError('Failed to fetch increment details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      const response = await incrementService.approveIncrement(id, 'Approved via detail view');
      
      if (response.success) {
        setIncrement(prev => ({ ...prev, status: 'implemented' }));
        alert('Increment approved successfully!');
      } else {
        alert(response.error || 'Failed to approve increment');
      }
    } catch (error) {
      console.error('Error approving increment:', error);
      alert('Failed to approve increment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setActionLoading(true);
      const response = await incrementService.rejectIncrement(id, 'Rejected via detail view');
      
      if (response.success) {
        setIncrement(prev => ({ ...prev, status: 'rejected' }));
        alert('Increment rejected');
      } else {
        alert(response.error || 'Failed to reject increment');
      }
    } catch (error) {
      console.error('Error rejecting increment:', error);
      alert('Failed to reject increment');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'implemented': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'implemented': return <CheckCircleIcon />;
      case 'rejected': return <CancelIcon />;
      default: return null;
    }
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
      <Box p={3}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/hr/increments')}
        >
          Back to Increments
        </Button>
      </Box>
    );
  }

  if (!increment) {
    return (
      <Box p={3}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Increment not found
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/hr/increments')}
        >
          Back to Increments
        </Button>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center">
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/hr/increments')}
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Typography variant="h4">
            Increment Details
          </Typography>
        </Box>
        
        <Chip
          icon={getStatusIcon(increment.status)}
          label={increment.status.charAt(0).toUpperCase() + increment.status.slice(1)}
          color={getStatusColor(increment.status)}
          size="large"
        />
      </Box>

      <Grid container spacing={3}>
        {/* Main Details */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Employee Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Employee Name
                  </Typography>
                  <Typography variant="h6">
                    {increment.employee?.firstName} {increment.employee?.lastName}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Employee ID
                  </Typography>
                  <Typography variant="h6">
                    {increment.employee?.employeeId}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Increment Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Increment Type
                  </Typography>
                  <Typography variant="h6">
                    {increment.incrementType.replace('_', ' ').toUpperCase()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Effective Date
                  </Typography>
                  <Typography variant="h6">
                    {new Date(increment.effectiveDate).toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Previous Salary
                  </Typography>
                  <Typography variant="h6" color="textSecondary">
                    Rs. {increment.previousSalary.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    New Salary
                  </Typography>
                  <Typography variant="h6" color="primary">
                    Rs. {increment.newSalary.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Increment Amount
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    Rs. {increment.incrementAmount.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Increment Percentage
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {increment.incrementPercentage}%
                  </Typography>
                </Grid>
              </Grid>

              {increment.reason && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="textSecondary">
                    Reason
                  </Typography>
                  <Typography variant="body1">
                    {increment.reason}
                  </Typography>
                </>
              )}

              {increment.comments && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="textSecondary">
                    Comments
                  </Typography>
                  <Typography variant="body1">
                    {increment.comments}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Request Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Requested By
                </Typography>
                <Typography variant="body1">
                  {increment.requestedBy?.firstName} {increment.requestedBy?.lastName}
                </Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Request Date
                </Typography>
                <Typography variant="body1">
                  {new Date(increment.requestDate).toLocaleDateString()}
                </Typography>
              </Box>

              {increment.approvedBy && (
                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary">
                    {increment.status === 'rejected' ? 'Rejected By' : 'Approved By'}
                  </Typography>
                  <Typography variant="body1">
                    {increment.approvedBy.firstName} {increment.approvedBy.lastName}
                  </Typography>
                </Box>
              )}

              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Status
                </Typography>
                <Chip
                  icon={getStatusIcon(increment.status)}
                  label={increment.status.charAt(0).toUpperCase() + increment.status.slice(1)}
                  color={getStatusColor(increment.status)}
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {increment.status === 'pending' && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Actions
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box display="flex" flexDirection="column" gap={1}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={handleApprove}
                    disabled={actionLoading}
                    fullWidth
                  >
                    Approve Increment
                  </Button>
                  
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<CancelIcon />}
                    onClick={handleReject}
                    disabled={actionLoading}
                    fullWidth
                  >
                    Reject Increment
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default IncrementDetail;
