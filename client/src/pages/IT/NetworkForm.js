import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider,
  Alert,
  IconButton,
  Tooltip,
  Chip
} from '@mui/material';
import {
  Save,
  Cancel,
  ArrowBack,
  Info,
  Add,
  Delete
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';

import { itService } from '../../services/itService';
import { FormSkeleton } from '../../components/IT/SkeletonLoader';

const NetworkForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch
  } = useForm({
    defaultValues: {
      deviceName: '',
      deviceType: '',
      brand: '',
      model: '',
      serialNumber: '',
      ipAddress: {
        primary: '',
        secondary: [],
        management: ''
      },
      macAddress: '',
      location: {
        building: '',
        floor: '',
        room: '',
        rack: '',
        position: ''
      },
      status: 'Unknown',
      specifications: {
        cpu: '',
        memory: '',
        storage: '',
        ports: '',
        powerConsumption: '',
        operatingSystem: '',
        firmware: '',
        other: ''
      },
      networkConfig: {
        subnet: '',
        gateway: '',
        dns: [],
        vlan: [],
        protocols: []
      },
      security: {
        encryption: [],
        authentication: '',
        certificates: []
      },
      monitoring: {
        enabled: false,
        snmp: {
          community: '',
          version: '',
          port: 161
        },
        ping: {
          enabled: false,
          interval: 60
        },
        bandwidth: {
          maxSpeed: '',
          currentUsage: ''
        }
      },
      maintenance: {
        lastServiceDate: '',
        nextServiceDate: '',
        serviceProvider: '',
        warranty: {
          startDate: '',
          endDate: '',
          provider: ''
        }
      },
      purchaseInfo: {
        purchaseDate: '',
        purchasePrice: '',
        currency: 'PKR',
        supplier: ''
      },
      notes: ''
    }
  });

  // Fetch device data for editing
  const { data: deviceData, isLoading } = useQuery(
    ['network-device', id],
    () => itService.getNetworkDevice(id),
    {
      enabled: isEdit,
      onSuccess: (data) => {
        const device = data.data;
        reset({
          ...device,
          purchaseInfo: {
            ...device.purchaseInfo,
            purchaseDate: device.purchaseInfo?.purchaseDate ? device.purchaseInfo.purchaseDate.split('T')[0] : ''
          },
          maintenance: {
            ...device.maintenance,
            lastServiceDate: device.maintenance?.lastServiceDate ? device.maintenance.lastServiceDate.split('T')[0] : '',
            nextServiceDate: device.maintenance?.nextServiceDate ? device.maintenance.nextServiceDate.split('T')[0] : '',
            warranty: {
              ...device.maintenance?.warranty,
              startDate: device.maintenance?.warranty?.startDate ? device.maintenance.warranty.startDate.split('T')[0] : '',
              endDate: device.maintenance?.warranty?.endDate ? device.maintenance.warranty.endDate.split('T')[0] : ''
            }
          },
          networkConfig: {
            ...device.networkConfig,
            dns: device.networkConfig?.dns || [],
            vlan: device.networkConfig?.vlan || [],
            protocols: device.networkConfig?.protocols || []
          },
          security: {
            ...device.security,
            encryption: device.security?.encryption || [],
            certificates: device.security?.certificates || []
          }
        });
      },
      onError: (error) => {
        toast.error('Failed to load device data');
        console.error('Device load error:', error);
      }
    }
  );

  // Create/Update device mutation
  const saveDeviceMutation = useMutation(
    (data) => {
      if (isEdit) {
        return itService.updateNetworkDevice(id, data);
      } else {
        return itService.createNetworkDevice(data);
      }
    },
    {
      onSuccess: (data) => {
        toast.success(`Network device ${isEdit ? 'updated' : 'created'} successfully`);
        queryClient.invalidateQueries(['network-devices']);
        navigate('/it/network');
      },
      onError: (error) => {
        toast.error(`Failed to ${isEdit ? 'update' : 'create'} network device`);
        console.error('Save error:', error);
      }
    }
  );

  // Device types
  const deviceTypes = [
    'Router', 'Switch', 'Firewall', 'Access Point', 'Server', 'NAS', 'Printer', 'Camera',
    'UPS', 'Modem', 'Load Balancer', 'Proxy Server', 'DNS Server', 'DHCP Server',
    'Mail Server', 'Web Server', 'Database Server', 'Other'
  ];

  // Device statuses
  const deviceStatuses = ['Online', 'Offline', 'Maintenance', 'Error', 'Unknown'];

  // SNMP versions
  const snmpVersions = ['v1', 'v2c', 'v3'];

  // Network protocols
  const networkProtocols = ['TCP', 'UDP', 'HTTP', 'HTTPS', 'SSH', 'Telnet', 'SNMP', 'ICMP'];

  // Encryption types
  const encryptionTypes = ['WPA2', 'WPA3', 'AES', 'RSA', 'SSL', 'TLS', 'IPSec'];

  // Currencies
  const currencies = ['PKR', 'USD', 'EUR'];

  // Handle form submission
  const onSubmit = (data) => {
    // Clean up data
    const submitData = {
      ...data,
      purchaseInfo: {
        ...data.purchaseInfo,
        purchasePrice: data.purchaseInfo.purchasePrice ? parseFloat(data.purchaseInfo.purchasePrice) : null
      }
    };

    saveDeviceMutation.mutate(submitData);
  };

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          {isEdit ? 'Edit Network Device' : 'Add New Network Device'}
        </Typography>
        <FormSkeleton fields={8} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/it/network')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" component="h1">
          {isEdit ? 'Edit Network Device' : 'Add New Network Device'}
        </Typography>
      </Box>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Basic Information */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="deviceName"
                  control={control}
                  rules={{ required: 'Device name is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Device Name"
                      error={Boolean(errors.deviceName)}
                      helperText={errors.deviceName?.message}
                    />
                  )}
                />
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Controller
                  name="deviceType"
                  control={control}
                  rules={{ required: 'Device type is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={Boolean(errors.deviceType)}>
                      <InputLabel>Device Type</InputLabel>
                      <Select {...field} label="Device Type">
                        {deviceTypes.map((type) => (
                          <MenuItem key={type} value={type}>
                            {type}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select {...field} label="Status">
                        {deviceStatuses.map((status) => (
                          <MenuItem key={status} value={status}>
                            {status}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="brand"
                  control={control}
                  rules={{ required: 'Brand is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Brand"
                      error={Boolean(errors.brand)}
                      helperText={errors.brand?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="model"
                  control={control}
                  rules={{ required: 'Model is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Model"
                      error={Boolean(errors.model)}
                      helperText={errors.model?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="serialNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Serial Number"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="ipAddress.primary"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Primary IP Address"
                      placeholder="192.168.1.1"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="macAddress"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="MAC Address"
                      placeholder="00:11:22:33:44:55"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Location Information */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Location Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Controller
                  name="location.building"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Building"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <Controller
                  name="location.floor"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Floor"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <Controller
                  name="location.room"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Room"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <Controller
                  name="location.rack"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Rack"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="location.position"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Position in Rack"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Specifications */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Specifications
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Controller
                  name="specifications.cpu"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="CPU"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="specifications.memory"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Memory"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="specifications.storage"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Storage"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="specifications.ports"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Ports"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="specifications.powerConsumption"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Power Consumption"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="specifications.operatingSystem"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Operating System"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="specifications.firmware"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Firmware Version"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="specifications.other"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Other Specifications"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Network Configuration */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Network Configuration
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="networkConfig.subnet"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Subnet"
                      placeholder="192.168.1.0/24"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="networkConfig.gateway"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Gateway"
                      placeholder="192.168.1.1"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="ipAddress.management"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Management IP"
                      placeholder="192.168.1.100"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="monitoring.bandwidth.maxSpeed"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Max Bandwidth"
                      placeholder="1 Gbps"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Purchase Information */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Purchase Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Controller
                  name="purchaseInfo.purchaseDate"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Purchase Date"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="purchaseInfo.purchasePrice"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Purchase Price"
                      type="number"
                      inputProps={{ min: 0 }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="purchaseInfo.currency"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Currency</InputLabel>
                      <Select {...field} label="Currency">
                        {currencies.map((currency) => (
                          <MenuItem key={currency} value={currency}>
                            {currency}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="purchaseInfo.supplier"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Supplier"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Additional Notes */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Additional Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Notes"
                      multiline
                      rows={4}
                      placeholder="Additional notes, configuration details, etc."
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <Box display="flex" justifyContent="space-between" mt={3}>
          <Button
            variant="outlined"
            onClick={() => navigate('/it/network')}
            startIcon={<Cancel />}
          >
            Cancel
          </Button>
          
          <Button
            type="submit"
            variant="contained"
            startIcon={<Save />}
            disabled={saveDeviceMutation.isLoading}
          >
            {saveDeviceMutation.isLoading 
              ? (isEdit ? 'Updating...' : 'Creating...') 
              : (isEdit ? 'Update Device' : 'Create Device')
            }
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default NetworkForm;
