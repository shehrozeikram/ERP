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

async function validateFollowUpCampaignId(sourceCampaignId, followUpCampaignId) {
  if (!followUpCampaignId) return null;
  const fid = String(followUpCampaignId);
  if (sourceCampaignId && String(sourceCampaignId) === fid) {
    throw new Error('Follow-up campaign cannot be the same as the main campaign');
  }
  const followUp = await RecoveryCampaign.findOne({
    _id: followUpCampaignId,
    isActive: { $ne: false },
    whatsappTemplateName: { $exists: true, $ne: '' }
  }).lean();
  if (!followUp) {
    throw new Error('Follow-up campaign not found or has no approved Meta template');
  }
  return followUp;
}

async function getFollowUpSettings() {
  let doc = await RecoveryWhatsAppFollowUpSettings.findOne({ configKey: SETTINGS_KEY }).lean();
  if (!doc) {
    doc = (
      await RecoveryWhatsAppFollowUpSettings.create({
        configKey: SETTINGS_KEY,
        delayHours: 14
      })
    ).toObject();
  }
  return doc;
}

async function saveFollowUpSettings({ delayHours }, userId) {
  const delay = Math.min(23, Math.max(1, Number(delayHours) || 14));

  const doc = await RecoveryWhatsAppFollowUpSettings.findOneAndUpdate(
    { configKey: SETTINGS_KEY },
    {
      $set: {
        delayHours: delay,
        updatedBy: userId || null
      }
    },
    { upsert: true, new: true }
  ).lean();

  return doc;
}

/** Map source campaign id string -> follow-up campaign lean doc */
async function buildFollowUpCampaignMap() {
  const withFollowUp = await RecoveryCampaign.find({
    isActive: { $ne: false },
    followUpCampaignId: { $ne: null }
  })
    .select('_id followUpCampaignId whatsappTemplateName')
    .lean();

  const followUpIds = [...new Set(withFollowUp.map((c) => String(c.followUpCampaignId)).filter(Boolean))];
  const followUpDocs = followUpIds.length
    ? await RecoveryCampaign.find({
        _id: { $in: followUpIds },
        isActive: { $ne: false },
        whatsappTemplateName: { $exists: true, $ne: '' }
      }).lean()
    : [];
  const followUpById = new Map(followUpDocs.map((c) => [String(c._id), c]));

  const map = new Map();
  for (const source of withFollowUp) {
    const fu = followUpById.get(String(source.followUpCampaignId));
    if (fu) map.set(String(source._id), fu);
  }
  return map;
}

function resolveFollowUpForAssignment(row, followUpBySourceId) {
  const sourceId = row.lastCampaignId ? String(row.lastCampaignId) : '';
  if (sourceId && followUpBySourceId.has(sourceId)) {
    return { campaign: followUpBySourceId.get(sourceId), reason: 'per_campaign' };
  }
  return null;
}

/**
 * Run one pass: per-campaign follow-up for stale My Tasks conversations.
 */
async function runRecoveryWhatsAppFollowUp() {
  const settings = await getFollowUpSettings();
  const followUpBySourceId = await buildFollowUpCampaignMap();
  if (followUpBySourceId.size === 0) {
    await RecoveryWhatsAppFollowUpSettings.updateOne(
      { configKey: SETTINGS_KEY },
      {
        $set: {
          lastRunError: 'No follow-up mappings: assign a follow-up on each campaign',
          lastRunAt: new Date()
        }
      }
    );
    return { skipped: true, reason: 'no_mappings', sent: 0, skippedCount: 0 };
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
    .select(
      '_id mobileNumber sessionAnchorAt lastOutboundAt lastCampaignSentAt lastCustomerReplyAt autoFollowUpSentAt lastCampaignId'
    )
    .limit(maxPerRun * 5)
    .lean();

  let sent = 0;
  let skippedCount = 0;
  let lastError = '';

  for (const row of candidates) {
    if (sent >= maxPerRun) break;

    if (!isEligibleForAutoFollowUp(row, delayHours)) {
      skippedCount += 1;
      continue;
    }

    const resolved = resolveFollowUpForAssignment(row, followUpBySourceId);
    if (!resolved) {
      skippedCount += 1;
      continue;
    }

    const { campaign } = resolved;
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

    const campaignName =
      String(campaign.messagePreview || '').trim().slice(0, 80) || campaign.whatsappTemplateName;
    const campaignMessage = campaign.messagePreview || '';

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
  runRecoveryWhatsAppFollowUp,
  validateFollowUpCampaignId
};
