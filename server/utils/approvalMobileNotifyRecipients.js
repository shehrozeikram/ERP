/**
 * Dynamic allow-list for mobile chat / WhatsApp approval notifications.
 * Only users in this list who are ALSO the assigned approver receive the message.
 */
const SystemSettings = require('../models/general/SystemSettings');

const DEFAULT_APPROVAL_MOBILE_NOTIFY_EMAILS = [
  'developer@tovus.net',
  'ceo@sgc.com',
  'fahadfarid@tovus.net',
  'muhammadnawaz@tovus.net',
  'hamzatanveer@tovus.net',
  'usmantanveer@tovus.net'
];

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const uniqueEmails = (list = []) => {
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const email = normalizeEmail(raw);
    if (!email || !email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
};

/** Emails from env APPROVAL_MOBILE_NOTIFY_EMAILS (comma-separated), if set. */
const emailsFromEnv = () => {
  const raw = process.env.APPROVAL_MOBILE_NOTIFY_EMAILS;
  if (!raw || !String(raw).trim()) return [];
  return uniqueEmails(String(raw).split(/[,;\s]+/));
};

/**
 * Resolve the active allow-list (DB settings ∪ env extras).
 * Seeds SystemSettings with defaults on first use if empty.
 */
async function getApprovalMobileNotifyEmails() {
  const settings = await SystemSettings.getSingleton();
  let emails = uniqueEmails(settings.approvalMobileNotifyEmails || []);

  if (!emails.length) {
    emails = [...DEFAULT_APPROVAL_MOBILE_NOTIFY_EMAILS];
    settings.approvalMobileNotifyEmails = emails;
    settings.markModified('approvalMobileNotifyEmails');
    await settings.save().catch((err) => {
      console.warn('[ApprovalNotify] Failed to seed default recipient emails:', err.message);
    });
  }

  const envEmails = emailsFromEnv();
  if (envEmails.length) {
    emails = uniqueEmails([...emails, ...envEmails]);
  }

  return emails;
}

async function setApprovalMobileNotifyEmails(emails, updatedBy = null) {
  const settings = await SystemSettings.getSingleton();
  const next = uniqueEmails(emails);
  settings.approvalMobileNotifyEmails = next.length ? next : [...DEFAULT_APPROVAL_MOBILE_NOTIFY_EMAILS];
  if (updatedBy) settings.updatedBy = updatedBy;
  settings.markModified('approvalMobileNotifyEmails');
  await settings.save();
  return settings.approvalMobileNotifyEmails;
}

/**
 * Keep only assignee userIds whose email is on the allow-list.
 * @param {string[]} userIds
 * @param {import('mongoose').Model} UserModel
 * @returns {Promise<string[]>}
 */
async function filterUserIdsByApprovalNotifyAllowList(userIds, UserModel) {
  const ids = [...new Set(
    (Array.isArray(userIds) ? userIds : [userIds])
      .map((item) => (item && typeof item === 'object' ? String(item._id || item.id) : String(item || '')))
      .filter(Boolean)
  )];
  if (!ids.length) return [];

  const allowEmails = await getApprovalMobileNotifyEmails();
  const allowSet = new Set(allowEmails.map(normalizeEmail));
  if (!allowSet.size) return [];

  const users = await UserModel.find({ _id: { $in: ids } })
    .select('_id email')
    .lean();

  return users
    .filter((u) => allowSet.has(normalizeEmail(u.email)))
    .map((u) => String(u._id));
}

function formatInitiatorName(fromUser) {
  if (!fromUser) return '';
  if (typeof fromUser === 'string') {
    // May be a display name or a raw ObjectId — ObjectIds are resolved in resolveInitiatorName
    if (/^[a-fA-F0-9]{24}$/.test(fromUser.trim())) return '';
    return fromUser.trim();
  }
  const name = [fromUser.firstName, fromUser.lastName].filter(Boolean).join(' ').trim();
  return name || fromUser.email || fromUser.name || '';
}

async function resolveInitiatorName(fromUser, UserModel) {
  const direct = formatInitiatorName(fromUser);
  if (direct) return direct;

  let id = null;
  if (typeof fromUser === 'string' && /^[a-fA-F0-9]{24}$/.test(fromUser.trim())) {
    id = fromUser.trim();
  } else if (fromUser && typeof fromUser === 'object') {
    id = fromUser._id || fromUser.id;
  }
  if (!id) return '';

  const user = await UserModel.findById(id).select('firstName lastName email').lean();
  return formatInitiatorName(user);
}

module.exports = {
  DEFAULT_APPROVAL_MOBILE_NOTIFY_EMAILS,
  normalizeEmail,
  uniqueEmails,
  getApprovalMobileNotifyEmails,
  setApprovalMobileNotifyEmails,
  filterUserIdsByApprovalNotifyAllowList,
  formatInitiatorName,
  resolveInitiatorName
};
