import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  MenuItem,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Visibility as ViewIcon, ReceiptLong as VoucherIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import { formatPKR } from '../../utils/currency';

const Vouchers = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('posted');
  const [clearanceDialog, setClearanceDialog] = useState({ open: false, voucher: null, status: 'pending' });

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('limit', '200');
      if (status) params.append('status', status);
      if (search.trim()) params.append('search', search.trim());
      const res = await api.get(`/finance/journal-entries?${params.toString()}`);
      setEntries(res?.data?.data?.entries || []);
    } catch (_e) {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const voucherRows = useMemo(() => {
    return entries.map((entry) => ({
      ...entry,
      voucherType: String(entry?.referenceType || 'manual').toUpperCase()
    }));
  }, [entries]);

  const openClearanceDialog = (voucher) => {
    setClearanceDialog({
      open: true,
      voucher,
      status: voucher?.clearanceStatus || 'pending'
    });
  };

  const saveClearance = async () => {
    if (!clearanceDialog.voucher?._id) return;
    const nextStatus = clearanceDialog.status || 'pending';
    const res = await api.put(`/finance/journal-entries/${clearanceDialog.voucher._id}/clearance`, {
      clearanceStatus: nextStatus,
      clearanceRemarks: '',
      clearedAt: nextStatus === 'cleared' ? new Date().toISOString() : null
    });
    const updated = res?.data?.data;
    setEntries((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
    setClearanceDialog({ open: false, voucher: null, status: 'pending' });
  };

  const saveSignedDocumentStatus = async (voucherId, nextStatus) => {
    if (!voucherId) return;
    const res = await api.put(`/finance/journal-entries/${voucherId}/signed-document`, {
      signedDocumentStatus: nextStatus
    });
    const updated = res?.data?.data;
    if (!updated?._id) return;
    setEntries((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <VoucherIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>Vouchers</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          All finance vouchers are listed here. Open any voucher to view/print full voucher document.
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <TextField
              fullWidth
              size="small"
              label="Search Voucher"
              placeholder="Entry number / reference / description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              size="small"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="posted">Posted</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="reversed">Reversed</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={fetchEntries}>Apply</Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Voucher No</TableCell>
                <TableCell>Voucher Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Signed Document</TableCell>
                <TableCell>Signed Date</TableCell>
                <TableCell>Clearance</TableCell>
                <TableCell>Clearance Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={12} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : voucherRows.length === 0 ? (
                <TableRow><TableCell colSpan={12} align="center">No vouchers found</TableCell></TableRow>
              ) : voucherRows.map((row) => (
                <TableRow key={row._id} hover>
                  <TableCell>{formatDate(row.date)}</TableCell>
                  <TableCell>{row.entryNumber}</TableCell>
                  <TableCell>{row.voucherType}</TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell align="right">{formatPKR(row.totalDebits || 0)}</TableCell>
                  <TableCell>{row.reference || '—'}</TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={row.signedDocumentStatus === 'signed' ? 'signed' : 'not_signed'}
                      onChange={(e) => saveSignedDocumentStatus(row._id, e.target.value)}
                      sx={{ minWidth: 130 }}
                    >
                      <MenuItem value="signed">Signed</MenuItem>
                      <MenuItem value="not_signed">Not Signed</MenuItem>
                    </TextField>
                  </TableCell>
                  <TableCell>{row.signedDocumentAt ? formatDate(row.signedDocumentAt) : '—'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.clearanceStatus === 'cleared' ? 'Cleared' : 'Pending'}
                      color={row.clearanceStatus === 'cleared' ? 'success' : 'warning'}
                      variant={row.clearanceStatus === 'cleared' ? 'filled' : 'outlined'}
                      onClick={() => openClearanceDialog(row)}
                    />
                  </TableCell>
                  <TableCell>{row.clearedAt ? formatDate(row.clearedAt) : '—'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={String(row.status || '').toUpperCase()}
                      color={row.status === 'posted' ? 'success' : row.status === 'draft' ? 'warning' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View Voucher">
                      <IconButton size="small" onClick={() => navigate(`/finance/vouchers/${row._id}`)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog
        open={clearanceDialog.open}
        onClose={() => setClearanceDialog({ open: false, voucher: null, status: 'pending' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Clearance — {clearanceDialog.voucher?.entryNumber}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                size="small"
                label="Clearance Status"
                value={clearanceDialog.status}
                onChange={(e) => setClearanceDialog((d) => ({ ...d, status: e.target.value }))}
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="cleared">Cleared</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearanceDialog({ open: false, voucher: null, status: 'pending' })}>Cancel</Button>
          <Button variant="contained" onClick={saveClearance}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Vouchers;

