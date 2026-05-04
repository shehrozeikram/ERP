import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Tooltip,
  Chip,
  alpha,
  useTheme
} from '@mui/material';
import {
  Place as PlaceIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import api from '../services/api';

const LocationWiseAttendanceCard = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [detailRows, setDetailRows] = useState([]);

  const loadSummary = useCallback(async (opts = {}) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/zkbio/zkbio/location-attendance-summary', {
        params: opts.skipCache ? { skip_cache: '1' } : undefined,
        timeout: 120000
      });
      if (data?.success) {
        const { _cached, ...rest } = data;
        setSummary(rest);
      } else {
        setSummary(null);
        setError(data?.message || 'Unable to load location attendance');
      }
    } catch (e) {
      setSummary(null);
      setError(e.response?.data?.message || 'Attendance system unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const openDetail = async (row) => {
    const sn = row.sn;
    if (!sn || sn === '-') return;
    setSelectedDevice(row);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setDetailRows([]);
    try {
      const { data } = await api.get('/zkbio/zkbio/location-attendance-summary', {
        params: { device_sn: sn },
        timeout: 120000
      });
      if (data?.success && Array.isArray(data.rows)) {
        setDetailRows(data.rows);
      } else {
        setDetailError(data?.message || 'No detail data');
      }
    } catch (e) {
      setDetailError(e.response?.data?.message || 'Failed to load device detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const devices = summary?.devices || [];
  const dateLabel = summary?.date || '';

  return (
    <>
      <Card
        sx={{
          borderRadius: 4,
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${alpha(theme.palette.secondary.main, 0.8)})`
          }
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  background: alpha(theme.palette.primary.main, 0.12),
                  color: theme.palette.primary.main
                }}
              >
                <PlaceIcon />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Location-wise attendance
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Same headcount rules as Present / Absent when you open those lists (ZKBio roster + today&apos;s
                  punches). Per device: % of that tracked workforce with at least one punch on the device (SN or
                  terminal name match). Date: {dateLabel || '—'}
                </Typography>
              </Box>
            </Box>
            <Tooltip title="Refresh (bypass short server cache)">
              <IconButton size="small" onClick={() => loadSummary({ skipCache: true })} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {summary?.warning && (
            <Typography variant="caption" color="warning.main" display="block" sx={{ mb: 1 }}>
              {summary.warning}
            </Typography>
          )}

          {summary?.company_summary && (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Company-wide (matches Present / Absent lists)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Present {summary.company_summary.present} · Absent {summary.company_summary.absent} · Tracked{' '}
                {summary.company_summary.total_tracked} · Present{' '}
                {Number(summary.company_summary.present_percent || 0).toFixed(1)}% · Absent{' '}
                {Number(summary.company_summary.absent_percent || 0).toFixed(1)}%
              </Typography>
            </Box>
          )}

          {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
          {error && (
            <Typography color="error" variant="body2" sx={{ mb: 1 }}>
              {error}
            </Typography>
          )}

          {!loading && !error && devices.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No devices returned from attendance system.
            </Typography>
          )}

          {!loading && devices.length > 0 && (
            <Table size="small" sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Device / location</TableCell>
                  <TableCell>Serial</TableCell>
                  <TableCell align="right">Present %</TableCell>
                  <TableCell align="right">Absent %</TableCell>
                  <TableCell align="right">Staff punched</TableCell>
                  <TableCell align="center">Detail</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {devices.map((d) => (
                  <TableRow
                    key={d.sn}
                    hover
                    sx={{ cursor: d.sn && d.sn !== '-' ? 'pointer' : 'default' }}
                    onClick={() => d.sn && d.sn !== '-' && openDetail(d)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {d.alias}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {d.area_alias}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={d.sn} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography color="success.main" fontWeight={600}>
                        {Number(d.present_percent || 0).toFixed(1)}%
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography color="text.secondary" fontWeight={600}>
                        {Number(d.absent_percent || 0).toFixed(1)}%
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {d.unique_present} / {d.total_tracked ?? d.total_employees ?? summary?.total_employees ?? '—'}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View employees & punch times">
                        <IconButton
                          size="small"
                          disabled={!d.sn || d.sn === '-'}
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(d);
                          }}
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
            Denominator = Present + Absent headcount from ZKBio (same API as the dashboard lists). Device row
            &quot;Absent %&quot; is the complement of that device&apos;s reach (who did not punch on that device
            today).
          </Typography>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth scroll="paper">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6">Punches — {selectedDevice?.alias || selectedDevice?.sn}</Typography>
            <Typography variant="caption" color="text.secondary">
              SN {selectedDevice?.sn} · {dateLabel}
            </Typography>
          </Box>
          <IconButton onClick={() => setDetailOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading && <LinearProgress sx={{ mb: 2 }} />}
          {detailError && (
            <Typography color="error" variant="body2">
              {detailError}
            </Typography>
          )}
          {!detailLoading && !detailError && detailRows.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No punches for this device on this date.
            </Typography>
          )}
          {!detailLoading && detailRows.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Emp #</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Punch times</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detailRows.map((r) => (
                  <TableRow key={r.emp_code}>
                    <TableCell>{r.emp_code}</TableCell>
                    <TableCell>
                      {r.first_name} {r.last_name}
                    </TableCell>
                    <TableCell>{r.dept_name || '—'}</TableCell>
                    <TableCell sx={{ maxWidth: 280 }}>
                      <Typography variant="caption" component="div">
                        {(r.punches || []).join(' · ')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default LocationWiseAttendanceCard;
