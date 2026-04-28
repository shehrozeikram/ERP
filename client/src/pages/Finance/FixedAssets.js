import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, CircularProgress,
  Alert, Tooltip, Stack, Card, CardContent, Grid, Collapse, Divider,
  FormControl, InputLabel, Select
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon,
  AccountBalance as AssetIcon, PlayArrow as DepreciateIcon,
  AllInclusive as DepAllIcon, KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon2, Block as DisposeIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import api from '../../services/api';
import storeService from '../../services/storeService';
import LocationSelector from '../../components/Procurement/Store/LocationSelector';

const CATEGORIES = ['land','building','machinery','vehicle','furniture','computer','equipment','other'];
const METHODS = [
  { value: 'straight_line',    label: 'Straight Line'      },
  { value: 'declining_balance', label: 'Declining Balance' },
  { value: 'none',             label: 'None'               }
];
const HQ_LOCATION = 'Sardar Plaza Head Quarter';
const STATUS_COLOR = { active: 'success', disposed: 'error', fully_depreciated: 'default' };
const SCHED_COLOR  = { pending: 'warning', posted: 'success', skipped: 'default' };

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK') : '—';

const emptyForm = {
  name: '', description: '', category: 'equipment',
  purchaseDate: new Date().toISOString().split('T')[0],
  purchaseCost: '', residualValue: 0,
  depreciationMethod: 'straight_line', usefulLifeYears: 5, depreciationRate: 20,
  location: '',
  locationBuilding: HQ_LOCATION,
  locationFloor: 'Ground Floor',
  locationRoom: '',
  locationSubStore: '',
  locationRack: '',
  locationShelf: '',
  locationBin: '',
  assignedTo: '',
  project: '',
  serialNumber: '',
  brand: '',
  model: '',
  manufacturer: '',
  condition: '',
  warrantyExpiryDate: '',
  characteristics: ''
};

function DepreciationScheduleRow({ asset }) {
  const [open, setOpen] = useState(false);
  const schedule = asset.depreciationSchedule || [];
  const monthly  = asset.status === 'active' ? ((asset.purchaseCost - asset.residualValue) / (asset.usefulLifeYears * 12)) : 0;

  return (
    <>
      <TableRow hover>
        <TableCell padding="checkbox">
          <IconButton size="small" onClick={() => setOpen(v => !v)}>
            {open ? <CollapseIcon2 fontSize="small" /> : <ExpandIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell><Typography fontWeight={700} color="primary.main">{asset.assetNumber}</Typography></TableCell>
        <TableCell>{asset.name}</TableCell>
        <TableCell sx={{ textTransform: 'capitalize' }}>{asset.category}</TableCell>
        <TableCell align="right">{fmt(asset.purchaseCost)}</TableCell>
        <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 600 }}>{fmt(asset.accumulatedDepreciation)}</TableCell>
        <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>{fmt(asset.currentBookValue)}</TableCell>
        <TableCell align="right" sx={{ color: 'text.secondary' }}>{asset.usefulLifeYears}y</TableCell>
        <TableCell><Chip label={asset.status?.replace('_',' ')} color={STATUS_COLOR[asset.status]||'default'} size="small" /></TableCell>
        <TableCell align="right" sx={{ color: 'info.main' }}>{fmt(monthly)}/mo</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={10} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ m: 1, bgcolor: 'grey.50', borderRadius: 1, p: 1 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ pl: 1 }}>
                DEPRECIATION SCHEDULE — {schedule.length} periods recorded
              </Typography>
              {schedule.length === 0 ? (
                <Typography variant="body2" color="text.disabled" sx={{ p: 1 }}>No depreciation posted yet</Typography>
              ) : (
                <Table size="small" sx={{ mt: 0.5 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Period</TableCell><TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Accum. Dep.</TableCell><TableCell align="right">Book Value</TableCell>
                      <TableCell>Status</TableCell><TableCell>Posted At</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...schedule].sort((a, b) => a.period.localeCompare(b.period)).map(s => (
                      <TableRow key={s._id} sx={{ bgcolor: s.status === 'posted' ? 'success.50' : 'inherit' }}>
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.period}</TableCell>
                        <TableCell align="right">{fmt(s.amount)}</TableCell>
                        <TableCell align="right">{fmt(s.accumulatedDepreciation)}</TableCell>
                        <TableCell align="right">{fmt(s.bookValue)}</TableCell>
                        <TableCell><Chip label={s.status} color={SCHED_COLOR[s.status]||'default'} size="small" /></TableCell>
                        <TableCell>{fmtDate(s.postedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function FixedAssets() {
  const [assets, setAssets]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [summary, setSummary] = useState(null);

  // Add/Edit dialog
  const [open, setOpen]     = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]     = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [mainStores, setMainStores] = useState([]);
  const [selectedMainStoreId, setSelectedMainStoreId] = useState('');
  const [selectedSubStores, setSelectedSubStores] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Single depreciate dialog
  const [depOpen, setDepOpen]   = useState(false);
  const [depAsset, setDepAsset] = useState(null);
  const [depForm, setDepForm]   = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [depLoading, setDepLoading] = useState(false);

  // Bulk depreciate dialog
  const [bulkOpen, setBulkOpen]   = useState(false);
  const [bulkForm, setBulkForm]   = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult]   = useState(null);

  // Dispose dialog
  const [disposeOpen, setDisposeOpen]   = useState(false);
  const [disposeAsset, setDisposeAsset] = useState(null);
  const [disposeForm, setDisposeForm]   = useState({ disposalDate: new Date().toISOString().split('T')[0], disposalValue: 0 });
  const [disposeLoading, setDisposeLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [assRes, sumRes] = await Promise.all([
        api.get('/finance/fixed-assets'),
        api.get('/finance/fixed-assets/reports/summary')
      ]);
      setAssets(assRes.data.data || []);
      setSummary(sumRes.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await api.get('/finance/fixed-assets/employees');
      setEmployees(res.data?.data || []);
    } catch {
      setEmployees([]);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const res = await api.get('/finance/fixed-assets/projects');
      setProjects(res.data?.data || []);
    } catch (e) {
      // Compatibility fallback: some production builds may still expose project
      // master under /api/projects while fixed-assets/projects is not deployed yet.
      if (e?.response?.status === 404) {
        try {
          const fallbackRes = await api.get('/projects');
          const rows = fallbackRes.data?.data || [];
          setProjects(Array.isArray(rows) ? rows : []);
          return;
        } catch (fallbackErr) {
          setProjects([]);
          const fbMsg = fallbackErr?.response?.data?.message || 'Failed to load projects';
          if (fallbackErr?.response?.status === 403) {
            setError('You do not have access to fetch project dropdown data.');
          } else {
            setError(fbMsg);
          }
          return;
        }
      }

      setProjects([]);
      const msg = e?.response?.data?.message || 'Failed to load projects';
      if (e?.response?.status === 403) {
        setError('You do not have access to fetch project dropdown data.');
      } else {
        setError(msg);
      }
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const loadStores = useCallback(async () => {
    try {
      const res = await storeService.getStores({ type: 'main', activeOnly: 'true' });
      setMainStores(res.data || []);
    } catch {
      setMainStores([]);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  useEffect(() => {
    const selectedStore = mainStores.find((s) => String(s.name || '') === String(form.locationBuilding || ''));
    const mainStoreId = selectedStore?._id || '';
    setSelectedMainStoreId(mainStoreId);
    if (!mainStoreId) {
      setSelectedSubStores([]);
      return;
    }
    storeService.getSubStores(mainStoreId)
      .then((res) => setSelectedSubStores(res.data || []))
      .catch(() => setSelectedSubStores([]));
  }, [mainStores, form.locationBuilding]);

  const openAdd = async () => {
    setEditing(null);
    loadEmployees();
    const base = { ...emptyForm };
    try {
      const serialRes = await api.get('/finance/fixed-assets/next-serial');
      base.serialNumber = serialRes.data?.data?.serialNumber || '';
    } catch {
      base.serialNumber = '';
    }
    setForm(base);
    setOpen(true);
  };

  const openEdit = (a) => {
    loadEmployees();
    const locParts = String(a.location || '').split(',').map((part) => part.trim());
    const inferredBuilding = locParts[0] || HQ_LOCATION;
    const isStore = inferredBuilding !== HQ_LOCATION;
    setEditing(a);
    setForm({
      ...a,
      project: a.project?._id || a.project || '',
      purchaseDate: a.purchaseDate?.split('T')[0] || '',
      depreciationRate: a.depreciationRate ?? (a.usefulLifeYears ? (100 / Number(a.usefulLifeYears || 1)) : 0),
      locationBuilding: inferredBuilding || HQ_LOCATION,
      locationFloor: !isStore ? (locParts[1] || 'Ground Floor') : '',
      locationRoom: !isStore ? (locParts[2] || '') : '',
      locationSubStore: isStore ? (locParts[1] || '') : '',
      locationRack: isStore ? (locParts[2] || '') : '',
      locationShelf: isStore ? (locParts[3] || '') : '',
      locationBin: isStore ? (locParts[4] || '') : ''
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.purchaseDate || !form.purchaseCost) { setError('Name, date and cost are required'); return; }
    setSaving(true);
    try {
      const isStore = form.locationBuilding !== HQ_LOCATION;
      const selectedSubStore = selectedSubStores.find((s) => s._id === form.locationSubStore);
      const subStoreLabel = selectedSubStore?.name || form.locationSubStore || '';
      const locationParts = isStore
        ? [form.locationBuilding, subStoreLabel, form.locationRack, form.locationShelf, form.locationBin]
        : [form.locationBuilding, form.locationFloor, form.locationRoom];
      const normalizedLocation = locationParts.map((part) => String(part || '').trim()).filter(Boolean).join(', ');
      const payload = {
        ...form,
        depreciationRate:
          form.depreciationMethod === 'none'
            ? 0
            : Number(form.depreciationRate || 0),
        location: normalizedLocation,
        assignedTo: form.assignedTo || '',
        project: form.project || null
      };
      delete payload.locationBuilding;
      delete payload.locationFloor;
      delete payload.locationRoom;
      delete payload.locationSubStore;
      delete payload.locationRack;
      delete payload.locationShelf;
      delete payload.locationBin;

      if (editing) await api.put(`/finance/fixed-assets/${editing._id}`, payload);
      else         await api.post('/finance/fixed-assets', payload);
      setSuccess(editing ? 'Asset updated' : 'Asset created');
      setOpen(false);
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const residualLifeYears = (() => {
    const life = Number(form.usefulLifeYears || 0);
    const purchase = form.purchaseDate ? new Date(form.purchaseDate) : null;
    if (!life || !purchase || Number.isNaN(purchase.getTime())) return 0;
    const now = new Date();
    const elapsed = Math.max(0, (now.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    return Math.max(0, life - elapsed).toFixed(1);
  })();

  const straightLineRate = Number(form.usefulLifeYears || 0) > 0
    ? (100 / Number(form.usefulLifeYears || 1))
    : 0;

  const runDeprec = async () => {
    setDepLoading(true);
    try {
      await api.post(`/finance/fixed-assets/${depAsset._id}/depreciate`, depForm);
      setSuccess(`Depreciation posted for ${depAsset.name}`);
      setDepOpen(false);
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Depreciation failed');
    } finally {
      setDepLoading(false);
    }
  };

  const runBulkDeprec = async () => {
    setBulkLoading(true); setBulkResult(null);
    try {
      const res = await api.post('/finance/fixed-assets/depreciate-all', bulkForm);
      setBulkResult(res.data.data);
      setSuccess(res.data.message);
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Bulk depreciation failed');
    } finally {
      setBulkLoading(false);
    }
  };

  const runDispose = async () => {
    setDisposeLoading(true);
    try {
      await api.post(`/finance/fixed-assets/${disposeAsset._id}/dispose`, disposeForm);
      setSuccess(`Asset ${disposeAsset.name} marked as disposed`);
      setDisposeOpen(false);
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Disposal failed');
    } finally {
      setDisposeLoading(false);
    }
  };

  const paginatedAssets = assets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  useEffect(() => {
    setPage(0);
  }, [assets.length, rowsPerPage]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1}>
            <AssetIcon color="primary" /> Fixed Assets
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Fixed Asset Register (FAR) — same records as <strong>Asset Tagging → Fixed Asset Register</strong>; manage depreciation and disposal here.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="warning" startIcon={<DepAllIcon />}
            onClick={() => { setBulkResult(null); setBulkOpen(true); }}>
            Depreciate All
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Add Asset</Button>
        </Stack>
      </Stack>

      {error   && <Alert severity="error"   onClose={() => setError('')}   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      {/* Summary cards */}
      {summary && (
        <Grid container spacing={2} mb={3}>
          {[
            { label: 'Total Assets',            value: summary.totals?.count || 0,           color: 'primary.main',  raw: true },
            { label: 'Total Purchase Cost',     value: fmt(summary.totals?.totalCost),        color: 'primary.main'              },
            { label: 'Accumulated Depreciation',value: fmt(summary.totals?.totalAccumDepreciation), color: 'warning.main'       },
            { label: 'Net Book Value',          value: fmt(summary.totals?.totalBookValue),   color: 'success.main'              }
          ].map(c => (
            <Grid item xs={12} sm={6} md={3} key={c.label}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                  <Typography variant="h6" fontWeight={700} color={c.color}>
                    {c.raw ? c.value : `PKR ${c.value}`}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Alert severity="info" sx={{ mb: 2 }} icon={<ScheduleIcon />}>
        Click the <strong>▼</strong> arrow on any asset row to expand its depreciation schedule. Auto-depreciation runs on the <strong>1st of every month</strong>.
      </Alert>

      {loading ? <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box> : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ bgcolor: 'primary.main', width: 40 }} />
                {['Asset #','Name','Category','Cost (PKR)','Accum. Dep.','Book Value','Life','Status','Monthly Dep.'].map(h => (
                  <TableCell key={h} sx={{ color: 'white', fontWeight: 700, bgcolor: 'primary.main' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {assets.length === 0 && (
                <TableRow><TableCell colSpan={10} align="center" sx={{ color: 'text.secondary', py: 4 }}>No fixed assets yet.</TableCell></TableRow>
              )}
              {paginatedAssets.map(a => (
                <React.Fragment key={a._id}>
                  <DepreciationScheduleRow asset={a} />
                  {/* Action buttons row */}
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell />
                    <TableCell colSpan={9}>
                      <Stack direction="row" spacing={1} py={0.3}>
                        <Tooltip title="Edit Asset">
                          <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(a)}>Edit</Button>
                        </Tooltip>
                        {a.status === 'active' && (
                          <Tooltip title="Post depreciation for this asset">
                            <Button size="small" color="warning" startIcon={<DepreciateIcon />}
                              onClick={() => { setDepAsset(a); setDepOpen(true); }}>
                              Post Depreciation
                            </Button>
                          </Tooltip>
                        )}
                        {a.status !== 'disposed' && (
                          <Tooltip title="Mark asset as disposed">
                            <Button size="small" color="error" startIcon={<DisposeIcon />}
                              onClick={() => { setDisposeAsset(a); setDisposeOpen(true); }}>
                              Dispose
                            </Button>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {!loading && assets.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
          <TextField
            select
            size="small"
            label="Rows"
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(0);
            }}
            sx={{ width: 110, mr: 1 }}
          >
            {[5, 10, 25, 50].map((n) => (
              <MenuItem key={n} value={n}>{n}</MenuItem>
            ))}
          </TextField>
          <Button size="small" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            Prev
          </Button>
          <Typography variant="body2" sx={{ px: 1.5, alignSelf: 'center' }}>
            Page {page + 1} / {Math.max(1, Math.ceil(assets.length / rowsPerPage))}
          </Typography>
          <Button
            size="small"
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * rowsPerPage >= assets.length}
          >
            Next
          </Button>
        </Box>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Asset' : 'Add Fixed Asset'}</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField label="Asset Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth size="small" />
            <Stack direction="row" gap={2}>
              <TextField select label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} fullWidth size="small">
                {CATEGORIES.map(c => <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c}</MenuItem>)}
              </TextField>
              <TextField
                label="Serial # (Auto)"
                value={form.serialNumber || ''}
                onChange={e => setForm({ ...form, serialNumber: e.target.value })}
                fullWidth
                size="small"
                helperText="Auto-generated with +1 sequence; you can still edit if required."
              />
            </Stack>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 0.5 }}>
              Asset Characteristics
            </Typography>
            <Stack direction="row" gap={2}>
              <TextField label="Brand" value={form.brand || ''} onChange={e => setForm({ ...form, brand: e.target.value })} fullWidth size="small" />
              <TextField label="Model" value={form.model || ''} onChange={e => setForm({ ...form, model: e.target.value })} fullWidth size="small" />
            </Stack>
            <Stack direction="row" gap={2}>
              <TextField label="Manufacturer" value={form.manufacturer || ''} onChange={e => setForm({ ...form, manufacturer: e.target.value })} fullWidth size="small" />
              <TextField
                label="Condition"
                value={form.condition || ''}
                onChange={e => setForm({ ...form, condition: e.target.value })}
                fullWidth
                size="small"
                placeholder="e.g. New / Good / Refurbished"
              />
            </Stack>
            <TextField
              label="Warranty Expiry"
              type="date"
              value={form.warrantyExpiryDate ? String(form.warrantyExpiryDate).split('T')[0] : ''}
              onChange={e => setForm({ ...form, warrantyExpiryDate: e.target.value })}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Characteristics / Specifications"
              value={form.characteristics || ''}
              onChange={e => setForm({ ...form, characteristics: e.target.value })}
              multiline
              rows={2}
              fullWidth
              size="small"
              placeholder="Key specs, configuration, distinguishing details"
            />
            <Stack direction="row" gap={2}>
              <TextField label="Purchase Date *" type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} fullWidth size="small" InputLabelProps={{ shrink: true }} />
              <TextField label="Purchase Cost *" type="number" value={form.purchaseCost} onChange={e => setForm({ ...form, purchaseCost: e.target.value })} fullWidth size="small" inputProps={{ min: 0 }} />
            </Stack>
            <Stack direction="row" gap={2}>
              <TextField label="Residual Value" type="number" value={form.residualValue} onChange={e => setForm({ ...form, residualValue: e.target.value })} fullWidth size="small" inputProps={{ min: 0 }} />
              <TextField
                select
                label="Depreciation Method"
                value={form.depreciationMethod}
                onChange={e => {
                  const method = e.target.value;
                  setForm({
                    ...form,
                    depreciationMethod: method,
                    depreciationRate:
                      method === 'none'
                        ? 0
                        : method === 'straight_line'
                        ? Number(straightLineRate.toFixed(2))
                        : form.depreciationRate
                  });
                }}
                fullWidth
                size="small"
              >
                {METHODS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
              </TextField>
            </Stack>
            <Stack direction="row" gap={2}>
              <TextField
                label="Useful Life (Years)"
                type="number"
                value={form.usefulLifeYears}
                onChange={e => {
                  const years = e.target.value;
                  const yearsNum = Number(years || 0);
                  setForm({
                    ...form,
                    usefulLifeYears: years,
                    depreciationRate:
                      form.depreciationMethod === 'straight_line' && yearsNum > 0
                        ? Number((100 / yearsNum).toFixed(2))
                        : form.depreciationRate
                  });
                }}
                fullWidth
                size="small"
                inputProps={{ min: 1 }}
              />
              <TextField
                label="Residual Life (Years)"
                value={residualLifeYears}
                fullWidth
                size="small"
                InputProps={{ readOnly: true }}
                helperText="Remaining useful life from purchase date to end-of-life."
              />
            </Stack>
            <TextField
              label="Depreciation Rate (%)"
              type="number"
              value={form.depreciationMethod === 'straight_line' ? Number(straightLineRate.toFixed(2)) : (form.depreciationRate ?? 0)}
              onChange={e => setForm({ ...form, depreciationRate: e.target.value })}
              fullWidth
              size="small"
              inputProps={{ min: 0, max: 100, step: 0.01 }}
              disabled={form.depreciationMethod === 'none' || form.depreciationMethod === 'straight_line'}
              required={form.depreciationMethod === 'declining_balance'}
              helperText={
                form.depreciationMethod === 'straight_line'
                  ? 'Auto-derived from useful life (100 / years).'
                  : form.depreciationMethod === 'declining_balance'
                  ? 'Required for declining balance method.'
                  : 'Depreciation rate is not used when method is None.'
              }
            />
            <TextField
              select
              label="Location"
              value={form.locationBuilding || ''}
              onChange={e => {
                const next = e.target.value;
                setForm({
                  ...form,
                  locationBuilding: next,
                  locationFloor: next === HQ_LOCATION ? (form.locationFloor || 'Ground Floor') : '',
                  locationRoom: next === HQ_LOCATION ? form.locationRoom : '',
                  locationSubStore: next === HQ_LOCATION ? '' : form.locationSubStore,
                  locationRack: next === HQ_LOCATION ? '' : form.locationRack,
                  locationShelf: next === HQ_LOCATION ? '' : form.locationShelf,
                  locationBin: next === HQ_LOCATION ? '' : form.locationBin
                });
              }}
              fullWidth
              size="small"
            >
              {[HQ_LOCATION, ...mainStores.map((s) => s.name).filter(Boolean)].map((building) => (
                <MenuItem key={building} value={building}>{building}</MenuItem>
              ))}
            </TextField>
            {form.locationBuilding !== HQ_LOCATION ? (
              <>
                <LocationSelector
                  mainStoreId={selectedMainStoreId || undefined}
                  value={{
                    subStore: form.locationSubStore || '',
                    rack: form.locationRack || '',
                    shelf: form.locationShelf || '',
                    bin: form.locationBin || ''
                  }}
                  onChange={(loc) => {
                    setForm({
                      ...form,
                      locationSubStore: loc.subStore || '',
                      locationRack: loc.rack || '',
                      locationShelf: loc.shelf || '',
                      locationBin: loc.bin || ''
                    });
                  }}
                  size="small"
                />
                {!selectedMainStoreId && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    Selected store is not configured yet in Store Management.
                  </Alert>
                )}
              </>
            ) : (
              <Stack direction="row" gap={2}>
                <TextField
                  label="Floor"
                  value={form.locationFloor || ''}
                  onChange={e => setForm({ ...form, locationFloor: e.target.value })}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Room"
                  value={form.locationRoom || ''}
                  onChange={e => setForm({ ...form, locationRoom: e.target.value })}
                  fullWidth
                  size="small"
                />
              </Stack>
            )}
            <FormControl fullWidth size="small">
              <InputLabel id="project-label">Project</InputLabel>
              <Select
                labelId="project-label"
                label="Project"
                value={form.project || ''}
                onChange={(e) => setForm({ ...form, project: e.target.value })}
              >
                <MenuItem value=""><em>No project</em></MenuItem>
                {projects.map((proj) => (
                  <MenuItem key={proj._id} value={proj._id}>
                    {[proj.code, proj.name].filter(Boolean).join(' - ') || proj.projectId || 'Project'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="assigned-to-label">Assigned To</InputLabel>
              <Select
                labelId="assigned-to-label"
                label="Assigned To"
                value={form.assignedTo || ''}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              >
                <MenuItem value=""><em>Not assigned</em></MenuItem>
                {employees.map((emp) => (
                  <MenuItem key={emp._id} value={`${emp.fullName}${emp.employeeId ? ` (${emp.employeeId})` : ''}`}>
                    {`${emp.fullName}${emp.employeeId ? ` (${emp.employeeId})` : ''}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Description" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} multiline rows={2} fullWidth size="small" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? <CircularProgress size={18} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      {/* Single Depreciation Dialog */}
      <Dialog open={depOpen} onClose={() => setDepOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Post Depreciation — {depAsset?.name}</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <Typography variant="body2" color="text.secondary">
              Monthly amount: <strong>PKR {depAsset ? fmt((depAsset.purchaseCost - depAsset.residualValue) / (depAsset.usefulLifeYears * 12)) : 0}</strong>
            </Typography>
            <Stack direction="row" gap={2}>
              <TextField label="Year" type="number" value={depForm.year} onChange={e => setDepForm({ ...depForm, year: Number(e.target.value) })} fullWidth size="small" />
              <TextField label="Month" type="number" value={depForm.month} onChange={e => setDepForm({ ...depForm, month: Number(e.target.value) })} fullWidth size="small" inputProps={{ min: 1, max: 12 }} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={runDeprec} disabled={depLoading}>
            {depLoading ? <CircularProgress size={18} /> : 'Post Depreciation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Depreciation Dialog */}
      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle display="flex" alignItems="center" gap={1}><DepAllIcon color="warning" /> Bulk Depreciation — All Active Assets</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will post depreciation for <strong>all active assets</strong> for the selected period. Already-posted periods will be skipped automatically.
          </Alert>
          <Stack direction="row" gap={2} mb={2}>
            <TextField label="Year" type="number" value={bulkForm.year} onChange={e => setBulkForm({ ...bulkForm, year: Number(e.target.value) })} fullWidth size="small" />
            <TextField label="Month" type="number" value={bulkForm.month} onChange={e => setBulkForm({ ...bulkForm, month: Number(e.target.value) })} fullWidth size="small" inputProps={{ min: 1, max: 12 }} />
          </Stack>
          {bulkResult && (
            <Box sx={{ bgcolor: 'grey.50', borderRadius: 1, p: 2 }}>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Posted:</strong> {bulkResult.posted} assets</Typography>
                <Typography variant="body2"><strong>Skipped:</strong> {bulkResult.skipped} assets</Typography>
                {(bulkResult.errors || []).length > 0 && (
                  <Typography variant="body2" color="error.main"><strong>Errors:</strong> {bulkResult.errors.map(e => `${e.asset}: ${e.error}`).join(', ')}</Typography>
                )}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)}>Close</Button>
          <Button variant="contained" color="warning" onClick={runBulkDeprec} disabled={bulkLoading}>
            {bulkLoading ? <CircularProgress size={18} color="inherit" /> : 'Post All Depreciation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dispose Dialog */}
      <Dialog open={disposeOpen} onClose={() => setDisposeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Dispose Asset — {disposeAsset?.name}</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField label="Disposal Date" type="date" value={disposeForm.disposalDate} onChange={e => setDisposeForm({ ...disposeForm, disposalDate: e.target.value })} fullWidth size="small" InputLabelProps={{ shrink: true }} />
            <TextField label="Disposal / Sale Value (PKR)" type="number" value={disposeForm.disposalValue} onChange={e => setDisposeForm({ ...disposeForm, disposalValue: e.target.value })} fullWidth size="small" inputProps={{ min: 0 }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisposeOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={runDispose} disabled={disposeLoading}>
            {disposeLoading ? <CircularProgress size={18} /> : 'Confirm Disposal'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
