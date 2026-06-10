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
  PictureAsPdf,
  LinkOff
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { exportOrgChartToPng, exportOrgChartToPdf } from '../../../utils/orgChartExport';
import { getOrgNodeSx } from './orgChartTheme';
import {
  buildConnectorPath,
  buildStraightPath,
  getCanvasBounds,
  getNodePort,
  snapToGrid,
  GRID_SIZE
} from './orgChartConnectors';
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
  onNodeConnect,
  onNodeDisconnect,
  onNodeDelete,
  onAutoLayout,
  loading = false,
  showExport = true
}) => {
  const viewportRef = useRef(null);
  const diagramRef = useRef(null);
  const [nodes, setNodes] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [selectedConnector, setSelectedConnector] = useState(null);
  const [tool, setTool] = useState('select');
  const [placeType, setPlaceType] = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const [connectDrag, setConnectDrag] = useState(null);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [showGrid, setShowGrid] = useState(true);
  const [dragging, setDragging] = useState(null);
  const [panning, setPanning] = useState(null);
  const [draftProps, setDraftProps] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const hasDiagram = Object.values(nodes).some((n) => n.posX != null && n.posY != null);

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
      const d = buildConnectorPath(parent, child, bounds.minX, bounds.minY);
      if (!d) return;
      lines.push({
        id: `${parent.id}-${child.id}`,
        d,
        parentId: parent.id,
        childId: child.id,
        parentTitle: parent.title,
        childTitle: child.title
      });
    });
    return lines;
  }, [nodes, bounds.minX, bounds.minY]);

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

  const screenToDiagram = useCallback(
    (clientX, clientY) => {
      const el = viewportRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom
      };
    },
    [pan, zoom]
  );

  const findNodeAtDiagramPoint = useCallback(
    (dx, dy) => {
      const x = dx - bounds.minX;
      const y = dy - bounds.minY;
      return Object.values(nodes).find(
        (n) =>
          n.posX != null &&
          x >= n.posX &&
          x <= n.posX + n.width &&
          y >= n.posY &&
          y <= n.posY + n.height
      );
    },
    [nodes, bounds.minX, bounds.minY]
  );

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

  const clearConnectorSelection = () => setSelectedConnector(null);

  const handleRemoveConnector = async (connector) => {
    const target = connector || selectedConnector;
    if (!target) return;
    await onNodeDisconnect?.(target.childId);
    setSelectedConnector(null);
  };

  const tryConnect = async (parentId, childId) => {
    if (!parentId || !childId || parentId === childId) return;
    const child = nodes[childId];
    if (child?.isRoot) {
      toast.error('Cannot connect lines to the root shape');
      return;
    }
    await onNodeConnect?.(childId, parentId);
    setConnectFrom(null);
    setConnectDrag(null);
    setTool('select');
  };

  const isCanvasBackground = (e) =>
    e.target === viewportRef.current || e.target?.dataset?.canvasBg === 'true';

  const handleCanvasMouseDown = (e) => {
    if (readOnly) {
      if (e.button === 0 || e.button === 1) {
        setPanning({ startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
      }
      return;
    }

    if (tool === 'disconnect') return;

    if (tool === 'pan' || e.button === 1 || (e.button === 0 && isCanvasBackground(e) && tool !== 'place' && !connectDrag)) {
      setPanning({ startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
      if (tool === 'select') {
        setSelectedId(null);
        clearConnectorSelection();
      }
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

    if (connectDrag) {
      const pt = screenToDiagram(e.clientX, e.clientY);
      setConnectDrag((prev) => ({ ...prev, currentX: pt.x, currentY: pt.y }));
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

  const handleMouseUp = (e) => {
    if (connectDrag) {
      const pt = screenToDiagram(e.clientX, e.clientY);
      const target = findNodeAtDiagramPoint(pt.x, pt.y);
      if (target && target.id !== connectDrag.parentId) {
        tryConnect(connectDrag.parentId, target.id);
      } else {
        setConnectDrag(null);
      }
      return;
    }

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

    if (tool === 'disconnect') return;

    if (tool === 'connect') {
      if (!connectFrom) {
        setConnectFrom(node.id);
        setSelectedId(node.id);
        clearConnectorSelection();
      } else if (connectFrom !== node.id) {
        tryConnect(connectFrom, node.id);
      }
      return;
    }

    if (tool === 'place') return;

    setSelectedId(node.id);
    clearConnectorSelection();
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    setDragging({
      id: node.id,
      offsetX: x - node.posX,
      offsetY: y - node.posY
    });
  };

  const handlePortMouseDown = (e, node, port) => {
    e.stopPropagation();
    if (readOnly || tool === 'pan' || tool === 'place') return;

    clearConnectorSelection();
    setSelectedId(node.id);

    if (port === 'bottom') {
      const p = getNodePort(node, 'bottom', bounds.minX, bounds.minY);
      setConnectDrag({
        parentId: node.id,
        startX: p.x,
        startY: p.y,
        currentX: p.x,
        currentY: p.y
      });
      setTool('connect');
    } else if (port === 'top' && connectFrom) {
      tryConnect(connectFrom, node.id);
    }
  };

  const handleConnectorClick = (e, line) => {
    e.stopPropagation();
    if (readOnly) return;

    if (tool === 'disconnect') {
      handleRemoveConnector(line);
      return;
    }

    setSelectedConnector({ parentId: line.parentId, childId: line.childId });
    setSelectedId(null);
  };

  const handlePickType = (type) => {
    setPlaceType(type);
    setTool(type ? 'place' : 'select');
    setConnectFrom(null);
    setConnectDrag(null);
  };

  const handleToolChange = (_, value) => {
    if (!value) return;
    setTool(value);
    setConnectFrom(null);
    setConnectDrag(null);
    if (value !== 'select') clearConnectorSelection();
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
    if (!parentId) {
      await onNodeDisconnect?.(selectedId);
    } else {
      await onNodeConnect?.(selectedId, parentId);
    }
  };

  const selectedConnectorMeta = selectedConnector
    ? connectors.find((c) => c.parentId === selectedConnector.parentId && c.childId === selectedConnector.childId)
    : null;

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
          flexShrink: 0,
          flexWrap: 'wrap'
        }}
      >
        {!readOnly && (
          <ToggleButtonGroup size="small" exclusive value={tool} onChange={handleToolChange}>
            <ToggleButton value="select">
              <Tooltip title="Select / move shapes">
                <NearMe fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="connect">
              <Tooltip title="Add line — click manager, then report (or drag from blue dot)">
                <DeviceHub fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="disconnect">
              <Tooltip title="Remove line — click a connector">
                <LinkOff fontSize="small" />
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
          <Button size="small" variant="outlined" startIcon={<AutoFixHigh />} onClick={onAutoLayout} sx={{ ml: 0.5 }}>
            Auto arrange
          </Button>
        )}

        {!readOnly && selectedConnectorMeta && (
          <Button
            size="small"
            color="error"
            variant="contained"
            startIcon={<LinkOff />}
            onClick={() => handleRemoveConnector(selectedConnectorMeta)}
          >
            Remove line
          </Button>
        )}

        {showExport && hasDiagram && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Button size="small" variant="outlined" startIcon={<Image />} onClick={handleExportPng} disabled={exporting}>
              PNG
            </Button>
            <Button size="small" variant="outlined" startIcon={<PictureAsPdf />} onClick={handleExportPdf} disabled={exporting}>
              PDF
            </Button>
          </>
        )}

        {tool === 'place' && placeType && (
          <Typography variant="caption" color="primary">
            Click canvas to place {placeType}
          </Typography>
        )}
        {tool === 'connect' && !connectDrag && (
          <Typography variant="caption" color="primary">
            {connectFrom ? 'Click the report (subordinate)' : 'Click manager, or drag blue dot to report'}
          </Typography>
        )}
        {tool === 'disconnect' && (
          <Typography variant="caption" color="error">
            Click a line to remove it
          </Typography>
        )}
        {selectedConnectorMeta && tool === 'select' && (
          <Typography variant="caption" color="text.secondary">
            Line: {selectedConnectorMeta.childTitle} → {selectedConnectorMeta.parentTitle}
          </Typography>
        )}
      </Paper>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {!readOnly && (
          <OrgChartStencilPanel activeType={placeType} onPickType={handlePickType} disabled={loading} />
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
            cursor:
              tool === 'pan' || panning
                ? 'grab'
                : tool === 'place'
                  ? 'crosshair'
                  : tool === 'connect' || connectDrag
                    ? 'crosshair'
                    : tool === 'disconnect'
                      ? 'not-allowed'
                      : 'default',
            position: 'relative',
            bgcolor: '#FFFFFF',
            backgroundImage: showGrid ? 'radial-gradient(circle, #D0D0D0 1px, transparent 1px)' : 'none',
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
              style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
            >
              {connectors.map((line) => {
                const selected =
                  selectedConnector?.parentId === line.parentId &&
                  selectedConnector?.childId === line.childId;
                return (
                  <g key={line.id}>
                    <path
                      d={line.d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      style={{ pointerEvents: readOnly ? 'none' : 'stroke', cursor: tool === 'disconnect' ? 'not-allowed' : 'pointer' }}
                      onMouseDown={(e) => handleConnectorClick(e, line)}
                    />
                    <path
                      d={line.d}
                      fill="none"
                      stroke={selected ? '#0078D4' : '#555'}
                      strokeWidth={selected ? 3 : 2}
                      strokeLinecap="square"
                      style={{ pointerEvents: 'none' }}
                    />
                  </g>
                );
              })}
              {connectDrag && (
                <path
                  d={buildStraightPath(connectDrag.startX, connectDrag.startY, connectDrag.currentX, connectDrag.currentY)}
                  fill="none"
                  stroke="#0078D4"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  style={{ pointerEvents: 'none' }}
                />
              )}
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
                      cursor: readOnly ? 'pointer' : tool === 'connect' ? 'crosshair' : tool === 'disconnect' ? 'default' : 'move',
                      userSelect: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      zIndex: isSelected ? 2 : 1
                    }}
                  >
                    {!readOnly && (
                      <>
                        <Box
                          data-connection-port="true"
                          className="org-chart-port"
                          onMouseDown={(e) => handlePortMouseDown(e, node, 'top')}
                          sx={{
                            position: 'absolute',
                            top: -5,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: '#fff',
                            border: '2px solid #0078D4',
                            cursor: 'crosshair',
                            zIndex: 3,
                            '&:hover': { bgcolor: '#0078D4' }
                          }}
                        />
                        <Box
                          data-connection-port="true"
                          className="org-chart-port"
                          onMouseDown={(e) => handlePortMouseDown(e, node, 'bottom')}
                          sx={{
                            position: 'absolute',
                            bottom: -5,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: '#0078D4',
                            border: '2px solid #fff',
                            boxShadow: '0 0 0 1px #0078D4',
                            cursor: 'crosshair',
                            zIndex: 3,
                            '&:hover': { transform: 'translateX(-50%) scale(1.2)' }
                          }}
                        />
                      </>
                    )}
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
            onDisconnectLine={
              draftProps?.parent && !draftProps?.isRoot
                ? () => onNodeDisconnect?.(selectedId)
                : null
            }
            readOnly={readOnly}
            saving={saving}
          />
        )}
      </Box>
    </Box>
  );
};

export default OrgChartVisioWorkspace;
