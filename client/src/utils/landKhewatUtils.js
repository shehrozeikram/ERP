export const parseKhewatList = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '—') return [];
  return raw.split(',').map((part) => part.trim()).filter(Boolean);
};

export const normalizeKhewatToken = (value) =>
  String(value ?? '').trim().replace(/\.0+$/, '');

export const khewatMatches = (entryKhewat, selectedKhewat) => {
  const selected = normalizeKhewatToken(selectedKhewat);
  if (!selected) return false;

  const parts = parseKhewatList(entryKhewat);
  if (parts.length) {
    return parts.some((part) => normalizeKhewatToken(part) === selected);
  }

  return normalizeKhewatToken(entryKhewat) === selected;
};

export const countKhasrasForKhewat = (entries, selectedKhewat) =>
  entries.filter((entry) => khewatMatches(entry.khewatNo, selectedKhewat)).length;

export const findMatchingSelectedKhewat = (entry, selectedKhewats = []) => {
  for (const k of selectedKhewats) {
    if (khewatMatches(entry.khewatNo, k)) return k;
  }
  return selectedKhewats[0] || '';
};

export const uniqueKhasrasForKhewats = (entries, selectedKhewats = []) => {
  const seen = new Map();
  entries.forEach((entry) => {
    if (!selectedKhewats.some((k) => khewatMatches(entry.khewatNo, k))) return;
    if (!seen.has(entry._id)) seen.set(entry._id, entry);
  });
  return [...seen.values()];
};

export const countKhasrasForKhewats = (entries, selectedKhewats = []) =>
  uniqueKhasrasForKhewats(entries, selectedKhewats).length;

export const parseKhewatNos = (value) => {
  if (Array.isArray(value)) return value.map((k) => normalizeKhewatToken(k)).filter(Boolean);
  return parseKhewatList(value);
};
