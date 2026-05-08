const mongoose = require('mongoose');
const Notification = require('../models/hr/Notification');
const realtimeNotificationGateway = require('./realtimeNotificationGateway');

const toObjectIdOrNull = (value) => {
  if (!value) return null;
  const rawValue = typeof value === 'object' ? (value._id || value.id || value.userId || value.recipient || null) : value;
  if (!rawValue) return null;
  try {
    return new mongoose.Types.ObjectId(String(rawValue));
  } catch {
    return null;
  }
};

const uniqueRecipientIds = (recipientIds = [], excludeUserId = null) => {
  const normalizeRecipient = (value) => {
    if (!value) return '';
    if (typeof value === 'object') {
      const resolved = value._id || value.id || value.userId || value.recipient;
      return resolved ? String(resolved).trim() : '';
    }
    return String(value).trim();
  };
  const blocked = excludeUserId ? normalizeRecipient(excludeUserId) : null;
  const unique = new Set();
  recipientIds.forEach((id) => {
    const normalized = normalizeRecipient(id);
    if (!normalized) return;
    if (blocked && normalized === blocked) return;
    unique.add(normalized);
  });
  return [...unique];
};

async function createAndEmitNotification({
  recipientIds = [],
  title,
  message,
  priority = 'medium',
  type = 'info',
  category = 'other',
  actionUrl = '',
  createdBy = null,
  metadata = {},
  excludeUserId = null
}) {
  const recipients = uniqueRecipientIds(recipientIds, excludeUserId);
  if (recipients.length === 0) return [];
  const validRecipients = recipients
    .map((recipientId) => ({
      raw: recipientId,
      objectId: toObjectIdOrNull(recipientId)
    }))
    .filter((entry) => entry.objectId);
  if (validRecipients.length === 0) return [];

  const createdByObjectId = toObjectIdOrNull(createdBy) || validRecipients[0].objectId;
  const docs = [];

  for (const recipient of validRecipients) {
    const notification = await Notification.create({
      recipient: recipient.objectId,
      title,
      message,
      priority,
      type,
      category,
      actionUrl,
      metadata,
      createdBy: createdByObjectId
    });

    docs.push(notification);
    realtimeNotificationGateway.emitToUser(recipient.raw, 'notification:new', notification);
  }

  return docs;
}

module.exports = {
  createAndEmitNotification
};
