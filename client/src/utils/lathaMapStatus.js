import { formatKMS, normalizeArea } from './landAreaUnits';
import { formatKhasraKhewatLabel } from './landKhasraDisplay';

export const STATUS_LEGEND = [
  { id: 'fully_possessed', label: 'Fully possessed', color: '#2E7D32', fill: 'rgba(46, 125, 50, 0.62)' },
  { id: 'partial_possession', label: 'Partial possession', color: '#F57C00', fill: 'rgba(245, 124, 0, 0.58)' },
  { id: 'registered', label: 'Registered (not possessed)', color: '#1565C0', fill: 'rgba(21, 101, 192, 0.5)' },
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

export const isErpTrackedKhasra = (statusRow) =>
  Boolean(statusRow && (hasRegisteredArea(statusRow) || hasPossessedArea(statusRow)));

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

export const fillForStatus = (statusRow) => {
  if (!statusRow) return STATUS_LEGEND.find((x) => x.id === 'no_data').fill;
  if (statusRow.possessionStatus === 'fully_possessed') {
    return STATUS_LEGEND.find((x) => x.id === 'fully_possessed').fill;
  }
  if (statusRow.possessionStatus === 'partial_possession') {
    return STATUS_LEGEND.find((x) => x.id === 'partial_possession').fill;
  }
  if (hasRegisteredArea(statusRow) || statusRow.purchaseStatus !== 'not_purchased') {
    return STATUS_LEGEND.find((x) => x.id === 'registered').fill;
  }
  return STATUS_LEGEND.find((x) => x.id === 'not_registered').fill;
};

export const strokeForStatus = (statusRow, selected = false) => {
  if (selected) return '#FF6F00';
  if (!statusRow) return 'rgba(120,120,120,0.35)';
  if (statusRow.possessionStatus === 'fully_possessed') return 'rgba(27, 94, 32, 0.9)';
  if (statusRow.possessionStatus === 'partial_possession') return 'rgba(230, 81, 0, 0.9)';
  if (hasRegisteredArea(statusRow) || statusRow.purchaseStatus !== 'not_purchased') {
    return 'rgba(13, 71, 161, 0.85)';
  }
  return 'rgba(97, 97, 97, 0.45)';
};

export const markerRadiusForStatus = (statusRow, selected = false) => {
  if (selected) return 11;
  if (!statusRow) return 4;
  if (isErpTrackedKhasra(statusRow)) return 9;
  return 5;
};

export const fillOpacityForStatus = (statusRow, selected = false) => {
  if (selected) return 0.88;
  if (isErpTrackedKhasra(statusRow)) return 0.78;
  if (statusRow) return 0.22;
  return 0.1;
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
    `Registered: ${formatKMS(normalizeArea(statusRow.registered))}`,
    `Possessed: ${formatKMS(normalizeArea(statusRow.possessed))}`
  ];
  return lines.join('\n');
};
