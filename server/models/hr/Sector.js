const mongoose = require('mongoose');

const sectorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  industry: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  parentSector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sector'
  },
  subSectors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sector'
  }],
  companies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  }],
  employees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Pre-save middleware to auto-generate code
sectorSchema.pre('save', async function(next) {
  if (!this.code) {
    try {
      // Find the last sector to get the highest code
      const lastSector = await this.constructor.findOne({}, { code: 1 })
        .sort({ code: -1 });

      let nextCode = 'SEC001';
      
      if (lastSector && lastSector.code) {
        // Extract the number from the last code (e.g., "SEC123" -> 123)
        const lastNumber = parseInt(lastSector.code.replace(/^SEC/, ''));
        const nextNumber = lastNumber + 1;
        // Format as SEC + 3-digit number
        nextCode = `SEC${nextNumber.toString().padStart(3, '0')}`;
      }

      this.code = nextCode;
      console.log(`Generated new Sector code: ${this.code}`);
    } catch (error) {
      console.error('Error generating Sector code:', error);
      // Fallback to timestamp-based code
      this.code = `SEC${Date.now().toString().slice(-3)}`;
    }
  }
  next();
});

// Index for better query performance
sectorSchema.index({ name: 1 });
sectorSchema.index({ code: 1 });
sectorSchema.index({ industry: 1 });
sectorSchema.index({ isActive: 1 });

module.exports = mongoose.model('Sector', sectorSchema);
