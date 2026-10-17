import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { Add, AttachFile, Delete, Edit, Search as SearchIcon, Visibility, Download as DownloadIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import RegistryFormDialog from './RegistryFormDialog';
import RegistryDetailDialog from './RegistryDetailDialog';
import { getMozas } from '../../services/landAcquisitionMozaService';
import {
  createRegistry,
  deleteRegistry,
  getRegistries,
  updateRegistry
} from '../../services/landAcquisitionRegistryService';
import { formatKMS } from '../../utils/landAreaUnits';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB');
};

const RegistryViewer = () => {
  const [registries, setRegistries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(null);
  const [exchangeTotals, setExchangeTotals] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [mozas, setMozas] = useState([]);
  const [mozaFilter, setMozaFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [searchDebounced, mozaFilter]);

  useEffect(() => {
    getMozas().then((res) => setMozas(res.data?.data || [])).catch(() => setMozas([]));
  }, []);

  const loadRegistries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getRegistries({
        page: page + 1,
        limit: rowsPerPage,
        ...(searchDebounced && { search: searchDebounced }),
        ...(mozaFilter && { moza: mozaFilter })
      });
      const payload = res.data?.data;
      setRegistries(payload?.registries || []);
      setTotal(payload?.pagination?.total || 0);
      setGrandTotal(payload?.grandTotal || null);
      setExchangeTotals(payload?.exchangeTotals || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load registries');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchDebounced, mozaFilter]);

  useEffect(() => {
    loadRegistries();
  }, [loadRegistries]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const handleSave = async ({
    payload,
    files = [],
    removedAttachmentIds = [],
    registryDocFiles = [],
    removedRegistryDocAttachmentIds = [],
    inteqalDocFiles = [],
    removedInteqalDocAttachmentIds = []
  }) => {
    setSaving(true);
    const options = {
      files,
      removedAttachmentIds,
      registryDocFiles,
      removedRegistryDocAttachmentIds,
      inteqalDocFiles,
      removedInteqalDocAttachmentIds
    };
    try {
      if (editing) {
        const res = await updateRegistry(editing._id, payload, options);
        toast.success(res.data?.message || 'Registry updated');
      } else {
        const res = await createRegistry(payload, options);
        toast.success(res.data?.message || 'Registry created');
      }
      setDialogOpen(false);
      setEditing(null);
      await loadRegistries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save registry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete registry ${row.registryNo}?`)) return;
    setDeletingId(row._id);
    try {
      const res = await deleteRegistry(row._id);
      toast.success(res.data?.message || 'Registry deleted');
      await loadRegistries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete registry');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await getRegistries({
        page: 1,
        limit: 100000,
        ...(searchDebounced && { search: searchDebounced }),
        ...(mozaFilter && { moza: mozaFilter })
      });
      const data = res.data?.data?.registries || [];
      if (!data.length) {
        toast.error('No data to export');
        setExporting(false);
        return;
      }
      
      const rows = data.map(row => ({
        'Date': formatDate(row.registryDate),
        'Moza': row.moza?.name || '',
        'Khewat No': row.khewatNo || '',
        'Registry No': row.registryNo || '',
        'Inteqal No': row.inteqalNo || '',
        'Dealer': row.dealer?.name || '',
        'Total Acquired': formatKMS(row.totalArea),
        'Exchanged Out': formatKMS(row.exchangedOutArea),
        'Total Acquired Holding': formatKMS(row.netRemainingArea),
        'Total Khasras': row.lines?.length || 0
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Registries");
      XLSX.writeFile(wb, `Registries_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Exported successfully');
    } catch (err) {
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const cellEllipsisSx = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 0,
    px: { xs: 0.5, md: 0.75 }
  };

  const renderDocCount = (attachments, color = 'primary') => {
    const list = attachments || [];
    if (!list.length) {
      return (
        <Typography variant="caption" color="text.secondary">
          —
        </Typography>
      );
    }
    const names = list.map((a, i) => a.originalName || `Doc ${i + 1}`).join(', ');
    return (
      <Tooltip title={names}>
        <Chip
          size="small"
          color={color}
          variant="outlined"
          icon={<AttachFile fontSize="small" />}
          label={`${list.length}`}
          sx={{ maxWidth: '100%', '& .MuiChip-label': { px: 0.5 } }}
        />
      </Tooltip>
    );
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* KPI Balance Banner factor in Land Exchanges */}
      {grandTotal && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2.5,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden'
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap alignItems="center">
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                  TOTAL REGISTERED
                </Typography>
                <Typography variant="subtitle1" fontWeight={800} color="primary.main">
                  {formatKMS(grandTotal)}
                </Typography>
              </Box>

              {exchangeTotals && (
                <>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                      EXCHANGED OUT (SURRENDERED)
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={800} color="warning.dark">
                      - {formatKMS(exchangeTotals.exchangedOut)}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                      EXCHANGED IN (ACQUIRED)
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={800} color="success.dark">
                      + {formatKMS(exchangeTotals.exchangedIn)}
                    </Typography>
                  </Box>

                  <Box sx={{ pl: { sm: 1 }, borderLeft: { sm: '2px solid' }, borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">
                      TOTAL ACQUIRED HOLDING
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={900} color="text.primary">
                      {formatKMS(exchangeTotals.netEffective)}
                    </Typography>
                  </Box>
                </>
              )}
            </Stack>
          </Stack>
        </Paper>
      )}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ mb: 2, width: '100%', maxWidth: '100%' }}
        alignItems={{ sm: 'center' }}
        flexWrap="wrap"
        useFlexGap
      >
        <TextField
          size="small"
          placeholder="Search registry no, inteqal, khewat…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: '1 1 200px', maxWidth: { sm: 280 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            )
          }}
        />
        <TextField
          size="small"
          select
          label="Moza"
          value={mozaFilter}
          onChange={(e) => setMozaFilter(e.target.value)}
          sx={{ flex: '0 1 160px', minWidth: 140 }}
        >
          <MenuItem value="">All mouzas</MenuItem>
          {mozas.map((m) => (
            <MenuItem key={m._id} value={m._id}>{m.name}</MenuItem>
          ))}
        </TextField>

        <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'block' } }} />
        <Button variant="outlined" startIcon={exporting ? <CircularProgress size={20} /> : <DownloadIcon />} onClick={handleExport} disabled={exporting || loading}>
          Export
        </Button>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Add Registry
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : !registries.length ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary" gutterBottom>
            No registries yet. Record a legal purchase linked to mouza khasra records.
          </Typography>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate} sx={{ mt: 2 }}>
            Add Registry
          </Button>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
        <TableContainer
          sx={{
            width: '100%',
            maxWidth: '100%',
            maxHeight: 'min(70vh, 720px)',
            overflowX: 'hidden',
            overflowY: 'auto'
          }}
        >
          <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...cellEllipsisSx, width: '7%', bgcolor: 'background.paper' }}><strong>Date</strong></TableCell>
                <TableCell sx={{ ...cellEllipsisSx, width: '5%', bgcolor: 'background.paper' }}><strong>Deal</strong></TableCell>
                <TableCell sx={{ ...cellEllipsisSx, width: '7%', bgcolor: 'background.paper' }}><strong>Moza</strong></TableCell>
                <TableCell sx={{ ...cellEllipsisSx, width: '6%', bgcolor: 'background.paper' }}><strong>Khewat</strong></TableCell>
                <TableCell sx={{ ...cellEllipsisSx, width: '8%', bgcolor: 'background.paper' }}><strong>Registry</strong></TableCell>
                <TableCell sx={{ ...cellEllipsisSx, width: '7%', bgcolor: 'background.paper' }}><strong>Inteqal</strong></TableCell>
                <TableCell sx={{ ...cellEllipsisSx, width: '8%', bgcolor: 'background.paper' }}><strong>Seller</strong></TableCell>
                <TableCell sx={{ ...cellEllipsisSx, width: '8%', bgcolor: 'background.paper' }}><strong>Purchaser</strong></TableCell>
                <TableCell sx={{ ...cellEllipsisSx, width: '7%', bgcolor: 'background.paper' }}><strong>Dealer</strong></TableCell>
                <TableCell sx={{ ...cellEllipsisSx, width: '9%', bgcolor: 'background.paper' }}><strong>Acquired</strong></TableCell>
                <TableCell sx={{ ...cellEllipsisSx, width: '9%', bgcolor: 'background.paper' }}>
                  <Tooltip title="Total effective acquired land holding after exchanges">
                    <span><strong>Holding</strong></span>
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ ...cellEllipsisSx, width: '5%', bgcolor: 'background.paper' }} align="center"><strong>Reg. Docs</strong></TableCell>
                <TableCell sx={{ ...cellEllipsisSx, width: '5%', bgcolor: 'background.paper' }} align="center"><strong>Int. Docs</strong></TableCell>
                <TableCell sx={{ ...cellEllipsisSx, width: '5%', bgcolor: 'background.paper' }} align="center"><strong>Lines</strong></TableCell>
                <TableCell sx={{ width: '7%', px: 0.5, bgcolor: 'background.paper' }} align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {registries.map((row) => {
                const hasExchangeOut = row.exchangedOutArea && (row.exchangedOutArea.kanal > 0 || row.exchangedOutArea.marla > 0 || row.exchangedOutArea.sarsai > 0);
                const hasExchangeIn = row.exchangedInArea && (row.exchangedInArea.kanal > 0 || row.exchangedInArea.marla > 0 || row.exchangedInArea.sarsai > 0);
                const isFullyExchanged = row.netRemainingArea && row.netRemainingArea.kanal === 0 && row.netRemainingArea.marla === 0 && row.netRemainingArea.sarsai === 0;
                const acquiredTip = [
                  `Acquired: ${formatKMS(row.totalArea)}`,
                  hasExchangeOut ? `Out: -${formatKMS(row.exchangedOutArea)}` : null,
                  hasExchangeIn ? `In: +${formatKMS(row.exchangedInArea)}` : null
                ].filter(Boolean).join(' · ');
                const holdingTip = isFullyExchanged
                  ? 'Fully exchanged'
                  : `Holding: ${formatKMS(row.netRemainingArea || row.totalArea)}`;

                return (
                  <TableRow key={row._id} hover>
                    <TableCell sx={cellEllipsisSx}>{formatDate(row.registryDate)}</TableCell>
                    <TableCell sx={cellEllipsisSx}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {row.dealNo ? `#${row.dealNo}` : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellEllipsisSx}>
                      <Tooltip title={row.moza?.name || ''}>
                        <Typography variant="body2" noWrap>{row.moza?.name || '—'}</Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={cellEllipsisSx}>
                      <Tooltip title={row.khewatNo || ''}>
                        <Typography variant="body2" noWrap>{row.khewatNo || '—'}</Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={cellEllipsisSx}>
                      <Tooltip title={`${row.registryNo || ''}${row.isExchangeIn ? ' · Exchange In' : ''}`}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {row.registryNo}
                          </Typography>
                          {row.isExchangeIn ? (
                            <Chip
                              label="Exch. In"
                              size="small"
                              color="success"
                              sx={{ fontSize: '0.6rem', height: 16, mt: 0.25 }}
                            />
                          ) : null}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={cellEllipsisSx}>
                      <Tooltip title={row.inteqalNo || ''}>
                        <Typography variant="body2" noWrap>{row.inteqalNo || '—'}</Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={cellEllipsisSx}>
                      <Tooltip title={row.seller?.name || ''}>
                        <Typography variant="body2" noWrap>{row.seller?.name || '—'}</Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={cellEllipsisSx}>
                      <Tooltip title={row.purchaser?.name || ''}>
                        <Typography variant="body2" noWrap>{row.purchaser?.name || '—'}</Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={cellEllipsisSx}>
                      <Tooltip title={row.dealer?.name || ''}>
                        <Typography variant="body2" noWrap>{row.dealer?.name || '—'}</Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={cellEllipsisSx}>
                      <Tooltip title={acquiredTip}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {formatKMS(row.totalArea)}
                          </Typography>
                          {(hasExchangeOut || hasExchangeIn) ? (
                            <Typography variant="caption" color="text.secondary" noWrap display="block">
                              {hasExchangeOut ? `-${formatKMS(row.exchangedOutArea)}` : ''}
                              {hasExchangeOut && hasExchangeIn ? ' · ' : ''}
                              {hasExchangeIn ? `+${formatKMS(row.exchangedInArea)}` : ''}
                            </Typography>
                          ) : null}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={cellEllipsisSx}>
                      <Tooltip title={holdingTip}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            noWrap
                            color={isFullyExchanged ? 'error.main' : (hasExchangeOut || hasExchangeIn) ? 'primary.main' : 'text.primary'}
                          >
                            {formatKMS(row.netRemainingArea || row.totalArea)}
                          </Typography>
                          {isFullyExchanged ? (
                            <Chip label="Full Exch." size="small" color="error" sx={{ fontSize: '0.6rem', height: 16, mt: 0.25 }} />
                          ) : null}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={cellEllipsisSx} align="center">
                      {renderDocCount(row.registryDocAttachments, 'primary')}
                    </TableCell>
                    <TableCell sx={cellEllipsisSx} align="center">
                      {renderDocCount(row.inteqalDocAttachments, 'secondary')}
                    </TableCell>
                    <TableCell sx={cellEllipsisSx} align="center">
                      <Chip
                        size="small"
                        label={row.lines?.length || 0}
                        variant="outlined"
                        sx={{ maxWidth: '100%' }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ px: 0.25, whiteSpace: 'nowrap' }}>
                      <Tooltip title="View details">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setDetailRow(row);
                            setDetailId(row._id);
                          }}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={row.isExchangeIn ? 'Acquired in Exchange (Edit in Land Exchange tab)' : 'Edit'}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => !row.isExchangeIn && openEdit(row)}
                            disabled={Boolean(row.isExchangeIn)}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={row.isExchangeIn ? 'Delete via Land Exchange tab' : 'Delete'}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(row)}
                            disabled={Boolean(row.isExchangeIn) || deletingId === row._id}
                          >
                            {deletingId === row._id ? <CircularProgress size={16} /> : <Delete fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Paper>
      )}

      <RegistryFormDialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        onSave={handleSave}
        registry={editing}
        saving={saving}
      />

      <RegistryDetailDialog
        open={Boolean(detailId)}
        onClose={() => {
          setDetailId(null);
          setDetailRow(null);
        }}
        registryId={detailId}
        registryData={detailRow}
      />
    </Box>
  );
};

export default RegistryViewer;
