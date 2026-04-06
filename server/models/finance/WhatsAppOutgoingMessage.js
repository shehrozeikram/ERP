const mongoose = require('mongoose');

const whatsAppOutgoingMessageSchema = new mongoose.Schema(
  {
    to: { type: String, trim: true, index: true },
    text: { type: String, trim: true },
    mediaUrl: { type: String, trim: true },
    mediaType: { type: String, trim: true },
    messageId: { type: String, trim: true, index: true },
    /** Snippet of the message being replied to (ERP "View replies" only; not sent as WhatsApp body). */
    replyToText: { type: String, trim: true },
    replyToMessageId: { type: String, trim: true },
    sentAt: { type: Date, default: Date.now },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // WhatsApp delivery status: sent → delivered → read
    status: {
      type: String,
      enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
      default: 'sending'
    },
    statusUpdatedAt: { type: Date }
  },
  { timestamps: true }
);

whatsAppOutgoingMessageSchema.index({ to: 1, sentAt: -1 });
whatsAppOutgoingMessageSchema.index({ messageId: 1 });

module.exports = mongoose.model('WhatsAppOutgoingMessage', whatsAppOutgoingMessageSchema);
