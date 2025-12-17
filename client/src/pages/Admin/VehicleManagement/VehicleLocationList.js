import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  DirectionsCar as VehicleIcon
} from '@mui/icons-material';
import Divider from '@mui/material/Divider';
import { useNavigate } from 'react-router-dom';
import vehicleService from '../../../services/vehicleService';
import trakkerService from '../../../services/trakkerService';
import VehicleMap from '../../../components/VehicleMap';

const VehicleLocationList = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(new Set());
  const [locations, setLocations] = useState({});

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await vehicleService.getVehicles({});
      // Filter vehicles that have Trakker tracking configured
      const trackedVehicles = response.data.filter(
        v => v.trakkerPhone && v.trakkerDeviceId
      );
      setVehicles(trackedVehicles);
    } catch (err) {
      setError('Failed to fetch vehicles');
      console.error('Error fetching vehicles:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const fetchVehicleLocation = async (vehicle) => {
    try {
      setRefreshing(prev => new Set(prev).add(vehicle._id));
      
      const response = await trakkerService.getVehicleLocation(vehicle.vehicleId);
      
      if (response.success) {
        setLocations(prev => ({
          ...prev,
          [vehicle._id]: response.data
        }));
      } else {
        setLocations(prev => ({
          ...prev,
          [vehicle._id]: { error: response.message || 'Failed to fetch location' }
        }));
      }
    } catch (err) {
      console.error('Error fetching location:', err);
      setLocations(prev => ({
        ...prev,
        [vehicle._id]: { error: err.response?.data?.message || 'Failed to fetch location' }
      }));
    } finally {
      setRefreshing(prev => {
        const newSet = new Set(prev);
        newSet.delete(vehicle._id);
        return newSet;
      });
    }
  };

  const refreshAllLocations = async () => {
    for (const vehicle of vehicles) {
      await fetchVehicleLocation(vehicle);
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  // Auto-fetch locations for all vehicles on mount
  useEffect(() => {
    if (vehicles.length > 0) {
      vehicles.forEach(vehicle => {
        fetchVehicleLocation(vehicle);
      });
    }
  }, [vehicles]);

  const formatLocationData = (data) => {
    if (!data) return null;

    // Trakker API returns data.location as the vehicle object
    const loc = data.location || data.data || data;
    
    // Trakker API uses: Lat, Long, Speed, Direction, Location, GpsDateTime
    // Convert string values to numbers where needed
    const latitude = loc.Lat ? parseFloat(loc.Lat) : 
                     (loc.latitude || loc.Latitude || loc.lat || 
                      loc.LAT || loc.LATITUDE || null);
    const longitude = loc.Long ? parseFloat(loc.Long) : 
                      (loc.longitude || loc.Longitude || loc.lng || loc.Lng || 
                       loc.lon || loc.LON || loc.LONGITUDE || null);
    
    // Convert to numbers if they're strings
    let finalLat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
    let finalLng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
    
    // Try parsing from Link field if coordinates not found
    if ((!finalLat || isNaN(finalLat)) && (!finalLng || isNaN(finalLng)) && loc.Link) {
      const linkMatch = loc.Link.match(/q=([\d.]+),([\d.]+)/);
      if (linkMatch) {
        finalLat = parseFloat(linkMatch[1]);
        finalLng = parseFloat(linkMatch[2]);
      }
    }
    
    return {
      latitude: finalLat && !isNaN(finalLat) ? finalLat : null,
      longitude: finalLng && !isNaN(finalLng) ? finalLng : null,
      speed: loc.Speed ? parseFloat(loc.Speed) : (loc.speed || loc.speedKmh || null),
      heading: loc.Direction ? parseFloat(loc.Direction) : (loc.heading || loc.Heading || loc.direction || null),
      timestamp: loc.GpsDateTime || loc.timestamp || loc.Timestamp || loc.time || loc.Time || loc.dateTime || 
                loc.DateTime || loc.lastUpdate || loc.LastUpdate || null,
      address: loc.Location || loc.address || loc.Address || loc.locationName || loc.LocationName || null,
      status: loc.VehStatus || loc.status || loc.Status || loc.state || loc.State || 'Active',
      regNo: loc.RegNo || null,
      ignition: loc.Ignition || null,
      odo: loc.Odo ? parseFloat(loc.Odo) : null,
      link: loc.Link || null,
      rawData: loc
    };
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    const search = searchTerm.toLowerCase();
    return (
      vehicle.vehicleId?.toLowerCase().includes(search) ||
      vehicle.make?.toLowerCase().includes(search) ||
      vehicle.model?.toLowerCase().includes(search) ||
      vehicle.licensePlate?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
            <LocationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Vehicle Location Tracking
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time location tracking for vehicles with Trakker GPS devices
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={refreshAllLocations}
          disabled={refreshing.size > 0}
        >
          Refresh All
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {vehicles.length === 0 && !loading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No vehicles with Trakker tracking configured. Please add Trakker Phone and Device ID to vehicles to enable location tracking.
        </Alert>
      )}

      {vehicles.length > 0 && (
        <>
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search by Vehicle ID, Make, Model, or License Plate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Box>

          <Grid container spacing={3}>
            {filteredVehicles.map((vehicle) => {
              const locationData = locations[vehicle._id]
                ? formatLocationData(locations[vehicle._id])
                : null;
              const locationError = locations[vehicle._id]?.error;
              const isRefreshing = refreshing.has(vehicle._id);

              return (
                <Grid item xs={12} md={6} lg={4} key={vehicle._id}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                        <Box>
                          <Typography variant="h6" fontWeight="bold">
                            {vehicle.make} {vehicle.model}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {vehicle.vehicleId} • {vehicle.licensePlate}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/admin/vehicle-management/vehicles/${vehicle._id}`)}
                          title="View Vehicle Details"
                        >
                          <ViewIcon />
                        </IconButton>
                      </Box>

                      <Box display="flex" gap={1} mb={2}>
                        <Chip
                          label={vehicle.status}
                          size="small"
                          color={
                            vehicle.status === 'Available' ? 'success' :
                            vehicle.status === 'In Use' ? 'primary' :
                            vehicle.status === 'Maintenance' ? 'warning' : 'default'
                          }
                        />
                        <Chip
                          icon={<VehicleIcon />}
                          label="Trakker Enabled"
                          size="small"
                          color="info"
                        />
                      </Box>

                      {isRefreshing && (
                        <Box display="flex" justifyContent="center" py={2}>
                          <CircularProgress size={24} />
                        </Box>
                      )}

                      {!isRefreshing && locationError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                          {locationError}
                        </Alert>
                      )}

                      {!isRefreshing && !locationError && locationData && (
                        <Box>
                          {locationData.latitude && locationData.longitude ? (
                            <>
                              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'primary.light', borderRadius: 1, color: 'white' }}>
                                <Typography variant="caption" display="block">
                                  Coordinates
                                </Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {locationData.latitude.toFixed(6)}, {locationData.longitude.toFixed(6)}
                                </Typography>
                              </Box>
                              
                              <Divider sx={{ my: 2, borderWidth: 2, borderColor: 'primary.main' }} />
                              
                              {/* OpenStreetMap Display */}
                              <Box sx={{ mb: 2 }}>
                                <VehicleMap
                                  latitude={locationData.latitude}
                                  longitude={locationData.longitude}
                                  vehicleName={`${vehicle.make} ${vehicle.model}`}
                                  address={locationData.address}
                                  height="350px"
                                />
                              </Box>

                              <Divider sx={{ my: 2, borderWidth: 1.5 }} />

                              <Box sx={{ mb: 1 }}>
                                <Button
                                  fullWidth
                                  variant="outlined"
                                  size="small"
                                  href={`https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  startIcon={<LocationIcon />}
                                >
                                  Open in Google Maps
                                </Button>
                              </Box>

                              <Divider sx={{ my: 2, borderWidth: 1.5 }} />

                              <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                                <Table size="small">
                                  <TableBody>
                                    {locationData.regNo && (
                                      <TableRow>
                                        <TableCell><strong>Reg No</strong></TableCell>
                                        <TableCell>{locationData.regNo}</TableCell>
                                      </TableRow>
                                    )}
                                    {locationData.speed !== null && locationData.speed !== undefined && (
                                      <TableRow>
                                        <TableCell><strong>Speed</strong></TableCell>
                                        <TableCell>{locationData.speed} km/h</TableCell>
                                      </TableRow>
                                    )}
                                    {locationData.heading !== null && locationData.heading !== undefined && (
                                      <TableRow>
                                        <TableCell><strong>Direction</strong></TableCell>
                                        <TableCell>{locationData.heading}°</TableCell>
                                      </TableRow>
                                    )}
                                    {locationData.ignition && (
                                      <TableRow>
                                        <TableCell><strong>Ignition</strong></TableCell>
                                        <TableCell>{locationData.ignition}</TableCell>
                                      </TableRow>
                                    )}
                                    {locationData.odo !== null && locationData.odo !== undefined && (
                                      <TableRow>
                                        <TableCell><strong>Odometer</strong></TableCell>
                                        <TableCell>{locationData.odo.toFixed(2)} km</TableCell>
                                      </TableRow>
                                    )}
                                    {locationData.address && (
                                      <TableRow>
                                        <TableCell><strong>Address</strong></TableCell>
                                        <TableCell>{locationData.address}</TableCell>
                                      </TableRow>
                                    )}
                                    {locationData.timestamp && (
                                      <TableRow>
                                        <TableCell><strong>GPS DateTime</strong></TableCell>
                                        <TableCell>{locationData.timestamp}</TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                              
                              <Divider sx={{ my: 2, borderWidth: 1.5 }} />
                            </>
                          ) : (
                            <Alert severity="info">
                              Location data received but coordinates not available.
                            </Alert>
                          )}
                        </Box>
                      )}

                      {!isRefreshing && !locationError && !locationData && (
                        <Alert severity="info">
                          Click refresh to fetch location
                        </Alert>
                      )}

                      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <Tooltip title="Refresh Location">
                          <IconButton
                            size="small"
                            onClick={() => fetchVehicleLocation(vehicle)}
                            disabled={isRefreshing}
                          >
                            <RefreshIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}
    </Box>
  );
};

export default VehicleLocationList;

