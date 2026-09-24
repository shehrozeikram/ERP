const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { buildExecutiveMyApprovals } = require('../utils/executiveMyApprovals');
const { isDesignatedCeoApprover, isExecutiveOverride } = require('../utils/executiveAccess');

/**
 * GET /api/executive/my-approvals
 * Personal approval inbox for the logged-in user (CEO / Higher Management / assigned approvers).
 */
router.get('/my-approvals', asyncHandler(async (req, res) => {
  const result = await buildExecutiveMyApprovals(req.user);
  res.json({
    success: true,
    data: {
      items: result.items,
      counts: result.counts,
      isDesignatedCeo: result.isDesignatedCeo,
      viewer: {
        id: String(req.user?._id || req.user?.id || ''),
        name: `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim(),
        role: req.user?.role || null,
        isOverride: isExecutiveOverride(req.user)
      }
    }
  });
}));

/**
 * GET /api/executive/me
 * Lightweight flags for the dashboard widget.
 */
router.get('/me', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      isDesignatedCeo: isDesignatedCeoApprover(req.user),
      isOverride: isExecutiveOverride(req.user),
      role: req.user?.role || null
    }
  });
}));

module.exports = router;
