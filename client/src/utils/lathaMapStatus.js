import { formatKMS, normalizeArea, toSarsais } from './landAreaUnits';
import { formatKhasraKhewatLabel } from './landKhasraDisplay';

export const STATUS_LEGEND = [
  { id: 'fully_possessed', label: 'Fully possessed', color: '#2E7D32', fill: 'rgba(46, 125, 50, 0.72)' },
  { id: 'partial_possession', label: 'Partial possession', color: '#F57C00', fill: 'rgba(245, 124, 0, 0.65)' },
  { id: 'possessed_unregistered', label: 'Possessed (no registry)', color: '#00897B', fill: 'rgba(0, 137, 123, 0.65)' },
  { id: 'registered', label: 'Registered (not possessed)', color: '#1565C0', fill: 'rgba(21, 101, 192, 0.58)' },
  { id: 'not_registered', label: 'Not registered', color: '#BDBDBD', fill: 'rgba(189, 189, 189, 0.28)' },
  { id: 'no_data', label: 'No ERP record', color: '#E0E0E0', fill: 'rgba(224, 224, 224, 0.2)' }
];

/** Normalize khasra labels so map points match ERP records (e.g. "0123" → "123"). */
export const normalizeKhasraNo = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const parts = raw.split('/');
  const head = parts[0].replace(/^0+(?=\d)/, '') || parts[0];
  return parts.length > 1 ? `${head}/${parts.slice(1).join('/')}` : head;
};

export const statusKeyForParcel = (mouzaSlug, khasraNo) => {
  if (!mouzaSlug || !khasraNo) return null;
  return `${mouzaSlug}:${normalizeKhasraNo(khasraNo)}`;
};

export const hasRegisteredArea = (statusRow) => {
  if (!statusRow) return false;
  const { kanal = 0, marla = 0, sarsai = 0 } = statusRow.registered || {};
  return kanal > 0 || marla > 0 || sarsai > 0;
};

export const hasPossessedArea = (statusRow) => {
  if (!statusRow) return false;
  const { kanal = 0, marla = 0, sarsai = 0 } = statusRow.possessed || {};
  return kanal > 0 || marla > 0 || sarsai > 0;
};

/** Stored transfer % from registry / possession lines (0–100). */
export const normalizeTransferPercent = (value) => {
  const pct = Number(value);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.min(100, pct);
};

export const formatTransferPercentLabel = (value) => {
  const pct = normalizeTransferPercent(value);
  if (pct <= 0) return '0%';
  if (pct >= 100) return '100%';
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
};

export const hasRegistryTransfer = (statusRow) =>
  normalizeTransferPercent(statusRow?.registryTransferPercent) > 0;

export const hasPossessionTransfer = (statusRow) =>
  normalizeTransferPercent(statusRow?.possessionTransferPercent) > 0;

export const hasRegistryOnMap = (statusRow) =>
  Boolean(statusRow && (hasRegistryTransfer(statusRow) || hasRegisteredArea(statusRow)));

export const hasPossessionOnMap = (statusRow) =>
  Boolean(statusRow && (hasPossessionTransfer(statusRow) || hasPossessedArea(statusRow)));

const coverageFractionFromAreas = (portion, baseline) => {
  const portionSarsais = toSarsais(normalizeArea(portion));
  const baselineSarsais = toSarsais(normalizeArea(baseline));
  if (portionSarsais <= 0) return 0;
  if (baselineSarsais <= 0) return 1;
  return Math.min(1, portionSarsais / baselineSarsais);
};

export const registryCoverageFraction = (statusRow) => {
  const fromTransfer = normalizeTransferPercent(statusRow?.registryTransferPercent) / 100;
  if (fromTransfer > 0) return fromTransfer;
  if (!hasRegisteredArea(statusRow)) return 0;
  return coverageFractionFromAreas(statusRow.registered, statusRow.baseline);
};

export const possessionCoverageFraction = (statusRow) => {
  const fromTransfer = normalizeTransferPercent(statusRow?.possessionTransferPercent) / 100;
  if (fromTransfer > 0) return fromTransfer;
  if (!hasPossessedArea(statusRow)) return 0;
  return coverageFractionFromAreas(statusRow.possessed, statusRow.baseline);
};

export const isErpTrackedKhasra = (statusRow) =>
  Boolean(statusRow && (hasRegisteredArea(statusRow) || hasPossessedArea(statusRow)));

export const isRegisteredOnMap = (statusRow) =>
  Boolean(statusRow && hasRegisteredArea(statusRow) && !hasPossessedArea(statusRow));

export const isPossessedOnMap = (statusRow) =>
  Boolean(statusRow && hasPossessedArea(statusRow));

/** Map ERP row to legend/status category for fill & stroke. */
export const getMapStatusId = (statusRow) => {
  if (!statusRow) return 'no_data';

  if (hasPossessedArea(statusRow)) {
    if (statusRow.possessionStatus === 'fully_possessed') return 'fully_possessed';
    if (statusRow.possessionStatus === 'partial_possession') return 'partial_possession';
    if (statusRow.possessionStatus === 'possessed_unregistered' || !hasRegisteredArea(statusRow)) {
      return 'possessed_unregistered';
    }
    return 'partial_possession';
  }

  if (hasRegisteredArea(statusRow) || statusRow.purchaseStatus !== 'not_purchased') {
    return 'registered';
  }

  return 'not_registered';
};

export const legendForStatus = (statusRow) =>
  STATUS_LEGEND.find((item) => item.id === getMapStatusId(statusRow)) || STATUS_LEGEND.find((item) => item.id === 'no_data');

/** Build lookup maps for exact and normalized khasra keys. */
export const buildStatusLookups = (statusMap = {}) => {
  const exact = statusMap;
  const byKhasra = {};

  Object.entries(statusMap).forEach(([key, row]) => {
    const sep = key.indexOf(':');
    if (sep === -1) return;
    const slug = key.slice(0, sep);
    const khasra = key.slice(sep + 1);
    const norm = normalizeKhasraNo(khasra);
    const normKey = `${slug}:${norm}`;
    if (!byKhasra[normKey]) byKhasra[normKey] = row;
  });

  return { exact, byKhasra };
};

/** Resolve ERP status for a khasra label (optionally scoped to one mouza). */
export const resolveStatusForKhasra = (khasraNo, mouzaFilter, statusMap, mozas = [], lookups = null) => {
  const k = normalizeKhasraNo(khasraNo);
  if (!k) return null;

  const maps = lookups || buildStatusLookups(statusMap);
  const tryKey = (slug) => maps.byKhasra[`${slug}:${k}`] || maps.exact[`${slug}:${k}`] || maps.exact[`${slug}:${khasraNo}`];

  if (mouzaFilter && mouzaFilter !== 'all') {
    const status = tryKey(mouzaFilter);
    return status ? { status, mouza: mouzaFilter } : null;
  }

  for (const moza of mozas) {
    const slug = typeof moza === 'string' ? moza : moza.slug;
    const status = tryKey(slug);
    if (status) return { status, mouza: slug };
  }

  return null;
};

export const fillForStatus = (statusRow) => legendForStatus(statusRow).fill;

export const strokeForStatus = (statusRow, selected = false) => {
  if (selected) return '#FF6F00';
  const legend = legendForStatus(statusRow);
  if (legend.id === 'no_data') return 'rgba(120,120,120,0.35)';
  return legend.color;
};

export const markerRadiusForStatus = (statusRow, selected = false) => {
  if (selected) return 11;
  if (!statusRow) return 4;
  if (isErpTrackedKhasra(statusRow)) return 9;
  return 5;
};

export const fillOpacityForStatus = (statusRow, selected = false) => {
  if (selected) return 0.9;
  if (isPossessedOnMap(statusRow)) return 0.82;
  if (hasRegisteredArea(statusRow)) return 0.78;
  if (statusRow) return 0.22;
  return 0.1;
};

export const khasraLabelClassForStatus = (statusRow) => {
  const id = getMapStatusId(statusRow);
  if (id === 'fully_possessed' || id === 'partial_possession' || id === 'possessed_unregistered') {
    return 'latha-khasra-label latha-khasra-label--possessed';
  }
  if (id === 'registered') return 'latha-khasra-label latha-khasra-label--registered';
  return 'latha-khasra-label';
};

export const pointsToPath = (points) => {
  if (!points?.length) return '';
  const [first, ...rest] = points;
  return `M ${first[0]} ${first[1]} ${rest.map(([x, y]) => `L ${x} ${y}`).join(' ')} Z`;
};

export const formatStatusSummary = (statusRow) => {
  if (!statusRow) return 'No matching record in ERP for this khasra.';
  const lines = [
    formatKhasraKhewatLabel(statusRow.khasraNo, statusRow.khewatNo),
    `Baseline: ${formatKMS(normalizeArea(statusRow.baseline))}`,
    `Registered: ${formatKMS(normalizeArea(statusRow.registered))} (${formatTransferPercentLabel(statusRow.registryTransferPercent)} transfer)`,
    `Possessed: ${formatKMS(normalizeArea(statusRow.possessed))} (${formatTransferPercentLabel(statusRow.possessionTransferPercent)} transfer)`
  ];
  return lines.join('\n');
};
