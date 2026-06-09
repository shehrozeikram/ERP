import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import OrgChartNode from './OrgChartNode';

const nodeMatchesSearch = (node, term) => {
  if (!term) return false;
  const q = term.toLowerCase();
  return (
    node.title?.toLowerCase().includes(q) ||
    node.name?.toLowerCase().includes(q)
  );
};

const subtreeMatchesSearch = (node, term) => {
  if (!term) return true;
  if (nodeMatchesSearch(node, term)) return true;
  return (node.children || []).some((child) => subtreeMatchesSearch(child, term));
};

const OrgChartTree = ({ node, searchTerm = '', collapsedSet, onToggle, depth = 0 }) => {
  const hasChildren = (node.children || []).length > 0;
  const isCollapsed = collapsedSet.has(node.id);
  const highlighted = nodeMatchesSearch(node, searchTerm);

  const visibleChildren = useMemo(() => {
    if (!searchTerm) return node.children || [];
    return (node.children || []).filter((child) => subtreeMatchesSearch(child, searchTerm));
  }, [node.children, searchTerm]);

  if (searchTerm && !subtreeMatchesSearch(node, searchTerm)) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0
      }}
    >
      <OrgChartNode
        node={node}
        highlighted={highlighted}
        collapsed={isCollapsed}
        hasChildren={hasChildren}
        onToggle={() => onToggle(node.id)}
      />

      {hasChildren && !isCollapsed && visibleChildren.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ width: '2px', height: 20, bgcolor: '#424242' }} />
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-start',
              position: 'relative',
              pt: '20px'
            }}
          >
            {visibleChildren.length > 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: '8%',
                  right: '8%',
                  height: '2px',
                  bgcolor: '#424242'
                }}
              />
            )}
            {visibleChildren.map((child) => (
              <Box
                key={child.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  mx: 0.5,
                  position: 'relative'
                }}
              >
                <Box
                  sx={{
                    width: '2px',
                    height: 20,
                    bgcolor: '#424242',
                    position: 'absolute',
                    top: -20
                  }}
                />
                <OrgChartTree
                  node={child}
                  searchTerm={searchTerm}
                  collapsedSet={collapsedSet}
                  onToggle={onToggle}
                  depth={depth + 1}
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default OrgChartTree;
