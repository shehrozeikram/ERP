import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  CircularProgress,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Snackbar
} from '@mui/material';
import { Assignment as AssignmentIcon, Search as SearchIcon } from '@mui/icons-material';
import { usePagination } from '../../../hooks/usePagination';
import TablePaginationWrapper from '../../../components/TablePaginationWrapper';
import { fetchRecoveryAssignments, fetchRecoveryAssignmentStats } from '../../../services/recoveryAssignmentService';

const formatCurrency = (val) => {
  const n = Number(val);
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-PK', { minimumFractionDigits: 0 });
};

const formatDate = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
};

const COLUMNS = [
  { id: 'orderCode', label: 'Order Code', minWidth: 90 },
  { id: 'customerName', label: 'Customer Name', minWidth: 140 },
  { id: 'bookingDate', label: 'Booking Date', minWidth: 110, format: formatDate },
  { id: 'sector', label: 'Sector', minWidth: 100 },
  { id: 'size', label: 'Size', minWidth: 80 },
  { id: 'cnic', label: 'CNIC', minWidth: 130 },
  { id: 'mobileNumber', label: 'Mobile', minWidth: 110 },
  { id: 'customerAddress', label: 'Address', minWidth: 180 },
  { id: 'nextOfKinCNIC', label: 'Next of Kin CNIC', minWidth: 130 },
  { id: 'plotNo', label: 'Plot No.', minWidth: 80 },
  { id: 'status', label: 'Status', minWidth: 90 },
  { id: 'salePrice', label: 'Sale Price', minWidth: 110, align: 'right', format: formatCurrency },
  { id: 'received', label: 'Received', minWidth: 110, align: 'right', format: formatCurrency },
  { id: 'currentlyDue', label: 'Currently Due', minWidth: 120, align: 'right', format: formatCurrency }
];

const RecoveryAssignments = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, sectors: [], statuses: [] });
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const pagination = usePagination({
    defaultRowsPerPage: 50,
    resetDependencies: [searchDebounced, sectorFilter, statusFilter]
  });

  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        ...pagination.getApiParams(),
        ...(searchDebounced.trim() && { search: searchDebounced.trim() }),
        ...(sectorFilter && { sector: sectorFilter }),
        ...(statusFilter && { status: statusFilter })
      };
      const res = await fetchRecoveryAssignments(params);
      const data = res.data?.data || [];
      const pag = res.data?.pagination || {};
      setRecords(Array.isArray(data) ? data : []);
      pagination.setTotal(pag.total || 0);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to load recovery assignments',
        severity: 'error'
      });
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [searchDebounced, sectorFilter, statusFilter, pagination.page, pagination.rowsPerPage]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchRecoveryAssignmentStats();
      const d = res.data?.data || {};
      setStats({ total: d.total || 0, sectors: d.sectors || [], statuses: d.statuses || [] });
    } catch {
      setStats({ total: 0, sectors: [], statuses: [] });
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSearchChange = (e) => setSearch(e.target.value);
  const handleSectorChange = (e) => setSectorFilter(e.target.value || '');
  const handleStatusChange = (e) => setStatusFilter(e.target.value || '');

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <AssignmentIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" fontWeight={600}>
          Recovery Assignments
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search order, customer, CNIC, plot..."
              value={search}
              onChange={handleSearchChange}
              sx={{ minWidth: 260 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                )
              }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Sector</InputLabel>
              <Select value={sectorFilter} onChange={handleSectorChange} label="Sector">
                <MenuItem value="">All</MenuItem>
                {stats.sectors.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} onChange={handleStatusChange} label="Status">
                <MenuItem value="">All</MenuItem>
                {stats.statuses.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Chip label={`Total: ${stats.total.toLocaleString()}`} color="primary" variant="outlined" />
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : records.length === 0 ? (
            <Alert severity="info">No recovery assignments found. Run the import script to load data.</Alert>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 'calc(100vh - 320px)', minHeight: 500, overflowX: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {COLUMNS.map((col) => (
                        <TableCell
                          key={col.id}
                          sx={{ minWidth: col.minWidth, fontWeight: 600, bgcolor: 'grey.50' }}
                          align={col.align}
                        >
                          {col.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.map((row) => (
                      <TableRow key={row._id} hover>
                        {COLUMNS.map((col) => (
                          <TableCell key={col.id} sx={{ minWidth: col.minWidth }} align={col.align}>
                            {col.format ? col.format(row[col.id]) : (row[col.id] || '—')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePaginationWrapper
                page={pagination.page}
                rowsPerPage={pagination.rowsPerPage}
                total={pagination.total}
                onPageChange={pagination.handleChangePage}
                onRowsPerPageChange={pagination.handleChangeRowsPerPage}
                rowsPerPageOptions={[25, 50, 100, 200]}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RecoveryAssignments;
