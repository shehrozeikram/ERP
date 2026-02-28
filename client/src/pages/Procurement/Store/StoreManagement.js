import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Card, CardContent, CardHeader,
  Divider, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip, Collapse, Stack, Alert, Tooltip, CircularProgress,
  List, ListItem, ListItemText, ListItemIcon, ListItemSecondaryAction,
  Accordion, AccordionSummary, AccordionDetails, Grid, Badge, Paper
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StoreIcon from '@mui/icons-material/Store';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import InboxIcon from '@mui/icons-material/Inbox';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import storeService from '../../../services/storeService';

// ─── Small reusable form dialog ───────────────────────────────────────────────
const FormDialog = ({ open, onClose, title, fields, onSubmit, loading }) => {
  const [values, setValues] = useState({});
  useEffect(() => {
    if (open) setValues({});
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {fields.map(f => (
              <TextField
                key={f.name}
                label={f.label}
                required={f.required}
                value={values[f.name] || ''}
                onChange={e => setValues(v => ({ ...v, [f.name]: e.target.value }))}
                size="small"
                fullWidth
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={loading} startIcon={loading && <CircularProgress size={14} />}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

// ─── Bin list inside a shelf ──────────────────────────────────────────────────
const BinList = ({ bins = [], onAdd }) => (
  <Box sx={{ pl: 2, pt: 0.5 }}>
    {bins.filter(b => b.isActive !== false).map(bin => (
      <Chip
        key={bin._id}
        icon={<InboxIcon sx={{ fontSize: 14 }} />}
        label={bin.binCode}
        size="small"
        variant="outlined"
        sx={{ mr: 0.5, mb: 0.5, fontSize: '0.7rem' }}
      />
    ))}
    <Chip
      icon={<AddIcon sx={{ fontSize: 14 }} />}
      label="Add Bin"
      size="small"
      color="primary"
      variant="outlined"
      onClick={onAdd}
      sx={{ mr: 0.5, mb: 0.5, fontSize: '0.7rem', cursor: 'pointer' }}
      clickable
    />
  </Box>
);

// ─── Shelf row ────────────────────────────────────────────────────────────────
const ShelfRow = ({ shelf, storeId, rackId, onBinAdded }) => {
  const [addBinOpen, setAddBinOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAddBin = async (values) => {
    setSaving(true);
    try {
      await storeService.addBin(storeId, rackId, shelf._id, { binCode: values.binCode, description: values.description });
      setAddBinOpen(false);
      if (onBinAdded) onBinAdded();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'divider', mb: 0.5 }}>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <ViewModuleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        <Typography variant="caption" fontWeight="bold">{shelf.shelfCode}</Typography>
        {shelf.description && <Typography variant="caption" color="text.secondary">– {shelf.description}</Typography>}
      </Stack>
      <BinList bins={shelf.bins} onAdd={() => setAddBinOpen(true)} />
      <FormDialog
        open={addBinOpen}
        onClose={() => setAddBinOpen(false)}
        title={`Add Bin to Shelf ${shelf.shelfCode}`}
        fields={[
          { name: 'binCode', label: 'Bin Code', required: true },
          { name: 'description', label: 'Description' }
        ]}
        onSubmit={handleAddBin}
        loading={saving}
      />
    </Box>
  );
};

// ─── Rack card ────────────────────────────────────────────────────────────────
const RackCard = ({ rack, storeId, onRefresh }) => {
  const [addShelfOpen, setAddShelfOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleAddShelf = async (values) => {
    setSaving(true);
    try {
      await storeService.addShelf(storeId, rack._id, { shelfCode: values.shelfCode, description: values.description });
      setAddShelfOpen(false);
      if (onRefresh) onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const shelves = (rack.shelves || []).filter(s => s.isActive !== false);

  return (
    <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{ mb: 0.5 }} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, py: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <WarehouseIcon sx={{ fontSize: 16, color: 'primary.main' }} />
          <Typography variant="body2" fontWeight="bold">{rack.rackCode}</Typography>
          {rack.description && <Typography variant="caption" color="text.secondary">{rack.description}</Typography>}
          <Chip label={`${shelves.length} shelves`} size="small" sx={{ fontSize: '0.65rem', height: 18 }} />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pb: 1 }}>
        {shelves.length === 0
          ? <Typography variant="caption" color="text.secondary">No shelves yet</Typography>
          : shelves.map(shelf => (
            <ShelfRow key={shelf._id} shelf={shelf} storeId={storeId} rackId={rack._id} onBinAdded={onRefresh} />
          ))
        }
        <Button size="small" startIcon={<AddIcon />} onClick={() => setAddShelfOpen(true)} sx={{ mt: 1 }}>
          Add Shelf
        </Button>
        <FormDialog
          open={addShelfOpen}
          onClose={() => setAddShelfOpen(false)}
          title={`Add Shelf to Rack ${rack.rackCode}`}
          fields={[
            { name: 'shelfCode', label: 'Shelf Code', required: true },
            { name: 'description', label: 'Description' }
          ]}
          onSubmit={handleAddShelf}
          loading={saving}
        />
      </AccordionDetails>
    </Accordion>
  );
};

// ─── Sub-store card ───────────────────────────────────────────────────────────
const SubStoreCard = ({ store, onRefresh }) => {
  const [addRackOpen, setAddRackOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoadingDetail(true);
    try {
      const res = await storeService.getStoreById(store._id);
      setDetail(res.data);
    } finally {
      setLoadingDetail(false);
    }
  }, [store._id]);

  useEffect(() => {
    if (expanded && !detail) loadDetail();
  }, [expanded, detail, loadDetail]);

  const handleAddRack = async (values) => {
    setSaving(true);
    try {
      await storeService.addRack(store._id, { rackCode: values.rackCode, description: values.description });
      setAddRackOpen(false);
      loadDetail();
      if (onRefresh) onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const racks = (detail?.racks || []).filter(r => r.isActive !== false);

  return (
    <Card variant="outlined" sx={{ mb: 1 }}>
      <CardHeader
        avatar={<StoreIcon color="secondary" />}
        title={
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="subtitle2">{store.name}</Typography>
            <Chip label={store.code} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 18 }} />
            {store.isActive
              ? <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
              : <CancelIcon sx={{ fontSize: 14, color: 'error.main' }} />
            }
          </Stack>
        }
        subheader={store.description}
        action={
          <IconButton size="small" onClick={() => { setExpanded(!expanded); }}>
            <ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
          </IconButton>
        }
        sx={{ pb: 0 }}
      />
      <Collapse in={expanded}>
        <CardContent sx={{ pt: 0.5 }}>
          {loadingDetail
            ? <Box sx={{ py: 1, textAlign: 'center' }}><CircularProgress size={20} /></Box>
            : (
              <>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="caption" color="text.secondary">
                    {racks.length} rack{racks.length !== 1 ? 's' : ''}
                  </Typography>
                  <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => setAddRackOpen(true)}>
                    Add Rack
                  </Button>
                </Stack>
                {racks.length === 0
                  ? <Typography variant="caption" color="text.secondary">No racks configured yet.</Typography>
                  : racks.map(rack => (
                    <RackCard key={rack._id} rack={rack} storeId={store._id} onRefresh={loadDetail} />
                  ))
                }
              </>
            )
          }
        </CardContent>
      </Collapse>
      <FormDialog
        open={addRackOpen}
        onClose={() => setAddRackOpen(false)}
        title={`Add Rack to ${store.name}`}
        fields={[
          { name: 'rackCode', label: 'Rack Code', required: true },
          { name: 'description', label: 'Description' }
        ]}
        onSubmit={handleAddRack}
        loading={saving}
      />
    </Card>
  );
};

// ─── Main store card ──────────────────────────────────────────────────────────
const MainStoreCard = ({ store, onRefresh }) => {
  const [addSubStoreOpen, setAddSubStoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subStores, setSubStores] = useState(store.children || []);

  const loadSubStores = useCallback(async () => {
    const res = await storeService.getSubStores(store._id);
    setSubStores(res.data || []);
  }, [store._id]);

  const handleAddSubStore = async (values) => {
    setSaving(true);
    try {
      await storeService.createStore({ name: values.name, type: 'sub', parent: store._id, description: values.description });
      setAddSubStoreOpen(false);
      loadSubStores();
      if (onRefresh) onRefresh();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setSubStores(store.children || []);
  }, [store.children]);

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <WarehouseIcon color="primary" sx={{ fontSize: 28 }} />
          <Box>
            <Typography variant="h6" fontWeight="bold">{store.name}</Typography>
            <Stack direction="row" spacing={1}>
              <Chip label={store.code} size="small" color="primary" variant="outlined" />
              <Chip label="Main Store" size="small" />
              {!store.isActive && <Chip label="Inactive" size="small" color="error" />}
            </Stack>
          </Box>
        </Stack>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setAddSubStoreOpen(true)}
        >
          Add Sub-Store
        </Button>
      </Stack>

      {store.description && (
        <Typography variant="body2" color="text.secondary" mb={1.5}>{store.description}</Typography>
      )}

      <Divider sx={{ mb: 1.5 }} />

      <Typography variant="subtitle2" color="text.secondary" mb={1}>
        Sub-Stores ({subStores.length})
      </Typography>

      {subStores.length === 0
        ? (
          <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
            No sub-stores yet. Click "Add Sub-Store" to create one.
          </Alert>
        )
        : subStores.map(sub => (
          <SubStoreCard key={sub._id} store={sub} onRefresh={loadSubStores} />
        ))
      }

      <FormDialog
        open={addSubStoreOpen}
        onClose={() => setAddSubStoreOpen(false)}
        title={`Add Sub-Store under "${store.name}"`}
        fields={[
          { name: 'name', label: 'Sub-Store Name', required: true },
          { name: 'description', label: 'Description' }
        ]}
        onSubmit={handleAddSubStore}
        loading={saving}
      />
    </Paper>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
const StoreManagement = () => {
  const [mainStores, setMainStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addMainOpen, setAddMainOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadStores = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await storeService.getHierarchy();
      setMainStores(res.data || []);
    } catch {
      setError('Failed to load stores. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const handleAddMainStore = async (values) => {
    setSaving(true);
    try {
      await storeService.createStore({ name: values.name, type: 'main', description: values.description });
      setAddMainOpen(false);
      loadStores();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Store Management</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage main stores, sub-stores, racks, shelves, and bins
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadStores} disabled={loading}>
              {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddMainOpen(true)}
          >
            Add Main Store
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && mainStores.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" mt={1}>Loading stores...</Typography>
        </Box>
      )}

      {!loading && mainStores.length === 0 && !error && (
        <Alert severity="info">
          No stores configured yet. Click "Add Main Store" to get started.
        </Alert>
      )}

      {mainStores.map(store => (
        <MainStoreCard key={store._id} store={store} onRefresh={loadStores} />
      ))}

      <FormDialog
        open={addMainOpen}
        onClose={() => setAddMainOpen(false)}
        title="Add Main Store"
        fields={[
          { name: 'name', label: 'Store Name', required: true },
          { name: 'description', label: 'Description' }
        ]}
        onSubmit={handleAddMainStore}
        loading={saving}
      />
    </Box>
  );
};

export default StoreManagement;
