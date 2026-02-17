const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    text: { type: String, trim: true, default: '' },
    // Pixels per second (frontend can interpret); keep simple numeric
    speed: { type: Number, default: 80, min: 20, max: 300 }
  },
  { _id: false }
);

const systemSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    announcement: { type: announcementSchema, default: () => ({}) },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

systemSettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({ key: 'default' });
  if (!doc) {
    doc = await this.create({ key: 'default' });
  }
  return doc;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);

