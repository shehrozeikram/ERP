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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  TextField,
  Autocomplete,
  InputAdornment
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as RestartAltIcon,
  Fullscreen as FullscreenIcon,
  Layers as LayersIcon,
  Map as MapIcon,
  Close as CloseIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getMapStatus, getPartyKhasras } from '../../services/landAcquisitionMapService';
import landAcquisitionPartyService from '../../services/landAcquisitionPartyService';
import {
  STATUS_LEGEND,
  buildStatusLookups,
  fillForStatus,
  fillOpacityForStatus,
  formatTransferPercentLabel,
  formatStatusSummary,
  hasPossessionOnMap,
  hasRegistryOnMap,
  khasraLabelClassForStatus,
  normalizeKhasraNo,
  possessionCoverageFraction,
  registryCoverageFraction,
  resolveStatusForKhasra,
  strokeForStatus,
  getErpSlugsForMapMoza
} from '../../utils/lathaMapStatus';
import { clipPolygonBottomFraction, clipPolygonTopFraction } from '../../utils/lathaMapGeometry';
import { formatKMS, normalizeArea } from '../../utils/landAreaUnits';
import {
  buildMouzaOuterBoundaryGeoJson,
  getMouzaHighlightColor
} from '../../utils/lathaMapLineHighlight';

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
  'kot-kolian': 'Mouza Kot Kolian',
  unknown: 'Other / Unmapped'
};

const formatCount = (value) => Number(value ?? 0).toLocaleString();

const parcelIdForFeature = (feature, idx = 0) => {
  const k = feature?.properties?.k ?? idx;
  const moza = feature?.properties?.moza;
  return moza ? `khasra-${moza}-${k}` : `khasra-${k}`;
};

const SATELLITE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const STREET_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const isMapUsable = (map) => Boolean(
  map
  && map._loaded
  && map._mapPane
  && map.getContainer?.()
  && map.getPanes?.()?.mapPane
);

const safeRemoveLayer = (map, layer) => {
  if (!layer || !isMapUsable(map)) return;
  try {
    map.removeLayer(layer);
  } catch {
    // Map may be tearing down while React unmounts overlay layers.
  }
};

const safeRestyleGeoJsonLayer = (map, layer, styleFn) => {
  if (!layer || !isMapUsable(map)) return;
  try {
    layer.eachLayer((leafletLayer) => {
      if (leafletLayer.feature) {
        leafletLayer.setStyle(styleFn(leafletLayer.feature));
      }
    });
  } catch {
    // Canvas/SVG renderer can be gone during rapid mouza filter changes.
  }
};

const runWhenMapReady = (map, fn) => {
  if (!map) return;
  if (isMapUsable(map)) {
    try {
      fn(map);
    } catch {}
    return;
  }
  map.whenReady(() => {
    if (isMapUsable(map)) {
      try {
        fn(map);
      } catch {}
    }
  });
};

const MapBounds = ({ bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (!bounds) return;
    runWhenMapReady(map, (readyMap) => {
      try {
        readyMap.fitBounds(
          [
            [bounds.south, bounds.west],
            [bounds.north, bounds.east]
          ],
          { padding: [50, 50], animate: false }
        );
      } catch {}
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
  getTooltipLabel,
  selectedParcelId,
  partyFilterId,
  isParcelInPartyTarget
}) => {
  const map = useMap();
  const layerRef = useRef(null);
  const styleRef = useRef(getStyle);
  const clickRef = useRef(onParcelClick);
  const labelClassRef = useRef(getLabelClass);
  const tooltipRef = useRef(getTooltipLabel);
  const selectedIdRef = useRef(selectedParcelId);
  const partyFilterIdRef = useRef(partyFilterId);
  const isPartyTargetRef = useRef(isParcelInPartyTarget);

  styleRef.current = getStyle;
  clickRef.current = onParcelClick;
  labelClassRef.current = getLabelClass;
  tooltipRef.current = getTooltipLabel;
  selectedIdRef.current = selectedParcelId;
  partyFilterIdRef.current = partyFilterId;
  isPartyTargetRef.current = isParcelInPartyTarget;

  useEffect(() => {
    if (!data?.features?.length) return undefined;

    const layer = L.geoJSON(data, {
      style: (feature) => styleRef.current(feature),
      onEachFeature: (feature, leafletLayer) => {
        const parcel = {
          id: parcelIdForFeature(feature),
          k: feature.properties?.k,
          moza: feature.properties?.moza || null,
          lat: feature.properties?.cy,
          lng: feature.properties?.cx,
          feature
        };

        leafletLayer.on('click', (event) => clickRef.current(event, parcel));

        const label = String(feature.properties?.k || '');
        const moza = feature.properties?.moza || null;
        const tooltipLabel = tooltipRef.current?.(feature.properties?.k, moza) || `Khasra ${label}`;
        const isSelected = selectedIdRef.current === parcel.id;
        const isPartyMatch = Boolean(partyFilterIdRef.current && isPartyTargetRef.current?.(feature.properties?.k, moza));

        if (isSelected) {
          leafletLayer.bindTooltip(label, {
            permanent: true,
            direction: 'center',
            className: 'latha-khasra-label latha-khasra-label--selected',
            opacity: 1
          });
        } else if (isPartyMatch) {
          leafletLayer.bindTooltip(label, {
            permanent: true,
            direction: 'center',
            className: 'latha-khasra-label latha-khasra-label--party',
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
      safeRemoveLayer(map, layer);
    };
  }, [map, data]);

  useEffect(() => {
    safeRestyleGeoJsonLayer(map, layerRef.current, (feature) => styleRef.current(feature));
  }, [getStyle, map]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !tooltipRef.current) return;

    layer.eachLayer((leafletLayer) => {
      if (!leafletLayer.feature) return;

      const khasraNo = leafletLayer.feature.properties?.k;
      const moza = leafletLayer.feature.properties?.moza || null;
      const fId = parcelIdForFeature(leafletLayer.feature);
      const isSelected = selectedParcelId === fId;
      const isPartyMatch = Boolean(partyFilterId && isParcelInPartyTarget?.(khasraNo, moza));
      const tooltipLabel = tooltipRef.current(khasraNo, moza) || `Khasra ${khasraNo}`;

      leafletLayer.unbindTooltip();
      if (isSelected) {
        leafletLayer.bindTooltip(String(khasraNo || ''), {
          permanent: true,
          direction: 'center',
          className: 'latha-khasra-label latha-khasra-label--selected',
          opacity: 1
        });
      } else if (isPartyMatch) {
        leafletLayer.bindTooltip(String(khasraNo || ''), {
          permanent: true,
          direction: 'center',
          className: 'latha-khasra-label latha-khasra-label--party',
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
  }, [getTooltipLabel, selectedParcelId, partyFilterId, isParcelInPartyTarget]);

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
          id: parcelIdForFeature(feature),
          k: feature.properties?.k,
          moza: feature.properties?.moza || null,
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
      safeRemoveLayer(map, layer);
    };
  }, [map, data]);

  useEffect(() => {
    safeRestyleGeoJsonLayer(map, layerRef.current, (feature) => styleRef.current(feature));
  }, [getStyle, map]);

  return null;
};

const KhasraLineLayer = ({ data, getStyle }) => {
  const map = useMap();
  const layerRef = useRef(null);
  const styleRef = useRef(getStyle);
  const rendererRef = useRef(null);

  styleRef.current = getStyle;

  useEffect(() => {
    if (!data?.features?.length || !isMapUsable(map)) return undefined;

    if (!rendererRef.current) {
      rendererRef.current = L.svg({ padding: 0.5 });
    }

    const layer = L.geoJSON(data, {
      style: (feature) => styleRef.current(feature),
      interactive: false,
      renderer: rendererRef.current
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      layerRef.current = null;
      safeRemoveLayer(map, layer);
    };
  }, [map, data]);

  useEffect(() => {
    let frameId = 0;
    frameId = window.requestAnimationFrame(() => {
      safeRestyleGeoJsonLayer(map, layerRef.current, (feature) => styleRef.current(feature));
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [getStyle, map]);

  return null;
};

const LathaMapViewer = () => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  const [mapIndex, setMapIndex] = useState(null);
  const [parcels, setParcels] = useState([]);
  const [lines, setLines] = useState(null);
  const [statusMap, setStatusMap] = useState({});
  const [recordsByMoza, setRecordsByMoza] = useState({});
  const [mozaKhasrasIndex, setMozaKhasrasIndex] = useState(null);
  const [mozas, setMozas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [mouzaFilter, setMouzaFilter] = useState('all');
  const [baseLayer, setBaseLayer] = useState('street');

  // Party Filter State
  const [partyRoleFilter, setPartyRoleFilter] = useState('');
  const [partyList, setPartyList] = useState([]);
  const [partyFilterId, setPartyFilterId] = useState('');
  const [partyKhasras, setPartyKhasras] = useState([]);

  useEffect(() => {
    const params = { isActive: true };
    if (partyRoleFilter && partyRoleFilter !== 'all') {
      params.type = partyRoleFilter;
    }
    landAcquisitionPartyService.getParties(params)
      .then((res) => {
        if (res.success) setPartyList(res.data);
      })
      .catch((err) => console.error('Failed to load parties:', err));
  }, [partyRoleFilter]);

  useEffect(() => {
    if (!partyFilterId) {
      setPartyKhasras([]);
      return;
    }
    getPartyKhasras(partyFilterId)
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setPartyKhasras(res.data);
          
          // Animate camera to fit party's khasras
          const matched = parcels.filter((p) => {
            const norm = normalizeKhasraNo(p.k);
            return res.data.includes(norm) || (p.moza && res.data.includes(`${p.moza}:${norm}`));
          });

          if (matched.length > 0 && mapRef.current && isMapUsable(mapRef.current)) {
            const map = mapRef.current;
            if (matched.length === 1) {
              map.flyTo([matched[0].lat, matched[0].lng], 17, { duration: 1.2 });
            } else {
              const bounds = L.latLngBounds(matched.map((p) => [p.lat, p.lng]));
              map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 17, duration: 1.2 });
            }
          }
        }
      })
      .catch((err) => console.error('Failed to load party khasras:', err));
  }, [partyFilterId, parcels]);
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
        setMozas(statusRes.data?.mozas || []);
        setStatusMap(statusRes.data?.status || {});
        setRecordsByMoza(statusRes.data?.recordsByMoza || {});
        setLines(linesRes);

        if (parcelsRes?.features?.[0]?.geometry?.type === 'Polygon') {
          setParcels(
            (parcelsRes.features || []).map((feature, idx) => ({
              id: parcelIdForFeature(feature, idx),
              k: feature.properties?.k,
              moza: feature.properties?.moza || null,
              lat: feature.properties?.cy,
              lng: feature.properties?.cx,
              feature
            }))
          );
        } else {
          setParcels(
            (parcelsRes?.features || []).map((feature, idx) => ({
              id: parcelIdForFeature(feature, idx),
              k: feature.properties?.k,
              moza: feature.properties?.moza || null,
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
    if (parcel.moza) {
      if (parcel.moza === slug) return true;
      const matchingSlugs = getErpSlugsForMapMoza(parcel.moza, mozas);
      if (matchingSlugs.includes(slug)) return true;
      return false;
    }
    const khasraSet = mouzaKhasraSets[slug];
    if (!khasraSet?.size) return Boolean(getResolvedStatusForMouza(parcel, slug));
    return khasraSet.has(normalizeKhasraNo(parcel.k));
  }, [mouzaKhasraSets, getResolvedStatusForMouza, mozas]);

  const getResolvedStatus = useCallback(
    (point) => resolveStatusForKhasra(
      point.k,
      point.moza || (mouzaFilter === 'all' ? null : mouzaFilter),
      statusMap,
      mozas,
      statusLookups
    ),
    [mouzaFilter, statusMap, mozas, statusLookups]
  );

  const mapStats = useMemo(() => {
    let registryDocuments = 0;
    let possessionDocuments = 0;
    let khasrasWithRegistry = 0;
    let khasrasWithPossession = 0;

    if (mouzaFilter === 'all') {
      Object.values(recordsByMoza).forEach((row) => {
        registryDocuments += row?.registryCount || 0;
        possessionDocuments += row?.possessionCount || 0;
      });
    } else {
      const row = recordsByMoza[mouzaFilter] || {};
      registryDocuments = row.registryCount || 0;
      possessionDocuments = row.possessionCount || 0;
    }

    Object.entries(statusMap).forEach(([key, row]) => {
      const sep = key.indexOf(':');
      if (sep === -1) return;
      const slug = key.slice(0, sep);
      if (mouzaFilter !== 'all' && slug !== mouzaFilter) return;
      if (hasRegistryOnMap(row)) khasrasWithRegistry += 1;
      if (hasPossessionOnMap(row)) khasrasWithPossession += 1;
    });

    return {
      registryDocuments,
      possessionDocuments,
      khasrasWithRegistry,
      khasrasWithPossession,
      erpOnMap: khasrasWithRegistry + khasrasWithPossession
    };
  }, [mouzaFilter, statusMap, recordsByMoza]);

  const stats = useMemo(
    () => ({
      registryDocuments: Number(mapStats?.registryDocuments) || 0,
      possessionDocuments: Number(mapStats?.possessionDocuments) || 0,
      khasrasWithRegistry: Number(mapStats?.khasrasWithRegistry) || 0,
      khasrasWithPossession: Number(mapStats?.khasrasWithPossession) || 0,
      erpOnMap: Number(mapStats?.erpOnMap) || 0
    }),
    [mapStats]
  );

  const matchesRegistryLayer = useCallback((status) => (
    hasRegistryOnMap(status)
  ), []);

  const matchesPossessionLayer = useCallback((status) => (
    hasPossessionOnMap(status)
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

  const allMouzaBoundariesGeoJson = useMemo(() => {
    if (mouzaFilter !== 'all' || !mouzaChips?.length) return [];
    
    return mouzaChips.map((slug) => {
      const mouzaParcels = parcels.filter((p) => parcelBelongsToMouza(p, slug));
      const boundaryGeoJson = buildMouzaOuterBoundaryGeoJson(mouzaParcels);
      return {
        slug,
        color: getMouzaHighlightColor(slug),
        geoJson: boundaryGeoJson
      };
    }).filter((item) => item.geoJson.features.length > 0);
  }, [mouzaFilter, mouzaChips, parcels, parcelBelongsToMouza]);

  const mouzaHighlightParcels = useMemo(() => {
    if (mouzaFilter === 'all') return [];
    return parcels.filter((parcel) => parcelBelongsToMouza(parcel, mouzaFilter));
  }, [parcels, mouzaFilter, parcelBelongsToMouza]);

  const mouzaOuterBoundaryGeoJson = useMemo(
    () => (mouzaFilter === 'all' ? null : buildMouzaOuterBoundaryGeoJson(mouzaHighlightParcels)),
    [mouzaFilter, mouzaHighlightParcels]
  );

  useEffect(() => {
    if (!mapReady || !mapIndex?.bounds) return undefined;

    const map = mapRef.current;
    if (!map) return undefined;

    const timer = window.setTimeout(() => {
      if (mouzaFilter === 'all') {
        const { south, west, north, east } = mapIndex.bounds;
        runWhenMapReady(map, (readyMap) => {
          try {
            readyMap.flyToBounds(
              [[south, west], [north, east]],
              { padding: [50, 50], duration: 1.2, maxZoom: 16 }
            );
          } catch {
            try {
              readyMap.fitBounds([[south, west], [north, east]], { padding: [50, 50] });
            } catch {}
          }
        });
        return;
      }

      if (visibleParcels.length === 0) return;

      runWhenMapReady(map, (readyMap) => {
        try {
          if (visibleParcels.length === 1) {
            const [parcel] = visibleParcels;
            readyMap.flyTo([parcel.lat, parcel.lng], 17, { duration: 1.2 });
            return;
          }

          const bounds = L.latLngBounds(visibleParcels.map((parcel) => [parcel.lat, parcel.lng]));
          readyMap.flyToBounds(bounds, { padding: [50, 50], maxZoom: 17, duration: 1.2 });
        } catch {
          try {
            const bounds = L.latLngBounds(visibleParcels.map((parcel) => [parcel.lat, parcel.lng]));
            readyMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
          } catch {}
        }
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

  const lineStyle = useCallback(() => ({
    color: 'rgba(200, 200, 200, 0.35)',
    weight: 0.75,
    opacity: 0.5
  }), []);

  const outerBoundaryStyle = useCallback(() => ({
    color: getMouzaHighlightColor(mouzaFilter), // Uses the distinct Mouza color (e.g. Cerulean Blue, Forest Green, Royal Indigo)
    weight: 3.5,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round'
  }), [mouzaFilter]);

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

  const searchKhasraOptions = useMemo(() => {
    const map = new Map();
    const candidateParcels = mouzaFilter === 'all'
      ? parcels
      : parcels.filter((p) => parcelBelongsToMouza(p, mouzaFilter));

    candidateParcels.forEach((p) => {
      if (!p.k) return;
      const mozaLabel = p.moza ? (MOUZA_LABELS[p.moza] || p.moza) : (mouzaFilter !== 'all' ? (MOUZA_LABELS[mouzaFilter] || mouzaFilter) : 'Taj Residencia');
      const label = `Khasra ${p.k} (${mozaLabel})`;
      if (!map.has(p.id)) {
        map.set(p.id, {
          id: p.id,
          label,
          k: p.k,
          moza: p.moza || (mouzaFilter !== 'all' ? mouzaFilter : null),
          parcel: p
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const numA = parseFloat(a.k) || 0;
      const numB = parseFloat(b.k) || 0;
      if (numA !== numB) return numA - numB;
      return a.label.localeCompare(b.label);
    });
  }, [parcels, mouzaFilter, parcelBelongsToMouza]);

  const handleSelectSearchKhasra = useCallback((selectedOption) => {
    if (!selectedOption?.parcel) return;
    const { parcel } = selectedOption;
    setSelectedParcel(parcel);

    // If the parcel belongs to a mouza different from current filter (except all), ensure mouza is aligned
    if (parcel.moza && mouzaFilter !== 'all' && parcel.moza !== mouzaFilter) {
      setMouzaFilter(parcel.moza);
    }

    const map = mapRef.current;
    if (!map || !isMapUsable(map)) return;

    if (parcel.lat && parcel.lng) {
      if (parcel.feature?.geometry) {
        try {
          const geoLayer = L.geoJSON(parcel.feature);
          const bounds = geoLayer.getBounds();
          map.flyToBounds(bounds, {
            padding: [80, 80],
            maxZoom: 18,
            duration: 1.2
          });
        } catch {
          map.flyTo([parcel.lat, parcel.lng], 18, { duration: 1.2 });
        }
      } else {
        map.flyTo([parcel.lat, parcel.lng], 18, { duration: 1.2 });
      }
    }
  }, [mouzaFilter]);

  const getKhasraLabelClass = useCallback((khasraNo, parcelMoza = null) => {
    const resolved = resolveStatusForKhasra(
      khasraNo,
      parcelMoza || (mouzaFilter === 'all' ? null : mouzaFilter),
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

  const getTooltipLabel = useCallback((khasraNo, parcelMoza = null) => {
    const resolved = resolveStatusForKhasra(
      khasraNo,
      parcelMoza || (mouzaFilter === 'all' ? null : mouzaFilter),
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

  const isParcelInPartyTarget = useCallback((khasraNo, parcelMoza) => {
    if (!partyFilterId) return true;
    if (!partyKhasras || partyKhasras.length === 0) return false;
    const normK = normalizeKhasraNo(khasraNo);
    if (!normK) return false;

    // Check raw khasra number match
    if (partyKhasras.includes(normK)) return true;

    // Check with explicit moza or active mouza filter
    const mozasToCheck = [
      parcelMoza,
      mouzaFilter !== 'all' ? mouzaFilter : null
    ].filter(Boolean);

    for (const m of mozasToCheck) {
      if (partyKhasras.includes(`${m}:${normK}`)) return true;
      const erpSlugs = getErpSlugsForMapMoza(m, mozas);
      for (const slug of erpSlugs) {
        if (partyKhasras.includes(`${slug}:${normK}`)) return true;
      }
    }

    return false;
  }, [partyFilterId, partyKhasras, mouzaFilter, mozas]);

  const parcelStyle = useCallback((feature) => {
    const parcel = {
      id: parcelIdForFeature(feature),
      k: feature?.properties?.k,
      moza: feature?.properties?.moza || null
    };
    const resolved = resolveStatusForKhasra(
      parcel.k,
      parcel.moza || (mouzaFilter === 'all' ? null : mouzaFilter),
      statusMap,
      mozas,
      statusLookups
    );
    const statusRow = resolved?.status || null;
    const isSelected = selectedParcel?.id === parcel.id;
    const highlighted = anyErpLayerOn && matchesActiveLayer(statusRow);
    const mouzaActive = mouzaFilter !== 'all';
    const mouzaColor = getMouzaHighlightColor(mouzaFilter);

    const isPartyTarget = isParcelInPartyTarget(parcel.k, parcel.moza);

    if (!isPartyTarget) {
      return {
        color: 'rgba(120,120,120,0.15)',
        fillColor: 'transparent',
        fillOpacity: 0,
        weight: 1,
        opacity: 0.3
      };
    }

    if (!highlighted) {
      if (mouzaActive) {
        return {
          color: mouzaColor,
          fillColor: mouzaColor,
          fillOpacity: isSelected ? 0.45 : 0.08,
          weight: isSelected ? 3 : 1.4,
          opacity: 0.95
        };
      }

      // In "All mouzas" mode, color each parcel by its own mouza
      const resolvedMouza = resolved?.mouza || parcel.moza || 'unknown';
      const autoColor = getMouzaHighlightColor(resolvedMouza);

      return {
        color: autoColor,
        fillColor: autoColor,
        fillOpacity: isSelected ? 0.4 : 0.08,
        weight: isSelected ? 3 : 0.9,
        opacity: 0.75
      };
    }

    return {
      color: strokeForStatus(statusRow, isSelected),
      fillColor: 'transparent',
      fillOpacity: 0,
      weight: isSelected ? 2.5 : 1.5,
      opacity: 1
    };
  }, [
    mouzaFilter,
    statusMap,
    mozas,
    statusLookups,
    selectedParcel,
    anyErpLayerOn,
    matchesActiveLayer,
    isParcelInPartyTarget
  ]);

  const registryFillStyle = useCallback((feature) => {
    const featureId = parcelIdForFeature(feature);
    const isSelected = selectedParcel?.id === featureId;

    const isPartyTarget = isParcelInPartyTarget(feature?.properties?.k, feature?.properties?.moza);

    if (!isPartyTarget) {
      return {
        color: 'transparent',
        fillColor: 'transparent',
        fillOpacity: 0,
        weight: 0,
        opacity: 0
      };
    }

    return {
      color: 'rgba(21, 101, 192, 0.9)',
      fillColor: 'rgba(21, 101, 192, 0.72)',
      fillOpacity: isSelected ? 0.9 : 0.78,
      weight: 1,
      opacity: 0.95
    };
  }, [selectedParcel, isParcelInPartyTarget]);

  const possessionFillStyle = useCallback((feature) => {
    const resolved = resolveStatusForKhasra(
      feature?.properties?.k,
      feature?.properties?.moza || (mouzaFilter === 'all' ? null : mouzaFilter),
      statusMap,
      mozas,
      statusLookups
    );
    const statusRow = resolved?.status || null;
    const featureId = parcelIdForFeature(feature);
    const isSelected = selectedParcel?.id === featureId;

    const isPartyTarget = isParcelInPartyTarget(feature?.properties?.k, feature?.properties?.moza);

    if (!isPartyTarget) {
      return {
        color: 'transparent',
        fillColor: 'transparent',
        fillOpacity: 0,
        weight: 0,
        opacity: 0
      };
    }

    return {
      color: strokeForStatus(statusRow, isSelected),
      fillColor: fillForStatus(statusRow),
      fillOpacity: fillOpacityForStatus(statusRow, isSelected),
      weight: 1,
      opacity: 0.95
    };
  }, [statusMap, mozas, statusLookups, selectedParcel, mouzaFilter, isParcelInPartyTarget]);

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
            {!loading && (stats.registryDocuments > 0 || stats.possessionDocuments > 0) && (
              <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                {stats.registryDocuments > 0 && (
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={`${stats.registryDocuments} ${stats.registryDocuments === 1 ? 'registry' : 'registries'}${stats.khasrasWithRegistry > 0 ? ` · ${stats.khasrasWithRegistry} ${stats.khasrasWithRegistry === 1 ? 'khasra' : 'khasras'}` : ''}`}
                  />
                )}
                {stats.possessionDocuments > 0 && (
                  <Chip
                    size="small"
                    color="success"
                    variant="outlined"
                    label={`${stats.possessionDocuments} ${stats.possessionDocuments === 1 ? 'possession' : 'possessions'}${stats.khasrasWithPossession > 0 ? ` · ${stats.khasrasWithPossession} ${stats.khasrasWithPossession === 1 ? 'khasra' : 'khasras'}` : ''}`}
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
                || stats.khasrasWithRegistry === 0
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
                || stats.khasrasWithPossession === 0
              }
            >
              Focus possession
            </Button>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Mouza</InputLabel>
              <Select
                value={mouzaFilter}
                label="Mouza"
                onChange={(e) => {
                  setMouzaFilter(e.target.value);
                  setSelectedParcel(null);
                }}
              >
                <MenuItem value="all">All Mouzas</MenuItem>
                {mouzaChips.map((slug) => (
                  <MenuItem key={slug} value={slug}>
                    {MOUZA_LABELS[slug] || slug}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Autocomplete
              size="small"
              options={searchKhasraOptions}
              getOptionLabel={(option) => option.label || `Khasra ${option.k}`}
              isOptionEqualToValue={(option, val) => option.id === val.id}
              onChange={(_, value) => handleSelectSearchKhasra(value)}
              value={searchKhasraOptions.find((o) => o.id === selectedParcel?.id) || null}
              sx={{ minWidth: { xs: 180, sm: 240 } }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={mouzaFilter !== 'all' ? `Khasra in ${MOUZA_LABELS[mouzaFilter] || mouzaFilter}...` : "Search Khasra (e.g. 245)..."}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="action" />
                      </InputAdornment>
                    )
                  }}
                />
              )}
            />
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
          height: { xs: '65vh', md: '78vh' },
          '&:fullscreen': { height: '100vh !important', width: '100vw !important' },
          '&:-webkit-full-screen': { height: '100vh !important', width: '100vw !important' },
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
            color: 'rgba(255,255,255,0.85)',
            fontWeight: 700,
            fontSize: '11px',
            lineHeight: 1.2,
            whiteSpace: 'pre-line',
            textAlign: 'center',
            textShadow: '0 0 4px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.95)',
            pointerEvents: 'none'
          },
          '& .latha-khasra-label--selected': {
            background: 'rgba(0, 0, 0, 0.88) !important',
            border: '2px solid #FFD54F !important',
            borderRadius: '6px !important',
            boxShadow: '0 4px 14px rgba(0,0,0,0.6) !important',
            color: '#FFF9C4 !important',
            fontWeight: 900,
            fontSize: '13px !important',
            padding: '3px 8px !important',
            textShadow: '0 1px 3px rgba(0,0,0,0.95) !important'
          },
          '& .latha-khasra-label--party': {
            background: 'rgba(13, 71, 161, 0.88) !important',
            border: '1.5px solid #90CAF9 !important',
            borderRadius: '4px !important',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5) !important',
            color: '#FFFFFF !important',
            fontWeight: 800,
            fontSize: '11px !important',
            padding: '2px 6px !important',
            textShadow: '0 1px 2px rgba(0,0,0,0.9) !important'
          },
          '& .latha-khasra-label--registered': {
            color: '#90CAF9',
            fontWeight: 800,
            fontSize: '12px',
            textShadow: '0 0 5px rgba(13,71,161,0.95), 0 0 2px rgba(0,0,0,0.95)'
          },
          '& .latha-khasra-label--possessed': {
            color: '#A5D6A7',
            fontWeight: 800,
            fontSize: '12px',
            textShadow: '0 0 5px rgba(27,94,32,0.95), 0 0 2px rgba(0,0,0,0.95)'
          }
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: 1
          }}
        >
          <Paper elevation={3} sx={{ p: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5, bgcolor: 'rgba(255, 255, 255, 0.9)' }}>
            <Tooltip title="Zoom In" placement="left">
              <span>
                <IconButton size="small" onClick={() => changeZoom(1)} disabled={loading || Boolean(loadError) || !mapReady}>
                  <ZoomInIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Zoom Out" placement="left">
              <span>
                <IconButton size="small" onClick={() => changeZoom(-1)} disabled={loading || Boolean(loadError) || !mapReady}>
                  <ZoomOutIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={baseLayer === 'satellite' ? 'Switch to Street View' : 'Switch to Satellite View'} placement="left">
              <span>
                <IconButton size="small" onClick={() => setBaseLayer((prev) => (prev === 'satellite' ? 'street' : 'satellite'))}>
                  <MapIcon fontSize="small" color={baseLayer === 'satellite' ? 'primary' : 'inherit'} />
                </IconButton>
              </span>
            </Tooltip>
          </Paper>

          <Paper elevation={3} sx={{ p: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5, bgcolor: 'rgba(255, 255, 255, 0.9)' }}>
            <Tooltip title={showRegistryLayer ? 'Hide Registry' : 'Show Registry'} placement="left">
              <span>
                <IconButton size="small" onClick={() => setShowRegistryLayer((prev) => !prev)}>
                  <LayersIcon fontSize="small" sx={{ color: showRegistryLayer ? '#1565C0' : 'text.disabled' }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={showPossessionLayer ? 'Hide Possession' : 'Show Possession'} placement="left">
              <span>
                <IconButton size="small" onClick={() => setShowPossessionLayer((prev) => !prev)}>
                  <LayersIcon fontSize="small" sx={{ color: showPossessionLayer ? '#2E7D32' : 'text.disabled' }} />
                </IconButton>
              </span>
            </Tooltip>
          </Paper>
        </Box>

        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            width: 250
          }}
        >
          <Paper elevation={3} sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5, bgcolor: 'rgba(255, 255, 255, 0.95)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" fontWeight={600}>Filter by Party</Typography>
              {(partyFilterId || partyRoleFilter) && (
                <Button
                  size="small"
                  onClick={() => {
                    setPartyRoleFilter('');
                    setPartyFilterId('');
                    setPartyKhasras([]);
                    resetView();
                  }}
                  sx={{ p: 0, minWidth: 'auto', fontSize: '0.75rem' }}
                >
                  Reset
                </Button>
              )}
            </Box>
            <FormControl size="small" fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={partyRoleFilter}
                label="Role"
                onChange={(e) => {
                  setPartyRoleFilter(e.target.value);
                  setPartyFilterId('');
                  setPartyKhasras([]);
                }}
                MenuProps={{ disablePortal: true }}
              >
                <MenuItem value="">All Roles</MenuItem>
                <MenuItem value="seller">Seller</MenuItem>
                <MenuItem value="buyer">Buyer</MenuItem>
                <MenuItem value="dealer">Agent / Dealer</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Select Party</InputLabel>
              <Select
                value={partyFilterId}
                label="Select Party"
                onChange={(e) => {
                  setPartyFilterId(e.target.value);
                  if (!e.target.value) {
                    setPartyKhasras([]);
                  }
                }}
                MenuProps={{ disablePortal: true }}
              >
                <MenuItem value=""><em>All Parties (Show All)</em></MenuItem>
                {partyList.map((p) => (
                  <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {partyFilterId && partyKhasras && (
              <Typography variant="caption" color="primary" fontWeight={600}>
                {partyKhasras.length} khasras found
              </Typography>
            )}
          </Paper>
        </Box>
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
                selectedParcelId={selectedParcel?.id || null}
                partyFilterId={partyFilterId}
                isParcelInPartyTarget={isParcelInPartyTarget}
              />
            )}
            {lines && (
              <KhasraLineLayer
                data={lines}
                getStyle={lineStyle}
              />
            )}
            {mouzaOuterBoundaryGeoJson && mouzaOuterBoundaryGeoJson.features.length > 0 && (
              <KhasraLineLayer
                key={`mouza-border-${mouzaFilter}`}
                data={mouzaOuterBoundaryGeoJson}
                getStyle={outerBoundaryStyle}
              />
            )}
            {mouzaFilter === 'all' && allMouzaBoundariesGeoJson.map((item) => (
              <KhasraLineLayer
                key={`mouza-all-border-${item.slug}`}
                data={item.geoJson}
                getStyle={() => ({
                  color: item.color,
                  weight: 3,
                  opacity: 0.95,
                  lineCap: 'round',
                  lineJoin: 'round'
                })}
              />
            ))}
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
          Fill area = Transfer % from ERP — clipped inside each khasra parcel along survey boundaries
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
            {formatCount(visibleParcels?.length)} khasra parcels shown
            {mouzaFilter !== 'all' ? ` · ${MOUZA_LABELS[mouzaFilter] || mouzaFilter} highlighted (yellow = mouza boundary)` : ''}
            {anyErpLayerOn
              ? ` · ${[
                showRegistryLayer && stats.registryDocuments > 0
                  ? `${formatCount(stats.registryDocuments)} ${stats.registryDocuments === 1 ? 'registry' : 'registries'}`
                  : null,
                showPossessionLayer && stats.possessionDocuments > 0
                  ? `${formatCount(stats.possessionDocuments)} ${stats.possessionDocuments === 1 ? 'possession' : 'possessions'}`
                  : null,
                showRegistryLayer && stats.khasrasWithRegistry > 0
                  ? `${formatCount(stats.khasrasWithRegistry)} ${stats.khasrasWithRegistry === 1 ? 'khasra' : 'khasras'} with registry`
                  : null,
                showPossessionLayer && stats.khasrasWithPossession > 0
                  ? `${formatCount(stats.khasrasWithPossession)} ${stats.khasrasWithPossession === 1 ? 'khasra' : 'khasras'} with possession`
                  : null
              ].filter(Boolean).join(' · ')}`
              : ' · survey plan only (check Registry or Possession to show ERP data)'}
            {mapIndex.counts?.parcels != null ? ` · ${formatCount(mapIndex.counts.parcels)} parcel shapes from KMZ` : ''}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default LathaMapViewer;
