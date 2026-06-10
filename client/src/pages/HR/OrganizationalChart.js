import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Stack,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  ArrowBack,
  AccountTree,
  Edit
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import orgChartService from '../../services/orgChartService';
import OrgChartVisioWorkspace from '../../components/HR/OrgChart/OrgChartVisioWorkspace';
import { countNodes } from '../../components/HR/OrgChart/orgChartHelpers';

const OrganizationalChart = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fromDb, setFromDb] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [tree, setTree] = useState(null);

  const loadChart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgChartService.getCanvas();
      if (!res.empty && res.data?.length) {
        if (res.needsLayout) {
          const laid = await orgChartService.autoLayout();
          setNodes(laid.data);
        } else {
          setNodes(res.data);
        }
        setTree(res.tree);
        setFromDb(true);
      } else {
        setNodes([]);
        setTree(null);
        setFromDb(false);
      }
    } catch {
      toast.error('Could not load org chart');
      setFromDb(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChart();
  }, [loadChart]);

  const totalNodes = useMemo(() => (tree ? countNodes(tree) : nodes.length), [tree, nodes]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton onClick={() => navigate('/hr/organizational-development')} size="small">
              <ArrowBack />
            </IconButton>
            <AccountTree color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Organizational Chart
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Pan, zoom, export PNG/PDF — like Visio. Red = vacant.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip
              label={fromDb ? 'Live' : 'Not saved yet'}
              size="small"
              color={fromDb ? 'success' : 'warning'}
              variant="outlined"
            />
            <Chip label={`${totalNodes} positions`} size="small" color="primary" variant="outlined" />
            <Button
              size="small"
              startIcon={<Edit />}
              variant="contained"
              onClick={() => navigate('/hr/organizational-development/org-chart/edit')}
            >
              Edit in Visio mode
            </Button>
          </Stack>
        </Stack>
      </Box>

      {!fromDb && (
        <Alert severity="info" sx={{ mx: 2, mt: 1 }}>
          No chart saved yet. Open <strong>Edit in Visio mode</strong> to build or import the organogram.
        </Alert>
      )}

      {fromDb ? (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <OrgChartVisioWorkspace nodes={nodes} tree={tree} readOnly />
        </Box>
      ) : (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Create your organogram in the Visio-style editor.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default OrganizationalChart;
