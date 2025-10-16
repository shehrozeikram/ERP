import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
  Skeleton,
  alpha,
  useTheme,
  Tooltip,
  Avatar,
  Stack,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as ViewIcon,
  History as HistoryIcon,
  Security as SecurityIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  Computer as ComputerIcon,
  LocationOn as LocationIcon,
  Schedule as ScheduleIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

const AuditTrail = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [trails, setTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    module: '',
    action: '',
    user: '',
    startDate: '',
    endDate: ''
  });
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTrail, setSelectedTrail] = useState(null);
  const [statistics, setStatistics] = useState(null);

  const fetchTrails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery,
        ...filters
      });
      const response = await api.get(`/audit/trail?${params.toString()}`);
      const responseData = response.data.data;
      
      // Handle different response structures
      if (responseData && responseData.trailEntries) {
        // New structure: { trailEntries: [...], pagination: {...} }
        setTrails(responseData.trailEntries || []);
        setTotalItems(responseData.pagination?.totalCount || 0);
      } else if (Array.isArray(responseData)) {
        // Old structure: direct array
        setTrails(responseData);
        setTotalItems(response.data.total || responseData.length);
      } else {
        // Fallback
        setTrails([]);
        setTotalItems(0);
      }
    } catch (err) {
      console.error('Error fetching audit trail:', err);
      setError(err.response?.data?.message || 'Failed to fetch audit trail.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchQuery, filters]);

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await api.get('/audit/trail/statistics');
      setStatistics(response.data.data);
    } catch (err) {
      console.error('Error fetching audit statistics:', err);
    }
  }, []);

  useEffect(() => {
    fetchTrails();
    fetchStatistics();
  }, [fetchTrails, fetchStatistics]);

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleFilterChange = (event) => {
    setFilters({
      ...filters,
      [event.target.name]: event.target.value,
    });
  };

  const handleViewTrail = (trail) => {
    setSelectedTrail(trail);
    setViewDialogOpen(true);
  };

  const getActionChip = (action) => {
    let color = 'default';
    let icon = null;
    
    if (action.toLowerCase().includes('create') || action.toLowerCase().includes('add')) {
      color = 'success';
      icon = <CheckCircleIcon />;
    } else if (action.toLowerCase().includes('update') || action.toLowerCase().includes('edit')) {
      color = 'warning';
      icon = <InfoIcon />;
    } else if (action.toLowerCase().includes('delete') || action.toLowerCase().includes('remove')) {
      color = 'error';
      icon = <ErrorIcon />;
    } else if (action.toLowerCase().includes('login') || action.toLowerCase().includes('access')) {
      color = 'info';
      icon = <SecurityIcon />;
    } else {
      color = 'default';
      icon = <HistoryIcon />;
    }
    
    return <Chip label={action} color={color} icon={icon} size="small" />;
  };

  const getModuleColor = (module) => {
    const colors = {
      'hr': 'primary',
      'finance': 'success',
      'admin': 'warning',
      'audit': 'error',
      'crm': 'info',
      'procurement': 'secondary'
    };
    return colors[module?.toLowerCase()] || 'default';
  };

  const getRiskLevelColor = (riskLevel) => {
    const riskColors = {
      'low': 'success',
      'medium': 'warning',
      'high': 'error',
      'critical': 'error'
    };
    return riskColors[riskLevel?.toLowerCase()] || 'default';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading Audit Trail...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: theme.palette.primary.dark }}>
        <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} /> Audit Trail
      </Typography>
      <Typography variant="subtitle1" color="textSecondary" sx={{ mb: 3 }}>
        Complete activity log of all user actions across the system.
      </Typography>

      {/* Statistics Cards */}
      {statistics && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: theme.palette.primary.light, color: theme.palette.primary.contrastText }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {statistics.totalActivities || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      Total Activities
                    </Typography>
                  </Box>
                  <HistoryIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: theme.palette.success.light, color: theme.palette.success.contrastText }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {statistics.uniqueUsers || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      Active Users
                    </Typography>
                  </Box>
                  <PersonIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: theme.palette.warning.light, color: theme.palette.warning.contrastText }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {statistics.suspiciousActivities || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      Suspicious Activities
                    </Typography>
                  </Box>
                  <WarningIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: theme.palette.info.light, color: theme.palette.info.contrastText }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {statistics.modulesAccessed || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      Modules Accessed
                    </Typography>
                  </Box>
                  <SecurityIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              label="Search Activities"
              variant="outlined"
              size="small"
              fullWidth
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Module</InputLabel>
              <Select
                value={filters.module}
                label="Module"
                name="module"
                onChange={handleFilterChange}
              >
                <MenuItem value="">All Modules</MenuItem>
                <MenuItem value="hr">HR</MenuItem>
                <MenuItem value="finance">Finance</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="audit">Audit</MenuItem>
                <MenuItem value="crm">CRM</MenuItem>
                <MenuItem value="procurement">Procurement</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Action</InputLabel>
              <Select
                value={filters.action}
                label="Action"
                name="action"
                onChange={handleFilterChange}
              >
                <MenuItem value="">All Actions</MenuItem>
                <MenuItem value="create">Create</MenuItem>
                <MenuItem value="update">Update</MenuItem>
                <MenuItem value="delete">Delete</MenuItem>
                <MenuItem value="login">Login</MenuItem>
                <MenuItem value="view">View</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="Start Date"
              type="date"
              variant="outlined"
              size="small"
              fullWidth
              value={filters.startDate}
              onChange={handleFilterChange}
              name="startDate"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="End Date"
              type="date"
              variant="outlined"
              size="small"
              fullWidth
              value={filters.endDate}
              onChange={handleFilterChange}
              name="endDate"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={1}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              fullWidth
            >
              Export
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Audit Trail Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>User</strong></TableCell>
              <TableCell><strong>Module</strong></TableCell>
              <TableCell><strong>Action</strong></TableCell>
              <TableCell><strong>Entity</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
              <TableCell><strong>Risk Level</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Timestamp</strong></TableCell>
              <TableCell><strong>IP Address</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(trails || []).map((trail) => (
              <TableRow key={trail._id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tooltip title={`${trail.user?.firstName || trail.userEmail || 'Unknown User'}'s Profile`}>
                      <Avatar 
                        src={trail.user?.profileImage || trail.user?.avatar || trail.user?.image || trail.user?.photo}
                        sx={{ 
                          width: 32, 
                          height: 32, 
                          fontSize: '0.875rem',
                          bgcolor: getModuleColor(trail.module) + '.main',
                          border: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                          boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.1)}`,
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'scale(1.1)',
                            boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.2)}`
                          }
                        }}
                        imgProps={{
                          style: { objectFit: 'cover' },
                          onError: (e) => {
                            e.target.style.display = 'none';
                          }
                        }}
                      >
                        {(trail.user?.firstName?.charAt(0) || trail.userEmail?.charAt(0) || 'U')}
                        {(trail.user?.lastName?.charAt(0) || trail.userEmail?.charAt(1) || 'S')}
                      </Avatar>
                    </Tooltip>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {trail.user?.firstName && trail.user?.lastName 
                          ? `${trail.user.firstName} ${trail.user.lastName}`
                          : trail.userEmail || 'Unknown User'
                        }
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {(trail.user?.role || trail.userRole || 'UNKNOWN').replace('_', ' ').toUpperCase()}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={trail.module?.toUpperCase()} 
                    color={getModuleColor(trail.module)} 
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  />
                </TableCell>
                <TableCell>
                  {getActionChip(trail.action)}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {trail.entityType || 'Unknown'}
                  </Typography>
                  {trail.entityName && (
                    <Typography variant="caption" color="textSecondary">
                      {trail.entityName}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ 
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 250
                  }}>
                    {trail.description || trail.details?.message || `${trail.action} ${trail.module} record`}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={trail.riskLevel?.toUpperCase() || 'LOW'}
                    color={getRiskLevelColor(trail.riskLevel)}
                    size="small"
                    variant={trail.riskLevel === 'high' || trail.riskLevel === 'critical' ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={trail.status?.toUpperCase() || 'SUCCESS'}
                    color={trail.status === 'success' ? 'success' : 'error'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(trail.timestamp || trail.createdAt, { includeTime: true })}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="textSecondary">
                    {trail.ipAddress || 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="View Details">
                    <IconButton
                      onClick={() => handleViewTrail(trail)}
                      size="small"
                    >
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {trails.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="textSecondary">
                    No audit trail records found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={totalItems}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
      />

      {/* Enhanced Audit Trail Details Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
          }
        }}
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          color: 'white',
          pb: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                width: 48,
                height: 48
              }}>
                <HistoryIcon sx={{ fontSize: 28 }} />
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  Audit Trail Details
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Comprehensive activity information and security analysis
                </Typography>
              </Box>
            </Box>
            {selectedTrail && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  label={selectedTrail.riskLevel?.toUpperCase() || 'LOW'}
                  color={getRiskLevelColor(selectedTrail.riskLevel)}
                  sx={{ 
                    color: 'white',
                    bgcolor: 'rgba(255,255,255,0.2)',
                    fontWeight: 'bold'
                  }}
                />
                <Chip
                  label={selectedTrail.status?.toUpperCase() || 'SUCCESS'}
                  color={selectedTrail.status === 'success' ? 'success' : 'error'}
                  sx={{ 
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                />
              </Box>
            )}
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          {selectedTrail && (
            <Box>
              {/* Header Summary Card */}
              <Box sx={{ 
                p: 3, 
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`
              }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={8}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {selectedTrail.description || `${selectedTrail.action} ${selectedTrail.module} record`}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      {selectedTrail.entityType && selectedTrail.entityName 
                        ? `${selectedTrail.entityType}: ${selectedTrail.entityName}`
                        : selectedTrail.entityType || 'System Activity'
                      }
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {getActionChip(selectedTrail.action)}
                      <Chip 
                        label={selectedTrail.module?.toUpperCase()} 
                        color={getModuleColor(selectedTrail.module)} 
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                      {selectedTrail.isSuspicious && (
                        <Chip 
                          label="SUSPICIOUS" 
                          color="error" 
                          size="small"
                          icon={<WarningIcon />}
                          sx={{ fontWeight: 'bold' }}
                        />
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h4" sx={{ 
                        fontWeight: 'bold',
                        color: theme.palette.primary.main,
                        mb: 1
                      }}>
                        {formatDate(selectedTrail.timestamp || selectedTrail.createdAt, { includeTime: true })}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Activity Timestamp
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Main Content */}
              <Box sx={{ p: 3 }}>
                <Grid container spacing={3}>
                  {/* User Information Card */}
                  <Grid item xs={12} md={6}>
                    <Card sx={{ 
                      height: '100%',
                      border: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                      borderRadius: 2
                    }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <PersonIcon sx={{ color: theme.palette.primary.main }} />
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            User Information
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Tooltip title={`Profile: ${selectedTrail.user?.firstName || selectedTrail.userEmail || 'Unknown User'}`}>
                            <Avatar 
                              src={selectedTrail.user?.profileImage || selectedTrail.user?.avatar || selectedTrail.user?.image || selectedTrail.user?.photo}
                              sx={{ 
                                width: 60, 
                                height: 60,
                                bgcolor: getModuleColor(selectedTrail.module) + '.main',
                                fontSize: '1.5rem',
                                border: `3px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.15)}`,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                  transform: 'scale(1.05)',
                                  boxShadow: `0 6px 20px ${alpha(theme.palette.common.black, 0.25)}`
                                }
                              }}
                              imgProps={{
                                style: { objectFit: 'cover' },
                                onError: (e) => {
                                  e.target.style.display = 'none';
                                }
                              }}
                            >
                              {(selectedTrail.user?.firstName?.charAt(0) || selectedTrail.userEmail?.charAt(0) || 'U')}
                              {(selectedTrail.user?.lastName?.charAt(0) || selectedTrail.userEmail?.charAt(1) || 'S')}
                            </Avatar>
                          </Tooltip>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                              {selectedTrail.user?.firstName && selectedTrail.user?.lastName 
                                ? `${selectedTrail.user.firstName} ${selectedTrail.user.lastName}`
                                : selectedTrail.userEmail || 'Unknown User'
                              }
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                              {selectedTrail.user?.email || selectedTrail.userEmail || 'No email available'}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Chip 
                                label={(selectedTrail.user?.role || selectedTrail.userRole || 'UNKNOWN').replace('_', ' ').toUpperCase()} 
                                color="primary" 
                                size="small"
                                sx={{ fontWeight: 'bold' }}
                              />
                              {(selectedTrail.user?.department || selectedTrail.userDepartment) && (
                                <Chip 
                                  label={selectedTrail.user?.department || selectedTrail.userDepartment} 
                                  variant="outlined" 
                                  size="small"
                                />
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Activity Details Card */}
                  <Grid item xs={12} md={6}>
                    <Card sx={{ 
                      height: '100%',
                      border: `2px solid ${alpha(theme.palette.success.main, 0.1)}`,
                      borderRadius: 2
                    }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <SecurityIcon sx={{ color: theme.palette.success.main }} />
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            Activity Details
                          </Typography>
                        </Box>
                        <Stack spacing={2}>
                          <Box>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                              Module
                            </Typography>
                            <Chip 
                              label={selectedTrail.module?.toUpperCase()} 
                              color={getModuleColor(selectedTrail.module)} 
                              size="small"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </Box>
                          <Box>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                              Action Type
                            </Typography>
                            {getActionChip(selectedTrail.action)}
                          </Box>
                          <Box>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                              Risk Level
                            </Typography>
                            <Chip
                              label={selectedTrail.riskLevel?.toUpperCase() || 'LOW'}
                              color={getRiskLevelColor(selectedTrail.riskLevel)}
                              variant={selectedTrail.riskLevel === 'high' || selectedTrail.riskLevel === 'critical' ? 'filled' : 'outlined'}
                              sx={{ fontWeight: 'bold' }}
                            />
                          </Box>
                          <Box>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                              Status
                            </Typography>
                            <Chip
                              label={selectedTrail.status?.toUpperCase() || 'SUCCESS'}
                              color={selectedTrail.status === 'success' ? 'success' : 'error'}
                              variant="outlined"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Network Information Card */}
                  <Grid item xs={12} md={6}>
                    <Card sx={{ 
                      height: '100%',
                      border: `2px solid ${alpha(theme.palette.info.main, 0.1)}`,
                      borderRadius: 2
                    }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <SecurityIcon sx={{ color: theme.palette.info.main }} />
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            Network Information
                          </Typography>
                        </Box>
                        <Stack spacing={2}>
                          <Box>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                              IP Address
                            </Typography>
                            <Typography variant="body1" sx={{ 
                              fontFamily: 'monospace',
                              fontWeight: 'bold',
                              color: theme.palette.primary.main
                            }}>
                              {selectedTrail.ipAddress || 'N/A'}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                              User Agent
                            </Typography>
                            <Typography variant="body2" sx={{ 
                              fontFamily: 'monospace',
                              fontSize: '0.875rem',
                              wordBreak: 'break-all'
                            }}>
                              {selectedTrail.userAgent || 'N/A'}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                              Session ID
                            </Typography>
                            <Typography variant="body2" sx={{ 
                              fontFamily: 'monospace',
                              fontSize: '0.875rem'
                            }}>
                              {selectedTrail.sessionId || 'N/A'}
                            </Typography>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Entity Information Card */}
                  <Grid item xs={12} md={6}>
                    <Card sx={{ 
                      height: '100%',
                      border: `2px solid ${alpha(theme.palette.warning.main, 0.1)}`,
                      borderRadius: 2
                    }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <BusinessIcon sx={{ color: theme.palette.warning.main }} />
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            Entity Information
                          </Typography>
                        </Box>
                        <Stack spacing={2}>
                          <Box>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                              Entity Type
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                              {selectedTrail.entityType || 'Unknown'}
                            </Typography>
                          </Box>
                          {selectedTrail.entityName && (
                            <Box>
                              <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                                Entity Name
                              </Typography>
                              <Typography variant="body1">
                                {selectedTrail.entityName}
                              </Typography>
                            </Box>
                          )}
                          {selectedTrail.entityId && (
                            <Box>
                              <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                                Entity ID
                              </Typography>
                              <Typography variant="body2" sx={{ 
                                fontFamily: 'monospace',
                                fontSize: '0.875rem'
                              }}>
                                {selectedTrail.entityId}
                              </Typography>
                            </Box>
                          )}
                          {selectedTrail.category && (
                            <Box>
                              <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                                Category
                              </Typography>
                              <Chip 
                                label={selectedTrail.category?.replace('_', ' ').toUpperCase()} 
                                variant="outlined" 
                                size="small"
                              />
                            </Box>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Technical Details */}
                  <Grid item xs={12}>
                    <Card sx={{ 
                      border: `2px solid ${alpha(theme.palette.grey[400], 0.2)}`,
                      borderRadius: 2
                    }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <SecurityIcon sx={{ color: theme.palette.grey[600] }} />
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            Technical Details
                          </Typography>
                        </Box>
                        
                        <Accordion sx={{ boxShadow: 'none' }}>
                          <AccordionSummary 
                            expandIcon={<ExpandMoreIcon />}
                            sx={{ 
                              bgcolor: alpha(theme.palette.grey[100], 0.5),
                              borderRadius: 1,
                              mb: 1
                            }}
                          >
                            <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                              Request Information
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Box sx={{ 
                              bgcolor: alpha(theme.palette.grey[50], 0.8), 
                              p: 2, 
                              borderRadius: 2,
                              border: `1px solid ${alpha(theme.palette.grey[200], 0.5)}`
                            }}>
                              <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                  <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                                    <strong>Method:</strong>
                                  </Typography>
                                  <Chip 
                                    label={selectedTrail.requestMethod || selectedTrail.details?.method || 'GET'} 
                                    color="primary" 
                                    variant="outlined"
                                    size="small"
                                  />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                  <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                                    <strong>URL:</strong>
                                  </Typography>
                                  <Typography variant="body2" sx={{ 
                                    fontFamily: 'monospace',
                                    fontSize: '0.875rem',
                                    wordBreak: 'break-all'
                                  }}>
                                    {selectedTrail.requestUrl || selectedTrail.details?.url || 'N/A'}
                                  </Typography>
                                </Grid>
                                {selectedTrail.requestBody && (
                                  <Grid item xs={12}>
                                    <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                      <strong>Request Body:</strong>
                                    </Typography>
                                    <Box sx={{ 
                                      bgcolor: 'white',
                                      p: 2,
                                      borderRadius: 1,
                                      border: `1px solid ${alpha(theme.palette.grey[200], 0.5)}`,
                                      maxHeight: 200,
                                      overflow: 'auto'
                                    }}>
                                      <pre style={{ 
                                        margin: 0,
                                        fontSize: '0.875rem',
                                        fontFamily: 'monospace',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word'
                                      }}>
                                        {JSON.stringify(selectedTrail.requestBody, null, 2)}
                                      </pre>
                                    </Box>
                                  </Grid>
                                )}
                              </Grid>
                            </Box>
                          </AccordionDetails>
                        </Accordion>

                        {/* Change Tracking */}
                        {(selectedTrail.oldValues || selectedTrail.newValues || selectedTrail.changedFields) && (
                          <Accordion sx={{ boxShadow: 'none', mt: 1 }}>
                            <AccordionSummary 
                              expandIcon={<ExpandMoreIcon />}
                              sx={{ 
                                bgcolor: alpha(theme.palette.warning.main, 0.1),
                                borderRadius: 1,
                                mb: 1
                              }}
                            >
                              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                Change Tracking
                              </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                              <Box sx={{ 
                                bgcolor: alpha(theme.palette.warning.main, 0.05), 
                                p: 2, 
                                borderRadius: 2,
                                border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
                              }}>
                                {selectedTrail.changedFields && selectedTrail.changedFields.length > 0 ? (
                                  <Box>
                                    <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                      <strong>Field Changes:</strong>
                                    </Typography>
                                    {selectedTrail.changedFields.map((change, index) => (
                                      <Box key={index} sx={{ 
                                        mb: 1, 
                                        p: 1, 
                                        bgcolor: 'white', 
                                        borderRadius: 1,
                                        border: `1px solid ${alpha(theme.palette.grey[200], 0.5)}`
                                      }}>
                                        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                          {change.field}
                                        </Typography>
                                        <Grid container spacing={1}>
                                          <Grid item xs={6}>
                                            <Typography variant="caption" color="error">
                                              Old: {JSON.stringify(change.oldValue)}
                                            </Typography>
                                          </Grid>
                                          <Grid item xs={6}>
                                            <Typography variant="caption" color="success.main">
                                              New: {JSON.stringify(change.newValue)}
                                            </Typography>
                                          </Grid>
                                        </Grid>
                                      </Box>
                                    ))}
                                  </Box>
                                ) : (
                                  <Typography variant="body2" color="textSecondary">
                                    No field changes recorded
                                  </Typography>
                                )}
                              </Box>
                            </AccordionDetails>
                          </Accordion>
                        )}

                        {/* Tags */}
                        {selectedTrail.tags && selectedTrail.tags.length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                              <strong>Tags:</strong>
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {selectedTrail.tags.map((tag, index) => (
                                <Chip 
                                  key={index}
                                  label={tag} 
                                  size="small" 
                                  variant="outlined"
                                />
                              ))}
                            </Box>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ 
          p: 3, 
          bgcolor: alpha(theme.palette.grey[50], 0.5),
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
        }}>
          <Button 
            onClick={() => setViewDialogOpen(false)}
            variant="outlined"
            size="large"
          >
            Close
          </Button>
          <Button 
            variant="contained" 
            size="large"
            startIcon={<DownloadIcon />}
            onClick={() => {
              // Export functionality can be added here
              console.log('Export audit trail details');
            }}
          >
            Export Details
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditTrail;
