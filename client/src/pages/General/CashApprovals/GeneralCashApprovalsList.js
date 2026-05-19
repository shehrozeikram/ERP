import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import { Add as AddIcon, Visibility as ViewIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import generalCashApprovalService from '../../../services/generalCashApprovalService';
import { formatPKR } from '../../../utils/currency';
import { formatDate } from '../../../utils/dateUtils';

const statusColor = (status) => {
  if (status === 'Draft') return 'default';
  if (status === 'Pending Approval') return 'warning';
  if (status === 'Pending Audit' || status === 'Forwarded to Audit Director') return 'info';
  if (['Completed', 'Advance Issued', 'Payment Settled'].includes(status)) return 'success';
  if (['Rejected', 'Cancelled'].includes(status)) return 'error';
  return 'default';
};

const GeneralCashApprovalsList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await generalCashApprovalService.list({
        search,
        mine: ['super_admin', 'admin'].includes(user?.role) ? '' : 'true',
        limit: 200
      });
      setRows(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load cash approvals');
    } finally {
      setLoading(false);
    }
  }, [search, user?.role]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={600}>Cash Approvals</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            General module cash advance requests with line items and Manager / HOD approval.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/general/cash-approvals/create')}>
          New cash approval
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            placeholder="Search CA number, purpose, department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 280 }}
          />
          <Tooltip title="Refresh">
            <IconButton onClick={load}><RefreshIcon /></IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>CA #</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Purpose</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Dept. approval</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No cash approvals yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row._id} hover>
                    <TableCell>{row.caNumber}</TableCell>
                    <TableCell>{row.requestingDepartment || '—'}</TableCell>
                    <TableCell sx={{ maxWidth: 240 }}>{row.purpose}</TableCell>
                    <TableCell align="right">{formatPKR(row.totalAmount)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={row.departmentApprovalStatus || '—'} variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={row.status} color={statusColor(row.status)} />
                    </TableCell>
                    <TableCell>{formatDate(row.approvalDate || row.createdAt)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="View">
                        <IconButton size="small" onClick={() => navigate(`/general/cash-approvals/${row._id}`)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default GeneralCashApprovalsList;
