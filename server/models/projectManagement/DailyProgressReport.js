const mongoose = require('mongoose');

const dailyProgressReportSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConstructionProject',
    required: true,
    index: true
  },

  reportNumber: { type: String, unique: true, sparse: true, trim: true },
  reportDate: { type: Date, required: true },

  weather: { type: String, trim: true },
  temperature: { type: String, trim: true },

  // Workforce count by trade
  workforceCivil: { type: Number, default: 0, min: 0 },
  workforceElectrical: { type: Number, default: 0, min: 0 },
  workforcePlumbing: { type: Number, default: 0, min: 0 },
  workforceSupervisors: { type: Number, default: 0, min: 0 },
  workforceTotal: { type: Number, default: 0, min: 0 },

  // Work done entries (linked to tasks)
  workDone: [{
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectTask', default: null },
    taskTitle: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    progressToday: { type: Number, default: 0, min: 0, max: 100 }
  }],

  // Materials consumed on site today
  materialsUsed: [{
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 0, min: 0 },
    unit: { type: String, trim: true }
  }],

  // Site issues / blockers
  issues: [{
    description: { type: String, required: true, trim: true },
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    status: { type: String, enum: ['Open', 'Resolved'], default: 'Open' },
    reportedBy: { type: String, trim: true }
  }],

  // Site photos
  photos: [{
    url: { type: String, trim: true },
    caption: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now }
  }],

  summary: { type: String, trim: true },
  nextDayPlan: { type: String, trim: true },

  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Auto-generate report number and total workforce
dailyProgressReportSchema.pre('save', async function (next) {
  if (this.isNew && !this.reportNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    this.reportNumber = `DPR-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  this.workforceTotal = (this.workforceCivil || 0) + (this.workforceElectrical || 0) + (this.workforcePlumbing || 0) + (this.workforceSupervisors || 0);
  next();
});

dailyProgressReportSchema.index({ project: 1, reportDate: -1 });

module.exports = mongoose.model('DailyProgressReport', dailyProgressReportSchema);
