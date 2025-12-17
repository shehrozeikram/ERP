import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box } from '@mui/material';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Component to update map center when coordinates change
const MapUpdater = ({ center }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  
  return null;
};

const VehicleMap = ({ latitude, longitude, vehicleName, address, height = '200px' }) => {
  // Don't render if coordinates are not available
  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
    return (
      <Box
        sx={{
          height,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.100',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
          No coordinates available
        </Box>
      </Box>
    );
  }

  const position = [parseFloat(latitude), parseFloat(longitude)];

  return (
    <Box
      sx={{
        height,
        width: '100%',
        borderRadius: 1,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        '& .leaflet-container': {
          height: '100%',
          width: '100%',
          zIndex: 0
        }
      }}
    >
      <MapContainer
        center={position}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        zoomControl={true}
      >
        <MapUpdater center={position} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>
            <Box>
              <strong>{vehicleName || 'Vehicle Location'}</strong>
              {address && (
                <Box sx={{ mt: 0.5, fontSize: '0.85rem' }}>
                  {address}
                </Box>
              )}
              <Box sx={{ mt: 0.5, fontSize: '0.8rem', color: 'text.secondary' }}>
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </Box>
            </Box>
          </Popup>
        </Marker>
      </MapContainer>
    </Box>
  );
};

export default VehicleMap;
