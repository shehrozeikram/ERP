const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ROLE_VALUES } = require('../config/permissions');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ROLE_VALUES,
    default: 'employee'
  },
  // New role reference (for future use)
  roleRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
  },
  subRoles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubRole'
  }],
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true
  },
  position: {
    type: String,
    required: [true, 'Position is required'],
    trim: true
  },
  employeeId: {
    type: String,
    unique: true,
    required: [true, 'Employee ID is required']
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        // Allow empty/null values or valid phone numbers
        if (!v || v === '') return true;
        return /^[\+]?[1-9][\d]{0,15}$/.test(v);
      },
      message: 'Please enter a valid phone number'
    }
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  dateOfBirth: {
    type: Date
  },
  hireDate: {
    type: Date,
    default: Date.now
  },
  salary: {
    type: Number,
    min: [0, 'Salary cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  profileImage: {
    type: String
  },
  lastLogin: {
    type: Date
  },
  permissions: [{
    module: {
      type: String,
      enum: ['hr', 'finance', 'procurement', 'sales', 'crm']
    },
    actions: [{
      type: String,
      enum: ['create', 'read', 'update', 'delete', 'approve']
    }]
  }]
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ employeeId: 1 });
userSchema.index({ department: 1 });
userSchema.index({ role: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age
userSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate JWT token
userSchema.methods.generateAuthToken = function() {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('❌ JWT_SECRET environment variable is not set');
      throw new Error('JWT_SECRET not configured');
    }

    return jwt.sign(
      { 
        userId: this._id,
        email: this.email,
        role: this.role,
        department: this.department,
        iat: Math.floor(Date.now() / 1000) // Issued at
      },
      jwtSecret,
      { 
        // JWT token expiration - default 24 hours
        // Set JWT_EXPIRE environment variable to change (e.g., '7d' for 7 days, '24h' for 24 hours)
        // IMPORTANT: Do not set to less than 1 hour to prevent frequent logouts
        expiresIn: process.env.JWT_EXPIRE || '24h',
        issuer: 'sgc-erp',
        audience: 'sgc-erp-users'
      }
    );
  } catch (error) {
    console.error('❌ Error generating JWT token:', error.message);
    throw new Error('Failed to generate authentication token');
  }
};

// Method to get user profile (without sensitive data)
userSchema.methods.getProfile = function() {
  return {
    id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    fullName: this.fullName,
    email: this.email,
    role: this.role,
    subRoles: this.subRoles,
    department: this.department,
    position: this.position,
    employeeId: this.employeeId,
    phone: this.phone,
    address: this.address,
    dateOfBirth: this.dateOfBirth,
    age: this.age,
    hireDate: this.hireDate,
    salary: this.salary,
    isActive: this.isActive,
    isEmailVerified: this.isEmailVerified,
    profileImage: this.profileImage,
    lastLogin: this.lastLogin,
    permissions: this.permissions,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Static method to find user by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to find users by department
userSchema.statics.findByDepartment = function(department) {
  return this.find({ department, isActive: true });
};

module.exports = mongoose.model('User', userSchema); 