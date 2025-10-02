import React, { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Box,
  Typography,
  Chip,
  Avatar
} from '@mui/material';
import { getStaffTypes } from '../../services/staffManagementService';

const StaffTypeSelector = ({ 
  value, 
  onChange, 
  label = "Staff Type", 
  required = false,
  disabled = false,
  size = 'medium',
  showIcon = true,
  variant = 'outlined'
}) => {
  const [staffTypes, setStaffTypes] = useState([]);
  const [loading, setLoading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStaffTypes();
  }, []);

  const fetchStaffTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getStaffTypes();
      setStaffTypes(result.data || []);
    } catch (error) {
      console.error('Error fetching staff types:', error);
      setError('Failed to load staff types');
    } finally {
      setLoading(false);
    }
  };

  const getStaffTypeIcon = (staffType) => {
    // Default icons based on staff type name/code
    const iconMap = {
      'driver': 'directions_car',
      'guard': 'security',
      'security': 'security',
      'maintenance': 'build',
      'office': 'person',
      'admin': 'admin_panel_settings',
      'receptionist': 'recent_actors'
    };
    
    return iconMap[staffType.name.toLowerCase()] || staffType.icon || 'person';
  };

  const formatStaffTypeName = (staffType) => {
    return `${staffType.name} (${staffType.code})`;
  };

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={size === 'small' ? 16 : 20} />
        <Typography variant="body2" color="text.secondary">
          Loading staff types...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      </Box>
    );
  }

  return (
    <FormControl fullWidth required={required} disabled={disabled} size={size} variant={variant}>
      <InputLabel>{label}</InputLabel>
      <Select
        value={value || ''}
        onChange={onChange}
        label={label}
        renderValue={(selected) => {
          if (!selected) return '';
          const staffType = staffTypes.find(st => st._id === selected);
          if (!staffType) return '';

          if (showIcon) {
            return (
              <Box display="flex" alignItems="center" gap={1}>
                <Avatar
                  size="small"
                  style={{ 
                    width: 16, 
                    height: 16, 
                    backgroundColor: staffType.color || '#1976d2',
                    fontSize: '10px'
                  }}
                >
                  {staffType.code}
                </Avatar>
                <Typography variant="body2">
                  {formatStaffTypeName(staffType)}
                </Typography>
              </Box>
            );
          }
          return formatStaffTypeName(staffType);
        }}
      >
        {staffTypes.map((staffType) => (
          <MenuItem key={staffType._id} value={staffType._id}>
            <Box display="flex" alignItems="center" gap={1} width="100%">
              {showIcon && (
                <Avatar
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: staffType.color || '#1976d2',
                    fontSize: '10px'
                  }}
                >
                  {staffType.code}
                </Avatar>
              )}
              <Box flexGrow={1}>
                <Typography variant="body2" fontWeight="medium">
                  {staffType.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {staffType.code}
                </Typography>
              </Box>
              {staffType.assignmentTargets && staffType.assignmentTargets.length > 0 && (
                <Chip
                  label={`${staffType.assignmentTargets.length} targets`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default StaffTypeSelector;
