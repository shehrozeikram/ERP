const mongoose = require('mongoose');
const Notification = require('../models/hr/Notification');
const realtimeNotificationGateway = require('./realtimeNotificationGateway');

const toObjectIdOrNull = (value) => {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
};

const uniqueRecipientIds = (recipientIds = [], excludeUserId = null) => {
  const blocked = excludeUserId ? String(excludeUserId) : null;
  const unique = new Set();
  recipientIds.forEach((id) => {
    const normalized = String(id || '').trim();
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

  const createdByObjectId = toObjectIdOrNull(createdBy) || toObjectIdOrNull(recipients[0]);
  const docs = [];

  for (const recipientId of recipients) {
    const notification = await Notification.create({
      recipient: toObjectIdOrNull(recipientId),
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
    realtimeNotificationGateway.emitToUser(recipientId, 'notification:new', notification);
  }

  return docs;
}

module.exports = {
  createAndEmitNotification
};
