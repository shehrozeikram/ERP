const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const RecoveryCampaign = require('../models/finance/RecoveryCampaign');

const router = express.Router();

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
    const { whatsappTemplateName, whatsappLanguageCode, messagePreview } = req.body;

    if (!whatsappTemplateName || !String(whatsappTemplateName).trim()) {
      return res.status(400).json({ success: false, message: 'WhatsApp template name (Meta) is required' });
    }

    const campaign = new RecoveryCampaign({
      isActive: true,
      whatsappTemplateName: String(whatsappTemplateName).trim(),
      whatsappLanguageCode: whatsappLanguageCode != null ? String(whatsappLanguageCode).trim() : '',
      messagePreview: messagePreview != null ? String(messagePreview).trim() : '',
      createdBy: req.user._id
    });

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

    const { isActive, whatsappTemplateName, whatsappLanguageCode, messagePreview } = req.body;

    if (isActive !== undefined) campaign.isActive = !!isActive;
    if (whatsappTemplateName !== undefined) {
      const v = String(whatsappTemplateName || '').trim();
      if (!v) return res.status(400).json({ success: false, message: 'WhatsApp template name (Meta) is required' });
      campaign.whatsappTemplateName = v;
    }
    if (whatsappLanguageCode !== undefined) campaign.whatsappLanguageCode = String(whatsappLanguageCode || '').trim();
    if (messagePreview !== undefined) campaign.messagePreview = String(messagePreview || '').trim();
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
