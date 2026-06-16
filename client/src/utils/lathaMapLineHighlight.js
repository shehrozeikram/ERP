/** ~1.1 m snapping in degrees — aligns KMZ lines with polygonized parcel rings */
const SNAP = 1e-5;

const snapKey = (lng, lat) => `${Math.round(lng / SNAP)}:${Math.round(lat / SNAP)}`;

const edgeKey = (a, b) => {
  const ka = snapKey(a[0], a[1]);
  const kb = snapKey(b[0], b[1]);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

/**
 * Build edge index from parcel polygon rings.
 * Edges that appear once are treated as mouza outer boundary segments.
 */
export const buildMouzaLineHighlightIndex = (parcels = []) => {
  const edgeCount = new Map();

  parcels.forEach((parcel) => {
    const ring = parcel?.feature?.geometry?.coordinates?.[0];
    if (!ring?.length) return;

    for (let i = 0; i < ring.length - 1; i += 1) {
      const key = edgeKey(ring[i], ring[i + 1]);
      edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
    }
  });

  const allEdges = new Set();
  const boundaryEdges = new Set();

  edgeCount.forEach((count, key) => {
    allEdges.add(key);
    if (count === 1) boundaryEdges.add(key);
  });

  return { allEdges, boundaryEdges };
};

export const classifyLineFeature = (feature, index) => {
  if (!index) {
    return { onMouza: false, isBoundary: false };
  }

  const coords = feature?.geometry?.coordinates || [];
  let onMouza = false;
  let isBoundary = false;

  for (let i = 0; i < coords.length - 1; i += 1) {
    const key = edgeKey(coords[i], coords[i + 1]);
    if (index.allEdges.has(key)) {
      onMouza = true;
      if (index.boundaryEdges.has(key)) isBoundary = true;
    }
  }

  return { onMouza, isBoundary };
};

export const MOUZA_HIGHLIGHT_COLORS = {
  rupa: '#29B6F6',
  'chak-rupa': '#42A5F5',
  sheikhpur: '#AB47BC',
  kaak: '#66BB6A',
  lakhu: '#FFA726',
  narhala: '#EF5350',
  unknown: '#B0BEC5'
};

export const getMouzaHighlightColor = (slug) =>
  MOUZA_HIGHLIGHT_COLORS[slug] || MOUZA_HIGHLIGHT_COLORS.unknown;
