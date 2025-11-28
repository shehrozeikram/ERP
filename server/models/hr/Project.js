const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  projectId: {
    type: String,
    required: true,
    unique: true,
    default: () => `PROJ${Date.now().toString().slice(-6)}`
  },
  code: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  client: {
    type: String,
    trim: true,
    default: 'Internal'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'],
    default: 'Active'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  budget: {
    type: Number,
    default: 0
  },
  actualCost: {
    type: Number,
    default: 0
  },
  projectManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  teamMembers: [{
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    role: String,
    startDate: Date,
    endDate: Date,
    allocation: {
      type: Number, // Percentage of time allocated
      min: 0,
      max: 100
    }
  }],
  departments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  }],
  milestones: [{
    name: String,
    description: String,
    dueDate: Date,
    status: {
      type: String,
      enum: ['Not Started', 'In Progress', 'Completed', 'Delayed'],
      default: 'Not Started'
    },
    completionDate: Date
  }],
  risks: [{
    description: String,
    impact: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical']
    },
    probability: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical']
    },
    mitigation: String,
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
      default: 'Open'
    }
  }],
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better query performance
projectSchema.index({ projectId: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ startDate: 1 });
projectSchema.index({ projectManager: 1 });

module.exports = mongoose.model('Project', projectSchema);
