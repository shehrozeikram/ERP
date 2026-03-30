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

const companyProfileSchema = new mongoose.Schema({
  name:        { type: String, default: 'SGC International' },
  legalName:   { type: String, default: '' },
  ntn:         { type: String, default: '' },   // FBR NTN
  strn:        { type: String, default: '' },   // Sales Tax Registration Number
  address:     { type: String, default: '' },
  city:        { type: String, default: 'Islamabad' },
  country:     { type: String, default: 'Pakistan' },
  phone:       { type: String, default: '' },
  email:       { type: String, default: 'finance@sgc.international' },
  website:     { type: String, default: 'www.sgc.international' },
  logoUrl:     { type: String, default: '' },
  currency:    { type: String, default: 'PKR' },
  bankName:    { type: String, default: '' },
  bankAccount: { type: String, default: '' },
  bankIBAN:    { type: String, default: '' },
  invoiceFooter: { type: String, default: 'Thank you for your business.' },
}, { _id: false });

const systemSettingsSchema = new mongoose.Schema(
  {
    key:            { type: String, required: true, unique: true, default: 'default' },
    announcement:   { type: announcementSchema, default: () => ({}) },
    companyProfile: { type: companyProfileSchema, default: () => ({}) },
    updatedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
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

