const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const RecoveryCampaign = require('../models/finance/RecoveryCampaign');
const {
  getFollowUpSettings,
  saveFollowUpSettings,
  runRecoveryWhatsAppFollowUp,
  validateFollowUpCampaignId
} = require('../utils/recoveryWhatsAppFollowUp');

const router = express.Router();

// GET /api/finance/recovery-campaigns/follow-up-settings
router.get(
  '/follow-up-settings',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const settings = await getFollowUpSettings();
    res.json({ success: true, data: settings });
  })
);

// PUT /api/finance/recovery-campaigns/follow-up-settings
router.put(
  '/follow-up-settings',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { delayHours } = req.body;
    try {
      const data = await saveFollowUpSettings(
        { delayHours },
        req.user._id
      );
      res.json({ success: true, data });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message || 'Invalid settings' });
    }
  })
);

// POST /api/finance/recovery-campaigns/follow-up-settings/run-now
router.post(
  '/follow-up-settings/run-now',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const result = await runRecoveryWhatsAppFollowUp();
    res.json({ success: true, data: result });
  })
);

// GET /api/finance/recovery-campaigns
router.get(
  '/',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { activeOnly } = req.query;
    const query = {};
    if (activeOnly === 'true' || activeOnly === '1') query.isActive = true;

    const campaigns = await RecoveryCampaign.find(query)
      .populate({ path: 'createdBy', select: 'firstName lastName employeeId' })
      .populate({ path: 'followUpCampaignId', select: 'whatsappTemplateName messagePreview isActive' })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: campaigns });
  })
);

// POST /api/finance/recovery-campaigns
router.post(
  '/',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { whatsappTemplateName, whatsappLanguageCode, messagePreview, followUpCampaignId } = req.body;

    if (!whatsappTemplateName || !String(whatsappTemplateName).trim()) {
      return res.status(400).json({ success: false, message: 'WhatsApp template name (Meta) is required' });
    }

    const campaign = new RecoveryCampaign({
      isActive: true,
      whatsappTemplateName: String(whatsappTemplateName).trim(),
      whatsappLanguageCode: whatsappLanguageCode != null ? String(whatsappLanguageCode).trim() : '',
      messagePreview: messagePreview != null ? String(messagePreview).trim() : '',
      followUpCampaignId: followUpCampaignId || null,
      createdBy: req.user._id
    });

    if (campaign.followUpCampaignId) {
      try {
        await validateFollowUpCampaignId(null, campaign.followUpCampaignId);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    await campaign.save();
    await campaign.populate({ path: 'createdBy', select: 'firstName lastName employeeId' });

    res.status(201).json({ success: true, data: campaign });
  })
);

// PUT /api/finance/recovery-campaigns/:id
router.put(
  '/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const campaign = await RecoveryCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const { isActive, whatsappTemplateName, whatsappLanguageCode, messagePreview, followUpCampaignId } = req.body;

    if (isActive !== undefined) campaign.isActive = !!isActive;
    if (whatsappTemplateName !== undefined) {
      const v = String(whatsappTemplateName || '').trim();
      if (!v) return res.status(400).json({ success: false, message: 'WhatsApp template name (Meta) is required' });
      campaign.whatsappTemplateName = v;
    }
    if (whatsappLanguageCode !== undefined) campaign.whatsappLanguageCode = String(whatsappLanguageCode || '').trim();
    if (messagePreview !== undefined) campaign.messagePreview = String(messagePreview || '').trim();
    if (followUpCampaignId !== undefined) {
      const fid = followUpCampaignId === '' || followUpCampaignId == null ? null : followUpCampaignId;
      if (fid) {
        try {
          await validateFollowUpCampaignId(campaign._id, fid);
        } catch (err) {
          return res.status(400).json({ success: false, message: err.message });
        }
      }
      campaign.followUpCampaignId = fid;
    }
    campaign.updatedBy = req.user._id;

    await campaign.save();
    await campaign.populate({ path: 'createdBy', select: 'firstName lastName employeeId' });

    res.json({ success: true, data: campaign });
  })
);

// DELETE /api/finance/recovery-campaigns/:id
router.delete(
  '/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const campaign = await RecoveryCampaign.findByIdAndDelete(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.json({ success: true, message: 'Campaign deleted' });
  })
);

module.exports = router;
