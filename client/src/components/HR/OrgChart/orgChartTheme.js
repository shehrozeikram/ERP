export const ORG_NODE_STYLES = {
  patron: {
    backgroundColor: '#F5D547',
    color: '#111111',
    border: '2px solid #B8960C',
    fontWeight: 700,
    minWidth: 220,
    fontSize: '0.9rem'
  },
  project: {
    backgroundColor: '#F5D547',
    color: '#111111',
    border: '2px solid #B8960C',
    fontWeight: 700,
    minWidth: 180,
    fontSize: '0.82rem'
  },
  department: {
    backgroundColor: '#1A1A1A',
    color: '#FFFFFF',
    border: '2px solid #1A1A1A',
    fontWeight: 600,
    minWidth: 150,
    fontSize: '0.8rem'
  },
  management: {
    backgroundColor: '#E8E4F0',
    color: '#111111',
    border: '1px solid #C5BFD6',
    fontWeight: 500,
    minWidth: 130,
    fontSize: '0.75rem'
  },
  staff: {
    backgroundColor: '#F7F7F7',
    color: '#333333',
    border: '1px solid #DDDDDD',
    fontWeight: 400,
    minWidth: 120,
    fontSize: '0.72rem'
  }
};

export const getOrgNodeSx = (node, highlighted = false) => {
  const base = ORG_NODE_STYLES[node.type] || ORG_NODE_STYLES.staff;
  const textColor = node.isVacant ? '#D32F2F' : base.color;

  return {
    ...base,
    color: textColor,
    px: 1,
    py: 0.75,
    borderRadius: 0.5,
    textAlign: 'center',
    boxShadow: highlighted
      ? '0 0 0 3px rgba(25, 118, 210, 0.45)'
      : '0 1px 4px rgba(0,0,0,0.15)',
    cursor: node.children?.length ? 'pointer' : 'default',
    transition: 'box-shadow 0.2s ease',
    lineHeight: 1.25
  };
};
