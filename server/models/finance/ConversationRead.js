const mongoose = require('mongoose');

const conversationReadSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    phone: { type: String, trim: true, required: true, index: true },
    readAt: { type: Date, default: Date.now, required: true }
  },
  { timestamps: true }
);

conversationReadSchema.index({ userId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('ConversationRead', conversationReadSchema);
