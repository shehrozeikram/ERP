/** ~4.4 m snapping in degrees — aligns KMZ lines with polygonized parcel rings */
const SNAP = 4e-5;

const snapKey = (lng, lat) => `${Math.round(lng / SNAP)}:${Math.round(lat / SNAP)}`;

const edgeKey = (a, b) => {
  const ka = snapKey(a[0], a[1]);
  const kb = snapKey(b[0], b[1]);
  if (ka === kb) return null;
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

/**
 * Build GeoJSON LineString feature collection of the actual outer boundary of the mouza.
 * Only outer perimeter segments (shared by only 1 parcel ring) are included.
 */
export const buildMouzaOuterBoundaryGeoJson = (parcels = []) => {
  const edgeMap = new Map();

  parcels.forEach((parcel) => {
    const ring = parcel?.feature?.geometry?.coordinates?.[0];
    if (!ring?.length) return;

    for (let i = 0; i < ring.length - 1; i += 1) {
      const p1 = ring[i];
      const p2 = ring[i + 1];
      const key = edgeKey(p1, p2);
      if (!key) continue;

      if (!edgeMap.has(key)) {
        edgeMap.set(key, { count: 1, coords: [p1, p2] });
      } else {
        edgeMap.get(key).count += 1;
      }
    }
  });

  const features = [];
  edgeMap.forEach(({ count, coords }) => {
    if (count === 1) {
      features.push({
        type: 'Feature',
        properties: { isBoundary: true },
        geometry: {
          type: 'LineString',
          coordinates: coords
        }
      });
    }
  });

  return {
    type: 'FeatureCollection',
    features
  };
};

export const MOUZA_HIGHLIGHT_COLORS = {
  sheikhpur: '#0288D1',  // Refined Cerulean Blue
  kaak: '#2E7D32',       // Classic Forest Green
  lakhu: '#E65100',      // Warm Ochre Amber
  rupa: '#512DA8',       // Deep Royal Slate
  'chak-rupa': '#1565C0',// Deep Sapphire Blue
  narhala: '#C2185B',    // Muted Rose Garnet
  'kot-kolian': '#8E24AA',// Vibrant Purple
  unknown: '#607D8B'     // Cool Steel Grey
};

export const getMouzaHighlightColor = (slug) =>
  MOUZA_HIGHLIGHT_COLORS[slug] || MOUZA_HIGHLIGHT_COLORS.unknown;
