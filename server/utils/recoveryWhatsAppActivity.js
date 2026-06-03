const RecoveryAssignment = require('../models/finance/RecoveryAssignment');
const { normalizePhoneForLookup, variantsForRecoveryPhone } = require('./recoveryWhatsAppPhone');

/** After a successful outbound WhatsApp send (manual only). */
async function recordRecoveryOutboundActivity({ assignmentId, phone }) {
  const now = new Date();
  const canon = normalizePhoneForLookup(phone);
  if (!canon && !assignmentId) return;

  const set = { lastOutboundAt: now };

  if (assignmentId) {
    await RecoveryAssignment.findByIdAndUpdate(assignmentId, { $set: set });
    return;
  }

  if (canon) {
    const variants = variantsForRecoveryPhone(canon);
    const orMobile = variants.map((v) => ({
      mobileNumber: new RegExp(`${String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
    }));
    await RecoveryAssignment.updateMany({ $or: orMobile }, { $set: set });
  }
}

/** When customer sends any incoming message (webhook). */
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

module.exports = {
  recordRecoveryOutboundActivity,
  recordRecoveryCustomerReply
};
