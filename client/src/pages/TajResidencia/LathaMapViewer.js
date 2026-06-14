import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
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
  formatTransferPercentLabel,
  formatStatusSummary,
  hasPossessionTransfer,
  hasRegistryTransfer,
  khasraLabelClassForStatus,
  normalizeKhasraNo,
  possessionCoverageFraction,
  registryCoverageFraction,
  resolveStatusForKhasra,
  strokeForStatus
} from '../../utils/lathaMapStatus';
import { clipPolygonBottomFraction, clipPolygonTopFraction } from '../../utils/lathaMapGeometry';
import { formatKMS, normalizeArea } from '../../utils/landAreaUnits';

const MAP_BASE = `${process.env.PUBLIC_URL}/maps/latha`;
const MAP_INDEX_URL = `${MAP_BASE}/khasra-map-index.json`;
const MOZA_KHASRAS_INDEX_URL = `${MAP_BASE}/moza-khasras-index.json`;
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
  getLabelClass,
  getTooltipLabel
}) => {
  const map = useMap();
  const layerRef = useRef(null);
  const styleRef = useRef(getStyle);
  const clickRef = useRef(onParcelClick);
  const labelClassRef = useRef(getLabelClass);
  const tooltipRef = useRef(getTooltipLabel);

  styleRef.current = getStyle;
  clickRef.current = onParcelClick;
  labelClassRef.current = getLabelClass;
  tooltipRef.current = getTooltipLabel;

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
        const labelClass = labelClassRef.current(feature.properties?.k);
        const tooltipLabel = tooltipRef.current?.(feature.properties?.k) || `Khasra ${label}`;
        const isTracked = labelClass.includes('--registered') || labelClass.includes('--possessed');

        if (isTracked) {
          leafletLayer.bindTooltip(tooltipLabel, {
            permanent: true,
            direction: 'center',
            className: labelClass,
            opacity: 1
          });
        } else {
          leafletLayer.bindTooltip(tooltipLabel, {
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

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !tooltipRef.current) return;

    layer.eachLayer((leafletLayer) => {
      if (!leafletLayer.feature) return;

      const khasraNo = leafletLayer.feature.properties?.k;
      const labelClass = labelClassRef.current(khasraNo);
      const tooltipLabel = tooltipRef.current(khasraNo) || `Khasra ${khasraNo}`;
      const isTracked = labelClass.includes('--registered') || labelClass.includes('--possessed');

      leafletLayer.unbindTooltip();
      if (isTracked) {
        leafletLayer.bindTooltip(tooltipLabel, {
          permanent: true,
          direction: 'center',
          className: labelClass,
          opacity: 1
        });
      } else {
        leafletLayer.bindTooltip(tooltipLabel, {
          sticky: true,
          direction: 'top',
          opacity: 0.95
        });
      }
    });
  }, [getTooltipLabel, getLabelClass]);

  return null;
};

const KhasraPartialFillLayer = ({ data, getStyle, onParcelClick }) => {
  const map = useMap();
  const layerRef = useRef(null);
  const styleRef = useRef(getStyle);
  const clickRef = useRef(onParcelClick);

  styleRef.current = getStyle;
  clickRef.current = onParcelClick;

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
  const [mozaKhasrasIndex, setMozaKhasrasIndex] = useState(null);
  const [mozas, setMozas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [mouzaFilter, setMouzaFilter] = useState('all');
  const [baseLayer, setBaseLayer] = useState('satellite');
  const [showRegistryLayer, setShowRegistryLayer] = useState(true);
  const [showPossessionLayer, setShowPossessionLayer] = useState(true);
  const [selectedParcel, setSelectedParcel] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [indexRes, statusRes, mozaKhasrasRes] = await Promise.all([
          fetch(MAP_INDEX_URL).then((r) => {
            if (!r.ok) {
              throw new Error('Khasra map index not found. Run scripts/extract-khasra-kmz.py');
            }
            return r.json();
          }),
          getMapStatus(),
          fetch(MOZA_KHASRAS_INDEX_URL).then((r) => (r.ok ? r.json() : { mozas: {} }))
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
        setMozaKhasrasIndex(mozaKhasrasRes);
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
    const fromIndex = Object.keys(mozaKhasrasIndex?.mozas || {});
    const fromErp = mozas.map((m) => m.slug);
    return [...new Set([...fromIndex, ...fromErp])].sort();
  }, [mozas, mozaKhasrasIndex]);

  const mouzaKhasraSets = useMemo(() => {
    const sets = {};

    Object.entries(mozaKhasrasIndex?.mozas || {}).forEach(([slug, list]) => {
      sets[slug] = new Set(
        (list || []).map((khasraNo) => normalizeKhasraNo(khasraNo)).filter(Boolean)
      );
    });

    Object.keys(statusMap).forEach((key) => {
      const sep = key.indexOf(':');
      if (sep === -1) return;
      const slug = key.slice(0, sep);
      const khasra = normalizeKhasraNo(key.slice(sep + 1));
      if (!khasra) return;
      if (!sets[slug]) sets[slug] = new Set();
      sets[slug].add(khasra);
    });

    return sets;
  }, [mozaKhasrasIndex, statusMap]);

  const getResolvedStatusForMouza = useCallback(
    (point, slug) => resolveStatusForKhasra(
      point.k,
      slug === 'all' ? null : slug,
      statusMap,
      mozas,
      statusLookups
    ),
    [statusMap, mozas, statusLookups]
  );

  const parcelBelongsToMouza = useCallback((parcel, slug) => {
    if (!slug || slug === 'all') return true;
    const khasraSet = mouzaKhasraSets[slug];
    if (!khasraSet?.size) return Boolean(getResolvedStatusForMouza(parcel, slug));
    return khasraSet.has(normalizeKhasraNo(parcel.k));
  }, [mouzaKhasraSets, getResolvedStatusForMouza]);

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
    let erpOnMap = 0;

    parcels.forEach((parcel) => {
      if (mouzaFilter !== 'all' && !parcelBelongsToMouza(parcel, mouzaFilter)) return;

      const resolved = resolveStatusForKhasra(
        parcel.k,
        mouzaFilter === 'all' ? null : mouzaFilter,
        statusMap,
        mozas,
        statusLookups
      );
      const status = resolved?.status;
      if (hasPossessionTransfer(status)) possessedOnMap += 1;
      if (hasRegistryTransfer(status)) registeredOnMap += 1;
      if (hasRegistryTransfer(status) || hasPossessionTransfer(status)) erpOnMap += 1;
    });

    return { registeredOnMap, possessedOnMap, erpOnMap };
  }, [parcels, mouzaFilter, statusMap, mozas, statusLookups, parcelBelongsToMouza]);

  const matchesRegistryLayer = useCallback((status) => (
    hasRegistryTransfer(status)
  ), []);

  const matchesPossessionLayer = useCallback((status) => (
    hasPossessionTransfer(status)
  ), []);

  const matchesActiveLayer = useCallback((status) => (
    (showRegistryLayer && matchesRegistryLayer(status))
    || (showPossessionLayer && matchesPossessionLayer(status))
  ), [showRegistryLayer, showPossessionLayer, matchesRegistryLayer, matchesPossessionLayer]);

  const anyErpLayerOn = showRegistryLayer || showPossessionLayer;

  const visibleParcels = useMemo(() => {
    let next = parcels;

    if (mouzaFilter !== 'all') {
      next = next.filter((parcel) => parcelBelongsToMouza(parcel, mouzaFilter));
    }

    return next;
  }, [parcels, mouzaFilter, parcelBelongsToMouza]);

  useEffect(() => {
    if (!mapReady || !mapIndex?.bounds) return undefined;

    const map = mapRef.current;
    if (!map) return undefined;

    const timer = window.setTimeout(() => {
      if (mouzaFilter === 'all') {
        const { south, west, north, east } = mapIndex.bounds;
        runWhenMapReady(map, (readyMap) => {
          readyMap.fitBounds(
            [[south, west], [north, east]],
            { padding: [24, 24], animate: true }
          );
        });
        return;
      }

      if (visibleParcels.length === 0) return;

      runWhenMapReady(map, (readyMap) => {
        if (visibleParcels.length === 1) {
          const [parcel] = visibleParcels;
          readyMap.setView([parcel.lat, parcel.lng], 17, { animate: true });
          return;
        }

        const bounds = L.latLngBounds(visibleParcels.map((parcel) => [parcel.lat, parcel.lng]));
        readyMap.fitBounds(bounds, { padding: [48, 48], maxZoom: 17, animate: true });
      });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [mouzaFilter, visibleParcels, mapReady, mapIndex]);

  const visibleParcelsGeoJson = useMemo(() => ({
    type: 'FeatureCollection',
    features: visibleParcels.map((parcel) => parcel.feature).filter(Boolean)
  }), [visibleParcels]);

  const registryFillGeoJson = useMemo(() => {
    if (!showRegistryLayer) {
      return { type: 'FeatureCollection', features: [] };
    }

    const features = visibleParcels.flatMap((parcel) => {
      if (!parcel.feature?.geometry) return [];
      const status = getResolvedStatus(parcel)?.status;
      if (!matchesRegistryLayer(status)) return [];

      const fraction = registryCoverageFraction(status);
      const geometry = clipPolygonBottomFraction(parcel.feature.geometry, fraction);
      if (!geometry) return [];

      return [{
        type: 'Feature',
        properties: {
          ...parcel.feature.properties,
          k: parcel.k,
          layer: 'registry',
          coveragePct: Math.round(fraction * 100)
        },
        geometry
      }];
    });

    return { type: 'FeatureCollection', features };
  }, [visibleParcels, showRegistryLayer, getResolvedStatus, matchesRegistryLayer]);

  const possessionFillGeoJson = useMemo(() => {
    if (!showPossessionLayer) {
      return { type: 'FeatureCollection', features: [] };
    }

    const features = visibleParcels.flatMap((parcel) => {
      if (!parcel.feature?.geometry) return [];
      const status = getResolvedStatus(parcel)?.status;
      if (!matchesPossessionLayer(status)) return [];

      const fraction = possessionCoverageFraction(status);
      const geometry = clipPolygonTopFraction(parcel.feature.geometry, fraction);
      if (!geometry) return [];

      return [{
        type: 'Feature',
        properties: {
          ...parcel.feature.properties,
          k: parcel.k,
          layer: 'possession',
          coveragePct: Math.round(fraction * 100)
        },
        geometry
      }];
    });

    return { type: 'FeatureCollection', features };
  }, [visibleParcels, showPossessionLayer, getResolvedStatus, matchesPossessionLayer]);

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

  const focusErpOnMap = useCallback(() => {
    const map = mapRef.current;
    const tracked = parcels
      .map((parcel) => ({ parcel, resolved: getResolvedStatus(parcel) }))
      .filter(({ resolved }) => matchesRegistryLayer(resolved?.status));

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
  }, [parcels, getResolvedStatus, matchesRegistryLayer]);

  const focusPossessionOnMap = useCallback(() => {
    const map = mapRef.current;
    const tracked = parcels
      .map((parcel) => ({ parcel, resolved: getResolvedStatus(parcel) }))
      .filter(({ resolved }) => matchesPossessionLayer(resolved?.status));

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
  }, [parcels, getResolvedStatus, matchesPossessionLayer]);

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

  const getKhasraLabelClass = useCallback((khasraNo) => {
    const resolved = resolveStatusForKhasra(
      khasraNo,
      mouzaFilter === 'all' ? null : mouzaFilter,
      statusMap,
      mozas,
      statusLookups
    );
    const status = resolved?.status;
    if (showPossessionLayer && matchesPossessionLayer(status)) {
      return khasraLabelClassForStatus(status);
    }
    if (showRegistryLayer && matchesRegistryLayer(status)) {
      return khasraLabelClassForStatus(status);
    }
    return 'latha-khasra-label';
  }, [
    mouzaFilter,
    statusMap,
    mozas,
    statusLookups,
    showRegistryLayer,
    showPossessionLayer,
    matchesRegistryLayer,
    matchesPossessionLayer
  ]);

  const getTooltipLabel = useCallback((khasraNo) => {
    const resolved = resolveStatusForKhasra(
      khasraNo,
      mouzaFilter === 'all' ? null : mouzaFilter,
      statusMap,
      mozas,
      statusLookups
    );
    const status = resolved?.status;
    const lines = [String(khasraNo)];
    const coverageParts = [];

    if (showRegistryLayer && matchesRegistryLayer(status)) {
      coverageParts.push(`Reg ${formatTransferPercentLabel(status.registryTransferPercent)}`);
    }
    if (showPossessionLayer && matchesPossessionLayer(status)) {
      coverageParts.push(`Pos ${formatTransferPercentLabel(status.possessionTransferPercent)}`);
    }

    if (coverageParts.length) {
      lines.push(coverageParts.join(' · '));
    }

    return lines.join('\n');
  }, [
    mouzaFilter,
    statusMap,
    mozas,
    statusLookups,
    showRegistryLayer,
    showPossessionLayer,
    matchesRegistryLayer,
    matchesPossessionLayer
  ]);

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
    const highlighted = anyErpLayerOn && matchesActiveLayer(statusRow);

    if (!highlighted) {
      return {
        color: 'rgba(120,120,120,0.35)',
        fillColor: 'rgba(224, 224, 224, 0.2)',
        fillOpacity: isSelected ? 0.45 : 0.1,
        weight: isSelected ? 3 : 1,
        opacity: 0.65
      };
    }

    return {
      color: strokeForStatus(statusRow, isSelected),
      fillColor: 'transparent',
      fillOpacity: 0,
      weight: isSelected ? 3 : 2,
      opacity: 1
    };
  }, [
    mouzaFilter,
    statusMap,
    mozas,
    statusLookups,
    selectedParcel,
    anyErpLayerOn,
    matchesActiveLayer
  ]);

  const registryFillStyle = useCallback(() => ({
    color: 'rgba(21, 101, 192, 0.9)',
    fillColor: 'rgba(21, 101, 192, 0.72)',
    fillOpacity: 0.78,
    weight: 1,
    opacity: 0.95
  }), []);

  const possessionFillStyle = useCallback((feature) => {
    const resolved = resolveStatusForKhasra(
      feature?.properties?.k,
      mouzaFilter === 'all' ? null : mouzaFilter,
      statusMap,
      mozas,
      statusLookups
    );
    const statusRow = resolved?.status || null;
    const isSelected = selectedParcel?.k === feature?.properties?.k;

    return {
      color: strokeForStatus(statusRow, isSelected),
      fillColor: fillForStatus(statusRow),
      fillOpacity: fillOpacityForStatus(statusRow, isSelected),
      weight: 1,
      opacity: 0.95
    };
  }, [mouzaFilter, statusMap, mozas, statusLookups, selectedParcel]);

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
              Map fill uses Transfer % from registry &amp; possession records
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
              variant="outlined"
              color="primary"
              onClick={focusErpOnMap}
              disabled={
                loading
                || Boolean(loadError)
                || !mapReady
                || !showRegistryLayer
                || mapStats.registeredOnMap === 0
              }
            >
              Focus registry
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="success"
              onClick={focusPossessionOnMap}
              disabled={
                loading
                || Boolean(loadError)
                || !mapReady
                || !showPossessionLayer
                || mapStats.possessedOnMap === 0
              }
            >
              Focus possession
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
          <FormControlLabel
            control={(
              <Checkbox
                size="small"
                checked={showRegistryLayer}
                onChange={(event) => setShowRegistryLayer(event.target.checked)}
                sx={{ color: '#1565C0', '&.Mui-checked': { color: '#1565C0' } }}
              />
            )}
            label={(
              <Typography variant="body2" fontWeight={showRegistryLayer ? 600 : 400}>
                Registry
              </Typography>
            )}
            sx={{ mr: 0.5 }}
          />
          <FormControlLabel
            control={(
              <Checkbox
                size="small"
                checked={showPossessionLayer}
                onChange={(event) => setShowPossessionLayer(event.target.checked)}
                sx={{ color: '#2E7D32', '&.Mui-checked': { color: '#2E7D32' } }}
              />
            )}
            label={(
              <Typography variant="body2" fontWeight={showPossessionLayer ? 600 : 400}>
                Possession
              </Typography>
            )}
            sx={{ mr: 1 }}
          />
          <Box sx={{ width: '1px', height: 24, bgcolor: 'divider', mx: 0.5, display: { xs: 'none', sm: 'block' } }} />
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
            lineHeight: 1.2,
            whiteSpace: 'pre-line',
            textAlign: 'center',
            textShadow: '0 0 4px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.95)',
            pointerEvents: 'none'
          },
          '& .latha-khasra-label--registered': {
            color: '#fff',
            fontWeight: 800,
            fontSize: '11px',
            textShadow: '0 0 4px rgba(13,71,161,0.95), 0 0 2px rgba(0,0,0,0.95)'
          },
          '& .latha-khasra-label--possessed': {
            color: '#fff',
            fontWeight: 800,
            fontSize: '11px',
            textShadow: '0 0 4px rgba(27,94,32,0.95), 0 0 2px rgba(0,0,0,0.95)'
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
            {registryFillGeoJson.features.length > 0 && (
              <KhasraPartialFillLayer
                data={registryFillGeoJson}
                getStyle={registryFillStyle}
                onParcelClick={handleParcelClick}
              />
            )}
            {possessionFillGeoJson.features.length > 0 && (
              <KhasraPartialFillLayer
                data={possessionFillGeoJson}
                getStyle={possessionFillStyle}
                onParcelClick={handleParcelClick}
              />
            )}
            {visibleParcelsGeoJson.features.length > 0 && (
              <KhasraParcelLayer
                data={visibleParcelsGeoJson}
                getStyle={parcelStyle}
                onParcelClick={handleParcelClick}
                getLabelClass={getKhasraLabelClass}
                getTooltipLabel={getTooltipLabel}
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
                  <strong>Registered:</strong>{' '}
                  {formatKMS(normalizeArea(selectedStatus.registered))}
                  {' · Transfer '}
                  {formatTransferPercentLabel(selectedStatus.registryTransferPercent)}
                </Typography>
                <Typography variant="body2" color="success.main">
                  <strong>Possessed:</strong>{' '}
                  {formatKMS(normalizeArea(selectedStatus.possessed))}
                  {' · Transfer '}
                  {formatTransferPercentLabel(selectedStatus.possessionTransferPercent)}
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
          Fill height = Transfer % from ERP record — registry from bottom (blue), possession from top (green/orange/teal)
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
            {mouzaFilter !== 'all' ? ` · ${MOUZA_LABELS[mouzaFilter] || mouzaFilter}` : ''}
            {anyErpLayerOn
              ? ` · ${[
                showRegistryLayer ? `${mapStats.registeredOnMap.toLocaleString()} registry` : null,
                showPossessionLayer ? `${mapStats.possessedOnMap.toLocaleString()} possession` : null
              ].filter(Boolean).join(' + ')} on map`
              : ' · survey plan only (check Registry or Possession to show ERP data)'}
            {mapIndex.counts?.parcels ? ` · ${mapIndex.counts.parcels.toLocaleString()} parcel shapes from KMZ` : ''}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default LathaMapViewer;
