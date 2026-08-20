const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
const LandRegistry = require('../models/tajResidencia/LandRegistry');
const LandPossession = require('../models/tajResidencia/LandPossession');
const LandExchange = require('../models/tajResidencia/LandExchange');
const { addAreas, subtractAreas, normalizeArea, toSarsais } = require('./landAreaUnits');
const { khewatMongoFilter } = require('./landKhewatUtils');

const areaByKhasra = (docs, lineKey, areaKey) => {
  const map = new Map();
  docs.forEach((doc) => {
    (doc[lineKey] || []).forEach((line) => {
      const id = String(line.khasraEntry || '');
      if (!id) return;
      const patch = normalizeArea(line[areaKey]);
      const prev = map.get(id) || { kanal: 0, marla: 0, sarsai: 0 };
      map.set(id, addAreas(prev, patch));
    });
  });
  return map;
};

const deriveStatus = (baseline, registered, possessed) => {
  const b = toSarsais(baseline);
  const r = toSarsais(registered);
  const p = toSarsais(possessed);

  let purchaseStatus = 'not_purchased';
  if (r > 0 && b > 0 && r < b) purchaseStatus = 'partial_purchased';
  else if (r > 0 && (b === 0 || r >= b)) purchaseStatus = 'fully_purchased';
  else if (r > 0 && b === 0) purchaseStatus = 'purchased';

  let possessionStatus = 'not_possessed';
  if (p > 0 && r > 0 && p < r) possessionStatus = 'partial_possession';
  else if (p > 0 && r > 0 && p >= r) possessionStatus = 'fully_possessed';
  else if (p > 0 && r === 0) possessionStatus = 'possessed_unregistered';

  if (r > 0 && p === 0) possessionStatus = 'purchased_not_possessed';

  return { purchaseStatus, possessionStatus };
};

const buildMozaAcquisitionStatus = async (mozaId, { khewatNo, search } = {}) => {
  const khasraFilter = { moza: mozaId };
  if (khewatNo) {
    const khewatFilter = khewatMongoFilter(khewatNo);
    if (khewatFilter) Object.assign(khasraFilter, khewatFilter);
  }

  const [khasras, registries, possessions, exchanges] = await Promise.all([
    LandMozaKhasraEntry.find(khasraFilter).sort({ srNo: 1 }).lean(),
    LandRegistry.find({ moza: mozaId, isActive: true }).lean(),
    LandPossession.find({ moza: mozaId, isActive: true }).lean(),
    LandExchange.find({
      isActive: true,
      $or: [
        { moza: mozaId },
        { 'outLandLines.moza': mozaId },
        { 'inLandLines.moza': mozaId }
      ]
    }).lean()
  ]);

  const rawRegisteredMap = areaByKhasra(registries, 'lines', 'acquiredArea');
  const possessedMap = areaByKhasra(possessions, 'lines', 'possessedArea');
  const exchangedOutMap = areaByKhasra(exchanges, 'outLandLines', 'surrenderedArea');
  const exchangedInMap = areaByKhasra(exchanges, 'inLandLines', 'acquiredArea');

  let rows = khasras.map((entry) => {
    const id = String(entry._id);
    const baseline = normalizeArea(entry.landInKhasra);
    const rawRegistered = rawRegisteredMap.get(id) || { kanal: 0, marla: 0, sarsai: 0 };
    const exchangedOut = exchangedOutMap.get(id) || { kanal: 0, marla: 0, sarsai: 0 };
    const exchangedIn = exchangedInMap.get(id) || { kanal: 0, marla: 0, sarsai: 0 };

    // Net Registered = (Registry Acquired - Exchanged Out) + Exchanged In
    const afterOut = subtractAreas(rawRegistered, exchangedOut);
    const registered = addAreas(afterOut, exchangedIn);

    const possessed = possessedMap.get(id) || { kanal: 0, marla: 0, sarsai: 0 };
    const { purchaseStatus, possessionStatus } = deriveStatus(baseline, registered, possessed);

    return {
      khasraEntryId: entry._id,
      srNo: entry.srNo,
      khewatNo: entry.khewatNo,
      khasraNo: entry.khasraNo,
      baseline,
      registered,
      rawRegistered,
      exchangedOut,
      exchangedIn,
      possessed,
      remainingToRegister: subtractAreas(baseline, registered),
      remainingToPossess: subtractAreas(registered, possessed),
      purchaseStatus,
      possessionStatus
    };
  });

  if (search) {
    const re = new RegExp(search, 'i');
    rows = rows.filter((row) =>
      re.test(row.khasraNo) || re.test(row.khewatNo)
    );
  }

  return rows;
};

module.exports = {
  buildMozaAcquisitionStatus,
  deriveStatus
};
