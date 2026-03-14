const mongoose = require('mongoose');

const whatsAppOutgoingMessageSchema = new mongoose.Schema(
  {
    to: { type: String, trim: true, index: true },
    text: { type: String, trim: true },
    messageId: { type: String, trim: true },
    sentAt: { type: Date, default: Date.now },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

whatsAppOutgoingMessageSchema.index({ to: 1, sentAt: -1 });

module.exports = mongoose.model('WhatsAppOutgoingMessage', whatsAppOutgoingMessageSchema);
