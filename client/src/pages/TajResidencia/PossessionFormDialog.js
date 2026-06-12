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
import { Add, Delete } from '@mui/icons-material';
import { getMozas, getMozaKhasras } from '../../services/landAcquisitionMozaService';
import { getRegistries, getRegistry } from '../../services/landAcquisitionRegistryService';
import {
  getNextPossessionRef,
  getPossessedTotals,
  getPossessionStatus
} from '../../services/landAcquisitionPossessionService';
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
import {
  formatKhasraSelectLabel,
  resolveKhasraFields,
  sortKhasraEntries
} from '../../utils/landKhasraDisplay';

const calcTransferPercent = (totalPossessed, plotArea) => {
  const possessedSarsais = toSarsais(totalPossessed);
  const plotSarsais = toSarsais(plotArea);
  if (!plotSarsais || !possessedSarsais) return 0;
  return Math.min(100, Math.round((possessedSarsais / plotSarsais) * 10000) / 100);
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
  registryKhasraEntry: '',
  registryKhewatNo: '',
  registryKhasraNo: '',
  khasraEntry: '',
  registry: '',
  khewatNo: '',
  khasraNo: '',
  khasraArea: emptyArea(),
  possessedArea: emptyArea(),
  remarks: ''
});

const khasraEntryId = (entry) => {
  if (!entry) return '';
  if (typeof entry === 'object' && entry._id) return entry._id;
  return String(entry);
};

/** Build possession rows from a linked registry document. */
const linesFromRegistry = (registry, registryId, mozaKhasras = []) => {
  if (!registry?.lines?.length) return [emptyLine()];
  return registry.lines.map((line) => {
    const entryId = khasraEntryId(line.khasraEntry);
    const fields = resolveKhasraFields(entryId, mozaKhasras, line);
    const registeredArea = areaToForm(line.acquiredArea || {});
    return {
      registryKhasraEntry: entryId,
      registryKhewatNo: fields.khewatNo,
      registryKhasraNo: fields.khasraNo,
      khasraEntry: entryId,
      registry: registryId,
      khewatNo: fields.khewatNo,
      khasraNo: fields.khasraNo,
      khasraArea: registeredArea,
      possessedArea: registeredArea,
      remarks: line.remarks || ''
    };
  });
};

const possessionToForm = (doc) => ({
  possessionDate: doc.possessionDate ? doc.possessionDate.slice(0, 10) : '',
  moza: doc.moza?._id || doc.moza || '',
  totalArea: areaToForm(doc.totalArea),
  possessionRef: doc.possessionRef || '',
  registry: doc.registry?._id || doc.registry || '',
  lines: (doc.lines || []).length
    ? (doc.lines || []).map((line) => ({
      registryKhasraEntry: line.registryKhasraEntry || '',
      registryKhewatNo: line.registryKhewatNo || '',
      registryKhasraNo: line.registryKhasraNo || '',
      khasraEntry: line.khasraEntry || '',
      registry: line.registry || '',
      khewatNo: line.khewatNo || '',
      khasraNo: line.khasraNo || '',
      khasraArea: areaToForm(line.khasraArea || {}),
      possessedArea: areaToForm(line.possessedArea),
      remarks: line.remarks || ''
    }))
    : [emptyLine()]
});

const uniqueKhewatNos = (lines) =>
  [...new Set(lines.map((l) => String(l.khewatNo || '').trim()).filter(Boolean))];

const AreaInputs = ({ value, onChange, readOnly = false }) => (
  <Stack direction="row" spacing={0.5}>
    {['kanal', 'marla', 'sarsai'].map((unit) => (
      <TextField
        key={unit}
        size="small"
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

const PossessionFormDialog = ({ open, onClose, onSave, possession, saving }) => {
  const [form, setForm] = useState({
    possessionDate: '',
    moza: '',
    totalArea: emptyArea(),
    possessionRef: '',
    registry: '',
    lines: []
  });
  const [mozas, setMozas] = useState([]);
  const [mozaKhasras, setMozaKhasras] = useState([]);
  const [registries, setRegistries] = useState([]);
  const [statusByKhasra, setStatusByKhasra] = useState({});
  const [possessedTotals, setPossessedTotals] = useState({});

  useEffect(() => {
    if (!open) return;
    getMozas().then((res) => setMozas(res.data?.data || [])).catch(() => setMozas([]));
    if (possession) {
      setForm(possessionToForm(possession));
    } else {
      setForm({
        possessionDate: new Date().toISOString().slice(0, 10),
        moza: '',
        totalArea: emptyArea(),
        possessionRef: '',
        registry: '',
        lines: []
      });
    }
  }, [open, possession]);

  useEffect(() => {
    if (!open || !form.moza) {
      setMozaKhasras([]);
      setRegistries([]);
      setStatusByKhasra({});
      setPossessedTotals({});
      if (!possession) {
        setForm((prev) => (prev.moza ? { ...prev, possessionRef: '' } : prev));
      }
      return;
    }
    getMozaKhasras(form.moza)
      .then((res) => setMozaKhasras(res.data?.data || []))
      .catch(() => setMozaKhasras([]));
    getRegistries({ moza: form.moza, limit: 200 })
      .then((res) => setRegistries(res.data?.data?.registries || []))
      .catch(() => setRegistries([]));
    getPossessionStatus({ moza: form.moza })
      .then((res) => {
        const map = {};
        (res.data?.data?.rows || []).forEach((row) => {
          map[row.khasraEntryId] = row;
        });
        setStatusByKhasra(map);
      })
      .catch(() => setStatusByKhasra({}));
    getPossessedTotals(form.moza, possession?._id)
      .then((res) => setPossessedTotals(res.data?.data || {}))
      .catch(() => setPossessedTotals({}));
    if (!possession) {
      getNextPossessionRef(form.moza)
        .then((res) => {
          const ref = res.data?.data?.possessionRef || '';
          setForm((prev) => (prev.moza === form.moza ? { ...prev, possessionRef: ref } : prev));
        })
        .catch(() => {});
    }
  }, [open, form.moza, possession]);

  const khasraOptions = useMemo(() => sortKhasraEntries(mozaKhasras), [mozaKhasras]);

  // Keep line khasra/khewat aligned with moza master data (fixes stale swapped values)
  useEffect(() => {
    if (!open || !form.moza || !mozaKhasras.length) return;
    setForm((prev) => {
      let changed = false;
      const lines = prev.lines.map((line) => {
        const next = { ...line };
        if (line.khasraEntry) {
          const possessed = resolveKhasraFields(line.khasraEntry, mozaKhasras, line);
          if (line.khewatNo !== possessed.khewatNo || line.khasraNo !== possessed.khasraNo) {
            next.khewatNo = possessed.khewatNo;
            next.khasraNo = possessed.khasraNo;
            changed = true;
          }
        }
        if (line.registryKhasraEntry) {
          const registry = resolveKhasraFields(line.registryKhasraEntry, mozaKhasras, {
            khewatNo: line.registryKhewatNo,
            khasraNo: line.registryKhasraNo
          });
          if (line.registryKhewatNo !== registry.khewatNo || line.registryKhasraNo !== registry.khasraNo) {
            next.registryKhewatNo = registry.khewatNo;
            next.registryKhasraNo = registry.khasraNo;
            changed = true;
          }
        }
        return next;
      });
      return changed ? { ...prev, lines } : prev;
    });
  }, [open, form.moza, mozaKhasras]);

  const linkedRegistry = useMemo(
    () => registries.find((r) => r._id === form.registry) || null,
    [registries, form.registry]
  );

  const registryKhasraOptions = useMemo(() => {
    if (linkedRegistry?.lines?.length) {
      const ids = new Set(linkedRegistry.lines.map((l) => String(l.khasraEntry)));
      return sortKhasraEntries(mozaKhasras.filter((k) => ids.has(String(k._id))));
    }
    return sortKhasraEntries(
      mozaKhasras.filter((k) => {
        const status = statusByKhasra[k._id];
        return status && toSarsais(status.registered) > 0;
      })
    );
  }, [linkedRegistry, mozaKhasras, statusByKhasra]);

  const findKhasraOption = (entryId, khasraNo, khewatNo) => {
    if (entryId) {
      return khasraOptions.find((k) => k._id === entryId) || null;
    }
    if (khasraNo && khewatNo) {
      return khasraOptions.find(
        (k) => String(k.khasraNo) === String(khasraNo) && String(k.khewatNo) === String(khewatNo)
      ) || null;
    }
    return null;
  };

  const registeredAreaForRegistryKhasra = (entryId) => {
    const regLine = linkedRegistry?.lines?.find((l) => String(l.khasraEntry) === String(entryId));
    if (regLine?.acquiredArea) return regLine.acquiredArea;
    const status = statusByKhasra[entryId];
    return status?.registered || { kanal: 0, marla: 0, sarsai: 0 };
  };

  const landInKhasraForEntry = (entryId) => {
    const entry = mozaKhasras.find((k) => String(k._id) === String(entryId));
    return entry?.landInKhasra ? areaToForm(entry.landInKhasra) : emptyArea();
  };

  /** Registered / registry area for the selected Registry Khasra (source). */
  const khasraAreaForLine = (line, { registryEntryId } = {}) => {
    const registryId = registryEntryId || line.registryKhasraEntry;
    if (!registryId) return emptyArea();
    return areaToForm(registeredAreaForRegistryKhasra(registryId));
  };

  const priorPossessedForKhasra = (khasraEntryId) =>
    normalizeArea(possessedTotals[String(khasraEntryId || '')] || {});

  const plotAreaForPossessedLine = (line) =>
    parseAreaForm(landInKhasraForEntry(line.khasraEntry));

  const totalLandPossessedForLine = (line) =>
    addAreas(priorPossessedForKhasra(line.khasraEntry), parseAreaForm(line.possessedArea));

  const transferPercentForLine = (line) =>
    calcTransferPercent(totalLandPossessedForLine(line), plotAreaForPossessedLine(line));

  const lineExceedsPlot = (line) => {
    const plot = plotAreaForPossessedLine(line);
    if (!line.khasraEntry || !toSarsais(plot)) return false;
    return toSarsais(totalLandPossessedForLine(line)) > toSarsais(plot);
  };

  const remainingPlotForLine = (line) => {
    if (!line.khasraEntry) return null;
    return subtractAreas(plotAreaForPossessedLine(line), priorPossessedForKhasra(line.khasraEntry));
  };

  useEffect(() => {
    if (!open || !form.moza) return;
    setForm((prev) => {
      let changed = false;
      const lines = prev.lines.map((line) => {
        if (!line.registryKhasraEntry) return line;
        const nextArea = khasraAreaForLine(line);
        if (toSarsais(parseAreaForm(line.khasraArea)) === toSarsais(parseAreaForm(nextArea))) return line;
        changed = true;
        return { ...line, khasraArea: nextArea };
      });
      return changed ? { ...prev, lines } : prev;
    });
  }, [open, form.moza, statusByKhasra, linkedRegistry]);

  const possessedTotal = useMemo(
    () => addAreas(...form.lines.map((line) => parseAreaForm(line.possessedArea))),
    [form.lines]
  );

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({
      ...prev,
      totalArea: {
        kanal: possessedTotal.kanal ? String(possessedTotal.kanal) : '',
        marla: possessedTotal.marla ? String(possessedTotal.marla) : '',
        sarsai: possessedTotal.sarsai ? String(possessedTotal.sarsai) : ''
      }
    }));
  }, [open, possessedTotal.kanal, possessedTotal.marla, possessedTotal.sarsai]);

  const setHeader = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleRegistryLinkChange = async (e) => {
    const registryId = e.target.value;
    if (!registryId) {
      setForm((prev) => ({
        ...prev,
        registry: '',
        lines: prev.moza ? [emptyLine()] : []
      }));
      return;
    }

    let registry = registries.find((r) => r._id === registryId) || null;
    if (!registry?.lines?.length) {
      try {
        const res = await getRegistry(registryId);
        registry = res.data?.data || registry;
      } catch {
        // fall back to list item if detail fetch fails
      }
    }

    setForm((prev) => ({
      ...prev,
      registry: registryId,
      lines: linesFromRegistry(registry, registryId, mozaKhasras)
    }));
  };

  const handleMozaChange = (mozaId) => {
    setForm({
      possessionDate: form.possessionDate,
      moza: mozaId,
      totalArea: emptyArea(),
      possessionRef: '',
      registry: '',
      lines: mozaId ? [emptyLine()] : []
    });
  };

  const updateLine = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, ...patch } : line))
    }));
  };

  const handleRegistryKhasraSelect = (index, entry) => {
    const line = form.lines[index];
    if (!entry) {
      updateLine(index, {
        registryKhasraEntry: '',
        registryKhewatNo: '',
        registryKhasraNo: '',
        khasraArea: khasraAreaForLine({ ...line, registryKhasraEntry: '' })
      });
      return;
    }
    updateLine(index, {
      registryKhasraEntry: entry._id,
      registryKhewatNo: entry.khewatNo,
      registryKhasraNo: entry.khasraNo,
      khasraArea: khasraAreaForLine({ ...line, registryKhasraEntry: entry._id })
    });
  };

  const handleAllocatedKhasraSelect = (index, entry) => {
    const line = form.lines[index];
    if (!entry) {
      updateLine(index, {
        khasraEntry: '',
        khewatNo: '',
        khasraNo: ''
      });
      return;
    }
    updateLine(index, {
      khasraEntry: entry._id,
      khewatNo: entry.khewatNo,
      khasraNo: entry.khasraNo
    });
  };

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

  const handleSubmit = () => {
    const khewatNos = uniqueKhewatNos(form.lines);
    onSave({
      possessionDate: form.possessionDate,
      moza: form.moza,
      khewatNo: khewatNos.join(', '),
      totalArea: parseAreaForm(form.totalArea),
      possessionRef: possession ? form.possessionRef.trim() : undefined,
      registry: form.registry || undefined,
      lines: form.lines.map((line) => ({
        registryKhasraEntry: line.registryKhasraEntry || undefined,
        registryKhewatNo: line.registryKhewatNo.trim(),
        registryKhasraNo: line.registryKhasraNo.trim(),
        registeredArea: parseAreaForm(line.khasraArea),
        khasraEntry: line.khasraEntry || undefined,
        registry: line.registry || form.registry || undefined,
        khewatNo: line.khewatNo.trim(),
        khasraNo: line.khasraNo.trim(),
        khasraArea: parseAreaForm(line.khasraArea),
        possessedArea: parseAreaForm(line.possessedArea),
        totalLandPossessed: totalLandPossessedForLine(line),
        transferPercent: transferPercentForLine(line),
        remarks: line.remarks.trim()
      }))
    });
  };

  const selectedMoza = mozas.find((m) => m._id === form.moza);
  const hasValidLines = form.lines.some((l) => l.khasraEntry && l.khasraNo.trim());

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="xl" fullWidth>
      <DialogTitle>{possession ? 'Edit Possession' : 'Add Possession'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={4} md={2}>
            <TextField
              fullWidth
              required
              type="date"
              label="Possession Date"
              value={form.possessionDate}
              onChange={setHeader('possessionDate')}
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
          <Grid item xs={12} sm={4} md={2}>
            <TextField
              fullWidth
              label="Possession Ref"
              value={form.possessionRef}
              InputProps={{ readOnly: true }}
              helperText={possession ? ' ' : 'Auto-generated'}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              select
              label="Link Registry"
              value={form.registry}
              onChange={handleRegistryLinkChange}
              disabled={!form.moza}
              helperText={
                linkedRegistry
                  ? `Pre-filled ${linkedRegistry.lines?.length || 0} khasra row(s) from registry`
                  : 'Optional — auto-fills khasra rows'
              }
            >
              <MenuItem value="">None</MenuItem>
              {registries.map((r) => (
                <MenuItem key={r._id} value={r._id}>
                  {r.registryNo}{r.inteqalNo ? ` / ${r.inteqalNo}` : ''}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Total Possessed (K · M · S)
            </Typography>
            <AreaInputs value={form.totalArea} onChange={() => {}} readOnly />
            <Typography variant="caption" color="text.secondary">
              {formatKMS(possessedTotal)}
            </Typography>
          </Grid>
        </Grid>

        {selectedMoza && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Mouza {selectedMoza.name} — registry khasra for Khasra Area; possessed khasra for physical possession. Total Land Possessed and Transfer % update from prior possession plus this entry.
          </Typography>
        )}

        {!form.moza ? (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', mb: 2 }}>
            <Typography color="text.secondary">Select a mouza to add allocation rows.</Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 440 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Registry Khasra</strong></TableCell>
                  <TableCell><strong>Possessed Khasra</strong></TableCell>
                  <TableCell><strong>Khasra Area</strong></TableCell>
                  <TableCell><strong>Possessed Area</strong></TableCell>
                  <TableCell><strong>Total Land Owned</strong></TableCell>
                  <TableCell width={80}><strong>Transfer %</strong></TableCell>
                  <TableCell><strong>Remarks</strong></TableCell>
                  <TableCell width={48} />
                </TableRow>
              </TableHead>
              <TableBody>
                {form.lines.map((line, index) => {
                  const priorPossessed = priorPossessedForKhasra(line.khasraEntry);
                  const totalPossessed = totalLandPossessedForLine(line);
                  const transferPct = transferPercentForLine(line);
                  const rowPlotError = lineExceedsPlot(line);
                  const remainingPlot = remainingPlotForLine(line);

                  return (
                    <TableRow key={`line-${index}`}>
                      <TableCell>
                        <Autocomplete
                          size="small"
                          disablePortal
                          options={registryKhasraOptions}
                          value={findKhasraOption(
                            line.registryKhasraEntry,
                            line.registryKhasraNo,
                            line.registryKhewatNo
                          )}
                          onChange={(_, entry) => handleRegistryKhasraSelect(index, entry)}
                          getOptionLabel={formatKhasraSelectLabel}
                          isOptionEqualToValue={(a, b) => a._id === b._id}
                          noOptionsText={linkedRegistry ? 'No khasras in linked registry' : 'No registered khasras'}
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
                            <TextField {...params} placeholder="Optional source…" />
                          )}
                          sx={{ minWidth: 190 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Autocomplete
                            size="small"
                            disablePortal
                            options={khasraOptions}
                            value={findKhasraOption(line.khasraEntry, line.khasraNo, line.khewatNo)}
                            onChange={(_, entry) => handleAllocatedKhasraSelect(index, entry)}
                            getOptionLabel={formatKhasraSelectLabel}
                            isOptionEqualToValue={(a, b) => a._id === b._id}
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
                              <TextField {...params} placeholder="Possessed khasra…" required />
                            )}
                            sx={{ minWidth: 190 }}
                          />
                          {line.khasraEntry && (
                            <Typography variant="caption" color="text.secondary">
                              Total khasra area: {formatKMS(parseAreaForm(landInKhasraForEntry(line.khasraEntry)))}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <AreaInputs value={line.khasraArea} onChange={() => {}} readOnly />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <AreaInputs
                            value={line.possessedArea}
                            onChange={(area) => updateLine(index, { possessedArea: area })}
                          />
                          {rowPlotError && line.khasraEntry && (
                            <Typography variant="caption" color="error">
                              Max: {formatKMSOrZero(remainingPlot)}
                            </Typography>
                          )}
                          {line.khasraEntry && !rowPlotError && remainingPlot && (
                            <Typography variant="caption" color="text.secondary">
                              Max: {formatKMSOrZero(remainingPlot)}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <AreaInputs value={areaToForm(totalPossessed)} onChange={() => {}} readOnly />
                          {line.khasraEntry && (
                            <Typography variant="caption" color={rowPlotError ? 'error' : 'text.secondary'}>
                              Prior: {formatKMS(priorPossessed)}
                              {rowPlotError ? ' · exceeds plot area' : ''}
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
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell colSpan={4}><strong>TOTAL (This Possession)</strong></TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>{formatKMS(possessedTotal)}</Typography>
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={
            saving
            || !form.possessionDate
            || !form.moza
            || !hasValidLines
            || form.lines.some(lineExceedsPlot)
          }
        >
          {saving ? 'Saving…' : possession ? 'Update Possession' : 'Submit Possession'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PossessionFormDialog;
