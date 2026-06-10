const TYPE_DIMS = {
  patron: { width: 220, height: 80 },
  project: { width: 180, height: 72 },
  department: { width: 168, height: 68 },
  management: { width: 148, height: 64 },
  staff: { width: 128, height: 60 }
};

const H_GAP = 28;
const V_GAP = 88;
const PADDING = 48;

const getDims = (node) => {
  const base = TYPE_DIMS[node.type] || TYPE_DIMS.staff;
  return {
    width: node.width || base.width,
    height: node.height || base.height
  };
};

const measureWidth = (node) => {
  const dims = getDims(node);
  const children = node.children || [];
  if (!children.length) return dims.width;
  const kidsW = children.reduce((sum, child) => sum + measureWidth(child) + H_GAP, -H_GAP);
  return Math.max(dims.width, kidsW);
};

const assignPositions = (node, left, depth, positions) => {
  const dims = getDims(node);
  const subtreeW = measureWidth(node);
  const x = left + subtreeW / 2 - dims.width / 2;
  const y = PADDING + depth * V_GAP;

  positions[node.id] = {
    posX: Math.round(x),
    posY: Math.round(y),
    width: dims.width,
    height: dims.height
  };

  const children = node.children || [];
  if (!children.length) return;

  let cursor = left + (subtreeW - children.reduce((s, c) => s + measureWidth(c) + H_GAP, -H_GAP)) / 2;
  children.forEach((child) => {
    const childW = measureWidth(child);
    assignPositions(child, cursor, depth + 1, positions);
    cursor += childW + H_GAP;
  });
};

const computeLayoutFromTree = (root) => {
  if (!root) return {};
  const positions = {};
  assignPositions(root, PADDING, 0, positions);
  return positions;
};

const computeLayoutFromFlat = (flatNodes, tree) => {
  if (!tree) return {};
  const positions = computeLayoutFromTree(tree);
  flatNodes.forEach((n) => {
    const id = n._id?.toString?.() || n.id;
    if (positions[id]) return;
    const dims = getDims(n);
    positions[id] = {
      posX: n.posX ?? PADDING,
      posY: n.posY ?? PADDING,
      width: n.width || dims.width,
      height: n.height || dims.height
    };
  });
  return positions;
};

const needsLayout = (flatNodes) =>
  flatNodes.some((n) => n.posX == null || n.posY == null);

const applyLayoutToDatabase = async (flatNodes, tree, userId) => {
  const OrgChartNode = require('../models/hr/OrgChartNode');
  const positions = computeLayoutFromFlat(flatNodes, tree);
  const ops = Object.entries(positions).map(([id, pos]) =>
    OrgChartNode.updateOne(
      { _id: id },
      {
        $set: {
          posX: pos.posX,
          posY: pos.posY,
          width: pos.width,
          height: pos.height,
          ...(userId ? { updatedBy: userId } : {})
        }
      }
    )
  );
  await Promise.all(ops);
  return positions;
};

module.exports = {
  TYPE_DIMS,
  getDims,
  computeLayoutFromTree,
  computeLayoutFromFlat,
  needsLayout,
  applyLayoutToDatabase
};
