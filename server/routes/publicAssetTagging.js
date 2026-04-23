const express = require('express');
const { body, validationResult } = require('express-validator');
const asyncHandler = require('express-async-handler');
const router = express.Router();

const FixedAsset = require('../models/finance/FixedAsset');
const Project = require('../models/hr/Project');
const AssetTag = require('../models/assetTagging/AssetTag');
const AssetTagEvent = require('../models/assetTagging/AssetTagEvent');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

async function resolveProjectObject(projectValue) {
  if (!projectValue) return null;
  if (typeof projectValue === 'object' && (projectValue.name || projectValue.code || projectValue.projectId)) {
    return {
      name: projectValue.name || ''
    };
  }

  const projectId = typeof projectValue === 'object' ? (projectValue._id || projectValue.id) : projectValue;
  if (!projectId) return null;
  const project = await Project.findById(projectId).select('name code projectId').lean();
  if (!project) return null;
  return {
    name: project.name || ''
  };
}

// Public resolve endpoint for QR scans (no authentication)
router.get('/resolve/:tagCode', asyncHandler(async (req, res) => {
  const tagCode = decodeURIComponent(req.params.tagCode);
  const tag = await AssetTag.findOne({ tagCode, status: 'active' }).populate('asset');
  if (!tag) return res.status(404).json({ success: false, message: 'Tag not found or void' });

  const assetDoc = await FixedAsset.findById(tag.asset._id || tag.asset).lean();
  if (!assetDoc) return res.status(404).json({ success: false, message: 'Asset not found' });
  const project = await resolveProjectObject(assetDoc.project);

  // Keep public payload intentionally minimal for unauthenticated access.
  const asset = {
    _id: assetDoc._id,
    assetNumber: assetDoc.assetNumber,
    name: assetDoc.name,
    category: assetDoc.category,
    location: assetDoc.location,
    assignedTo: assetDoc.assignedTo || '',
    project,
    serialNumber: assetDoc.serialNumber,
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
