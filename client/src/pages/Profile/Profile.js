import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Avatar, 
  Grid, 
  Card,
  CardContent,
  Divider,
  Chip,
  alpha,
  useTheme
} from '@mui/material';
import { Person as PersonIcon, Email, Phone, Work, LocationOn } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const Profile = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [profileImage, setProfileImage] = useState(null);

  useEffect(() => {
    // Load profile image if available
    if (user?.profileImage) {
      setProfileImage(user.profileImage);
    }
  }, [user]);

  const formatEmployeeId = (employeeId) => {
    if (!employeeId) return 'N/A';
    return employeeId.toString().padStart(4, '0');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: theme.palette.text.primary }}>
        User Profile
      </Typography>
      
      <Grid container spacing={3}>
        {/* Profile Image and Basic Info */}
        <Grid item xs={12} md={4}>
          <Card sx={{ 
            height: '100%',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
          }}>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Avatar 
                src={profileImage}
                sx={{ 
                  width: 150, 
                  height: 150, 
                  mx: 'auto', 
                  mb: 3,
                  border: `4px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.2)}`
                }}
              >
                {!profileImage && (
                  <PersonIcon sx={{ fontSize: 60, color: theme.palette.primary.main }} />
                )}
              </Avatar>
              
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                {user?.firstName} {user?.lastName}
              </Typography>
              
              <Typography variant="body1" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
                {user?.position || 'Employee'}
              </Typography>
              
              <Chip 
                label={user?.role?.toUpperCase() || 'EMPLOYEE'} 
                color="primary" 
                variant="outlined"
                sx={{ fontWeight: 'bold' }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Detailed Information */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, color: theme.palette.text.primary }}>
                Profile Information
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Email sx={{ color: theme.palette.primary.main }} />
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Email Address
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {user?.email || 'N/A'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Work sx={{ color: theme.palette.primary.main }} />
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Employee ID
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {formatEmployeeId(user?.employeeId)}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Phone sx={{ color: theme.palette.primary.main }} />
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Phone Number
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {user?.phone || 'N/A'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <LocationOn sx={{ color: theme.palette.primary.main }} />
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Department
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {user?.department || 'N/A'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    Account Status
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip 
                      label={user?.isActive ? 'Active' : 'Inactive'} 
                      color={user?.isActive ? 'success' : 'error'} 
                      size="small"
                    />
                    {user?.isEmailVerified && (
                      <Chip 
                        label="Email Verified" 
                        color="info" 
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Profile; 