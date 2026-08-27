import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
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
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FileDownload as ExcelIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  SwapHorizontalCircle as ExchangeIcon,
  CallMade as OutIcon,
  CallReceived as InIcon,
  CompareArrows as SwapIcon,
  AttachFile as AttachFileIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import landAcquisitionExchangeService from '../../services/landAcquisitionExchangeService';
import { getMozas } from '../../services/landAcquisitionMozaService';
import { addAreas, formatAreaReadable, formatKMS } from '../../utils/landAreaUnits';
import LandExchangeFormDialog from '../../components/TajResidencia/LandExchangeFormDialog';
import LandExchangeDetailDialog from '../../components/TajResidencia/LandExchangeDetailDialog';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const StatCard = ({ title, area, subText, icon: Icon, color, bg }) => (
  <Paper
    elevation={0}
    sx={{
      p: 2.5,
      borderRadius: 3,
      display: 'flex',
      alignItems: 'center',
      gap: 2.5,
      bgcolor: bg,
      border: '1px solid',
      borderColor: 'divider',
      transition: 'all 0.2s',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 }
    }}
  >
    <Box
      sx={{
        width: 52,
        height: 52,
        borderRadius: 2.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.paper',
        color: color,
        boxShadow: 1
      }}
    >
      <Icon fontSize="medium" />
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" fontWeight={600} color="text.secondary" textTransform="uppercase">
        {title}
      </Typography>
      <Typography variant="h6" fontWeight={800} color="text.primary" noWrap>
        {area ? formatKMS(area) : subText}
      </Typography>
      {area && (
        <Typography variant="caption" color="text.secondary" noWrap>
          {formatAreaReadable(area)}
        </Typography>
      )}
    </Box>
  </Paper>
);

export default function LandExchangeViewer() {
  const [rows, setRows] = useState([]);
  const [mozas, setMozas] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [mozaFilter, setMozaFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Load mozas
  useEffect(() => {
    getMozas()
      .then((res) => {
        const raw = res.data?.data || res.data?.rows || res.data || [];
        setMozas(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setMozas([]));
  }, []);

  // Fetch exchanges
  const fetchExchanges = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await landAcquisitionExchangeService.getExchanges({
        search: searchTerm || undefined,
        moza: mozaFilter || undefined,
        page: page + 1,
        limit: rowsPerPage
      });
      setRows(res.data?.rows || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load land exchanges');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, mozaFilter, page, rowsPerPage]);

  useEffect(() => {
    fetchExchanges();
  }, [fetchExchanges]);

  // Aggregate KPI metrics for loaded rows
  const stats = React.useMemo(() => {
    const totalOut = addAreas(...rows.map((r) => r.totalOutArea));
    const totalIn = addAreas(...rows.map((r) => r.totalInArea));
    return {
      count: total,
      totalOut,
      totalIn
    };
  }, [rows, total]);

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await landAcquisitionExchangeService.deleteExchange(deleteConfirmId);
      toast.success('Land exchange record deleted successfully');
      setDeleteConfirmId(null);
      fetchExchanges();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete record');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = () => {
    if (!rows.length) {
      toast.error('No data to export');
      return;
    }
    const exportData = rows.map((r, idx) => ({
      'Sr #': idx + 1,
      'Exchange Ref': r.exchangeRef,
      'Date': formatDate(r.exchangeDate),
      'Counterparty': r.party?.name || '',
      'Party CNIC': r.party?.cnic || '',
      'Deal No': r.dealNo || '',
      'Registry No': r.registryNo || '',
      'Inteqal No': r.inteqalNo || '',
      'Out Land Area (K-M-S)': formatKMS(r.totalOutArea),
      'In Land Area (K-M-S)': formatKMS(r.totalInArea),
      'Net Variance (K-M-S)': formatKMS(r.netAreaDiff),
      'Net Status': r.netAreaDiff?.type || '',
      'Adjustment Amount': r.financialAdjustment?.amount || 0,
      'Adjustment Paid By': r.financialAdjustment?.paidBy || '',
      'Adjustment Status': r.financialAdjustment?.status || '',
      'Remarks': r.remarks || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Land Exchanges');
    XLSX.writeFile(wb, `Taj_Residencia_Land_Exchanges_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Box>
      {/* Top Metric Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Exchange Deals"
            subText={`${total} Deals`}
            icon={ExchangeIcon}
            color="#1976d2"
            bg="background.paper"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Out Land (Surrendered)"
            area={stats.totalOut}
            icon={OutIcon}
            color="#ed6c02"
            bg="background.paper"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total In Land (Acquired)"
            area={stats.totalIn}
            icon={InIcon}
            color="#2e7d32"
            bg="background.paper"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Mozas Involved"
            subText={`${mozas.length} Mozas`}
            icon={SwapIcon}
            color="#9c27b0"
            bg="background.paper"
          />
        </Grid>
      </Grid>

      {/* Main Table Toolbar & Controls */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2.5
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ md: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <ExchangeIcon color="primary" sx={{ fontSize: 28 }} />
              <Typography variant="h6" fontWeight={700}>
                Land Exchange Records
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Track surrendered registry land swapped with newly acquired khasra parcels.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder="Search ref, party, khasra..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                )
              }}
              sx={{ minWidth: 220 }}
            />

            <TextField
              select
              size="small"
              value={mozaFilter}
              onChange={(e) => {
                setMozaFilter(e.target.value);
                setPage(0);
              }}
              sx={{ minWidth: 160 }}
              displayEmpty
            >
              <MenuItem value="">All Mozas</MenuItem>
              {(Array.isArray(mozas) ? mozas : []).map((m) => (
                <MenuItem key={m._id} value={m._id}>
                  {m.name}
                </MenuItem>
              ))}
            </TextField>

            <Tooltip title="Refresh Data">
              <IconButton onClick={fetchExchanges} size="small" sx={{ border: '1px solid', borderColor: 'divider' }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Button
              variant="outlined"
              startIcon={<ExcelIcon />}
              onClick={handleExportExcel}
              sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Export
            </Button>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setSelectedId(null);
                setFormOpen(true);
              }}
              sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap', px: 2 }}
            >
              New Land Exchange
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Exchanges Data Table */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2.5,
          overflow: 'hidden'
        }}
      >
        <Table sx={{ minWidth: 850 }}>
          <TableHead sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Exchange Ref</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Counterparty</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Out Land (Surrendered)</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.5 }}>In Land (Acquired)</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Net Variance</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Financial Adj.</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                  <CircularProgress size={36} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Loading exchange records...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                  <Stack alignItems="center" spacing={1.5}>
                    <ExchangeIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.4 }} />
                    <Typography variant="subtitle1" fontWeight={600} color="text.secondary">
                      No Land Exchange records found
                    </Typography>
                    <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 420 }}>
                      Create a barter record to swap surrendered registry parcels with incoming acquired khasras.
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setSelectedId(null);
                        setFormOpen(true);
                      }}
                      sx={{ textTransform: 'none', mt: 1 }}
                    >
                      New Land Exchange
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const outS = (row.totalOutArea?.kanal || 0) * 180 + (row.totalOutArea?.marla || 0) * 9 + (row.totalOutArea?.sarsai || 0);
                const inS = (row.totalInArea?.kanal || 0) * 180 + (row.totalInArea?.marla || 0) * 9 + (row.totalInArea?.sarsai || 0);
                let netLabel = 'Balanced';
                let netColor = 'info';

                if (outS > 0 && inS === 0) {
                  netLabel = 'Pending In Land';
                  netColor = 'warning';
                } else if (inS > 0 && outS === 0) {
                  netLabel = 'Pending Out Land';
                  netColor = 'success';
                } else if (row.netAreaDiff?.type === 'IN_SURPLUS') {
                  netLabel = `+${formatKMS(row.netAreaDiff)} In`;
                  netColor = 'success';
                } else if (row.netAreaDiff?.type === 'OUT_SURPLUS') {
                  netLabel = `-${formatKMS(row.netAreaDiff)} Out`;
                  netColor = 'warning';
                }

                return (
                  <TableRow key={row._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight={700} color="primary.main">
                        {row.exchangeRef}
                      </Typography>
                      {row.dealNo && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Deal #{row.dealNo}
                        </Typography>
                      )}
                      {(row.registryNo || row.inteqalNo) && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {row.registryNo ? `Reg: ${row.registryNo}` : ''}
                          {row.registryNo && row.inteqalNo ? ' · ' : ''}
                          {row.inteqalNo ? `Int: ${row.inteqalNo}` : ''}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">{formatDate(row.exchangeDate)}</Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {row.party?.name || '—'}
                      </Typography>
                      {row.party?.cnic && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {row.party.cnic}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" fontWeight={700} color="warning.dark">
                        {formatKMS(row.totalOutArea)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {row.outLandLines?.length || 0} Khasra(s) surrendered
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" fontWeight={700} color="success.dark">
                        {formatKMS(row.totalInArea)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {row.inLandLines?.length || 0} Khasra(s) acquired
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={netLabel}
                        color={netColor}
                        size="small"
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>

                    <TableCell>
                      {row.financialAdjustment?.hasAdjustment ? (
                        <Chip
                          label={`PKR ${Number(row.financialAdjustment.amount || 0).toLocaleString()}`}
                          size="small"
                          variant="outlined"
                          color={row.financialAdjustment.status === 'Paid' ? 'success' : 'warning'}
                          sx={{ fontWeight: 600 }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>

                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            color="info"
                            onClick={() => {
                              setSelectedId(row._id);
                              setDetailOpen(true);
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Record">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                              setSelectedId(row._id);
                              setFormOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteConfirmId(row._id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>

      {/* Form Dialog */}
      <LandExchangeFormDialog
        open={formOpen}
        exchangeId={selectedId}
        onClose={() => {
          setFormOpen(false);
          setSelectedId(null);
        }}
        onSaved={fetchExchanges}
      />

      {/* Detail Dialog */}
      {detailOpen && (
        <LandExchangeDetailDialog
          open={detailOpen}
          exchangeId={selectedId}
          onClose={() => {
            setDetailOpen(false);
            setSelectedId(null);
          }}
          onEdit={(id) => {
            setDetailOpen(false);
            setSelectedId(id);
            setFormOpen(true);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
      >
        <DialogTitle>Delete Land Exchange Record?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this land exchange record? This will revert the deducted and added land allocations in the reports.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmId(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
