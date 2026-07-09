import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { Add, AttachFile, Delete } from '@mui/icons-material';
import { getMozas, getMozaKhasras } from '../../services/landAcquisitionMozaService';
import { getRegisteredTotals } from '../../services/landAcquisitionRegistryService';
import landAcquisitionPartyService from '../../services/landAcquisitionPartyService';
import {
  addAreas,
  areaToForm,
  emptyArea,
  formatKMS,
  normalizeArea,
  parseAreaForm,
  subtractAreas,
  toSarsais
} from '../../utils/landAreaUnits';
import { formatKhasraSelectLabel, sortKhasraEntries } from '../../utils/landKhasraDisplay';

const calcTransferPercent = (totalOwned, khasraArea) => {
  const ownedSarsais = toSarsais(totalOwned);
  const khasraSarsais = toSarsais(khasraArea);
  if (!khasraSarsais || !ownedSarsais) return 0;
  return Math.round((ownedSarsais / khasraSarsais) * 10000) / 100;
};

const formatTransferPercent = (pct) => {
  if (!pct) return '0';
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(2);
};

const formatKMSOrZero = (area) => {
  const a = normalizeArea(area || {});
  if (!a.kanal && !a.marla && !a.sarsai) return '0-0-0';
  return formatKMS(a);
};

const emptyLine = () => ({
  khasraEntry: '',
  khewatNo: '',
  khasraNo: '',
  khasraArea: emptyArea(),
  acquiredArea: emptyArea(),
  remarks: ''
});

const registryToForm = (registry) => ({
  registryDate: registry.registryDate ? registry.registryDate.slice(0, 10) : '',
  moza: registry.moza?._id || registry.moza || '',
  totalArea: areaToForm(registry.totalArea),
  registryNo: registry.registryNo || '',
  inteqalNo: registry.inteqalNo || '',
  dealer: registry.dealer || null,
  lines: (registry.lines || []).length
    ? (registry.lines || []).map((line) => ({
      khasraEntry: line.khasraEntry || '',
      khewatNo: line.khewatNo || '',
      khasraNo: line.khasraNo || '',
      khasraArea: areaToForm(line.khasraArea),
      acquiredArea: areaToForm(line.acquiredArea),
      remarks: line.remarks || ''
    }))
    : [emptyLine()]
});

const uniqueKhewatNos = (lines) =>
  [...new Set(lines.map((l) => String(l.khewatNo || '').trim()).filter(Boolean))];

const AreaInputs = ({ value, onChange, readOnly = false, size = 'small' }) => (
  <Stack direction="row" spacing={0.5}>
    {['kanal', 'marla', 'sarsai'].map((unit) => (
      <TextField
        key={unit}
        size={size}
        label={unit === 'kanal' ? 'K' : unit === 'marla' ? 'M' : 'S'}
        type="number"
        value={value[unit]}
        onChange={(e) => onChange({ ...value, [unit]: e.target.value })}
        inputProps={{ min: 0 }}
        disabled={readOnly}
        sx={{ width: 72 }}
      />
    ))}
  </Stack>
);

const RegistryFormDialog = ({ open, onClose, onSave, registry, saving }) => {
  const [form, setForm] = useState({
    registryDate: '',
    moza: '',
    totalArea: emptyArea(),
    registryNo: '',
    inteqalNo: '',
    dealer: null,
    lines: []
  });
  const [mozas, setMozas] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [mozaKhasras, setMozaKhasras] = useState([]);
  const [registeredTotals, setRegisteredTotals] = useState({});
  const [newFiles, setNewFiles] = useState([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState([]);

  useEffect(() => {
    if (!open) return;
    getMozas().then((res) => setMozas(res.data?.data || [])).catch(() => setMozas([]));
    landAcquisitionPartyService.getParties({ type: 'dealer', limit: 100, page: 1 })
      .then((res) => setDealers(res.data || []))
      .catch(() => setDealers([]));
    setNewFiles([]);
    setRemovedAttachmentIds([]);
    if (registry) {
      setForm(registryToForm(registry));
    } else {
      setForm({
        registryDate: new Date().toISOString().slice(0, 10),
        moza: '',
        totalArea: emptyArea(),
        registryNo: '',
        inteqalNo: '',
        dealer: null,
        lines: []
      });
    }
  }, [open, registry]);

  useEffect(() => {
    if (!open || !form.moza) {
      setMozaKhasras([]);
      return;
    }
    getMozaKhasras(form.moza)
      .then((res) => setMozaKhasras(res.data?.data || []))
      .catch(() => setMozaKhasras([]));
  }, [open, form.moza]);

  useEffect(() => {
    if (!open || !form.moza) {
      setRegisteredTotals({});
      return;
    }
    getRegisteredTotals(form.moza, registry?._id)
      .then((res) => setRegisteredTotals(res.data?.data || {}))
      .catch(() => setRegisteredTotals({}));
  }, [open, form.moza, registry?._id]);

  const priorOwnedForKhasra = (khasraEntryId) =>
    normalizeArea(registeredTotals[String(khasraEntryId || '')] || {});

  const totalLandOwnedForLine = (line) =>
    addAreas(priorOwnedForKhasra(line.khasraEntry), parseAreaForm(line.acquiredArea));

  const transferPercentForLine = (line) =>
    calcTransferPercent(totalLandOwnedForLine(line), parseAreaForm(line.khasraArea));

  const khasraAreaForLine = (line) => parseAreaForm(line.khasraArea);

  const remainingKhasraForLine = (line) => {
    if (!line.khasraEntry || !toSarsais(khasraAreaForLine(line))) return null;
    return subtractAreas(khasraAreaForLine(line), priorOwnedForKhasra(line.khasraEntry));
  };

  const lineExceedsKhasra = (line) => {
    return false; // Disabled restriction to allow exceeding khasra area
  };

  const acquiredTotal = useMemo(
    () => addAreas(...form.lines.map((line) => parseAreaForm(line.acquiredArea))),
    [form.lines]
  );

  const totalAreaParsed = useMemo(() => parseAreaForm(form.totalArea), [form.totalArea]);
  const hasTotalArea = toSarsais(totalAreaParsed) > 0;
  const linesExceedTotal = hasTotalArea && toSarsais(acquiredTotal) > toSarsais(totalAreaParsed);
  const lineExceedsTotal = (line) =>
    hasTotalArea && toSarsais(parseAreaForm(line.acquiredArea)) > toSarsais(totalAreaParsed);
  const remainingArea = hasTotalArea ? subtractAreas(totalAreaParsed, acquiredTotal) : null;

  const setHeader = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleMozaChange = (mozaId) => {
    setForm({
      registryDate: form.registryDate,
      moza: mozaId,
      totalArea: emptyArea(),
      registryNo: form.registryNo,
      inteqalNo: form.inteqalNo,
      dealer: form.dealer?._id || undefined,
      lines: mozaId ? [emptyLine()] : []
    });
  };

  const khasraOptions = useMemo(() => sortKhasraEntries(mozaKhasras), [mozaKhasras]);

  // Keep line khasra/khewat aligned with moza master data (fixes stale swapped values)
  useEffect(() => {
    if (!open || !form.moza || !mozaKhasras.length) return;
    setForm((prev) => {
      let changed = false;
      const lines = prev.lines.map((line) => {
        if (!line.khasraEntry && !line.khasraNo) return line;
        let entry = null;
        const entryId = line.khasraEntry?._id || line.khasraEntry;
        if (entryId) {
          entry = mozaKhasras.find((k) => String(k._id) === String(entryId));
        } else {
          entry = mozaKhasras.find((k) => k.khasraNo === line.khasraNo && k.khewatNo === line.khewatNo);
        }
        if (!entry) return line;
        if (line.khewatNo === entry.khewatNo && line.khasraNo === entry.khasraNo) return line;
        changed = true;
        return {
          ...line,
          khewatNo: entry.khewatNo,
          khasraNo: entry.khasraNo,
          khasraArea: areaToForm(entry.landInKhasra)
        };
      });
      return changed ? { ...prev, lines } : prev;
    });
  }, [open, form.moza, mozaKhasras]);

  const findKhasraOption = (line) => {
    if (line.khasraEntry) {
      return khasraOptions.find((k) => k._id === line.khasraEntry) || null;
    }
    if (line.khasraNo && line.khewatNo) {
      return khasraOptions.find(
        (k) => String(k.khasraNo) === String(line.khasraNo)
          && String(k.khewatNo) === String(line.khewatNo)
      ) || null;
    }
    return null;
  };

  const updateLine = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, ...patch } : line))
    }));
  };

  const handleKhasraSelect = (index, entry) => {
    if (!entry) {
      updateLine(index, {
        khasraEntry: '',
        khewatNo: '',
        khasraNo: '',
        khasraArea: emptyArea(),
        acquiredArea: emptyArea()
      });
      return;
    }
    updateLine(index, {
      khasraEntry: entry._id,
      khewatNo: entry.khewatNo,
      khasraNo: entry.khasraNo,
      khasraArea: areaToForm(entry.landInKhasra),
      acquiredArea: emptyArea()
    });
  };

  const isKhasraTaken = (entryId, lineIndex) =>
    form.lines.some((line, i) => i !== lineIndex && line.khasraEntry === entryId);

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, emptyLine()]
    }));
  };

  const removeLine = (index) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.length > 1
        ? prev.lines.filter((_, i) => i !== index)
        : prev.lines
    }));
  };

  const existingAttachments = (registry?.attachments || []).filter(
    (att) => !removedAttachmentIds.includes(String(att._id))
  );

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter(
      (file) => file.type.startsWith('image/') || file.type === 'application/pdf'
    );
    if (!valid.length) {
      e.target.value = '';
      return;
    }
    const currentCount = existingAttachments.length + newFiles.length;
    const room = Math.max(0, 10 - currentCount);
    if (room === 0) {
      e.target.value = '';
      return;
    }
    setNewFiles((prev) => [...prev, ...valid.slice(0, room)]);
    e.target.value = '';
  };

  const removeNewFile = (index) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (attachmentId) => {
    setRemovedAttachmentIds((prev) => [...prev, attachmentId]);
  };

  const handleSubmit = () => {
    const khewatNos = uniqueKhewatNos(form.lines);
    onSave({
      payload: {
        registryDate: form.registryDate,
        moza: form.moza,
        khewatNos,
        khewatNo: khewatNos.join(', '),
        totalArea: parseAreaForm(form.totalArea),
        registryNo: form.registryNo.trim(),
        inteqalNo: form.inteqalNo.trim(),
        dealer: form.dealer?._id || undefined,
        lines: form.lines.map((line) => ({
          khasraEntry: line.khasraEntry || undefined,
          khewatNo: line.khewatNo.trim(),
          khasraNo: line.khasraNo.trim(),
          khasraArea: parseAreaForm(line.khasraArea),
          landOfKhasra: emptyArea(),
          acquiredArea: parseAreaForm(line.acquiredArea),
          landWithMalkiyat: totalLandOwnedForLine(line),
          transferPercent: transferPercentForLine(line),
          remarks: line.remarks.trim()
        }))
      },
      files: newFiles,
      removedAttachmentIds
    });
  };

  const selectedMoza = mozas.find((m) => m._id === form.moza);
  const hasValidLines = form.lines.some((l) => l.khewatNo.trim() && l.khasraNo.trim());

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="xl" fullWidth>
      <DialogTitle>{registry ? 'Edit Registry' : 'Add Registry'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={4} md={2}>
            <TextField
              fullWidth
              required
              type="date"
              label="Registry Date"
              value={form.registryDate}
              onChange={setHeader('registryDate')}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              fullWidth
              required
              select
              label="Select Moza"
              value={form.moza}
              onChange={(e) => handleMozaChange(e.target.value)}
            >
              {mozas.map((m) => (
                <MenuItem key={m._id} value={m._id}>Mouza {m.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Total Area (K · M · Sarsai) *
            </Typography>
            <AreaInputs
              value={form.totalArea}
              onChange={(area) => setForm((prev) => ({ ...prev, totalArea: area }))}
            />
            <Typography
              variant="caption"
              color={linesExceedTotal ? 'error' : 'text.secondary'}
            >
              {hasTotalArea
                ? `Allocated ${formatKMS(acquiredTotal)} · Remaining ${formatKMS(remainingArea)}`
                : 'Enter total area for this registry'}
              {linesExceedTotal ? ' · exceeds total area' : ''}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              label="Registry No."
              value={form.registryNo}
              onChange={setHeader('registryNo')}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              label="Inteqal No."
              value={form.inteqalNo}
              onChange={setHeader('inteqalNo')}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Autocomplete
              size="small"
              options={dealers}
              getOptionLabel={(option) => option?.name || ''}
              value={form.dealer}
              onChange={(_, value) => setForm((prev) => ({ ...prev, dealer: value }))}
              renderInput={(params) => (
                <TextField {...params} label="Dealer" placeholder="Select dealer" />
              )}
            />
          </Grid>
        </Grid>

        {selectedMoza && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Mouza {selectedMoza.name} — select a khasra and enter area in this registry; total land owned and transfer % update automatically.
          </Typography>
        )}

        {!form.moza ? (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', mb: 2 }}>
            <Typography color="text.secondary">Select a mouza to add khasra rows.</Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Khewat No.</strong></TableCell>
                  <TableCell><strong>Khasra No.</strong></TableCell>
                  <TableCell><strong>Khasra Area (K·M·S)</strong></TableCell>
                  <TableCell><strong>Area in Registry</strong></TableCell>
                  <TableCell><strong>Total Land Owned</strong></TableCell>
                  <TableCell width={80}><strong>Transfer %</strong></TableCell>
                  <TableCell><strong>Remarks</strong></TableCell>
                  <TableCell width={48} />
                </TableRow>
              </TableHead>
              <TableBody>
                {form.lines.map((line, index) => {
                  const priorOwned = priorOwnedForKhasra(line.khasraEntry);
                  const totalOwned = totalLandOwnedForLine(line);
                  const transferPct = transferPercentForLine(line);
                  const remainingKhasra = remainingKhasraForLine(line);
                  const rowAreaError = lineExceedsTotal(line);
                  const rowKhasraError = lineExceedsKhasra(line);

                  return (
                    <TableRow key={line.khasraEntry || `line-${index}`}>
                      <TableCell>
                        <TextField
                          size="small"
                          value={line.khewatNo}
                          InputProps={{ readOnly: true }}
                          placeholder="—"
                          sx={{ width: 88 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Autocomplete
                          size="small"
                          disablePortal
                          options={khasraOptions}
                          value={findKhasraOption(line)}
                          onChange={(_, entry) => handleKhasraSelect(index, entry)}
                          getOptionLabel={formatKhasraSelectLabel}
                          isOptionEqualToValue={(a, b) => a._id === b._id}
                          getOptionDisabled={(option) => isKhasraTaken(option._id, index)}
                          noOptionsText="No khasras in this mouza"
                          renderOption={(props, option) => (
                            <li {...props} key={option._id}>
                              <Box>
                                <Typography variant="body2">Khasra {option.khasraNo}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Khewat {option.khewatNo}
                                </Typography>
                              </Box>
                            </li>
                          )}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Select khasra…"
                              required
                            />
                          )}
                          sx={{ minWidth: 200 }}
                        />
                      </TableCell>
                      <TableCell>
                        <AreaInputs value={line.khasraArea} onChange={() => {}} readOnly />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <AreaInputs
                            value={line.acquiredArea}
                            onChange={(area) => updateLine(index, { acquiredArea: area })}
                          />
                          {rowAreaError && hasTotalArea && (
                            <Typography variant="caption" color="error">
                              Cannot exceed registry total area
                            </Typography>
                          )}
                          {rowKhasraError && (
                            <Typography variant="caption" color="error">
                              Max for this khasra: {formatKMSOrZero(remainingKhasra)}
                            </Typography>
                          )}
                          {line.khasraEntry && !rowKhasraError && remainingKhasra != null && (
                            <Typography variant="caption" color="text.secondary">
                              Max: {formatKMSOrZero(remainingKhasra)}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <AreaInputs
                            value={areaToForm(totalOwned)}
                            onChange={() => {}}
                            readOnly
                          />
                          {line.khasraEntry && (
                            <Typography variant="caption" color="text.secondary">
                              Prior: {formatKMS(priorOwned)}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={formatTransferPercent(transferPct)}
                          InputProps={{ readOnly: true }}
                          sx={{ width: 72 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={line.remarks}
                          onChange={(e) => updateLine(index, { remarks: e.target.value })}
                          fullWidth
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeLine(index)}
                          disabled={form.lines.length <= 1}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {form.lines.length > 0 && (
                  <TableRow sx={{ bgcolor: linesExceedTotal ? 'error.light' : 'grey.100' }}>
                    <TableCell colSpan={3}><strong>Allocated in rows</strong></TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} color={linesExceedTotal ? 'error' : 'inherit'}>
                        {formatKMS(acquiredTotal)}
                      </Typography>
                    </TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Box sx={{ mt: 1 }}>
          <Button startIcon={<Add />} onClick={addLine} disabled={!form.moza}>
            Add Row
          </Button>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Attachments (PDF or image)
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Button variant="outlined" component="label" startIcon={<AttachFile />} size="small">
              Add file
              <input
                type="file"
                hidden
                multiple
                accept="image/*,.pdf,application/pdf"
                onChange={handleFileSelect}
              />
            </Button>
            <Typography variant="caption" color="text.secondary">
              Up to 10 MB each · PDF, JPG, PNG, etc.
            </Typography>
          </Stack>
          {!existingAttachments.length && !newFiles.length ? (
            <Typography variant="body2" color="text.secondary">
              No attachments added yet.
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {existingAttachments.map((att) => (
                <Stack key={att._id} direction="row" spacing={1} alignItems="center">
                  <AttachFile fontSize="small" color="action" />
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    {att.originalName || att.filename}
                  </Typography>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => removeExistingAttachment(String(att._id))}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              {newFiles.map((file, index) => (
                <Stack key={`${file.name}-${index}`} direction="row" spacing={1} alignItems="center">
                  <AttachFile fontSize="small" color="primary" />
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    {file.name}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      (new)
                    </Typography>
                  </Typography>
                  <IconButton size="small" color="error" onClick={() => removeNewFile(index)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={
            saving
            || !form.registryDate
            || !form.moza
            || !hasValidLines
            || !hasTotalArea
            || linesExceedTotal
            || form.lines.some(lineExceedsTotal)
            || form.lines.some(lineExceedsKhasra)
          }
        >
          {saving ? 'Saving…' : registry ? 'Update Registry' : 'Submit Registry'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RegistryFormDialog;
