const TYPE_DIMS = {
  patron: { width: 220, height: 80 },
  project: { width: 180, height: 72 },
  department: { width: 168, height: 68 },
  management: { width: 148, height: 64 },
  staff: { width: 128, height: 60 }
};

const SIBLING_H_GAP = 28;
const LEVEL_V_GAP = 88;
const CHILD_V_GAP = 10;
const PADDING = 48;

const getDims = (node) => {
  const base = TYPE_DIMS[node.type] || TYPE_DIMS.staff;
  let width = node.width || base.width;
  let height = node.height || base.height;
  const title = String(node.title || '');
  if (title.includes('Steering Committee') || title.length > 55) {
    width = Math.max(width, 300);
    height = Math.max(height, 96);
  }
  if (title.includes('COO PROJECTS') || title.includes('GM Admin')) {
    width = Math.max(width, 168);
  }
  if (title === 'Project Management Company' || title.includes('TAJ RESIDENCIA')) {
    width = Math.max(width, 200);
  }
  return { width, height };
};

/** Flat role list under a team/cell header */
const usesFlatVerticalStack = (node) =>
  node.type === 'project' || node.type === 'department';

/** Few peer management roles under a project header — side by side */
const usesHorizontalPeersUnderHeader = (node) => {
  const children = node.children || [];
  if (!usesFlatVerticalStack(node) || children.length < 2 || children.length > 4) return false;
  return children.every(
    (c) => c.type === 'management' && !(c.children || []).length
  );
};

/** Two executive boxes on top, shared department columns below (TAJ-style) */
const usesExecutivePlusColumnsLayout = (node) => {
  const children = node.children || [];
  if (!usesFlatVerticalStack(node) || children.length < 4) return false;
  const [first, second, ...columns] = children;
  if (first?.type !== 'management' || second?.type !== 'management') return false;
  if ((first.children || []).length || (second.children || []).length) return false;
  return columns.length >= 2;
};

/** COO + GM (or two executives) side by side, each with column subtree below */
const usesDualExecutiveLayout = (node) => {
  const children = node.children || [];
  if (!usesFlatVerticalStack(node) || children.length !== 2) return false;
  return children.every((c) => c.type === 'management' && (c.children || []).length > 0);
};

const measureSubtree = (node) => {
  const dims = getDims(node);
  const children = node.children || [];
  if (!children.length) {
    return { width: dims.width, height: dims.height };
  }

  if (usesExecutivePlusColumnsLayout(node)) {
    const [execA, execB, ...columns] = children;
    const execMeasures = [measureSubtree(execA), measureSubtree(execB)];
    const colMeasures = columns.map(measureSubtree);
    const execRowW = execMeasures[0].width + SIBLING_H_GAP + execMeasures[1].width;
    const colRowW = colMeasures.reduce((sum, m) => sum + m.width + SIBLING_H_GAP, -SIBLING_H_GAP);
    const width = Math.max(dims.width, execRowW, colRowW);
    const execRowH = Math.max(...execMeasures.map((m) => m.height));
    const colRowH = Math.max(...colMeasures.map((m) => m.height));
    const height = dims.height + LEVEL_V_GAP + execRowH + LEVEL_V_GAP + colRowH;
    return { width, height };
  }

  if (usesDualExecutiveLayout(node)) {
    const childMeasures = children.map(measureSubtree);
    const width = Math.max(
      dims.width,
      childMeasures.reduce((sum, m) => sum + m.width + SIBLING_H_GAP, -SIBLING_H_GAP)
    );
    const height = dims.height + LEVEL_V_GAP + Math.max(...childMeasures.map((m) => m.height));
    return { width, height };
  }

  if (usesHorizontalPeersUnderHeader(node)) {
    const childMeasures = children.map(measureSubtree);
    const width = Math.max(
      dims.width,
      childMeasures.reduce((sum, m) => sum + m.width + SIBLING_H_GAP, -SIBLING_H_GAP)
    );
    const height = dims.height + LEVEL_V_GAP + Math.max(...childMeasures.map((m) => m.height));
    return { width, height };
  }

  if (usesFlatVerticalStack(node)) {
    const childMeasures = children.map(measureSubtree);
    const width = Math.max(dims.width, ...childMeasures.map((m) => m.width));
    const stackHeight = childMeasures.reduce((sum, m) => sum + m.height + CHILD_V_GAP, -CHILD_V_GAP);
    return {
      width,
      height: dims.height + CHILD_V_GAP + stackHeight
    };
  }

  const childMeasures = children.map(measureSubtree);
  const gap = children.length === 1 ? CHILD_V_GAP : LEVEL_V_GAP;

  if (children.length === 1) {
    const childM = childMeasures[0];
    return {
      width: Math.max(dims.width, childM.width),
      height: dims.height + gap + childM.height
    };
  }

  const width = Math.max(
    dims.width,
    childMeasures.reduce((sum, m) => sum + m.width + SIBLING_H_GAP, -SIBLING_H_GAP)
  );
  const height = dims.height + LEVEL_V_GAP + Math.max(...childMeasures.map((m) => m.height));
  return { width, height };
};

const placeFlatVerticalStack = (node, centerX, top, positions) => {
  const dims = getDims(node);
  positions[node.id] = {
    posX: Math.round(centerX - dims.width / 2),
    posY: Math.round(top),
    width: dims.width,
    height: dims.height
  };

  const children = node.children || [];
  if (!children.length) return;

  if (usesExecutivePlusColumnsLayout(node)) {
    const [execA, execB, ...columns] = children;
    const execMeasures = [measureSubtree(execA), measureSubtree(execB)];
    const colMeasures = columns.map(measureSubtree);
    const execRowW = execMeasures[0].width + SIBLING_H_GAP + execMeasures[1].width;
    const colRowW = colMeasures.reduce((sum, m) => sum + m.width + SIBLING_H_GAP, -SIBLING_H_GAP);
    const execTop = top + dims.height + LEVEL_V_GAP;
    const execStart = centerX - execRowW / 2;
    [execA, execB].forEach((exec, i) => {
      const ed = getDims(exec);
      const offset = i === 0 ? 0 : execMeasures[0].width + SIBLING_H_GAP;
      positions[exec.id] = {
        posX: Math.round(execStart + offset + execMeasures[i].width / 2 - ed.width / 2),
        posY: Math.round(execTop),
        width: ed.width,
        height: ed.height
      };
    });
    const colTop = execTop + Math.max(...execMeasures.map((m) => m.height)) + LEVEL_V_GAP;
    let cursor = centerX - colRowW / 2;
    columns.forEach((col, i) => {
      const cm = colMeasures[i];
      const colCenter = cursor + cm.width / 2;
      if (usesFlatVerticalStack(col)) {
        placeFlatVerticalStack(col, colCenter, colTop, positions);
      } else if ((col.children || []).length) {
        placeVerticalChain(col, colCenter, colTop, positions);
      } else {
        const cd = getDims(col);
        positions[col.id] = {
          posX: Math.round(colCenter - cd.width / 2),
          posY: Math.round(colTop),
          width: cd.width,
          height: cd.height
        };
      }
      cursor += cm.width + SIBLING_H_GAP;
    });
    return;
  }

  if (usesDualExecutiveLayout(node)) {
    const childMeasures = children.map(measureSubtree);
    const totalW = childMeasures.reduce((sum, m) => sum + m.width + SIBLING_H_GAP, -SIBLING_H_GAP);
    let cursor = centerX - totalW / 2;
    const childTop = top + dims.height + LEVEL_V_GAP;
    children.forEach((child, i) => {
      placeVerticalChain(child, cursor + childMeasures[i].width / 2, childTop, positions);
      cursor += childMeasures[i].width + SIBLING_H_GAP;
    });
    return;
  }

  if (usesHorizontalPeersUnderHeader(node)) {
    const childMeasures = children.map(measureSubtree);
    const totalW = childMeasures.reduce((sum, m) => sum + m.width + SIBLING_H_GAP, -SIBLING_H_GAP);
    let cursor = centerX - totalW / 2;
    const childTop = top + dims.height + LEVEL_V_GAP;
    children.forEach((child, i) => {
      const cm = childMeasures[i];
      const childDims = getDims(child);
      positions[child.id] = {
        posX: Math.round(cursor + cm.width / 2 - childDims.width / 2),
        posY: Math.round(childTop),
        width: childDims.width,
        height: childDims.height
      };
      cursor += cm.width + SIBLING_H_GAP;
    });
    return;
  }

  let cursorY = top + dims.height + CHILD_V_GAP;
  children.forEach((child) => {
    if (usesFlatVerticalStack(child)) {
      placeFlatVerticalStack(child, centerX, cursorY, positions);
    } else {
      placeVerticalChain(child, centerX, cursorY, positions);
    }
    cursorY += measureSubtree(child).height + CHILD_V_GAP;
  });
};

/** Vertical chain with optional horizontal sub-columns (management hierarchy) */
const placeVerticalChain = (node, centerX, top, positions) => {
  const dims = getDims(node);
  positions[node.id] = {
    posX: Math.round(centerX - dims.width / 2),
    posY: Math.round(top),
    width: dims.width,
    height: dims.height
  };

  const children = node.children || [];
  if (!children.length) return;

  if (usesFlatVerticalStack(node)) {
    placeFlatVerticalStack(node, centerX, top, positions);
    return;
  }

  const gap = children.length === 1 ? CHILD_V_GAP : LEVEL_V_GAP;
  const childTop = top + dims.height + gap;

  if (children.length === 1) {
    const child = children[0];
    if (usesFlatVerticalStack(child)) {
      placeFlatVerticalStack(child, centerX, childTop, positions);
    } else {
      placeVerticalChain(child, centerX, childTop, positions);
    }
    return;
  }

  const childMeasures = children.map(measureSubtree);
  const totalW = childMeasures.reduce((sum, m) => sum + m.width + SIBLING_H_GAP, -SIBLING_H_GAP);
  let cursor = centerX - totalW / 2;

  children.forEach((child, i) => {
    const cm = childMeasures[i];
    const childCenter = cursor + cm.width / 2;
    if (usesFlatVerticalStack(child)) {
      placeFlatVerticalStack(child, childCenter, childTop, positions);
    } else {
      placeVerticalChain(child, childCenter, childTop, positions);
    }
    cursor += cm.width + SIBLING_H_GAP;
  });
};

const layoutNode = (node, left, top, positions) => {
  const dims = getDims(node);
  const subtree = measureSubtree(node);
  const x = left + subtree.width / 2 - dims.width / 2;

  positions[node.id] = {
    posX: Math.round(x),
    posY: Math.round(top),
    width: dims.width,
    height: dims.height
  };

  const children = node.children || [];
  if (!children.length) return;

  if (usesFlatVerticalStack(node)) {
    placeFlatVerticalStack(node, left + subtree.width / 2, top, positions);
    return;
  }

  const gap = children.length === 1 ? CHILD_V_GAP : LEVEL_V_GAP;
  const childTop = top + dims.height + gap;
  const childMeasures = children.map(measureSubtree);
  const totalChildW = childMeasures.reduce((sum, m) => sum + m.width + SIBLING_H_GAP, -SIBLING_H_GAP);
  let cursor = left + (subtree.width - totalChildW) / 2;

  children.forEach((child, i) => {
    const cm = childMeasures[i];
    const childCenter = cursor + cm.width / 2;
    if (usesFlatVerticalStack(child)) {
      placeFlatVerticalStack(child, childCenter, childTop, positions);
    } else {
      placeVerticalChain(child, childCenter, childTop, positions);
    }
    cursor += cm.width + SIBLING_H_GAP;
  });
};

const computeLayoutFromTree = (root) => {
  if (!root) return {};
  const positions = {};
  layoutNode(root, PADDING, PADDING, positions);
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
