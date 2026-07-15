/** 1 Kanal = 20 Marla = 180 Sarsai; 1 Sarsai = 30.25 sq ft */

export const SARSAI_PER_MARLA = 9;
export const MARLA_PER_KANAL = 20;
export const SARSAIS_PER_KANAL = MARLA_PER_KANAL * SARSAI_PER_MARLA;
export const SQFT_PER_SARSAI = 30.25;

export const normalizeArea = (raw = {}) => ({
  kanal: Math.max(0, Number(raw?.kanal) || 0),
  marla: Math.max(0, Number(raw?.marla) || 0),
  sarsai: Math.max(0, Number(raw?.sarsai ?? raw?.sqft) || 0)
});

export const toSarsais = (area) => {
  const a = normalizeArea(area);
  return a.kanal * SARSAIS_PER_KANAL + a.marla * SARSAI_PER_MARLA + a.sarsai;
};

export const fromSarsais = (total) => {
  let remaining = Math.max(0, Math.round(Number(total) || 0));
  const kanal = Math.floor(remaining / SARSAIS_PER_KANAL);
  remaining %= SARSAIS_PER_KANAL;
  const marla = Math.floor(remaining / SARSAI_PER_MARLA);
  const sarsai = remaining % SARSAI_PER_MARLA;
  return { kanal, marla, sarsai };
};

export const addAreas = (...areas) =>
  fromSarsais(areas.reduce((sum, area) => sum + toSarsais(area), 0));

export const subtractAreas = (a, b) =>
  fromSarsais(Math.max(0, toSarsais(a) - toSarsais(b)));

export const parseAreaForm = (obj) => normalizeArea({
  kanal: obj?.kanal,
  marla: obj?.marla,
  sarsai: obj?.sarsai ?? obj?.sqft
});

export const formatKMS = (area) => {
  const a = normalizeArea(area);
  if (!a.kanal && !a.marla && !a.sarsai) return '—';
  return `${a.kanal}-${a.marla}-${a.sarsai}`;
};

export const emptyArea = () => ({ kanal: '', marla: '', sarsai: '' });

export const areaToForm = (area) => {
  const a = normalizeArea(area);
  return {
    kanal: a.kanal ? String(a.kanal) : '',
    marla: a.marla ? String(a.marla) : '',
    sarsai: a.sarsai ? String(a.sarsai) : ''
  };
};

export const areaToDecimalKanal = (area) => {
  const a = normalizeArea(area);
  return a.kanal + (a.marla / MARLA_PER_KANAL) + (a.sarsai / SARSAIS_PER_KANAL);
};

export const formatAreaReadable = (area) => {
  const a = normalizeArea(area);
  const parts = [];
  if (a.kanal) parts.push(`${a.kanal} K`);
  if (a.marla) parts.push(`${a.marla} M`);
  if (a.sarsai) parts.push(`${a.sarsai} S`);
  return parts.join('   ') || '—';
};
