import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  Button
} from '@mui/material';
import {
  PanTool,
  NearMe,
  DeviceHub,
  ZoomIn,
  ZoomOut,
  RestartAlt,
  GridOn,
  AutoFixHigh,
  Image,
  PictureAsPdf
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { exportOrgChartToPng, exportOrgChartToPdf } from '../../../utils/orgChartExport';
import { getOrgNodeSx } from './orgChartTheme';
import { buildConnectorPath, getCanvasBounds, snapToGrid, GRID_SIZE } from './orgChartConnectors';
import OrgChartStencilPanel from './OrgChartStencilPanel';
import OrgChartPropertiesPanel from './OrgChartPropertiesPanel';
import { flattenTree } from './orgChartHelpers';

const TOOLBAR_H = 48;

const OrgChartVisioWorkspace = ({
  nodes: nodesProp,
  tree,
  readOnly = false,
  onNodePositionChange,
  onNodeCreate,
  onNodeUpdate,
  onNodeMove,
  onNodeDelete,
  onAutoLayout,
  loading = false,
  showExport = true
}) => {
  const viewportRef = useRef(null);
  const diagramRef = useRef(null);
  const [nodes, setNodes] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [tool, setTool] = useState('select');
  const [placeType, setPlaceType] = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [showGrid, setShowGrid] = useState(true);
  const [dragging, setDragging] = useState(null);
  const [panning, setPanning] = useState(null);
  const [draftProps, setDraftProps] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const hasDiagram = Object.values(nodes).some((n) => n.posX != null && n.posY != null);

  const handleExportPng = async () => {
    if (!diagramRef.current || exporting) return;
    setExporting(true);
    try {
      const name = await exportOrgChartToPng(diagramRef.current);
      toast.success(`Exported ${name}`);
    } catch (err) {
      toast.error(err.message || 'PNG export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!diagramRef.current || exporting) return;
    setExporting(true);
    try {
      const name = await exportOrgChartToPdf(diagramRef.current);
      toast.success(`Exported ${name}`);
    } catch (err) {
      toast.error(err.message || 'PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const map = {};
    (nodesProp || []).forEach((n) => {
      map[n.id] = { ...n };
    });
    setNodes(map);
  }, [nodesProp]);

  const selectedNode = selectedId ? nodes[selectedId] : null;

  useEffect(() => {
    setDraftProps(selectedNode ? { ...selectedNode } : null);
  }, [selectedNode]);

  const parentOptions = useMemo(() => {
    if (!tree || !selectedId) return flattenTree(tree);
    const blocked = new Set();
    const walk = (n) => {
      blocked.add(n.id);
      (n.children || []).forEach(walk);
    };
    const find = (n, id) => {
      if (n.id === id) return n;
      for (const c of n.children || []) {
        const f = find(c, id);
        if (f) return f;
      }
      return null;
    };
    const sel = find(tree, selectedId);
    if (sel) walk(sel);
    return flattenTree(tree).filter((n) => !blocked.has(n.id));
  }, [tree, selectedId]);

  const bounds = useMemo(() => getCanvasBounds(nodes), [nodes]);

  const connectors = useMemo(() => {
    const lines = [];
    Object.values(nodes).forEach((child) => {
      if (!child.parent) return;
      const parent = nodes[child.parent];
      if (!parent || parent.posX == null || child.posX == null) return;
      const d = buildConnectorPath(parent, child);
      if (d) lines.push({ id: `${parent.id}-${child.id}`, d });
    });
    return lines;
  }, [nodes]);

  const screenToCanvas = useCallback(
    (clientX, clientY) => {
      const el = viewportRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const x = (clientX - rect.left - pan.x) / zoom - bounds.minX;
      const y = (clientY - rect.top - pan.y) / zoom - bounds.minY;
      return { x, y };
    },
    [pan, zoom, bounds.minX, bounds.minY]
  );

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom((z) => Math.min(2, Math.max(0.25, z + delta)));
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const isCanvasBackground = (e) =>
    e.target === viewportRef.current || e.target?.dataset?.canvasBg === 'true';

  const handleCanvasMouseDown = (e) => {
    if (readOnly) {
      if (e.button === 0 || e.button === 1) {
        setPanning({ startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
      }
      return;
    }

    if (tool === 'pan' || e.button === 1 || (e.button === 0 && isCanvasBackground(e) && tool !== 'place')) {
      setPanning({ startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
      return;
    }

    if (tool === 'place' && placeType && isCanvasBackground(e)) {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      onNodeCreate?.({
        type: placeType,
        posX: snapToGrid(x),
        posY: snapToGrid(y),
        parentId: selectedId || null
      });
      setPlaceType(null);
      setTool('select');
    }
  };

  const handleMouseMove = (e) => {
    if (panning) {
      setPan({
        x: panning.panX + (e.clientX - panning.startX),
        y: panning.panY + (e.clientY - panning.startY)
      });
      return;
    }
    if (dragging && !readOnly) {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      setNodes((prev) => ({
        ...prev,
        [dragging.id]: {
          ...prev[dragging.id],
          posX: snapToGrid(x - dragging.offsetX),
          posY: snapToGrid(y - dragging.offsetY)
        }
      }));
    }
  };

  const handleMouseUp = () => {
    if (dragging && !readOnly) {
      setNodes((prev) => {
        const n = prev[dragging.id];
        if (n) onNodePositionChange?.(dragging.id, { posX: n.posX, posY: n.posY });
        return prev;
      });
    }
    setDragging(null);
    setPanning(null);
  };

  const handleNodeMouseDown = (e, node) => {
    e.stopPropagation();
    if (readOnly) {
      setSelectedId(node.id);
      return;
    }

    if (tool === 'connect') {
      if (!connectFrom) {
        setConnectFrom(node.id);
        setSelectedId(node.id);
      } else if (connectFrom !== node.id) {
        onNodeMove?.(node.id, connectFrom);
        setConnectFrom(null);
        setTool('select');
      }
      return;
    }

    if (tool === 'place') return;

    setSelectedId(node.id);
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    setDragging({
      id: node.id,
      offsetX: x - node.posX,
      offsetY: y - node.posY
    });
  };

  const handlePickType = (type) => {
    setPlaceType(type);
    setTool(type ? 'place' : 'select');
  };

  const handleSaveProps = async () => {
    if (!draftProps || !selectedId) return;
    setSaving(true);
    try {
      await onNodeUpdate?.(selectedId, {
        title: draftProps.title,
        name: draftProps.name,
        type: draftProps.type,
        isVacant: draftProps.isVacant
      });
    } finally {
      setSaving(false);
    }
  };

  const handleParentChange = async (parentId) => {
    if (!selectedId) return;
    await onNodeMove?.(selectedId, parentId);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, bgcolor: '#FAFAFA' }}>
      <Paper
        square
        elevation={0}
        sx={{
          height: TOOLBAR_H,
          px: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: '#EAE9E8',
          flexShrink: 0
        }}
      >
        {!readOnly && (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={tool}
            onChange={(_, v) => v && setTool(v)}
          >
            <ToggleButton value="select">
              <Tooltip title="Select / Move (Visio pointer)">
                <NearMe fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="connect">
              <Tooltip title="Connector — click manager, then report">
                <DeviceHub fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="pan">
              <Tooltip title="Pan canvas">
                <PanTool fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        )}

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Zoom out">
          <IconButton size="small" onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}>
            <ZoomOut fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </Typography>
        <Tooltip title="Zoom in">
          <IconButton size="small" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>
            <ZoomIn fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Reset view">
          <IconButton size="small" onClick={() => { setZoom(0.85); setPan({ x: 40, y: 40 }); }}>
            <RestartAlt fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Toggle grid">
          <IconButton size="small" color={showGrid ? 'primary' : 'default'} onClick={() => setShowGrid((g) => !g)}>
            <GridOn fontSize="small" />
          </IconButton>
        </Tooltip>

        {!readOnly && onAutoLayout && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<AutoFixHigh />}
            onClick={onAutoLayout}
            sx={{ ml: 1 }}
          >
            Auto arrange
          </Button>
        )}

        {showExport && hasDiagram && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Button
              size="small"
              variant="outlined"
              startIcon={<Image />}
              onClick={handleExportPng}
              disabled={exporting}
            >
              PNG
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PictureAsPdf />}
              onClick={handleExportPdf}
              disabled={exporting}
            >
              PDF
            </Button>
          </>
        )}

        {tool === 'place' && placeType && (
          <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
            Click canvas to place {placeType}
          </Typography>
        )}
        {tool === 'connect' && (
          <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
            {connectFrom ? 'Now click the report (subordinate)' : 'Click the manager first'}
          </Typography>
        )}
      </Paper>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {!readOnly && (
          <OrgChartStencilPanel
            activeType={placeType}
            onPickType={handlePickType}
            disabled={loading}
          />
        )}

        <Box
          ref={viewportRef}
          data-canvas-bg="true"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          sx={{
            flex: 1,
            overflow: 'hidden',
            cursor: tool === 'pan' || panning ? 'grab' : tool === 'place' ? 'crosshair' : 'default',
            position: 'relative',
            bgcolor: '#FFFFFF',
            backgroundImage: showGrid
              ? 'radial-gradient(circle, #D0D0D0 1px, transparent 1px)'
              : 'none',
            backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`
          }}
        >
          <Box
            ref={diagramRef}
            data-canvas-bg="true"
            data-org-chart-diagram="true"
            sx={{
              position: 'absolute',
              left: pan.x,
              top: pan.y,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
              width: bounds.width,
              height: bounds.height,
              bgcolor: '#FFFFFF'
            }}
          >
            <svg
              width={bounds.width}
              height={bounds.height}
              style={{ position: 'absolute', left: bounds.minX, top: bounds.minY, pointerEvents: 'none' }}
            >
              {connectors.map((line) => (
                <path
                  key={line.id}
                  d={line.d}
                  fill="none"
                  stroke="#555"
                  strokeWidth={2}
                  strokeLinecap="square"
                />
              ))}
            </svg>

            {Object.values(nodes)
              .filter((n) => n.posX != null && n.posY != null)
              .map((node) => {
                const isSelected = selectedId === node.id;
                const isConnect = connectFrom === node.id;
                return (
                  <Box
                    key={node.id}
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    sx={{
                      position: 'absolute',
                      left: bounds.minX + node.posX,
                      top: bounds.minY + node.posY,
                      width: node.width,
                      minHeight: node.height,
                      ...getOrgNodeSx(node, isSelected || isConnect),
                      cursor: readOnly ? 'pointer' : tool === 'connect' ? 'crosshair' : 'move',
                      userSelect: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      zIndex: isSelected ? 2 : 1
                    }}
                  >
                    <Typography sx={{ fontWeight: 'inherit', fontSize: 'inherit', color: 'inherit', lineHeight: 1.2 }}>
                      {node.title}
                    </Typography>
                    {(node.name || node.isVacant) && (
                      <Typography sx={{ fontSize: '0.82em', color: 'inherit', mt: 0.25, fontStyle: node.isVacant ? 'italic' : 'normal' }}>
                        {node.name || 'Vacant'}
                      </Typography>
                    )}
                  </Box>
                );
              })}
          </Box>
        </Box>

        {!readOnly && (
          <OrgChartPropertiesPanel
            node={draftProps}
            parentOptions={parentOptions}
            parentId={draftProps?.parent}
            onParentChange={handleParentChange}
            onChange={(patch) => setDraftProps((p) => ({ ...p, ...patch }))}
            onSave={handleSaveProps}
            onDelete={() => onNodeDelete?.(selectedId)}
            onAddChild={() => {
              setPlaceType(draftProps?.type === 'department' ? 'management' : 'staff');
              setTool('place');
            }}
            readOnly={readOnly}
            saving={saving}
          />
        )}
      </Box>
    </Box>
  );
};

export default OrgChartVisioWorkspace;
