import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
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
  CloudUpload as ImportIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  HomeWork as HomeWorkIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import houseInventoryService from '../../../services/houseInventoryService';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const ALL_AREAS_VALUE = 'all';

const EMPTY_SUMMARY = {
  totalItems: 0,
  totalQuantity: 0,
  itemsWithQuantity: 0,
  areaCount: 0
};

const EMPTY_FORM = {
  houseName: '',
  areaName: '',
  inventoryDate: '',
  description: '',
  quantityText: '',
  quantityValue: '',
  quantityUnit: '',
  notes: ''
};

const HouseInventoryDashboard = () => {
  const [sectionTab, setSectionTab] = useState('inventory');
  const [houses, setHouses] = useState([]);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [activeHouse, setActiveHouse] = useState('');
  const [activeArea, setActiveArea] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [viewSummary, setViewSummary] = useState(EMPTY_SUMMARY);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [dialog, setDialog] = useState({ open: false, mode: 'create', item: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [houseDialog, setHouseDialog] = useState({ open: false, mode: 'create', house: null });
  const [houseForm, setHouseForm] = useState({ name: '', address: '' });
  const isHouseDialogOpen = houseDialog.open;
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchHouses = useCallback(async () => {
    const response = await houseInventoryService.getHouses();
    const rows = response.data || [];
    setHouses(rows);
    if (!activeHouse && rows.length) {
      setActiveHouse(rows[0].houseName);
      setActiveArea(ALL_AREAS_VALUE);
    }
  }, [activeHouse]);

  const fetchItems = useCallback(async () => {
    if (!activeHouse) return;
    try {
      setItemsLoading(true);
      const response = await houseInventoryService.getItems({
        houseName: activeHouse,
        areaName: activeArea !== ALL_AREAS_VALUE ? activeArea : undefined,
        search: search || undefined,
        page: page + 1,
        limit: rowsPerPage
      });
      setItems(response.data || []);
      setTotalItems(response.pagination?.total || 0);
      setViewSummary(response.summary || EMPTY_SUMMARY);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load inventory items');
    } finally {
      setItemsLoading(false);
    }
  }, [activeHouse, activeArea, search, page, rowsPerPage]);

  const loadData = useCallback(async () => {
    try {
      setError('');
      await fetchHouses();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load houses inventory');
    }
  }, [fetchHouses]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handlePageChange = (_, newPage) => setPage(newPage);

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const resetPage = () => setPage(0);

  const currentHouse = useMemo(
    () => houses.find((h) => h.houseName === activeHouse) || null,
    [houses, activeHouse]
  );

  const areaOptions = useMemo(() => currentHouse?.areas?.map((a) => a.name) || [], [currentHouse]);

  const openCreate = () => {
    setDialog({ open: true, mode: 'create', item: null });
    setForm({
      ...EMPTY_FORM,
      houseName: activeHouse || '',
      areaName: activeArea !== ALL_AREAS_VALUE ? activeArea : (areaOptions[0] || '')
    });
  };

  const openEdit = (item) => {
    setDialog({ open: true, mode: 'edit', item });
    setForm({
      houseName: item.houseName || '',
      areaName: item.areaName || '',
      inventoryDate: item.inventoryDate ? new Date(item.inventoryDate).toISOString().slice(0, 10) : '',
      description: item.description || '',
      quantityText: item.quantityText || '',
      quantityValue: item.quantityValue ?? '',
      quantityUnit: item.quantityUnit || '',
      notes: item.notes || ''
    });
  };

  const closeDialog = () => {
    if (saving) return;
    setDialog({ open: false, mode: 'create', item: null });
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.houseName || !form.areaName || !form.description) {
      setError('House, area and description are required');
      return;
    }
    try {
      setSaving(true);
      setError('');
      const payload = {
        ...form,
        quantityValue: form.quantityValue === '' ? null : Number(form.quantityValue),
        inventoryDate: form.inventoryDate || null
      };
      if (dialog.mode === 'edit' && dialog.item?._id) {
        await houseInventoryService.updateItem(dialog.item._id, payload);
        setSuccess('Inventory item updated successfully');
      } else {
        await houseInventoryService.createItem(payload);
        setSuccess('Inventory item added successfully');
      }
      closeDialog();
      await fetchHouses();
      await fetchItems();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save inventory item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.description}"?`)) return;
    try {
      await houseInventoryService.deleteItem(item._id);
      setSuccess('Inventory item deleted successfully');
      await fetchHouses();
      await fetchItems();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete inventory item');
    }
  };

  const handleImport = async () => {
    if (!window.confirm('Import from docs/Houses Inventory.xlsx? This will replace all current house inventory items.')) return;
    try {
      setImporting(true);
      setError('');
      const response = await houseInventoryService.importFromWorkbook();
      setSuccess(`Imported ${response.data?.importedCount || 0} inventory rows from workbook`);
      await fetchHouses();
      await fetchItems();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to import workbook');
    } finally {
      setImporting(false);
    }
  };

  const openCreateHouse = () => {
    setHouseDialog({ open: true, mode: 'create', house: null });
    setHouseForm({ name: '', address: '' });
  };

  const openEditHouse = (house, event) => {
    event?.stopPropagation();
    setHouseDialog({ open: true, mode: 'edit', house });
    setHouseForm({
      name: house.houseName || '',
      address: house.address || ''
    });
  };

  const closeHouseDialog = () => {
    if (saving) return;
    setHouseDialog({ open: false, mode: 'create', house: null });
    setHouseForm({ name: '', address: '' });
  };

  const handleSaveHouse = async () => {
    const name = String(houseForm.name || '').trim();
    if (!name) {
      setError('House name is required');
      return;
    }
    try {
      setSaving(true);
      setError('');
      const payload = {
        name,
        address: String(houseForm.address || '').trim()
      };
      if (houseDialog.mode === 'edit' && houseDialog.house?._id) {
        await houseInventoryService.updateHouse(houseDialog.house._id, payload);
        setSuccess('House updated successfully');
        if (activeHouse === houseDialog.house.houseName && activeHouse !== name) {
          setActiveHouse(name);
        }
      } else {
        await houseInventoryService.createHouse(payload);
        setSuccess('House added successfully');
        setActiveHouse(name);
        setActiveArea(ALL_AREAS_VALUE);
      }
      closeHouseDialog();
      await fetchHouses();
      await fetchItems();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save house');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Houses Inventory</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage house-wise and area-wise inventory from the provided workbook
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button startIcon={<RefreshIcon />} onClick={loadData}>Refresh</Button>
          <Button variant="outlined" startIcon={<ImportIcon />} onClick={handleImport} disabled={importing}>
            Import Excel
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add Item
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Total Houses</Typography>
              <Typography variant="h4" fontWeight={800}>{houses.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Areas In Current House</Typography>
              <Typography variant="h4" fontWeight={800}>{areaOptions.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={sectionTab} onChange={(_, value) => setSectionTab(value)}>
          <Tab value="inventory" label="House Inventory" />
          <Tab value="houses" label="Houses" />
        </Tabs>
      </Paper>

      {sectionTab === 'houses' && (
        <>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateHouse}>
              Add House
            </Button>
          </Stack>
          <TableContainer component={Paper} sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>House Name</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell align="right">Areas</TableCell>
                  <TableCell align="right">Items</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {houses.map((house) => (
                  <TableRow
                    key={house.houseName}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSectionTab('inventory');
                      setActiveHouse(house.houseName);
                      setActiveArea(ALL_AREAS_VALUE);
                      resetPage();
                    }}
                  >
                    <TableCell>
                      <Typography fontWeight={600}>{house.houseName}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {house.address || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{house.areas?.length || 0}</TableCell>
                    <TableCell align="right">{house.itemCount || 0}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit house">
                        <IconButton size="small" onClick={(e) => openEditHouse(house, e)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {!houses.length && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      No houses found. Click Add House to start.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {sectionTab === 'inventory' && (
        <>
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={activeHouse}
          onChange={(_, value) => {
            setActiveHouse(value);
            setActiveArea(ALL_AREAS_VALUE);
            resetPage();
          }}
          variant="scrollable"
          scrollButtons="auto"
        >
          {houses.map((house) => (
            <Tab
              key={house.houseName}
              value={house.houseName}
              icon={<HomeWorkIcon fontSize="small" />}
              iconPosition="start"
              label={`${house.houseName} (${house.itemCount})`}
            />
          ))}
        </Tabs>
      </Paper>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          select
          label="Area"
          value={activeArea}
          onChange={(e) => {
            setActiveArea(e.target.value);
            resetPage();
          }}
          sx={{ minWidth: 260 }}
        >
          <MenuItem value={ALL_AREAS_VALUE}>All</MenuItem>
          {areaOptions.map((area) => (
            <MenuItem key={area} value={area}>{area}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Search inventory"
          placeholder="Description, quantity or notes"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
          sx={{ minWidth: 280 }}
        />
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary">Total Items (All Pages)</Typography>
              <Typography variant="h5" fontWeight={700}>{viewSummary.totalItems}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary">Total Quantity (All Pages)</Typography>
              <Typography variant="h5" fontWeight={700}>{viewSummary.totalQuantity}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary">Areas In View</Typography>
              <Typography variant="h5" fontWeight={700}>{viewSummary.areaCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary">Items With Quantity</Typography>
              <Typography variant="h5" fontWeight={700}>{viewSummary.itemsWithQuantity}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Sr.</TableCell>
              <TableCell>House</TableCell>
              <TableCell>Area</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Quantity Unit</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!itemsLoading && items.map((item) => (
              <TableRow key={item._id} hover>
                <TableCell>{item.serialNo ?? '—'}</TableCell>
                <TableCell>{item.houseName || '—'}</TableCell>
                <TableCell>{item.areaName || '—'}</TableCell>
                <TableCell>{item.inventoryDate ? new Date(item.inventoryDate).toLocaleDateString() : '—'}</TableCell>
                <TableCell>
                  <Typography fontWeight={600}>{item.description}</Typography>
                </TableCell>
                <TableCell>
                  {item.quantityValue != null
                    ? item.quantityValue
                    : (item.quantityText || '—')}
                </TableCell>
                <TableCell>{item.quantityUnit || '—'}</TableCell>
                <TableCell>{item.notes || '—'}</TableCell>
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
            {itemsLoading && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  Loading inventory items...
                </TableCell>
              </TableRow>
            )}
            {!itemsLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  No inventory items found for this tab.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={totalItems}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={PAGE_SIZE_OPTIONS}
        />
      </TableContainer>
        </>
      )}

      <Dialog open={dialog.open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog.mode === 'edit' ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="House"
              select
              value={form.houseName}
              onChange={(e) => setForm((prev) => ({ ...prev, houseName: e.target.value }))}
              required
            >
              {houses.map((house) => (
                <MenuItem key={house.houseName} value={house.houseName}>{house.houseName}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Area"
              value={form.areaName}
              onChange={(e) => setForm((prev) => ({ ...prev, areaName: e.target.value }))}
              required
            />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Date"
                  type="date"
                  value={form.inventoryDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, inventoryDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
            </Grid>
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              required
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Quantity (Text)"
                  value={form.quantityText}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantityText: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Quantity Value"
                  type="number"
                  value={form.quantityValue}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantityValue: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Quantity Unit"
                  value={form.quantityUnit}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantityUnit: e.target.value }))}
                  fullWidth
                />
              </Grid>
            </Grid>
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {dialog.mode === 'edit' ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isHouseDialogOpen} onClose={closeHouseDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{houseDialog.mode === 'edit' ? 'Edit House' : 'Add House'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="House Name"
              value={houseForm.name}
              onChange={(e) => setHouseForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <TextField
              label="Address (Optional)"
              value={houseForm.address}
              onChange={(e) => setHouseForm((prev) => ({ ...prev, address: e.target.value }))}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeHouseDialog} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveHouse} disabled={saving}>
            {houseDialog.mode === 'edit' ? 'Update' : 'Add House'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HouseInventoryDashboard;
