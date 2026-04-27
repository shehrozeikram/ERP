const express = require('express');
const { body, validationResult } = require('express-validator');
const asyncHandler = require('express-async-handler');
const router = express.Router();

const FixedAsset = require('../models/finance/FixedAsset');
const AssetTag = require('../models/assetTagging/AssetTag');
const AssetTagEvent = require('../models/assetTagging/AssetTagEvent');
const {
  normalizeLookupString,
  applyRawFixedAssetLookupFallback
} = require('../utils/fixedAssetLookupResolve');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

// Public resolve endpoint for QR scans (no authentication)
router.get('/resolve/:tagCode', asyncHandler(async (req, res) => {
  const tagCode = decodeURIComponent(req.params.tagCode);
  const tag = await AssetTag.findOne({ tagCode, status: 'active' }).populate('asset');
  if (!tag) return res.status(404).json({ success: false, message: 'Tag not found or void' });

  const assetDoc = await FixedAsset.findById(tag.asset._id || tag.asset)
    .populate('project', 'name code projectId')
    .lean();
  if (!assetDoc) return res.status(404).json({ success: false, message: 'Asset not found' });

  await applyRawFixedAssetLookupFallback(FixedAsset, assetDoc);

  // Keep public payload intentionally minimal for unauthenticated access.
  const asset = {
    _id: assetDoc._id,
    assetNumber: assetDoc.assetNumber,
    name: assetDoc.name,
    category: assetDoc.category,
    location: assetDoc.location,
    assignedTo: normalizeLookupString(assetDoc.assignedTo),
    serialNumber: normalizeLookupString(assetDoc.serialNumber),
    project: assetDoc.project
      ? {
          _id: assetDoc.project._id,
          name: assetDoc.project.name || '',
          code: assetDoc.project.code || '',
          projectId: assetDoc.project.projectId || ''
        }
      : null,
    status: assetDoc.status
  };

  res.json({
    success: true,
    data: {
      tag: { tagCode: tag.tagCode, issuedAt: tag.issuedAt },
      asset,
      transferHistory: []
    }
  });
}));

// Optional public scan logging endpoint (anonymous user)
router.post(
  '/scan',
  [body('tagCode').trim().notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const tagCode = String(req.body.tagCode).trim();
    const tag = await AssetTag.findOne({ tagCode, status: 'active' });
    if (!tag) return res.status(404).json({ success: false, message: 'Tag not found or void' });

    await AssetTagEvent.create({
      asset: tag.asset,
      tagCode,
      eventType: 'scan',
      note: req.body.note || 'Public QR scan'
    });

    return res.json({ success: true, message: 'Scan recorded' });
  })
);

module.exports = router;
