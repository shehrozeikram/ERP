import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import locationService from '../../../services/locationService';

const LocationManagement = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, locationId: null });
  const [formDialog, setFormDialog] = useState({ open: false, location: null });
  const [formData, setFormData] = useState({
    name: '',
    type: 'Office',
    address: '',
    capacity: 1,
    status: 'Active',
    description: ''
  });

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      
      const response = await locationService.getLocations(params);
      setLocations(response.data || []);
    } catch (err) {
      setError('Failed to fetch locations');
      console.error('Error fetching locations:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, typeFilter, statusFilter]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleDelete = async () => {
    try {
      await locationService.deleteLocation(deleteDialog.locationId);
      setDeleteDialog({ open: false, locationId: null });
      fetchLocations();
    } catch (err) {
      setError('Failed to delete location');
      console.error('Error deleting location:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formDialog.location) {
        await locationService.updateLocation(formDialog.location._id, formData);
      } else {
        await locationService.createLocation(formData);
      }
      setFormDialog({ open: false, location: null });
      setFormData({
        name: '',
        type: 'Office',
        address: '',
        capacity: 1,
        status: 'Active',
        description: ''
      });
      fetchLocations();
    } catch (err) {
      setError('Failed to save location');
      console.error('Error saving location:', err);
    }
  };

  const openEditDialog = (location) => {
    setFormData({
      name: location.name || '',
      type: location.type || 'Office',
      address: location.address || '',
      capacity: location.capacity || 1,
      status: location.status || 'Active',
      description: location.description || ''
    });
    setFormDialog({ open: true, location });
  };

  const openCreateDialog = () => {
    setFormData({
      name: '',
      type: 'Office',
      address: '',
      capacity: 1,
      status: 'Active',
      description: ''
    });
    setFormDialog({ open: true, location: null });
  };

  const getStatusColor = (status) => {
    const colors = {
      'Active': 'success',
      'Inactive': 'default',
      'Under Maintenance': 'warning'
    };
    return colors[status] || 'default';
  };

  const getTypeColor = (type) => {
    const colors = {
      'Office': 'primary',
      'House': 'info',
      'Warehouse': 'warning',
      'Factory': 'error',
      'Other': 'default'
    };
    return colors[type] || 'default';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading locations...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Location Management
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchLocations} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
          >
            New Location
          </Button>
        </Box>
      </Box>

      {error && (
        <Box mb={3}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <TextField
              label="Search Locations"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
            
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                label="Type"
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="Office">Office</MenuItem>
                <MenuItem value="House">House</MenuItem>
                <MenuItem value="Warehouse">Warehouse</MenuItem>
                <MenuItem value="Factory">Factory</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
                <MenuItem value="Under Maintenance">Under Maintenance</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* Locations Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Location ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell>Capacity</TableCell>
                  <TableCell>Occupancy</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {locations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No locations found. Create your first location to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  locations.map((location) => (
                    <TableRow key={location._id} hover>
                      <TableCell>{location.locationId}</TableCell>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {location.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={location.type}
                          color={getTypeColor(location.type)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{location.address}</TableCell>
                      <TableCell>{location.capacity}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {location.currentOccupancy || 0} / {location.capacity}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {Math.round(((location.currentOccupancy || 0) / location.capacity) * 100)}% occupied
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={location.status}
                          color={getStatusColor(location.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={1}>
                          <Tooltip title="Edit Location">
                            <IconButton
                              size="small"
                              onClick={() => openEditDialog(location)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Location">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteDialog({ open: true, locationId: location._id })}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Location Form Dialog */}
      <Dialog
        open={formDialog.open}
        onClose={() => setFormDialog({ open: false, location: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {formDialog.location ? 'Edit Location' : 'Create New Location'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2} sx={{ pt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Location Name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                    label="Type"
                  >
                    <MenuItem value="Office">Office</MenuItem>
                    <MenuItem value="House">House</MenuItem>
                    <MenuItem value="Warehouse">Warehouse</MenuItem>
                    <MenuItem value="Factory">Factory</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) }))}
                  inputProps={{ min: 1 }}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    label="Status"
                  >
                    <MenuItem value="Active">Active</MenuItem>
                    <MenuItem value="Inactive">Inactive</MenuItem>
                    <MenuItem value="Under Maintenance">Under Maintenance</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormDialog({ open: false, location: null })}>
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              {formDialog.location ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, locationId: null })}
      >
        <DialogTitle>Delete Location</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this location? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, locationId: null })}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LocationManagement;
