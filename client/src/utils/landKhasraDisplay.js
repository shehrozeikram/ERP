/** Shared khasra / khewat labels and sorting for land acquisition UI */

export const sortKhasraEntries = (rows = []) =>
  [...rows].sort((a, b) => {
    const kw = String(a.khewatNo || '').localeCompare(String(b.khewatNo || ''), undefined, { numeric: true });
    if (kw !== 0) return kw;
    return String(a.khasraNo || '').localeCompare(String(b.khasraNo || ''), undefined, { numeric: true });
  });

/** Primary label for khasra autocomplete (Khasra column) */
export const formatKhasraSelectLabel = (row) => {
  if (!row) return '';
  return `Khasra ${row.khasraNo}`;
};

/** Full label for tooltips / detail views */
export const formatKhasraKhewatLabel = (khasraNo, khewatNo) => {
  if (!khasraNo) return '—';
  if (khewatNo) return `Khewat ${khewatNo} · Khasra ${khasraNo}`;
  return `Khasra ${khasraNo}`;
};

/** Resolve khasra/khewat from moza master by entry id, with optional fallback */
export const resolveKhasraFields = (entryId, mozaKhasras = [], fallback = {}) => {
  const master = entryId
    ? mozaKhasras.find((k) => String(k._id) === String(entryId))
    : null;
  return {
    khewatNo: master?.khewatNo ?? fallback.khewatNo ?? '',
    khasraNo: master?.khasraNo ?? fallback.khasraNo ?? ''
  };
};
