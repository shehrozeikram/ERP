import React, { useMemo } from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Skeleton
} from '@mui/material';

const DesignationSummary = ({ loading, error, designations, summary }) => {
  const totalEmployees = designations?.reduce?.((sum, item) => sum + (item.holderCount || 0), 0) || 0;
  const groupedDesignations = useMemo(() => {
    const list = designations || [];
    return {
      white: list.filter(item => item.category === 'white_collar'),
      blue: list.filter(item => item.category === 'blue_collar')
    };
  }, [designations]);

  if (loading) {
    return (
      <Paper elevation={0} sx={{ p: 3 }}>
        <Skeleton variant="text" width="30%" height={36} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper elevation={0} sx={{ p: 3 }}>
        <Typography color="error">{error}</Typography>
      </Paper>
    );
  }

  if (!designations || designations.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          Designations in System
        </Typography>
        <Typography color="text.secondary">
          No designations found in employee records yet.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Designations in System
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={`${designations.length} designations`} color="primary" />
          <Chip label={`${totalEmployees} employees`} color="secondary" />
          {summary?.whiteCollar && (
            <Chip
              label={`White-collar: ${summary.whiteCollar.designations} / ${summary.whiteCollar.employees} emp`}
              color="success"
            />
          )}
          {summary?.blueCollar && (
            <Chip
              label={`Blue-collar: ${summary.blueCollar.designations} / ${summary.blueCollar.employees} emp`}
              color="info"
            />
          )}
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Pulled directly from employee placement records to ensure authorities list stays consistent.
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Grid container spacing={3}>
        {[
          { label: 'White Collar', key: 'white', color: 'success', list: groupedDesignations.white },
          { label: 'Blue Collar', key: 'blue', color: 'info', list: groupedDesignations.blue }
        ].map(({ label, key, color, list }) => (
          <Grid item xs={12} md={6} key={key}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{label}</Typography>
              <Chip label={`${list.length} designations`} color={color} size="small" />
            </Box>
            {list.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No {label.toLowerCase()} designations found.
              </Typography>
            ) : (
              <List dense>
                {list.map((item) => (
                  <ListItem key={item.designationId} sx={{ px: 0, alignItems: 'flex-start' }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                          <Typography sx={{ fontWeight: 600 }}>{item.title}</Typography>
                          {item.level && <Chip label={item.level} size="small" />}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 1, color: 'text.secondary' }}>
                          {item.department?.name && (
                            <Typography variant="caption">
                              Dept: {item.department.name}
                            </Typography>
                          )}
                          <Typography variant="caption">
                            Holders: {item.holderCount || 0}
                          </Typography>
                          {item.section?.name && (
                            <Typography variant="caption">
                              Section: {item.section.name}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

export default DesignationSummary;

