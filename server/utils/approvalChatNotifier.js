/**
 * approvalChatNotifier.js
 * Utility to send internal chat notifications when a document is assigned.
 */
const User = require('../models/User');
const ChatConversation = require('../models/chat/ChatConversation');
const ChatMessage = require('../models/chat/ChatMessage');
const realtimeNotificationGateway = require('../services/realtimeNotificationGateway');

// Simple serialize function for emitting new message
function serializeSystemMessage(doc, viewerId) {
  const v = String(viewerId);
  return {
    id: doc._id || doc.id,
    conversation: String(doc.conversation),
    sender: String(doc.sender),
    body: doc.body,
    isDeletedForEveryone: false,
    clientMessageId: doc.clientMessageId || '',
    replyTo: null,
    attachments: [],
    editedAt: null,
    deletedAt: null,
    deliveredAt: doc.deliveredAt || null,
    reactions: [],
    starredBy: [],
    isStarred: false,
    mentions: [],
    linkPreviews: [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

/**
 * Notify one or many approvers via Internal Chat.
 * @param {string|string[]|object[]} userIds - User ID, array of IDs, or User objects
 * @param {{ docType?: string, docNumber?: string, message?: string }} context
 */
async function notifyChatApprovers(userIds, context = {}) {
  try {
    const rawIds = Array.isArray(userIds) ? userIds : [userIds];
    const ids = rawIds
      .map((item) => (item && typeof item === 'object' ? item._id || item.id : item))
      .filter(Boolean);

    if (!ids.length) return;

    // Find the dedicated bot user (System Sender)
    let systemUser = await User.findOne({ email: 'bot@tovus.net' }).select('_id firstName lastName').lean();
    
    // Auto-create bot user if it doesn't exist (useful for clean production deployment)
    if (!systemUser) {
      const newBot = new User({
        email: 'bot@tovus.net',
        firstName: 'TOVUS',
        lastName: 'ERP',
        role: 'admin',
        isActive: true,
        password: 'sardar1Sahab_bot',
        employeeId: 'BOT-001',
        position: 'System Bot',
        department: 'System'
      });
      await newBot.save();
      systemUser = { _id: newBot._id, firstName: newBot.firstName, lastName: newBot.lastName };
      console.log('[ApprovalChat] Automatically created TOVUS ERP bot user.');
    }

    const systemUserId = String(systemUser._id);
    const docType = context.docType || 'Document';
    const docNumber = context.docNumber || '';
    const docUrl = context.url ? `\n🔗 *Link:* ${process.env.CLIENT_URL || 'https://tovus.net'}${context.url}` : '';
    
    const defaultMsg = `🔔 *System Notification: New Assignment*\n\n📄 *Document:* ${docType} ${docNumber ? `(${docNumber})` : ''}${docUrl}\n\nYou have been assigned to review this document. Please check your approval queue!`;
    const messageBody = context.message || defaultMsg;
    const snippet = messageBody.slice(0, 240);

    for (const userId of ids) {
      const targetId = String(userId);
      // if (targetId === systemUserId) continue; // Don't notify self

      const participants = [systemUserId, targetId].sort();
      const pairKey = `${participants[0]}::${participants[1]}`;

      // 1. Find or create a direct conversation
      let conv = await ChatConversation.findOne({ pairKey, kind: 'direct' });

      if (!conv) {
        conv = await ChatConversation.create({
          pairKey,
          kind: 'direct',
          participants: [systemUserId, targetId],
          createdBy: systemUserId,
          admins: [systemUserId]
        });
      }

      // 2. Create the chat message
      const msgDoc = await ChatMessage.create({
        conversation: conv._id,
        sender: systemUserId,
        body: messageBody,
        deliveredAt: new Date()
      });

      // 3. Update conversation last message info
      conv.lastMessageAt = new Date();
      conv.lastMessageSnippet = snippet;
      conv.lastMessageSender = systemUserId;
      await conv.save();

      // 4. Emit socket events to the target user (and the sender, if online)
      const serializedForTarget = serializeSystemMessage(msgDoc.toObject(), targetId);
      realtimeNotificationGateway.emitToUser(targetId, 'chat:message', {
        conversationId: String(conv._id),
        message: serializedForTarget
      });
      realtimeNotificationGateway.emitToUser(targetId, 'chat:conversation:updated', {
        conversationId: String(conv._id)
      });
      
      if (targetId !== systemUserId) {
        const serializedForSystem = serializeSystemMessage(msgDoc.toObject(), systemUserId);
        realtimeNotificationGateway.emitToUser(systemUserId, 'chat:message', {
          conversationId: String(conv._id),
          message: serializedForSystem
        });
        realtimeNotificationGateway.emitToUser(systemUserId, 'chat:conversation:updated', {
          conversationId: String(conv._id)
        });
      }
    }
  } catch (err) {
    console.error('[ApprovalChat] Error in notifyChatApprovers:', err.message);
  }
}

module.exports = { notifyChatApprovers };
