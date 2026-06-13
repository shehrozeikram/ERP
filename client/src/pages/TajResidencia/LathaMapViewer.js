import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as RestartAltIcon,
  Fullscreen as FullscreenIcon,
  Layers as LayersIcon,
  Map as MapIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getMapStatus } from '../../services/landAcquisitionMapService';
import {
  STATUS_LEGEND,
  buildStatusLookups,
  fillForStatus,
  fillOpacityForStatus,
  formatStatusSummary,
  isErpTrackedKhasra,
  resolveStatusForKhasra,
  strokeForStatus
} from '../../utils/lathaMapStatus';
import { formatKMS, normalizeArea } from '../../utils/landAreaUnits';

const MAP_BASE = `${process.env.PUBLIC_URL}/maps/latha`;
const MAP_INDEX_URL = `${MAP_BASE}/khasra-map-index.json`;
const KMZ_URL = `${MAP_BASE}/khasra-plan.kmz`;

const MOUZA_LABELS = {
  sheikhpur: 'Mouza Sheikhpur',
  kaak: 'Mouza Kaak',
  lakhu: 'Mouza Lakhu',
  rupa: 'Mouza Rupa',
  'chak-rupa': 'Mouza Chak Rupa',
  narhala: 'Mouza Narhala',
  unknown: 'Other / Unmapped'
};

const SATELLITE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const STREET_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const isMapUsable = (map) => Boolean(map?.getContainer?.() && map._loaded);

const runWhenMapReady = (map, fn) => {
  if (!map) return;
  if (isMapUsable(map)) {
    fn(map);
    return;
  }
  map.whenReady(() => {
    if (isMapUsable(map)) fn(map);
  });
};

const MapBounds = ({ bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (!bounds) return;
    runWhenMapReady(map, (readyMap) => {
      readyMap.fitBounds(
        [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east]
        ],
        { padding: [24, 24], animate: false }
      );
    });
  }, [bounds, map]);

  return null;
};

const MapController = ({ onReady }) => {
  const map = useMap();

  useEffect(() => {
    runWhenMapReady(map, () => onReady(map));
    return () => onReady(null);
  }, [map, onReady]);

  return null;
};

const KhasraParcelLayer = ({
  data,
  getStyle,
  onParcelClick,
  isTrackedKhasra
}) => {
  const map = useMap();
  const layerRef = useRef(null);
  const styleRef = useRef(getStyle);
  const clickRef = useRef(onParcelClick);
  const trackedRef = useRef(isTrackedKhasra);

  styleRef.current = getStyle;
  clickRef.current = onParcelClick;
  trackedRef.current = isTrackedKhasra;

  useEffect(() => {
    if (!data?.features?.length) return undefined;

    const layer = L.geoJSON(data, {
      style: (feature) => styleRef.current(feature),
      onEachFeature: (feature, leafletLayer) => {
        const parcel = {
          id: `khasra-${feature.properties?.k}`,
          k: feature.properties?.k,
          lat: feature.properties?.cy,
          lng: feature.properties?.cx,
          feature
        };

        leafletLayer.on('click', (event) => clickRef.current(event, parcel));

        const label = String(feature.properties?.k || '');
        if (trackedRef.current(feature.properties?.k)) {
          leafletLayer.bindTooltip(label, {
            permanent: true,
            direction: 'center',
            className: 'latha-khasra-label latha-khasra-label--tracked',
            opacity: 1
          });
        } else {
          leafletLayer.bindTooltip(`Khasra ${label}`, {
            sticky: true,
            direction: 'top',
            opacity: 0.95
          });
        }
      }
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      layerRef.current = null;
      map.removeLayer(layer);
    };
  }, [map, data]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.eachLayer((leafletLayer) => {
      if (leafletLayer.feature) {
        leafletLayer.setStyle(styleRef.current(leafletLayer.feature));
      }
    });
  }, [getStyle]);

  return null;
};

const LathaMapViewer = () => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  const [mapIndex, setMapIndex] = useState(null);
  const [parcels, setParcels] = useState([]);
  const [lines, setLines] = useState(null);
  const [statusMap, setStatusMap] = useState({});
  const [mozas, setMozas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [mouzaFilter, setMouzaFilter] = useState('all');
  const [baseLayer, setBaseLayer] = useState('satellite');
  const [showRegistryOnly, setShowRegistryOnly] = useState(false);
  const [selectedParcel, setSelectedParcel] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [indexRes, statusRes] = await Promise.all([
          fetch(MAP_INDEX_URL).then((r) => {
            if (!r.ok) {
              throw new Error('Khasra map index not found. Run scripts/extract-khasra-kmz.py');
            }
            return r.json();
          }),
          getMapStatus()
        ]);

        const files = indexRes.files || {};
        const fetches = [
          fetch(`${MAP_BASE}/${files.lines}`).then((r) => {
            if (!r.ok) throw new Error('Khasra line layer not found');
            return r.json();
          })
        ];

        if (files.parcels) {
          fetches.push(
            fetch(`${MAP_BASE}/${files.parcels}`).then((r) => {
              if (!r.ok) throw new Error('Khasra parcel layer not found. Run scripts/extract-khasra-kmz.py');
              return r.json();
            })
          );
        } else if (files.points) {
          fetches.push(
            fetch(`${MAP_BASE}/${files.points}`).then((r) => {
              if (!r.ok) throw new Error('Khasra point layer not found');
              return r.json();
            })
          );
        }

        const layerResults = await Promise.all(fetches);
        const linesRes = layerResults[0];
        const parcelsRes = layerResults[1];

        if (cancelled) return;

        setMapIndex(indexRes);
        setMozas(statusRes.data?.data?.mozas || []);
        setStatusMap(statusRes.data?.data?.status || {});
        setLines(linesRes);

        if (parcelsRes?.features?.[0]?.geometry?.type === 'Polygon') {
          setParcels(
            (parcelsRes.features || []).map((feature, idx) => ({
              id: `khasra-${feature.properties?.k || idx}`,
              k: feature.properties?.k,
              lat: feature.properties?.cy,
              lng: feature.properties?.cx,
              feature
            }))
          );
        } else {
          setParcels(
            (parcelsRes?.features || []).map((feature, idx) => ({
              id: `khasra-${feature.properties?.k || idx}`,
              k: feature.properties?.k,
              lat: feature.geometry.coordinates[1],
              lng: feature.geometry.coordinates[0],
              feature: null
            }))
          );
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || 'Failed to load map data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return undefined;
    const map = mapRef.current;
    const timer = window.setTimeout(() => {
      if (isMapUsable(map)) map.invalidateSize();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [mapReady, loading]);

  const statusLookups = useMemo(() => buildStatusLookups(statusMap), [statusMap]);

  const mouzaChips = useMemo(() => {
    const fromErp = mozas.map((m) => m.slug);
    return [...new Set(fromErp)].sort();
  }, [mozas]);

  const getResolvedStatus = useCallback(
    (point) => resolveStatusForKhasra(
      point.k,
      mouzaFilter === 'all' ? null : mouzaFilter,
      statusMap,
      mozas,
      statusLookups
    ),
    [mouzaFilter, statusMap, mozas, statusLookups]
  );

  const mapStats = useMemo(() => {
    let registeredOnMap = 0;
    let possessedOnMap = 0;

    parcels.forEach((parcel) => {
      const resolved = resolveStatusForKhasra(parcel.k, null, statusMap, mozas, statusLookups);
      if (isErpTrackedKhasra(resolved?.status)) {
        if (resolved.status.possessionStatus === 'fully_possessed'
          || resolved.status.possessionStatus === 'partial_possession'
          || (resolved.status.possessed && (resolved.status.possessed.kanal > 0
            || resolved.status.possessed.marla > 0
            || resolved.status.possessed.sarsai > 0))) {
          possessedOnMap += 1;
        } else {
          registeredOnMap += 1;
        }
      }
    });

    return { registeredOnMap, possessedOnMap, erpOnMap: registeredOnMap + possessedOnMap };
  }, [parcels, statusMap, mozas, statusLookups]);

  const visibleParcels = useMemo(() => {
    let next = parcels;

    if (mouzaFilter !== 'all') {
      next = next.filter((parcel) => getResolvedStatus(parcel));
    }

    if (showRegistryOnly) {
      next = next.filter((parcel) => isErpTrackedKhasra(getResolvedStatus(parcel)?.status));
    }

    return next;
  }, [parcels, mouzaFilter, showRegistryOnly, getResolvedStatus]);

  const visibleParcelsGeoJson = useMemo(() => ({
    type: 'FeatureCollection',
    features: visibleParcels.map((parcel) => parcel.feature).filter(Boolean)
  }), [visibleParcels]);

  const changeZoom = useCallback((delta) => {
    const map = mapRef.current;
    if (!isMapUsable(map)) return;
    map.setZoom(map.getZoom() + delta);
  }, []);

  const resetView = useCallback(() => {
    const map = mapRef.current;
    const bounds = mapIndex?.bounds;
    if (!bounds) return;
    runWhenMapReady(map, (readyMap) => {
      readyMap.fitBounds(
        [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east]
        ],
        { padding: [24, 24], animate: false }
      );
    });
  }, [mapIndex]);

  const focusRegistryOnMap = useCallback(() => {
    const map = mapRef.current;
    const tracked = parcels
      .map((parcel) => ({ parcel, resolved: getResolvedStatus(parcel) }))
      .filter(({ resolved }) => isErpTrackedKhasra(resolved?.status));

    if (!tracked.length) return;

    runWhenMapReady(map, (readyMap) => {
      if (tracked.length === 1) {
        const { parcel } = tracked[0];
        readyMap.setView([parcel.lat, parcel.lng], 17, { animate: true });
        setSelectedParcel(parcel);
        return;
      }

      const bounds = L.latLngBounds(tracked.map(({ parcel }) => [parcel.lat, parcel.lng]));
      readyMap.fitBounds(bounds, { padding: [48, 48], maxZoom: 17, animate: true });
    });
  }, [parcels, getResolvedStatus]);

  const lineStyle = useMemo(
    () => ({
      color: '#f5f5f5',
      weight: 1,
      opacity: 0.85
    }),
    []
  );

  const openFullscreen = useCallback(() => {
    const node = containerRef.current;
    if (node?.requestFullscreen) node.requestFullscreen();
  }, []);

  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
    setMapReady(Boolean(map && isMapUsable(map)));
    if (map && !isMapUsable(map)) {
      map.whenReady(() => {
        if (isMapUsable(map)) setMapReady(true);
      });
    }
  }, []);

  const handleParcelClick = useCallback((event, parcel) => {
    L.DomEvent.stopPropagation(event);
    setSelectedParcel((prev) => (prev?.id === parcel.id ? null : parcel));
  }, []);

  const isTrackedKhasra = useCallback((khasraNo) => {
    const resolved = resolveStatusForKhasra(
      khasraNo,
      mouzaFilter === 'all' ? null : mouzaFilter,
      statusMap,
      mozas,
      statusLookups
    );
    return isErpTrackedKhasra(resolved?.status);
  }, [mouzaFilter, statusMap, mozas, statusLookups]);

  const parcelStyle = useCallback((feature) => {
    const parcel = { k: feature?.properties?.k };
    const resolved = resolveStatusForKhasra(
      parcel.k,
      mouzaFilter === 'all' ? null : mouzaFilter,
      statusMap,
      mozas,
      statusLookups
    );
    const statusRow = resolved?.status || null;
    const isSelected = selectedParcel?.k === parcel.k;

    return {
      color: strokeForStatus(statusRow, isSelected),
      fillColor: fillForStatus(statusRow),
      fillOpacity: fillOpacityForStatus(statusRow, isSelected),
      weight: isSelected ? 3 : isTrackedKhasra(parcel.k) ? 2 : 1,
      opacity: isTrackedKhasra(parcel.k) ? 1 : 0.65
    };
  }, [mouzaFilter, statusMap, mozas, statusLookups, selectedParcel, isTrackedKhasra]);

  const closeDetail = () => {
    setSelectedParcel(null);
  };

  const selectedResolved = selectedParcel ? getResolvedStatus(selectedParcel) : null;
  const selectedStatus = selectedResolved?.status || null;
  const selectedMouza = selectedResolved?.mouza || null;

  return (
    <Paper
      elevation={2}
      sx={{
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          background: 'linear-gradient(135deg, #f8fbff 0%, #eef6f1 100%)'
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Latha Land Map
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Registry &amp; possession from ERP shown as colored khasra parcels on the survey plan
            </Typography>
            {!loading && mapStats.erpOnMap > 0 && (
              <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={`${mapStats.registeredOnMap} registered on map`}
                />
                {mapStats.possessedOnMap > 0 && (
                  <Chip
                    size="small"
                    color="success"
                    variant="outlined"
                    label={`${mapStats.possessedOnMap} possessed on map`}
                  />
                )}
              </Stack>
            )}
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Tooltip title="Zoom out">
              <span>
                <IconButton size="small" onClick={() => changeZoom(-1)} disabled={loading || Boolean(loadError) || !mapReady}>
                  <ZoomOutIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Zoom in">
              <span>
                <IconButton size="small" onClick={() => changeZoom(1)} disabled={loading || Boolean(loadError) || !mapReady}>
                  <ZoomInIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Reset view">
              <span>
                <IconButton size="small" onClick={resetView} disabled={loading || Boolean(loadError) || !mapReady}>
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Fullscreen">
              <IconButton size="small" onClick={openFullscreen}>
                <FullscreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              variant={showRegistryOnly ? 'contained' : 'outlined'}
              color="primary"
              onClick={() => setShowRegistryOnly((prev) => !prev)}
            >
              {showRegistryOnly ? 'Showing registry only' : 'Show registry only'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              onClick={focusRegistryOnMap}
              disabled={loading || Boolean(loadError) || !mapReady || mapStats.erpOnMap === 0}
            >
              Focus registry
            </Button>
            <Button
              size="small"
              variant={baseLayer === 'satellite' ? 'contained' : 'outlined'}
              startIcon={<MapIcon />}
              onClick={() => setBaseLayer((prev) => (prev === 'satellite' ? 'street' : 'satellite'))}
            >
              {baseLayer === 'satellite' ? 'Satellite' : 'Street'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              href={KMZ_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download KMZ
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
          <LayersIcon fontSize="small" color="action" />
          <Chip
            size="small"
            label="All mouzas"
            color={mouzaFilter === 'all' ? 'primary' : 'default'}
            onClick={() => setMouzaFilter('all')}
            variant={mouzaFilter === 'all' ? 'filled' : 'outlined'}
          />
          {mouzaChips.map((slug) => (
            <Chip
              key={slug}
              size="small"
              label={MOUZA_LABELS[slug] || slug}
              color={mouzaFilter === slug ? 'primary' : 'default'}
              onClick={() => setMouzaFilter(slug)}
              variant={mouzaFilter === slug ? 'filled' : 'outlined'}
            />
          ))}
        </Stack>
      </Box>

      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          height: { xs: '58vh', md: '70vh' },
          bgcolor: '#1a1a1a',
          overflow: 'hidden',
          '& .leaflet-container': {
            height: '100%',
            width: '100%',
            zIndex: 0,
            background: '#1a1a1a'
          },
          '& .latha-khasra-label': {
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            color: 'rgba(255,255,255,0.75)',
            fontWeight: 600,
            fontSize: '10px',
            lineHeight: 1,
            textShadow: '0 0 4px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.95)',
            pointerEvents: 'none'
          },
          '& .latha-khasra-label--tracked': {
            color: '#fff',
            fontWeight: 800,
            fontSize: '11px'
          }
        }}
      >
        {loading && (
          <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Loading Khasra plan &amp; land status…
            </Typography>
          </Stack>
        )}

        {!loading && loadError && (
          <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', px: 3 }}>
            <Typography color="error" align="center">{loadError}</Typography>
          </Stack>
        )}

        {!loading && !loadError && mapIndex && (
          <MapContainer
            center={mapIndex.bounds.center}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={mapReady}
            zoomControl={false}
            preferCanvas
          >
            <MapController onReady={handleMapReady} />
            <MapBounds bounds={mapIndex.bounds} />
            <TileLayer
              attribution={
                baseLayer === 'satellite'
                  ? 'Tiles &copy; Esri'
                  : '&copy; OpenStreetMap contributors'
              }
              url={baseLayer === 'satellite' ? SATELLITE_URL : STREET_URL}
            />
            {lines && <GeoJSON data={lines} style={lineStyle} />}
            {visibleParcelsGeoJson.features.length > 0 && (
              <KhasraParcelLayer
                data={visibleParcelsGeoJson}
                getStyle={parcelStyle}
                onParcelClick={handleParcelClick}
                isTrackedKhasra={isTrackedKhasra}
              />
            )}
          </MapContainer>
        )}

        {selectedParcel && (
          <Paper
            elevation={4}
            data-map-popover
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 1000,
              p: 2,
              maxWidth: 320,
              borderRadius: 2
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  {selectedParcel.k ? `Khasra ${selectedParcel.k}` : 'Land parcel'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                  {selectedMouza ? (MOUZA_LABELS[selectedMouza] || selectedMouza) : 'No mouza match in ERP'}
                </Typography>
              </Box>
              <IconButton size="small" onClick={closeDetail} aria-label="Close details">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
            {selectedStatus ? (
              <Stack spacing={0.75}>
                <Typography variant="body2">
                  <strong>Khewat:</strong> {selectedStatus.khewatNo}
                </Typography>
                <Typography variant="body2">
                  <strong>Baseline:</strong> {formatKMS(normalizeArea(selectedStatus.baseline))}
                </Typography>
                <Typography variant="body2" color="primary.main">
                  <strong>Registered:</strong> {formatKMS(normalizeArea(selectedStatus.registered))}
                </Typography>
                <Typography variant="body2" color="success.main">
                  <strong>Possessed:</strong> {formatKMS(normalizeArea(selectedStatus.possessed))}
                </Typography>
                <Chip
                  size="small"
                  label={selectedStatus.possessionStatus.replace(/_/g, ' ')}
                  color={
                    selectedStatus.possessionStatus === 'fully_possessed'
                      ? 'success'
                      : selectedStatus.possessionStatus === 'partial_possession'
                        ? 'warning'
                        : 'default'
                  }
                  sx={{ mt: 0.5, textTransform: 'capitalize' }}
                />
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                {formatStatusSummary(null)}
              </Typography>
            )}
          </Paper>
        )}
      </Box>

      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default'
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Color legend — khasra parcels are filled: blue = registered, green = possessed, gray = not registered
        </Typography>
        <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
          {STATUS_LEGEND.map((item) => (
            <Stack key={item.id} direction="row" spacing={0.75} alignItems="center">
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: 0.5,
                  bgcolor: item.fill,
                  border: `2px solid ${item.color}`,
                  flexShrink: 0
                }}
              />
              <Typography variant="caption">{item.label}</Typography>
            </Stack>
          ))}
        </Stack>
        {mapIndex && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {visibleParcels.length.toLocaleString()} khasra parcels shown
            {mapStats.erpOnMap > 0 ? ` · ${mapStats.erpOnMap.toLocaleString()} colored from ERP registry/possession` : ' · no ERP matches on map yet'}
            {mapIndex.counts?.parcels ? ` · ${mapIndex.counts.parcels.toLocaleString()} parcel shapes from KMZ` : ''}
            {showRegistryOnly ? ' · registry-only filter active' : ''}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default LathaMapViewer;
