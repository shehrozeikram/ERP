import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Alert,
  Skeleton,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  DirectionsCar as VehicleIcon,
  Build as MaintenanceIcon,
  Assignment as LogBookIcon,
  Warning as AlertIcon,
  TrendingUp as TrendingIcon,
  Add as AddIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import vehicleService from '../../../services/vehicleService';
import vehicleMaintenanceService from '../../../services/vehicleMaintenanceService';
import vehicleLogBookService from '../../../services/vehicleLogBookService';
import { formatDate, formatCurrency } from '../../../utils/dateUtils';

// Lightweight reusable components
const StatCard = ({ title, value, icon: Icon, color = 'primary', onClick }) => (
  <Card sx={{ cursor: onClick ? 'pointer' : 'default', '&:hover': onClick ? { boxShadow: 3 } : {} }}>
    <CardContent onClick={onClick}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography color="textSecondary" gutterBottom variant="body2">
            {title}
          </Typography>
          <Typography variant="h6" component="div">
            {value}
          </Typography>
        </Box>
        <Icon color={color} sx={{ fontSize: 40 }} />
      </Box>
    </CardContent>
  </Card>
);

const AlertCard = ({ alerts, onDismiss }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" mb={2}>
        <AlertIcon color="warning" sx={{ mr: 1 }} />
        <Typography variant="h6">Alerts & Reminders</Typography>
      </Box>
      {alerts.length === 0 ? (
        <Typography color="textSecondary">No alerts</Typography>
      ) : (
        alerts.map((alert, index) => (
          <Alert
            key={index}
            severity={alert.severity}
            action={
              <IconButton size="small" onClick={() => onDismiss(index)}>
                ×
              </IconButton>
            }
            sx={{ mb: 1 }}
          >
            <Typography variant="body2">
              <strong>{alert.vehicle}</strong>: {alert.message}
            </Typography>
          </Alert>
        ))
      )}
    </CardContent>
  </Card>
);

const QuickActions = ({ onAddVehicle, onAddMaintenance, onAddLogBook, onViewLocation }) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>Quick Actions</Typography>
      <Box display="flex" flexDirection="column" gap={1}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onAddVehicle}
          fullWidth
        >
          Add Vehicle
        </Button>
        <Button
          variant="outlined"
          startIcon={<LocationIcon />}
          onClick={onViewLocation}
          fullWidth
        >
          Vehicle Location
        </Button>
        <Button
          variant="outlined"
          startIcon={<MaintenanceIcon />}
          onClick={onAddMaintenance}
          fullWidth
        >
          Add Maintenance
        </Button>
        <Button
          variant="outlined"
          startIcon={<LogBookIcon />}
          onClick={onAddLogBook}
          fullWidth
        >
          Add Log Entry
        </Button>
      </Box>
    </CardContent>
  </Card>
);

const VehicleDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    vehicles: [],
    maintenance: [],
    logBook: [],
    alerts: []
  });

  // Memoized calculations for performance
  const stats = useMemo(() => {
    const { vehicles, maintenance, logBook } = data;
    
    return {
      totalVehicles: vehicles.length,
      activeVehicles: vehicles.filter(v => v.status === 'Available').length,
      totalMaintenanceCost: maintenance.reduce((sum, m) => sum + (m.cost || 0), 0),
      totalFuelCost: logBook.reduce((sum, l) => sum + (l.fuelCost || 0), 0),
      maintenanceCount: maintenance.length,
      logBookEntries: logBook.length
    };
  }, [data]);

  const alerts = useMemo(() => {
    const { vehicles, maintenance } = data;
    const alertsList = [];

    // Check for upcoming service dates
    vehicles.forEach(vehicle => {
      if (vehicle.nextServiceDate) {
        const serviceDate = new Date(vehicle.nextServiceDate);
        const today = new Date();
        const daysUntilService = Math.ceil((serviceDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilService <= 7 && daysUntilService >= 0) {
          alertsList.push({
            vehicle: `${vehicle.make} ${vehicle.model}`,
            message: `Service due in ${daysUntilService} days`,
            severity: daysUntilService <= 3 ? 'error' : 'warning'
          });
        }
      }
    });

    return alertsList;
  }, [data]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [vehiclesRes, maintenanceRes, logBookRes] = await Promise.all([
        vehicleService.getVehicles({ limit: 50 }),
        vehicleMaintenanceService.getMaintenanceRecords({ limit: 20 }),
        vehicleLogBookService.getLogBookEntries({ limit: 20 })
      ]);

      setData({
        vehicles: vehiclesRes.data || [],
        maintenance: maintenanceRes.data || [],
        logBook: logBookRes.data || [],
        alerts: []
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissAlert = (index) => {
    setData(prev => ({
      ...prev,
      alerts: prev.alerts.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Header Skeleton */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width="35%" height={40} />
          <Box display="flex" gap={1}>
            <Skeleton variant="circular" width={48} height={48} />
            <Skeleton variant="rectangular" width={140} height={36} borderRadius={1} />
          </Box>
        </Box>

        {/* Stats Cards Skeleton */}
        <Grid container spacing={3} mb={3}>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box flexGrow={1}>
                      <Skeleton variant="text" height={16} width="50%" sx={{ mb: 1 }} />
                      <Skeleton variant="text" height={28} width="60%" />
                    </Box>
                    <Skeleton variant="circular" width={40} height={40} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3}>
          {/* Recent Maintenance Skeleton */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Skeleton variant="text" width="40%" height={28} />
                  <Skeleton variant="rectangular" width={100} height={36} borderRadius={1} />
                </Box>
                {[1, 2, 3, 4].map((item) => (
                  <Box key={item} display="flex" alignItems="center" justifyContent="space-between" py={1.5}>
                    <Box flexGrow={1}>
                      <Skeleton variant="text" height={16} width={70} sx={{ mb: 0.5 }} />
                      <Skeleton variant="text" height={14} width={50} />
                    </Box>
                    <Skeleton variant="text" height={16} width={60} />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Logbook Skeleton */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Skeleton variant="text" width="35%" height={28} />
                  <Skeleton variant="rectangular" width={100} height={36} borderRadius={1} />
                </Box>
                {[1, 2, 3, 4].map((item) => (
                  <Box key={item} display="flex" alignItems="center" justifyContent="space-between" py={1.5}>
                    <Box flexGrow={1}>
                      <Skeleton variant="text" height={16} width={65} sx={{ mb: 0.5 }} />
                      <Skeleton variant="text" height={14} width={45} />
                    </Box>
                    <Box display="flex" gap={2}>
                      <Skeleton variant="text" height={16} width={50} />
                      <Skeleton variant="text" height={16} width={40} />
                    </Box>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Vehicle Management Dashboard
      </Typography>

      <Grid container spacing={3}>
        {/* Statistics Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Vehicles"
            value={stats.totalVehicles}
            icon={VehicleIcon}
            color="primary"
            onClick={() => navigate('/admin/vehicle-management')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Vehicles"
            value={stats.activeVehicles}
            icon={VehicleIcon}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Maintenance Cost"
            value={formatCurrency(stats.totalMaintenanceCost)}
            icon={MaintenanceIcon}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Fuel Cost"
            value={formatCurrency(stats.totalFuelCost)}
            icon={TrendingIcon}
            color="info"
          />
        </Grid>

        {/* Alerts */}
        <Grid item xs={12} md={8}>
          <AlertCard alerts={alerts} onDismiss={handleDismissAlert} />
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <QuickActions
            onAddVehicle={() => navigate('/admin/vehicle-management/vehicles/new')}
            onViewLocation={() => navigate('/admin/vehicle-management/location')}
            onAddMaintenance={() => navigate('/admin/vehicle-management/maintenance/new')}
            onAddLogBook={() => navigate('/admin/vehicle-management/logbook/new')}
          />
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Recent Maintenance</Typography>
              {data.maintenance.slice(0, 5).map((record) => (
                <Box key={record._id} display="flex" justifyContent="space-between" alignItems="center" py={1}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {record.title}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {formatDate(record.serviceDate)}
                    </Typography>
                  </Box>
                  <Chip
                    label={formatCurrency(record.cost)}
                    size="small"
                    color={record.status === 'Completed' ? 'success' : 'default'}
                  />
                </Box>
              ))}
              <Button
                variant="text"
                size="small"
                onClick={() => navigate('/admin/vehicle-management/maintenance')}
                sx={{ mt: 1 }}
              >
                View All
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Recent Log Entries</Typography>
              {data.logBook.slice(0, 5).map((entry) => (
                <Box key={entry._id} display="flex" justifyContent="space-between" alignItems="center" py={1}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {entry.driverId?.firstName} {entry.driverId?.lastName}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {formatDate(entry.date)} • {entry.purpose}
                    </Typography>
                  </Box>
                  <Chip
                    label={`${entry.distanceTraveled || 0} km`}
                    size="small"
                    color="primary"
                  />
                </Box>
              ))}
              <Button
                variant="text"
                size="small"
                onClick={() => navigate('/admin/vehicle-management/logbook')}
                sx={{ mt: 1 }}
              >
                View All
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default VehicleDashboard;
