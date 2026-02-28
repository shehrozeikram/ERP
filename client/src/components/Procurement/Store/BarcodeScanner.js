import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box, TextField, InputAdornment, IconButton, Tooltip,
  CircularProgress, Alert, Chip, Typography
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ClearIcon from '@mui/icons-material/Clear';
import storeService from '../../../services/storeService';

/**
 * BarcodeScanner
 * Reusable barcode input component. Handles both keyboard scanners (fast typing)
 * and manual barcode entry.
 *
 * Props:
 *  - onItemFound (fn)  – called with the full inventory item object when found
 *  - onError (fn)      – called with an error message string
 *  - disabled (bool)
 *  - placeholder (string)
 *  - autoFocus (bool)  – auto-focus the input (good for scanner mode)
 *  - label (string)
 */
const BarcodeScanner = ({
  onItemFound,
  onError,
  disabled = false,
  placeholder = 'Scan or type barcode...',
  autoFocus = false,
  label = 'Barcode Scanner'
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastFound, setLastFound] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);
  const scanTimerRef = useRef(null);

  // Barcode scanners typically input characters very quickly (< 50ms between chars)
  // and end with Enter key. We handle both auto-submit on Enter and manual button.

  const handleLookup = useCallback(async (barcode) => {
    const trimmed = (barcode || '').trim();
    if (!trimmed) return;

    setLoading(true);
    setErrorMsg('');
    setLastFound(null);

    try {
      const res = await storeService.lookupBarcode(trimmed);
      if (res.success && res.data) {
        setLastFound(res.data);
        if (onItemFound) onItemFound(res.data);
        setBarcodeInput('');
      } else {
        const msg = 'No item found with this barcode';
        setErrorMsg(msg);
        if (onError) onError(msg);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Barcode lookup failed';
      setErrorMsg(msg);
      if (onError) onError(msg);
    } finally {
      setLoading(false);
    }
  }, [onItemFound, onError]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(scanTimerRef.current);
      handleLookup(barcodeInput);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setBarcodeInput(val);
    setErrorMsg('');
    setLastFound(null);

    // Auto-submit after brief idle (handles scanners that don't send Enter)
    clearTimeout(scanTimerRef.current);
    if (val.length >= 8) {
      scanTimerRef.current = setTimeout(() => handleLookup(val), 300);
    }
  };

  const handleClear = () => {
    setBarcodeInput('');
    setErrorMsg('');
    setLastFound(null);
    if (inputRef.current) inputRef.current.focus();
  };

  useEffect(() => {
    return () => clearTimeout(scanTimerRef.current);
  }, []);

  return (
    <Box>
      <TextField
        inputRef={inputRef}
        fullWidth
        size="small"
        label={label}
        placeholder={placeholder}
        value={barcodeInput}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled || loading}
        autoFocus={autoFocus}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {loading
                ? <CircularProgress size={18} />
                : <QrCodeScannerIcon color="action" />
              }
            </InputAdornment>
          ),
          endAdornment: barcodeInput ? (
            <InputAdornment position="end">
              <Tooltip title="Clear">
                <IconButton size="small" onClick={handleClear}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Lookup (or press Enter)">
                <IconButton size="small" onClick={() => handleLookup(barcodeInput)} disabled={loading}>
                  <QrCodeScannerIcon fontSize="small" color="primary" />
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ) : null
        }}
        helperText="Press Enter or wait — scanner will auto-submit"
      />

      {/* Success chip */}
      {lastFound && (
        <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleOutlineIcon fontSize="small" color="success" />
          <Typography variant="caption" color="success.main">
            Found: <strong>{lastFound.name}</strong> ({lastFound.itemCode}) — Qty: {lastFound.quantity} {lastFound.unit}
          </Typography>
        </Box>
      )}

      {/* Error message */}
      {errorMsg && (
        <Alert severity="warning" sx={{ mt: 0.5, py: 0.25, px: 1 }} icon={false}>
          <Typography variant="caption">{errorMsg}</Typography>
        </Alert>
      )}
    </Box>
  );
};

export default BarcodeScanner;
