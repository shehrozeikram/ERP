import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Stack,
  Paper,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowBack,
  Refresh,
  Visibility,
  AccountTree,
  CloudDownload
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import orgChartService from '../../services/orgChartService';
import OrgChartVisioWorkspace from '../../components/HR/OrgChart/OrgChartVisioWorkspace';
import OrgChartNodeFormDialog from '../../components/HR/OrgChart/OrgChartNodeFormDialog';
import { countNodes } from '../../components/HR/OrgChart/orgChartHelpers';
import SGC_ORG_CHART from '../../data/sgcOrgChartData';

const DEFAULT_TITLES = {
  patron: 'President',
  project: 'New Project',
  department: 'New Department',
  management: 'New Position',
  staff: 'New Staff'
};

const OrganizationalChartEditor = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState([]);
  const [tree, setTree] = useState(null);
  const [empty, setEmpty] = useState(false);
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadCanvas = useCallback(async (autoLayoutIfNeeded = true) => {
    setLoading(true);
    try {
      const res = await orgChartService.getCanvas();
      if (res.empty) {
        setEmpty(true);
        setNodes([]);
        setTree(null);
        return;
      }
      if (autoLayoutIfNeeded && res.needsLayout) {
        const laid = await orgChartService.autoLayout();
        setNodes(laid.data);
        const treeRes = await orgChartService.getTree();
        setTree(treeRes.data);
        setEmpty(false);
        return;
      }
      setEmpty(false);
      setNodes(res.data);
      setTree(res.tree);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load org chart');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCanvas();
  }, [loadCanvas]);

  const handlePositionChange = useCallback(async (id, pos) => {
    try {
      await orgChartService.updatePosition(id, pos);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save position');
      loadCanvas(false);
    }
  }, [loadCanvas]);

  const handleNodeCreate = useCallback((payload) => {
    setPendingCreate(payload);
    setFormOpen(true);
  }, []);

  const handleFormSubmit = async (values) => {
    if (!pendingCreate && empty) {
      setSubmitting(true);
      try {
        await orgChartService.createNode({
          ...values,
          type: values.type || 'patron',
          posX: 200,
          posY: 80
        });
        toast.success('Root created');
        setFormOpen(false);
        await loadCanvas();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Create failed');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!pendingCreate) return;
    setSubmitting(true);
    try {
      await orgChartService.createNode({
        ...values,
        type: pendingCreate.type,
        parentId: pendingCreate.parentId || undefined,
        posX: pendingCreate.posX,
        posY: pendingCreate.posY
      });
      toast.success('Shape added');
      setFormOpen(false);
      setPendingCreate(null);
      await loadCanvas(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNodeUpdate = async (id, body) => {
    await orgChartService.updateNode(id, body);
    toast.success('Saved');
    await loadCanvas(false);
  };

  const handleNodeMove = async (id, parentId) => {
    try {
      await orgChartService.moveNode(id, { parentId });
      toast.success('Connection updated');
      await loadCanvas(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Connect failed');
    }
  };

  const handleNodeDelete = async (id) => {
    if (!id) return;
    if (!window.confirm('Delete this shape and all connections below it?')) return;
    try {
      await orgChartService.deleteNode(id, true);
      toast.success('Deleted');
      await loadCanvas(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleAutoLayout = async () => {
    try {
      await orgChartService.autoLayout();
      toast.success('Auto arranged like Visio org chart');
      await loadCanvas(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Auto layout failed');
    }
  };

  const handleSeed = async (force = false) => {
    setSubmitting(true);
    try {
      await orgChartService.seed(force);
      toast.success('Default organogram imported');
      setSeedDialogOpen(false);
      await loadCanvas();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <Paper square elevation={0} sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton onClick={() => navigate('/hr/organizational-development')} size="small">
              <ArrowBack />
            </IconButton>
            <AccountTree color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Org Chart — Visio-style editor
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Drag shapes, use Connector tool, or pick from Shapes panel — like Microsoft Visio
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<Visibility />} onClick={() => navigate('/hr/organizational-development/org-chart')}>
              View
            </Button>
            <Button size="small" startIcon={<Refresh />} onClick={() => loadCanvas(false)}>
              Refresh
            </Button>
            <Button size="small" startIcon={<CloudDownload />} onClick={() => setSeedDialogOpen(true)}>
              Import default
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {empty ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Start blank or import the June 2026 organogram. Then build visually — drag boxes, connect lines, arrange
            like Visio.
          </Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button
              variant="contained"
              onClick={() => {
                setPendingCreate(null);
                setFormOpen(true);
              }}
            >
              Create President (root)
            </Button>
            <Button variant="outlined" onClick={() => handleSeed(false)} disabled={submitting}>
              Import default ({countNodes(SGC_ORG_CHART)} shapes)
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <OrgChartVisioWorkspace
            nodes={nodes}
            tree={tree}
            onNodePositionChange={handlePositionChange}
            onNodeCreate={handleNodeCreate}
            onNodeUpdate={handleNodeUpdate}
            onNodeMove={handleNodeMove}
            onNodeDelete={handleNodeDelete}
            onAutoLayout={handleAutoLayout}
          />
        </Box>
      )}

      <OrgChartNodeFormDialog
        open={formOpen}
        mode="create"
        initialValues={
          pendingCreate
            ? { title: DEFAULT_TITLES[pendingCreate.type] || 'New Position', type: pendingCreate.type }
            : { title: 'President', type: 'patron' }
        }
        onClose={() => {
          setFormOpen(false);
          setPendingCreate(null);
        }}
        onSubmit={handleFormSubmit}
        submitting={submitting}
      />

      <Dialog open={seedDialogOpen} onClose={() => setSeedDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import default organogram</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Loads {countNodes(SGC_ORG_CHART)} positions with auto-layout. You can then drag and fix like Visio.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSeedDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={submitting} onClick={() => handleSeed(!empty)}>
            {empty ? 'Import' : 'Replace all'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrganizationalChartEditor;
