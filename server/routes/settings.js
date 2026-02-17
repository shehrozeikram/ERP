const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize, authMiddleware } = require('../middleware/auth');
const SystemSettings = require('../models/general/SystemSettings');

// GET /api/settings
// Any authenticated user can read announcement
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const settings = await SystemSettings.getSingleton();
    res.json({
      success: true,
      data: {
        announcement: settings.announcement || { enabled: false, text: '', speed: 80 },
        updatedAt: settings.updatedAt
      }
    });
  })
);

// PUT /api/settings/announcement
// Only admin/super_admin can update
router.put(
  '/announcement',
  authMiddleware,
  authorize('super_admin', 'admin'),
  asyncHandler(async (req, res) => {
    const { enabled, text, speed } = req.body || {};
    const settings = await SystemSettings.getSingleton();

    if (enabled !== undefined) settings.announcement.enabled = !!enabled;
    if (text !== undefined) settings.announcement.text = String(text);
    if (speed !== undefined && speed !== null && speed !== '') {
      const n = Number(speed);
      if (!Number.isNaN(n)) settings.announcement.speed = n;
    }

    settings.updatedBy = req.user?.id || req.user?._id;
    await settings.save();

    res.json({
      success: true,
      message: 'Announcement updated',
      data: {
        announcement: settings.announcement,
        updatedAt: settings.updatedAt
      }
    });
  })
);

module.exports = router;

