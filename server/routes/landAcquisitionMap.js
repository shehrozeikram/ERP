const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandRegistry = require('../models/tajResidencia/LandRegistry');
const LandPossession = require('../models/tajResidencia/LandPossession');
const { buildMozaAcquisitionStatus, deriveStatus } = require('../utils/landAcquisitionStatus');
const { addAreas, normalizeArea, toSarsais, subtractAreas } = require('../utils/landAreaUnits');

const router = express.Router();

const normalizeKhasraNo = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const parts = raw.split('/');
  const head = parts[0].replace(/^0+(?=\d)/, '') || parts[0];
  return parts.length > 1 ? `${head}/${parts.slice(1).join('/')}` : head;
};

const statusKey = (slug, khasraNo) => `${slug}:${normalizeKhasraNo(khasraNo)}`;

const mergeRegisteredLine = (status, line) => {
  const transferPercent = Math.min(100, Math.max(0, Number(line.transferPercent) || 0));
  if (transferPercent > 0) {
    status.registryTransferPercent = Math.min(100, (status.registryTransferPercent || 0) + transferPercent);
  }

  const patch = normalizeArea(line.acquiredArea);
  if (toSarsais(patch) <= 0) return;
  status.registered = addAreas(status.registered || { kanal: 0, marla: 0, sarsai: 0 }, patch);
  if (!status.khewatNo && line.khewatNo) status.khewatNo = line.khewatNo;
  if (!status.khasraNo && line.khasraNo) status.khasraNo = line.khasraNo;
  if (status.purchaseStatus === 'not_purchased') status.purchaseStatus = 'purchased';
  if (status.possessionStatus === 'not_possessed') status.possessionStatus = 'purchased_not_possessed';
};

const mergePossessedLine = (status, line) => {
  const transferPercent = Math.min(100, Math.max(0, Number(line.transferPercent) || 0));
  if (transferPercent > 0) {
    status.possessionTransferPercent = Math.min(100, (status.possessionTransferPercent || 0) + transferPercent);
  }

  const patch = normalizeArea(line.possessedArea);
  if (toSarsais(patch) <= 0) return;
  status.possessed = addAreas(status.possessed || { kanal: 0, marla: 0, sarsai: 0 }, patch);
  if (!status.khewatNo && line.khewatNo) status.khewatNo = line.khewatNo;
  if (!status.khasraNo && line.khasraNo) status.khasraNo = line.khasraNo;
};

// GET /api/taj-residencia/land-acquisition/map-status
router.get('/map-status', asyncHandler(async (req, res) => {
  const mozas = await LandMoza.find({ isActive: true })
    .select('name slug')
    .sort({ name: 1 })
    .lean();

  const status = {};
  const recordsByMoza = {};

  for (const moza of mozas) {
    const rows = await buildMozaAcquisitionStatus(moza._id);
    rows.forEach((row) => {
      const key = statusKey(moza.slug, row.khasraNo);
      status[key] = {
        khasraEntryId: row.khasraEntryId,
        khewatNo: row.khewatNo,
        khasraNo: row.khasraNo,
        purchaseStatus: 'not_purchased',
        possessionStatus: 'not_possessed',
        baseline: row.baseline,
        registered: { kanal: 0, marla: 0, sarsai: 0 },
        possessed: { kanal: 0, marla: 0, sarsai: 0 },
        remainingToRegister: row.baseline,
        remainingToPossess: { kanal: 0, marla: 0, sarsai: 0 },
        registryTransferPercent: 0,
        possessionTransferPercent: 0
      };
    });

    const [registries, possessions] = await Promise.all([
      LandRegistry.find({ moza: moza._id, isActive: true }).lean(),
      LandPossession.find({ moza: moza._id, isActive: true }).lean()
    ]);

    recordsByMoza[moza.slug] = {
      registryCount: registries.length,
      possessionCount: possessions.length
    };

    registries.forEach((registry) => {
      (registry.lines || []).forEach((line) => {
        if (!line.khasraNo) return;
        const key = statusKey(moza.slug, line.khasraNo);
        if (!status[key]) {
          status[key] = {
            khasraEntryId: line.khasraEntry || null,
            khewatNo: line.khewatNo || registry.khewatNo || '',
            khasraNo: line.khasraNo,
            purchaseStatus: 'not_purchased',
            possessionStatus: 'not_possessed',
            baseline: { kanal: 0, marla: 0, sarsai: 0 },
            registered: { kanal: 0, marla: 0, sarsai: 0 },
            possessed: { kanal: 0, marla: 0, sarsai: 0 },
            remainingToRegister: { kanal: 0, marla: 0, sarsai: 0 },
            remainingToPossess: { kanal: 0, marla: 0, sarsai: 0 },
            registryTransferPercent: 0,
            possessionTransferPercent: 0
          };
        }
        mergeRegisteredLine(status[key], line);
      });
    });

    possessions.forEach((possession) => {
      (possession.lines || []).forEach((line) => {
        if (!line.khasraNo) return;
        const key = statusKey(moza.slug, line.khasraNo);
        if (!status[key]) {
          status[key] = {
            khasraEntryId: line.khasraEntry || null,
            khewatNo: line.khewatNo || possession.khewatNo || '',
            khasraNo: line.khasraNo,
            purchaseStatus: 'not_purchased',
            possessionStatus: 'not_possessed',
            baseline: { kanal: 0, marla: 0, sarsai: 0 },
            registered: { kanal: 0, marla: 0, sarsai: 0 },
            possessed: { kanal: 0, marla: 0, sarsai: 0 },
            remainingToRegister: { kanal: 0, marla: 0, sarsai: 0 },
            remainingToPossess: { kanal: 0, marla: 0, sarsai: 0 },
            registryTransferPercent: 0,
            possessionTransferPercent: 0
          };
        }
        mergePossessedLine(status[key], line);
      });
    });

    Object.keys(status)
      .filter((key) => key.startsWith(`${moza.slug}:`))
      .forEach((key) => {
        const row = status[key];
        row.remainingToRegister = subtractAreas(row.baseline, row.registered);
        row.remainingToPossess = subtractAreas(row.registered, row.possessed);
        const derived = deriveStatus(row.baseline, row.registered, row.possessed);
        row.purchaseStatus = derived.purchaseStatus;
        row.possessionStatus = derived.possessionStatus;
      });
  }

  const summary = Object.values(status).reduce((acc, row) => {
    if ((row.registryTransferPercent || 0) > 0) acc.khasrasWithRegistry += 1;
    if ((row.possessionTransferPercent || 0) > 0) acc.khasrasWithPossession += 1;
    return acc;
  }, { khasrasWithRegistry: 0, khasrasWithPossession: 0 });

  summary.registryDocuments = Object.values(recordsByMoza)
    .reduce((sum, row) => sum + (row.registryCount || 0), 0);
  summary.possessionDocuments = Object.values(recordsByMoza)
    .reduce((sum, row) => sum + (row.possessionCount || 0), 0);

  res.json({
    success: true,
    data: {
      mozas,
      status,
      recordsByMoza,
      summary
    }
  });
}));

module.exports = router;
