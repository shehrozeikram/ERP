const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (a, s) => [a[0] * s, a[1] * s];

const projectPoint = (point, origin, axis) => dot(sub(point, origin), axis);

/** South → north axis through the parcel (registry bottom / possession top). */
const parcelSouthNorthFrame = (ring) => {
  if (!ring?.length) {
    return { origin: [0, 0], axis: [0, 1], minProj: 0, maxProj: 1 };
  }

  let south = ring[0];
  let north = ring[0];

  for (let i = 0; i < ring.length - 1; i += 1) {
    const point = ring[i];
    if (
      point[1] < south[1] - 1e-12
      || (Math.abs(point[1] - south[1]) < 1e-12 && point[0] < south[0])
    ) {
      south = point;
    }
    if (
      point[1] > north[1] + 1e-12
      || (Math.abs(point[1] - north[1]) < 1e-12 && point[0] > north[0])
    ) {
      north = point;
    }
  }

  const delta = sub(north, south);
  const span = Math.hypot(delta[0], delta[1]);
  const axis = span > 1e-12 ? [delta[0] / span, delta[1] / span] : [0, 1];

  let minProj = Infinity;
  let maxProj = -Infinity;
  ring.forEach((point) => {
    const value = projectPoint(point, south, axis);
    minProj = Math.min(minProj, value);
    maxProj = Math.max(maxProj, value);
  });

  if (!Number.isFinite(minProj) || !Number.isFinite(maxProj) || maxProj <= minProj) {
    return { origin: south, axis, minProj: 0, maxProj: span || 1 };
  }

  return { origin: south, axis, minProj, maxProj };
};

const intersectAtProjection = (p1, p2, origin, axis, cutProj) => {
  const t1 = projectPoint(p1, origin, axis);
  const t2 = projectPoint(p2, origin, axis);
  const dt = t2 - t1;
  if (Math.abs(dt) < 1e-15) return p1;
  const ratio = (cutProj - t1) / dt;
  return add(p1, scale(sub(p2, p1), ratio));
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

const clipRingByMaxProjection = (ring, origin, axis, maxProj) => {
  const clipped = clipPolygonToHalfPlane(
    ring,
    (point) => projectPoint(point, origin, axis) <= maxProj + 1e-12,
    (a, b) => intersectAtProjection(a, b, origin, axis, maxProj)
  );
  return clipped.length >= 3 ? clipped : null;
};

const clipRingByMinProjection = (ring, origin, axis, minProj) => {
  const clipped = clipPolygonToHalfPlane(
    ring,
    (point) => projectPoint(point, origin, axis) >= minProj - 1e-12,
    (a, b) => intersectAtProjection(a, b, origin, axis, minProj)
  );
  return clipped.length >= 3 ? clipped : null;
};

const clipRingBottomExtentFraction = (ring, fraction) => {
  if (ring.length < 3) return null;
  const { origin, axis, minProj, maxProj } = parcelSouthNorthFrame(ring);
  if (maxProj <= minProj) return null;
  const cut = minProj + (maxProj - minProj) * fraction;
  return clipRingByMaxProjection(ring, origin, axis, cut);
};

const clipRingTopExtentFraction = (ring, fraction) => {
  if (ring.length < 3) return null;
  const { origin, axis, minProj, maxProj } = parcelSouthNorthFrame(ring);
  if (maxProj <= minProj) return null;
  const cut = maxProj - (maxProj - minProj) * fraction;
  return clipRingByMinProjection(ring, origin, axis, cut);
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

/** Keep the south portion of a parcel polygon (0–1 transfer fraction along south→north). */
export const clipPolygonBottomFraction = (geometry, fraction) => {
  const f = Math.min(1, Math.max(0, Number(fraction) || 0));
  if (f <= 0) return null;
  if (f >= 1) return geometry;

  return clipPolygonGeometry(geometry, (ring) => clipRingBottomExtentFraction(ring, f));
};

/** Keep the north portion of a parcel polygon (0–1 transfer fraction along south→north). */
export const clipPolygonTopFraction = (geometry, fraction) => {
  const f = Math.min(1, Math.max(0, Number(fraction) || 0));
  if (f <= 0) return null;
  if (f >= 1) return geometry;

  return clipPolygonGeometry(geometry, (ring) => clipRingTopExtentFraction(ring, f));
};
