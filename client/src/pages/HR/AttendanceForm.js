import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Chip,
  FormHelperText
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/authService';

const AttendanceForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({
    employee: '',
    date: new Date(),
    checkIn: {
      time: null,
      location: 'Office',
      method: 'Manual',
      late: false,
      lateMinutes: 0
    },
    checkOut: {
      time: null,
      location: 'Office',
      method: 'Manual',
      early: false,
      earlyMinutes: 0
    },
    status: 'Present',
    workHours: 0,
    overtimeHours: 0,
    breakTime: 0,
    notes: ''
  });
  const [errors, setErrors] = useState({});

  const statusOptions = [
    'Present',
    'Absent',
    'Late',
    'Half Day',
    'Leave',
    'Holiday',
    'Weekend',
    'Sick Leave',
    'Personal Leave',
    'Maternity Leave',
    'Paternity Leave'
  ];

  const methodOptions = [
    'Manual',
    'Biometric',
    'Card',
    'Mobile',
    'Web'
  ];

  const locationOptions = [
    'Office',
    'Home',
    'Client Site',
    'Travel',
    'Other'
  ];

  useEffect(() => {
    fetchEmployees();
    if (id) {
      fetchAttendance();
    }
  }, [id]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/hr/employees');
      setEmployees(response.data.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setError('Failed to load employees');
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/attendance/${id}`);
      const attendance = response.data.data;
      
      setFormData({
        employee: attendance.employee._id,
        date: new Date(attendance.date),
        checkIn: {
          time: attendance.checkIn?.time ? new Date(attendance.checkIn.time) : null,
          location: attendance.checkIn?.location || 'Office',
          method: attendance.checkIn?.method || 'Manual',
          late: attendance.checkIn?.late || false,
          lateMinutes: attendance.checkIn?.lateMinutes || 0
        },
        checkOut: {
          time: attendance.checkOut?.time ? new Date(attendance.checkOut.time) : null,
          location: attendance.checkOut?.location || 'Office',
          method: attendance.checkOut?.method || 'Manual',
          early: attendance.checkOut?.early || false,
          earlyMinutes: attendance.checkOut?.earlyMinutes || 0
        },
        status: attendance.status,
        workHours: attendance.workHours || 0,
        overtimeHours: attendance.overtimeHours || 0,
        breakTime: attendance.breakTime || 0,
        notes: attendance.notes || ''
      });
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setError('Failed to load attendance record');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.employee) {
      newErrors.employee = 'Employee is required';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    if (formData.status === 'Present' && !formData.checkIn.time) {
      newErrors.checkInTime = 'Check-in time is required for Present status';
    }

    if (formData.checkIn.time && formData.checkOut.time) {
      if (formData.checkOut.time <= formData.checkIn.time) {
        newErrors.checkOutTime = 'Check-out time must be after check-in time';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateWorkHours = () => {
    if (formData.checkIn.time && formData.checkOut.time) {
      const diffMs = formData.checkOut.time - formData.checkIn.time;
      const diffHours = diffMs / (1000 * 60 * 60);
      const totalHours = Math.round(diffHours * 100) / 100;
      
      // Subtract break time from total hours to get actual work hours
      const breakTime = formData.breakTime || 0;
      const workHours = Math.max(0, Math.round((totalHours - breakTime) * 100) / 100);
      
      // Calculate overtime (assuming 8 hours is standard work day)
      const overtimeHours = workHours > 8 ? Math.round((workHours - 8) * 100) / 100 : 0;
      
      setFormData(prev => ({
        ...prev,
        workHours: workHours,
        overtimeHours: overtimeHours
      }));
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Recalculate work hours when break time changes
    if (field === 'breakTime') {
      // Use setTimeout to ensure the state is updated before calculating
      setTimeout(() => {
        calculateWorkHours();
      }, 0);
    }

    // Clear field-specific errors
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const handleCheckInChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      checkIn: {
        ...prev.checkIn,
        [field]: value
      }
    }));

    if (field === 'time') {
      calculateWorkHours();
    }

    // Clear field-specific errors
    if (errors[`checkIn${field.charAt(0).toUpperCase() + field.slice(1)}`]) {
      setErrors(prev => ({
        ...prev,
        [`checkIn${field.charAt(0).toUpperCase() + field.slice(1)}`]: null
      }));
    }
  };

  const handleCheckOutChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      checkOut: {
        ...prev.checkOut,
        [field]: value
      }
    }));

    if (field === 'time') {
      calculateWorkHours();
    }

    // Clear field-specific errors
    if (errors[`checkOut${field.charAt(0).toUpperCase() + field.slice(1)}`]) {
      setErrors(prev => ({
        ...prev,
        [`checkOut${field.charAt(0).toUpperCase() + field.slice(1)}`]: null
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const attendanceData = {
        ...formData,
        date: formData.date.toISOString(),
        checkIn: {
          ...formData.checkIn,
          time: formData.checkIn.time ? formData.checkIn.time.toISOString() : null
        },
        checkOut: {
          ...formData.checkOut,
          time: formData.checkOut.time ? formData.checkOut.time.toISOString() : null
        }
      };

      console.log('Sending attendance data:', attendanceData);

      if (id) {
        console.log('Updating attendance with ID:', id);
        const response = await api.put(`/attendance/${id}`, attendanceData);
        console.log('Update response:', response.data);
      } else {
        console.log('Creating new attendance record');
        const response = await api.post('/attendance', attendanceData);
        console.log('Create response:', response.data);
      }

      console.log('Attendance saved successfully, navigating to list...');
      navigate('/hr/attendance');
    } catch (error) {
      console.error('Error saving attendance:', error);
      console.error('Error response:', error.response?.data);
      setError(error.response?.data?.message || 'Failed to save attendance record');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {id ? 'Edit Attendance Record' : 'Add Attendance Record'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Employee Selection */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!errors.employee}>
                <InputLabel>Employee *</InputLabel>
                <Select
                  value={formData.employee}
                  onChange={(e) => handleInputChange('employee', e.target.value)}
                  label="Employee *"
                  startAdornment={<PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                >
                  {employees.map((emp) => (
                    <MenuItem key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeId}) - {emp.department}
                    </MenuItem>
                  ))}
                </Select>
                {errors.employee && <FormHelperText>{errors.employee}</FormHelperText>}
              </FormControl>
            </Grid>

            {/* Date */}
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Date *"
                  value={formData.date}
                  onChange={(date) => handleInputChange('date', date)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      error={!!errors.date}
                      helperText={errors.date}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      }}
                    />
                  )}
                />
              </LocalizationProvider>
            </Grid>

            {/* Status */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  label="Status"
                >
                  {statusOptions.map((status) => (
                    <MenuItem key={status} value={status}>
                      <Chip
                        label={status}
                        color={
                          status === 'Present' ? 'success' :
                          status === 'Absent' ? 'error' :
                          status === 'Late' ? 'warning' :
                          'default'
                        }
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Break Time */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Break Time (hours)"
                type="number"
                value={formData.breakTime}
                onChange={(e) => handleInputChange('breakTime', parseFloat(e.target.value) || 0)}
                inputProps={{ min: 0, step: 0.5 }}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }}>
                <Chip label="Check-In Details" icon={<TimeIcon />} />
              </Divider>
            </Grid>

            {/* Check-In Time */}
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <TimePicker
                  label="Check-In Time"
                  value={formData.checkIn.time}
                  onChange={(time) => handleCheckInChange('time', time)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      error={!!errors.checkInTime}
                      helperText={errors.checkInTime}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: <TimeIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      }}
                    />
                  )}
                />
              </LocalizationProvider>
            </Grid>

            {/* Check-In Location */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Check-In Location</InputLabel>
                <Select
                  value={formData.checkIn.location}
                  onChange={(e) => handleCheckInChange('location', e.target.value)}
                  label="Check-In Location"
                  startAdornment={<LocationIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                >
                  {locationOptions.map((location) => (
                    <MenuItem key={location} value={location}>
                      {location}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Check-In Method */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Check-In Method</InputLabel>
                <Select
                  value={formData.checkIn.method}
                  onChange={(e) => handleCheckInChange('method', e.target.value)}
                  label="Check-In Method"
                >
                  {methodOptions.map((method) => (
                    <MenuItem key={method} value={method}>
                      {method}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Late Minutes */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Late Minutes"
                type="number"
                value={formData.checkIn.lateMinutes}
                onChange={(e) => handleCheckInChange('lateMinutes', parseInt(e.target.value) || 0)}
                inputProps={{ min: 0 }}
                disabled={!formData.checkIn.late}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }}>
                <Chip label="Check-Out Details" icon={<TimeIcon />} />
              </Divider>
            </Grid>

            {/* Check-Out Time */}
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <TimePicker
                  label="Check-Out Time"
                  value={formData.checkOut.time}
                  onChange={(time) => handleCheckOutChange('time', time)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      error={!!errors.checkOutTime}
                      helperText={errors.checkOutTime}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: <TimeIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      }}
                    />
                  )}
                />
              </LocalizationProvider>
            </Grid>

            {/* Check-Out Location */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Check-Out Location</InputLabel>
                <Select
                  value={formData.checkOut.location}
                  onChange={(e) => handleCheckOutChange('location', e.target.value)}
                  label="Check-Out Location"
                  startAdornment={<LocationIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                >
                  {locationOptions.map((location) => (
                    <MenuItem key={location} value={location}>
                      {location}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Check-Out Method */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Check-Out Method</InputLabel>
                <Select
                  value={formData.checkOut.method}
                  onChange={(e) => handleCheckOutChange('method', e.target.value)}
                  label="Check-Out Method"
                >
                  {methodOptions.map((method) => (
                    <MenuItem key={method} value={method}>
                      {method}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Early Minutes */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Early Minutes"
                type="number"
                value={formData.checkOut.earlyMinutes}
                onChange={(e) => handleCheckOutChange('earlyMinutes', parseInt(e.target.value) || 0)}
                inputProps={{ min: 0 }}
                disabled={!formData.checkOut.early}
              />
            </Grid>

            {/* Work Hours Summary */}
            {(formData.workHours > 0 || formData.overtimeHours > 0) && (
              <>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }}>
                    <Chip label="Work Hours Summary" />
                  </Divider>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card sx={{ bgcolor: 'primary.light', color: 'white' }}>
                    <CardContent>
                      <Typography variant="h6">Total Work Hours</Typography>
                      <Typography variant="h4">{formData.workHours} hrs</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card sx={{ bgcolor: 'warning.light', color: 'white' }}>
                    <CardContent>
                      <Typography variant="h6">Overtime Hours</Typography>
                      <Typography variant="h4">{formData.overtimeHours} hrs</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card sx={{ bgcolor: 'info.light', color: 'white' }}>
                    <CardContent>
                      <Typography variant="h6">Break Time</Typography>
                      <Typography variant="h4">{formData.breakTime} hrs</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}

            {/* Notes */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={4}
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Add any additional notes or comments..."
              />
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={() => navigate('/hr/attendance')}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={saving}
                >
                  {saving ? <CircularProgress size={20} /> : (id ? 'Update' : 'Save')}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default AttendanceForm; 