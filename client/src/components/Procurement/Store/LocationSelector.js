import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, FormControl, InputLabel, Select, MenuItem,
  CircularProgress, Typography, Stack
} from '@mui/material';
import storeService from '../../../services/storeService';

/**
 * LocationSelector
 * Reusable component for selecting Sub-Store → Rack → Shelf → Bin.
 *
 * Props:
 *  - mainStoreId (string)   – ObjectId of the parent/main store (filters sub-stores)
 *  - value (object)         – { subStore, rack, shelf, bin }
 *  - onChange (fn)          – called with updated { subStore, rack, shelf, bin }
 *  - disabled (bool)
 *  - required (bool)
 *  - size ('small'|'medium')
 */
const LocationSelector = ({
  mainStoreId,
  value = {},
  onChange,
  disabled = false,
  required = false,
  size = 'small'
}) => {
  const [subStores, setSubStores] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const selected = {
    subStore: value.subStore || '',
    rack: value.rack || '',
    shelf: value.shelf || '',
    bin: value.bin || ''
  };

  // Fetch sub-stores when mainStoreId changes
  useEffect(() => {
    if (!mainStoreId) {
      setSubStores([]);
      return;
    }
    setLoadingStores(true);
    storeService.getSubStores(mainStoreId)
      .then(res => setSubStores(res.data || []))
      .catch(() => setSubStores([]))
      .finally(() => setLoadingStores(false));
  }, [mainStoreId]);

  // Fetch flat locations when sub-store changes
  const fetchLocations = useCallback((subStoreId) => {
    if (!subStoreId) {
      setLocations([]);
      return;
    }
    setLoadingLocations(true);
    storeService.getLocations(subStoreId)
      .then(res => setLocations(res.data || []))
      .catch(() => setLocations([]))
      .finally(() => setLoadingLocations(false));
  }, []);

  useEffect(() => {
    fetchLocations(selected.subStore);
  }, [selected.subStore, fetchLocations]);

  const handleChange = (field, newVal) => {
    const updated = { ...selected, [field]: newVal };
    // Reset downstream fields when a parent field changes
    if (field === 'subStore') {
      updated.rack = '';
      updated.shelf = '';
      updated.bin = '';
    } else if (field === 'rack') {
      updated.shelf = '';
      updated.bin = '';
    } else if (field === 'shelf') {
      updated.bin = '';
    }
    if (onChange) onChange(updated);
  };

  // Derive unique racks/shelves/bins from flat location list
  const racks = [...new Set(locations.map(l => l.rack).filter(Boolean))];
  const shelves = [...new Set(
    locations.filter(l => l.rack === selected.rack).map(l => l.shelf).filter(Boolean)
  )];
  const bins = [...new Set(
    locations.filter(l => l.rack === selected.rack && l.shelf === selected.shelf)
      .map(l => l.bin).filter(Boolean)
  )];

  return (
    <Stack spacing={1.5}>
      {/* Sub-Store */}
      <FormControl fullWidth size={size} required={required} disabled={disabled || loadingStores || !mainStoreId}>
        <InputLabel>Sub-Store</InputLabel>
        <Select
          value={selected.subStore}
          label="Sub-Store"
          onChange={e => handleChange('subStore', e.target.value)}
        >
          <MenuItem value=""><em>— Select Sub-Store —</em></MenuItem>
          {loadingStores
            ? <MenuItem disabled><CircularProgress size={16} sx={{ mr: 1 }} />Loading...</MenuItem>
            : subStores.map(s => (
              <MenuItem key={s._id} value={s._id}>{s.name} ({s.code})</MenuItem>
            ))
          }
        </Select>
      </FormControl>

      {/* Rack */}
      <FormControl fullWidth size={size} disabled={disabled || loadingLocations || !selected.subStore}>
        <InputLabel>Rack</InputLabel>
        <Select
          value={selected.rack}
          label="Rack"
          onChange={e => handleChange('rack', e.target.value)}
        >
          <MenuItem value=""><em>— Select Rack —</em></MenuItem>
          {loadingLocations
            ? <MenuItem disabled><CircularProgress size={16} sx={{ mr: 1 }} />Loading...</MenuItem>
            : racks.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)
          }
        </Select>
      </FormControl>

      {/* Shelf */}
      <FormControl fullWidth size={size} disabled={disabled || !selected.rack}>
        <InputLabel>Shelf</InputLabel>
        <Select
          value={selected.shelf}
          label="Shelf"
          onChange={e => handleChange('shelf', e.target.value)}
        >
          <MenuItem value=""><em>— Select Shelf —</em></MenuItem>
          {shelves.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </Select>
      </FormControl>

      {/* Bin */}
      <FormControl fullWidth size={size} disabled={disabled || !selected.shelf}>
        <InputLabel>Bin</InputLabel>
        <Select
          value={selected.bin}
          label="Bin"
          onChange={e => handleChange('bin', e.target.value)}
        >
          <MenuItem value=""><em>— Select Bin —</em></MenuItem>
          {bins.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
        </Select>
      </FormControl>

      {/* Location summary */}
      {(selected.rack || selected.shelf || selected.bin) && (
        <Typography variant="caption" color="text.secondary">
          Location: {[selected.rack, selected.shelf, selected.bin].filter(Boolean).join(' / ')}
        </Typography>
      )}
    </Stack>
  );
};

export default LocationSelector;
