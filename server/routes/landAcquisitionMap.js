const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const LandMoza = require('../models/tajResidencia/LandMoza');
const { buildMozaAcquisitionStatus } = require('../utils/landAcquisitionStatus');

const router = express.Router();

// GET /api/taj-residencia/land-acquisition/map-status
router.get('/map-status', asyncHandler(async (req, res) => {
  const mozas = await LandMoza.find({ isActive: true })
    .select('name slug')
    .sort({ name: 1 })
    .lean();

  const status = {};

  for (const moza of mozas) {
    const rows = await buildMozaAcquisitionStatus(moza._id);
    rows.forEach((row) => {
      const key = `${moza.slug}:${String(row.khasraNo).trim()}`;
      status[key] = {
        khasraEntryId: row.khasraEntryId,
        khewatNo: row.khewatNo,
        khasraNo: row.khasraNo,
        purchaseStatus: row.purchaseStatus,
        possessionStatus: row.possessionStatus,
        baseline: row.baseline,
        registered: row.registered,
        possessed: row.possessed,
        remainingToRegister: row.remainingToRegister,
        remainingToPossess: row.remainingToPossess
      };
    });
  }

  res.json({
    success: true,
    data: {
      mozas,
      status
    }
  });
}));

module.exports = router;
