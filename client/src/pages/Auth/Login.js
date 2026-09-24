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
import { useLocation } from 'react-router-dom';

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
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoRotating, setLogoRotating] = useState(true);
  const redirectTo = location.state?.from
    ? `${location.state.from.pathname || ''}${location.state.from.search || ''}${location.state.from.hash || ''}`
    : null;

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
        const result = await login(values, { redirectTo });
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
        // Modern mobile browsers: account for dynamic toolbars
        '@supports (min-height: 100dvh)': { minHeight: '100dvh' },
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'center',
        p: { xs: 1.5, sm: 2 },
        py: { xs: 2, sm: 2 },
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
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
      <Container maxWidth="sm" disableGutters={false} sx={{ width: '100%', maxWidth: { xs: '100%', sm: 600 } }}>
        <Paper
          elevation={24}
          sx={{
            borderRadius: { xs: 3, sm: 4 },
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
              p: { xs: 2.5, sm: 4 },
              textAlign: 'center'
            }}
          >
            <Box
              component="img"
              src={process.env.PUBLIC_URL + '/images/sgc-logo.png'}
              alt="SGC Logo"
              sx={{
                height: { xs: 64, sm: 90 },
                width: 'auto',
                maxWidth: { xs: 160, sm: 240 },
                mb: { xs: 1, sm: 2 },
                objectFit: 'contain',
                display: 'block',
                margin: { xs: '0 auto 8px auto', sm: '0 auto 16px auto' },
                animation: logoRotating ? 'revolveLeftToRight 1.5s ease-in-out infinite' : 'none',
                transition: 'animation 0.5s ease-out'
              }}
            />
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{ fontSize: { xs: '1.45rem', sm: '2.125rem' }, fontWeight: 700, mb: { xs: 0.5, sm: 1 } }}
            >
              Tovus ERP System
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, fontSize: { xs: '0.85rem', sm: '1rem' } }}>
              Enterprise Resource Planning Solution
            </Typography>
          </Box>

          {/* Login Form */}
          <CardContent sx={{ p: { xs: 2.5, sm: 4 }, '&:last-child': { pb: { xs: 2.5, sm: 4 } } }}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              align="center"
              sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, fontWeight: 600 }}
            >
              Sign In
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
              sx={{ mb: { xs: 2.5, sm: 4 }, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
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
                size="medium"
                inputProps={{ autoComplete: 'email', inputMode: 'email' }}
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
                inputProps={{ autoComplete: 'current-password' }}
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
                        size="large"
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
                  mt: { xs: 2.5, sm: 3 },
                  mb: 2,
                  py: { xs: 1.35, sm: 1.5 },
                  fontSize: { xs: '1rem', sm: '1.05rem' },
                  minHeight: 48,
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
                mt: { xs: 2, sm: 3 },
                p: { xs: 1.5, sm: 2 },
                borderRadius: 2,
                background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(25, 118, 210, 0.02) 100%)',
                border: '1px solid rgba(25, 118, 210, 0.1)',
                display: { xs: 'none', sm: 'block' }
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
              <Typography
                variant="caption"
                color="text.secondary"
                align="center"
                display={{ xs: 'block', sm: 'none' }}
                sx={{ mt: 1 }}
              >
                Need credentials? Contact your administrator
              </Typography>
            </form>
          </CardContent>
        </Paper>

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt: { xs: 2, sm: 3 }, px: 1 }}>
          <Typography variant="body2" color="white" sx={{ opacity: 0.8, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
            © 2025 Tovus ERP System. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Login; 