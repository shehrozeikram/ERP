const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Section name is required'],
    trim: true,
    maxlength: [100, 'Section name cannot exceed 100 characters']
  },
  code: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Section code cannot exceed 10 characters']
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department is required']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: String
}, {
  timestamps: true
});

// Indexes
sectionSchema.index({ name: 1 });
sectionSchema.index({ code: 1 });
sectionSchema.index({ department: 1 });
sectionSchema.index({ isActive: 1 });

// Virtual for full section info
sectionSchema.virtual('fullInfo').get(function() {
  return `${this.name} (${this.code})`;
});

// Static method to find active sections
sectionSchema.statics.findActive = function() {
  return this.find({ isActive: true }).populate('department', 'name code').sort({ name: 1 });
};

// Static method to find sections by department
sectionSchema.statics.findByDepartment = function(departmentId) {
  return this.find({ department: departmentId, isActive: true }).sort({ name: 1 });
};

// Pre-save middleware to auto-generate code
sectionSchema.pre('save', async function(next) {
  if (!this.code) {
    try {
      let attempts = 0;
      let nextCode;
      let isUnique = false;
      
      while (!isUnique && attempts < 10) {
        // Find the last section to get the highest code
        const lastSection = await this.constructor.findOne({}, { code: 1 })
          .sort({ code: -1 });

        if (!lastSection || !lastSection.code) {
          nextCode = 'SEC001';
        } else {
          // Extract the number from the last code (e.g., "SEC123" -> 123)
          const lastNumber = parseInt(lastSection.code.replace(/^SEC/, ''));
          if (isNaN(lastNumber)) {
            nextCode = 'SEC001';
          } else {
            const nextNumber = lastNumber + 1 + attempts;
            // Format as SEC + 3-digit number
            nextCode = `SEC${nextNumber.toString().padStart(3, '0')}`;
          }
        }

        // Check if this code already exists
        const existingSection = await this.constructor.findOne({ code: nextCode });
        if (!existingSection) {
          isUnique = true;
        } else {
          attempts++;
        }
      }

      if (!isUnique) {
        // Fallback to timestamp-based code if we can't find a unique sequential code
        nextCode = `SEC${Date.now().toString().slice(-3)}`;
      }

      this.code = nextCode.toUpperCase();
      console.log(`Generated new Section code: ${this.code}`);
    } catch (error) {
      console.error('Error generating Section code:', error);
      // Fallback to timestamp-based code
      this.code = `SEC${Date.now().toString().slice(-3)}`.toUpperCase();
    }
  }
  next();
});

module.exports = mongoose.model('Section', sectionSchema); 