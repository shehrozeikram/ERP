const RecoveryAssignment = require('../models/finance/RecoveryAssignment');
const WhatsAppIncomingMessage = require('../models/finance/WhatsAppIncomingMessage');
const { normalizePhoneForLookup, variantsForRecoveryPhone } = require('./recoveryWhatsAppPhone');

/**
 * After a successful outbound WhatsApp send.
 * @param {{ assignmentId?: string, phone: string, isAutoFollowUp?: boolean }} opts
 */
async function recordRecoveryOutboundActivity({ assignmentId, phone, isAutoFollowUp = false }) {
  const now = new Date();
  const canon = normalizePhoneForLookup(phone);
  if (!canon && !assignmentId) return;

  const set = { lastOutboundAt: now };
  const unset = {};

  if (isAutoFollowUp) {
    set.autoFollowUpSentAt = now;
  } else {
    set.sessionAnchorAt = now;
    unset.autoFollowUpSentAt = '';
  }

  if (assignmentId) {
    await RecoveryAssignment.findByIdAndUpdate(assignmentId, {
      $set: set,
      ...(Object.keys(unset).length ? { $unset: unset } : {})
    });
    return;
  }

  if (canon) {
    const variants = variantsForRecoveryPhone(canon);
    const orMobile = variants.map((v) => ({
      mobileNumber: new RegExp(`${String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
    }));
    await RecoveryAssignment.updateMany(
      { $or: orMobile },
      { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }
    );
  }
}

/**
 * When customer sends any incoming message (webhook).
 */
async function recordRecoveryCustomerReply(phone, receivedAt = new Date()) {
  const canon = normalizePhoneForLookup(phone);
  if (!canon) return;

  const variants = variantsForRecoveryPhone(canon);
  const when = receivedAt instanceof Date ? receivedAt : new Date(receivedAt);

  const digitPattern = variants
    .map((v) => String(v).replace(/\D/g, ''))
    .filter(Boolean);
  if (!digitPattern.length) return;

  const orMobile = digitPattern.flatMap((digits) => {
    const tail = digits.length >= 10 ? digits.slice(-10) : digits;
    return [
      { mobileNumber: new RegExp(`${digits.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) },
      { mobileNumber: new RegExp(`${tail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }
    ];
  });

  await RecoveryAssignment.updateMany(
    { $or: orMobile },
    { $set: { lastCustomerReplyAt: when } }
  );
}

/** True if any incoming message exists after `since` for this phone. */
async function hasCustomerReplySince(phone, since) {
  if (!since) return false;
  const canon = normalizePhoneForLookup(phone);
  if (!canon) return false;
  const variants = variantsForRecoveryPhone(canon);
  const count = await WhatsAppIncomingMessage.countDocuments({
    from: { $in: variants },
    receivedAt: { $gt: since }
  });
  return count > 0;
}

function resolveSessionAnchor(assignment) {
  if (assignment.sessionAnchorAt) return new Date(assignment.sessionAnchorAt);
  if (assignment.lastOutboundAt) return new Date(assignment.lastOutboundAt);
  if (assignment.lastCampaignSentAt) return new Date(assignment.lastCampaignSentAt);
  return null;
}

function isEligibleForAutoFollowUp(assignment, delayHours) {
  const anchor = resolveSessionAnchor(assignment);
  if (!anchor || isNaN(anchor.getTime())) return false;

  const cutoff = Date.now() - delayHours * 60 * 60 * 1000;
  if (anchor.getTime() > cutoff) return false;

  const replyAt = assignment.lastCustomerReplyAt ? new Date(assignment.lastCustomerReplyAt) : null;
  if (replyAt && !isNaN(replyAt.getTime()) && replyAt.getTime() >= anchor.getTime()) {
    return false;
  }

  const followUpAt = assignment.autoFollowUpSentAt ? new Date(assignment.autoFollowUpSentAt) : null;
  if (followUpAt && !isNaN(followUpAt.getTime()) && followUpAt.getTime() >= anchor.getTime()) {
    return false;
  }

  return true;
}

module.exports = {
  recordRecoveryOutboundActivity,
  recordRecoveryCustomerReply,
  hasCustomerReplySince,
  resolveSessionAnchor,
  isEligibleForAutoFollowUp
};
