import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Paper,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Today as TodayIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import axios from 'axios';
import api from '../../../services/api';

const LeaveCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    loadLeaveData();
  }, [currentDate]);

  const loadLeaveData = async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      const response = await api.get(`/leaves/calendar?year=${year}&month=${month}`);
      setLeaveRequests(response.data.data);
    } catch (error) {
      console.error('Error loading leave calendar:', error);
      setError('Failed to load leave calendar data');
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction) => {
    if (direction === 'prev') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getLeavesForDate = (date) => {
    return leaveRequests.filter(request => {
      const startDate = new Date(request.startDate);
      const endDate = new Date(request.endDate);
      return date >= startDate && date <= endDate;
    });
  };

  const getLeaveColor = (leaveType) => {
    const colorMap = {
      'ANNUAL': '#3B82F6',
      'CASUAL': '#10B981',
      'MEDICAL': '#EF4444',
      'MATERNITY': '#F59E0B',
      'PATERNITY': '#8B5CF6'
    };
    return colorMap[leaveType] || '#6B7280';
  };

  const getEmployeeInitials = (employee) => {
    return `${employee.firstName?.charAt(0) || ''}${employee.lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const renderCalendarDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Add empty cells for days before month start
    const startDay = monthStart.getDay();
    const emptyCells = Array.from({ length: startDay }, (_, i) => (
      <Box key={`empty-${i}`} sx={{ height: 120, border: '1px solid #e0e0e0' }} />
    ));

    const dayCells = days.map((day) => {
      const dayLeaves = getLeavesForDate(day);
      const isToday = isSameDay(day, new Date());
      const isCurrentMonth = isSameMonth(day, currentDate);

      return (
        <Box
          key={day.toISOString()}
          sx={{
            height: 120,
            border: '1px solid #e0e0e0',
            p: 1,
            backgroundColor: isToday ? '#e3f2fd' : isCurrentMonth ? 'white' : '#f5f5f5',
            position: 'relative',
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: '#f0f0f0'
            }
          }}
          onClick={() => {
            if (dayLeaves.length > 0) {
              setSelectedDate(day);
              setSelectedRequest(dayLeaves[0]); // Show first leave for the day
              setViewDialogOpen(true);
            }
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: isToday ? 'bold' : 'normal',
              color: isToday ? 'primary.main' : isCurrentMonth ? 'text.primary' : 'text.secondary'
            }}
          >
            {format(day, 'd')}
          </Typography>
          
          {dayLeaves.length > 0 && (
            <Box sx={{ mt: 0.5 }}>
              {dayLeaves.slice(0, 2).map((leave, index) => (
                <Chip
                  key={leave._id}
                  label={`${leave.employee.firstName} - ${leave.leaveType.name}`}
                  size="small"
                  sx={{
                    fontSize: '0.7rem',
                    height: 16,
                    backgroundColor: getLeaveColor(leave.leaveType.code),
                    color: 'white',
                    mb: 0.5,
                    display: 'block',
                    '& .MuiChip-label': {
                      px: 0.5
                    }
                  }}
                />
              ))}
              {dayLeaves.length > 2 && (
                <Typography variant="caption" color="text.secondary">
                  +{dayLeaves.length - 2} more
                </Typography>
              )}
            </Box>
          )}
        </Box>
      );
    });

    return [...emptyCells, ...dayCells];
  };

  const getMonthStats = () => {
    const monthLeaves = leaveRequests.filter(request => {
      const requestDate = new Date(request.startDate);
      return requestDate.getMonth() === currentDate.getMonth() && 
             requestDate.getFullYear() === currentDate.getFullYear();
    });

    const stats = {
      totalRequests: monthLeaves.length,
      totalDays: monthLeaves.reduce((sum, request) => sum + request.totalDays, 0),
      byType: {}
    };

    monthLeaves.forEach(request => {
      const type = request.leaveType.name;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });

    return stats;
  };

  const monthStats = getMonthStats();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Leave Calendar
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Calendar Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">
              {format(currentDate, 'MMMM yyyy')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<PrevIcon />}
                onClick={() => navigateMonth('prev')}
              >
                Previous
              </Button>
              <Button
                variant="outlined"
                startIcon={<TodayIcon />}
                onClick={goToToday}
              >
                Today
              </Button>
              <Button
                variant="outlined"
                startIcon={<NextIcon />}
                onClick={() => navigateMonth('next')}
              >
                Next
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadLeaveData}
              >
                Refresh
              </Button>
            </Box>
          </Box>

          {/* Month Statistics */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Typography variant="h6" color="primary">
                {monthStats.totalRequests}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Requests
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="h6" color="success.main">
                {monthStats.totalDays}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Days
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Leave Types:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {Object.entries(monthStats.byType).map(([type, count]) => (
                  <Chip
                    key={type}
                    label={`${type}: ${count}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent>
          {/* Day Headers */}
          <Grid container sx={{ mb: 1 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Grid item xs key={day} sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  {day}
                </Typography>
              </Grid>
            ))}
          </Grid>

          {/* Calendar Days */}
          <Grid container>
            {renderCalendarDays()}
          </Grid>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Leave Type Legend
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip label="Annual Leave" sx={{ backgroundColor: '#3B82F6', color: 'white' }} />
            <Chip label="Casual Leave" sx={{ backgroundColor: '#10B981', color: 'white' }} />
            <Chip label="Medical Leave" sx={{ backgroundColor: '#EF4444', color: 'white' }} />
            <Chip label="Maternity Leave" sx={{ backgroundColor: '#F59E0B', color: 'white' }} />
            <Chip label="Paternity Leave" sx={{ backgroundColor: '#8B5CF6', color: 'white' }} />
          </Box>
        </CardContent>
      </Card>

      {/* Leave Details Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Leave Details - {selectedDate && format(selectedDate, 'MMM dd, yyyy')}
        </DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Employee
                </Typography>
                <Typography variant="body1">
                  {selectedRequest.employee.firstName} {selectedRequest.employee.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ID: {selectedRequest.employee.employeeId}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Leave Type
                </Typography>
                <Chip
                  label={selectedRequest.leaveType.name}
                  sx={{ backgroundColor: getLeaveColor(selectedRequest.leaveType.code), color: 'white' }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Start Date
                </Typography>
                <Typography variant="body1">
                  {format(new Date(selectedRequest.startDate), 'MMM dd, yyyy')}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  End Date
                </Typography>
                <Typography variant="body1">
                  {format(new Date(selectedRequest.endDate), 'MMM dd, yyyy')}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Days
                </Typography>
                <Typography variant="body1">
                  {selectedRequest.totalDays}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  label={selectedRequest.status}
                  color={selectedRequest.status === 'approved' ? 'success' : 'warning'}
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Reason
                </Typography>
                <Typography variant="body1">
                  {selectedRequest.reason}
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LeaveCalendar;
