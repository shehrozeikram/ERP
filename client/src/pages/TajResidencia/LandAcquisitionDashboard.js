import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import {
  FileDownload as ExcelIcon,
  PictureAsPdf as PdfIcon,
  Refresh as RefreshIcon,
  AccountBalanceWallet as PurchaseIcon,
  Key as PossessionIcon,
  Timer as PendingIcon
} from '@mui/icons-material';
import landAcquisitionTransferService from '../../services/landAcquisitionTransferService';

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtArea = (v) => Number(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const StatCard = ({ title, area, icon: Icon, color, bg }) => (
  <Paper
    elevation={0}
    sx={{
      p: 3,
      borderRadius: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      bgcolor: bg,
      border: '1px solid',
      borderColor: 'divider',
      transition: 'transform 0.2s',
      '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
    }}
  >
    <Box
      sx={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.paper',
        color: color,
        boxShadow: 1
      }}
    >
      <Icon fontSize="large" />
    </Box>
    <Box>
      <Typography variant="body2" fontWeight={600} color="text.secondary" gutterBottom>
        {title}
      </Typography>
      <Typography variant="h5" fontWeight={800} color="text.primary">
        {fmtArea(area?.kanal)}<span style={{ fontSize: '0.8em', fontWeight: 500, color: 'gray' }}> K</span> - {' '}
        {fmtArea(area?.marla)}<span style={{ fontSize: '0.8em', fontWeight: 500, color: 'gray' }}> M</span> - {' '}
        {fmtArea(area?.sarsai)}<span style={{ fontSize: '0.8em', fontWeight: 500, color: 'gray' }}> S</span>
      </Typography>
    </Box>
  </Paper>
);

const ColHeader = ({ children, align = 'right', sx = {} }) => (
  <TableCell
    align={align}
    sx={{
      fontWeight: 700,
      fontSize: '0.7rem',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: 'text.secondary',
      bgcolor: 'grey.50',
      borderBottom: '2px solid',
      borderColor: 'divider',
      py: 1.25,
      px: 1.5,
      whiteSpace: 'nowrap',
      ...sx
    }}
  >
    {children}
  </TableCell>
);

const TotalsRow = ({ cells }) => (
  <TableRow
    sx={{
      bgcolor: 'grey.100',
      '& td': { fontWeight: 700, borderTop: '2px solid', borderColor: 'divider' }
    }}
  >
    {cells.map((cell, i) => (
      <TableCell key={i} align={cell.align || 'right'} sx={{ py: 1, px: 1.5, color: cell.color }}>
        {cell.value}
      </TableCell>
    ))}
  </TableRow>
);

const SectionCard = ({ title, loading, children, onExportExcel, onExportPdf }) => (
  <Paper
    variant="outlined"
    sx={{ mb: 4, borderRadius: 3, overflow: 'hidden', boxShadow: 1 }}
  >
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 3,
        py: 2,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Typography variant="h6" fontWeight={700} color="primary.dark">{title}</Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {onExportPdf && (
          <Tooltip title="Export PDF">
            <IconButton size="small" color="error" onClick={onExportPdf} sx={{ border: '1px solid', borderColor: 'error.light', borderRadius: 2, px: 1.5 }}>
              <PdfIcon fontSize="small" />
              <Typography variant="caption" sx={{ ml: 0.5, fontWeight: 700 }}>PDF</Typography>
            </IconButton>
          </Tooltip>
        )}
        {onExportExcel && (
          <Tooltip title="Export Excel">
            <IconButton size="small" color="success" onClick={onExportExcel} sx={{ border: '1px solid', borderColor: 'success.light', borderRadius: 2, px: 1.5 }}>
              <ExcelIcon fontSize="small" />
              <Typography variant="caption" sx={{ ml: 0.5, fontWeight: 700 }}>Excel</Typography>
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>

    {loading ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={32} />
      </Box>
    ) : (
      children
    )}
  </Paper>
);

const exportCSV = (filename, headers, rows) => {
  const csvRows = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function LandAcquisitionDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await landAcquisitionTransferService.getLandSummaryReport();
      setData(res.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleExportLandCSV = () => {
    if (!data) return;
    const headers = ['#', 'Moza', 'Kanal', 'Marla', 'Sarsai', 'Land Value', 'Transfer Charges', 'Commission', 'Total Land Value & Allied Expense'];
    const rows = (data.landSummary?.rows || []).map((r, i) => [
      i + 1, r.mozaName, r.kanal, r.marla, r.sarsai, r.landValue, r.transferCharges, r.commission, r.totalAllied
    ]);
    const t = data.landSummary?.totals;
    if (t) rows.push(['', 'Total', t.kanal, t.marla, t.sarsai, t.landValue, t.transferCharges, t.commission, t.totalAllied]);
    exportCSV('land_summary_report.csv', headers, rows);
  };

  const handleExportOwnerCSV = () => {
    if (!data) return;
    const headers = ['#', 'Owner Name', 'Kanal', 'Marla', 'Sarsai'];
    const rows = (data.ownerSummary?.rows || []).map((r, i) => [i + 1, r.ownerName, r.kanal, r.marla, r.sarsai]);
    const t = data.ownerSummary?.totals;
    if (t) rows.push(['', 'Total', t.kanal, t.marla, t.sarsai]);
    exportCSV('land_transfer_owner_summary.csv', headers, rows);
  };

  const landRows = data?.landSummary?.rows || [];
  const landTotals = data?.landSummary?.totals;
  const ownerRows = data?.ownerSummary?.rows || [];
  const ownerTotals = data?.ownerSummary?.totals;
  const dashboardTotals = data?.dashboardTotals || {};

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} gutterBottom>Land Acquisition Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Overview of overall land purchase, possession metrics, and summarized reports.
          </Typography>
        </Box>
        <Tooltip title="Refresh Dashboard">
          <IconButton onClick={load} disabled={loading} sx={{ bgcolor: 'primary.50', color: 'primary.main', '&:hover': { bgcolor: 'primary.100' } }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Total Land Purchased"
            area={dashboardTotals.purchased || { kanal: 0, marla: 0, sarsai: 0 }}
            icon={PurchaseIcon}
            color="primary.main"
            bg="primary.50"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Total Land Possessed"
            area={dashboardTotals.possessed || { kanal: 0, marla: 0, sarsai: 0 }}
            icon={PossessionIcon}
            color="success.main"
            bg="success.50"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Land Purchased But Not In Possession"
            area={dashboardTotals.remaining || { kanal: 0, marla: 0, sarsai: 0 }}
            icon={PendingIcon}
            color="warning.main"
            bg="warning.50"
          />
        </Grid>
      </Grid>

      {/* Land Summary Report Table */}
      <SectionCard
        title="Land Summary Report by Moza"
        loading={loading}
        onExportExcel={handleExportLandCSV}
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <ColHeader align="center" sx={{ width: 48 }}>#</ColHeader>
                <ColHeader align="left">Moza</ColHeader>
                <ColHeader>Kanal</ColHeader>
                <ColHeader>Marla</ColHeader>
                <ColHeader>Sarsai</ColHeader>
                <ColHeader>Land Value</ColHeader>
                <ColHeader>Transfer Charges</ColHeader>
                <ColHeader>Commission</ColHeader>
                <ColHeader>Total Land Value &amp; Allied Expense</ColHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {landRows.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No land records available
                  </TableCell>
                </TableRow>
              ) : (
                landRows.map((row, idx) => (
                  <TableRow key={row.mozaName} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                      {idx + 1}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{row.mozaName}</TableCell>
                    <TableCell align="right">{fmtArea(row.kanal)}</TableCell>
                    <TableCell align="right">{fmtArea(row.marla)}</TableCell>
                    <TableCell align="right">{fmtArea(row.sarsai)}</TableCell>
                    <TableCell align="right">{fmt(row.landValue)}</TableCell>
                    <TableCell align="right">{fmt(row.transferCharges)}</TableCell>
                    <TableCell align="right">{fmt(row.commission)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.dark' }}>{fmt(row.totalAllied)}</TableCell>
                  </TableRow>
                ))
              )}
              {landTotals && (
                <TotalsRow cells={[
                  { value: '', align: 'center' },
                  { value: 'Grand Total', align: 'left' },
                  { value: fmtArea(landTotals.kanal), color: 'primary.dark' },
                  { value: fmtArea(landTotals.marla), color: 'primary.dark' },
                  { value: fmtArea(landTotals.sarsai), color: 'primary.dark' },
                  { value: fmt(landTotals.landValue) },
                  { value: fmt(landTotals.transferCharges) },
                  { value: fmt(landTotals.commission) },
                  { value: fmt(landTotals.totalAllied), color: 'success.dark' }
                ]} />
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      {/* Land Transfer Owner Summary */}
      <SectionCard
        title="Land Transfer Owner Summary"
        loading={loading}
        onExportExcel={handleExportOwnerCSV}
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <ColHeader align="center" sx={{ width: 48 }}>#</ColHeader>
                <ColHeader align="left">Owner Name</ColHeader>
                <ColHeader>Kanal</ColHeader>
                <ColHeader>Marla</ColHeader>
                <ColHeader>Sarsai</ColHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {ownerRows.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No transfer records yet
                  </TableCell>
                </TableRow>
              ) : (
                ownerRows.map((row, idx) => (
                  <TableRow key={row.ownerName} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                      {idx + 1}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{row.ownerName}</TableCell>
                    <TableCell align="right">{fmtArea(row.kanal)}</TableCell>
                    <TableCell align="right">{fmtArea(row.marla)}</TableCell>
                    <TableCell align="right">{fmtArea(row.sarsai)}</TableCell>
                  </TableRow>
                ))
              )}
              {ownerTotals && (
                <TotalsRow cells={[
                  { value: '', align: 'center' },
                  { value: 'Total', align: 'left' },
                  { value: fmtArea(ownerTotals.kanal), color: 'primary.dark' },
                  { value: fmtArea(ownerTotals.marla), color: 'primary.dark' },
                  { value: fmtArea(ownerTotals.sarsai), color: 'primary.dark' }
                ]} />
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>
    </Box>
  );
}
