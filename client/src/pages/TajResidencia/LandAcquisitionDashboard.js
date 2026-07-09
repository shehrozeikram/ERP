import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
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
  Timer as PendingIcon,
  Assessment as AssessmentIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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



  const handleExportRegistryCSV = () => {
    if (!data) return;
    const headers = ['#', 'Moza', 'Kanal', 'Marla', 'Sarsai'];
    const rows = (data.registryMozaSummary?.rows || []).map((r, i) => [i + 1, r.mozaName, r.kanal, r.marla, r.sarsai]);
    const t = data.registryMozaSummary?.totals;
    if (t) rows.push(['', 'Total', t.kanal, t.marla, t.sarsai]);
    exportCSV('registry_summary_by_moza.csv', headers, rows);
  };

  const handleExportPossessionCSV = () => {
    if (!data) return;
    const headers = ['#', 'Moza', 'Kanal', 'Marla', 'Sarsai'];
    const rows = (data.possessionMozaSummary?.rows || []).map((r, i) => [i + 1, r.mozaName, r.kanal, r.marla, r.sarsai]);
    const t = data.possessionMozaSummary?.totals;
    if (t) rows.push(['', 'Total', t.kanal, t.marla, t.sarsai]);
    exportCSV('possession_summary_by_moza.csv', headers, rows);
  };

  const handleExportPendingPossessionCSV = () => {
    if (!data) return;
    const headers = ['#', 'Moza', 'Kanal', 'Marla', 'Sarsai'];
    const rows = (data.pendingPossessionMozaSummary?.rows || []).map((r, i) => [i + 1, r.mozaName, r.kanal, r.marla, r.sarsai]);
    const t = data.pendingPossessionMozaSummary?.totals;
    if (t) rows.push(['', 'Total', t.kanal, t.marla, t.sarsai]);
    exportCSV('pending_possession_summary_by_moza.csv', headers, rows);
  };

  const handleExportUnregisteredPossessionCSV = () => {
    if (!data) return;
    const headers = ['#', 'Moza', 'Kanal', 'Marla', 'Sarsai'];
    const rows = (data.unregisteredPossessionMozaSummary?.rows || []).map((r, i) => [i + 1, r.mozaName, r.kanal, r.marla, r.sarsai]);
    const t = data.unregisteredPossessionMozaSummary?.totals;
    if (t) rows.push(['', 'Total', t.kanal, t.marla, t.sarsai]);
    exportCSV('unregistered_possession_summary_by_moza.csv', headers, rows);
  };

  const handleExportLandSummaryCSV = () => {
    if (!data) return;
    const headers = ['#', 'Moza', 'Kanal', 'Marla', 'Sarsai', 'Land Value', 'Transfer Charges', 'Commission', 'Total Land Value & Allied Expense'];
    const rows = (data.landSummary?.rows || []).map((r, i) => [
      i + 1, r.mozaName, r.kanal, r.marla, r.sarsai, r.landValue, r.transferCharges, r.commission, r.totalAllied
    ]);
    const t = data.landSummary?.totals;
    if (t) rows.push(['', 'Total', t.kanal, t.marla, t.sarsai, t.landValue, t.transferCharges, t.commission, t.totalAllied]);
    exportCSV('land_summary_report.csv', headers, rows);
  };

  const handleExportOwnerSummaryCSV = () => {
    if (!data) return;
    const headers = ['#', 'Owner Name', 'Kanal', 'Marla', 'Sarsai'];
    const rows = (data.ownerSummary?.rows || []).map((r, i) => [i + 1, r.ownerName, r.kanal, r.marla, r.sarsai]);
    const t = data.ownerSummary?.totals;
    if (t) rows.push(['', 'Total', t.kanal, t.marla, t.sarsai]);
    exportCSV('owner_summary.csv', headers, rows);
  };

  const handleExportDealsInProgressCSV = () => {
    if (!data) return;
    const headers = ['#', 'Owner Name', 'Kanal', 'Marla', 'Sarsai'];
    const rows = (data.dealsInProgressSummary?.rows || []).map((r, i) => [i + 1, r.ownerName, r.kanal, r.marla, r.sarsai]);
    exportCSV('deals_in_progress.csv', headers, rows);
  };


  const landSummaryRows = data?.landSummary?.rows || [];
  const landSummaryTotals = data?.landSummary?.totals;
  const ownerSummaryRows = data?.ownerSummary?.rows || [];
  const ownerSummaryTotals = data?.ownerSummary?.totals;
  const dealsInProgressRows = data?.dealsInProgressSummary?.rows || [];
  const registryRows = data?.registryMozaSummary?.rows || [];
  const registryTotals = data?.registryMozaSummary?.totals;
  const possessionRows = data?.possessionMozaSummary?.rows || [];
  const possessionTotals = data?.possessionMozaSummary?.totals;
  const pendingPossessionRows = data?.pendingPossessionMozaSummary?.rows || [];
  const pendingPossessionTotals = data?.pendingPossessionMozaSummary?.totals;
  const unregisteredPossessionRows = data?.unregisteredPossessionMozaSummary?.rows || [];
  const unregisteredPossessionTotals = data?.unregisteredPossessionMozaSummary?.totals;

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

      {/* Land Summary Report */}
      <SectionCard
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssessmentIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={700} color="primary.dark">Land Summary Report</Typography>
          </Box>
        }
        loading={loading}
        onExportExcel={handleExportLandSummaryCSV}
      >
        <TableContainer>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <ColHeader align="center" sx={{ width: 64 }}>#</ColHeader>
                <ColHeader align="left" sx={{ fontSize: '0.75rem' }}>Moza</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Kanal</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Marla</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Sarsai</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Land Value</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Transfer Charges</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Commission</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Total Land Value & Allied Expense</ColHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {landSummaryRows.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                landSummaryRows.map((row, idx) => (
                  <TableRow key={row.mozaName} hover sx={{ '&:last-child td': { border: 0 }, transition: 'background-color 0.2s', '&:hover': { bgcolor: 'primary.50' } }}>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                      {idx + 1}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'text.primary' }}>{row.mozaName}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.kanal)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.marla)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.sarsai)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>{fmt(row.landValue)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>{fmt(row.transferCharges)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>{fmt(row.commission)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>{fmt(row.totalAllied)}</TableCell>
                  </TableRow>
                ))
              )}
              {landSummaryTotals && (
                <TableRow sx={{ bgcolor: 'grey.300', '& td': { color: 'text.primary', fontWeight: 800, border: 'none', py: 1.5 } }}>
                  <TableCell align="center"></TableCell>
                  <TableCell align="left" sx={{ fontSize: '1rem' }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontSize: '1rem' }}>{fmtArea(landSummaryTotals.kanal)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '1rem' }}>{fmtArea(landSummaryTotals.marla)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '1rem' }}>{fmtArea(landSummaryTotals.sarsai)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '1rem' }}>{fmt(landSummaryTotals.landValue)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '1rem' }}>{fmt(landSummaryTotals.transferCharges)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '1rem' }}>{fmt(landSummaryTotals.commission)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '1rem' }}>{fmt(landSummaryTotals.totalAllied)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      {/* Land Transfer Owner Summary */}
      <SectionCard
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssessmentIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={700} color="primary.dark">Land Transfer Owner Summary</Typography>
          </Box>
        }
        loading={loading}
        onExportExcel={handleExportOwnerSummaryCSV}
      >
        <TableContainer>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <ColHeader align="center" sx={{ width: 64 }}>#</ColHeader>
                <ColHeader align="left" sx={{ fontSize: '0.75rem' }}>Owner Name</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Kanal</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Marla</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Sarsai</ColHeader>
                <ColHeader align="center" sx={{ fontSize: '0.75rem' }}>Detail</ColHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {ownerSummaryRows.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                ownerSummaryRows.map((row, idx) => (
                  <TableRow key={row.ownerName} hover sx={{ '&:last-child td': { border: 0 }, transition: 'background-color 0.2s', '&:hover': { bgcolor: 'primary.50' } }}>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                      {idx + 1}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'text.primary' }}>{row.ownerName}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.kanal)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.marla)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.sarsai)}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton 
                        size="small" 
                        color="primary"
                        onClick={() => navigate(row.ownerName === 'In Progress' ? '/taj-residencia/land-transfers' : `/taj-residencia/land-transfers?search=${encodeURIComponent(row.ownerName)}`)}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {ownerSummaryTotals && (
                <TableRow sx={{ bgcolor: 'grey.300', '& td': { color: 'text.primary', fontWeight: 800, border: 'none', py: 1.5 } }}>
                  <TableCell align="center"></TableCell>
                  <TableCell align="left" sx={{ fontSize: '1rem' }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontSize: '1rem' }}>{fmtArea(ownerSummaryTotals.kanal)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '1rem' }}>{fmtArea(ownerSummaryTotals.marla)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '1rem' }}>{fmtArea(ownerSummaryTotals.sarsai)}</TableCell>
                  <TableCell align="center"></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      {/* Deals in Progress */}
      <SectionCard
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PendingIcon sx={{ color: 'warning.main' }} />
            <Typography variant="h6" fontWeight={700} color="primary.dark">Deals in Progress</Typography>
          </Box>
        }
        loading={loading}
        onExportExcel={handleExportDealsInProgressCSV}
      >
        <TableContainer>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <ColHeader align="center" sx={{ width: 64 }}>#</ColHeader>
                <ColHeader align="left" sx={{ fontSize: '0.75rem' }}>Owner Name</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Kanal</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Marla</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Sarsai</ColHeader>
                <ColHeader align="center" sx={{ fontSize: '0.75rem' }}>Detail</ColHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {dealsInProgressRows.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                dealsInProgressRows.map((row, idx) => (
                  <TableRow key={row.ownerName} hover sx={{ '&:last-child td': { border: 0 }, transition: 'background-color 0.2s', '&:hover': { bgcolor: 'primary.50' } }}>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                      {idx + 1}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'text.primary' }}>{row.ownerName}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.kanal)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.marla)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.sarsai)}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton 
                        size="small" 
                        color="primary"
                        onClick={() => navigate(row.type === 'registry' 
                          ? '/taj-residencia/land-transfers?missing=registry' 
                          : '/taj-residencia/land-transfers?missing=intiqal')}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      {/* Acquired Land Summary by Moza */}
      <SectionCard
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PurchaseIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={700} color="primary.dark">Acquired Land Data by Moza</Typography>
          </Box>
        }
        loading={loading}
        onExportExcel={handleExportRegistryCSV}
      >
        <TableContainer>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <ColHeader align="center" sx={{ width: 64 }}>#</ColHeader>
                <ColHeader align="left" sx={{ fontSize: '0.75rem' }}>Moza Name</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Kanal</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Marla</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Sarsai</ColHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {registryRows.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No acquired land records found
                  </TableCell>
                </TableRow>
              ) : (
                registryRows.map((row, idx) => (
                  <TableRow key={row.mozaName} hover sx={{ '&:last-child td': { border: 0 }, transition: 'background-color 0.2s', '&:hover': { bgcolor: 'primary.50' } }}>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                      {idx + 1}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'text.primary' }}>{row.mozaName}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.kanal)} <span style={{ color: 'gray', fontSize: '0.7rem' }}>K</span>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.marla)} <span style={{ color: 'gray', fontSize: '0.7rem' }}>M</span>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.sarsai)} <span style={{ color: 'gray', fontSize: '0.7rem' }}>S</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {registryTotals && (
                <TableRow sx={{ bgcolor: 'primary.main', '& td': { color: 'white', fontWeight: 800, border: 'none', py: 1.5 } }}>
                  <TableCell align="center"></TableCell>
                  <TableCell align="left" sx={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: 1 }}>Total Acquired</TableCell>
                  <TableCell align="right" sx={{ fontSize: '1.05rem' }}>{fmtArea(registryTotals.kanal)} <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>K</span></TableCell>
                  <TableCell align="right" sx={{ fontSize: '1.05rem' }}>{fmtArea(registryTotals.marla)} <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>M</span></TableCell>
                  <TableCell align="right" sx={{ fontSize: '1.05rem' }}>{fmtArea(registryTotals.sarsai)} <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>S</span></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      {/* Possession Summary by Moza */}
      <SectionCard
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PossessionIcon sx={{ color: 'success.main' }} />
            <Typography variant="h6" fontWeight={700} color="success.dark">Land Possession Data by Moza</Typography>
          </Box>
        }
        loading={loading}
        onExportExcel={handleExportPossessionCSV}
      >
        <TableContainer>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <ColHeader align="center" sx={{ width: 64 }}>#</ColHeader>
                <ColHeader align="left" sx={{ fontSize: '0.75rem' }}>Moza Name</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Kanal</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Marla</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Sarsai</ColHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {possessionRows.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No possession records yet
                  </TableCell>
                </TableRow>
              ) : (
                possessionRows.map((row, idx) => (
                  <TableRow key={row.mozaName} hover sx={{ '&:last-child td': { border: 0 }, transition: 'background-color 0.2s', '&:hover': { bgcolor: 'success.50' } }}>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                      {idx + 1}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'text.primary' }}>{row.mozaName}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.kanal)} <span style={{ color: 'gray', fontSize: '0.7rem' }}>K</span>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.marla)} <span style={{ color: 'gray', fontSize: '0.7rem' }}>M</span>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.sarsai)} <span style={{ color: 'gray', fontSize: '0.7rem' }}>S</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {possessionTotals && (
                <TableRow sx={{ bgcolor: 'success.main', '& td': { color: 'white', fontWeight: 800, border: 'none', py: 1.5 } }}>
                  <TableCell align="center"></TableCell>
                  <TableCell align="left" sx={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: 1 }}>Total Possessed</TableCell>
                  <TableCell align="right" sx={{ fontSize: '1.05rem' }}>{fmtArea(possessionTotals.kanal)} <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>K</span></TableCell>
                  <TableCell align="right" sx={{ fontSize: '1.05rem' }}>{fmtArea(possessionTotals.marla)} <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>M</span></TableCell>
                  <TableCell align="right" sx={{ fontSize: '1.05rem' }}>{fmtArea(possessionTotals.sarsai)} <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>S</span></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      {/* Pending Possession Summary by Moza */}
      <SectionCard
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PendingIcon sx={{ color: 'warning.main' }} />
            <Typography variant="h6" fontWeight={700} color="warning.dark">Pending Possession Data by Moza</Typography>
          </Box>
        }
        loading={loading}
        onExportExcel={handleExportPendingPossessionCSV}
      >
        <TableContainer>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <ColHeader align="center" sx={{ width: 64 }}>#</ColHeader>
                <ColHeader align="left" sx={{ fontSize: '0.75rem' }}>Moza Name</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Kanal</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Marla</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Sarsai</ColHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingPossessionRows.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No pending possession records
                  </TableCell>
                </TableRow>
              ) : (
                pendingPossessionRows.map((row, idx) => (
                  <TableRow key={row.mozaName} hover sx={{ '&:last-child td': { border: 0 }, transition: 'background-color 0.2s', '&:hover': { bgcolor: 'warning.50' } }}>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                      {idx + 1}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'text.primary' }}>{row.mozaName}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.kanal)} <span style={{ color: 'gray', fontSize: '0.7rem' }}>K</span>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.marla)} <span style={{ color: 'gray', fontSize: '0.7rem' }}>M</span>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.sarsai)} <span style={{ color: 'gray', fontSize: '0.7rem' }}>S</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {pendingPossessionTotals && (
                <TableRow sx={{ bgcolor: 'warning.main', '& td': { color: 'white', fontWeight: 800, border: 'none', py: 1.5 } }}>
                  <TableCell align="center"></TableCell>
                  <TableCell align="left" sx={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: 1 }}>Total Pending</TableCell>
                  <TableCell align="right" sx={{ fontSize: '1.05rem' }}>{fmtArea(pendingPossessionTotals.kanal)} <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>K</span></TableCell>
                  <TableCell align="right" sx={{ fontSize: '1.05rem' }}>{fmtArea(pendingPossessionTotals.marla)} <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>M</span></TableCell>
                  <TableCell align="right" sx={{ fontSize: '1.05rem' }}>{fmtArea(pendingPossessionTotals.sarsai)} <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>S</span></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      {/* Unregistered Possession Summary by Moza */}
      <SectionCard
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PendingIcon sx={{ color: 'error.main' }} />
            <Typography variant="h6" fontWeight={700} color="error.dark">Unregistered Possession Data by Moza</Typography>
          </Box>
        }
        loading={loading}
        onExportExcel={handleExportUnregisteredPossessionCSV}
      >
        <TableContainer>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <ColHeader align="center" sx={{ width: 64 }}>#</ColHeader>
                <ColHeader align="left" sx={{ fontSize: '0.75rem' }}>Moza Name</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Kanal</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Marla</ColHeader>
                <ColHeader sx={{ fontSize: '0.75rem' }}>Sarsai</ColHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {unregisteredPossessionRows.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No unregistered possession records
                  </TableCell>
                </TableRow>
              ) : (
                unregisteredPossessionRows.map((row, idx) => (
                  <TableRow key={row.mozaName} hover sx={{ '&:last-child td': { border: 0 }, transition: 'background-color 0.2s', '&:hover': { bgcolor: 'error.50' } }}>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                      {idx + 1}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'text.primary' }}>{row.mozaName}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.kanal)} <span style={{ color: 'gray', fontSize: '0.7rem' }}>K</span>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.marla)} <span style={{ color: 'gray', fontSize: '0.7rem' }}>M</span>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {fmtArea(row.sarsai)} <span style={{ color: 'gray', fontSize: '0.7rem' }}>S</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {unregisteredPossessionTotals && (
                <TableRow sx={{ bgcolor: 'error.main', '& td': { color: 'white', fontWeight: 800, border: 'none', py: 1.5 } }}>
                  <TableCell align="center"></TableCell>
                  <TableCell align="left" sx={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: 1 }}>Total Unregistered</TableCell>
                  <TableCell align="right" sx={{ fontSize: '1.05rem' }}>{fmtArea(unregisteredPossessionTotals.kanal)} <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>K</span></TableCell>
                  <TableCell align="right" sx={{ fontSize: '1.05rem' }}>{fmtArea(unregisteredPossessionTotals.marla)} <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>M</span></TableCell>
                  <TableCell align="right" sx={{ fontSize: '1.05rem' }}>{fmtArea(unregisteredPossessionTotals.sarsai)} <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>S</span></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

    </Box>
  );
}
