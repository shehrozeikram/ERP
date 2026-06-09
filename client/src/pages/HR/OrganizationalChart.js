import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  TextField,
  Paper,
  Stack,
  Chip,
  InputAdornment,
  Divider
} from '@mui/material';
import {
  ArrowBack,
  ZoomIn,
  ZoomOut,
  RestartAlt,
  UnfoldMore,
  UnfoldLess,
  Search,
  Print,
  AccountTree
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import SGC_ORG_CHART from '../../data/sgcOrgChartData';
import OrgChartTree from '../../components/HR/OrgChart/OrgChartTree';
import OrgChartCanvas from '../../components/HR/OrgChart/OrgChartCanvas';
import { getOrgNodeSx } from '../../components/HR/OrgChart/orgChartTheme';

const collectIds = (node, depth = 0, maxDepth = Infinity, ids = []) => {
  if (depth >= maxDepth && node.children?.length) {
    ids.push(node.id);
  }
  (node.children || []).forEach((child) => collectIds(child, depth + 1, maxDepth, ids));
  return ids;
};

const countNodes = (node) =>
  1 + (node.children || []).reduce((sum, child) => sum + countNodes(child), 0);

const OrganizationalChart = () => {
  const navigate = useNavigate();
  const [scale, setScale] = useState(0.35);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedSet, setCollapsedSet] = useState(() => new Set(collectIds(SGC_ORG_CHART, 0, 2)));

  const totalNodes = useMemo(() => countNodes(SGC_ORG_CHART), []);

  const handleToggle = useCallback((id) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = () => setCollapsedSet(new Set());
  const collapseDeep = () => setCollapsedSet(new Set(collectIds(SGC_ORG_CHART, 0, 2)));

  const handlePrint = () => window.print();

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box
        component="header"
        sx={{
          textAlign: 'center',
          mb: 3,
          py: { xs: 2.5, md: 3.5 },
          px: 2,
          bgcolor: 'grey.50',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          position: 'relative'
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 96,
            height: 4,
            bgcolor: 'primary.main',
            borderRadius: '3px 3px 0 0'
          }}
        />
        <Typography
          component="p"
          variant="overline"
          sx={{
            display: 'block',
            letterSpacing: '0.22em',
            fontWeight: 600,
            color: 'primary.main',
            mb: 1,
            lineHeight: 1,
            fontSize: { xs: '0.8rem', sm: '0.9rem', md: '1rem' }
          }}
        >
          Organogram
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontWeight: 700,
            fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.75rem' },
            lineHeight: 1.25,
            color: 'text.primary',
            letterSpacing: '-0.02em'
          }}
        >
          Sardar Group Of Companies
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <IconButton onClick={() => navigate('/hr/organizational-development')} size="small">
              <ArrowBack />
            </IconButton>
            <AccountTree color="primary" />
            <Typography variant="h5" fontWeight={700}>
              Organizational Chart
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Sardar Group of Companies — official organogram (01 June 2026). Scroll to pan, use zoom controls. Red = vacant.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip label={`${totalNodes} positions`} size="small" color="primary" variant="outlined" />
          <Button size="small" startIcon={<UnfoldMore />} onClick={expandAll} variant="outlined">
            Expand All
          </Button>
          <Button size="small" startIcon={<UnfoldLess />} onClick={collapseDeep} variant="outlined">
            Collapse
          </Button>
          <Button size="small" startIcon={<Print />} onClick={handlePrint} variant="outlined">
            Print
          </Button>
        </Stack>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }} elevation={0} variant="outlined">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <TextField
            size="small"
            placeholder="Search by title or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: 260, flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              )
            }}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Zoom out">
              <IconButton size="small" onClick={() => setScale((s) => Math.max(0.25, s - 0.1))}>
                <ZoomOut />
              </IconButton>
            </Tooltip>
            <Typography variant="body2" sx={{ minWidth: 48, textAlign: 'center' }}>
              {Math.round(scale * 100)}%
            </Typography>
            <Tooltip title="Zoom in">
              <IconButton size="small" onClick={() => setScale((s) => Math.min(1.5, s + 0.1))}>
                <ZoomIn />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset zoom">
              <IconButton size="small" onClick={() => setScale(0.35)}>
                <RestartAlt />
              </IconButton>
            </Tooltip>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {['patron', 'project', 'department', 'management', 'staff'].map((type) => (
              <Box key={type} sx={{ ...getOrgNodeSx({ type, isVacant: false }), py: 0.25, px: 1, fontSize: '0.65rem' }}>
                {type}
              </Box>
            ))}
            <Typography variant="caption" color="error.main" sx={{ alignSelf: 'center', ml: 1 }}>
              Red = Vacant
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {!SGC_ORG_CHART?.title && (
        <Typography color="error" sx={{ mb: 2 }}>
          Organizational chart data failed to load.
        </Typography>
      )}

      <OrgChartCanvas scale={scale}>
        <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', pb: 4 }}>
          <Box sx={{ ...getOrgNodeSx(SGC_ORG_CHART, false), mb: 0, minWidth: 280 }}>
            <Typography sx={{ fontWeight: 'inherit', fontSize: 'inherit', color: 'inherit' }}>
              {SGC_ORG_CHART.title}
            </Typography>
            <Typography sx={{ fontSize: '0.85em', color: 'inherit', mt: 0.25 }}>
              {SGC_ORG_CHART.name}
            </Typography>
          </Box>

          <Divider sx={{ width: '90%', borderBottomWidth: 3, borderColor: '#D32F2F', my: 1.5 }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ width: '2px', height: 24, bgcolor: '#424242' }} />
            <Box
              sx={{
                display: 'inline-flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                position: 'relative',
                pt: '20px',
                flexWrap: 'nowrap'
              }}
            >
              {(SGC_ORG_CHART.children || []).length > 1 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: '3%',
                    right: '3%',
                    height: '2px',
                    bgcolor: '#424242'
                  }}
                />
              )}
              {(SGC_ORG_CHART.children || []).map((child) => (
                <Box
                  key={child.id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    mx: 0.75,
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
                    onToggle={handleToggle}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </OrgChartCanvas>
    </Box>
  );
};

export default OrganizationalChart;
