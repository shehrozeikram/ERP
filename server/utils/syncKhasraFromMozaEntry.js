const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');

const entryMapForIds = async (entryIds) => {
  const ids = [...new Set((entryIds || []).filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const entries = await LandMozaKhasraEntry.find({ _id: { $in: ids } })
    .select('khasraNo khewatNo landInKhasra')
    .lean();
  return new Map(entries.map((e) => [String(e._id), e]));
};

const applyEntryToLine = (line, entry) => {
  if (!entry) return line;
  return {
    ...line,
    khewatNo: entry.khewatNo,
    khasraNo: entry.khasraNo
  };
};

/** Sync registry line khasra/khewat from moza master when khasraEntry is set */
const enrichRegistryLines = async (lines = []) => {
  const byId = await entryMapForIds(lines.map((l) => l.khasraEntry));
  return lines.map((line) => applyEntryToLine(line, byId.get(String(line.khasraEntry))));
};

/** Sync possession line khasra/khewat (and registry khasra fields) from moza master */
const enrichPossessionLines = async (lines = []) => {
  const byId = await entryMapForIds(
    lines.flatMap((l) => [l.khasraEntry, l.registryKhasraEntry])
  );
  return lines.map((line) => {
    let next = applyEntryToLine(line, byId.get(String(line.khasraEntry)));
    const regEntry = byId.get(String(line.registryKhasraEntry));
    if (regEntry) {
      next = {
        ...next,
        registryKhewatNo: regEntry.khewatNo,
        registryKhasraNo: regEntry.khasraNo
      };
    }
    return next;
  });
};

module.exports = {
  enrichRegistryLines,
  enrichPossessionLines
};
