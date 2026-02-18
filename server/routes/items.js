const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const ItemMaster = require('../models/general/ItemMaster');

// GET /api/items/categories
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const categories = await ItemMaster.distinct('category', { isActive: true });
    categories.sort((a, b) => String(a).localeCompare(String(b)));
    res.json({ success: true, data: categories });
  })
);

// GET /api/items?category=Bricks&q=brick&limit=50
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category = '', q = '', limit = 50 } = req.query;
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 5000);

    const query = { isActive: true };
    if (category) query.category = category;
    if (q) query.name = { $regex: q, $options: 'i' };

    const items = await ItemMaster.find(query)
      .select('category categoryPath srNo name')
      .sort({ categoryPath: 1, srNo: 1, name: 1 })
      .limit(lim)
      .lean();

    res.json({ success: true, data: items });
  })
);

module.exports = router;

