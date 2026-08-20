import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  SwapHoriz as ExchangeIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import landAcquisitionExchangeService from '../../services/landAcquisitionExchangeService';
import landAcquisitionPartyService from '../../services/landAcquisitionPartyService';
import { getMozas, getMozaKhasras } from '../../services/landAcquisitionMozaService';
import { getRegistries } from '../../services/landAcquisitionRegistryService';
import {
  addAreas,
  emptyArea,
  formatAreaReadable,
  formatKMS,
  normalizeArea,
  parseAreaForm,
  subtractAreas,
  toSarsais
} from '../../utils/landAreaUnits';
import { resolveUploadFileHref } from '../../utils/uploadPaths';

const AreaInputGroup = ({ value, onChange, label, disabled = false, size = 'small' }) => (
  <Stack direction="row" spacing={0.75} alignItems="center">
    <TextField
      size={size}
      label="K"
      placeholder="Kanal"
      type="number"
      value={value?.kanal ?? ''}
      onChange={(e) => onChange({ ...value, kanal: e.target.value })}
      inputProps={{ min: 0 }}
      disabled={disabled}
      sx={{ width: 68 }}
    />
    <TextField
      size={size}
      label="M"
      placeholder="Marla"
      type="number"
      value={value?.marla ?? ''}
      onChange={(e) => onChange({ ...value, marla: e.target.value })}
      inputProps={{ min: 0 }}
      disabled={disabled}
      sx={{ width: 68 }}
    />
    <TextField
      size={size}
      label="S"
      placeholder="Sarsai"
      type="number"
      value={value?.sarsai ?? ''}
      onChange={(e) => onChange({ ...value, sarsai: e.target.value })}
      inputProps={{ min: 0, step: 0.5 }}
      disabled={disabled}
      sx={{ width: 68 }}
    />
  </Stack>
);

const emptyOutLine = () => ({
  id: Math.random().toString(36).substring(2, 9),
  registryId: '',
  registryNo: '',
  inteqalNo: '',
  moza: '',
  khasraEntry: '',
  khewatNo: '',
  khasraNo: '',
  khasraArea: { kanal: '', marla: '', sarsai: '' },
  surrenderedArea: { kanal: '', marla: '', sarsai: '' },
  remarks: ''
});

const emptyInLine = () => ({
  id: Math.random().toString(36).substring(2, 9),
  moza: '',
  khasraEntry: '',
  khewatNo: '',
  khasraNo: '',
  khasraArea: { kanal: '', marla: '', sarsai: '' },
  acquiredArea: { kanal: '', marla: '', sarsai: '' },
  registryNo: '',
  inteqalNo: '',
  remarks: ''
});

export default function LandExchangeFormDialog({
  open,
  onClose,
  onSaved,
  exchangeId = null
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Dropdown data
  const [parties, setParties] = useState([]);
  const [mozas, setMozas] = useState([]);
  const [registries, setRegistries] = useState([]);
  const [mozaKhasrasMap, setMozaKhasrasMap] = useState({});

  // Form State
  const [exchangeRef, setExchangeRef] = useState('');
  const [exchangeDate, setExchangeDate] = useState(new Date().toISOString().slice(0, 10));
  const [party, setParty] = useState(null);
  const [dealNo, setDealNo] = useState('');
  const [moza, setMoza] = useState('');
  const [remarks, setRemarks] = useState('');

  const [outLandLines, setOutLandLines] = useState([emptyOutLine()]);
  const [inLandLines, setInLandLines] = useState([emptyInLine()]);

  // Financial Adjustment
  const [hasAdjustment, setHasAdjustment] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustPaidBy, setAdjustPaidBy] = useState('COMPANY');
  const [adjustPaymentMode, setAdjustPaymentMode] = useState('Cheque');
  const [adjustStatus, setAdjustStatus] = useState('Pending');
  const [adjustRemarks, setAdjustRemarks] = useState('');

  // Files
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);

  // Load dropdown resources
  const loadResources = useCallback(async () => {
    try {
      const [partiesRes, mozasRes, registriesRes] = await Promise.all([
        landAcquisitionPartyService.getParties({ limit: 5000 }),
        getMozas(),
        getRegistries({ limit: 5000 })
      ]);

      const rawParties = Array.isArray(partiesRes.data)
        ? partiesRes.data
        : (partiesRes.data?.data || partiesRes.data?.rows || partiesRes.data?.parties || []);

      const rawMozas = Array.isArray(mozasRes.data?.data)
        ? mozasRes.data.data
        : (mozasRes.data?.rows || (Array.isArray(mozasRes.data) ? mozasRes.data : []));

      const rawRegistries = Array.isArray(registriesRes.data?.data?.registries)
        ? registriesRes.data.data.registries
        : (registriesRes.data?.data?.rows || registriesRes.data?.rows || (Array.isArray(registriesRes.data) ? registriesRes.data : []));

      setParties(rawParties);
      setMozas(rawMozas);
      setRegistries(rawRegistries);
    } catch (err) {
      console.error('Failed to load exchange resources', err);
    }
  }, []);

  const loadKhasrasForMoza = useCallback(async (mozaId) => {
    if (!mozaId || mozaKhasrasMap[mozaId]) return;
    try {
      const res = await getMozaKhasras(mozaId);
      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : (res.data?.rows || (Array.isArray(res.data) ? res.data : []));
      setMozaKhasrasMap((prev) => ({ ...prev, [mozaId]: list }));
    } catch (err) {
      console.error(`Failed to load khasras for moza ${mozaId}`, err);
    }
  }, [mozaKhasrasMap]);

  // Initialize or fetch existing
  useEffect(() => {
    if (!open) return;
    loadResources();

    if (exchangeId) {
      setLoading(true);
      setError('');
      landAcquisitionExchangeService.getExchange(exchangeId)
        .then((res) => {
          const d = res.data;
          setExchangeRef(d.exchangeRef || '');
          setExchangeDate(d.exchangeDate ? new Date(d.exchangeDate).toISOString().slice(0, 10) : '');
          setParty(d.party || null);
          setDealNo(d.dealNo ? String(d.dealNo) : '');
          setMoza(d.moza?._id || d.moza || '');
          setRemarks(d.remarks || '');

          setOutLandLines(
            (d.outLandLines || []).map((l) => ({
              id: l._id || Math.random().toString(36).substring(2, 9),
              registryId: l.registry?._id || l.registry || '',
              registryNo: l.registryNo || l.registry?.registryNo || '',
              inteqalNo: l.inteqalNo || l.registry?.inteqalNo || '',
              moza: l.moza?._id || l.moza || '',
              khasraEntry: l.khasraEntry?._id || l.khasraEntry || '',
              khewatNo: l.khewatNo || '',
              khasraNo: l.khasraNo || '',
              khasraArea: l.khasraArea || { kanal: '', marla: '', sarsai: '' },
              surrenderedArea: l.surrenderedArea || { kanal: '', marla: '', sarsai: '' },
              remarks: l.remarks || ''
            }))
          );

          setInLandLines(
            (d.inLandLines || []).map((l) => ({
              id: l._id || Math.random().toString(36).substring(2, 9),
              moza: l.moza?._id || l.moza || '',
              khasraEntry: l.khasraEntry?._id || l.khasraEntry || '',
              khewatNo: l.khewatNo || '',
              khasraNo: l.khasraNo || '',
              khasraArea: l.khasraArea || { kanal: '', marla: '', sarsai: '' },
              acquiredArea: l.acquiredArea || { kanal: '', marla: '', sarsai: '' },
              registryNo: l.registryNo || '',
              inteqalNo: l.inteqalNo || '',
              remarks: l.remarks || ''
            }))
          );

          if (d.financialAdjustment) {
            setHasAdjustment(Boolean(d.financialAdjustment.hasAdjustment));
            setAdjustAmount(d.financialAdjustment.amount ? String(d.financialAdjustment.amount) : '');
            setAdjustPaidBy(d.financialAdjustment.paidBy || 'COMPANY');
            setAdjustPaymentMode(d.financialAdjustment.paymentMode || 'Cheque');
            setAdjustStatus(d.financialAdjustment.status || 'Pending');
            setAdjustRemarks(d.financialAdjustment.remarks || '');
          }

          setExistingAttachments(d.attachments || []);
          setNewFiles([]);

          if (d.moza?._id || d.moza) loadKhasrasForMoza(d.moza?._id || d.moza);
          (d.outLandLines || []).forEach((l) => {
            const mId = l.moza?._id || l.moza;
            if (mId) loadKhasrasForMoza(mId);
          });
          (d.inLandLines || []).forEach((l) => {
            const mId = l.moza?._id || l.moza;
            if (mId) loadKhasrasForMoza(mId);
          });
        })
        .catch((err) => {
          setError(err.response?.data?.message || 'Failed to load exchange details');
        })
        .finally(() => setLoading(false));
    } else {
      // Instant render for new record without blinking spinner
      setLoading(false);
      setError('');
      setExchangeDate(new Date().toISOString().slice(0, 10));
      setParty(null);
      setDealNo('');
      setMoza('');
      setRemarks('');
      setOutLandLines([emptyOutLine()]);
      setInLandLines([emptyInLine()]);
      setHasAdjustment(false);
      setAdjustAmount('');
      setAdjustPaidBy('COMPANY');
      setAdjustPaymentMode('Cheque');
      setAdjustStatus('Pending');
      setAdjustRemarks('');
      setExistingAttachments([]);
      setNewFiles([]);

      // Fetch next Ref smoothly in background
      landAcquisitionExchangeService.getNextExchangeRef()
        .then((res) => {
          if (res.data?.nextRef) {
            setExchangeRef(res.data.nextRef);
          }
        })
        .catch(() => {
          setExchangeRef((prev) => prev || 'EXC-0001');
        });
    }
  }, [open, exchangeId]);

  // Handle Out Land line updates
  const handleOutLineChange = (index, field, value) => {
    setOutLandLines((prev) => {
      const updated = [...prev];

      if (field === 'registryId') {
        const reg = registries.find((r) => String(r._id) === String(value));
        if (reg) {
          const regMoza = reg.moza?._id || reg.moza || '';
          if (regMoza) loadKhasrasForMoza(regMoza);

          // If registry has multiple khasra lines, expand all of them into separate Out Land lines
          if (reg.lines && reg.lines.length > 1) {
            const newLines = reg.lines.map((l) => ({
              id: Math.random().toString(36).substring(2, 9),
              registryId: reg._id,
              registryNo: reg.registryNo || '',
              inteqalNo: reg.inteqalNo || '',
              moza: regMoza,
              khasraEntry: l.khasraEntry?._id || l.khasraEntry || '',
              khewatNo: l.khewatNo || reg.khewatNo || '',
              khasraNo: l.khasraNo || '',
              khasraArea: l.khasraArea || l.landOfKhasra || emptyArea(),
              surrenderedArea: l.acquiredArea || emptyArea(),
              remarks: l.remarks || ''
            }));

            // Replace the current line at index with all the registry's khasra lines
            updated.splice(index, 1, ...newLines);
            return updated;
          } else if (reg.lines && reg.lines.length === 1) {
            const firstL = reg.lines[0];
            const line = {
              ...updated[index],
              registryId: reg._id,
              registryNo: reg.registryNo || '',
              inteqalNo: reg.inteqalNo || '',
              moza: regMoza,
              khasraEntry: firstL.khasraEntry?._id || firstL.khasraEntry || '',
              khewatNo: firstL.khewatNo || reg.khewatNo || '',
              khasraNo: firstL.khasraNo || '',
              khasraArea: firstL.khasraArea || firstL.landOfKhasra || emptyArea(),
              surrenderedArea: firstL.acquiredArea || emptyArea()
            };
            updated[index] = line;
            return updated;
          } else {
            const line = {
              ...updated[index],
              registryId: reg._id,
              registryNo: reg.registryNo || '',
              inteqalNo: reg.inteqalNo || '',
              moza: regMoza,
              khewatNo: reg.khewatNo || ''
            };
            updated[index] = line;
            return updated;
          }
        } else {
          // Cleared registry selection
          updated[index] = {
            ...updated[index],
            registryId: '',
            registryNo: '',
            inteqalNo: ''
          };
          return updated;
        }
      }

      const line = { ...updated[index], [field]: value };

      if (field === 'moza' && value) {
        loadKhasrasForMoza(value);
      }

      if (field === 'khasraNo') {
        const selectedReg = registries.find((r) => String(r._id) === String(line.registryId));
        if (selectedReg && selectedReg.lines?.length > 0) {
          const regLine = selectedReg.lines.find((sl) => String(sl.khasraNo).trim() === String(value).trim());
          if (regLine) {
            line.khewatNo = regLine.khewatNo || line.khewatNo;
            line.khasraEntry = regLine.khasraEntry?._id || regLine.khasraEntry || line.khasraEntry;
            line.khasraArea = regLine.khasraArea || regLine.landOfKhasra || line.khasraArea;
            line.surrenderedArea = regLine.acquiredArea || line.surrenderedArea;
          }
        } else {
          const khasras = mozaKhasrasMap[line.moza] || [];
          const match = khasras.find((k) => String(k.khasraNo).trim() === String(value).trim());
          if (match) {
            line.khasraEntry = match._id;
            if (!line.khewatNo) line.khewatNo = match.khewatNo || '';
            line.khasraArea = match.landInKhasra || line.khasraArea;
          }
        }
      }

      updated[index] = line;
      return updated;
    });
  };

  const handleAddOutLine = () => setOutLandLines((prev) => [...prev, emptyOutLine()]);
  const handleRemoveOutLine = (index) => {
    setOutLandLines((prev) => prev.filter((_, i) => i !== index));
  };
  const handleClearOutLines = () => setOutLandLines([]);

  // Handle In Land line updates
  const handleInLineChange = (index, field, value) => {
    setInLandLines((prev) => {
      const updated = [...prev];
      const line = { ...updated[index], [field]: value };

      if (field === 'moza' && value) {
        loadKhasrasForMoza(value);
      }

      if (field === 'khasraNo') {
        const khasras = mozaKhasrasMap[line.moza] || [];
        const match = khasras.find((k) => String(k.khasraNo).trim() === String(value).trim());
        if (match) {
          line.khasraEntry = match._id;
          if (!line.khewatNo) line.khewatNo = match.khewatNo || '';
          line.khasraArea = match.landInKhasra || line.khasraArea;
        }
      }

      updated[index] = line;
      return updated;
    });
  };

  const handleAddInLine = () => setInLandLines((prev) => [...prev, emptyInLine()]);
  const handleRemoveInLine = (index) => {
    setInLandLines((prev) => prev.filter((_, i) => i !== index));
  };
  const handleClearInLines = () => setInLandLines([]);

  // Calculation summaries
  const totalOut = useMemo(() => {
    return addAreas(...outLandLines.map((l) => parseAreaForm(l.surrenderedArea)));
  }, [outLandLines]);

  const totalIn = useMemo(() => {
    return addAreas(...inLandLines.map((l) => parseAreaForm(l.acquiredArea)));
  }, [inLandLines]);

  const netDiff = useMemo(() => {
    const outS = toSarsais(totalOut);
    const inS = toSarsais(totalIn);
    if (outS > 0 && inS === 0) {
      return { ...totalOut, type: 'OUT_SURPLUS', label: `Out Only (Pending In: ${formatKMS(totalOut)})`, color: 'warning' };
    }
    if (inS > 0 && outS === 0) {
      return { ...totalIn, type: 'IN_SURPLUS', label: `In Only (Pending Out: ${formatKMS(totalIn)})`, color: 'success' };
    }
    if (inS > outS) {
      const diff = subtractAreas(totalIn, totalOut);
      return { ...diff, type: 'IN_SURPLUS', label: `In Surplus (+${formatKMS(diff)})`, color: 'success' };
    } else if (outS > inS) {
      const diff = subtractAreas(totalOut, totalIn);
      return { ...diff, type: 'OUT_SURPLUS', label: `Out Surplus (-${formatKMS(diff)})`, color: 'warning' };
    }
    return { kanal: 0, marla: 0, sarsai: 0, type: 'EQUAL', label: 'Balanced (0-0-0)', color: 'info' };
  }, [totalOut, totalIn]);

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!party) {
      setError('Please select or specify a counterparty');
      return;
    }

    const cleanOut = outLandLines
      .filter((l) => l.khasraNo || toSarsais(parseAreaForm(l.surrenderedArea)) > 0)
      .map((l) => ({
        registry: l.registryId || undefined,
        registryNo: l.registryNo,
        inteqalNo: l.inteqalNo,
        moza: l.moza || moza,
        khasraEntry: l.khasraEntry || undefined,
        khewatNo: l.khewatNo,
        khasraNo: l.khasraNo,
        khasraArea: parseAreaForm(l.khasraArea),
        surrenderedArea: parseAreaForm(l.surrenderedArea),
        remarks: l.remarks
      }));

    const cleanIn = inLandLines
      .filter((l) => l.khasraNo || toSarsais(parseAreaForm(l.acquiredArea)) > 0)
      .map((l) => ({
        moza: l.moza || moza,
        khasraEntry: l.khasraEntry || undefined,
        khewatNo: l.khewatNo,
        khasraNo: l.khasraNo,
        khasraArea: parseAreaForm(l.khasraArea),
        acquiredArea: parseAreaForm(l.acquiredArea),
        registryNo: l.registryNo,
        inteqalNo: l.inteqalNo,
        remarks: l.remarks
      }));

    if (!cleanOut.length && !cleanIn.length) {
      setError('Please provide at least one Out Land line or In Land line (the other can be added later)');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        exchangeRef,
        exchangeDate,
        party: party._id || party,
        dealNo: dealNo ? Number(dealNo) : undefined,
        moza: moza || undefined,
        remarks,
        outLandLines: cleanOut,
        inLandLines: cleanIn,
        financialAdjustment: {
          hasAdjustment,
          amount: Number(adjustAmount) || 0,
          paidBy: adjustPaidBy,
          paymentMode: adjustPaymentMode,
          status: adjustStatus,
          remarks: adjustRemarks
        },
        existingAttachments
      };

      const formData = new FormData();
      formData.append('data', JSON.stringify(payload));
      newFiles.forEach((file) => formData.append('attachments', file));

      if (exchangeId) {
        await landAcquisitionExchangeService.updateExchange(exchangeId, formData);
        toast.success('Land exchange record updated successfully');
      } else {
        await landAcquisitionExchangeService.createExchange(formData);
        toast.success('Land exchange record created successfully');
      }

      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save land exchange record');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ExchangeIcon color="primary" sx={{ fontSize: 28 }} />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {exchangeId ? 'Edit Land Exchange' : 'New Land Exchange Record'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Exchange / swap land between registries (Out Land) and newly acquired parcels (In Land).
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.950' : 'grey.50' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <form id="land-exchange-form" onSubmit={handleSubmit}>
            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            {/* General Header Information */}
            <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ color: 'primary.main', mb: 2 }}>
                Exchange Agreement Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Exchange Ref No."
                    value={exchangeRef}
                    onChange={(e) => setExchangeRef(e.target.value)}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Exchange Date"
                    value={exchangeDate}
                    onChange={(e) => setExchangeDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Autocomplete
                    size="small"
                    options={parties}
                    getOptionLabel={(p) => {
                      if (!p) return '';
                      if (typeof p === 'string') return p;
                      const parts = [p.name];
                      if (p.cnic) parts.push(`(${p.cnic})`);
                      if (p.partyType) parts.push(`[${p.partyType}]`);
                      return parts.join(' ');
                    }}
                    value={parties.find((p) => String(p._id) === String(party?._id || party)) || party || null}
                    onChange={(_, val) => setParty(val)}
                    isOptionEqualToValue={(option, value) => String(option._id) === String(value?._id || value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Counterparty / Exchanger"
                        required
                        placeholder={parties.length ? 'Select counterparty' : 'Type or select party'}
                        helperText={parties.length ? `${parties.length} parties loaded` : 'No registered parties yet'}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Deal No."
                    type="number"
                    value={dealNo}
                    onChange={(e) => setDealNo(e.target.value)}
                    placeholder="e.g. 102"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Remarks / Agreement Terms"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional notes or references regarding this barter arrangement..."
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Side-By-Side / Tabbed Out Land vs In Land */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {/* OUT LAND SECTION */}
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    height: '100%',
                    borderRadius: 2,
                    border: '1.5px solid',
                    borderColor: 'warning.light',
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(237, 108, 2, 0.05)' : '#fffdfa'
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip label="OUT" size="small" color="warning" sx={{ fontWeight: 700 }} />
                      <Typography variant="subtitle1" fontWeight={700}>
                        Out Land (Surrendered)
                      </Typography>
                    </Stack>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={handleAddOutLine}
                      variant="outlined"
                      color="warning"
                      sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                      Add Khasra
                    </Button>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                    Land surrendered from registries (can be left empty and added later).
                  </Typography>

                  {outLandLines.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
                      <Typography variant="body2" color="text.secondary">
                        No Out Land added. Click <strong>Add Khasra</strong> above if surrendering land in this deal now.
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={2}>
                      {outLandLines.map((line, idx) => {
                        const currentMozaKhasras = mozaKhasrasMap[line.moza] || [];
                        const selectedReg = registries.find((r) => String(r._id) === String(line.registryId));

                        return (
                          <Card key={line.id || idx} variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
                            <Stack spacing={1.5}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="caption" fontWeight={700} color="warning.dark">
                                  Out Line #{idx + 1}
                                </Typography>
                                <IconButton size="small" color="error" onClick={() => handleRemoveOutLine(idx)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Stack>

                              <Grid container spacing={1.5}>
                                <Grid item xs={12}>
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label="Source Registry (Optional)"
                                    value={line.registryId || ''}
                                    onChange={(e) => handleOutLineChange(idx, 'registryId', e.target.value)}
                                    helperText={registries.length ? `${registries.length} registries available` : ''}
                                  >
                                    <MenuItem value="">
                                      <em>— Manual / None —</em>
                                    </MenuItem>
                                    {registries.map((r) => (
                                      <MenuItem key={r._id} value={r._id}>
                                        Reg #{r.registryNo || '—'} {r.inteqalNo ? `(Inteqal: ${r.inteqalNo})` : ''} — {formatKMS(r.totalArea)} {r.moza?.name ? `[${r.moza.name}]` : ''}
                                      </MenuItem>
                                    ))}
                                  </TextField>
                                </Grid>
                                <Grid item xs={6}>
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label="Moza"
                                    value={line.moza || ''}
                                    onChange={(e) => handleOutLineChange(idx, 'moza', e.target.value)}
                                  >
                                    <MenuItem value=""><em>Select Moza</em></MenuItem>
                                    {(Array.isArray(mozas) ? mozas : []).map((m) => (
                                      <MenuItem key={m._id} value={m._id}>{m.name}</MenuItem>
                                    ))}
                                  </TextField>
                                </Grid>
                                <Grid item xs={6}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Khewat No."
                                    value={line.khewatNo}
                                    onChange={(e) => handleOutLineChange(idx, 'khewatNo', e.target.value)}
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  {selectedReg?.lines?.length > 0 ? (
                                    <TextField
                                      select
                                      fullWidth
                                      size="small"
                                      label="Khasra No."
                                      value={line.khasraNo || ''}
                                      onChange={(e) => {
                                        const kNo = e.target.value;
                                        const matchedLine = selectedReg.lines.find((sl) => String(sl.khasraNo) === String(kNo));
                                        handleOutLineChange(idx, 'khasraNo', kNo);
                                        if (matchedLine) {
                                          if (matchedLine.khewatNo) handleOutLineChange(idx, 'khewatNo', matchedLine.khewatNo);
                                          if (matchedLine.acquiredArea) handleOutLineChange(idx, 'surrenderedArea', matchedLine.acquiredArea);
                                        }
                                      }}
                                    >
                                      <MenuItem value=""><em>Select Khasra</em></MenuItem>
                                      {selectedReg.lines.map((sl, i) => (
                                        <MenuItem key={sl._id || i} value={sl.khasraNo}>
                                          Khasra {sl.khasraNo} (Khewat: {sl.khewatNo || '—'}, Area: {formatKMS(sl.acquiredArea)})
                                        </MenuItem>
                                      ))}
                                    </TextField>
                                  ) : currentMozaKhasras.length > 0 ? (
                                    <Autocomplete
                                      freeSolo
                                      size="small"
                                      options={currentMozaKhasras.map((k) => String(k.khasraNo))}
                                      value={line.khasraNo || ''}
                                      onChange={(_, val) => handleOutLineChange(idx, 'khasraNo', val || '')}
                                      onInputChange={(_, val) => handleOutLineChange(idx, 'khasraNo', val || '')}
                                      renderInput={(params) => (
                                        <TextField {...params} label="Khasra No." placeholder="Select or type khasra" />
                                      )}
                                    />
                                  ) : (
                                    <TextField
                                      fullWidth
                                      size="small"
                                      label="Khasra No."
                                      value={line.khasraNo}
                                      onChange={(e) => handleOutLineChange(idx, 'khasraNo', e.target.value)}
                                    />
                                  )}
                                </Grid>
                                <Grid item xs={6}>
                                  <Box>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                                      Surrendered Area (K-M-S)
                                    </Typography>
                                    <AreaInputGroup
                                      value={line.surrenderedArea}
                                      onChange={(val) => handleOutLineChange(idx, 'surrenderedArea', val)}
                                    />
                                  </Box>
                                </Grid>
                              </Grid>
                            </Stack>
                          </Card>
                        );
                      })}
                    </Stack>
                  )}

                  <Box sx={{ mt: 2.5, p: 1.5, bgcolor: 'warning.50', borderRadius: 1.5, border: '1px dashed', borderColor: 'warning.main' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={700} color="warning.dark">
                        Total Out Land:
                      </Typography>
                      <Typography variant="subtitle2" fontWeight={800} color="warning.dark">
                        {formatAreaReadable(totalOut)} ({formatKMS(totalOut)})
                      </Typography>
                    </Stack>
                  </Box>
                </Paper>
              </Grid>

              {/* IN LAND SECTION */}
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    height: '100%',
                    borderRadius: 2,
                    border: '1.5px solid',
                    borderColor: 'success.light',
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(46, 125, 50, 0.05)' : '#f9fdfa'
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip label="IN" size="small" color="success" sx={{ fontWeight: 700 }} />
                      <Typography variant="subtitle1" fontWeight={700}>
                        In Land (Acquired)
                      </Typography>
                    </Stack>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={handleAddInLine}
                      variant="outlined"
                      color="success"
                      sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                      Add Khasra
                    </Button>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                    Incoming acquired parcels (can be left empty and added later).
                  </Typography>

                  {inLandLines.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
                      <Typography variant="body2" color="text.secondary">
                        No In Land added. Click <strong>Add Khasra</strong> above if acquiring land in this deal now.
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={2}>
                      {inLandLines.map((line, idx) => {
                        const currentMozaKhasras = mozaKhasrasMap[line.moza] || [];

                        return (
                          <Card key={line.id || idx} variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
                            <Stack spacing={1.5}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="caption" fontWeight={700} color="success.dark">
                                  In Line #{idx + 1}
                                </Typography>
                                <IconButton size="small" color="error" onClick={() => handleRemoveInLine(idx)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Stack>

                              <Grid container spacing={1.5}>
                                <Grid item xs={6}>
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label="Moza"
                                    value={line.moza || ''}
                                    onChange={(e) => handleInLineChange(idx, 'moza', e.target.value)}
                                  >
                                    <MenuItem value=""><em>Select Moza</em></MenuItem>
                                    {(Array.isArray(mozas) ? mozas : []).map((m) => (
                                      <MenuItem key={m._id} value={m._id}>{m.name}</MenuItem>
                                    ))}
                                  </TextField>
                                </Grid>
                                <Grid item xs={6}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Khewat No."
                                    value={line.khewatNo}
                                    onChange={(e) => handleInLineChange(idx, 'khewatNo', e.target.value)}
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  {currentMozaKhasras.length > 0 ? (
                                    <Autocomplete
                                      freeSolo
                                      size="small"
                                      options={currentMozaKhasras.map((k) => String(k.khasraNo))}
                                      value={line.khasraNo || ''}
                                      onChange={(_, val) => handleInLineChange(idx, 'khasraNo', val || '')}
                                      onInputChange={(_, val) => handleInLineChange(idx, 'khasraNo', val || '')}
                                      renderInput={(params) => (
                                        <TextField {...params} label="Khasra No." placeholder="Select or type khasra" />
                                      )}
                                    />
                                  ) : (
                                    <TextField
                                      fullWidth
                                      size="small"
                                      label="Khasra No."
                                      value={line.khasraNo}
                                      onChange={(e) => handleInLineChange(idx, 'khasraNo', e.target.value)}
                                    />
                                  )}
                                </Grid>
                                <Grid item xs={6}>
                                  <Box>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                                      Acquired Area (K-M-S)
                                    </Typography>
                                    <AreaInputGroup
                                      value={line.acquiredArea}
                                      onChange={(val) => handleInLineChange(idx, 'acquiredArea', val)}
                                    />
                                  </Box>
                                </Grid>
                                <Grid item xs={6}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="New Registry No."
                                    value={line.registryNo}
                                    onChange={(e) => handleInLineChange(idx, 'registryNo', e.target.value)}
                                    placeholder="Optional"
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="New Inteqal No."
                                    value={line.inteqalNo}
                                    onChange={(e) => handleInLineChange(idx, 'inteqalNo', e.target.value)}
                                    placeholder="Optional"
                                  />
                                </Grid>
                              </Grid>
                            </Stack>
                          </Card>
                        );
                      })}
                    </Stack>
                  )}

                  <Box sx={{ mt: 2.5, p: 1.5, bgcolor: 'success.50', borderRadius: 1.5, border: '1px dashed', borderColor: 'success.main' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={700} color="success.dark">
                        Total In Land:
                      </Typography>
                      <Typography variant="subtitle2" fontWeight={800} color="success.dark">
                        {formatAreaReadable(totalIn)} ({formatKMS(totalIn)})
                      </Typography>
                    </Stack>
                  </Box>
                </Paper>
              </Grid>
            </Grid>

            {/* Live Exchange Variance Indicator */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                mb: 3,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ sm: 'center' }}
                spacing={2}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <ExchangeIcon color="primary" sx={{ fontSize: 32 }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Net Exchange Differential
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Comparison between total surrendered out land and newly acquired in land.
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Chip
                    label={`Out: ${formatKMS(totalOut)}`}
                    color="warning"
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                  <ArrowForwardIcon fontSize="small" color="action" />
                  <Chip
                    label={`In: ${formatKMS(totalIn)}`}
                    color="success"
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                  <Chip
                    label={netDiff.label}
                    color={netDiff.color}
                    sx={{ fontWeight: 700, px: 1 }}
                  />
                </Stack>
              </Stack>
            </Paper>

            {/* Financial Settlement Accordion / Switch */}
            <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: hasAdjustment ? 2 : 0 }}>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Financial Adjustment / Cash Differential
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enable if monetary payment is paid or received to settle the exchange variance.
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={hasAdjustment}
                      onChange={(e) => setHasAdjustment(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={hasAdjustment ? 'Active' : 'None'}
                />
              </Stack>

              {hasAdjustment && (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Adjustment Amount (PKR)"
                      type="number"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Paid By"
                      value={adjustPaidBy}
                      onChange={(e) => setAdjustPaidBy(e.target.value)}
                    >
                      <MenuItem value="COMPANY">Company pays Party</MenuItem>
                      <MenuItem value="PARTY">Party pays Company</MenuItem>
                      <MenuItem value="NONE">None</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Payment Mode"
                      value={adjustPaymentMode}
                      onChange={(e) => setAdjustPaymentMode(e.target.value)}
                    >
                      <MenuItem value="Cheque">Cheque</MenuItem>
                      <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                      <MenuItem value="Cash">Cash</MenuItem>
                      <MenuItem value="Pay Order">Pay Order</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Payment Status"
                      value={adjustStatus}
                      onChange={(e) => setAdjustStatus(e.target.value)}
                    >
                      <MenuItem value="Pending">Pending</MenuItem>
                      <MenuItem value="Paid">Paid</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Payment Settlement Notes"
                      value={adjustRemarks}
                      onChange={(e) => setAdjustRemarks(e.target.value)}
                      placeholder="Cheque number, bank reference, or payment date notes..."
                    />
                  </Grid>
                </Grid>
              )}
            </Paper>

            {/* Document Attachments */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Exchange Documents & Attachments
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Upload scans of exchange deed, mutation copy (Inteqal), possession handovers, or photos.
              </Typography>

              <Stack spacing={1.5}>
                {existingAttachments.map((att, i) => (
                  <Stack
                    key={att._id || i}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AttachFileIcon fontSize="small" color="primary" />
                      <Typography variant="body2">{att.originalName || att.filename}</Typography>
                    </Stack>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setExistingAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}

                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<UploadIcon />}
                  sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
                >
                  Upload Files
                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setNewFiles((prev) => [...prev, ...files]);
                    }}
                  />
                </Button>

                {newFiles.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      New files to upload ({newFiles.length}):
                    </Typography>
                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      {newFiles.map((file, i) => (
                        <Stack
                          key={i}
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          sx={{ px: 1, py: 0.5, bgcolor: 'background.paper', borderRadius: 1 }}
                        >
                          <Typography variant="caption">{file.name}</Typography>
                          <IconButton
                            size="small"
                            onClick={() => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Paper>
          </form>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} disabled={submitting} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="land-exchange-form"
          variant="contained"
          disabled={submitting}
          sx={{ textTransform: 'none', fontWeight: 600, px: 3 }}
        >
          {submitting ? <CircularProgress size={22} color="inherit" /> : exchangeId ? 'Update Exchange' : 'Save Exchange Record'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
