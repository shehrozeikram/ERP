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

const CATEGORIES = ['land','building','machinery','vehicle','furniture','computer','equipment','other'];
const METHODS = [
  { value: 'straight_line',    label: 'Straight Line'      },
  { value: 'declining_balance', label: 'Declining Balance' },
  { value: 'none',             label: 'None'               }
];
const STATUS_COLOR = { active: 'success', disposed: 'error', fully_depreciated: 'default' };
const SCHED_COLOR  = { pending: 'warning', posted: 'success', skipped: 'default' };

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK') : '—';

const emptyForm = {
  name: '', description: '', category: 'equipment',
  purchaseDate: new Date().toISOString().split('T')[0],
  purchaseCost: '', residualValue: 0,
  depreciationMethod: 'straight_line', usefulLifeYears: 5,
  location: '', assignedTo: '', serialNumber: ''
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

  const openAdd  = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (a) => { setEditing(a); setForm({ ...a, purchaseDate: a.purchaseDate?.split('T')[0] || '' }); setOpen(true); };

  const handleSave = async () => {
    if (!form.name || !form.purchaseDate || !form.purchaseCost) { setError('Name, date and cost are required'); return; }
    setSaving(true);
    try {
      if (editing) await api.put(`/finance/fixed-assets/${editing._id}`, form);
      else         await api.post('/finance/fixed-assets', form);
      setSuccess(editing ? 'Asset updated' : 'Asset created');
      setOpen(false);
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1}>
          <AssetIcon color="primary" /> Fixed Assets
        </Typography>
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
              {assets.map(a => (
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
              <TextField label="Serial #" value={form.serialNumber || ''} onChange={e => setForm({ ...form, serialNumber: e.target.value })} fullWidth size="small" />
            </Stack>
            <Stack direction="row" gap={2}>
              <TextField label="Purchase Date *" type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} fullWidth size="small" InputLabelProps={{ shrink: true }} />
              <TextField label="Purchase Cost *" type="number" value={form.purchaseCost} onChange={e => setForm({ ...form, purchaseCost: e.target.value })} fullWidth size="small" inputProps={{ min: 0 }} />
            </Stack>
            <Stack direction="row" gap={2}>
              <TextField label="Residual Value" type="number" value={form.residualValue} onChange={e => setForm({ ...form, residualValue: e.target.value })} fullWidth size="small" inputProps={{ min: 0 }} />
              <TextField select label="Depreciation Method" value={form.depreciationMethod} onChange={e => setForm({ ...form, depreciationMethod: e.target.value })} fullWidth size="small">
                {METHODS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
              </TextField>
            </Stack>
            <Stack direction="row" gap={2}>
              <TextField label="Useful Life (Years)" type="number" value={form.usefulLifeYears} onChange={e => setForm({ ...form, usefulLifeYears: e.target.value })} fullWidth size="small" inputProps={{ min: 1 }} />
              <TextField label="Location" value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} fullWidth size="small" />
            </Stack>
            <TextField label="Assigned To" value={form.assignedTo || ''} onChange={e => setForm({ ...form, assignedTo: e.target.value })} fullWidth size="small" />
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
