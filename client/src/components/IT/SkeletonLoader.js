import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Skeleton,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';

// Dashboard Skeleton
export const DashboardSkeleton = () => (
  <Box>
    {/* Header Skeleton */}
    <Box sx={{ mb: 3 }}>
      <Skeleton variant="text" width={300} height={40} />
      <Skeleton variant="text" width={200} height={24} sx={{ mt: 1 }} />
    </Box>

    {/* Stats Cards Skeleton */}
    <Grid container spacing={3} sx={{ mb: 3 }}>
      {[1, 2, 3, 4].map((item) => (
        <Grid item xs={12} sm={6} md={3} key={item}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Skeleton variant="circular" width={40} height={40} />
                <Box sx={{ ml: 2, flexGrow: 1 }}>
                  <Skeleton variant="text" width={120} height={24} />
                  <Skeleton variant="text" width={80} height={20} />
                </Box>
              </Box>
              <Skeleton variant="text" width={60} height={32} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>

    {/* Charts Skeleton */}
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Skeleton variant="text" width={200} height={24} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={300} />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Skeleton variant="text" width={200} height={24} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={300} />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  </Box>
);

// Table Skeleton
export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <TableContainer component={Paper}>
    <Table>
      <TableHead>
        <TableRow>
          {Array.from({ length: columns }).map((_, index) => (
            <TableCell key={index}>
              <Skeleton variant="text" width="80%" height={24} />
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <TableCell key={colIndex}>
                <Skeleton variant="text" width="90%" height={20} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

// Form Skeleton
export const FormSkeleton = ({ fields = 6 }) => (
  <Card>
    <CardContent>
      <Skeleton variant="text" width={200} height={32} sx={{ mb: 3 }} />
      <Grid container spacing={3}>
        {Array.from({ length: fields }).map((_, index) => (
          <Grid item xs={12} sm={6} key={index}>
            <Skeleton variant="text" width={120} height={20} sx={{ mb: 1 }} />
            <Skeleton variant="rectangular" width="100%" height={56} />
          </Grid>
        ))}
      </Grid>
      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Skeleton variant="rectangular" width={100} height={36} />
        <Skeleton variant="rectangular" width={100} height={36} />
      </Box>
    </CardContent>
  </Card>
);

// Card Grid Skeleton
export const CardGridSkeleton = ({ items = 6 }) => (
  <Grid container spacing={3}>
    {Array.from({ length: items }).map((_, index) => (
      <Grid item xs={12} sm={6} md={4} key={index}>
        <Card>
          <CardContent>
            <Skeleton variant="text" width="80%" height={24} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="60%" height={20} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={120} sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Skeleton variant="rectangular" width={60} height={24} />
              <Skeleton variant="rectangular" width={60} height={24} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    ))}
  </Grid>
);

// List Skeleton
export const ListSkeleton = ({ items = 8 }) => (
  <Box>
    {Array.from({ length: items }).map((_, index) => (
      <Card key={index} sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ flexGrow: 1 }}>
              <Skeleton variant="text" width="70%" height={24} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="50%" height={20} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Skeleton variant="circular" width={32} height={32} />
              <Skeleton variant="circular" width={32} height={32} />
            </Box>
          </Box>
        </CardContent>
      </Card>
    ))}
  </Box>
);

// Reports Skeleton
export const ReportsSkeleton = () => (
  <Box>
    {/* Header */}
    <Box sx={{ mb: 3 }}>
      <Skeleton variant="text" width={300} height={40} />
      <Skeleton variant="text" width={200} height={24} sx={{ mt: 1 }} />
    </Box>

    {/* Filters */}
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Grid container spacing={3}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Skeleton variant="text" width={100} height={20} sx={{ mb: 1 }} />
              <Skeleton variant="rectangular" width="100%" height={56} />
            </Grid>
          ))}
        </Grid>
        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Skeleton variant="rectangular" width={100} height={36} />
          <Skeleton variant="rectangular" width={100} height={36} />
        </Box>
      </CardContent>
    </Card>

    {/* Tabs */}
    <Box sx={{ mb: 3 }}>
      <Skeleton variant="rectangular" width="100%" height={48} />
    </Box>

    {/* Charts and Tables */}
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Skeleton variant="text" width={200} height={24} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={300} />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Skeleton variant="text" width={200} height={24} sx={{ mb: 2 }} />
            <TableSkeleton rows={5} columns={3} />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  </Box>
);

export default {
  DashboardSkeleton,
  TableSkeleton,
  FormSkeleton,
  CardGridSkeleton,
  ListSkeleton,
  ReportsSkeleton
};
