const XLSX = require('xlsx');

const toNum = (v) => {
  if (v === '' || v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => (v == null ? '' : String(v).trim());

const parseArea = (row, startCol) => ({
  kanal: toNum(row[startCol]),
  marla: toNum(row[startCol + 1]),
  sarsai: toNum(row[startCol + 2])
});

const hasArea = (area) => area.kanal || area.marla || area.sarsai;

const slugify = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const extractMozaNameFromText = (text) => {
  const cell = toStr(text);
  if (!cell) return '';

  const labelled = cell.match(/mou?za\s*[:\-]?\s*(.+)/i);
  if (labelled?.[1]?.trim()) return labelled[1].trim();

  if (/^mou?za$/i.test(cell)) return '';

  return cell.replace(/^mou?za\s*/i, '').trim();
};

const findMozaName = (rows, fallbackName = '') => {
  const fallback = toStr(fallbackName);
  if (fallback) return fallback;

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    for (let j = 0; j < row.length; j++) {
      const part = extractMozaNameFromText(row[j]);
      if (part && !/^sr\.?\s*no/i.test(part) && !/^khasra/i.test(part)) {
        if (/^mou?za$/i.test(toStr(row[j])) && row[j + 1]) {
          const next = toStr(row[j + 1]);
          if (next) return next;
        }
        return part;
      }
    }

    if (/^mou?za$/i.test(toStr(row[0])) && toStr(row[1])) {
      return toStr(row[1]);
    }
  }

  return '';
};

const isHeaderRow = (row) => {
  const c0 = toStr(row?.[0]).toLowerCase();
  const c1 = toStr(row?.[1]).toLowerCase();
  return (c0.includes('sr') && c1.includes('khasra'))
    || (c0 === 'sr. no' || c0 === 'sr no');
};

const isSubHeaderRow = (row) => {
  const units = [toStr(row?.[3]), toStr(row?.[4]), toStr(row?.[5])].map((v) => v.toUpperCase());
  return units[0] === 'K' && (units[1] === 'M' || units[1] === 'S');
};

const looksLikeDataRow = (row) => {
  const srNo = toNum(row?.[0]);
  const khasraNo = toStr(row?.[1]);
  const khewatNo = toStr(row?.[2]);
  return srNo >= 1 && Boolean(khasraNo || khewatNo);
};

const findDataStartRow = (rows) => {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    if (looksLikeDataRow(rows[i])) return i;
    if (isHeaderRow(rows[i])) {
      let start = i + 1;
      if (isSubHeaderRow(rows[start])) start += 1;
      return start;
    }
  }
  return 3;
};

/**
 * Parse land acquisition moza sheet (Sheikhpur-style layout).
 * @param {string|Buffer} input - file path or buffer
 * @param {{ fallbackMozaName?: string }} options
 * @returns {{ mozaName: string, slug: string, entries: object[] }}
 */
const parseLandMozaExcel = (input, options = {}) => {
  const wb = typeof input === 'string'
    ? XLSX.readFile(input)
    : XLSX.read(input, { type: 'buffer' });

  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });

  if (!rows.length) {
    const err = new Error('Excel file is empty');
    err.statusCode = 400;
    throw err;
  }

  const mozaName = findMozaName(rows, options.fallbackMozaName);
  const dataStart = findDataStartRow(rows);

  const entries = [];
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    if (isHeaderRow(row) || isSubHeaderRow(row)) continue;

    const srNo = toNum(row[0]);
    const khasraNo = toStr(row[1]);
    const khewatNo = toStr(row[2]);

    if (!srNo && !khasraNo && !khewatNo) continue;

    const landInKhasra = parseArea(row, 3);

    if (!khasraNo && !khewatNo && !hasArea(landInKhasra)) continue;

    entries.push({
      srNo: srNo || entries.length + 1,
      khasraNo: khasraNo || '—',
      khewatNo: khewatNo || '—',
      landInKhasra,
      mozaRef: toStr(row[6]) || toStr(row[21])
    });
  }

  if (!mozaName && !entries.length) {
    const err = new Error(
      'Could not read mouza name or khasra data. Ensure row 1 has "Mouza <name>" or import into an existing mouza.'
    );
    err.statusCode = 400;
    throw err;
  }

  if (!mozaName) {
    const err = new Error(
      'Could not read mouza name from the file. Add "Mouza YourName" in the first rows, or select a target mouza before import.'
    );
    err.statusCode = 400;
    throw err;
  }

  if (!entries.length) {
    const err = new Error('No khasra rows found in the Excel file. Check the sheet layout matches the land acquisition template.');
    err.statusCode = 400;
    throw err;
  }

  return { mozaName, slug: slugify(mozaName), entries };
};

module.exports = {
  parseLandMozaExcel,
  slugify,
  findMozaName,
  findDataStartRow
};
