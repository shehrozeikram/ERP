const ringBounds = (ring) => {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  ring.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  });

  return { minLng, minLat, maxLng, maxLat };
};

const intersectX = (p1, p2, x) => {
  const dx = p2[0] - p1[0];
  if (Math.abs(dx) < 1e-12) return [x, p1[1]];
  const t = (x - p1[0]) / dx;
  return [x, p1[1] + t * (p2[1] - p1[1])];
};

const intersectY = (p1, p2, y) => {
  const dy = p2[1] - p1[1];
  if (Math.abs(dy) < 1e-12) return [p1[0], y];
  const t = (y - p1[1]) / dy;
  return [p1[0] + t * (p2[0] - p1[0]), y];
};

const clipPolygonToHalfPlane = (points, insideFn, intersectFn) => {
  if (!points.length) return [];

  const output = [];
  let prev = points[points.length - 1];

  for (let i = 0; i < points.length; i += 1) {
    const curr = points[i];
    const prevIn = insideFn(prev);
    const currIn = insideFn(curr);

    if (currIn) {
      if (!prevIn) output.push(intersectFn(prev, curr));
      output.push(curr);
    } else if (prevIn) {
      output.push(intersectFn(prev, curr));
    }

    prev = curr;
  }

  return output;
};

const clipRingToRect = (ring, [minLng, minLat, maxLng, maxLat]) => {
  let poly = ring;
  poly = clipPolygonToHalfPlane(poly, (p) => p[0] >= minLng, (a, b) => intersectX(a, b, minLng));
  if (!poly.length) return null;
  poly = clipPolygonToHalfPlane(poly, (p) => p[0] <= maxLng, (a, b) => intersectX(a, b, maxLng));
  if (!poly.length) return null;
  poly = clipPolygonToHalfPlane(poly, (p) => p[1] >= minLat, (a, b) => intersectY(a, b, minLat));
  if (!poly.length) return null;
  poly = clipPolygonToHalfPlane(poly, (p) => p[1] <= maxLat, (a, b) => intersectY(a, b, maxLat));
  return poly.length >= 3 ? poly : null;
};

const clipRingByLatRange = (ring, minLat, maxLat) => {
  if (ring.length < 3) return null;
  const { minLng, maxLng } = ringBounds(ring);
  return clipRingToRect(ring, [minLng, minLat, maxLng, maxLat]);
};

const geometryFromClippedRings = (rings) => {
  if (!rings.length) return null;
  if (rings.length === 1) {
    return { type: 'Polygon', coordinates: rings[0] };
  }
  return { type: 'MultiPolygon', coordinates: rings };
};

const clipPolygonGeometry = (geometry, clipRing) => {
  if (!geometry) return null;

  if (geometry.type === 'Polygon') {
    const outer = clipRing(geometry.coordinates[0]);
    return outer ? { type: 'Polygon', coordinates: [outer] } : null;
  }

  if (geometry.type === 'MultiPolygon') {
    const rings = geometry.coordinates
      .map((coords) => {
        const outer = clipRing(coords[0]);
        return outer ? [outer] : null;
      })
      .filter(Boolean);
    return geometryFromClippedRings(rings);
  }

  return null;
};

/** Keep the bottom portion of a polygon (0–1 fraction of its north–south extent). */
export const clipPolygonBottomFraction = (geometry, fraction) => {
  const f = Math.min(1, Math.max(0, Number(fraction) || 0));
  if (f <= 0) return null;
  if (f >= 1) return geometry;

  return clipPolygonGeometry(geometry, (ring) => {
    const { minLat, maxLat } = ringBounds(ring);
    const cutLat = minLat + (maxLat - minLat) * f;
    return clipRingByLatRange(ring, minLat, cutLat);
  });
};

/** Keep the top portion of a polygon (0–1 fraction of its north–south extent). */
export const clipPolygonTopFraction = (geometry, fraction) => {
  const f = Math.min(1, Math.max(0, Number(fraction) || 0));
  if (f <= 0) return null;
  if (f >= 1) return geometry;

  return clipPolygonGeometry(geometry, (ring) => {
    const { minLat, maxLat } = ringBounds(ring);
    const cutLat = maxLat - (maxLat - minLat) * f;
    return clipRingByLatRange(ring, cutLat, maxLat);
  });
};
