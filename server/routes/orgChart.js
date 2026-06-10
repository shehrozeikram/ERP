const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const permissions = require('../middleware/permissions');
const OrgChartNode = require('../models/hr/OrgChartNode');
const { NODE_TYPES } = require('../models/hr/OrgChartNode');
const {
  toClientNode,
  buildTreeFromFlat,
  isDescendant,
  deleteNodeCascade,
  seedFromNestedTree,
  countNodes
} = require('../utils/orgChartTree');
const {
  getDims,
  needsLayout,
  applyLayoutToDatabase,
  computeLayoutFromTree
} = require('../utils/orgChartLayout');

const router = express.Router();
const perm = (action) => permissions.checkSubRolePermission('hr', 'organizational_development', action);

const getActorId = (req) => req.user?._id || req.user?.id;

const loadFlatNodes = () =>
  OrgChartNode.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();

const nodeValidators = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('name').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('type').isIn(NODE_TYPES).withMessage('Invalid node type'),
  body('isVacant').optional().isBoolean()
];

// GET /api/hr/org-chart/tree
router.get('/tree', perm('read'), asyncHandler(async (req, res) => {
  const flat = await loadFlatNodes();
  if (!flat.length) {
    return res.json({ success: true, empty: true, data: null, count: 0 });
  }
  const tree = buildTreeFromFlat(flat);
  res.json({ success: true, empty: false, data: tree, count: countNodes(tree) });
}));

// GET /api/hr/org-chart/nodes — flat list for editor
router.get('/nodes', perm('read'), asyncHandler(async (req, res) => {
  const flat = await loadFlatNodes();
  res.json({
    success: true,
    data: flat.map(toClientNode),
    count: flat.length,
    needsLayout: needsLayout(flat)
  });
}));

// GET /api/hr/org-chart/canvas — flat nodes for Visio-style canvas
router.get('/canvas', perm('read'), asyncHandler(async (req, res) => {
  const flat = await loadFlatNodes();
  if (!flat.length) {
    return res.json({ success: true, empty: true, data: [], count: 0 });
  }
  const tree = buildTreeFromFlat(flat);
  res.json({
    success: true,
    empty: false,
    data: flat.map(toClientNode),
    tree,
    count: flat.length,
    needsLayout: needsLayout(flat)
  });
}));

// GET /api/hr/org-chart/meta
router.get('/meta', perm('read'), asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      nodeTypes: NODE_TYPES,
      typeLabels: {
        patron: 'Patron / President',
        project: 'Project',
        department: 'Department',
        management: 'Management',
        staff: 'Staff'
      }
    }
  });
}));

// POST /api/hr/org-chart/nodes
router.post('/nodes', perm('create'), nodeValidators, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { title, name, type, isVacant, parentId, posX, posY } = req.body;
  let parent = null;
  let sortOrder = 0;
  const dims = getDims({ type });

  if (parentId) {
    parent = await OrgChartNode.findById(parentId);
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent node not found' });
    }
    const maxSibling = await OrgChartNode.findOne({ parent: parentId, isActive: true })
      .sort({ sortOrder: -1 })
      .select('sortOrder')
      .lean();
    sortOrder = (maxSibling?.sortOrder ?? -1) + 1;
  } else {
    const existingRoot = await OrgChartNode.findOne({ isRoot: true, isActive: true });
    if (existingRoot) {
      return res.status(400).json({
        success: false,
        message: 'Root node already exists. Add children under the root or specify parentId.'
      });
    }
  }

  const doc = await OrgChartNode.create({
    parent: parent?._id || null,
    isRoot: !parent,
    title,
    name: name || '',
    type,
    isVacant: !!isVacant,
    sortOrder,
    posX: typeof posX === 'number' ? posX : null,
    posY: typeof posY === 'number' ? posY : null,
    width: dims.width,
    height: dims.height,
    createdBy: getActorId(req),
    updatedBy: getActorId(req)
  });

  res.status(201).json({ success: true, data: toClientNode(doc) });
}));

// PUT /api/hr/org-chart/nodes/:id
router.put('/nodes/:id', perm('update'), nodeValidators, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const doc = await OrgChartNode.findById(req.params.id);
  if (!doc || !doc.isActive) {
    return res.status(404).json({ success: false, message: 'Node not found' });
  }

  const { title, name, type, isVacant } = req.body;
  doc.title = title;
  doc.name = name || '';
  doc.type = type;
  doc.isVacant = !!isVacant;
  doc.updatedBy = getActorId(req);
  await doc.save();

  res.json({ success: true, data: toClientNode(doc) });
}));

// PATCH /api/hr/org-chart/nodes/:id/move
router.patch('/nodes/:id/move', perm('update'), asyncHandler(async (req, res) => {
  const { parentId, sortOrder } = req.body;
  const nodeId = req.params.id;

  const doc = await OrgChartNode.findById(nodeId);
  if (!doc || !doc.isActive) {
    return res.status(404).json({ success: false, message: 'Node not found' });
  }

  if (doc.isRoot) {
    return res.status(400).json({ success: false, message: 'Cannot move the root node' });
  }

  const flat = await loadFlatNodes();

  if (parentId) {
    if (parentId === nodeId) {
      return res.status(400).json({ success: false, message: 'Cannot move a node under itself' });
    }
    if (isDescendant(flat, nodeId, parentId)) {
      return res.status(400).json({ success: false, message: 'Cannot move a node under its own descendant' });
    }
    const parent = await OrgChartNode.findById(parentId);
    if (!parent || !parent.isActive) {
      return res.status(404).json({ success: false, message: 'Parent node not found' });
    }
    doc.parent = parent._id;
  }

  if (typeof sortOrder === 'number' && !Number.isNaN(sortOrder)) {
    doc.sortOrder = sortOrder;
  } else if (parentId) {
    const maxSibling = await OrgChartNode.findOne({
      parent: doc.parent,
      isActive: true,
      _id: { $ne: doc._id }
    })
      .sort({ sortOrder: -1 })
      .select('sortOrder')
      .lean();
    doc.sortOrder = (maxSibling?.sortOrder ?? -1) + 1;
  }

  doc.updatedBy = getActorId(req);
  await doc.save();

  res.json({ success: true, data: toClientNode(doc) });
}));

// PATCH /api/hr/org-chart/nodes/:id/position — Visio-style free placement
router.patch('/nodes/:id/position', perm('update'), asyncHandler(async (req, res) => {
  const { posX, posY, width, height } = req.body;
  const doc = await OrgChartNode.findById(req.params.id);
  if (!doc || !doc.isActive) {
    return res.status(404).json({ success: false, message: 'Node not found' });
  }

  if (typeof posX === 'number') doc.posX = posX;
  if (typeof posY === 'number') doc.posY = posY;
  if (typeof width === 'number' && width >= 80) doc.width = width;
  if (typeof height === 'number' && height >= 40) doc.height = height;
  doc.updatedBy = getActorId(req);
  await doc.save();

  res.json({ success: true, data: toClientNode(doc) });
}));

// POST /api/hr/org-chart/auto-layout — arrange all nodes like Visio org chart wizard
router.post('/auto-layout', perm('update'), asyncHandler(async (req, res) => {
  const flat = await loadFlatNodes();
  if (!flat.length) {
    return res.status(400).json({ success: false, message: 'No nodes to layout' });
  }
  const tree = buildTreeFromFlat(flat);
  await applyLayoutToDatabase(flat, tree, getActorId(req));
  const updated = await loadFlatNodes();
  res.json({
    success: true,
    message: 'Auto layout applied',
    data: updated.map(toClientNode),
    count: updated.length
  });
}));

// PATCH /api/hr/org-chart/nodes/:id/reorder — swap with sibling
router.patch('/nodes/:id/reorder', perm('update'), asyncHandler(async (req, res) => {
  const { direction } = req.body;
  if (!['up', 'down'].includes(direction)) {
    return res.status(400).json({ success: false, message: 'direction must be up or down' });
  }

  const doc = await OrgChartNode.findById(req.params.id);
  if (!doc || !doc.isActive) {
    return res.status(404).json({ success: false, message: 'Node not found' });
  }

  const siblings = await OrgChartNode.find({
    parent: doc.parent || null,
    isActive: true
  })
    .sort({ sortOrder: 1, createdAt: 1 });

  const idx = siblings.findIndex((s) => s._id.equals(doc._id));
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) {
    return res.json({ success: true, data: toClientNode(doc), message: 'Already at boundary' });
  }

  const other = siblings[swapIdx];
  const tmp = doc.sortOrder;
  doc.sortOrder = other.sortOrder;
  other.sortOrder = tmp;
  doc.updatedBy = getActorId(req);
  other.updatedBy = getActorId(req);
  await Promise.all([doc.save(), other.save()]);

  res.json({ success: true, data: toClientNode(doc) });
}));

// DELETE /api/hr/org-chart/nodes/:id
router.delete('/nodes/:id', perm('delete'), asyncHandler(async (req, res) => {
  const doc = await OrgChartNode.findById(req.params.id);
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Node not found' });
  }

  if (doc.isRoot) {
    return res.status(400).json({ success: false, message: 'Cannot delete the root node' });
  }

  const cascade = req.query.cascade === 'true';
  const childCount = await OrgChartNode.countDocuments({ parent: doc._id, isActive: true });

  if (childCount > 0 && !cascade) {
    return res.status(400).json({
      success: false,
      message: `Node has ${childCount} child(ren). Pass ?cascade=true to delete all descendants.`,
      childCount
    });
  }

  const deleted = cascade
    ? await deleteNodeCascade(doc._id)
    : (await OrgChartNode.findByIdAndDelete(doc._id), 1);

  res.json({ success: true, deleted });
}));

// POST /api/hr/org-chart/seed — import default JSON if DB empty
router.post('/seed', perm('create'), asyncHandler(async (req, res) => {
  const count = await OrgChartNode.countDocuments();
  const force = req.body?.force === true;

  if (count > 0 && !force) {
    return res.status(400).json({
      success: false,
      message: 'Org chart already has data. Pass { force: true } to replace all nodes.',
      count
    });
  }

  let defaultTree;
  try {
    defaultTree = require('../data/sgc-org-chart-default.json');
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Default org chart data file not found on server'
    });
  }

  const layoutByLegacyId = computeLayoutFromTree(defaultTree);
  const root = await seedFromNestedTree(defaultTree, getActorId(req), layoutByLegacyId);
  const flat = await loadFlatNodes();
  const tree = buildTreeFromFlat(flat);
  if (needsLayout(flat)) {
    await applyLayoutToDatabase(flat, tree, getActorId(req));
  }

  res.json({
    success: true,
    message: force ? 'Org chart replaced from default data' : 'Org chart seeded from default data',
    data: tree,
    count: countNodes(tree),
    rootId: root._id.toString()
  });
}));

module.exports = router;
