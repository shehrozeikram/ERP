const mongoose = require('mongoose');

const readReceiptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastReadMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage', default: null },
    readAt: { type: Date, default: null }
  },
  { _id: false }
);

const chatConversationSchema = new mongoose.Schema(
  {
    /** `id1::id2` for direct; `g:<ObjectId>` for groups (unique). */
    pairKey: { type: String, required: true, unique: true, index: true },
    kind: { type: String, enum: ['direct', 'group'], default: 'direct', index: true },
    title: { type: String, maxlength: 120, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageSnippet: { type: String, maxlength: 240, default: '' },
    lastMessageSender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    pinnedMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage', default: null },
    readReceipts: [readReceiptSchema]
  },
  { timestamps: true }
);

chatConversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('ChatConversation', chatConversationSchema);
