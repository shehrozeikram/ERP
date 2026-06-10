import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  IconButton,
  Tooltip,
  Chip,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  DragIndicator,
  Search
} from '@mui/icons-material';
import { getOrgNodeSx } from './orgChartTheme';

const SidebarRow = ({
  node,
  depth,
  selectedId,
  onSelect,
  expandedSet,
  onToggleExpand,
  searchTerm,
  dragNodeId,
  onDragStart,
  onDragOver,
  onDrop
}) => {
  const hasChildren = (node.children || []).length > 0;
  const expanded = !expandedSet.has(node.id);
  const selected = selectedId === node.id;
  const isDragTarget = dragNodeId && dragNodeId !== node.id;

  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    const selfMatch =
      node.title?.toLowerCase().includes(q) ||
      node.name?.toLowerCase().includes(q);
    const childMatch = (node.children || []).some((c) =>
      JSON.stringify(c).toLowerCase().includes(q)
    );
    if (!selfMatch && !childMatch) return null;
  }

  return (
    <>
      <ListItemButton
        selected={selected}
        onClick={() => onSelect(node.id)}
        draggable={!node.isRoot}
        onDragStart={(e) => {
          if (node.isRoot) {
            e.preventDefault();
            return;
          }
          onDragStart(e, node.id);
        }}
        onDragOver={(e) => {
          if (isDragTarget) e.preventDefault();
        }}
        onDrop={(e) => onDrop(e, node.id)}
        sx={{
          pl: 1 + depth * 2,
          py: 0.5,
          borderLeft: selected ? '3px solid' : '3px solid transparent',
          borderColor: selected ? 'primary.main' : 'transparent',
          '&.Mui-selected': { bgcolor: 'action.selected' }
        }}
      >
        <DragIndicator fontSize="small" sx={{ mr: 0.5, opacity: 0.35, cursor: 'grab' }} />
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            sx={{ mr: 0.5, p: 0.25 }}
          >
            {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        ) : (
          <Box sx={{ width: 28 }} />
        )}
        <Box
          sx={{
            ...getOrgNodeSx(node, false),
            py: 0.25,
            px: 0.75,
            minWidth: 0,
            flex: 1,
            fontSize: '0.7rem',
            textAlign: 'left'
          }}
        >
          <ListItemText
            primary={node.title}
            secondary={node.name || (node.isVacant ? 'Vacant' : node.type)}
            primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 600, noWrap: true }}
            secondaryTypographyProps={{ fontSize: '0.65rem', noWrap: true }}
          />
        </Box>
      </ListItemButton>
      {hasChildren && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <List dense disablePadding>
            {(node.children || []).map((child) => (
              <SidebarRow
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                expandedSet={expandedSet}
                onToggleExpand={onToggleExpand}
                searchTerm={searchTerm}
                dragNodeId={dragNodeId}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

const OrgChartEditorSidebar = ({
  tree,
  selectedId,
  onSelect,
  onMoveNode
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSet, setExpandedSet] = useState(() => new Set());
  const [dragNodeId, setDragNodeId] = useState(null);

  const handleToggleExpand = (id) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDragStart = (e, nodeId) => {
    setDragNodeId(nodeId);
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e, targetId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || dragNodeId;
    setDragNodeId(null);
    if (!sourceId || sourceId === targetId) return;
    await onMoveNode(sourceId, targetId);
  };

  const total = useMemo(() => {
    const walk = (n) => 1 + (n.children || []).reduce((s, c) => s + walk(c), 0);
    return tree ? walk(tree) : 0;
  }, [tree]);

  if (!tree) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">No chart loaded.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Structure
        </Typography>
        <Chip label={`${total} positions`} size="small" color="primary" variant="outlined" sx={{ mb: 1.5 }} />
        <TextField
          size="small"
          fullWidth
          placeholder="Filter tree..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Drag a row onto another to move it under that parent.
        </Typography>
      </Box>
      <List dense sx={{ overflow: 'auto', flex: 1, py: 0 }}>
        <SidebarRow
          node={tree}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          expandedSet={expandedSet}
          onToggleExpand={handleToggleExpand}
          searchTerm={searchTerm}
          dragNodeId={dragNodeId}
          onDragStart={handleDragStart}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        />
      </List>
    </Box>
  );
};

export default OrgChartEditorSidebar;
