const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee is required']
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: Date.now
  },
  checkIn: {
    time: {
      type: Date,
      required: [true, 'Check-in time is required']
    },
    location: {
      type: String,
      default: 'Office'
    },
    method: {
      type: String,
      enum: ['Manual', 'Biometric', 'Card', 'Mobile', 'Web'],
      default: 'Manual'
    },
    late: {
      type: Boolean,
      default: false
    },
    lateMinutes: {
      type: Number,
      default: 0
    }
  },
  checkOut: {
    time: {
      type: Date
    },
    location: {
      type: String,
      default: 'Office'
    },
    method: {
      type: String,
      enum: ['Manual', 'Biometric', 'Card', 'Mobile', 'Web'],
      default: 'Manual'
    },
    early: {
      type: Boolean,
      default: false
    },
    earlyMinutes: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Late', 'Half Day', 'Leave', 'Holiday', 'Weekend', 'Sick Leave', 'Personal Leave', 'Maternity Leave', 'Paternity Leave'],
    required: [true, 'Status is required'],
    default: 'Present'
  },
  workHours: {
    type: Number,
    default: 0,
    min: [0, 'Work hours cannot be negative']
  },
  overtimeHours: {
    type: Number,
    default: 0,
    min: [0, 'Overtime hours cannot be negative']
  },
  breakTime: {
    type: Number,
    default: 0,
    min: [0, 'Break time cannot be negative']
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  approvedAt: {
    type: Date
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
attendanceSchema.index({ employee: 1, date: 1 });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ employee: 1, status: 1 });
attendanceSchema.index({ isApproved: 1 });

// Virtual for formatted date
attendanceSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for formatted check-in time
attendanceSchema.virtual('formattedCheckIn').get(function() {
  if (!this.checkIn.time) return 'Not checked in';
  return this.checkIn.time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
});

// Virtual for formatted check-out time
attendanceSchema.virtual('formattedCheckOut').get(function() {
  if (!this.checkOut.time) return 'Not checked out';
  return this.checkOut.time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
});

// Virtual for total hours worked
attendanceSchema.virtual('totalHours').get(function() {
  if (!this.checkIn.time || !this.checkOut.time) return 0;
  const diffMs = this.checkOut.time - this.checkIn.time;
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.round(diffHours * 100) / 100;
});

// Pre-save middleware to calculate work hours
attendanceSchema.pre('save', function(next) {
  if (this.checkIn.time && this.checkOut.time) {
    const diffMs = this.checkOut.time - this.checkIn.time;
    const diffHours = diffMs / (1000 * 60 * 60);
    const totalHours = Math.round(diffHours * 100) / 100;
    
    // Subtract break time from total hours to get actual work hours
    const breakTime = this.breakTime || 0;
    this.workHours = Math.max(0, Math.round((totalHours - breakTime) * 100) / 100);
    
    // Calculate overtime (assuming 8 hours is standard work day)
    this.overtimeHours = this.workHours > 8 ? Math.round((this.workHours - 8) * 100) / 100 : 0;
  }
  next();
});

// Static method to find attendance by employee and date range
attendanceSchema.statics.findByEmployeeAndDateRange = function(employeeId, startDate, endDate) {
  return this.find({
    employee: employeeId,
    date: {
      $gte: startDate,
      $lte: endDate
    },
    isActive: true
  }).populate('employee', 'firstName lastName employeeId department');
};

// Static method to find attendance by department and date
attendanceSchema.statics.findByDepartmentAndDate = function(department, date) {
  return this.find({
    'employee.department': department,
    date: {
      $gte: new Date(date.setHours(0, 0, 0, 0)),
      $lt: new Date(date.setHours(23, 59, 59, 999))
    },
    isActive: true
  }).populate('employee', 'firstName lastName employeeId department');
};

// Static method to get attendance statistics
attendanceSchema.statics.getStatistics = async function(startDate, endDate) {
  const stats = await this.aggregate([
    {
      $match: {
        date: {
          $gte: startDate,
          $lte: endDate
        },
        isActive: true
      }
    },
    {
      $lookup: {
        from: 'employees',
        localField: 'employee',
        foreignField: '_id',
        as: 'employeeData'
      }
    },
    {
      $unwind: '$employeeData'
    },
    {
      $group: {
        _id: null,
        totalRecords: { $sum: 1 },
        presentCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Present'] }, 1, 0]
          }
        },
        absentCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0]
          }
        },
        lateCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Late'] }, 1, 0]
          }
        },
        leaveCount: {
          $sum: {
            $cond: [{ $in: ['$status', ['Leave', 'Sick Leave', 'Personal Leave']] }, 1, 0]
          }
        },
        totalWorkHours: { $sum: '$workHours' },
        totalOvertimeHours: { $sum: '$overtimeHours' },
        averageWorkHours: { $avg: '$workHours' }
      }
    }
  ]);
  
  return stats[0] || {
    totalRecords: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    leaveCount: 0,
    totalWorkHours: 0,
    totalOvertimeHours: 0,
    averageWorkHours: 0
  };
};

// Static method to get department-wise attendance
attendanceSchema.statics.getDepartmentAttendance = async function(date) {
  return this.aggregate([
    {
      $match: {
        date: {
          $gte: new Date(date.setHours(0, 0, 0, 0)),
          $lt: new Date(date.setHours(23, 59, 59, 999))
        },
        isActive: true
      }
    },
    {
      $lookup: {
        from: 'employees',
        localField: 'employee',
        foreignField: '_id',
        as: 'employeeData'
      }
    },
    {
      $unwind: '$employeeData'
    },
    {
      $group: {
        _id: '$employeeData.department',
        totalEmployees: { $sum: 1 },
        presentCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Present'] }, 1, 0]
          }
        },
        absentCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0]
          }
        },
        lateCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Late'] }, 1, 0]
          }
        },
        leaveCount: {
          $sum: {
            $cond: [{ $in: ['$status', ['Leave', 'Sick Leave', 'Personal Leave']] }, 1, 0]
          }
        },
        totalWorkHours: { $sum: '$workHours' },
        averageWorkHours: { $avg: '$workHours' }
      }
    },
    {
      $project: {
        department: '$_id',
        totalEmployees: 1,
        presentCount: 1,
        absentCount: 1,
        lateCount: 1,
        leaveCount: 1,
        totalWorkHours: 1,
        averageWorkHours: 1,
        attendancePercentage: {
          $multiply: [
            {
              $divide: ['$presentCount', '$totalEmployees']
            },
            100
          ]
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Attendance', attendanceSchema); 