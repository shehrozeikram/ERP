const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { asyncHandler } = require('../middleware/errorHandler');
const ChatConversation = require('../models/chat/ChatConversation');
const ChatMessage = require('../models/chat/ChatMessage');
const User = require('../models/User');
const realtimeNotificationGateway = require('../services/realtimeNotificationGateway');
const { createAndEmitNotification } = require('../services/realtimeNotificationService');
const { unfurlFromText } = require('../services/chatLinkUnfurl');

const router = express.Router();

const MAX_BODY = 16000;
const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;
const PAGE_SIZE = 40;

function makePairKey(idA, idB) {
  const a = String(idA);
  const b = String(idB);
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function sortedParticipantObjectIds(a, b) {
  const sa = String(a);
  const sb = String(b);
  const idA = new mongoose.Types.ObjectId(sa);
  const idB = new mongoose.Types.ObjectId(sb);
  return sa < sb ? [idA, idB] : [idB, idA];
}

function participantIdList(conv) {
  return (conv.participants || []).map((p) => String(p._id || p));
}

function otherParticipantId(conv, meId) {
  const me = String(meId);
  return participantIdList(conv).find((x) => x !== me) || null;
}

async function assertMember(convId, userId) {
  const conv = await ChatConversation.findById(convId).select('participants pairKey readReceipts kind title admins');
  if (!conv) return { error: 'not_found' };
  const ok = conv.participants.some((p) => String(p) === String(userId));
  if (!ok) return { error: 'forbidden' };
  return { conv };
}

async function latestReadAmongOthers(fullLeanOrDoc, viewerId) {
  const receipts = fullLeanOrDoc.readReceipts || [];
  let maxTs = 0;
  for (const r of receipts) {
    if (String(r.user) === String(viewerId)) continue;
    if (!r.lastReadMessage) continue;
    const anchor = await ChatMessage.findById(r.lastReadMessage).select('createdAt').lean();
    if (anchor?.createdAt) {
      const t = new Date(anchor.createdAt).getTime();
      if (t > maxTs) maxTs = t;
    }
  }
  return maxTs ? new Date(maxTs) : null;
}

function serializeUserLite(u) {
  if (!u) return null;
  const o = u.toObject ? u.toObject() : u;
  return {
    id: o._id,
    firstName: o.firstName,
    lastName: o.lastName,
    fullName: o.fullName || [o.firstName, o.lastName].filter(Boolean).join(' '),
    email: o.email,
    profileImage: o.profileImage,
    department: o.department,
    position: o.position
  };
}

function serializeMessage(doc, viewerId) {
  if (!doc) return null;
  const v = String(viewerId);
  const deletedFor = (doc.deletedFor || []).map(String);
  if (deletedFor.includes(v)) return null;

  const senderStr = String(doc.sender);
  const isDeletedAll = doc.deletedForEveryone && doc.deletedAt;

  const reactions = (doc.reactions || []).map((r) => ({
    user: String(r.user),
    emoji: r.emoji
  }));

  const starredBy = (doc.starredBy || []).map(String);

  return {
    id: doc._id,
    conversation: String(doc.conversation),
    sender: senderStr,
    body: isDeletedAll ? '' : doc.body,
    isDeletedForEveryone: !!isDeletedAll,
    clientMessageId: doc.clientMessageId || '',
    replyTo: doc.replyTo?.message
      ? {
          message: String(doc.replyTo.message),
          preview: doc.replyTo.preview || '',
          senderName: doc.replyTo.senderName || ''
        }
      : null,
    attachments: isDeletedAll ? [] : doc.attachments || [],
    editedAt: doc.editedAt || null,
    deletedAt: doc.deletedAt || null,
    deliveredAt: doc.deliveredAt || null,
    reactions,
    starredBy,
    isStarred: starredBy.includes(v),
    mentions: (doc.mentions || []).map((m) => ({
      user: String(m.user),
      label: m.label || ''
    })),
    linkPreviews: isDeletedAll ? [] : doc.linkPreviews || [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

async function unreadCountFor(conv, meId) {
  const me = String(meId);
  const receipt = (conv.readReceipts || []).find((r) => String(r.user) === me);
  const q = {
    conversation: conv._id,
    sender: { $ne: meId },
    deletedForEveryone: { $ne: true },
    deletedFor: { $nin: [meId] }
  };
  if (receipt?.lastReadMessage) {
    const anchor = await ChatMessage.findById(receipt.lastReadMessage).select('createdAt');
    if (anchor?.createdAt) {
      q.createdAt = { $gt: anchor.createdAt };
    }
  }
  return ChatMessage.countDocuments(q);
}

function emitToParticipants(conv, event, payload, exceptUserId = null) {
  for (const id of participantIdList(conv)) {
    if (exceptUserId && id === String(exceptUserId)) continue;
    realtimeNotificationGateway.emitToUser(id, event, payload);
  }
}

// --- Directory user picker (any authenticated user) ---
router.get(
  '/directory',
  asyncHandler(async (req, res) => {
    const search = (req.query.search || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 50);
    const q = { isActive: true, _id: { $ne: req.user._id } };
    if (search) {
      q.$or = [
        { firstName: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { lastName: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { email: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { employeeId: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      ];
    }
    const users = await User.find(q)
      .select('firstName lastName email department position employeeId profileImage')
      .sort({ firstName: 1, lastName: 1 })
      .limit(limit)
      .lean();
    res.json({
      success: true,
      data: {
        users: users.map((u) => ({
          id: u._id,
          firstName: u.firstName,
          lastName: u.lastName,
          fullName: [u.firstName, u.lastName].filter(Boolean).join(' '),
          email: u.email,
          department: u.department,
          position: u.position,
          employeeId: u.employeeId,
          profileImage: u.profileImage
        }))
      }
    });
  })
);

router.get(
  '/presence',
  asyncHandler(async (req, res) => {
    const raw = (req.query.ids || '').trim();
    if (!raw) {
      return res.status(400).json({ success: false, message: 'ids query required (comma-separated user ids)' });
    }
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter((id) => mongoose.isValidObjectId(id));
    const unique = [...new Set(ids)].slice(0, 80);
    const online = {};
    for (const id of unique) {
      online[id] = realtimeNotificationGateway.isUserOnline(id);
    }
    res.json({ success: true, data: { online } });
  })
);

router.get(
  '/unread-summary',
  asyncHandler(async (req, res) => {
    const convs = await ChatConversation.find({
      participants: req.user._id
    })
      .select('_id readReceipts participants')
      .lean();

    let total = 0;
    for (const c of convs) {
      total += await unreadCountFor(c, req.user._id);
    }
    res.json({ success: true, data: { totalUnread: total } });
  })
);

router.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const convs = await ChatConversation.find({ participants: req.user._id })
      .sort({ lastMessageAt: -1 })
      .populate('participants', 'firstName lastName email profileImage department position')
      .populate('pinnedMessage', 'body sender createdAt')
      .lean();

    const out = [];
    for (const c of convs) {
      const other = (c.participants || []).find((p) => String(p._id) !== String(req.user._id));
      const unread = await unreadCountFor(c, req.user._id);
      const myRead = (c.readReceipts || []).find((r) => String(r.user) === String(req.user._id));
      const kind = c.kind || 'direct';
      const displayTitle =
        kind === 'group'
          ? (c.title || 'Group')
          : other
            ? serializeUserLite(other)?.fullName || `${other.firstName || ''} ${other.lastName || ''}`.trim()
            : 'Chat';
      out.push({
        id: c._id,
        kind,
        title: c.title || '',
        displayTitle,
        participantCount: (c.participants || []).length,
        otherUser: kind === 'direct' && other ? serializeUserLite(other) : null,
        lastMessageAt: c.lastMessageAt,
        lastMessageSnippet: c.lastMessageSnippet,
        lastMessageSender: c.lastMessageSender ? String(c.lastMessageSender) : null,
        unreadCount: unread,
        lastReadMessageId: myRead?.lastReadMessage ? String(myRead.lastReadMessage) : null,
        readAt: myRead?.readAt || null,
        pinnedMessage: c.pinnedMessage
          ? {
              id: c.pinnedMessage._id,
              body: c.pinnedMessage.deletedForEveryone ? '' : c.pinnedMessage.body,
              sender: String(c.pinnedMessage.sender),
              createdAt: c.pinnedMessage.createdAt
            }
          : null
      });
    }

    res.json({ success: true, data: { conversations: out } });
  })
);

router.post(
  '/conversations/open',
  asyncHandler(async (req, res) => {
    const { otherUserId } = req.body || {};
    if (!otherUserId || !mongoose.isValidObjectId(otherUserId)) {
      return res.status(400).json({ success: false, message: 'otherUserId is required' });
    }
    if (String(otherUserId) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Cannot chat with yourself' });
    }
    const other = await User.findById(otherUserId).select('isActive firstName lastName email profileImage department position');
    if (!other || !other.isActive) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const pairKey = makePairKey(req.user._id, otherUserId);
    let conv = await ChatConversation.findOne({ pairKey }).populate(
      'participants',
      'firstName lastName email profileImage department position'
    );

    if (!conv) {
      const [a, b] = sortedParticipantObjectIds(req.user._id, otherUserId);
      try {
        conv = await ChatConversation.create({
          pairKey,
          kind: 'direct',
          participants: [a, b],
          lastMessageAt: new Date(0),
          lastMessageSnippet: ''
        });
        conv = await ChatConversation.findById(conv._id).populate(
          'participants',
          'firstName lastName email profileImage department position'
        );
      } catch (e) {
        if (e.code === 11000) {
          conv = await ChatConversation.findOne({ pairKey }).populate(
            'participants',
            'firstName lastName email profileImage department position'
          );
        } else throw e;
      }
    }

    const otherUser = conv.participants.find((p) => String(p._id) !== String(req.user._id));
    res.json({
      success: true,
      data: {
        conversation: {
          id: conv._id,
          otherUser: serializeUserLite(otherUser),
          participants: conv.participants.map((p) => String(p._id))
        }
      }
    });
  })
);

router.get(
  '/conversations/:conversationId',
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { error, conv } = await assertMember(conversationId, req.user._id);
    if (error === 'not_found') return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, message: 'Forbidden' });

    const full = await ChatConversation.findById(conv._id)
      .populate('participants', 'firstName lastName email profileImage department position')
      .populate('pinnedMessage', 'body sender createdAt deletedForEveryone')
      .lean();

    const peerReadMessageCreatedAt = await latestReadAmongOthers(full, req.user._id);

    const otherUser = (full.participants || []).find((p) => String(p._id) !== String(req.user._id));

    res.json({
      success: true,
      data: {
        id: full._id,
        kind: full.kind || 'direct',
        title: full.title || '',
        otherUser: full.kind === 'group' ? null : otherUser ? serializeUserLite(otherUser) : null,
        participants: (full.participants || []).map((p) => serializeUserLite(p)),
        peerReadMessageCreatedAt,
        peerReadAt: null,
        pinnedMessage: full.pinnedMessage
          ? {
              id: full.pinnedMessage._id,
              body: full.pinnedMessage.deletedForEveryone ? '' : full.pinnedMessage.body,
              sender: String(full.pinnedMessage.sender),
              createdAt: full.pinnedMessage.createdAt
            }
          : null
      }
    });
  })
);

router.get(
  '/conversations/:conversationId/messages',
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { before, limit } = req.query;
    const lim = Math.min(parseInt(limit, 10) || PAGE_SIZE, 80);

    const { error, conv } = await assertMember(conversationId, req.user._id);
    if (error === 'not_found') return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, message: 'Forbidden' });

    const q = { conversation: conv._id, deletedFor: { $nin: [req.user._id] } };
    if (before && mongoose.isValidObjectId(before)) {
      const anchor = await ChatMessage.findOne({ _id: before, conversation: conv._id });
      if (anchor) q.createdAt = { $lt: anchor.createdAt };
    }

    const docs = await ChatMessage.find(q).sort({ createdAt: -1 }).limit(lim + 1).lean();
    const hasMore = docs.length > lim;
    const slice = hasMore ? docs.slice(0, lim) : docs;
    const messages = slice
      .reverse()
      .map((m) => serializeMessage(m, req.user._id))
      .filter(Boolean);

    res.json({
      success: true,
      data: {
        messages,
        hasMore,
        nextBefore: messages.length ? messages[0].id : null
      }
    });
  })
);

router.get(
  '/conversations/:conversationId/search',
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const qtext = (req.query.q || '').trim();
    if (!qtext) {
      return res.status(400).json({ success: false, message: 'Query q is required' });
    }

    const { error, conv } = await assertMember(conversationId, req.user._id);
    if (error === 'not_found') return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, message: 'Forbidden' });

    const esc = qtext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const docs = await ChatMessage.find({
      conversation: conv._id,
      deletedForEveryone: { $ne: true },
      deletedFor: { $nin: [req.user._id] },
      body: new RegExp(esc, 'i')
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      data: {
        messages: docs.map((m) => serializeMessage(m, req.user._id)).filter(Boolean)
      }
    });
  })
);

router.get(
  '/conversations/:conversationId/export',
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { error, conv } = await assertMember(conversationId, req.user._id);
    if (error === 'not_found') return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, message: 'Forbidden' });

    const full = await ChatConversation.findById(conv._id).populate('participants', 'firstName lastName email');
    const docs = await ChatMessage.find({
      conversation: conv._id,
      deletedFor: { $nin: [req.user._id] }
    })
      .sort({ createdAt: 1 })
      .populate('sender', 'firstName lastName email')
      .lean();

    const lines = [];
    lines.push(`Chat export — ${new Date().toISOString()}`);
    lines.push(`Participants: ${(full.participants || []).map((p) => `${p.firstName} ${p.lastName} <${p.email}>`).join(' | ')}`);
    lines.push('');
    for (const m of docs) {
      const who = m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : 'Unknown';
      const ts = m.createdAt ? new Date(m.createdAt).toISOString() : '';
      const body = m.deletedForEveryone ? '[Deleted]' : (m.body || '').replace(/\r?\n/g, ' ');
      lines.push(`[${ts}] ${who}: ${body}`);
    }
    const text = lines.join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="chat-export.txt"');
    res.send(text);
  })
);

router.post(
  '/conversations/:conversationId/read',
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { lastMessageId } = req.body || {};

    const { error, conv } = await assertMember(conversationId, req.user._id);
    if (error === 'not_found') return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, message: 'Forbidden' });

    let messageId = lastMessageId;
    if (!messageId || !mongoose.isValidObjectId(messageId)) {
      const latest = await ChatMessage.findOne({ conversation: conv._id }).sort({ createdAt: -1 }).select('_id');
      messageId = latest?._id;
    } else {
      const ok = await ChatMessage.exists({ _id: messageId, conversation: conv._id });
      if (!ok) return res.status(400).json({ success: false, message: 'Invalid message for this conversation' });
    }

    const fullConv = await ChatConversation.findById(conv._id);
    const receipts = (fullConv.readReceipts || []).filter((r) => String(r.user) !== String(req.user._id));
    receipts.push({
      user: req.user._id,
      lastReadMessage: messageId || null,
      readAt: new Date()
    });
    await ChatConversation.updateOne({ _id: conv._id }, { $set: { readReceipts: receipts } });

    const payload = {
      conversationId: String(conv._id),
      userId: String(req.user._id),
      lastMessageId: messageId ? String(messageId) : null,
      readAt: new Date().toISOString()
    };
    for (const id of participantIdList(fullConv)) {
      realtimeNotificationGateway.emitToUser(id, 'chat:read', payload);
    }

    res.json({ success: true, data: payload });
  })
);

router.post(
  '/conversations/:conversationId/messages',
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { body, clientMessageId, replyToMessageId, attachments, mentions } = req.body || {};

    const { error, conv } = await assertMember(conversationId, req.user._id);
    if (error === 'not_found') return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, message: 'Forbidden' });

    const fullConv = await ChatConversation.findById(conv._id);

    const trimmed = typeof body === 'string' ? body.trim() : '';
    const att = Array.isArray(attachments) ? attachments.slice(0, 5) : [];
    const cleanAtt = att
      .filter((a) => a && typeof a.url === 'string' && a.url.startsWith('/uploads/chat-files/'))
      .map((a) => ({
        url: String(a.url).slice(0, 500),
        filename: String(a.filename || '').slice(0, 255),
        mimeType: String(a.mimeType || '').slice(0, 120),
        size: Math.max(0, parseInt(a.size, 10) || 0)
      }));

    if (!trimmed && cleanAtt.length === 0) {
      return res.status(400).json({ success: false, message: 'Message body or attachment is required' });
    }
    if (trimmed.length > MAX_BODY) {
      return res.status(400).json({ success: false, message: 'Message too long' });
    }

    let replyTo;
    if (replyToMessageId && mongoose.isValidObjectId(replyToMessageId)) {
      const ref = await ChatMessage.findOne({
        _id: replyToMessageId,
        conversation: conv._id,
        deletedForEveryone: { $ne: true }
      })
        .populate('sender', 'firstName lastName')
        .lean();
      if (ref) {
        const senderName = ref.sender
          ? [ref.sender.firstName, ref.sender.lastName].filter(Boolean).join(' ')
          : 'User';
        const preview = (ref.body || '').slice(0, 280);
        replyTo = {
          message: ref._id,
          preview,
          senderName
        };
      }
    }

    const clientKey = typeof clientMessageId === 'string' ? clientMessageId.trim().slice(0, 80) : '';
    if (clientKey) {
      const dup = await ChatMessage.findOne({
        conversation: conv._id,
        clientMessageId: clientKey
      }).lean();
      if (dup) {
        const serialized = serializeMessage(dup, req.user._id);
        return res.status(200).json({ success: true, data: { message: serialized, duplicate: true } });
      }
    }

    const others = participantIdList(fullConv).filter((id) => id !== String(req.user._id));
    const anyOnline = others.some((id) => realtimeNotificationGateway.isUserOnline(id));
    const deliveredAt = anyOnline ? new Date() : null;

    const allowedIds = new Set(participantIdList(fullConv));
    const mentionDocs = [];
    if (Array.isArray(mentions)) {
      for (const m of mentions.slice(0, 25)) {
        const uid = m?.userId || m?.user;
        if (!uid || !mongoose.isValidObjectId(uid)) continue;
        if (!allowedIds.has(String(uid))) continue;
        mentionDocs.push({
          user: uid,
          label: String(m.label || '').slice(0, 80)
        });
      }
    }

    let linkPreviews = [];
    try {
      linkPreviews = await unfurlFromText(trimmed, 3);
    } catch {
      linkPreviews = [];
    }

    let doc;
    try {
      doc = await ChatMessage.create({
        conversation: conv._id,
        sender: req.user._id,
        body: trimmed || ' ',
        clientMessageId: clientKey,
        replyTo: replyTo || undefined,
        attachments: cleanAtt,
        mentions: mentionDocs,
        linkPreviews,
        deliveredAt
      });
    } catch (e) {
      if (e.code === 11000 && clientKey) {
        const dup = await ChatMessage.findOne({
          conversation: conv._id,
          clientMessageId: clientKey
        }).lean();
        if (dup) {
          const serialized = serializeMessage(dup, req.user._id);
          return res.status(200).json({ success: true, data: { message: serialized, duplicate: true } });
        }
      }
      throw e;
    }

    const snippet = (trimmed || (cleanAtt[0]?.filename || 'Attachment')).slice(0, 240);
    fullConv.lastMessageAt = new Date();
    fullConv.lastMessageSnippet = snippet;
    fullConv.lastMessageSender = req.user._id;
    await fullConv.save();

    const populated = await ChatMessage.findById(doc._id).lean();
    const serialized = serializeMessage(populated, req.user._id);

    const envelope = { conversationId: String(conv._id), message: serialized };
    emitToParticipants(fullConv, 'chat:message', envelope, null);

    const senderLabel = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || 'Someone';
    for (const pid of others) {
      if (!realtimeNotificationGateway.isUserOnline(pid)) {
        try {
          await createAndEmitNotification({
            recipientIds: [pid],
            title: 'New chat message',
            message: `${senderLabel}: ${snippet}`,
            type: 'chat_message',
            category: 'other',
            priority: 'low',
            actionUrl: `/chat/${fullConv._id}`,
            metadata: {
              module: 'other',
              entityId: fullConv._id,
              entityType: 'ChatConversation',
              additionalData: { conversationId: String(fullConv._id) }
            },
            createdBy: req.user._id
          });
        } catch (e) {
          console.warn('Chat push notification:', e.message || e);
        }
      }
    }

    res.status(201).json({ success: true, data: { message: serialized } });
  })
);

router.patch(
  '/messages/:messageId',
  asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { body } = req.body || {};
    const msg = await ChatMessage.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    if (String(msg.sender) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own messages' });
    }
    if (msg.deletedForEveryone) {
      return res.status(400).json({ success: false, message: 'Cannot edit deleted message' });
    }
    if (Date.now() - new Date(msg.createdAt).getTime() > EDIT_WINDOW_MS) {
      return res.status(400).json({ success: false, message: 'Edit window expired' });
    }
    const trimmed = typeof body === 'string' ? body.trim() : '';
    if (!trimmed) return res.status(400).json({ success: false, message: 'Body is required' });
    if (trimmed.length > MAX_BODY) return res.status(400).json({ success: false, message: 'Message too long' });

    msg.body = trimmed;
    msg.editedAt = new Date();
    await msg.save();

    const conv = await ChatConversation.findById(msg.conversation);
    const serialized = serializeMessage(msg.toObject(), req.user._id);
    emitToParticipants(conv, 'chat:message:updated', {
      conversationId: String(msg.conversation),
      message: serialized
    });

    res.json({ success: true, data: { message: serialized } });
  })
);

router.delete(
  '/messages/:messageId',
  asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const scope = (req.query.scope || 'forEveryone').toLowerCase();
    const msg = await ChatMessage.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });

    const conv = await ChatConversation.findById(msg.conversation);
    const { error } = await assertMember(msg.conversation, req.user._id);
    if (error) return res.status(403).json({ success: false, message: 'Forbidden' });

    if (scope === 'forme' || scope === 'for_me') {
      const df = (msg.deletedFor || []).map((x) => String(x));
      if (!df.includes(String(req.user._id))) {
        msg.deletedFor = [...(msg.deletedFor || []), req.user._id];
        await msg.save();
      }
    } else {
      if (String(msg.sender) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Only sender can delete for everyone' });
      }
      msg.deletedForEveryone = true;
      msg.deletedAt = new Date();
      msg.body = '';
      msg.attachments = [];
      await msg.save();
    }

    emitToParticipants(conv, 'chat:message:deleted', {
      conversationId: String(msg.conversation),
      messageId: String(msg._id),
      scope,
      byUserId: String(req.user._id)
    });

    res.json({ success: true, data: { messageId: String(msg._id), scope } });
  })
);

router.post(
  '/messages/:messageId/reactions',
  asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { emoji } = req.body || {};
    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ success: false, message: 'emoji is required' });
    }
    const em = emoji.trim().slice(0, 32);
    if (!em) return res.status(400).json({ success: false, message: 'emoji is required' });

    const msg = await ChatMessage.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    const { error } = await assertMember(msg.conversation, req.user._id);
    if (error) return res.status(403).json({ success: false, message: 'Forbidden' });

    const reactions = msg.reactions || [];
    const idx = reactions.findIndex((r) => String(r.user) === String(req.user._id) && r.emoji === em);
    if (idx >= 0) reactions.splice(idx, 1);
    else reactions.push({ user: req.user._id, emoji: em });
    msg.reactions = reactions;
    await msg.save();

    const conv = await ChatConversation.findById(msg.conversation);
    const payload = {
      conversationId: String(msg.conversation),
      messageId: String(msg._id),
      reactions: (msg.reactions || []).map((r) => ({ user: String(r.user), emoji: r.emoji }))
    };
    emitToParticipants(conv, 'chat:reaction', payload);

    res.json({ success: true, data: payload });
  })
);

router.post(
  '/messages/:messageId/star',
  asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const msg = await ChatMessage.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    const { error } = await assertMember(msg.conversation, req.user._id);
    if (error) return res.status(403).json({ success: false, message: 'Forbidden' });

    const stars = (msg.starredBy || []).map(String);
    const me = String(req.user._id);
    if (stars.includes(me)) {
      msg.starredBy = stars.filter((s) => s !== me).map((s) => new mongoose.Types.ObjectId(s));
    } else {
      msg.starredBy = [...stars.map((s) => new mongoose.Types.ObjectId(s)), req.user._id];
    }
    await msg.save();

    const conv = await ChatConversation.findById(msg.conversation);
    const payload = {
      conversationId: String(msg.conversation),
      messageId: String(msg._id),
      starredBy: (msg.starredBy || []).map(String),
      starred: (msg.starredBy || []).map(String).includes(me)
    };
    emitToParticipants(conv, 'chat:star', payload);

    res.json({ success: true, data: payload });
  })
);

router.post(
  '/conversations/:conversationId/pin',
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { messageId } = req.body || {};

    const { error, conv } = await assertMember(conversationId, req.user._id);
    if (error === 'not_found') return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, message: 'Forbidden' });

    const full = await ChatConversation.findById(conv._id);
    if (!messageId) {
      full.pinnedMessage = null;
      await full.save();
      emitToParticipants(full, 'chat:pin', { conversationId: String(full._id), pinnedMessage: null });
      return res.json({ success: true, data: { pinnedMessage: null } });
    }

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ success: false, message: 'Invalid messageId' });
    }
    const exists = await ChatMessage.exists({
      _id: messageId,
      conversation: full._id,
      deletedForEveryone: { $ne: true }
    });
    if (!exists) return res.status(400).json({ success: false, message: 'Message not found in conversation' });

    full.pinnedMessage = messageId;
    await full.save();
    emitToParticipants(full, 'chat:pin', { conversationId: String(full._id), pinnedMessageId: String(messageId) });

    res.json({ success: true, data: { pinnedMessageId: String(messageId) } });
  })
);

router.post(
  '/groups',
  asyncHandler(async (req, res) => {
    const { title, memberIds } = req.body || {};
    const name = (title || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }
    const raw = Array.isArray(memberIds) ? memberIds : [];
    const setIds = new Set([String(req.user._id), ...raw.map(String)]);
    const ids = [...setIds].filter((id) => mongoose.isValidObjectId(id));
    if (ids.length < 2) {
      return res.status(400).json({ success: false, message: 'At least one other member is required' });
    }
    const users = await User.find({ _id: { $in: ids }, isActive: true }).select('_id');
    if (users.length !== ids.length) {
      return res.status(400).json({ success: false, message: 'One or more users are invalid or inactive' });
    }
    const oidList = ids.map((id) => new mongoose.Types.ObjectId(id));
    const pairKey = `g:${new mongoose.Types.ObjectId()}`;
    let conv = await ChatConversation.create({
      pairKey,
      kind: 'group',
      title: name.slice(0, 120),
      createdBy: req.user._id,
      admins: [req.user._id],
      participants: oidList,
      lastMessageAt: new Date(0),
      lastMessageSnippet: ''
    });
    conv = await ChatConversation.findById(conv._id).populate(
      'participants',
      'firstName lastName email profileImage department position'
    );
    res.status(201).json({
      success: true,
      data: {
        conversation: {
          id: conv._id,
          kind: 'group',
          title: conv.title,
          participants: conv.participants.map((p) => String(p._id))
        }
      }
    });
  })
);

router.post(
  '/groups/:conversationId/members',
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { addUserIds = [], removeUserIds = [] } = req.body || {};
    const { error, conv } = await assertMember(conversationId, req.user._id);
    if (error === 'not_found') return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, message: 'Forbidden' });
    const full = await ChatConversation.findById(conv._id);
    if (!full || full.kind !== 'group') {
      return res.status(400).json({ success: false, message: 'Not a group conversation' });
    }
    const isAdmin = (full.admins || []).some((a) => String(a) === String(req.user._id));
    if (!isAdmin) return res.status(403).json({ success: false, message: 'Admins only' });

    let parts = (full.participants || []).map((p) => new mongoose.Types.ObjectId(String(p)));
    for (const rid of removeUserIds) {
      if (!mongoose.isValidObjectId(rid)) continue;
      parts = parts.filter((p) => String(p) !== String(rid));
    }
    for (const aid of addUserIds) {
      if (!mongoose.isValidObjectId(aid)) continue;
      const u = await User.findOne({ _id: aid, isActive: true }).select('_id');
      if (!u) continue;
      if (!parts.some((p) => String(p) === String(aid))) parts.push(u._id);
    }
    if (parts.length < 2) {
      return res.status(400).json({ success: false, message: 'Group must keep at least 2 members' });
    }
    full.participants = parts;
    await full.save();
    emitToParticipants(full, 'chat:conversation:updated', { conversationId: String(full._id) }, null);
    res.json({ success: true, data: { participantCount: parts.length } });
  })
);

const chatUploadDir = path.join(__dirname, '..', 'uploads', 'chat-files');
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    if (!fs.existsSync(chatUploadDir)) fs.mkdirSync(chatUploadDir, { recursive: true });
    cb(null, chatUploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').slice(0, 20);
    cb(null, `chat-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    cb(null, true);
  }
});

router.post(
  '/conversations/:conversationId/upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { error, conv } = await assertMember(conversationId, req.user._id);
    if (error === 'not_found') return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, message: 'Forbidden' });
    if (!req.file) return res.status(400).json({ success: false, message: 'file is required' });

    const rel = `/uploads/chat-files/${req.file.filename}`;
    res.status(201).json({
      success: true,
      data: {
        url: rel,
        filename: req.file.originalname || req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    });
  })
);

module.exports = router;
