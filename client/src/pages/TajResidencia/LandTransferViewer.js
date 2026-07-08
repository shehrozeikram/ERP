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
import {
  CheckCircle as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  SwapHoriz as TransferIcon,
  Payment as PaymentIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import landAcquisitionTransferService from '../../services/landAcquisitionTransferService';
import { getMozas } from '../../services/landAcquisitionMozaService';
import { formatAreaReadable } from '../../utils/landAreaUnits';
import LandTransferDialog from '../../components/TajResidencia/LandTransferDialog';
import TransferPaymentDialog from '../../components/TajResidencia/TransferPaymentDialog';
import TransferDetailDialog from '../../components/TajResidencia/TransferDetailDialog';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LandTransferViewer() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [mozas, setMozas] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [mozaFilter, setMozaFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [closingId, setClosingId] = useState(null);
  const [editDialog, setEditDialog] = useState({ open: false, transferId: null, purchaseId: null });
  const [paymentDialog, setPaymentDialog] = useState({ open: false, transferId: null });
  const [detailDialog, setDetailDialog] = useState({ open: false, transferId: null });

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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await landAcquisitionTransferService.getTransfers({
        page: page + 1,
        limit: rowsPerPage,
        ...(searchDebounced && { search: searchDebounced }),
        ...(mozaFilter && { moza: mozaFilter })
      });
      const payload = res.data;
      setRows(payload?.transfers || []);
      setTotal(payload?.pagination?.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load land transfers');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchDebounced, mozaFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete transfer ${row.referenceNo}?`)) return;
    setDeletingId(row._id);
    try {
      await landAcquisitionTransferService.deleteTransfer(row._id);
      toast.success('Land transfer deleted');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCloseTransfer = async (row) => {
    if (!window.confirm(`Close transfer ${row.referenceNo}?`)) return;
    setClosingId(row._id);
    try {
      await landAcquisitionTransferService.closeTransfer(row._id);
      toast.success('Land transfer closed');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to close transfer');
    } finally {
      setClosingId(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TransferIcon color="primary" sx={{ fontSize: 36 }} />
          <Box>
            <Typography variant="h4" fontWeight={700}>Manage Transfers</Typography>
            <Typography variant="body2" color="text.secondary">
              View and manage land transfers linked to land purchases.
            </Typography>
          </Box>
        </Stack>
        <Button
          variant="contained"
          startIcon={<TransferIcon />}
          onClick={() => setEditDialog({ open: true, transferId: null, purchaseId: null })}
        >
          Create Land Transfer
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Reference, transfer no, purchase, moza..."
            sx={{ minWidth: 280 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
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
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All mozas</MenuItem>
            {mozas.map((m) => (
              <MenuItem key={m._id} value={m._id}>{m.name}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Reference No.</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Land Transfer No.</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Deal No.</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Land Purchase No.</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Seller</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Purchaser</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Inteqal #</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Registry #</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Transfer Moza</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Size</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Transfer Charges</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Payment Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Created At</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={16} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={16} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  No land transfers yet — create one from a land purchase record.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => (
                <TableRow key={row._id} hover>
                  <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="text"
                      sx={{ fontFamily: 'monospace', fontWeight: 700, p: 0, minWidth: 0 }}
                      onClick={() => setEditDialog({ open: true, transferId: row._id, purchaseId: null })}
                    >
                      {row.referenceNo}
                    </Button>
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.transferNo}</TableCell>
                  <TableCell>{row.dealNo}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{row.purchaseNo}</TableCell>
                  <TableCell>{row.seller?.name || '—'}</TableCell>
                  <TableCell>{row.purchaser?.name || '—'}</TableCell>
                  <TableCell>{row.intiqalNo || '—'}</TableCell>
                  <TableCell>{row.registryNo || '—'}</TableCell>
                  <TableCell>{row.moza?.name || '—'}</TableCell>
                  <TableCell>{formatAreaReadable(row.transferArea)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: 'warning.dark' }}>
                    {formatMoney(row.totalTransferPayments)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={row.status === 'Closed' ? 'Close' : row.status}
                      size="small"
                      color={row.status === 'Closed' ? 'default' : 'warning'}
                      variant={row.status === 'Closed' ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={row.paymentStatus || 'Pending'}
                      size="small"
                      color={
                        row.paymentStatus === 'Paid' ? 'success'
                          : row.paymentStatus === 'Partial Paid' ? 'warning'
                          : 'error'
                      }
                      variant="outlined"
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell>{formatDate(row.createdAt)}</TableCell>
                  <TableCell align="right">
                    {row.status !== 'Closed' && (
                      <Tooltip title="Close transfer">
                        <IconButton
                          size="small"
                          color="success"
                          disabled={closingId === row._id}
                          onClick={() => handleCloseTransfer(row)}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {row.status !== 'Closed' && (
                      <Tooltip title="Pay Transfer">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => setPaymentDialog({ open: true, transferId: row._id })}
                        >
                          <PaymentIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        color="info"
                        onClick={() => setDetailDialog({ open: true, transferId: row._id })}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => setEditDialog({ open: true, transferId: row._id, purchaseId: null })}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        disabled={deletingId === row._id}
                        onClick={() => handleDelete(row)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, next) => setPage(next)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>

      <LandTransferDialog
        open={editDialog.open}
        transferId={editDialog.transferId}
        purchaseId={editDialog.purchaseId}
        onClose={() => setEditDialog({ open: false, transferId: null, purchaseId: null })}
        onSaved={load}
      />

      <TransferPaymentDialog
        open={paymentDialog.open}
        transferId={paymentDialog.transferId}
        onClose={() => setPaymentDialog({ open: false, transferId: null })}
        onSaved={load}
      />
      <TransferDetailDialog
        open={detailDialog.open}
        transferId={detailDialog.transferId}
        onClose={() => setDetailDialog({ open: false, transferId: null })}
      />
    </Box>
  );
}
