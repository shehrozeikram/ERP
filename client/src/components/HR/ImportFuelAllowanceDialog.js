import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Stack,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton
} from '@mui/material';
import {
  LocalGasStation as FuelIcon,
  CloudUpload as UploadIcon,
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import api from '../../services/api';

const fmt = (v) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(v || 0));

export default function ImportFuelAllowanceDialog({ open, onClose, onImportSuccess, currentMonth, currentYear }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select an Excel file to upload');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    if (currentMonth) formData.append('month', currentMonth);
    if (currentYear) formData.append('year', currentYear);

    try {
      const response = await api.post('/hr/employees/import-fuel-allowance', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data?.success) {
        setResult(response.data.data);
        if (onImportSuccess) onImportSuccess(response.data.data);
      } else {
        setError(response.data?.message || 'Failed to import Fuel Allowance');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setError('');
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <FuelIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>Import Fuel Allowance (Excel)</Typography>
          </Stack>
          <IconButton size="small" onClick={handleClose}><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!result ? (
          <Stack spacing={2.5}>
            <Typography variant="body2" color="text.secondary">
              Upload an Excel file containing employee IDs and Fuel Allowance amounts (e.g. <code>Fuel Allowance.xlsx</code>).
            </Typography>

            <Paper
              variant="outlined"
              sx={{
                p: 3,
                textAlign: 'center',
                borderStyle: 'dashed',
                borderColor: file ? 'primary.main' : 'divider',
                bgcolor: file ? 'rgba(25, 118, 210, 0.02)' : 'grey.50',
                borderRadius: 2
              }}
            >
              <UploadIcon sx={{ fontSize: 40, color: file ? 'primary.main' : 'text.secondary', mb: 1 }} />
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                {file ? file.name : 'Select or drag Fuel Allowance Excel file'}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Supports .xlsx and .xls formats (Columns: <strong>EMP ID Tovus</strong> / <strong>Fuel Allowance</strong>)
              </Typography>
              <Button
                variant={file ? "outlined" : "contained"}
                component="label"
                size="small"
                disabled={uploading}
              >
                {file ? 'Change File' : 'Browse File'}
                <input type="file" hidden accept=".xlsx, .xls" onChange={handleFileChange} />
              </Button>
            </Paper>

            <Alert severity="info" sx={{ py: 0.5, fontSize: '0.82rem' }}>
              ℹ️ <strong>Note:</strong> Matching employee Fuel Allowances will be updated directly. Payroll tax and breakdown calculations remain 100% untouched and will automatically compute from the updated allowances.
            </Alert>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Alert severity="success" icon={<SuccessIcon fontSize="inherit" />}>
              <Typography variant="subtitle2" fontWeight={700}>Import Complete!</Typography>
              Successfully updated Fuel Allowance for <strong>{result.updatedCount}</strong> employees.
            </Alert>

            {result.notFoundCount > 0 && (
              <Alert severity="warning" icon={<WarningIcon fontSize="inherit" />}>
                <strong>{result.notFoundCount}</strong> employee IDs in Excel were not found in the active database:
                <Typography variant="caption" display="block" sx={{ mt: 0.5, fontFamily: 'monospace' }}>
                  Unmatched IDs: {result.unmatchedList.join(', ')}
                </Typography>
              </Alert>
            )}

            <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 1 }}>Updated Employees Preview:</Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 220 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100' }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100' }}>EMP ID</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100' }}>Employee Name</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'grey.100' }}>Fuel Allowance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.updatedDetails.map((item, idx) => (
                    <TableRow key={item.employeeId}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{item.employeeId}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        {fmt(item.fuelAllowance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        {!result ? (
          <>
            <Button onClick={handleClose} disabled={uploading}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={!file || uploading}
              startIcon={uploading ? <CircularProgress size={16} /> : <UploadIcon />}
            >
              {uploading ? 'Processing...' : 'Upload & Apply'}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={handleClose}>Done</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
