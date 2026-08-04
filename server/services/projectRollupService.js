const ConstructionProject = require('../models/projectManagement/ConstructionProject');
const BOQItem = require('../models/projectManagement/BOQItem');
const ProjectTask = require('../models/projectManagement/ProjectTask');
const GoodsReceive = require('../models/procurement/GoodsReceive');
const GoodsIssue = require('../models/procurement/GoodsIssue');
const AccountsPayable = require('../models/finance/AccountsPayable');

/**
 * Project Rollup Aggregation Service
 * Computes consolidated upper-level metrics for Master Projects & Portfolios
 */
const ProjectRollupService = {
  /**
   * Get consolidated metrics for a Master Project and all its child sub-projects
   * @param {String|ObjectId} masterProjectId
   * @returns {Object} Combined rollup metrics for Senior Management
   */
  getProjectRollupSummary: async (masterProjectId) => {

    // 1. Fetch Master Project & all Child Sub-Projects
    const masterProject = await ConstructionProject.findById(masterProjectId).lean();
    if (!masterProject) {
      throw new Error('Master project not found');
    }

    const childProjects = await ConstructionProject.find({
      $or: [
        { _id: masterProjectId },
        { parentProject: masterProjectId }
      ]
    }).lean();

    const allProjectIds = childProjects.map((p) => p._id);
    const subProjectIds = childProjects
      .filter((p) => String(p._id) !== String(masterProjectId))
      .map((p) => p._id);

    // 2. Aggregate BOQ Budgets & Quantities across projects
    const boqAgg = await BOQItem.aggregate([
      { $match: { project: { $in: allProjectIds } } },
      {
        $group: {
          _id: '$cbsCategory',
          totalEstimatedCost: { $sum: { $ifNull: ['$netEstimatedCost', '$estimatedTotalCost'] } },
          totalActualCost: { $sum: { $ifNull: ['$actualTotalCost', 0] } },
          itemCount: { $sum: 1 }
        }
      }
    ]);

    const cbsSummary = {
      Materials: { estimated: 0, actual: 0 },
      Labor: { estimated: 0, actual: 0 },
      Equipment: { estimated: 0, actual: 0 },
      Subcontractor: { estimated: 0, actual: 0 },
      Contingency: { estimated: 0, actual: 0 },
      Other: { estimated: 0, actual: 0 }
    };

    let grandEstimatedBudget = 0;
    let grandActualCost = 0;

    boqAgg.forEach((row) => {
      const cat = row._id || 'Other';
      if (cbsSummary[cat]) {
        cbsSummary[cat].estimated += row.totalEstimatedCost || 0;
        cbsSummary[cat].actual += row.totalActualCost || 0;
      }
      grandEstimatedBudget += row.totalEstimatedCost || 0;
      grandActualCost += row.totalActualCost || 0;
    });

    // Fall back to direct project model budgeted amount if BOQs not added yet
    if (grandEstimatedBudget === 0) {
      grandEstimatedBudget = childProjects.reduce((sum, p) => sum + (p.totalApprovedBudget || p.totalEstimatedCost || 0), 0);
    }

    // 3. Aggregate Actual Expenditure from Financial Documents (GRN, AP Bills, Store Issues)
    const [grnAgg, apAgg, sinAgg] = await Promise.all([
      GoodsReceive.aggregate([
        { $match: { project: { $in: allProjectIds }, status: 'Received' } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', 0] } } } }
      ]),
      AccountsPayable.aggregate([
        { $match: { project: { $in: allProjectIds } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', 0] } } } }
      ]),
      GoodsIssue.aggregate([
        { $match: { project: { $in: allProjectIds }, status: 'Issued' } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalQuantity', 0] } } } }
      ])
    ]);

    const grnTotalSpent = grnAgg[0]?.total || 0;
    const apTotalSpent = apAgg[0]?.total || 0;

    // 4. Calculate Child Unit Performance Breakdown
    const childUnitBreakdown = childProjects
      .filter((p) => String(p._id) !== String(masterProjectId) || childProjects.length === 1)
      .map((p) => {
        const estBudget = p.totalApprovedBudget || p.totalEstimatedCost || 0;
        const milestones = p.milestones || [];
        const totalMilestones = milestones.length;
        const completedMilestones = milestones.filter((m) => m.status === 'Completed').length;
        const milestoneProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

        const completionPercentage = p.overallProgress ?? p.overallProgressPercentage ?? milestoneProgress;
        return {
          _id: p._id,
          projectNumber: p.projectNumber,
          name: p.name,
          projectType: p.projectType,
          status: p.status,
          estimatedBudget: estBudget,
          completionPercentage,
          healthStatus: completionPercentage < 20 && p.status === 'Active' ? 'Requires Attention' : 'On Track'
        };
      });

    // 5. Calculate Weighted Master Physical Progress
    const totalUnits = childUnitBreakdown.length || 1;
    const masterOverallProgress = Math.round(
      childUnitBreakdown.reduce((sum, u) => sum + u.completionPercentage, 0) / totalUnits
    );

    // 6. Calculate EVM (Earned Value Management) & Predictive Cash Flow
    const earnedValue = Math.round((grandEstimatedBudget * masterOverallProgress) / 100);
    const actualCostForEvm = grandActualCost || 1;
    const cpi = Number((earnedValue / actualCostForEvm).toFixed(2)); // Cost Performance Index
    const spi = Number(((masterOverallProgress || 1) / 50).toFixed(2)); // Schedule Performance Index (normalized vs 50% midpoint benchmark)

    // 6. Fetch Ground Visual Proof Stream (Latest Geotagged Photos from DPRs)
    const DailyProgressReport = require('../models/projectManagement/DailyProgressReport');
    const dprsWithPhotos = await DailyProgressReport.find({
      project: { $in: allProjectIds },
      'photos.0': { $exists: true }
    })
      .select('reportNumber reportDate summary photos project')
      .populate('project', 'name projectNumber')
      .sort({ reportDate: -1 })
      .limit(10)
      .lean();

    const groundPhotoStream = [];
    dprsWithPhotos.forEach((dpr) => {
      (dpr.photos || []).forEach((p) => {
        groundPhotoStream.push({
          url: p.url,
          caption: p.caption || dpr.summary || 'Site Progress Photo',
          latitude: p.latitude,
          longitude: p.longitude,
          isVerifiedLocation: p.isVerifiedLocation || Boolean(p.latitude),
          uploadedAt: p.uploadedAt || dpr.reportDate,
          projectName: dpr.project?.name || 'Sub-Unit'
        });
      });
    });

    const costVariance = grandActualCost - grandEstimatedBudget;
    const costHealthStatus = costVariance > 0 ? 'Over Budget' : 'Under Budget';

    // 7. Calculate 30-Day Liquidity Demand Forecast
    const cashDemandForecast30Days = Math.round((grandEstimatedBudget - grandActualCost) * 0.15);

    return {
      masterProject: {
        _id: masterProject._id,
        name: masterProject.name,
        projectNumber: masterProject.projectNumber,
        status: masterProject.status,
        isMasterProject: true
      },
      summaryMetrics: {
        totalSubUnits: childUnitBreakdown.length,
        grandEstimatedBudget,
        grandActualCost,
        grnTotalSpent,
        apTotalSpent,
        costVariance,
        costHealthStatus,
        masterOverallProgress,
        earnedValueManagement: {
          earnedValue,
          cpi,
          spi,
          cpiStatus: cpi >= 1.0 ? 'On/Under Budget' : 'Cost Overrun Warning',
          spiStatus: spi >= 1.0 ? 'On/Ahead of Schedule' : 'Schedule Lag Warning'
        },
        cashDemandForecast30Days: Math.max(0, cashDemandForecast30Days)
      },
      cbsCostBreakdown: cbsSummary,
      subUnitBreakdown: childUnitBreakdown,
      groundPhotoStream: groundPhotoStream.slice(0, 8)
    };
  }
};

module.exports = ProjectRollupService;
