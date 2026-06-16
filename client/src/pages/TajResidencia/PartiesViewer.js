import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
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
  Search as SearchIcon
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import landAcquisitionPartyService from '../../services/landAcquisitionPartyService';

const BASE_PATH = '/taj-residencia/land-acquisition/parties';
const PAGE_SIZE_OPTIONS = [10, 25, 50];

export const PARTY_TABS = [
  { type: 'seller', label: 'Sellers', path: `${BASE_PATH}/sellers` },
  { type: 'buyer', label: 'Buyers', path: `${BASE_PATH}/buyers` },
  { type: 'dealer', label: 'Dealers', path: `${BASE_PATH}/dealers` }
];

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  name: '',
  cnic: '',
  phoneNumber: '',
  partyDate: todayInputValue()
};

const PartiesViewer = () => {
  const location = useLocation();

  const activeTab = useMemo(() => {
    const index = PARTY_TABS.findIndex((tab) => location.pathname.startsWith(tab.path));
    return index >= 0 ? index : 0;
  }, [location.pathname]);

  const activeParty = PARTY_TABS[activeTab];

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState({ open: false, mode: 'create', item: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchParties = useCallback(async () => {
    try {
      setLoading(true);
      const response = await landAcquisitionPartyService.getParties({
        type: activeParty.type,
        search: search || undefined,
        page: page + 1,
        limit: rowsPerPage
      });
      setItems(response.data || []);
      setTotalItems(response.pagination?.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load parties');
    } finally {
      setLoading(false);
    }
  }, [activeParty.type, search, page, rowsPerPage]);

  useEffect(() => {
    setPage(0);
    setSearch('');
  }, [activeParty.type]);

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  const resetPage = () => setPage(0);

  const openCreate = () => {
    setDialog({ open: true, mode: 'create', item: null });
    setForm({ ...EMPTY_FORM, partyDate: todayInputValue() });
  };

  const openEdit = (item) => {
    setDialog({ open: true, mode: 'edit', item });
    setForm({
      name: item.name || '',
      cnic: item.cnic || '',
      phoneNumber: item.phoneNumber || '',
      partyDate: item.partyDate ? new Date(item.partyDate).toISOString().slice(0, 10) : ''
    });
  };

  const closeDialog = () => {
    if (saving) return;
    setDialog({ open: false, mode: 'create', item: null });
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.cnic.trim() || !form.phoneNumber.trim() || !form.partyDate) {
      toast.error('Name, CNIC, phone number, and date are required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        partyType: activeParty.type,
        name: form.name.trim(),
        cnic: form.cnic.trim(),
        phoneNumber: form.phoneNumber.trim(),
        partyDate: form.partyDate
      };

      if (dialog.mode === 'edit' && dialog.item?._id) {
        await landAcquisitionPartyService.updateParty(dialog.item._id, payload);
        toast.success(`${activeParty.label.slice(0, -1)} updated successfully`);
      } else {
        await landAcquisitionPartyService.createParty(payload);
        toast.success(`${activeParty.label.slice(0, -1)} registered successfully`);
      }

      closeDialog();
      await fetchParties();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save party');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await landAcquisitionPartyService.deleteParty(item._id);
      toast.success('Party deleted successfully');
      await fetchParties();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete party');
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <TextField
          label={`Search ${activeParty.label.toLowerCase()}`}
          placeholder="Name, CNIC, or phone"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
          sx={{ minWidth: 280 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add {activeParty.label.slice(0, -1)}
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Register {activeParty.label.toLowerCase()} with name, CNIC, phone number, and date for use in land acquisition records.
      </Alert>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>CNIC</TableCell>
              <TableCell>Phone Number</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && items.map((item) => (
              <TableRow key={item._id} hover>
                <TableCell>
                  {item.partyDate ? new Date(item.partyDate).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell>
                  <Typography fontWeight={600}>{item.name}</Typography>
                </TableCell>
                <TableCell>{item.cnic || '—'}</TableCell>
                <TableCell>{item.phoneNumber || '—'}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(item)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDelete(item)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {loading && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  Loading {activeParty.label.toLowerCase()}...
                </TableCell>
              </TableRow>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  No {activeParty.label.toLowerCase()} registered yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={totalItems}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={PAGE_SIZE_OPTIONS}
        />
      </TableContainer>

      <Dialog open={dialog.open} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>
          {dialog.mode === 'edit' ? `Edit ${activeParty.label.slice(0, -1)}` : `Add ${activeParty.label.slice(0, -1)}`}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="Date"
              type="date"
              value={form.partyDate}
              onChange={(e) => setForm((prev) => ({ ...prev, partyDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              required
              fullWidth
            />
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="CNIC"
              value={form.cnic}
              onChange={(e) => setForm((prev) => ({ ...prev, cnic: e.target.value }))}
              placeholder="12345-1234567-1"
              required
              fullWidth
            />
            <TextField
              label="Phone Number"
              value={form.phoneNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
              placeholder="03xx-xxxxxxx"
              required
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {dialog.mode === 'edit' ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PartiesViewer;
