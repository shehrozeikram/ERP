import React from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  Skeleton,
  Grid
} from '@mui/material';

// Simple loading spinner
export const LoadingSpinner = ({ 
  message = 'Loading...', 
  size = 40, 
  fullHeight = false,
  color = 'primary' 
}) => {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: fullHeight ? '100vh' : '400px',
        gap: 2
      }}
    >
      <CircularProgress size={size} color={color} />
      {message && (
        <Typography variant="body1" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );
};

// Loading spinner with linear progress
export const LoadingSpinnerWithProgress = ({ 
  message = 'Loading...', 
  progress = 0,
  fullHeight = false 
}) => {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: fullHeight ? '100vh' : '400px',
        gap: 2,
        p: 3
      }}
    >
      <CircularProgress size={60} />
      {message && (
        <Typography variant="h6" color="text.secondary" textAlign="center">
          {message}
        </Typography>
      )}
      {progress > 0 && (
        <Box sx={{ width: '100%', maxWidth: 300 }}>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 1 }}>
            {Math.round(progress)}% Complete
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// Skeleton loading for tables
export const TableSkeleton = ({ rows = 5, columns = 6 }) => {
  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[...Array(4)].map((_, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="60%" height={20} />
                <Skeleton variant="text" width="40%" height={40} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      <Card>
        <CardContent>
          <Skeleton variant="text" width="30%" height={32} sx={{ mb: 2 }} />
          <Box sx={{ overflow: 'hidden' }}>
            <Skeleton variant="rectangular" height={60} sx={{ mb: 1 }} />
            {[...Array(rows)].map((_, index) => (
              <Skeleton 
                key={index} 
                variant="rectangular" 
                height={56} 
                sx={{ mb: 0.5 }} 
              />
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

// Skeleton loading for cards
export const CardsSkeleton = ({ count = 4, columns = 4 }) => {
  return (
    <Grid container spacing={3}>
      {[...Array(count)].map((_, index) => (
        <Grid item xs={12} sm={6} md={12 / columns} key={index}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="60%" height={20} />
              <Skeleton variant="text" width="40%" height={40} />
              <Skeleton variant="text" width="80%" height={16} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

// Page loading with skeleton
export const PageLoading = ({ 
  message = 'Loading page...',
  showSkeleton = true,
  skeletonType = 'table' // 'table' or 'cards'
}) => {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
        <CircularProgress size={50} />
        <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
          {message}
        </Typography>
      </Box>
      
      {showSkeleton && (
        skeletonType === 'table' ? <TableSkeleton /> : <CardsSkeleton />
      )}
    </Box>
  );
};

export default LoadingSpinner; 