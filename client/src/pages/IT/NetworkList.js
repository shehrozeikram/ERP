import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Tooltip,
  Avatar,
  LinearProgress,
  Badge,
  Paper
} from '@mui/material';
import {
  Add,
  Search,
  FilterList,
  MoreVert,
  Edit,
  Delete,
  Visibility,
  Router,
  Print,
  Download,
  Refresh,
  Warning,
  CheckCircle,
  Error,
  NetworkCheck,
  Speed
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';

import { itService } from '../../services/itService';
import { TableSkeleton } from '../../components/IT/SkeletonLoader';

const StatusChip = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'Online':
        return 'success';
      case 'Offline':
        return 'error';
      case 'Maintenance':
        return 'warning';
      case 'Error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'Online':
        return <CheckCircle fontSize="small" />;
      case 'Offline':
        return <Error fontSize="small" />;
      case 'Maintenance':
        return <Warning fontSize="small" />;
      default:
        return <Error fontSize="small" />;
    }
  };

  return (
    <Chip
      icon={getStatusIcon()}
      label={status}
      color={getStatusColor()}
      size="small"
      variant="filled"
    />
  );
};

const UptimeBar = ({ uptime }) => {
  const percentage = parseFloat(uptime) || 0;
  const getColor = () => {
    if (percentage >= 99) return 'success';
    if (percentage >= 95) return 'warning';
    return 'error';
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="caption" color="textSecondary">
          Uptime
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {percentage.toFixed(1)}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        color={getColor()}
        sx={{ height: 6, borderRadius: 3 }}
      />
    </Box>
  );
};

const NetworkList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    deviceType: '',
    status: '',
    location: ''
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);

  // Query parameters
  const queryParams = {
    page: page + 1,
    limit: rowsPerPage,
    search: searchTerm || undefined,
    ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
  };

  // Fetch network devices
  const { data: devicesData, isLoading, error, refetch } = useQuery(
    ['network-devices', queryParams],
    () => itService.getNetworkDevices(queryParams),
    {
      keepPreviousData: true,
      refetchInterval: 30000, // Refresh every 30 seconds
      onError: (error) => {
        toast.error('Failed to load network devices');
        console.error('Network devices error:', error);
      }
    }
  );

  // Delete device mutation
  const deleteDeviceMutation = useMutation(
    (id) => itService.deleteNetworkDevice(id),
    {
      onSuccess: () => {
        toast.success('Network device deleted successfully');
        queryClient.invalidateQueries(['network-devices']);
        setDeleteDialog(false);
        setSelectedDevice(null);
      },
      onError: (error) => {
        toast.error('Failed to delete network device');
        console.error('Delete error:', error);
      }
    }
  );

  const devices = devicesData?.data?.data || [];
  const total = devicesData?.data?.pagination?.total || 0;

  // Handle search
  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  // Handle filter change
  const handleFilterChange = (filter, value) => {
    setFilters(prev => ({
      ...prev,
      [filter]: value
    }));
    setPage(0);
  };

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle menu open
  const handleMenuOpen = (event, device) => {
    setAnchorEl(event.currentTarget);
    setSelectedDevice(device);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedDevice(null);
  };

  // Handle delete
  const handleDelete = () => {
    if (selectedDevice) {
      deleteDeviceMutation.mutate(selectedDevice._id);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    refetch();
    toast.success('Network devices refreshed');
  };

  // Device types
  const deviceTypes = [
    'Router', 'Switch', 'Firewall', 'Access Point', 'Server', 'NAS', 'Printer', 'Camera',
    'UPS', 'Modem', 'Load Balancer', 'Proxy Server', 'DNS Server', 'DHCP Server',
    'Mail Server', 'Web Server', 'Database Server', 'Other'
  ];

  // Device statuses
  const deviceStatuses = ['Online', 'Offline', 'Maintenance', 'Error', 'Unknown'];

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Network Devices
        </Typography>
        <TableSkeleton rows={8} columns={6} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Network Devices
        </Typography>
        <Alert severity="error">
          Failed to load network devices. Please try again.
        </Alert>
        <Button onClick={handleRefresh} sx={{ mt: 2 }}>
          <Refresh sx={{ mr: 1 }} />
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Network Devices
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/it/network/add')}
        >
          Add Device
        </Button>
      </Box>

      {/* Network Health Overview */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'success.light', mr: 2 }}>
                  <CheckCircle />
                </Avatar>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Online Devices
                  </Typography>
                  <Typography variant="h4">
                    {devices.filter(d => d.status === 'Online').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'error.light', mr: 2 }}>
                  <Error />
                </Avatar>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Offline Devices
                  </Typography>
                  <Typography variant="h4">
                    {devices.filter(d => d.status === 'Offline').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'warning.light', mr: 2 }}>
                  <Warning />
                </Avatar>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Maintenance
                  </Typography>
                  <Typography variant="h4">
                    {devices.filter(d => d.status === 'Maintenance').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'primary.light', mr: 2 }}>
                  <Speed />
                </Avatar>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Avg Uptime
                  </Typography>
                  <Typography variant="h4">
                    {devices.length > 0 
                      ? (devices.reduce((sum, d) => sum + (parseFloat(d.uptime?.uptimePercentage) || 0), 0) / devices.length).toFixed(1)
                      : 0}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search Devices"
                value={searchTerm}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                placeholder="Search by name, IP, brand, model..."
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Device Type</InputLabel>
                <Select
                  value={filters.deviceType}
                  label="Device Type"
                  onChange={(e) => handleFilterChange('deviceType', e.target.value)}
                >
                  <MenuItem value="">All Types</MenuItem>
                  {deviceTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  {deviceStatuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Location</InputLabel>
                <Select
                  value={filters.location}
                  label="Location"
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                >
                  <MenuItem value="">All Locations</MenuItem>
                  <MenuItem value="Building A">Building A</MenuItem>
                  <MenuItem value="Building B">Building B</MenuItem>
                  <MenuItem value="Data Center">Data Center</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Refresh />}
                onClick={handleRefresh}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Devices Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Device Details</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>IP Address</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Uptime</TableCell>
                <TableCell>Last Check</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device._id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ bgcolor: 'primary.light', mr: 2 }}>
                        <Router />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="medium">
                          {device.deviceName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {device.brand} {device.model}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={device.deviceType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <StatusChip status={device.status} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {device.ipAddress?.primary || 'Not Set'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {device.location?.building && `${device.location.building}`}
                      {device.location?.floor && ` - Floor ${device.location.floor}`}
                      {device.location?.room && ` - Room ${device.location.room}`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ minWidth: 100 }}>
                      <UptimeBar uptime={device.uptime?.uptimePercentage || 0} />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="textSecondary">
                      {device.uptime?.lastCheck 
                        ? new Date(device.uptime.lastCheck).toLocaleTimeString()
                        : 'Never'
                      }
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      onClick={(e) => handleMenuOpen(e, device)}
                      size="small"
                    >
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            navigate(`/it/network/${selectedDevice?._id}`);
            handleMenuClose();
          }}
        >
          <Visibility sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem
          onClick={() => {
            navigate(`/it/network/${selectedDevice?._id}/edit`);
            handleMenuClose();
          }}
        >
          <Edit sx={{ mr: 1 }} />
          Edit Device
        </MenuItem>
        <MenuItem
          onClick={() => {
            navigate(`/it/network/${selectedDevice?._id}/logs`);
            handleMenuClose();
          }}
        >
          <NetworkCheck sx={{ mr: 1 }} />
          View Logs
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleteDialog(true);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} />
          Delete Device
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete Network Device</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedDevice?.deviceName}"? 
            This action cannot be undone and will remove all associated logs and monitoring data.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleteDeviceMutation.isLoading}
          >
            {deleteDeviceMutation.isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NetworkList;
