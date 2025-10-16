const mongoose = require('mongoose');

const networkDeviceSchema = new mongoose.Schema({
  deviceName: {
    type: String,
    required: [true, 'Device name is required'],
    trim: true,
    maxlength: [100, 'Device name cannot exceed 100 characters']
  },
  deviceType: {
    type: String,
    enum: [
      'Router', 'Switch', 'Firewall', 'Access Point', 'Server', 'NAS', 'Printer',
      'Camera', 'UPS', 'Modem', 'Load Balancer', 'Proxy Server', 'DNS Server',
      'DHCP Server', 'Mail Server', 'Web Server', 'Database Server', 'Other'
    ],
    required: [true, 'Device type is required']
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true
  },
  model: {
    type: String,
    required: [true, 'Model is required'],
    trim: true
  },
  serialNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  ipAddress: {
    primary: {
      type: String,
      trim: true
    },
    secondary: [String],
    management: String
  },
  macAddress: {
    type: String,
    trim: true,
    uppercase: true
  },
  location: {
    building: String,
    floor: String,
    room: String,
    rack: String,
    position: String
  },
  status: {
    type: String,
    enum: ['Online', 'Offline', 'Maintenance', 'Error', 'Unknown'],
    default: 'Unknown'
  },
  uptime: {
    current: {
      type: Number,
      default: 0 // seconds
    },
    lastCheck: Date,
    totalUptime: {
      type: Number,
      default: 0 // seconds
    },
    totalDowntime: {
      type: Number,
      default: 0 // seconds
    }
  },
  specifications: {
    cpu: String,
    memory: String,
    storage: String,
    ports: Number,
    powerConsumption: String,
    operatingSystem: String,
    firmware: String,
    other: String
  },
  networkConfig: {
    subnet: String,
    gateway: String,
    dns: [String],
    vlan: [String],
    protocols: [String]
  },
  security: {
    encryption: [String],
    authentication: String,
    certificates: [{
      name: String,
      issuer: String,
      expiryDate: Date,
      status: String
    }]
  },
  monitoring: {
    enabled: {
      type: Boolean,
      default: false
    },
    snmp: {
      community: String,
      version: String,
      port: Number
    },
    ping: {
      enabled: Boolean,
      interval: Number // seconds
    },
    bandwidth: {
      maxSpeed: String,
      currentUsage: String
    }
  },
  maintenance: {
    lastServiceDate: Date,
    nextServiceDate: Date,
    serviceProvider: String,
    warranty: {
      startDate: Date,
      endDate: Date,
      provider: String
    }
  },
  purchaseInfo: {
    purchaseDate: Date,
    purchasePrice: Number,
    currency: {
      type: String,
      default: 'PKR',
      enum: ['PKR', 'USD', 'EUR']
    },
    supplier: String
  },
  notes: String,
  isActive: {
    type: Boolean,
    default: true
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

// Indexes
networkDeviceSchema.index({ deviceName: 1 });
networkDeviceSchema.index({ deviceType: 1 });
networkDeviceSchema.index({ status: 1 });
networkDeviceSchema.index({ 'ipAddress.primary': 1 });
networkDeviceSchema.index({ location: 1 });
networkDeviceSchema.index({ isActive: 1 });

// Virtual for uptime percentage
networkDeviceSchema.virtual('uptimePercentage').get(function() {
  const total = this.uptime.totalUptime + this.uptime.totalDowntime;
  if (total === 0) return 100;
  return ((this.uptime.totalUptime / total) * 100).toFixed(2);
});

// Virtual for warranty status
networkDeviceSchema.virtual('warrantyStatus').get(function() {
  if (!this.maintenance?.warranty?.endDate) return 'No Warranty';
  
  const today = new Date();
  const endDate = new Date(this.maintenance.warranty.endDate);
  
  if (today > endDate) return 'Expired';
  if (today > new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)) return 'Expiring Soon';
  return 'Active';
});

// Virtual for device age
networkDeviceSchema.virtual('age').get(function() {
  if (!this.purchaseInfo?.purchaseDate) return null;
  
  const today = new Date();
  const purchaseDate = new Date(this.purchaseInfo.purchaseDate);
  let age = today.getFullYear() - purchaseDate.getFullYear();
  const monthDiff = today.getMonth() - purchaseDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < purchaseDate.getDate())) {
    age--;
  }
  
  return age;
});

// Static methods
networkDeviceSchema.statics.findOnlineDevices = function() {
  return this.find({ 
    status: 'Online',
    isActive: true 
  });
};

networkDeviceSchema.statics.findOfflineDevices = function() {
  return this.find({ 
    status: 'Offline',
    isActive: true 
  });
};

networkDeviceSchema.statics.findByLocation = function(building, floor = null, room = null) {
  const query = { 
    isActive: true,
    'location.building': building
  };
  
  if (floor) query['location.floor'] = floor;
  if (room) query['location.room'] = room;
  
  return this.find(query);
};

networkDeviceSchema.statics.getNetworkStatistics = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalDevices: { $sum: 1 },
        onlineDevices: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Online'] }, 1, 0]
          }
        },
        offlineDevices: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Offline'] }, 1, 0]
          }
        },
        maintenanceDevices: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Maintenance'] }, 1, 0]
          }
        },
        errorDevices: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Error'] }, 1, 0]
          }
        },
        averageUptime: { $avg: '$uptimePercentage' },
        totalValue: { $sum: '$purchaseInfo.purchasePrice' }
      }
    }
  ]);
  
  const typeStats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$deviceType',
        count: { $sum: 1 },
        onlineCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Online'] }, 1, 0]
          }
        },
        averageUptime: { $avg: '$uptimePercentage' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  return {
    overview: stats[0] || {
      totalDevices: 0,
      onlineDevices: 0,
      offlineDevices: 0,
      maintenanceDevices: 0,
      errorDevices: 0,
      averageUptime: 0,
      totalValue: 0
    },
    byType: typeStats
  };
};

module.exports = mongoose.model('NetworkDevice', networkDeviceSchema);
