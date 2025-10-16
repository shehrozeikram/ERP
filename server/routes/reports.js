const express = require('express');
const { authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Lead = require('../models/crm/Lead');
const Contact = require('../models/crm/Contact');
const Company = require('../models/crm/Company');
const Opportunity = require('../models/crm/Opportunity');
const Campaign = require('../models/crm/Campaign');
const User = require('../models/User');

const router = express.Router();

// ==================== REPORTS ROUTES ====================

// @route   GET /api/reports/dashboard
// @desc    Get comprehensive dashboard analytics
// @access  Private (CRM and Admin)
router.get('/dashboard', 
  authorize('super_admin', 'admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get leads statistics
    const leadsStats = await Lead.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          newLeads: { $sum: { $cond: [{ $eq: ['$status', 'New'] }, 1, 0] } },
          contactedLeads: { $sum: { $cond: [{ $eq: ['$status', 'Contacted'] }, 1, 0] } },
          qualifiedLeads: { $sum: { $cond: [{ $eq: ['$status', 'Qualified'] }, 1, 0] } },
          avgScore: { $avg: '$score' }
        }
      }
    ]);

    // Get contacts statistics
    const contactsStats = await Contact.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalContacts: { $sum: 1 },
          activeContacts: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          customers: { $sum: { $cond: [{ $eq: ['$type', 'Customer'] }, 1, 0] } },
          prospects: { $sum: { $cond: [{ $eq: ['$type', 'Prospect'] }, 1, 0] } }
        }
      }
    ]);

    // Get opportunities statistics
    const opportunitiesStats = await Opportunity.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalOpportunities: { $sum: 1 },
          totalValue: { $sum: '$amount' },
          weightedValue: { $sum: { $multiply: ['$amount', { $divide: ['$probability', 100] }] } },
          closedWon: { $sum: { $cond: [{ $eq: ['$stage', 'Closed Won'] }, 1, 0] } },
          closedLost: { $sum: { $cond: [{ $eq: ['$stage', 'Closed Lost'] }, 1, 0] } },
          avgProbability: { $avg: '$probability' }
        }
      }
    ]);

    // Get campaigns statistics
    const campaignsStats = await Campaign.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalCampaigns: { $sum: 1 },
          activeCampaigns: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          totalBudget: { $sum: '$budget' },
          totalRevenue: { $sum: '$actualRevenue' },
          totalLeads: { $sum: '$totalLeads' },
          avgConversionRate: { $avg: '$conversionRate' }
        }
      }
    ]);

    // Get monthly trends
    const monthlyTrends = await Lead.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    // Get top performing users
    const topUsers = await User.aggregate([
      {
        $lookup: {
          from: 'opportunities',
          localField: '_id',
          foreignField: 'assignedTo',
          as: 'opportunities'
        }
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          totalOpportunities: { $size: '$opportunities' },
          totalValue: { $sum: '$opportunities.amount' },
          closedWon: {
            $size: {
              $filter: {
                input: '$opportunities',
                cond: { $eq: ['$$this.stage', 'Closed Won'] }
              }
            }
          }
        }
      },
      { $sort: { totalValue: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      data: {
        leads: leadsStats[0] || {
          totalLeads: 0,
          newLeads: 0,
          contactedLeads: 0,
          qualifiedLeads: 0,
          avgScore: 0
        },
        contacts: contactsStats[0] || {
          totalContacts: 0,
          activeContacts: 0,
          customers: 0,
          prospects: 0
        },
        opportunities: opportunitiesStats[0] || {
          totalOpportunities: 0,
          totalValue: 0,
          weightedValue: 0,
          closedWon: 0,
          closedLost: 0,
          avgProbability: 0
        },
        campaigns: campaignsStats[0] || {
          totalCampaigns: 0,
          activeCampaigns: 0,
          totalBudget: 0,
          totalRevenue: 0,
          totalLeads: 0,
          avgConversionRate: 0
        },
        monthlyTrends,
        topUsers
      }
    });
  })
);

// @route   GET /api/reports/sales-pipeline
// @desc    Get sales pipeline report
// @access  Private (CRM and Admin)
router.get('/sales-pipeline', 
  authorize('super_admin', 'admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const { startDate, endDate, assignedTo } = req.query;
    
    const matchFilter = {};
    if (startDate || endDate) {
      matchFilter.createdAt = {};
      if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
      if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
    }
    if (assignedTo) matchFilter.assignedTo = assignedTo;

    const pipeline = await Opportunity.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$stage',
          count: { $sum: 1 },
          totalValue: { $sum: '$amount' },
          avgProbability: { $avg: '$probability' },
          avgAmount: { $avg: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get opportunities by user
    const opportunitiesByUser = await Opportunity.aggregate([
      { $match: matchFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedTo',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $addFields: {
          userName: { $concat: [{ $ifNull: [{ $arrayElemAt: ['$user.firstName', 0] }, ''] }, ' ', { $ifNull: [{ $arrayElemAt: ['$user.lastName', 0] }, ''] }] }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          userName: { $first: '$userName' },
          count: { $sum: 1 },
          totalValue: { $sum: '$amount' },
          closedWon: { $sum: { $cond: [{ $eq: ['$stage', 'Closed Won'] }, 1, 0] } }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);

    // Get conversion rates
    const conversionRates = await Opportunity.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          closedWon: { $sum: { $cond: [{ $eq: ['$stage', 'Closed Won'] }, 1, 0] } },
          closedLost: { $sum: { $cond: [{ $eq: ['$stage', 'Closed Lost'] }, 1, 0] } }
        }
      }
    ]);

    const conversionRate = conversionRates[0] ? 
      (conversionRates[0].closedWon / conversionRates[0].total) * 100 : 0;

    res.json({
      success: true,
      data: {
        pipeline,
        opportunitiesByUser,
        conversionRate,
        totalOpportunities: conversionRates[0]?.total || 0,
        closedWon: conversionRates[0]?.closedWon || 0,
        closedLost: conversionRates[0]?.closedLost || 0
      }
    });
  })
);

// @route   GET /api/reports/lead-conversion
// @desc    Get lead conversion report
// @access  Private (CRM and Admin)
router.get('/lead-conversion', 
  authorize('super_admin', 'admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const { startDate, endDate, source } = req.query;
    
    const matchFilter = {};
    if (startDate || endDate) {
      matchFilter.createdAt = {};
      if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
      if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
    }
    if (source) matchFilter.source = source;

    // Get leads by status
    const leadsByStatus = await Lead.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgScore: { $avg: '$score' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get leads by source
    const leadsBySource = await Lead.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          avgScore: { $avg: '$score' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get conversion funnel
    const conversionFunnel = await Lead.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          contacted: { $sum: { $cond: [{ $ne: ['$status', 'New'] }, 1, 0] } },
          qualified: { $sum: { $cond: [{ $eq: ['$status', 'Qualified'] }, 1, 0] } },
          converted: { $sum: { $cond: [{ $eq: ['$status', 'Converted'] }, 1, 0] } }
        }
      }
    ]);

    // Get leads by assigned user
    const leadsByUser = await Lead.aggregate([
      { $match: matchFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedTo',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $addFields: {
          userName: { $concat: [{ $ifNull: [{ $arrayElemAt: ['$user.firstName', 0] }, ''] }, ' ', { $ifNull: [{ $arrayElemAt: ['$user.lastName', 0] }, ''] }] }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          userName: { $first: '$userName' },
          count: { $sum: 1 },
          qualified: { $sum: { $cond: [{ $eq: ['$status', 'Qualified'] }, 1, 0] } },
          converted: { $sum: { $cond: [{ $eq: ['$status', 'Converted'] }, 1, 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const funnel = conversionFunnel[0] || {
      totalLeads: 0,
      contacted: 0,
      qualified: 0,
      converted: 0
    };

    res.json({
      success: true,
      data: {
        leadsByStatus,
        leadsBySource,
        conversionFunnel: funnel,
        leadsByUser,
        conversionRates: {
          contactRate: funnel.totalLeads > 0 ? (funnel.contacted / funnel.totalLeads) * 100 : 0,
          qualificationRate: funnel.contacted > 0 ? (funnel.qualified / funnel.contacted) * 100 : 0,
          conversionRate: funnel.qualified > 0 ? (funnel.converted / funnel.qualified) * 100 : 0
        }
      }
    });
  })
);

// @route   GET /api/reports/campaign-performance
// @desc    Get campaign performance report
// @access  Private (CRM and Admin)
router.get('/campaign-performance', 
  authorize('super_admin', 'admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const { startDate, endDate, type } = req.query;
    
    const matchFilter = {};
    if (startDate || endDate) {
      matchFilter.startDate = {};
      if (startDate) matchFilter.startDate.$gte = new Date(startDate);
      if (endDate) matchFilter.startDate.$lte = new Date(endDate);
    }
    if (type) matchFilter.type = type;

    // Get campaigns by type
    const campaignsByType = await Campaign.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalBudget: { $sum: '$budget' },
          totalRevenue: { $sum: '$actualRevenue' },
          totalLeads: { $sum: '$totalLeads' },
          avgConversionRate: { $avg: '$conversionRate' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    // Get campaigns by status
    const campaignsByStatus = await Campaign.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalBudget: { $sum: '$budget' },
          totalRevenue: { $sum: '$actualRevenue' }
        }
      }
    ]);

    // Get ROI by campaign
    const campaignROI = await Campaign.aggregate([
      { $match: matchFilter },
      {
        $project: {
          name: 1,
          budget: 1,
          actualRevenue: 1,
          roi: {
            $cond: [
              { $gt: ['$budget', 0] },
              { $multiply: [{ $divide: [{ $subtract: ['$actualRevenue', '$budget'] }, '$budget'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { roi: -1 } },
      { $limit: 10 }
    ]);

    // Get campaign metrics
    const campaignMetrics = await Campaign.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalCampaigns: { $sum: 1 },
          totalBudget: { $sum: '$budget' },
          totalRevenue: { $sum: '$actualRevenue' },
          totalLeads: { $sum: '$totalLeads' },
          avgConversionRate: { $avg: '$conversionRate' },
          avgROI: {
            $avg: {
              $cond: [
                { $gt: ['$budget', 0] },
                { $multiply: [{ $divide: [{ $subtract: ['$actualRevenue', '$budget'] }, '$budget'] }, 100] },
                0
              ]
            }
          }
        }
      }
    ]);

    const metrics = campaignMetrics[0] || {
      totalCampaigns: 0,
      totalBudget: 0,
      totalRevenue: 0,
      totalLeads: 0,
      avgConversionRate: 0,
      avgROI: 0
    };

    res.json({
      success: true,
      data: {
        campaignsByType,
        campaignsByStatus,
        campaignROI,
        metrics,
        overallROI: metrics.totalBudget > 0 ? 
          ((metrics.totalRevenue - metrics.totalBudget) / metrics.totalBudget) * 100 : 0
      }
    });
  })
);

// @route   GET /api/reports/user-performance
// @desc    Get user performance report
// @access  Private (CRM and Admin)
router.get('/user-performance', 
  authorize('super_admin', 'admin', 'crm_manager'), 
  asyncHandler(async (req, res) => {
    const { startDate, endDate, userId } = req.query;
    
    const matchFilter = {};
    if (startDate || endDate) {
      matchFilter.createdAt = {};
      if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
      if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
    }
    if (userId) matchFilter.assignedTo = userId;

    // Get user performance for opportunities
    const userOpportunities = await Opportunity.aggregate([
      { $match: matchFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedTo',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $addFields: {
          userName: { $concat: [{ $ifNull: [{ $arrayElemAt: ['$user.firstName', 0] }, ''] }, ' ', { $ifNull: [{ $arrayElemAt: ['$user.lastName', 0] }, ''] }] }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          userName: { $first: '$userName' },
          totalOpportunities: { $sum: 1 },
          totalValue: { $sum: '$amount' },
          closedWon: { $sum: { $cond: [{ $eq: ['$stage', 'Closed Won'] }, 1, 0] } },
          closedLost: { $sum: { $cond: [{ $eq: ['$stage', 'Closed Lost'] }, 1, 0] } },
          avgProbability: { $avg: '$probability' }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);

    // Get user performance for leads
    const userLeads = await Lead.aggregate([
      { $match: matchFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedTo',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $addFields: {
          userName: { $concat: [{ $ifNull: [{ $arrayElemAt: ['$user.firstName', 0] }, ''] }, ' ', { $ifNull: [{ $arrayElemAt: ['$user.lastName', 0] }, ''] }] }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          userName: { $first: '$userName' },
          totalLeads: { $sum: 1 },
          qualifiedLeads: { $sum: { $cond: [{ $eq: ['$status', 'Qualified'] }, 1, 0] } },
          convertedLeads: { $sum: { $cond: [{ $eq: ['$status', 'Converted'] }, 1, 0] } },
          avgScore: { $avg: '$score' }
        }
      },
      { $sort: { totalLeads: -1 } }
    ]);

    // Get user performance for campaigns
    const userCampaigns = await Campaign.aggregate([
      { $match: matchFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedTo',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $addFields: {
          userName: { $concat: [{ $ifNull: [{ $arrayElemAt: ['$user.firstName', 0] }, ''] }, ' ', { $ifNull: [{ $arrayElemAt: ['$user.lastName', 0] }, ''] }] }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          userName: { $first: '$userName' },
          totalCampaigns: { $sum: 1 },
          activeCampaigns: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          totalBudget: { $sum: '$budget' },
          totalRevenue: { $sum: '$actualRevenue' },
          avgConversionRate: { $avg: '$conversionRate' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        userOpportunities,
        userLeads,
        userCampaigns
      }
    });
  })
);

// @route   GET /api/reports/export/:type
// @desc    Export report data
// @access  Private (CRM and Admin)
router.get('/export/:type', 
  authorize('super_admin', 'admin', 'crm_manager'), 
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const { startDate, endDate, format = 'json' } = req.query;
    
    const matchFilter = {};
    if (startDate || endDate) {
      matchFilter.createdAt = {};
      if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
      if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
    }

    let data;
    let filename;

    switch (type) {
      case 'dashboard':
        // Export comprehensive dashboard data
        const [leads, opportunities, contacts, companies] = await Promise.all([
          Lead.find(matchFilter)
            .populate('assignedTo', 'firstName lastName email')
            .select('firstName lastName email company status source priority createdAt')
            .sort({ createdAt: -1 }),
          Opportunity.find(matchFilter)
            .populate('company', 'name')
            .populate('assignedTo', 'firstName lastName email')
            .select('title stage amount expectedCloseDate company assignedTo createdAt')
            .sort({ createdAt: -1 }),
          Contact.find(matchFilter)
            .populate('company', 'name')
            .select('firstName lastName email phone company status createdAt')
            .sort({ createdAt: -1 }),
          Company.find(matchFilter)
            .select('name industry status type size createdAt')
            .sort({ createdAt: -1 })
        ]);
        
        data = {
          summary: {
            totalLeads: leads.length,
            totalOpportunities: opportunities.length,
            totalContacts: contacts.length,
            totalCompanies: companies.length,
            exportDate: new Date()
          },
          leads,
          opportunities,
          contacts,
          companies
        };
        filename = 'dashboard-report';
        break;
      
      case 'leads':
        data = await Lead.find(matchFilter)
          .populate('assignedTo', 'firstName lastName email')
          .populate('company', 'name industry')
          .sort({ createdAt: -1 });
        filename = 'leads-report';
        break;
      
      case 'opportunities':
        data = await Opportunity.find(matchFilter)
          .populate('assignedTo', 'firstName lastName email')
          .populate('company', 'name industry')
          .populate('contact', 'firstName lastName email')
          .sort({ createdAt: -1 });
        filename = 'opportunities-report';
        break;
      
      case 'campaigns':
        data = await Campaign.find(matchFilter)
          .populate('assignedTo', 'firstName lastName email')
          .sort({ createdAt: -1 });
        filename = 'campaigns-report';
        break;
      
      case 'contacts':
        data = await Contact.find(matchFilter)
          .populate('assignedTo', 'firstName lastName email')
          .populate('company', 'name industry')
          .sort({ createdAt: -1 });
        filename = 'contacts-report';
        break;
      
      case 'companies':
        data = await Company.find(matchFilter)
          .populate('assignedTo', 'firstName lastName email')
          .sort({ createdAt: -1 });
        filename = 'companies-report';
        break;
      
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type'
        });
    }

    if (format === 'csv') {
      // Convert to CSV format
      const csvData = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csvData);
    }

    res.json({
      success: true,
      data,
      filename: `${filename}.json`
    });
  })
);

// Helper function to convert data to CSV
function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]._doc || data[0]);
  const csvRows = [headers.join(',')];
  
  data.forEach(item => {
    const values = headers.map(header => {
      const value = item[header];
      if (typeof value === 'object' && value !== null) {
        return `"${JSON.stringify(value)}"`;
      }
      return `"${value || ''}"`;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

module.exports = router; 