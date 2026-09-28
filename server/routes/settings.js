const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize, authMiddleware } = require('../middleware/auth');
const SystemSettings = require('../models/general/SystemSettings');
const {
  getApprovalMobileNotifyEmails,
  setApprovalMobileNotifyEmails,
  DEFAULT_APPROVAL_MOBILE_NOTIFY_EMAILS
} = require('../utils/approvalMobileNotifyRecipients');

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

// GET /api/settings/approval-mobile-notify-emails
// Who may receive mobile chat / WhatsApp approval notifications (assignee ∩ this list)
router.get(
  '/approval-mobile-notify-emails',
  authMiddleware,
  authorize('super_admin', 'admin', 'developer'),
  asyncHandler(async (req, res) => {
    const emails = await getApprovalMobileNotifyEmails();
    res.json({
      success: true,
      data: {
        emails,
        defaults: DEFAULT_APPROVAL_MOBILE_NOTIFY_EMAILS
      }
    });
  })
);

// PUT /api/settings/approval-mobile-notify-emails
// Body: { emails: ['a@x.com', ...] } — replaces the dynamic allow-list
router.put(
  '/approval-mobile-notify-emails',
  authMiddleware,
  authorize('super_admin', 'admin', 'developer'),
  asyncHandler(async (req, res) => {
    const incoming = Array.isArray(req.body?.emails) ? req.body.emails : req.body?.emailList;
    if (!Array.isArray(incoming)) {
      return res.status(400).json({
        success: false,
        message: 'emails must be an array of email addresses'
      });
    }
    const emails = await setApprovalMobileNotifyEmails(
      incoming,
      req.user?.id || req.user?._id
    );
    res.json({
      success: true,
      message: 'Approval mobile notify recipients updated',
      data: { emails }
    });
  })
);

module.exports = router;
