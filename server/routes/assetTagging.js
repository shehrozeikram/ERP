const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const asyncHandler = require('express-async-handler');
const QRCode = require('qrcode');
const { authorize } = require('../middleware/auth');
const FixedAsset = require('../models/finance/FixedAsset');
const Project = require('../models/hr/Project');
const AssetTag = require('../models/assetTagging/AssetTag');
const AssetTagEvent = require('../models/assetTagging/AssetTagEvent');
const AssetVerificationSession = require('../models/assetTagging/AssetVerificationSession');
const {
  normalizeLookupString,
  applyRawFixedAssetLookupFallback
} = require('../utils/fixedAssetLookupResolve');

const TAG_ROLES = ['super_admin', 'developer', 'admin', 'finance_manager', 'procurement_manager', 'audit_manager', 'higher_management'];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

function clientOrigin() {
  return (
    process.env.ASSET_TAGGING_SCAN_BASE_URL ||
    process.env.CLIENT_URL ||
    process.env.REACT_APP_API_URL?.replace(/\/api\/?$/, '') ||
    (process.env.NODE_ENV === 'production' ? 'https://tovus.net' : 'http://localhost:3000')
  );
}

function scanUrlForTag(tagCode) {
  const enc = encodeURIComponent(tagCode);
  return `${clientOrigin().replace(/\/$/, '')}/asset-tagging/scan/${enc}`;
}

async function ensureAssetProjectObject(assetDoc) {
  if (!assetDoc) return assetDoc;
  const project = assetDoc.project;
  if (!project) return assetDoc;

  // Already populated enough for label rendering.
  if (typeof project === 'object' && (project.name || project.code || project.projectId)) {
    return assetDoc;
  }

  const projectId = typeof project === 'object' ? (project._id || project.id) : project;
  if (!projectId) return assetDoc;

  const fresh = await Project.findById(projectId).select('name code projectId').lean();
  if (fresh) assetDoc.project = fresh;
  return assetDoc;
}

/** Build unique tag code for an asset */
async function nextTagCodeForAsset(asset) {
  const n = await AssetTag.countDocuments({ asset: asset._id });
  const base = asset.assetNumber || String(asset._id);
  if (n === 0) return `TAG-${base}`;
  return `TAG-${base}-R${n + 1}`;
}

async function logEvent(payload) {
  return AssetTagEvent.create(payload);
}

// ── GET /api/asset-tagging/dashboard-stats
router.get('/dashboard-stats', authorize(...TAG_ROLES), asyncHandler(async (req, res) => {
  const [assetCount, taggedActive, openSessions, recentEvents] = await Promise.all([
    FixedAsset.countDocuments({ status: 'active' }),
    AssetTag.countDocuments({ status: 'active' }),
    AssetVerificationSession.countDocuments({ status: 'open' }),
    AssetTagEvent.find().sort({ createdAt: -1 }).limit(20).populate('user', 'firstName lastName email').populate('asset', 'assetNumber name')
  ]);

  res.json({
    success: true,
    data: {
      activeAssets: assetCount,
      taggedActive,
      untaggedActive: Math.max(0, assetCount - taggedActive),
      openVerificationSessions: openSessions,
      recentEvents
    }
  });
}));

// ── GET /api/asset-tagging/assets — list fixed assets with current tag
router.get('/assets', authorize(...TAG_ROLES), asyncHandler(async (req, res) => {
  const { status, search, tagStatus } = req.query;
  const filter = {};
  const allowedStatus = ['active', 'disposed', 'fully_depreciated', 'all'];
  if (status === 'all') {
    // full register (all ledger statuses)
  } else if (status && allowedStatus.includes(String(status))) {
    filter.status = status;
  } else {
    filter.status = { $in: ['active', 'fully_depreciated'] };
  }

  let assets = await FixedAsset.find(filter)
    .populate('project', 'name code projectId')
    .populate('costCenter', 'name code')
    .sort({ assetNumber: 1 })
    .lean();

  if (search) {
    const q = String(search).toLowerCase();
    assets = assets.filter(
      (a) =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.assetNumber || '').toLowerCase().includes(q) ||
        (a.location || '').toLowerCase().includes(q) ||
        (a.serialNumber || '').toLowerCase().includes(q)
    );
  }

  const assetIds = assets.map((a) => a._id);
  const tags = await AssetTag.find({ asset: { $in: assetIds }, status: 'active' }).lean();
  const tagByAsset = {};
  tags.forEach((t) => {
    tagByAsset[t.asset.toString()] = t;
  });

  let rows = assets.map((a) => ({
    ...a,
    currentTag: tagByAsset[a._id.toString()] || null
  }));

  if (tagStatus === 'tagged') rows = rows.filter((r) => r.currentTag);
  if (tagStatus === 'untagged') rows = rows.filter((r) => !r.currentTag);

  res.json({ success: true, data: rows, count: rows.length });
}));

// ── GET /api/asset-tagging/assets/:assetId — one asset + active tag (for label / detail)
router.get('/assets/:assetId', authorize(...TAG_ROLES), asyncHandler(async (req, res) => {
  const asset = await FixedAsset.findById(req.params.assetId)
    .populate('project', 'name code projectId')
    .populate('costCenter', 'name code');
  if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
  await ensureAssetProjectObject(asset);
  const currentTag = await AssetTag.findOne({ asset: asset._id, status: 'active' });
  res.json({ success: true, data: { asset, currentTag } });
}));

// ── GET /api/asset-tagging/events
router.get('/events', authorize(...TAG_ROLES), asyncHandler(async (req, res) => {
  const { assetId, limit = 100 } = req.query;
  const q = {};
  if (assetId) q.asset = assetId;
  const events = await AssetTagEvent.find(q)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 100, 500))
    .populate('user', 'firstName lastName email')
    .populate('asset', 'assetNumber name location')
    .populate('session', 'sessionNumber name status');
  res.json({ success: true, data: events });
}));

// ── GET /api/asset-tagging/resolve/:tagCode
router.get('/resolve/:tagCode', authorize(...TAG_ROLES), asyncHandler(async (req, res) => {
  const tagCode = decodeURIComponent(req.params.tagCode);
  const tag = await AssetTag.findOne({ tagCode, status: 'active' }).populate('asset');
  if (!tag) return res.status(404).json({ success: false, message: 'Tag not found or void' });

  const asset = await FixedAsset.findById(tag.asset._id || tag.asset)
    .populate('project', 'name code projectId')
    .populate('costCenter', 'name code')
    .lean();
  if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });

  await ensureAssetProjectObject(asset);
  await applyRawFixedAssetLookupFallback(FixedAsset, asset);
  asset.serialNumber = normalizeLookupString(asset.serialNumber);
  asset.assignedTo = normalizeLookupString(asset.assignedTo);

  const transferHistory = await AssetTagEvent.find({
    asset: asset._id,
    eventType: 'transfer'
  })
    .sort({ createdAt: -1 })
    .limit(30)
    .populate('user', 'firstName lastName email')
    .lean();

  res.json({
    success: true,
    data: {
      tag: { tagCode: tag.tagCode, issuedAt: tag.issuedAt },
      asset,
      scanUrl: scanUrlForTag(tag.tagCode),
      transferHistory
    }
  });
}));

// ── GET /api/asset-tagging/label-qr/:tagCode — data URL PNG for QR
router.get('/label-qr/:tagCode', authorize(...TAG_ROLES), asyncHandler(async (req, res) => {
  const tagCode = decodeURIComponent(req.params.tagCode);
  const tag = await AssetTag.findOne({ tagCode, status: 'active' });
  if (!tag) return res.status(404).json({ success: false, message: 'Active tag not found' });

  // Encode plain tag code instead of route URL so generic mobile scanners
  // do not show/open a web link preview.
  const encodedValue = tagCode;
  const dataUrl = await QRCode.toDataURL(encodedValue, { width: 256, margin: 1, errorCorrectionLevel: 'M' });
  res.json({ success: true, data: { dataUrl, url: encodedValue, tagCode } });
}));

// ── POST /api/asset-tagging/scan — log a scan event
router.post(
  '/scan',
  authorize(...TAG_ROLES),
  [body('tagCode').trim().notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const tagCode = String(req.body.tagCode).trim();
    const tag = await AssetTag.findOne({ tagCode, status: 'active' });
    if (!tag) return res.status(404).json({ success: false, message: 'Tag not found or void' });

    await logEvent({
      asset: tag.asset,
      tagCode,
      eventType: 'scan',
      user: req.user._id,
      note: req.body.note || ''
    });

    const asset = await FixedAsset.findById(tag.asset);
    res.json({ success: true, message: 'Scan recorded', data: { assetId: asset._id, assetNumber: asset.assetNumber } });
  })
);

// ── POST /api/asset-tagging/assets/:assetId/issue-tag
router.post('/assets/:assetId/issue-tag', authorize(...TAG_ROLES), asyncHandler(async (req, res) => {
  const asset = await FixedAsset.findById(req.params.assetId);
  if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
  if (asset.status === 'disposed') return res.status(400).json({ success: false, message: 'Cannot tag disposed asset' });

  const existing = await AssetTag.find({ asset: asset._id, status: 'active' });
  for (const t of existing) {
    t.status = 'void';
    t.voidedAt = new Date();
    t.voidedBy = req.user._id;
    t.voidReason = req.body.replaceReason || 'Replaced by new tag';
    await t.save();
    await logEvent({
      asset: asset._id,
      tagCode: t.tagCode,
      eventType: 'tag_voided',
      user: req.user._id,
      note: t.voidReason
    });
  }

  const tagCode = await nextTagCodeForAsset(asset);
  const tag = await AssetTag.create({
    tagCode,
    asset: asset._id,
    status: 'active',
    issuedBy: req.user._id
  });

  await logEvent({
    asset: asset._id,
    tagCode,
    eventType: 'tag_issued',
    user: req.user._id,
    note: req.body.note || ''
  });

  res.status(201).json({
    success: true,
    data: { tag, scanUrl: scanUrlForTag(tagCode) }
  });
}));

// ── DELETE /api/asset-tagging/assets/:assetId — remove fixed asset (tags + events); blocked if posted depreciation
router.delete(
  '/assets/:assetId',
  authorize(...TAG_ROLES),
  asyncHandler(async (req, res) => {
    const asset = await FixedAsset.findById(req.params.assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });

    const posted = (asset.depreciationSchedule || []).some((d) => d.status === 'posted');
    if (posted) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot delete this asset because it has posted depreciation. Dispose it from Finance → Fixed Assets instead.'
      });
    }

    await Promise.all([
      AssetTag.deleteMany({ asset: asset._id }),
      AssetTagEvent.deleteMany({ asset: asset._id })
    ]);
    await FixedAsset.deleteOne({ _id: asset._id });

    res.json({ success: true, message: 'Asset deleted' });
  })
);

// ── POST /api/asset-tagging/assets/:assetId/void-tag
router.post(
  '/assets/:assetId/void-tag',
  authorize(...TAG_ROLES),
  [body('reason').trim().notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const asset = await FixedAsset.findById(req.params.assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });

    const tag = await AssetTag.findOne({ asset: asset._id, status: 'active' });
    if (!tag) return res.status(400).json({ success: false, message: 'No active tag on this asset' });

    tag.status = 'void';
    tag.voidedAt = new Date();
    tag.voidedBy = req.user._id;
    tag.voidReason = req.body.reason;
    await tag.save();

    await logEvent({
      asset: asset._id,
      tagCode: tag.tagCode,
      eventType: 'tag_voided',
      user: req.user._id,
      note: req.body.reason
    });

    res.json({ success: true, data: tag });
  })
);

// ── PUT /api/asset-tagging/assets/:assetId/custody — location + assignedTo
router.put(
  '/assets/:assetId/custody',
  authorize(...TAG_ROLES),
  asyncHandler(async (req, res) => {
    const asset = await FixedAsset.findById(req.params.assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });

    const prev = { location: asset.location || '', assignedTo: asset.assignedTo || '' };
    if (req.body.location !== undefined) asset.location = String(req.body.location).trim();
    if (req.body.assignedTo !== undefined) asset.assignedTo = String(req.body.assignedTo).trim();
    const current = { location: asset.location || '', assignedTo: asset.assignedTo || '' };
    const changed = prev.location !== current.location || prev.assignedTo !== current.assignedTo;

    if (!changed) {
      return res.json({ success: true, data: asset, message: 'No custody changes detected' });
    }

    asset.updatedBy = req.user.id;
    await asset.save();

    const tag = await AssetTag.findOne({ asset: asset._id, status: 'active' });
    await logEvent({
      asset: asset._id,
      tagCode: tag ? tag.tagCode : '',
      eventType: 'transfer',
      user: req.user._id,
      location: asset.location,
      note: req.body.note || '',
      meta: { previous: prev, current }
    });

    res.json({ success: true, data: asset });
  })
);

// ── Verification sessions
router.get('/verification-sessions', authorize(...TAG_ROLES), asyncHandler(async (req, res) => {
  const sessions = await AssetVerificationSession.find()
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('createdBy', 'firstName lastName')
    .lean();
  res.json({ success: true, data: sessions });
}));

router.get('/verification-sessions/:id', authorize(...TAG_ROLES), asyncHandler(async (req, res) => {
  const session = await AssetVerificationSession.findById(req.params.id)
    .populate('createdBy', 'firstName lastName')
    .populate('lines.asset', 'assetNumber name location assignedTo status');
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  res.json({ success: true, data: session });
}));

router.post(
  '/verification-sessions',
  authorize(...TAG_ROLES),
  [body('name').trim().notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const { name, locationFilter = '' } = req.body;

    const assetFilter = { status: { $in: ['active', 'fully_depreciated'] } };
    const assets = await FixedAsset.find(assetFilter).lean();

    let filtered = assets;
    if (locationFilter && String(locationFilter).trim()) {
      const lf = String(locationFilter).trim().toLowerCase();
      filtered = assets.filter((a) => (a.location || '').toLowerCase().includes(lf));
    }

    const tags = await AssetTag.find({
      asset: { $in: filtered.map((a) => a._id) },
      status: 'active'
    }).lean();
    const taggedAssetIds = new Set(tags.map((t) => t.asset.toString()));

    const lines = [];
    for (const a of filtered) {
      if (!taggedAssetIds.has(a._id.toString())) continue;
      const t = tags.find((x) => x.asset.toString() === a._id.toString());
      lines.push({
        asset: a._id,
        tagCode: t.tagCode,
        result: 'pending'
      });
    }

    const count = await AssetVerificationSession.countDocuments();
    const sessionNumber = `VS-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const session = await AssetVerificationSession.create({
      sessionNumber,
      name,
      locationFilter: locationFilter || '',
      status: 'open',
      createdBy: req.user._id,
      lines
    });

    await logEvent({
      eventType: 'session_started',
      user: req.user._id,
      session: session._id,
      note: `Session ${sessionNumber} — ${lines.length} tagged assets expected`,
      meta: { locationFilter }
    });

    res.status(201).json({ success: true, data: session });
  })
);

router.post(
  '/verification-sessions/:id/scan',
  authorize(...TAG_ROLES),
  [body('tagCode').trim().notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const session = await AssetVerificationSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status === 'closed') return res.status(400).json({ success: false, message: 'Session is closed' });

    const tagCode = String(req.body.tagCode).trim();
    const line = session.lines.find((l) => l.tagCode === tagCode);

    if (!line) {
      const tag = await AssetTag.findOne({ tagCode, status: 'active' }).populate('asset');
      if (tag) {
        session.lines.push({
          asset: tag.asset._id,
          tagCode,
          result: 'wrong_location',
          scannedAt: new Date(),
          note: 'Scanned asset not in expected list for this session'
        });
        await session.save();
        await logEvent({
          asset: tag.asset._id,
          tagCode,
          eventType: 'verified_found',
          user: req.user._id,
          session: session._id,
          note: 'Unexpected tag for this session (wrong pool)'
        });
        return res.json({ success: true, message: 'Recorded as unexpected asset for this session', data: session });
      }
      return res.status(404).json({ success: false, message: 'Tag not found' });
    }

    if (line.result === 'found') {
      return res.json({ success: true, message: 'Already verified', data: session });
    }

    line.result = 'found';
    line.scannedAt = new Date();
    line.note = req.body.note || '';
    await session.save();

    await logEvent({
      asset: line.asset,
      tagCode,
      eventType: 'verified_found',
      user: req.user._id,
      session: session._id
    });

    res.json({ success: true, data: session });
  })
);

router.post(
  '/verification-sessions/:id/mark-missing',
  authorize(...TAG_ROLES),
  [body('assetId').isMongoId().withMessage('Valid asset id required')],
  validate,
  asyncHandler(async (req, res) => {
    const session = await AssetVerificationSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status === 'closed') return res.status(400).json({ success: false, message: 'Session is closed' });

    const line = session.lines.find((l) => l.asset.toString() === req.body.assetId);
    if (!line) return res.status(404).json({ success: false, message: 'Asset not in session list' });

    line.result = 'missing';
    line.note = req.body.note || 'Marked missing manually';
    await session.save();

    await logEvent({
      asset: line.asset,
      tagCode: line.tagCode,
      eventType: 'verified_missing',
      user: req.user._id,
      session: session._id
    });

    res.json({ success: true, data: session });
  })
);

router.post('/verification-sessions/:id/close', authorize(...TAG_ROLES), asyncHandler(async (req, res) => {
  const session = await AssetVerificationSession.findById(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  if (session.status === 'closed') return res.status(400).json({ success: false, message: 'Already closed' });

  session.status = 'closed';
  session.closedAt = new Date();
  session.closedBy = req.user._id;
  await session.save();

  await logEvent({
    eventType: 'session_closed',
    user: req.user._id,
    session: session._id,
    note: req.body.note || '',
    meta: {
      totalLines: session.lines.length,
      found: session.lines.filter((l) => l.result === 'found').length,
      missing: session.lines.filter((l) => l.result === 'missing').length,
      pending: session.lines.filter((l) => l.result === 'pending').length
    }
  });

  res.json({ success: true, data: session });
}));

module.exports = router;
