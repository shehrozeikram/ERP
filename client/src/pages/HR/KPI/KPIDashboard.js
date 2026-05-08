import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  useTheme,
  Button,
  CircularProgress
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon
} from '@mui/icons-material';
import api from '../../../services/api';

const KPIDashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    templates: 0,
    activeCycles: 0,
    pendingEvaluations: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [templatesRes, cyclesRes, evalsRes] = await Promise.all([
          api.get('/kpi/templates'),
          api.get('/kpi/cycles'),
          api.get('/kpi/evaluations/review')
        ]);
        
        setStats({
          templates: templatesRes.data?.data?.length || 0,
          activeCycles: cyclesRes.data?.data?.filter(c => c.status === 'active').length || 0,
          pendingEvaluations: evalsRes.data?.data?.filter(e => e.status === 'self_submitted').length || 0
        });
      } catch (error) {
        console.error('Error fetching KPI stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.text.primary }}>
          KPI & Performance Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={<AssignmentIcon />}
            onClick={() => navigate('/hr/kpi/templates')}
          >
            Manage Templates
          </Button>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => navigate('/hr/kpi/cycles')}
          >
            New Evaluation Cycle
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card 
            sx={{ 
              bgcolor: theme.palette.primary.main, 
              color: 'white',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'scale(1.02)' }
            }}
            onClick={() => navigate('/hr/kpi/templates')}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ opacity: 0.8, mb: 1 }}>KPI Templates</Typography>
                  <Typography variant="h3" sx={{ fontWeight: 'bold' }}>{stats.templates}</Typography>
                </Box>
                <AssignmentIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card 
            sx={{ 
              bgcolor: theme.palette.success.main, 
              color: 'white',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'scale(1.02)' }
            }}
            onClick={() => navigate('/hr/kpi/cycles')}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ opacity: 0.8, mb: 1 }}>Active Cycles</Typography>
                  <Typography variant="h3" sx={{ fontWeight: 'bold' }}>{stats.activeCycles}</Typography>
                </Box>
                <TimelineIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card 
            sx={{ 
              bgcolor: theme.palette.warning.main, 
              color: 'white',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'scale(1.02)' }
            }}
            onClick={() => navigate('/hr/kpi/review')}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ opacity: 0.8, mb: 1 }}>Pending Reviews</Typography>
                  <Typography variant="h3" sx={{ fontWeight: 'bold' }}>{stats.pendingEvaluations}</Typography>
                </Box>
                <CheckCircleIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Quick Actions</Typography>
          <Grid container spacing={2}>
            <Grid item>
              <Button size="small" variant="text" onClick={() => navigate('/hr/kpi/templates')}>Create Template</Button>
            </Grid>
            <Grid item>
              <Button size="small" variant="text" onClick={() => navigate('/hr/kpi/cycles')}>Launch Cycle</Button>
            </Grid>
            <Grid item>
              <Button size="small" variant="text" onClick={() => navigate('/hr/kpi/review')}>Review Team</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default KPIDashboard;
