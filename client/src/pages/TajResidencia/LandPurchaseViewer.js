import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Payments as PaymentIcon,
  Search as SearchIcon,
  ShoppingCart as PurchaseIcon,
  SwapHoriz as TransferIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import landAcquisitionPurchaseService from '../../services/landAcquisitionPurchaseService';
import { getMozas } from '../../services/landAcquisitionMozaService';
import { formatAreaReadable } from '../../utils/landAreaUnits';
import LandPurchasePaymentDialog from '../../components/TajResidencia/LandPurchasePaymentDialog';
import LandTransferDialog from '../../components/TajResidencia/LandTransferDialog';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB');
};

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LandPurchaseViewer() {
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
  const [paymentDialog, setPaymentDialog] = useState({ open: false, purchaseId: null, purchaseNo: '' });
  const [transferDialog, setTransferDialog] = useState({ open: false, purchaseId: null, purchaseNo: '' });

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
      const res = await landAcquisitionPurchaseService.getPurchases({
        page: page + 1,
        limit: rowsPerPage,
        ...(searchDebounced && { search: searchDebounced }),
        ...(mozaFilter && { moza: mozaFilter })
      });
      const payload = res.data;
      setRows(payload?.purchases || []);
      setTotal(payload?.pagination?.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load land purchases');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchDebounced, mozaFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete land purchase ${row.purchaseNo}?`)) return;
    setDeletingId(row._id);
    try {
      await landAcquisitionPurchaseService.deletePurchase(row._id);
      toast.success('Land purchase deleted');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <PurchaseIcon color="primary" sx={{ fontSize: 36 }} />
          <Box>
            <Typography variant="h4" fontWeight={700}>Land Purchase</Typography>
            <Typography variant="body2" color="text.secondary">
              Create and view land purchase deals for Taj Residencia.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<TransferIcon />}
            onClick={() => navigate('/taj-residencia/land-transfers')}
          >
            Manage Transfers
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/taj-residencia/land-purchase/new')}
          >
            Create Land Purchase
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Purchase no, deal no, seller, dealer, moza..."
            sx={{ minWidth: 260 }}
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
              <TableCell sx={{ fontWeight: 700 }}>LAND PURCHASE NO.</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>DEAL NO.</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>PROJECT</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>SELLER NAME</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>DEALER NAME</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>CNIC</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>MOZA</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>SIZE</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">TOTAL LAND PRICE</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  No land purchases yet — click Create Land Purchase to add one.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => (
                <TableRow key={row._id} hover>
                  <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{row.purchaseNo}</TableCell>
                  <TableCell>{row.dealNo}</TableCell>
                  <TableCell>{row.project || '—'}</TableCell>
                  <TableCell>{row.seller?.name || '—'}</TableCell>
                  <TableCell>{row.dealer?.name || '—'}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.seller?.cnic || '—'}</TableCell>
                  <TableCell>{row.moza?.name || '—'}</TableCell>
                  <TableCell>{formatAreaReadable(row.totalArea)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatMoney(row.agreedAmount)}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Land Transfer">
                      <IconButton
                        size="small"
                        color="secondary"
                        onClick={() => setTransferDialog({
                          open: true,
                          purchaseId: row._id,
                          purchaseNo: row.purchaseNo
                        })}
                      >
                        <TransferIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        color="info"
                        onClick={() => navigate(`/taj-residencia/land-purchase/${row._id}`)}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Payment Information">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => setPaymentDialog({
                          open: true,
                          purchaseId: row._id,
                          purchaseNo: row.purchaseNo
                        })}
                      >
                        <PaymentIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/taj-residencia/land-purchase/${row._id}/edit`)}
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

      <LandPurchasePaymentDialog
        open={paymentDialog.open}
        purchaseId={paymentDialog.purchaseId}
        purchaseNo={paymentDialog.purchaseNo}
        onClose={() => setPaymentDialog({ open: false, purchaseId: null, purchaseNo: '' })}
        onSaved={load}
      />

      <LandTransferDialog
        open={transferDialog.open}
        purchaseId={transferDialog.purchaseId}
        onClose={() => setTransferDialog({ open: false, purchaseId: null, purchaseNo: '' })}
        onSaved={load}
      />
    </Box>
  );
}
