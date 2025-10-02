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
  Alert,
  Grid
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  BusinessCenter as DepartmentIcon,
  DirectionsCar as VehicleIcon,
  Assignment as ProjectIcon,
  Construction as CustomIcon
} from '@mui/icons-material';
import { getAssignmentTargets } from '../../services/staffManagementService';

const AssignmentTargetSelector = ({
  staffTypeId,
  value = {},
  onChange,
  label = "Assignment Targets",
  disabled = false,
  size = 'medium',
  variant = 'outlined',
  showIcons = true
}) => {
  const [targets, setTargets] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (staffTypeId) {
      fetchTargets();
    } else {
      setTargets({});
    }
  }, [staffTypeId]);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getAssignmentTargets(staffTypeId);
      setTargets(result.data || {});
    } catch (error) {
      console.error('Error fetching assignment targets:', error);
      setError('Failed to load assignment targets');
    } finally {
      setLoading(false);
    }
  };

  const getTargetIcon = (targetType) => {
    const iconMap = {
      location: <LocationIcon fontSize="small" />,
      department: <DepartmentIcon fontSize="small" />,
      vehicle: <VehicleIcon fontSize="small" />,
      project: <ProjectIcon fontSize="small" />,
      custom: <CustomIcon fontSize="small" />
    };
    return iconMap[targetType] || <CustomIcon fontSize="small" />;
  };

  const formatTargetLabel = (targetType, target) => {
    const labelMap = {
      location: `${target.name} (${target.address || target.city || 'Location'})`,
      department: target.name || 'Department',
      vehicle: `${target.make} ${target.model} (${target.licensePlate})`,
      project: `${target.name} (${target.code || 'Project'})`,
      custom: target.label || 'Custom Target'
    };
    return labelMap[targetType] || target.name || 'Unknown';
  };

  const handleTargetChange = (targetType, targetId, target) => {
    const newValue = { ...value };
    
    if (targetId) {
      newValue[targetType] = {
        targetId,
        target,
        label: formatTargetLabel(targetType, target)
      };
    } else {
      delete newValue[targetType];
    }
    
    onChange(newValue);
  };

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={size === 'small' ? 16 : 20} />
        <Typography variant="body2" color="text.secondary">
          Loading targets...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!staffTypeId || Object.keys(targets).length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Please select a staff type first to see available assignment targets.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {label}
      </Typography>
      <Grid container spacing={2}>
        {Object.entries(targets).map(([targetType, targetList]) => (
          <Grid item xs={12} sm={6} md={4} key={targetType}>
            <FormControl 
              fullWidth 
              size={size} 
              variant={variant}
              disabled={disabled}
            >
              <InputLabel>
                {targetType.charAt(0).toUpperCase() + targetType.slice(1)}
              </InputLabel>
              <Select
                value={value[targetType]?.targetId || ''}
                onChange={(e) => {
                  const targetId = e.target.value;
                  const target = targetList.find(t => t._id === targetId);
                  handleTargetChange(targetType, targetId, target);
                }}
                label={targetType.charAt(0).toUpperCase() + targetType.slice(1)}
                renderValue={(selected) => {
                  if (!selected) return '';
                  const target = targetList.find(t => t._id === selected);
                  if (!target) return '';
                  
                  return (
                    <Box display="flex" alignItems="center" gap={1}>
                      {showIcons && getTargetIcon(targetType)}
                      <Typography variant="body2">
                        {formatTargetLabel(targetType, target)}
                      </Typography>
                    </Box>
                  );
                }}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {targetList.map((target) => (
                  <MenuItem key={target._id} value={target._id}>
                    <Box display="flex" alignItems="center" gap={1} width="100%">
                      {showIcons && getTargetIcon(targetType)}
                      <Typography variant="body2">
                        {formatTargetLabel(targetType, target)}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        ))}
      </Grid>
      
      {/* Show selected targets summary */}
      {Object.keys(value).length > 0 && (
        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Selected targets:
          </Typography>
          <Box display="flex" gap={1} mt={1} flexWrap="wrap">
            {Object.entries(value).map(([targetType, targetData]) => (
              <Chip
                key={targetType}
                label={targetData.label}
                size="small"
                icon={showIcons ? getTargetIcon(targetType) : ''}
                color="primary"
                variant="outlined"
                onDelete={() => {
                  const newValue = { ...value };
                  delete newValue[targetType];
                  onChange(newValue);
                }}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default AssignmentTargetSelector;
