const RecoveryAssignment = require('../models/finance/RecoveryAssignment');
const RecoveryCampaign = require('../models/finance/RecoveryCampaign');
const RecoveryWhatsAppFollowUpSettings = require('../models/finance/RecoveryWhatsAppFollowUpSettings');
const { executeRecoveryWhatsAppSend } = require('./recoveryWhatsAppSend');
const {
  getActiveMyTasksOrConditions,
  MY_TASKS_ACTIVE_STATUS_FILTER
} = require('./recoveryAssignmentUnassign');
const {
  hasCustomerReplySince,
  isEligibleForAutoFollowUp,
  resolveSessionAnchor
} = require('./recoveryWhatsAppActivity');
const { normalizePhoneForLookup } = require('./recoveryWhatsAppPhone');

const SETTINGS_KEY = 'default';

async function getFollowUpSettings() {
  let doc = await RecoveryWhatsAppFollowUpSettings.findOne({ configKey: SETTINGS_KEY }).lean();
  if (!doc) {
    doc = (
      await RecoveryWhatsAppFollowUpSettings.create({
        configKey: SETTINGS_KEY,
        enabled: false,
        delayHours: 14
      })
    ).toObject();
  }
  return doc;
}

async function saveFollowUpSettings({ enabled, campaignId, delayHours }, userId) {
  const delay = Math.min(23, Math.max(1, Number(delayHours) || 14));

  if (campaignId) {
    const campaign = await RecoveryCampaign.findOne({
      _id: campaignId,
      isActive: { $ne: false },
      whatsappTemplateName: { $exists: true, $ne: '' }
    }).lean();
    if (!campaign) {
      throw new Error('Selected campaign not found or has no approved Meta template');
    }
  }

  const doc = await RecoveryWhatsAppFollowUpSettings.findOneAndUpdate(
    { configKey: SETTINGS_KEY },
    {
      $set: {
        enabled: !!enabled,
        campaignId: campaignId || null,
        delayHours: delay,
        updatedBy: userId || null
      }
    },
    { upsert: true, new: true }
  )
    .populate('campaignId')
    .lean();

  return doc;
}

/**
 * Run one pass: send configured campaign to stale My Tasks conversations (no reply since anchor).
 */
async function runRecoveryWhatsAppFollowUp() {
  const settings = await getFollowUpSettings();
  if (!settings.enabled) {
    return { skipped: true, reason: 'disabled', sent: 0, skippedCount: 0 };
  }
  if (!settings.campaignId) {
    return { skipped: true, reason: 'no_campaign', sent: 0, skippedCount: 0 };
  }

  const campaign = await RecoveryCampaign.findById(settings.campaignId).lean();
  if (!campaign?.whatsappTemplateName || campaign.isActive === false) {
    await RecoveryWhatsAppFollowUpSettings.updateOne(
      { configKey: SETTINGS_KEY },
      { $set: { lastRunError: 'Assigned campaign missing or inactive', lastRunAt: new Date() } }
    );
    return { skipped: true, reason: 'invalid_campaign', sent: 0, skippedCount: 0 };
  }

  const orConditions = await getActiveMyTasksOrConditions();
  if (!orConditions.length) {
    await RecoveryWhatsAppFollowUpSettings.updateOne(
      { configKey: SETTINGS_KEY },
      {
        $set: {
          lastRunAt: new Date(),
          lastRunSentCount: 0,
          lastRunSkippedCount: 0,
          lastRunError: ''
        }
      }
    );
    return { skipped: true, reason: 'no_active_rules', sent: 0, skippedCount: 0 };
  }

  const delayHours = Math.min(23, Math.max(1, Number(settings.delayHours) || 14));
  const anchorCutoff = new Date(Date.now() - delayHours * 60 * 60 * 1000);
  const maxPerRun = Math.min(
    Math.max(parseInt(process.env.RECOVERY_WHATSAPP_FOLLOW_UP_MAX_PER_RUN, 10) || 30, 1),
    100
  );
  const delayMs = Math.max(0, parseInt(process.env.RECOVERY_WHATSAPP_BATCH_DELAY_MS, 10) || 250);

  const candidates = await RecoveryAssignment.find({
    $and: [
      { $or: orConditions },
      { taskStatus: MY_TASKS_ACTIVE_STATUS_FILTER },
      { mobileNumber: { $exists: true, $nin: [null, ''] } },
      {
        $or: [
          { sessionAnchorAt: { $lte: anchorCutoff, $ne: null } },
          {
            sessionAnchorAt: null,
            $or: [
              { lastOutboundAt: { $lte: anchorCutoff, $ne: null } },
              { lastCampaignSentAt: { $lte: anchorCutoff, $ne: null } }
            ]
          }
        ]
      }
    ]
  })
    .select('_id mobileNumber sessionAnchorAt lastOutboundAt lastCampaignSentAt lastCustomerReplyAt autoFollowUpSentAt')
    .limit(maxPerRun * 3)
    .lean();

  const campaignName =
    String(campaign.messagePreview || '').trim().slice(0, 80) ||
    campaign.whatsappTemplateName;
  const campaignMessage = campaign.messagePreview || '';

  let sent = 0;
  let skippedCount = 0;
  let lastError = '';

  for (const row of candidates) {
    if (sent >= maxPerRun) break;

    if (!isEligibleForAutoFollowUp(row, delayHours)) {
      skippedCount += 1;
      continue;
    }

    const anchor = resolveSessionAnchor(row);
    const phone = normalizePhoneForLookup(row.mobileNumber);
    if (!phone) {
      skippedCount += 1;
      continue;
    }

    if (await hasCustomerReplySince(phone, anchor)) {
      await RecoveryAssignment.findByIdAndUpdate(row._id, {
        $set: { lastCustomerReplyAt: new Date() }
      });
      skippedCount += 1;
      continue;
    }

    const result = await executeRecoveryWhatsAppSend(
      {
        to: phone,
        assignmentId: String(row._id),
        campaignId: String(campaign._id),
        campaignName: `[Auto] ${campaignName}`,
        campaignMessage
      },
      null,
      { isAutoFollowUp: true }
    );

    if (result.ok) {
      sent += 1;
    } else {
      skippedCount += 1;
      lastError = result.message || 'send failed';
      console.warn('[RecoveryWhatsAppFollowUp] Send failed', phone, result.message);
    }

    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  await RecoveryWhatsAppFollowUpSettings.updateOne(
    { configKey: SETTINGS_KEY },
    {
      $set: {
        lastRunAt: new Date(),
        lastRunSentCount: sent,
        lastRunSkippedCount: skippedCount,
        lastRunError: lastError
      }
    }
  );

  if (sent > 0 || skippedCount > 0) {
    console.log(`[RecoveryWhatsAppFollowUp] sent=${sent} skipped=${skippedCount}`);
  }

  return { skipped: false, sent, skippedCount, lastError };
}

module.exports = {
  getFollowUpSettings,
  saveFollowUpSettings,
  runRecoveryWhatsAppFollowUp
};
