const express = require('express');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware, authorize } = require('../middleware/auth');
const ChatConversation = require('../models/chat/ChatConversation');
const ChatMessage = require('../models/chat/ChatMessage');

const router = express.Router();
router.use(authMiddleware);
router.use(authorize('super_admin', 'admin', 'developer'));

router.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 40, 100);
    const rows = await ChatConversation.find({})
      .sort({ lastMessageAt: -1 })
      .limit(limit)
      .select('kind title pairKey participants lastMessageAt lastMessageSnippet createdAt')
      .lean();
    const out = rows.map((c) => ({
      id: c._id,
      kind: c.kind || 'direct',
      title: c.title || '',
      pairKey: c.pairKey,
      participantCount: (c.participants || []).length,
      lastMessageAt: c.lastMessageAt,
      lastMessageSnippet: c.lastMessageSnippet
    }));
    res.json({ success: true, data: { conversations: out } });
  })
);

router.get(
  '/messages',
  asyncHandler(async (req, res) => {
    const qtext = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 80);
    if (!qtext) {
      return res.status(400).json({ success: false, message: 'q is required' });
    }
    const esc = qtext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const docs = await ChatMessage.find({
      deletedForEveryone: { $ne: true },
      body: new RegExp(esc, 'i')
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'firstName lastName email')
      .lean();
    res.json({
      success: true,
      data: {
        messages: docs.map((m) => ({
          id: m._id,
          conversation: String(m.conversation),
          sender: m.sender
            ? { id: m.sender._id, name: `${m.sender.firstName || ''} ${m.sender.lastName || ''}`.trim() }
            : null,
          body: (m.body || '').slice(0, 500),
          createdAt: m.createdAt
        }))
      }
    });
  })
);

router.delete(
  '/messages/:messageId/force',
  asyncHandler(async (req, res) => {
    const msg = await ChatMessage.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    await ChatMessage.deleteOne({ _id: msg._id });
    res.json({ success: true, data: { deleted: true, messageId: String(msg._id) } });
  })
);

router.delete(
  '/conversations/:conversationId/force',
  asyncHandler(async (req, res) => {
    const cid = req.params.conversationId;
    if (!mongoose.isValidObjectId(cid)) {
      return res.status(400).json({ success: false, message: 'Invalid conversation id' });
    }
    await ChatMessage.deleteMany({ conversation: cid });
    await ChatConversation.deleteOne({ _id: cid });
    res.json({ success: true, data: { deleted: true } });
  })
);

module.exports = router;
