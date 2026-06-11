/** Pakistani land units: 1 Kanal = 20 Marla = 180 Sarsai; 1 Sarsai = 30.25 sq ft */

const SARSAI_PER_MARLA = 9;
const MARLA_PER_KANAL = 20;
const SARSAIS_PER_KANAL = MARLA_PER_KANAL * SARSAI_PER_MARLA;
const SQFT_PER_SARSAI = 30.25;

const normalizeArea = (raw = {}) => ({
  kanal: Math.max(0, Number(raw?.kanal) || 0),
  marla: Math.max(0, Number(raw?.marla) || 0),
  sarsai: Math.max(0, Number(raw?.sarsai ?? raw?.sqft) || 0)
});

const toSarsais = (area) => {
  const a = normalizeArea(area);
  return a.kanal * SARSAIS_PER_KANAL + a.marla * SARSAI_PER_MARLA + a.sarsai;
};

const fromSarsais = (total) => {
  let remaining = Math.max(0, Math.round(Number(total) || 0));
  const kanal = Math.floor(remaining / SARSAIS_PER_KANAL);
  remaining %= SARSAIS_PER_KANAL;
  const marla = Math.floor(remaining / SARSAI_PER_MARLA);
  const sarsai = remaining % SARSAI_PER_MARLA;
  return { kanal, marla, sarsai };
};

const addAreas = (...areas) =>
  fromSarsais(areas.reduce((sum, area) => sum + toSarsais(area), 0));

const subtractAreas = (a, b) =>
  fromSarsais(Math.max(0, toSarsais(a) - toSarsais(b)));

const parseAreaInput = (obj) => normalizeArea({
  kanal: obj?.kanal,
  marla: obj?.marla,
  sarsai: obj?.sarsai ?? obj?.sqft
});

const formatKMS = (area) => {
  const a = normalizeArea(area);
  if (!a.kanal && !a.marla && !a.sarsai) return '—';
  return `${a.kanal}-${a.marla}-${a.sarsai}`;
};

const toSqFt = (area) => toSarsais(area) * SQFT_PER_SARSAI;

module.exports = {
  SARSAI_PER_MARLA,
  MARLA_PER_KANAL,
  SARSAIS_PER_KANAL,
  SQFT_PER_SARSAI,
  normalizeArea,
  parseAreaInput,
  toSarsais,
  fromSarsais,
  addAreas,
  subtractAreas,
  formatKMS,
  toSqFt
};
