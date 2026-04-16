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
  Tooltip,
  TextField,
  Button
} from '@mui/material';
import { Person as PersonIcon, Email, Phone, Work, LocationOn, CameraAlt as CameraIcon, Draw as DrawIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import api from '../../services/api';
import { getImageUrl } from '../../utils/imageService';

const Profile = () => {
  const theme = useTheme();
  const { user, updateProfile, changePassword, refreshUser } = useAuth();
  const [profileImage, setProfileImage] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const fileInputRef = useRef(null);
  const signatureInputRef = useRef(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  useEffect(() => {
    if (user?.profileImage) {
      setProfileImage(getImageUrl(user.profileImage));
    } else {
      setProfileImage(null);
    }
    if (user?.digitalSignature) {
      setSignaturePreview(getImageUrl(user.digitalSignature));
    } else {
      setSignaturePreview(null);
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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setSnackbar({ open: true, message: 'New password must be at least 6 characters', severity: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSnackbar({ open: true, message: 'New password and confirmation do not match', severity: 'error' });
      return;
    }
    setPasswordSubmitting(true);
    const result = await changePassword({ currentPassword, newPassword });
    setPasswordSubmitting(false);
    if (result.success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleSignatureFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSnackbar({ open: true, message: 'Please select an image file (PNG, JPG, etc.)', severity: 'error' });
      return;
    }
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setSnackbar({ open: true, message: 'Signature image must be 2MB or smaller', severity: 'error' });
      return;
    }
    try {
      setSignatureUploading(true);
      const previewUrl = URL.createObjectURL(file);
      setSignaturePreview(previewUrl);
      const response = await authService.uploadDigitalSignature(file);
      if (response.data?.success) {
        await refreshUser();
        setSnackbar({ open: true, message: 'Digital signature saved successfully', severity: 'success' });
      } else {
        throw new Error(response.data?.message || 'Upload failed');
      }
    } catch (error) {
      if (user?.digitalSignature) {
        setSignaturePreview(getImageUrl(user.digitalSignature));
      } else {
        setSignaturePreview(null);
      }
      setSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to upload signature',
        severity: 'error'
      });
    } finally {
      setSignatureUploading(false);
      if (signatureInputRef.current) {
        signatureInputRef.current.value = '';
      }
    }
  };

  const handleRemoveSignature = async () => {
    try {
      setSignatureUploading(true);
      const result = await updateProfile({ digitalSignature: '' });
      if (result.success) {
        setSignaturePreview(null);
      }
    } finally {
      setSignatureUploading(false);
    }
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

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: theme.palette.text.primary }}>
                Change password
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Use your current password and choose a new one (at least 6 characters).
              </Typography>
              <Box component="form" onSubmit={handleChangePassword}>
                <TextField
                  fullWidth
                  type="password"
                  label="Current password"
                  value={currentPassword}
                  onChange={(ev) => setCurrentPassword(ev.target.value)}
                  margin="normal"
                  autoComplete="current-password"
                />
                <TextField
                  fullWidth
                  type="password"
                  label="New password"
                  value={newPassword}
                  onChange={(ev) => setNewPassword(ev.target.value)}
                  margin="normal"
                  autoComplete="new-password"
                />
                <TextField
                  fullWidth
                  type="password"
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={(ev) => setConfirmPassword(ev.target.value)}
                  margin="normal"
                  autoComplete="new-password"
                />
                <Button
                  type="submit"
                  variant="contained"
                  sx={{ mt: 2 }}
                  disabled={passwordSubmitting || !currentPassword || !newPassword || !confirmPassword}
                >
                  {passwordSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Update password'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <DrawIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.text.primary }}>
                  Digital signature
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Upload a clear image of your signature (PNG or JPG). It can be used on printouts and approvals where your signature is required.
              </Typography>
              <Box
                sx={{
                  border: `1px dashed ${alpha(theme.palette.primary.main, 0.4)}`,
                  borderRadius: 1,
                  p: 2,
                  minHeight: 100,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  mb: 2
                }}
              >
                {signaturePreview ? (
                  <Box
                    component="img"
                    src={signaturePreview}
                    alt="Your signature"
                    sx={{ maxHeight: 96, maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No signature on file
                  </Typography>
                )}
              </Box>
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/*"
                onChange={handleSignatureFileChange}
                style={{ display: 'none' }}
              />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={() => signatureInputRef.current?.click()}
                  disabled={signatureUploading}
                >
                  {signatureUploading ? <CircularProgress size={22} color="inherit" /> : 'Upload signature'}
                </Button>
                {user?.digitalSignature ? (
                  <Button variant="outlined" color="error" onClick={handleRemoveSignature} disabled={signatureUploading}>
                    Remove
                  </Button>
                ) : null}
              </Box>
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