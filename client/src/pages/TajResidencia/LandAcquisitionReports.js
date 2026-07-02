import React, { useCallback, useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  TextField
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import { getMozas } from '../../services/landAcquisitionMozaService';
import { getPossessionStatus } from '../../services/landAcquisitionPossessionService';
import { formatKMS, addAreas } from '../../utils/landAreaUnits';

const TABLE_HEAD_SX = {
  fontWeight: 700,
  fontSize: '0.875rem',
  lineHeight: 1.3,
  whiteSpace: 'nowrap',
  px: 1.75,
  py: 1.1
};

const COMPACT_CELL_SX = {
  px: 1.75,
  py: 1,
  whiteSpace: 'nowrap',
  fontSize: '0.9375rem',
  fontWeight: 500
};

const KMS_GROUP_BG = '#f3f6fa';
const KMS_GROUP_BORDER = '1px solid #d5dde8';

const kmsCellSx = (part, { header = false } = {}) => {
  const base = {
    width: 36,
    minWidth: 36,
    maxWidth: 36,
    px: 0.35,
    py: header ? 0.85 : 1,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    bgcolor: KMS_GROUP_BG,
    fontSize: header ? '0.75rem' : '0.9375rem',
    fontWeight: header ? 700 : 600,
    color: header ? 'text.secondary' : 'text.primary',
    letterSpacing: header ? 0.6 : 0
  };

  if (part === 'k') {
    return {
      ...base,
      borderLeft: KMS_GROUP_BORDER,
      pl: 0.75,
      borderTopLeftRadius: header ? 0 : 0
    };
  }
  if (part === 's') {
    return {
      ...base,
      borderRight: KMS_GROUP_BORDER,
      pr: 0.75
    };
  }
  return base;
};

const kmsHeaderGroupSx = {
  ...TABLE_HEAD_SX,
  bgcolor: KMS_GROUP_BG,
  borderBottom: KMS_GROUP_BORDER,
  borderLeft: KMS_GROUP_BORDER,
  borderRight: KMS_GROUP_BORDER,
  px: 1
};

const AREA_COLUMNS = [
  { key: 'baseline', label: 'Land in Khasra' },
  { key: 'registered', label: 'Purchased (Registry)' },
  { key: 'remainingToRegister', label: 'Pending Purchased' },
  { key: 'possessed', label: 'Possession' },
  { key: 'remainingToPossess', label: 'Pending Possession' }
];

const TABLE_COLGROUP = (
  <colgroup>
    <col style={{ width: 64 }} />
    <col style={{ width: 96 }} />
    <col style={{ width: 104 }} />
    <col style={{ width: 36 }} />
    <col style={{ width: 36 }} />
    <col style={{ width: 36 }} />
    <col style={{ width: 36 }} />
    <col style={{ width: 36 }} />
    <col style={{ width: 36 }} />
    <col style={{ width: 36 }} />
    <col style={{ width: 36 }} />
    <col style={{ width: 36 }} />
    <col style={{ width: 36 }} />
    <col style={{ width: 36 }} />
    <col style={{ width: 36 }} />
    <col style={{ width: 36 }} />
    <col style={{ width: 36 }} />
    <col style={{ width: 36 }} />
  </colgroup>
);

const MozaReportTable = ({ mozaId, active }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [khewatFilter, setKhewatFilter] = useState('');
  const [khasraFilter, setKhasraFilter] = useState('');

  const loadEntries = useCallback(async () => {
    if (!mozaId || !active) return;
    setLoading(true);
    setError('');
    try {
      const res = await getPossessionStatus({ moza: mozaId });
      setEntries(res.data?.data?.rows || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [mozaId, active]);

  useEffect(() => {
    if (active) loadEntries();
  }, [loadEntries, active]);

  const filteredEntries = React.useMemo(() => {
    return entries.filter(row => {
      const matchKhewat = khewatFilter ? String(row.khewatNo || '').toLowerCase().includes(khewatFilter.toLowerCase()) : true;
      const matchKhasra = khasraFilter ? String(row.khasraNo || '').toLowerCase().includes(khasraFilter.toLowerCase()) : true;
      return matchKhewat && matchKhasra;
    });
  }, [entries, khewatFilter, khasraFilter]);

  const totals = React.useMemo(() => {
    const res = {};
    AREA_COLUMNS.forEach(col => {
      res[col.key] = { kanal: 0, marla: 0, sarsai: 0 };
    });
    filteredEntries.forEach(row => {
      AREA_COLUMNS.forEach(col => {
        if (row[col.key]) {
          res[col.key] = addAreas(res[col.key], row[col.key]);
        }
      });
    });
    return res;
  }, [filteredEntries]);

  if (!active) return null;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {!loading && !error && entries.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ mb: 2, px: 0.5 }}>
          <TextField
            size="small"
            label="Filter Khewat No."
            value={khewatFilter}
            onChange={(e) => setKhewatFilter(e.target.value)}
            sx={{ width: 200 }}
          />
          <TextField
            size="small"
            label="Filter Khasra No."
            value={khasraFilter}
            onChange={(e) => setKhasraFilter(e.target.value)}
            sx={{ width: 200 }}
          />
        </Stack>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <TableContainer
          sx={{
            width: '100%',
            maxHeight: 'min(72vh, 720px)',
            minHeight: 420,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'auto'
          }}
        >
          <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', minWidth: 1000 }}>
            {TABLE_COLGROUP}
            <TableHead>
              <TableRow>
                <TableCell rowSpan={2} align="center" sx={TABLE_HEAD_SX}>Sr No</TableCell>
                <TableCell rowSpan={2} align="center" sx={TABLE_HEAD_SX}>Khewat No.</TableCell>
                <TableCell rowSpan={2} align="center" sx={TABLE_HEAD_SX}>Khasra No.</TableCell>
                {AREA_COLUMNS.map((col) => (
                  <TableCell key={col.key} align="center" colSpan={3} sx={kmsHeaderGroupSx}>
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                {AREA_COLUMNS.map((col) => (
                  <React.Fragment key={`${col.key}-sub`}>
                    <TableCell align="center" sx={kmsCellSx('k', { header: true })}>K</TableCell>
                    <TableCell align="center" sx={kmsCellSx('m', { header: true })}>M</TableCell>
                    <TableCell align="center" sx={kmsCellSx('s', { header: true })}>S</TableCell>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEntries.map((row) => (
                <TableRow key={row.khasraEntryId} hover>
                  <TableCell align="center" sx={COMPACT_CELL_SX}>{row.srNo}</TableCell>
                  <TableCell align="center" sx={COMPACT_CELL_SX}>{row.khewatNo}</TableCell>
                  <TableCell align="center" sx={COMPACT_CELL_SX}>{row.khasraNo}</TableCell>
                  {AREA_COLUMNS.map((col) => {
                    const a = row[col.key] || { kanal: 0, marla: 0, sarsai: 0 };
                    return (
                      <React.Fragment key={`${row.khasraEntryId}-${col.key}`}>
                        <TableCell align="center" sx={kmsCellSx('k')}>{a.kanal || '—'}</TableCell>
                        <TableCell align="center" sx={kmsCellSx('m')}>{a.marla || '—'}</TableCell>
                        <TableCell align="center" sx={kmsCellSx('s')}>{a.sarsai || '—'}</TableCell>
                      </React.Fragment>
                    );
                  })}
                </TableRow>
              ))}
              {filteredEntries.length > 0 && (
                <TableRow sx={{ bgcolor: 'primary.main', '& td': { color: 'white !important', fontWeight: 800, border: 'none', py: 1.5 } }}>
                  <TableCell colSpan={3} align="right" sx={{ px: 2, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Total:
                  </TableCell>
                  {AREA_COLUMNS.map((col) => {
                    const a = totals[col.key];
                    return (
                      <React.Fragment key={`total-${col.key}`}>
                        <TableCell align="center" sx={{ fontSize: '1rem' }}>
                          {a.kanal || '—'} <span style={{ opacity: 0.8, fontSize: '0.75rem', marginLeft: 2 }}>K</span>
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: '1rem' }}>
                          {a.marla || '—'} <span style={{ opacity: 0.8, fontSize: '0.75rem', marginLeft: 2 }}>M</span>
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: '1rem' }}>
                          {a.sarsai || '—'} <span style={{ opacity: 0.8, fontSize: '0.75rem', marginLeft: 2 }}>S</span>
                        </TableCell>
                      </React.Fragment>
                    );
                  })}
                </TableRow>
              )}
              {!filteredEntries.length && (
                <TableRow>
                  <TableCell colSpan={3 + AREA_COLUMNS.length * 3} align="center" sx={{ py: 4 }}>
                    {entries.length ? 'No records match the filters.' : 'No khasra records found for this mouza.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

const LandAcquisitionReports = () => {
  const [mozas, setMozas] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMozas = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      const res = await getMozas();
      const list = res.data?.data || [];
      setMozas(list);
      if (list.length > 0) {
        setExpandedId(list[0]._id);
      }
    } catch {
      setError('Failed to load moza list');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMozas();
  }, [loadMozas]);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Land Acquisition Reports
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View Khasra-wise land purchased and possession details.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {listLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : !mozas.length ? (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          No mouza found.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {mozas.map((m) => {
            const isExpanded = expandedId === m._id;
            return (
              <Accordion
                key={m._id}
                expanded={isExpanded}
                onChange={(_, open) => setExpandedId(open ? m._id : null)}
                disableGutters
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '8px !important',
                  '&:before': { display: 'none' },
                  overflow: 'hidden'
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  sx={{
                    bgcolor: isExpanded ? 'action.selected' : 'background.paper',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ sm: 'center' }}
                    sx={{ width: '100%', pr: 1 }}
                  >
                    <Typography variant="subtitle1" fontWeight={700}>
                      Mouza {m.name}
                    </Typography>
                    <Chip size="small" label={`${m.entryCount || 0} khasra records`} color="primary" variant="outlined" />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 1, pb: 2, px: 2, bgcolor: 'grey.50', minHeight: 480 }}>
                  <MozaReportTable mozaId={m._id} active={isExpanded} />
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

export default LandAcquisitionReports;
