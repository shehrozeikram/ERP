import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Avatar, 
  Grid, 
  Card,
  CardContent,
  Divider,
  Chip,
  alpha,
  useTheme,
  IconButton,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip
} from '@mui/material';
import { Person as PersonIcon, Email, Phone, Work, LocationOn, CameraAlt as CameraIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import api from '../../services/api';
import { getImageUrl } from '../../utils/imageService';

const Profile = () => {
  const theme = useTheme();
  const { user, updateProfile } = useAuth();
  const [profileImage, setProfileImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Load profile image if available
    if (user?.profileImage) {
      setProfileImage(getImageUrl(user.profileImage));
    } else {
      setProfileImage(null);
    }
  }, [user]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setSnackbar({
        open: true,
        message: 'Please select a valid image file',
        severity: 'error'
      });
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setSnackbar({
        open: true,
        message: 'Image size must be less than 5MB',
        severity: 'error'
      });
      return;
    }

    try {
      setUploading(true);

      // Show preview immediately
      const previewUrl = URL.createObjectURL(file);
      setProfileImage(previewUrl);

      // Upload image
      const formData = new FormData();
      formData.append('profileImage', file);

      const response = await api.post('/auth/upload-profile-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const imagePath = response.data.data.imagePath;
        
        // Update user profile with new image path
        try {
          await updateProfile({ profileImage: imagePath });
        } catch (updateError) {
          console.error('Error updating profile:', updateError);
          // Continue even if profile update fails - image is already uploaded
        }

        // Refresh user data to get updated profile
        try {
          const profileResponse = await authService.getProfile();
          if (profileResponse?.data?.data?.user) {
            const updatedUser = profileResponse.data.data.user;
            // Update local state with proper image URL
            setProfileImage(getImageUrl(updatedUser.profileImage || imagePath));
          } else {
            setProfileImage(getImageUrl(imagePath));
          }
        } catch (refreshError) {
          console.error('Error refreshing profile:', refreshError);
          setProfileImage(getImageUrl(imagePath));
        }

        setSnackbar({
          open: true,
          message: 'Profile image updated successfully!',
          severity: 'success'
        });
      } else {
        throw new Error(response.data.message || 'Image upload failed');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      
      // Revert to original image on error
      if (user?.profileImage) {
        setProfileImage(getImageUrl(user.profileImage));
      } else {
        setProfileImage(null);
      }

      setSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to upload image. Please try again.',
        severity: 'error'
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

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
              <Box sx={{ position: 'relative', display: 'inline-block', mb: 3 }}>
                <Avatar 
                  src={profileImage}
                  sx={{ 
                    width: 150, 
                    height: 150, 
                    mx: 'auto',
                    border: `4px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                    boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.2)}`,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.3)}`
                    }
                  }}
                  onClick={handleImageClick}
                >
                  {!profileImage && (
                    <PersonIcon sx={{ fontSize: 60, color: theme.palette.primary.main }} />
                  )}
                </Avatar>
                <Tooltip title="Click to upload or change profile image">
                  <IconButton
                    onClick={handleImageClick}
                    disabled={uploading}
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      bgcolor: theme.palette.primary.main,
                      color: 'white',
                      border: `3px solid ${theme.palette.background.paper}`,
                      '&:hover': {
                        bgcolor: theme.palette.primary.dark,
                        transform: 'scale(1.1)'
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {uploading ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <CameraIcon />
                    )}
                  </IconButton>
                </Tooltip>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </Box>
              
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                {user?.firstName} {user?.lastName}
              </Typography>
              
              <Typography variant="body1" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
                {user?.position || 'Employee'}
              </Typography>
              
              <Chip 
                label={(user?.roleRef?.name || user?.roleRef?.displayName || user?.roles?.[0]?.name || user?.role || 'Employee').toUpperCase()} 
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

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Profile; 