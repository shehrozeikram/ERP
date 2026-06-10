export const collectIds = (node, depth = 0, maxDepth = Infinity, ids = []) => {
  if (!node) return ids;
  if (depth >= maxDepth && node.children?.length) {
    ids.push(node.id);
  }
  (node.children || []).forEach((child) => collectIds(child, depth + 1, maxDepth, ids));
  return ids;
};

export const countNodes = (node) => {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((sum, child) => sum + countNodes(child), 0);
};

export const findNodeById = (node, id) => {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
};

export const flattenTree = (node, list = [], parentId = null, depth = 0) => {
  if (!node) return list;
  list.push({
    id: node.id,
    parentId,
    title: node.title,
    name: node.name,
    type: node.type,
    depth,
    isRoot: !!node.isRoot || (!parentId && depth === 0)
  });
  (node.children || []).forEach((child) => flattenTree(child, list, node.id, depth + 1));
  return list;
};

export const NODE_TYPE_OPTIONS = [
  { value: 'patron', label: 'Patron / President', hint: 'Top leadership (yellow)' },
  { value: 'project', label: 'Project', hint: 'Project box (yellow)' },
  { value: 'department', label: 'Department', hint: 'Department header (black)' },
  { value: 'management', label: 'Management', hint: 'Manager / GM / Director (lavender)' },
  { value: 'staff', label: 'Staff', hint: 'Individual staff role (grey)' }
];
