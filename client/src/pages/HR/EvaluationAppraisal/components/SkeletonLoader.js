import React from 'react';
import { Box, Skeleton, Card, CardContent } from '@mui/material';

export const DocumentCardSkeleton = () => (
  <Card sx={{ mb: 2 }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box flex={1}>
          <Skeleton variant="text" width="40%" height={32} />
          <Skeleton variant="text" width="60%" height={24} sx={{ mt: 1 }} />
          <Skeleton variant="text" width="50%" height={20} sx={{ mt: 0.5 }} />
        </Box>
        <Box display="flex" gap={1}>
          <Skeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" width={80} height={36} sx={{ borderRadius: 1 }} />
        </Box>
      </Box>
      <Box>
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ mb: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Skeleton variant="text" width="30%" height={24} />
            <Skeleton variant="text" width="50%" height={20} sx={{ mt: 0.5 }} />
            <Skeleton variant="text" width="40%" height={20} sx={{ mt: 0.5 }} />
          </Box>
        ))}
      </Box>
    </CardContent>
  </Card>
);

export const DashboardSkeleton = () => (
  <Box p={3}>
    <Skeleton variant="text" width="40%" height={48} sx={{ mb: 3 }} />
    <Box display="flex" gap={2} mb={3} flexWrap="wrap">
      <Skeleton variant="rectangular" width={300} height={56} sx={{ borderRadius: 1 }} />
      <Skeleton variant="rectangular" width={150} height={56} sx={{ borderRadius: 1 }} />
      <Skeleton variant="rectangular" width={150} height={56} sx={{ borderRadius: 1 }} />
    </Box>
    <Box display="flex" gap={2} mb={3} flexWrap="wrap">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Skeleton key={i} variant="rectangular" width={120} height={32} sx={{ borderRadius: 2 }} />
      ))}
    </Box>
    {[1, 2, 3].map((i) => (
      <DocumentCardSkeleton key={i} />
    ))}
  </Box>
);

export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <Box>
    <Box display="flex" gap={1} mb={2}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" width="100%" height={40} sx={{ borderRadius: 1 }} />
      ))}
    </Box>
    {Array.from({ length: rows }).map((_, i) => (
      <Box key={i} display="flex" gap={1} mb={1}>
        {Array.from({ length: columns }).map((_, j) => (
          <Skeleton key={j} variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1 }} />
        ))}
      </Box>
    ))}
  </Box>
);

export default DashboardSkeleton;

