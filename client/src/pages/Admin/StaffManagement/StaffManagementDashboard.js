import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Badge,
  LinearProgress,
  Avatar,
  Divider,
  Stack,
  alpha,
  useTheme
} from '@mui/material';
import {
  Security as SecurityIcon,
  Business as BusinessIcon,
  Build as BuildIcon,
  Person as PersonIcon,
  DirectionsCar as DriverIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  LocationOn as LocationIcon,
  BusinessCenter as DepartmentIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import staffAssignmentService from '../../../services/staffAssignmentService';

const staffTypes = [
  { 
    key: 'Guard', 
    label: 'Guards', 
    icon: <SecurityIcon />, 
    color: 'primary',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    description: 'Security guards assigned to locations'
  },
  { 
    key: 'Security', 
    label: 'Security', 
    icon: <SecurityIcon />, 
    color: 'error',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    description: 'Security personnel for locations'
  },
  { 
    key: 'Office Boy', 
    label: 'Office Boys', 
    icon: <PersonIcon />, 
    color: 'info',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    description: 'Office support staff assigned to departments'
  },
  { 
    key: 'Office Staff', 
    label: 'Office Staff', 
    icon: <BusinessIcon />, 
    color: 'success',
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    description: 'General office staff assigned to departments'
  },
  { 
    key: 'Admin Staff', 
    label: 'Admin Staff', 
    icon: <BusinessIcon />, 
    color: 'warning',
    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    description: 'Administrative staff assigned to departments'
  },
  { 
    key: 'Maintenance', 
    label: 'Maintenance', 
    icon: <BuildIcon />, 
    color: 'secondary',
    gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    description: 'Maintenance staff assigned to locations'
  },
  { 
    key: 'Driver', 
    label: 'Drivers', 
    icon: <DriverIcon />, 
    color: 'default',
    gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    description: 'Drivers assigned to vehicles/locations'
  }
];

const StaffManagementDashboard = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState([]);
  const [assignments, setAssignments] = useState({});

  const fetchSummary = useCallback(async () => {
    try {
      const response = await staffAssignmentService.getSummary();
      setSummary(response.data || []);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  }, []);

  const fetchAssignmentsByType = useCallback(async (assignmentType) => {
    try {
      const response = await staffAssignmentService.getByType(assignmentType);
      setAssignments(prev => ({
        ...prev,
        [assignmentType]: response.data || []
      }));
    } catch (err) {
      console.error(`Error fetching ${assignmentType} assignments:`, err);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      await fetchSummary();
      
      // Fetch assignments for all staff types
      for (const staffType of staffTypes) {
        await fetchAssignmentsByType(staffType.key);
      }
    } catch (err) {
      setError('Failed to fetch staff management data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchSummary, fetchAssignmentsByType]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const getStaffTypeCount = (assignmentType) => {
    const staffTypeData = summary.find(item => item._id === assignmentType);
    return staffTypeData ? staffTypeData.active : 0;
  };

  const getStaffTypeTotal = (assignmentType) => {
    const staffTypeData = summary.find(item => item._id === assignmentType);
    return staffTypeData ? staffTypeData.total : 0;
  };

  const getStaffTypeProgress = (assignmentType) => {
    const active = getStaffTypeCount(assignmentType);
    const total = getStaffTypeTotal(assignmentType);
    return total > 0 ? (active / total) * 100 : 0;
  };

  const getTotalActiveStaff = () => {
    return summary.reduce((total, item) => total + (item.active || 0), 0);
  };

  const getTotalStaff = () => {
    return summary.reduce((total, item) => total + (item.total || 0), 0);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h3" fontWeight="bold" color="text.primary" gutterBottom>
              Staff Management Dashboard
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Manage and monitor staff assignments across locations and departments
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchAllData}
              sx={{ 
                borderRadius: 2,
                textTransform: 'none',
                px: 3
              }}
            >
              Refresh Data
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/admin/staff-management/assignments/new')}
              sx={{ 
                borderRadius: 2,
                textTransform: 'none',
                px: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                }
              }}
            >
              New Assignment
            </Button>
          </Stack>
        </Box>

        {/* Overview Stats */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
            }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {getTotalActiveStaff()}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Active Staff
                    </Typography>
                  </Box>
                  <Avatar sx={{ 
                    backgroundColor: alpha('#fff', 0.2),
                    width: 56,
                    height: 56
                  }}>
                    <PeopleIcon sx={{ fontSize: 28 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
              color: 'white',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(67, 233, 123, 0.3)'
            }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {getTotalStaff()}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Total Staff
                    </Typography>
                  </Box>
                  <Avatar sx={{ 
                    backgroundColor: alpha('#fff', 0.2),
                    width: 56,
                    height: 56
                  }}>
                    <AssignmentIcon sx={{ fontSize: 28 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              color: 'white',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(250, 112, 154, 0.3)'
            }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {staffTypes.length}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Staff Types
                    </Typography>
                  </Box>
                  <Avatar sx={{ 
                    backgroundColor: alpha('#fff', 0.2),
                    width: 56,
                    height: 56
                  }}>
                    <TrendingUpIcon sx={{ fontSize: 28 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(79, 172, 254, 0.3)'
            }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {Math.round((getTotalActiveStaff() / getTotalStaff()) * 100) || 0}%
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Utilization
                    </Typography>
                  </Box>
                  <Avatar sx={{ 
                    backgroundColor: alpha('#fff', 0.2),
                    width: 56,
                    height: 56
                  }}>
                    <TrendingUpIcon sx={{ fontSize: 28 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Staff Type Cards */}
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3, color: 'text.primary' }}>
        Staff Categories
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {staffTypes.map((staffType) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={staffType.key}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                borderRadius: 3,
                overflow: 'hidden',
                position: 'relative',
                '&:hover': { 
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                  transform: 'translateY(-4px)',
                  transition: 'all 0.3s ease-in-out'
                }
              }}
              onClick={() => {
                const tabIndex = staffTypes.findIndex(st => st.key === staffType.key);
                setActiveTab(tabIndex);
              }}
            >
              <Box
                sx={{
                  height: 120,
                  background: staffType.gradient,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    backgroundColor: alpha('#fff', 0.2),
                    borderRadius: 2,
                    p: 1
                  }}
                >
                  {staffType.icon}
                </Box>
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 16,
                    left: 16,
                    color: 'white'
                  }}
                >
                  <Typography variant="h4" fontWeight="bold">
                    {getStaffTypeCount(staffType.key)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {staffType.label}
                  </Typography>
                </Box>
              </Box>
              
              <CardContent sx={{ p: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {staffType.description}
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Progress
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {getStaffTypeCount(staffType.key)}/{getStaffTypeTotal(staffType.key)}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={getStaffTypeProgress(staffType.key)}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: alpha(theme.palette[staffType.color]?.main || '#000', 0.1),
                      '& .MuiLinearProgress-bar': {
                        background: staffType.gradient,
                        borderRadius: 4
                      }
                    }}
                  />
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Chip 
                    label={`${Math.round(getStaffTypeProgress(staffType.key))}% Active`}
                    size="small"
                    sx={{
                      background: alpha(theme.palette[staffType.color]?.main || '#000', 0.1),
                      color: theme.palette[staffType.color]?.main || '#000',
                      fontWeight: 'medium'
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Click to view details
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Staff Type Tabs */}
      <Card sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <Box sx={{ 
          borderBottom: 1, 
          borderColor: 'divider',
          backgroundColor: '#f8fafc'
        }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange} 
            variant="scrollable"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 'medium',
                minHeight: 60,
                px: 3
              },
              '& .Mui-selected': {
                color: 'primary.main',
                fontWeight: 'bold'
              }
            }}
          >
            {staffTypes.map((staffType, index) => (
              <Tab
                key={staffType.key}
                label={
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Box
                      sx={{
                        p: 0.5,
                        borderRadius: 1,
                        backgroundColor: activeTab === index ? alpha(theme.palette[staffType.color]?.main || '#000', 0.1) : 'transparent',
                        color: activeTab === index ? theme.palette[staffType.color]?.main : 'text.secondary'
                      }}
                    >
                      {staffType.icon}
                    </Box>
                    <span>{staffType.label}</span>
                    <Chip 
                      label={getStaffTypeCount(staffType.key)} 
                      size="small" 
                      sx={{
                        backgroundColor: activeTab === index ? theme.palette[staffType.color]?.main : alpha(theme.palette[staffType.color]?.main || '#000', 0.1),
                        color: activeTab === index ? 'white' : theme.palette[staffType.color]?.main,
                        fontWeight: 'medium',
                        height: 20,
                        fontSize: '0.75rem'
                      }}
                    />
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Box>

        <CardContent sx={{ p: 0 }}>
          {staffTypes.map((staffType, index) => (
            <Box key={staffType.key} hidden={activeTab !== index}>
              <Box sx={{ p: 3, backgroundColor: '#f8fafc', borderBottom: 1, borderColor: 'divider' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h5" fontWeight="bold" color="text.primary" gutterBottom>
                      {staffType.label} Assignments
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Manage {staffType.label.toLowerCase()} assignments and assignments
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => navigate(`/admin/staff-management/assignments/new?type=${staffType.key}`)}
                    sx={{ 
                      borderRadius: 2,
                      textTransform: 'none',
                      px: 3,
                      background: staffType.gradient,
                      '&:hover': {
                        background: staffType.gradient,
                        opacity: 0.9
                      }
                    }}
                  >
                    Assign {staffType.label.slice(0, -1)}
                  </Button>
                </Box>
              </Box>

              <Box sx={{ p: 3 }}>
                {assignments[staffType.key] && assignments[staffType.key].length > 0 ? (
                  <TableContainer 
                    component={Paper} 
                    sx={{ 
                      borderRadius: 2,
                      boxShadow: 'none',
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <Table>
                      <TableHead>
                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                          <TableCell sx={{ fontWeight: 'bold', color: 'text.primary' }}>Staff Member</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: 'text.primary' }}>Assignment</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: 'text.primary' }}>Location/Department</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: 'text.primary' }}>Status</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: 'text.primary' }}>Start Date</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 'bold', color: 'text.primary' }}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {assignments[staffType.key].map((assignment, idx) => (
                          <TableRow 
                            key={assignment._id}
                            sx={{ 
                              '&:hover': { 
                                backgroundColor: alpha(theme.palette[staffType.color]?.main || '#000', 0.04)
                              },
                              '&:last-child td': { borderBottom: 0 }
                            }}
                          >
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={2}>
                                <Avatar sx={{ 
                                  width: 40, 
                                  height: 40,
                                  backgroundColor: alpha(theme.palette[staffType.color]?.main || '#000', 0.1),
                                  color: theme.palette[staffType.color]?.main || '#000'
                                }}>
                                  <PersonIcon />
                                </Avatar>
                                <Box>
                                  <Typography variant="body2" fontWeight="medium">
                                    {assignment.staffId?.firstName} {assignment.staffId?.lastName}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {assignment.staffId?.employeeId}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={assignment.assignmentType} 
                                sx={{
                                  background: alpha(theme.palette[staffType.color]?.main || '#000', 0.1),
                                  color: theme.palette[staffType.color]?.main || '#000',
                                  fontWeight: 'medium'
                                }}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {assignment.locationId ? (
                                <Box display="flex" alignItems="center" gap={1}>
                                  <LocationIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  <Box>
                                    <Typography variant="body2" fontWeight="medium">
                                      {assignment.locationId.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {assignment.locationId.type} - {assignment.locationId.address}
                                    </Typography>
                                  </Box>
                                </Box>
                              ) : assignment.departmentId ? (
                                <Box display="flex" alignItems="center" gap={1}>
                                  <DepartmentIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  <Box>
                                    <Typography variant="body2" fontWeight="medium">
                                      {assignment.departmentId.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {assignment.departmentId.description}
                                    </Typography>
                                  </Box>
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  Not assigned
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={assignment.status} 
                                color={assignment.status === 'Active' ? 'success' : 'default'}
                                size="small"
                                sx={{ fontWeight: 'medium' }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {new Date(assignment.startDate).toLocaleDateString()}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Stack direction="row" spacing={1} justifyContent="center">
                                <Tooltip title="View Details">
                                  <IconButton
                                    size="small"
                                    onClick={() => navigate(`/admin/staff-management/assignments/${assignment._id}`)}
                                    sx={{ 
                                      backgroundColor: alpha(theme.palette.info.main, 0.1),
                                      '&:hover': { backgroundColor: alpha(theme.palette.info.main, 0.2) }
                                    }}
                                  >
                                    <ViewIcon sx={{ fontSize: 16, color: 'info.main' }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit Assignment">
                                  <IconButton
                                    size="small"
                                    onClick={() => navigate(`/admin/staff-management/assignments/${assignment._id}/edit`)}
                                    sx={{ 
                                      backgroundColor: alpha(theme.palette.warning.main, 0.1),
                                      '&:hover': { backgroundColor: alpha(theme.palette.warning.main, 0.2) }
                                    }}
                                  >
                                    <EditIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Box textAlign="center" py={6}>
                    <Avatar sx={{ 
                      width: 80, 
                      height: 80, 
                      mx: 'auto', 
                      mb: 2,
                      backgroundColor: alpha(theme.palette[staffType.color]?.main || '#000', 0.1)
                    }}>
                      {staffType.icon}
                    </Avatar>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No {staffType.label.toLowerCase()} assignments found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Get started by creating your first {staffType.label.toLowerCase()} assignment
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => navigate(`/admin/staff-management/assignments/new?type=${staffType.key}`)}
                      sx={{ 
                        borderRadius: 2,
                        textTransform: 'none',
                        px: 4,
                        background: staffType.gradient,
                        '&:hover': {
                          background: staffType.gradient,
                          opacity: 0.9
                        }
                      }}
                    >
                      Create First Assignment
                    </Button>
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </CardContent>
      </Card>
    </Box>
  );
};

export default StaffManagementDashboard;