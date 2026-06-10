const OrgChartNode = require('../models/hr/OrgChartNode');
const { getDims } = require('./orgChartLayout');

const toClientNode = (doc) => {
  const dims = getDims(doc);
  return {
    id: doc._id.toString(),
    _id: doc._id.toString(),
    parent: doc.parent ? doc.parent.toString() : null,
    isRoot: !!doc.isRoot,
    title: doc.title,
    name: doc.name || '',
    type: doc.type,
    isVacant: !!doc.isVacant,
    sortOrder: doc.sortOrder ?? 0,
    posX: doc.posX,
    posY: doc.posY,
    width: doc.width || dims.width,
    height: doc.height || dims.height,
    legacyId: doc.legacyId || '',
    isActive: doc.isActive !== false
  };
};

const sortChildren = (node) => {
  if (!node.children) return;
  node.children.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  node.children.forEach(sortChildren);
};

const buildTreeFromFlat = (flatNodes) => {
  const byId = new Map();
  flatNodes.forEach((doc) => {
    const node = { ...toClientNode(doc), children: [] };
    byId.set(node.id, node);
  });

  let root = null;
  byId.forEach((node) => {
    if (node.isRoot || !node.parent) {
      if (!root || node.isRoot) root = node;
      return;
    }
    const parent = byId.get(node.parent);
    if (parent) parent.children.push(node);
    else if (!root) root = node;
  });

  if (root) sortChildren(root);
  return root;
};

const getDescendantIds = (flatNodes, nodeId) => {
  const childrenByParent = new Map();
  flatNodes.forEach((n) => {
    const pid = n.parent ? n.parent.toString() : null;
    if (!pid) return;
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
    childrenByParent.get(pid).push(n._id.toString());
  });

  const ids = new Set();
  const stack = [nodeId];
  while (stack.length) {
    const current = stack.pop();
    ids.add(current);
    (childrenByParent.get(current) || []).forEach((childId) => stack.push(childId));
  }
  return ids;
};

const isDescendant = (flatNodes, ancestorId, nodeId) =>
  getDescendantIds(flatNodes, ancestorId).has(nodeId);

const deleteNodeCascade = async (nodeId) => {
  const all = await OrgChartNode.find({ isActive: true }).select('_id parent').lean();
  const ids = getDescendantIds(all, nodeId.toString());
  await OrgChartNode.deleteMany({ _id: { $in: [...ids] } });
  return ids.size;
};

const seedFromNestedTree = async (tree, userId, layoutPositions = {}) => {
  await OrgChartNode.deleteMany({});

  const insertNode = async (node, parentId, sortOrder, isRoot = false) => {
    const dims = getDims(node);
    const layout = layoutPositions[node.id] || {};
    const doc = await OrgChartNode.create({
      parent: parentId,
      isRoot,
      title: node.title,
      name: node.name || '',
      type: node.type || 'staff',
      isVacant: !!node.isVacant,
      sortOrder,
      posX: layout.posX ?? null,
      posY: layout.posY ?? null,
      width: layout.width || dims.width,
      height: layout.height || dims.height,
      legacyId: node.id || '',
      createdBy: userId,
      updatedBy: userId
    });

    const children = node.children || [];
    for (let i = 0; i < children.length; i++) {
      await insertNode(children[i], doc._id, i, false);
    }
    return doc;
  };

  const root = await insertNode(tree, null, 0, true);
  return root;
};

const countNodes = (node) =>
  1 + (node.children || []).reduce((sum, child) => sum + countNodes(child), 0);

module.exports = {
  toClientNode,
  buildTreeFromFlat,
  getDescendantIds,
  isDescendant,
  deleteNodeCascade,
  seedFromNestedTree,
  countNodes
};
