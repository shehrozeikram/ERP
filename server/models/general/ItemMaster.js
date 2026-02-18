const mongoose = require('mongoose');

const itemMasterSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true },
    categoryPath: { type: String, required: true, trim: true },
    srNo: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

itemMasterSchema.index({ categoryPath: 1, name: 1 }, { unique: true });
itemMasterSchema.index({ categoryPath: 1, srNo: 1 });
itemMasterSchema.index({ category: 1 });
itemMasterSchema.index({ name: 1 });

module.exports = mongoose.model('ItemMaster', itemMasterSchema);

