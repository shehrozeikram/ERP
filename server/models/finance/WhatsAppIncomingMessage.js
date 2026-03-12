const mongoose = require('mongoose');

const whatsAppIncomingMessageSchema = new mongoose.Schema(
  {
    from: { type: String, trim: true, index: true },
    messageId: { type: String, trim: true },
    type: { type: String, trim: true },
    text: { type: String, trim: true },
    rawPayload: { type: mongoose.Schema.Types.Mixed },
    receivedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

whatsAppIncomingMessageSchema.index({ from: 1, receivedAt: -1 });

module.exports = mongoose.model('WhatsAppIncomingMessage', whatsAppIncomingMessageSchema);
