export const GRID_SIZE = 20;

export const snapToGrid = (value, grid = GRID_SIZE) =>
  Math.round(value / grid) * grid;

export const buildConnectorPath = (parent, child) => {
  if (parent.posX == null || child.posX == null) return '';
  const x1 = parent.posX + parent.width / 2;
  const y1 = parent.posY + parent.height;
  const x2 = child.posX + child.width / 2;
  const y2 = child.posY;
  const midY = y1 + Math.max(28, (y2 - y1) * 0.5);
  return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
};

export const getCanvasBounds = (nodes, padding = 120) => {
  const list = Object.values(nodes).filter((n) => n.posX != null && n.posY != null);
  if (!list.length) {
    return { width: 1200, height: 800, minX: 0, minY: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  list.forEach((n) => {
    minX = Math.min(minX, n.posX);
    minY = Math.min(minY, n.posY);
    maxX = Math.max(maxX, n.posX + n.width);
    maxY = Math.max(maxY, n.posY + n.height);
  });
  return {
    minX: minX - padding,
    minY: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2
  };
};
