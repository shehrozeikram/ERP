const parseKhewatList = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '—') return [];
  return raw.split(',').map((part) => part.trim()).filter(Boolean);
};

const normalizeKhewatToken = (value) => String(value ?? '').trim().replace(/\.0+$/, '');

const khewatMatches = (entryKhewat, selectedKhewat) => {
  const selected = normalizeKhewatToken(selectedKhewat);
  if (!selected) return false;

  const parts = parseKhewatList(entryKhewat);
  if (parts.length) {
    return parts.some((part) => normalizeKhewatToken(part) === selected);
  }

  return normalizeKhewatToken(entryKhewat) === selected;
};

const collectKhewatsFromEntries = (entries) => {
  const set = new Set();
  entries.forEach((entry) => {
    const parts = parseKhewatList(entry.khewatNo);
    if (parts.length) {
      parts.forEach((part) => set.add(normalizeKhewatToken(part)));
    } else {
      const single = normalizeKhewatToken(entry.khewatNo);
      if (single) set.add(single);
    }
  });
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};

const khewatMongoFilter = (selectedKhewat) => {
  const selected = normalizeKhewatToken(selectedKhewat);
  if (!selected) return null;

  const escaped = selected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    $or: [
      { khewatNo: selected },
      { khewatNo: new RegExp(`(^|,\\s*)${escaped}(\\s*,|\\s*$)`) }
    ]
  };
};

module.exports = {
  parseKhewatList,
  normalizeKhewatToken,
  khewatMatches,
  collectKhewatsFromEntries,
  khewatMongoFilter
};
