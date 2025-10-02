import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Grid,
  Typography,
  Paper,
  Divider,
  FormControlLabel,
  Switch,
  Chip,
  Alert,
  Card,
  CardContent,
  CardHeader
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LoadingButton } from '@mui/lab';
import * as Yup from 'yup';
import { Formik, Form, FieldArray } from 'formik';
import StaffTypeSelector from '../common/StaffTypeSelector';
import AssignmentTargetSelector from '../common/AssignmentTargetSelector';
import EmployeeSelector from '../common/EmployeeSelector';
import { createAssignment, updateAssignment } from '../../services/staffManagementService';

const GenericAssignmentForm = ({
  assignment = null,
  onSave,
  onCancel,
  loading = false,
  editMode = false
}) => {
  const [initialValues, setInitialValues] = useState({
    employee: assignment?.employee || null,
    staffType: assignment?.staffType || null,
    targets: assignment?.targets || {},
    title: assignment?.title || '',
    description: assignment?.description || '',
    startDate: assignment?.startDate ? new Date(assignment.startDate) : new Date(),
    endDate: assignment?.endDate ? new Date(assignment.endDate) : null,
    priority: assignment?.priority || 'Medium',
    status: assignment?.status || 'Pending',
    schedule: {
      shiftTimings: {
        startTime: assignment?.schedule?.shiftTimings?.startTime || '09:00',
        endTime: assignment?.schedule?.shiftTimings?.endTime || '17:00',
        hoursPerDay: assignment?.schedule?.shiftTimings?.hoursPerDay || 8,
        isFlexibleHours: assignment?.schedule?.shiftTimings?.isFlexibleHours || false
      },
      workArrangement: assignment?.schedule?.workArrangement || 'Full-time',
      locationRequirement: assignment?.schedule?.locationRequirement || 'On-site'
    },
    responsibilities: assignment?.responsibilities || [],
    requiredSkills: assignment?.requiredSkills || [],
    reportingManager: assignment?.reportingManager || null,
    notes: assignment?.notes || '',
    tags: assignment?.tags || []
  });

  // Update initial values when assignment prop changes
  useEffect(() => {
    if (assignment) {
      setInitialValues({
        employee: assignment.employee,
        staffType: assignment.staffType,
        targets: assignment.targets || {},
        title: assignment.title || '',
        description: assignment.description || '',
        startDate: assignment.startDate ? new Date(assignment.startDate) : new Date(),
        endDate: assignment.endDate ? new Date(assignment.endDate) : null,
        priority: assignment.priority || 'Medium',
        status: assignment.status || 'Pending',
        schedule: {
          shiftTimings: {
            startTime: assignment.schedule?.shiftTimings?.startTime || '09:00',
            endTime: assignment.schedule?.shiftTimings?.endTime || '17:00',
            hoursPerDay: assignment.schedule?.shiftTimings?.hoursPerDay || 8,
            isFlexibleHours: assignment.schedule?.shiftTimings?.isFlexibleHours || false
          },
          workArrangement: assignment.schedule?.workArrangement || 'Full-time',
          locationRequirement: assignment.schedule?.locationRequirement || 'On-site'
        },
        responsibilities: assignment.responsibilities || [],
        requiredSkills: assignment.requiredSkills || [],
        reportingManager: assignment.reportingManager || null,
        notes: assignment.notes || '',
        tags: assignment.tags || []
      });
    }
  }, [assignment]);

  const validationSchema = Yup.object({
    employee: Yup.object().required('Employee is required'),
    staffType: Yup.string().required('Staff type is required'),
    title: Yup.string().required('Assignment title is required').max(100),
    description: Yup.string().max(500, 'Description cannot exceed 500 characters'),
    startDate: Yup.date().required('Start date is required'),
    endDate: Yup.date().nullable().test(
      'end-date-after-start',
      'End date must be after start date',
      function(endDate) {
        if (!endDate) return true;
        return endDate > this.parent.startDate;
      }
    ),
    priority: Yup.string().oneOf(['Low', 'Medium', 'High', 'Urgent']),
    schedule: Yup.object({
      shiftTimings: Yup.object({
        startTime: Yup.string().required('Start time is required'),
        endTime: Yup.string().required('End time is required'),
        hoursPerDay: Yup.number().min(1).max(24)
      }),
      workArrangement: Yup.string().oneOf(['Full-time', 'Part-time', 'Contract', 'Freelance', 'On-call']),
      locationRequirement: Yup.string().oneOf(['On-site', 'Remote', 'Hybrid'])
    }),
    notes: Yup.string().max(1000, 'Notes cannot exceed 1000 characters')
  });

  const handleSubmit = async (values, { setSubmitting, setFieldError, setStatus }) => {
    try {
      setStatus(null);
      
      // Prepare targets array from the targets object
      const targets = Object.entries(values.targets).map(([type, targetData]) => ({
        type,
        targetId: targetData.targetId,
        label: targetData.label,
        customData: null // Add custom data handling if needed
      }));

      const payload = {
        ...values,
        targets,
        // Remove the targets object since we're using targets array
        targets: undefined
      };

      let result;
      if (editMode && assignment?._id) {
        result = await updateAssignment(assignment._id, payload);
      } else {
        result = await createAssignment(payload);
      }

      if (result.success) {
        onSave?.(result.data);
      } else {
        setStatus('error');
        setFieldError('general', result.message || 'Failed to save assignment');
      }
    } catch (error) {
      console.error('Error saving assignment:', error);
      setStatus('error');
      setFieldError('general', error.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const dayOptions = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ];

  const priorityOptions = [
    { value: 'Low', label: 'Low', color: 'success' },
    { value: 'Medium', label: 'Medium', color: 'warning' },
    { value: 'High', label: 'High', color: 'error' },
    { value: 'Urgent', label: 'Urgent', color: 'error' }
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        enableReinitialize={true}
        onSubmit={handleSubmit}
      >
        {({ values, errors, touched, handleChange, handleBlur, setFieldValue, isSubmitting, status }) => (
          <Form>
            <Paper elevation={1} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                {editMode ? 'Edit Assignment' : 'New Assignment'}
              </Typography>

              <Grid container spacing={3}>
                {/* Basic Information */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom color="primary">
                    Basic Information
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                </Grid>

                <Grid item xs={12} md={6}>
                  <EmployeeSelector
                    value={values.employee}
                    onChange={(employee) => setFieldValue('employee', employee)}
                    error={touched.employee && Boolean(errors.employee)}
                    helperText={touched.employee && errors.employee}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <StaffTypeSelector
                    value={values.staffType}
                    onChange={(staffType) => setFieldValue('staffType', staffType)}
                    error={touched.staffType && Boolean(errors.staffType)}
                    helperText={touched.staffType && errors.staffType}
                    required
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Assignment Title"
                    name="title"
                    value={values.title}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.title && Boolean(errors.title)}
                    helperText={touched.title && errors.title}
                    required
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    name="description"
                    multiline
                    rows={3}
                    value={values.description}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.description && Boolean(errors.description)}
                    helperText={touched.description && errors.description}
                  />
                </Grid>

                {/* Assignment Targets */}
                {values.staffType && (
                  <Grid item xs={12}>
                    <AssignmentTargetSelector
                      staffTypeId={values.staffType}
                      value={values.targets}
                      onChange={(targets) => setFieldValue('targets', targets)}
                    />
                  </Grid>
                )}

                {/* Dates and Priority */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom color="primary">
                    Schedule & Priority
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                </Grid>

                <Grid item xs={12} md={6}>
                  <DateTimePicker
                    label="Start Date"
                    value={values.startDate}
                    onChange={(date) => setFieldValue('startDate', date)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        fullWidth
                        error={touched.startDate && Boolean(errors.startDate)}
                        helperText={touched.startDate && errors.startDate}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <DateTimePicker
                    label="End Date (Optional)"
                    value={values.endDate}
                    onChange={(date) => setFieldValue('endDate', date)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        fullWidth
                        error={touched.endDate && Boolean(errors.endDate)}
                        helperText={touched.endDate && errors.endDate}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    fullWidth
                    label="Priority"
                    name="priority"
                    value={values.priority}
                    onChange={handleChange}
                    SelectProps={{
                      native: true
                    }}
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    fullWidth
                    label="Status"
                    name="status"
                    value={values.status}
                    onChange={handleChange}
                    disabled={!editMode}
                    SelectProps={{
                      native: true
                    }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Active">Active</option>
                    {editMode && <option value="Completed">Finished</option>}
                    {editMode && <option value="Cancelled">Cancelled</option>}
                  </TextField>
                </Grid>

                {/* Shift Timings */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardHeader title="Work Schedule" />
                    <CardContent>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <TextField
                            label="Start Time"
                            type="time"
                            name="schedule.shiftTimings.startTime"
                            value={values.schedule.shiftTimings.startTime}
                            onChange={handleChange}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            label="End Time"
                            type="time"
                            name="schedule.shiftTimings.endTime"
                            value={values.schedule.shiftTimings.endTime}
                            onChange={handleChange}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                          />
                        </Grid>
                        < to the server index to register the new routes:
</Grid>

                {/* Notes and Tags */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom color="primary">
                    Additional Information
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Notes"
                    name="notes"
                    multiline
                    rows={3}
                    value={values.notes}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.notes && Boolean(errors.notes)}
                    helperText={touched.notes && errors.notes}
                  />
                </Grid>
              </Grid>

              {status === 'error' && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {errors.general}
                </Alert>
              )}

              {/* Form Actions */}
              <Box display="flex" gap={2} justifyContent="flex-end" mt={3}>
                <LoadingButton
                  onClick={onCancel}
                  variant="outlined"
                  disabled={isSubmitting}
                >
                  Cancel
                </LoadingButton>
                <LoadingButton
                  type="submit"
                  variant="contained"
                  loading={isSubmitting || loading}
                  disabled={isSubmitting}
                >
                  {editMode ? 'Update Assignment' : 'Create Assignment'}
                </LoadingButton>
              </Box>
            </Paper>
          </Form>
        )}
      </Formik>
    </LocalizationProvider>
  );
};

export default GenericAssignmentForm;
