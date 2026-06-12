import { formatKMS, normalizeArea } from './landAreaUnits';
import { formatKhasraKhewatLabel } from './landKhasraDisplay';

export const STATUS_LEGEND = [
  { id: 'fully_possessed', label: 'Fully possessed', color: '#2E7D32', fill: 'rgba(46, 125, 50, 0.62)' },
  { id: 'partial_possession', label: 'Partial possession', color: '#F57C00', fill: 'rgba(245, 124, 0, 0.58)' },
  { id: 'registered', label: 'Registered (not possessed)', color: '#1565C0', fill: 'rgba(21, 101, 192, 0.5)' },
  { id: 'not_registered', label: 'Not registered', color: '#BDBDBD', fill: 'rgba(189, 189, 189, 0.28)' },
  { id: 'no_data', label: 'No ERP record', color: '#E0E0E0', fill: 'rgba(224, 224, 224, 0.2)' }
];

export const statusKeyForParcel = (mouzaSlug, khasraNo) => {
  if (!mouzaSlug || !khasraNo) return null;
  return `${mouzaSlug}:${String(khasraNo).trim()}`;
};

export const fillForStatus = (statusRow) => {
  if (!statusRow) return STATUS_LEGEND.find((x) => x.id === 'no_data').fill;
  if (statusRow.possessionStatus === 'fully_possessed') {
    return STATUS_LEGEND.find((x) => x.id === 'fully_possessed').fill;
  }
  if (statusRow.possessionStatus === 'partial_possession') {
    return STATUS_LEGEND.find((x) => x.id === 'partial_possession').fill;
  }
  if (statusRow.purchaseStatus !== 'not_purchased') {
    return STATUS_LEGEND.find((x) => x.id === 'registered').fill;
  }
  return STATUS_LEGEND.find((x) => x.id === 'not_registered').fill;
};

export const strokeForStatus = (statusRow, selected = false) => {
  if (selected) return '#FF6F00';
  if (!statusRow) return 'rgba(120,120,120,0.35)';
  if (statusRow.possessionStatus === 'fully_possessed') return 'rgba(27, 94, 32, 0.9)';
  if (statusRow.possessionStatus === 'partial_possession') return 'rgba(230, 81, 0, 0.9)';
  if (statusRow.purchaseStatus !== 'not_purchased') return 'rgba(13, 71, 161, 0.85)';
  return 'rgba(97, 97, 97, 0.45)';
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
