import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Event as EventIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  Add as AddIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import eventService from '../../../services/eventService';

const EventDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalEvents: 0,
    upcomingEvents: 0,
    completedEvents: 0,
    totalParticipants: 0
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch events with different filters
      const [allEvents, upcomingEvents, completedEvents] = await Promise.all([
        eventService.getEvents({ limit: 1000 }),
        eventService.getEvents({ status: 'Planned', limit: 1000 }),
        eventService.getEvents({ status: 'Completed', limit: 1000 })
      ]);

      // Calculate stats
      const totalEvents = allEvents.data?.length || 0;
      const upcoming = upcomingEvents.data?.length || 0;
      const completed = completedEvents.data?.length || 0;
      
      // Calculate total participants
      const totalParticipants = allEvents.data?.reduce((sum, event) => {
        return sum + (event.currentParticipants || 0);
      }, 0) || 0;

      setStats({
        totalEvents,
        upcomingEvents: upcoming,
        completedEvents: completed,
        totalParticipants
      });

      // Set recent events (last 5)
      setRecentEvents(allEvents.data?.slice(0, 5) || []);

    } catch (err) {
      setError('Failed to fetch dashboard data');
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const getStatusColor = (status) => {
    const colors = {
      'Planned': 'default',
      'Confirmed': 'primary',
      'In Progress': 'warning',
      'Completed': 'success',
      'Cancelled': 'error'
    };
    return colors[status] || 'default';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (time) => {
    return time || 'N/A';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading dashboard...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Event Management Dashboard
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchDashboardData} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/events/new')}
          >
            New Event
          </Button>
        </Box>
      </Box>

      {error && (
        <Box mb={3}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <EventIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {stats.totalEvents}
                  </Typography>
                  <Typography color="text.secondary">
                    Total Events
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <ScheduleIcon color="warning" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {stats.upcomingEvents}
                  </Typography>
                  <Typography color="text.secondary">
                    Upcoming Events
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <EventIcon color="success" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {stats.completedEvents}
                  </Typography>
                  <Typography color="text.secondary">
                    Completed Events
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PeopleIcon color="info" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {stats.totalParticipants}
                  </Typography>
                  <Typography color="text.secondary">
                    Total Participants
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Events */}
      <Card>
        <CardContent>
          <Typography variant="h6" component="h2" mb={2}>
            Recent Events
          </Typography>
          
          {recentEvents.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={3}>
              No events found. Create your first event to get started.
            </Typography>
          ) : (
            <Box>
              {recentEvents.map((event) => (
                <Box
                  key={event._id}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  py={2}
                  borderBottom="1px solid #e0e0e0"
                  sx={{ '&:last-child': { borderBottom: 'none' } }}
                >
                  <Box flex={1}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {event.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(event.eventDate)} • {formatTime(event.startTime)} - {formatTime(event.endTime)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {event.location} • {event.category}
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Chip
                      label={event.status}
                      color={getStatusColor(event.status)}
                      size="small"
                    />
                    <Button
                      size="small"
                      onClick={() => navigate(`/admin/events/${event._id}`)}
                    >
                      View Details
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default EventDashboard;
