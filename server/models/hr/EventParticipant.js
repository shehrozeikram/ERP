const mongoose = require('mongoose');

const eventParticipantSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  status: {
    type: String,
    enum: ['Invited', 'Confirmed', 'Declined', 'Attended'],
    default: 'Invited'
  },
  responseDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for performance
eventParticipantSchema.index({ eventId: 1 });
eventParticipantSchema.index({ participantId: 1 });
eventParticipantSchema.index({ status: 1 });

// Compound index to prevent duplicate participants
eventParticipantSchema.index({ eventId: 1, participantId: 1 }, { unique: true });

module.exports = mongoose.model('EventParticipant', eventParticipantSchema);
