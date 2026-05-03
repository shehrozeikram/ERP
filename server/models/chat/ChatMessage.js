const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, maxlength: 500 },
    filename: { type: String, maxlength: 255 },
    mimeType: { type: String, maxlength: 120 },
    size: { type: Number, min: 0 }
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true, maxlength: 32 }
  },
  { _id: false }
);

const mentionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    label: { type: String, maxlength: 80, default: '' }
  },
  { _id: false }
);

const linkPreviewSchema = new mongoose.Schema(
  {
    url: { type: String, maxlength: 2000 },
    title: { type: String, maxlength: 300 },
    description: { type: String, maxlength: 600 },
    image: { type: String, maxlength: 2000 },
    siteName: { type: String, maxlength: 120 },
    fetchedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatConversation',
      required: true,
      index: true
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 16000 },
    clientMessageId: { type: String, maxlength: 80, default: '' },
    replyTo: {
      message: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' },
      preview: { type: String, maxlength: 400 },
      senderName: { type: String, maxlength: 120 }
    },
    attachments: [attachmentSchema],
    mentions: [mentionSchema],
    linkPreviews: [linkPreviewSchema],
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    deletedForEveryone: { type: Boolean, default: false },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deliveredAt: { type: Date, default: null },
    reactions: [reactionSchema],
    starredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

chatMessageSchema.index({ conversation: 1, createdAt: -1 });
chatMessageSchema.index(
  { conversation: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: 'string', $gt: '' } }
  }
);

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
