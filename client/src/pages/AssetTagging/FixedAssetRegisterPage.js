import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, MenuItem, CircularProgress, Alert, Stack, Chip, Button, Grid, Card, CardContent
} from '@mui/material';
import {
  AccountBalance as RegisterIcon, Refresh as RefreshIcon, QrCode2 as QrIcon,
  OpenInNew as OpenIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatAssetLocationForDisplay } from '../../utils/assetLocationDisplay';
import AssetAttachmentThumb from '../../components/AssetTagging/AssetAttachmentThumb';
import FixedAssetPaginationBar from '../../components/AssetTagging/FixedAssetPaginationBar';
import FixedAssetGrandTotals from '../../components/AssetTagging/FixedAssetGrandTotals';
import CeoOfficeFarImportButton from '../../components/AssetTagging/CeoOfficeFarImportButton';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-PK') : '—');
const STATUS_COLOR = { active: 'success', disposed: 'error', fully_depreciated: 'default' };

export default function FixedAssetRegisterPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [ledgerStatus, setLedgerStatus] = useState(''); // '' = active + fully_depreciated
  const [tagStatus, setTagStatus] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (tagStatus) params.tagStatus = tagStatus;
      if (ledgerStatus) params.status = ledgerStatus;
      const res = await api.get('/asset-tagging/assets', { params });
      setRows(res.data.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load register');
    } finally {
      setLoading(false);
    }
  }, [search, tagStatus, ledgerStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const paginatedRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  useEffect(() => {
    setPage(0);
  }, [rows.length, rowsPerPage]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        cost: acc.cost + Number(r.purchaseCost || 0),
        accum: acc.accum + Number(r.accumulatedDepreciation || 0),
        nbv: acc.nbv + Number(r.currentBookValue || 0)
      }),
      { cost: 0, accum: 0, nbv: 0 }
    );
  }, [rows]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" gap={1}>
          <RegisterIcon color="primary" fontSize="large" />
          <Box>
            <Typography variant="h5" fontWeight={700}>Fixed Asset Register (FAR)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
              Master list aligned with Finance fixed assets and Asset Tagging. Amounts match the ledger; use{' '}
              <strong>Tagged Assets</strong> to issue or void QR labels.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <CeoOfficeFarImportButton
            apiPath="/asset-tagging/import/ceo-office-far"
            size="small"
            onImported={(message) => {
              setSuccess(message);
              load();
            }}
          />
          <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Refresh</Button>
          <Button variant="outlined" startIcon={<QrIcon />} onClick={() => navigate('/asset-tagging/assets')}>
            Tagged Assets
          </Button>
          <Button variant="outlined" endIcon={<OpenIcon />} onClick={() => navigate('/finance/fixed-assets')}>
            Finance register
          </Button>
        </Stack>
      </Stack>

      <FixedAssetGrandTotals totalCount={rows.length} totalBookValue={totals.nbv} />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: 'Total cost (PKR)', value: fmt(totals.cost), color: 'primary.main' },
          { label: 'Accum. depreciation', value: fmt(totals.accum), color: 'warning.main' }
        ].map((c) => (
          <Grid item xs={12} sm={6} key={c.label}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                <Typography variant="h6" fontWeight={700} color={c.color}>
                  PKR {c.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" alignItems="center">
        <TextField
          size="small"
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, number, location, serial"
          sx={{ minWidth: 220 }}
        />
        <TextField size="small" select label="Ledger status" value={ledgerStatus} onChange={(e) => setLedgerStatus(e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="">Active &amp; fully depreciated</MenuItem>
          <MenuItem value="disposed">Disposed</MenuItem>
          <MenuItem value="all">All statuses</MenuItem>
        </TextField>
        <TextField size="small" select label="QR tag" value={tagStatus} onChange={(e) => setTagStatus(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="tagged">Tagged</MenuItem>
          <MenuItem value="untagged">Untagged</MenuItem>
        </TextField>
        <Button variant="contained" onClick={load} disabled={loading}>Apply</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {loading ? (
        <Box py={6} textAlign="center"><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 'calc(100vh - 320px)' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100', whiteSpace: 'nowrap' }}>Asset #</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100', width: 64 }}>Image</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100', minWidth: 160 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100' }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100', whiteSpace: 'nowrap' }}>Serial #</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100', minWidth: 140 }}>Location</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100', minWidth: 120 }}>Custody</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100', minWidth: 120 }}>Cost center</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100', whiteSpace: 'nowrap' }}>Purchase date</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100' }} align="right">Cost (PKR)</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100' }} align="right">Accum. dep.</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100' }} align="right">NBV</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100', whiteSpace: 'nowrap' }}>Active QR tag</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No rows match your filters — add assets under Finance → Fixed Assets, or widen ledger status to &quot;All statuses&quot;.
                  </TableCell>
                </TableRow>
              )}
              {paginatedRows.map((a) => (
                <TableRow key={a._id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{a.assetNumber}</TableCell>
                  <TableCell><AssetAttachmentThumb asset={a} size={40} /></TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>{a.category || '—'}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{a.serialNumber || '—'}</TableCell>
                  <TableCell>{formatAssetLocationForDisplay(a.location) || '—'}</TableCell>
                  <TableCell>{a.assignedTo || '—'}</TableCell>
                  <TableCell>
                    {a.costCenter
                      ? [a.costCenter.code, a.costCenter.name].filter(Boolean).join(' · ') || '—'
                      : '—'}
                  </TableCell>
                  <TableCell>{fmtDate(a.purchaseDate)}</TableCell>
                  <TableCell align="right">{fmt(a.purchaseCost)}</TableCell>
                  <TableCell align="right" sx={{ color: 'warning.dark' }}>{fmt(a.accumulatedDepreciation)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: 'success.dark' }}>{fmt(a.currentBookValue)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={(a.status || '').replace(/_/g, ' ')}
                      color={STATUS_COLOR[a.status] || 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    {a.currentTag ? (
                      <Chip size="small" label={a.currentTag.tagCode} color="success" variant="outlined" />
                    ) : (
                      <Chip size="small" label="—" variant="outlined" color="default" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && rows.length > 0 && (
        <FixedAssetPaginationBar
          page={page}
          setPage={setPage}
          rowsPerPage={rowsPerPage}
          setRowsPerPage={setRowsPerPage}
          totalCount={rows.length}
        />
      )}
    </Box>
  );
}
