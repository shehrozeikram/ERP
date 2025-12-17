import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  Divider
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Refresh as RefreshIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import trakkerService from '../../../services/trakkerService';
import VehicleMap from '../../../components/VehicleMap';

const VehicleLocation = ({ vehicleId, vehicleName }) => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchLocation = async () => {
    if (!vehicleId) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await trakkerService.getVehicleLocation(vehicleId);
      
      if (response.success) {
        setLocation(response.data);
        setLastUpdated(new Date());
      } else {
        setError(response.message || 'Failed to fetch location');
      }
    } catch (err) {
      console.error('Error fetching vehicle location:', err);
      setError(err.response?.data?.message || 'Failed to fetch vehicle location');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-fetch on mount
    fetchLocation();
  }, [vehicleId]);

  // Format location data for display
  const formatLocationData = (data) => {
    if (!data) return null;

    // Trakker API returns data.location as the vehicle object
    // The API response structure: { vehicle: {...}, location: {...}, allVehicles: [...] }
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
    
    // Handle different possible response structures
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
      rawData: loc // Keep raw data for debugging
    };
  };

  const locationData = location ? formatLocationData(location) : null;

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">
            <LocationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Vehicle Location
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={fetchLocation}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {loading && !location && (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Fetching location...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <ErrorIcon sx={{ mr: 1 }} />
            {error}
          </Alert>
        )}

        {!loading && !error && locationData && (
          <Box>
            <Grid container spacing={2}>
              {locationData.latitude && locationData.longitude && (
                <>
                  <Grid item xs={12}>
                    <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 1, color: 'white' }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Coordinates
                      </Typography>
                      <Typography variant="h6">
                        {locationData.latitude.toFixed(6)}, {locationData.longitude.toFixed(6)}
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{ mt: 1 }}
                        href={`https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open in Google Maps
                      </Button>
                    </Box>
                  </Grid>
                  
                  {/* OpenStreetMap Display */}
                  <Grid item xs={12}>
                    <VehicleMap
                      latitude={locationData.latitude}
                      longitude={locationData.longitude}
                      vehicleName={vehicleName}
                      address={locationData.address}
                      height="300px"
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Latitude
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {locationData.latitude.toFixed(6)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Longitude
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {locationData.longitude.toFixed(6)}
                    </Typography>
                  </Grid>
                </>
              )}

              {locationData.regNo && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Registration No
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {locationData.regNo}
                  </Typography>
                </Grid>
              )}

              {locationData.speed !== null && locationData.speed !== undefined && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Speed
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {locationData.speed} km/h
                  </Typography>
                </Grid>
              )}

              {locationData.heading !== null && locationData.heading !== undefined && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Direction
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {locationData.heading}°
                  </Typography>
                </Grid>
              )}

              {locationData.ignition && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Ignition
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {locationData.ignition}
                  </Typography>
                </Grid>
              )}

              {locationData.odo !== null && locationData.odo !== undefined && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Odometer
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {locationData.odo.toFixed(2)} km
                  </Typography>
                </Grid>
              )}

              {locationData.address && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Address
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {locationData.address}
                  </Typography>
                </Grid>
              )}

              {locationData.timestamp && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    GPS DateTime
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {locationData.timestamp}
                  </Typography>
                </Grid>
              )}

              {lastUpdated && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Last Fetched
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {lastUpdated.toLocaleString()}
                  </Typography>
                </Grid>
              )}

              <Grid item xs={12}>
                <Chip
                  icon={<CheckCircleIcon />}
                  label={locationData.status || 'Active'}
                  color="success"
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>
        )}

        {!loading && !error && locationData && (!locationData.latitude || !locationData.longitude) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Location data received but coordinates not available. The API response may be in a different format.
            {locationData.rawData && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" display="block" fontWeight="bold">
                  Available data fields:
                </Typography>
                <Typography variant="caption" component="pre" sx={{ fontSize: '0.7rem', overflow: 'auto', mt: 0.5 }}>
                  {JSON.stringify(locationData.rawData, null, 2)}
                </Typography>
              </Box>
            )}
          </Alert>
        )}

        {!loading && !error && !location && (
          <Alert severity="info">
            No location data available. Click Refresh to fetch location.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default VehicleLocation;

