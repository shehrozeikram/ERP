import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Container,
  Paper,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Business
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { useAuth } from '../../contexts/AuthContext';

const validationSchema = yup.object({
  email: yup
    .string('Enter your email')
    .email('Enter a valid email')
    .required('Email is required'),
  password: yup
    .string('Enter your password')
    .min(6, 'Password should be of minimum 6 characters length')
    .required('Password is required'),
});

const Login = () => {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoRotating, setLogoRotating] = useState(true);

  // Stop logo rotation after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setLogoRotating(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        const result = await login(values);
        if (!result.success) {
          // Error is handled by the auth context
        }
      } catch (error) {
        console.error('Login error:', error);
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        '@keyframes revolveLeftToRight': {
          '0%': {
            transform: 'rotateY(0deg)',
          },
          '50%': {
            transform: 'rotateY(180deg)',
          },
          '100%': {
            transform: 'rotateY(360deg)',
          },
        },
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={24}
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}
        >
          {/* Header */}
          <Box
            sx={{
              background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              color: 'white',
              p: 4,
              textAlign: 'center'
            }}
          >
            <Box
              component="img"
              src={process.env.PUBLIC_URL + '/images/sgc-logo.png'}
              alt="SGC Logo"
              sx={{
                height: 90,
                width: 'auto',
                maxWidth: '240px',
                mb: 2,
                objectFit: 'contain',
                display: 'block',
                margin: '0 auto 16px auto',
                animation: logoRotating ? 'revolveLeftToRight 1.5s ease-in-out infinite' : 'none',
                transition: 'animation 0.5s ease-out'
              }}
            />
            <Typography variant="h4" component="h1" gutterBottom>
              Tovus ERP System
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Enterprise Resource Planning Solution
            </Typography>
          </Box>

          {/* Login Form */}
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" component="h2" gutterBottom align="center">
              Sign In
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 4 }}>
              Enter your credentials to access the system
            </Typography>

            <form onSubmit={formik.handleSubmit}>
              <TextField
                fullWidth
                id="email"
                name="email"
                label="Email Address"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.email && Boolean(formik.errors.email)}
                helperText={formik.touched.email && formik.errors.email}
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email color="action" />
                    </InputAdornment>
                  ),
                }}
                disabled={loading}
              />

              <TextField
                fullWidth
                id="password"
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.password && Boolean(formik.errors.password)}
                helperText={formik.touched.password && formik.errors.password}
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        disabled={loading}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                disabled={loading}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{
                  mt: 3,
                  mb: 2,
                  py: 1.5,
                  background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                  }
                }}
                disabled={loading || !formik.isValid}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>

              <Box sx={{ 
                textAlign: 'center', 
                mt: 3,
                p: 2,
                borderRadius: 2,
                background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(25, 118, 210, 0.02) 100%)',
                border: '1px solid rgba(25, 118, 210, 0.1)'
              }}>
                <Typography variant="h6" sx={{ 
                  color: 'primary.main', 
                  fontWeight: 600,
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1
                }}>
                  <Business sx={{ fontSize: 20 }} />
                  Enterprise Features
                </Typography>
                <Typography variant="body2" sx={{ 
                  color: 'text.primary',
                  fontWeight: 500,
                  mb: 1
                }}>
                  Custom Built • Customizable • Light Speed Solution
                </Typography>
                <Typography variant="body2" sx={{ 
                  color: 'text.secondary',
                  fontStyle: 'italic',
                  fontSize: '0.875rem'
                }}>
                  Need credentials? Contact your system administrator
                </Typography>
              </Box>
            </form>
          </CardContent>
        </Paper>

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography variant="body2" color="white" sx={{ opacity: 0.8 }}>
            © 2025 Tovus ERP System. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Login; 