const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const passwordWalletSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Password title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Admin Panel',
      'Database Access',
      'Server Credentials',
      'API Keys',
      'VPN Access',
      'Cloud Services',
      'Email Account',
      'Software License',
      'Network Device',
      'Domain/DNS',
      'Payment Gateway',
      'Third Party Service',
      'Other'
    ]
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    trim: true
  },
  encryptedPassword: {
    type: String,
    required: [true, 'Password is required']
  },
  url: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v || v.trim() === '') return true; // URL is optional
        // Allow both http and https URLs, and also allow URLs without protocol
        return /^(https?:\/\/.+|www\..+|.+\..+)/.test(v.trim());
      },
      message: 'Please provide a valid URL (e.g., https://example.com or www.example.com)'
    }
  },
  additionalFields: [{
    label: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: String,
      required: true,
      trim: true
    },
    isEncrypted: {
      type: Boolean,
      default: false
    }
  }],
  tags: [String],
  expiryDate: {
    type: Date,
    validate: {
      validator: function(v) {
        return !v || v > new Date();
      },
      message: 'Expiry date must be in the future'
    }
  },
  lastUsed: Date,
  usageCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  securityLevel: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
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

// Indexes for better performance
passwordWalletSchema.index({ vendor: 1 });
passwordWalletSchema.index({ category: 1 });
passwordWalletSchema.index({ title: 1 });
passwordWalletSchema.index({ tags: 1 });
passwordWalletSchema.index({ isActive: 1 });
passwordWalletSchema.index({ expiryDate: 1 });

// Virtual for decrypted password (not stored in DB)
passwordWalletSchema.virtual('password').get(function() {
  return this._decryptedPassword;
}).set(function(password) {
  this._decryptedPassword = password;
});

// Pre-save middleware to encrypt password
passwordWalletSchema.pre('save', async function(next) {
  try {
    // Only encrypt if password has been set via virtual setter or is new
    if (this._decryptedPassword || this.isNew) {
      if (this._decryptedPassword) {
        // Generate salt and encrypt password
        const salt = await bcrypt.genSalt(12);
        this.encryptedPassword = await bcrypt.hash(this._decryptedPassword, salt);
        console.log('🔒 Password encrypted successfully');
      }
    }

    // Encrypt additional fields if needed
    if (this.isModified('additionalFields')) {
      for (let field of this.additionalFields) {
        if (field.isEncrypted && field.value && !field.value.startsWith('$2a$')) {
          const salt = await bcrypt.genSalt(12);
          field.value = await bcrypt.hash(field.value, salt);
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to decrypt password
passwordWalletSchema.methods.decryptPassword = async function(masterPassword) {
  try {
    // For now, we'll use a simple approach
    // In production, you might want to use a more sophisticated encryption
    return this._decryptedPassword || '[ENCRYPTED]';
  } catch (error) {
    throw new Error('Failed to decrypt password');
  }
};

// Instance method to verify password
passwordWalletSchema.methods.verifyPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.encryptedPassword);
};

// Instance method to increment usage
passwordWalletSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

// Static method to find expired passwords
passwordWalletSchema.statics.findExpired = function() {
  return this.find({
    expiryDate: { $lt: new Date() },
    isActive: true
  });
};

// Static method to find passwords expiring soon
passwordWalletSchema.statics.findExpiringSoon = function(days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    expiryDate: { 
      $gte: new Date(), 
      $lte: futureDate 
    },
    isActive: true
  });
};

// Virtual for password strength
passwordWalletSchema.virtual('passwordStrength').get(function() {
  if (!this._decryptedPassword) return 'Unknown';
  
  const password = this._decryptedPassword;
  let score = 0;
  
  // Length check
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  
  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  
  if (score <= 2) return 'Weak';
  if (score <= 4) return 'Medium';
  return 'Strong';
});

// Virtual for days until expiry
passwordWalletSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.expiryDate) return null;
  
  const today = new Date();
  const diffTime = this.expiryDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
});

// Ensure virtual fields are included in JSON output
passwordWalletSchema.set('toJSON', { virtuals: true });
passwordWalletSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PasswordWallet', passwordWalletSchema);
