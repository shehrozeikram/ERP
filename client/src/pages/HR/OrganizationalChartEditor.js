import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Stack,
  Paper,
  Divider,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  ArrowBack,
  Add,
  Edit,
  Delete,
  ArrowUpward,
  ArrowDownward,
  DriveFileMove,
  Refresh,
  Visibility,
  AccountTree,
  CloudDownload
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import orgChartService from '../../services/orgChartService';
import OrgChartEditorSidebar from '../../components/HR/OrgChart/OrgChartEditorSidebar';
import OrgChartNodeFormDialog from '../../components/HR/OrgChart/OrgChartNodeFormDialog';
import OrgChartTree from '../../components/HR/OrgChart/OrgChartTree';
import OrgChartCanvas from '../../components/HR/OrgChart/OrgChartCanvas';
import { getOrgNodeSx } from '../../components/HR/OrgChart/orgChartTheme';
import { collectIds, countNodes, findNodeById, flattenTree } from '../../components/HR/OrgChart/orgChartHelpers';
import SGC_ORG_CHART from '../../data/sgcOrgChartData';

const OrganizationalChartEditor = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState(null);
  const [empty, setEmpty] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formParentId, setFormParentId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveTargetParentId, setMoveTargetParentId] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [collapsedSet, setCollapsedSet] = useState(new Set());

  const selectedNode = useMemo(
    () => (tree && selectedId ? findNodeById(tree, selectedId) : null),
    [tree, selectedId]
  );

  const parentOptions = useMemo(() => {
    if (!tree) return [];
    const flat = flattenTree(tree);
    if (!selectedId) return flat;
    const blocked = new Set();
    const markBlocked = (node) => {
      blocked.add(node.id);
      (node.children || []).forEach(markBlocked);
    };
    const sel = findNodeById(tree, selectedId);
    if (sel) markBlocked(sel);
    return flat.filter((n) => !blocked.has(n.id));
  }, [tree, selectedId]);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgChartService.getTree();
      if (res.empty) {
        setEmpty(true);
        setTree(null);
        setSelectedId(null);
      } else {
        setEmpty(false);
        setTree(res.data);
        setSelectedId((prev) => prev || res.data?.id);
        setCollapsedSet(new Set(collectIds(res.data, 0, 2)));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load org chart');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const openCreate = (parentId) => {
    setFormMode('create');
    setFormParentId(parentId);
    setFormOpen(true);
  };

  const openEdit = () => {
    if (!selectedNode) return;
    setFormMode('edit');
    setFormOpen(true);
  };

  const handleFormSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (formMode === 'edit' && selectedId) {
        await orgChartService.updateNode(selectedId, values);
        toast.success('Position updated');
      } else {
        await orgChartService.createNode({
          ...values,
          parentId: formParentId || selectedId || tree?.id
        });
        toast.success('Position added');
      }
      setFormOpen(false);
      await loadTree();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMoveNode = async (sourceId, targetParentId) => {
    try {
      await orgChartService.moveNode(sourceId, { parentId: targetParentId });
      toast.success('Position moved');
      await loadTree();
      setSelectedId(sourceId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Move failed');
    }
  };

  const handleReorder = async (direction) => {
    if (!selectedId) return;
    try {
      await orgChartService.reorderNode(selectedId, direction);
      await loadTree();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reorder failed');
    }
  };

  const handleDelete = async (cascade) => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      await orgChartService.deleteNode(selectedId, cascade);
      toast.success('Position deleted');
      setDeleteDialogOpen(false);
      setSelectedId(tree?.id || null);
      await loadTree();
    } catch (err) {
      const msg = err.response?.data?.message || 'Delete failed';
      if (err.response?.data?.childCount) {
        toast.error(`${msg}`);
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeed = async (force = false) => {
    setSubmitting(true);
    try {
      const res = await orgChartService.seed(force);
      toast.success(res.message || 'Chart loaded');
      setSeedDialogOpen(false);
      setEmpty(false);
      setTree(res.data);
      setSelectedId(res.data?.id);
      setCollapsedSet(new Set(collectIds(res.data, 0, 2)));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRoot = async () => {
    setSubmitting(true);
    try {
      const res = await orgChartService.createNode({
        title: 'President',
        name: '',
        type: 'patron',
        isVacant: false
      });
      toast.success('Root position created');
      await loadTree();
      setSelectedId(res.data?.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create root');
    } finally {
      setSubmitting(false);
    }
  };

  const childCount = selectedNode?.children?.length || 0;
  const totalNodes = tree ? countNodes(tree) : 0;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={() => navigate('/hr/organizational-development')} size="small">
            <ArrowBack />
          </IconButton>
          <AccountTree color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Org Chart Editor
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Build and maintain the organogram — add Project, Department, Management, and Staff nodes.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<Visibility />}
            onClick={() => navigate('/hr/organizational-development/org-chart')}
          >
            View chart
          </Button>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadTree}>
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<CloudDownload />}
            onClick={() => setSeedDialogOpen(true)}
          >
            Import default
          </Button>
        </Stack>
      </Stack>

      {empty && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No org chart in the database yet. Create a root President node manually, or import the default June 2026
          organogram as a starting point (you can edit everything afterward).
        </Alert>
      )}

      {empty ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Get started
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ mt: 2 }}>
            <Button variant="contained" onClick={handleCreateRoot} disabled={submitting}>
              Create President (root)
            </Button>
            <Button variant="outlined" onClick={() => handleSeed(false)} disabled={submitting}>
              Import default organogram ({countNodes(SGC_ORG_CHART)} positions)
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flex: 1, gap: 2, minHeight: 0 }}>
          <Paper variant="outlined" sx={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <OrgChartEditorSidebar
              tree={tree}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMoveNode={handleMoveNode}
            />
          </Paper>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" flexWrap="wrap" spacing={1} alignItems="center">
                <Typography variant="subtitle2" sx={{ mr: 1 }}>
                  {selectedNode ? (
                    <>
                      Selected: <strong>{selectedNode.title}</strong>
                      {selectedNode.name ? ` — ${selectedNode.name}` : ''}
                    </>
                  ) : (
                    'Select a position'
                  )}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Add child under selected">
                  <span>
                    <Button
                      size="small"
                      startIcon={<Add />}
                      variant="contained"
                      disabled={!selectedId}
                      onClick={() => openCreate(selectedId)}
                    >
                      Add child
                    </Button>
                  </span>
                </Tooltip>
                <Button size="small" startIcon={<Edit />} disabled={!selectedId} onClick={openEdit}>
                  Edit
                </Button>
                <Button
                  size="small"
                  startIcon={<DriveFileMove />}
                  disabled={!selectedId || selectedNode?.isRoot}
                  onClick={() => {
                    setMoveTargetParentId(tree?.id || '');
                    setMoveDialogOpen(true);
                  }}
                >
                  Move under…
                </Button>
                <IconButton size="small" disabled={!selectedId || selectedNode?.isRoot} onClick={() => handleReorder('up')}>
                  <ArrowUpward fontSize="small" />
                </IconButton>
                <IconButton size="small" disabled={!selectedId || selectedNode?.isRoot} onClick={() => handleReorder('down')}>
                  <ArrowDownward fontSize="small" />
                </IconButton>
                <Button
                  size="small"
                  color="error"
                  startIcon={<Delete />}
                  disabled={!selectedId || selectedNode?.isRoot}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Delete
                </Button>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">
                  Live preview — {totalNodes} positions
                </Typography>
              </Box>
              <OrgChartCanvas scale={0.3}>
                <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', pb: 4 }}>
                  <Box
                    sx={{
                      ...getOrgNodeSx(tree, selectedId === tree?.id),
                      mb: 0,
                      minWidth: 280,
                      boxShadow: selectedId === tree?.id ? '0 0 0 3px rgba(25, 118, 210, 0.45)' : undefined
                    }}
                  >
                    <Typography sx={{ fontWeight: 'inherit', fontSize: 'inherit', color: 'inherit' }}>
                      {tree?.title}
                    </Typography>
                    {tree?.name && (
                      <Typography sx={{ fontSize: '0.85em', color: 'inherit', mt: 0.25 }}>
                        {tree.name}
                      </Typography>
                    )}
                  </Box>
                  <Divider sx={{ width: '90%', borderBottomWidth: 3, borderColor: '#D32F2F', my: 1.5 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Box sx={{ width: '2px', height: 24, bgcolor: '#424242' }} />
                    <Box sx={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'flex-start', position: 'relative', pt: '20px' }}>
                      {(tree?.children || []).length > 1 && (
                        <Box sx={{ position: 'absolute', top: 0, left: '3%', right: '3%', height: '2px', bgcolor: '#424242' }} />
                      )}
                      {(tree?.children || []).map((child) => (
                        <Box key={child.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mx: 0.75, position: 'relative' }}>
                          <Box sx={{ width: '2px', height: 20, bgcolor: '#424242', position: 'absolute', top: -20 }} />
                          <OrgChartTree
                            node={child}
                            searchTerm=""
                            collapsedSet={collapsedSet}
                            onToggle={(id) => {
                              setCollapsedSet((prev) => {
                                const next = new Set(prev);
                                if (next.has(id)) next.delete(id);
                                else next.add(id);
                                return next;
                              });
                            }}
                          />
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </OrgChartCanvas>
            </Paper>
          </Box>
        </Box>
      )}

      <OrgChartNodeFormDialog
        open={formOpen}
        mode={formMode}
        initialValues={formMode === 'edit' ? selectedNode : { type: 'management' }}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        submitting={submitting}
      />

      <Dialog open={moveDialogOpen} onClose={() => setMoveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Move under parent</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>New parent</InputLabel>
            <Select
              label="New parent"
              value={moveTargetParentId}
              onChange={(e) => setMoveTargetParentId(e.target.value)}
            >
              {parentOptions.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  {`${'  '.repeat(opt.depth)}${opt.title}${opt.name ? ` — ${opt.name}` : ''}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!moveTargetParentId || !selectedId}
            onClick={async () => {
              await handleMoveNode(selectedId, moveTargetParentId);
              setMoveDialogOpen(false);
            }}
          >
            Move
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete position</DialogTitle>
        <DialogContent>
          <Typography>
            Delete <strong>{selectedNode?.title}</strong>?
          </Typography>
          {childCount > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This node has {childCount} direct child(ren). Choose delete with all descendants to remove the whole
              branch.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          {childCount > 0 ? (
            <Button color="error" variant="contained" disabled={submitting} onClick={() => handleDelete(true)}>
              Delete all ({childCount}+)
            </Button>
          ) : (
            <Button color="error" variant="contained" disabled={submitting} onClick={() => handleDelete(false)}>
              Delete
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={seedDialogOpen} onClose={() => setSeedDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import default organogram</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            Loads the bundled June 2026 organogram ({countNodes(SGC_ORG_CHART)} positions) into the database. You can
            edit every node afterward in this editor.
          </Typography>
          {!empty && (
            <Alert severity="warning">
              A chart already exists ({totalNodes} positions). Use replace only if you want to discard current data.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSeedDialogOpen(false)}>Cancel</Button>
          {empty ? (
            <Button variant="contained" disabled={submitting} onClick={() => handleSeed(false)}>
              Import
            </Button>
          ) : (
            <Button color="warning" variant="contained" disabled={submitting} onClick={() => handleSeed(true)}>
              Replace all
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrganizationalChartEditor;
