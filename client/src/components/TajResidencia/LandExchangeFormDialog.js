import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
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
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  SwapHoriz as ExchangeIcon,
  ArrowForward as ArrowForwardIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import landAcquisitionExchangeService from '../../services/landAcquisitionExchangeService';
import landAcquisitionPartyService from '../../services/landAcquisitionPartyService';
import { getMozas, getMozaKhasras } from '../../services/landAcquisitionMozaService';
import { getRegistries, getRegisteredTotals } from '../../services/landAcquisitionRegistryService';
import {
  addAreas,
  areaToForm,
  emptyArea,
  formatAreaReadable,
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

const AreaInputs = ({ value, onChange, readOnly = false, size = 'small' }) => (
  <Stack direction="row" spacing={0.5}>
    {['kanal', 'marla', 'sarsai'].map((unit) => (
      <TextField
        key={unit}
        size={size}
        label={unit === 'kanal' ? 'K' : unit === 'marla' ? 'M' : 'S'}
        type="number"
        value={value?.[unit] ?? ''}
        onChange={(e) => onChange?.({ ...(value || emptyArea()), [unit]: e.target.value })}
        inputProps={{ min: 0 }}
        disabled={readOnly}
        sx={{ width: 68 }}
      />
    ))}
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
  khasraArea: emptyArea(),
  surrenderedArea: emptyArea(),
  remarks: ''
});

const emptyInLine = () => ({
  id: Math.random().toString(36).substring(2, 9),
  khasraEntry: '',
  khewatNo: '',
  khasraNo: '',
  khasraArea: emptyArea(),
  acquiredArea: emptyArea(),
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
  const [inMozaKhasras, setInMozaKhasras] = useState([]);
  const [inRegisteredTotals, setInRegisteredTotals] = useState({});

  // General Header Form State
  const [exchangeRef, setExchangeRef] = useState('');
  const [exchangeDate, setExchangeDate] = useState(new Date().toISOString().slice(0, 10));
  const [party, setParty] = useState(null);
  const [dealNo, setDealNo] = useState('');
  const [registryNo, setRegistryNo] = useState('');
  const [inteqalNo, setInteqalNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Out Land State
  const [outLandLines, setOutLandLines] = useState([emptyOutLine()]);

  // In Land State (exact same pattern as Add Registry)
  const [inMoza, setInMoza] = useState('');
  const [inTotalArea, setInTotalArea] = useState(emptyArea());
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

  // Load In Land Moza Khasras and Registered Totals when inMoza changes
  useEffect(() => {
    if (!open || !inMoza) {
      setInMozaKhasras([]);
      setInRegisteredTotals({});
      return;
    }
    getMozaKhasras(inMoza)
      .then((res) => setInMozaKhasras(res.data?.data || []))
      .catch(() => setInMozaKhasras([]));

    getRegisteredTotals(inMoza)
      .then((res) => setInRegisteredTotals(res.data?.data || {}))
      .catch(() => setInRegisteredTotals({}));
  }, [open, inMoza]);

  // Initialize or fetch existing exchange
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
          setRegistryNo(d.registryNo || '');
          setInteqalNo(d.inteqalNo || '');
          setRemarks(d.remarks || '');

          const firstInMoza = d.moza?._id || d.moza || (d.inLandLines && d.inLandLines[0]?.moza?._id) || (d.inLandLines && d.inLandLines[0]?.moza) || '';
          setInMoza(firstInMoza);
          setInTotalArea(areaToForm(d.totalInArea || emptyArea()));

          setOutLandLines(
            (d.outLandLines || []).map((l) => ({
              id: l._id || Math.random().toString(36).substring(2, 9),
              registryId: l.registry?._id || l.registry || l.exchangeInId || (l.sourceExchange ? `exchange-in-${l.sourceExchange?._id || l.sourceExchange}-0` : ''),
              registryNo: l.registryNo || l.registry?.registryNo || '',
              inteqalNo: l.inteqalNo || l.registry?.inteqalNo || '',
              moza: l.moza?._id || l.moza || '',
              khasraEntry: l.khasraEntry?._id || l.khasraEntry || '',
              khewatNo: l.khewatNo || '',
              khasraNo: l.khasraNo || '',
              khasraArea: areaToForm(l.khasraArea),
              surrenderedArea: areaToForm(l.surrenderedArea),
              remarks: l.remarks || ''
            }))
          );

          setInLandLines(
            (d.inLandLines || []).length
              ? (d.inLandLines || []).map((l) => ({
                id: l._id || Math.random().toString(36).substring(2, 9),
                khasraEntry: l.khasraEntry?._id || l.khasraEntry || '',
                khewatNo: l.khewatNo || '',
                khasraNo: l.khasraNo || '',
                khasraArea: areaToForm(l.khasraArea),
                acquiredArea: areaToForm(l.acquiredArea),
                registryNo: l.registryNo || '',
                inteqalNo: l.inteqalNo || '',
                remarks: l.remarks || ''
              }))
              : [emptyInLine()]
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

          if (firstInMoza) loadKhasrasForMoza(firstInMoza);
          (d.outLandLines || []).forEach((l) => {
            const mId = l.moza?._id || l.moza;
            if (mId) loadKhasrasForMoza(mId);
          });
        })
        .catch((err) => {
          setError(err.response?.data?.message || 'Failed to load exchange details');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
      setError('');
      setExchangeDate(new Date().toISOString().slice(0, 10));
      setParty(null);
      setDealNo('');
      setRegistryNo('');
      setInteqalNo('');
      setInMoza('');
      setInTotalArea(emptyArea());
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
  }, [open, exchangeId, loadResources, loadKhasrasForMoza]);

  // Keep inLandLines aligned with moza master data (same as RegistryFormDialog)
  useEffect(() => {
    if (!open || !inMoza || !inMozaKhasras.length) return;
    setInLandLines((prev) => {
      let changed = false;
      const lines = prev.map((line) => {
        if (!line.khasraEntry && !line.khasraNo) return line;
        let entry = null;
        const entryId = line.khasraEntry?._id || line.khasraEntry;
        if (entryId) {
          entry = inMozaKhasras.find((k) => String(k._id) === String(entryId));
        } else {
          entry = inMozaKhasras.find((k) =>
            k.khasraNo === line.khasraNo &&
            (!line.khewatNo || k.khewatNo === line.khewatNo)
          );
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
      return changed ? lines : prev;
    });
  }, [open, inMoza, inMozaKhasras]);

  // Out Land line updates
  const handleOutLineChange = (index, field, value) => {
    setOutLandLines((prev) => {
      const updated = [...prev];
      const current = { ...updated[index] };

      if (field === 'moza') {
        current.moza = value;
        current.khasraNo = '';
        current.khasraEntry = '';
        current.registryId = '';
        current.registryNo = '';
        current.inteqalNo = '';
        current.khewatNo = '';
        current.khasraArea = emptyArea();
        current.surrenderedArea = emptyArea();
        if (value) loadKhasrasForMoza(value);
        updated[index] = current;
        return updated;
      } else if (field === 'khasraNo') {
        current.khasraNo = value;

        const khasras = mozaKhasrasMap[current.moza] || [];
        const match = khasras.find((k) => String(k.khasraNo).trim() === String(value).trim());
        const defaultKhewat = match?.khewatNo || '';
        const defaultKhasraArea = match?.landInKhasra ? areaToForm(match.landInKhasra) : emptyArea();
        const defaultKhasraEntry = match?._id || '';

        const matchingRegs = [];
        const seenRegIds = new Set();

        if (value && current.moza) {
          registries.forEach((r) => {
            const rMozaId = r.moza?._id || r.moza || '';
            if (String(rMozaId) === String(current.moza)) {
              if (Array.isArray(r.lines)) {
                const matchedLine = r.lines.find((rl) => String(rl.khasraNo).trim() === String(value).trim());
                if (matchedLine && !seenRegIds.has(String(r._id))) {
                  seenRegIds.add(String(r._id));
                  matchingRegs.push({
                    registry: r,
                    regLine: matchedLine
                  });
                }
              }
            }
          });
        }

        if (matchingRegs.length > 1) {
          const expandedLines = matchingRegs.map(({ registry: r, regLine: rl }) => ({
            id: Math.random().toString(36).substring(2, 9),
            moza: current.moza,
            khasraNo: value,
            khasraEntry: rl.khasraEntry?._id || rl.khasraEntry || defaultKhasraEntry,
            registryId: r._id,
            registryNo: r.registryNo || '',
            inteqalNo: r.inteqalNo || '',
            khewatNo: rl.khewatNo || r.khewatNo || defaultKhewat,
            khasraArea: rl.khasraArea ? areaToForm(rl.khasraArea) : defaultKhasraArea,
            surrenderedArea: rl.acquiredArea ? areaToForm(rl.acquiredArea) : emptyArea(),
            remarks: current.remarks || ''
          }));
          updated.splice(index, 1, ...expandedLines);
          return updated;
        } else if (matchingRegs.length === 1) {
          const { registry: r, regLine: rl } = matchingRegs[0];
          current.registryId = r._id;
          current.registryNo = r.registryNo || '';
          current.inteqalNo = r.inteqalNo || '';
          current.khasraEntry = rl.khasraEntry?._id || rl.khasraEntry || defaultKhasraEntry;
          current.khewatNo = rl.khewatNo || r.khewatNo || defaultKhewat;
          current.khasraArea = rl.khasraArea ? areaToForm(rl.khasraArea) : defaultKhasraArea;
          current.surrenderedArea = rl.acquiredArea ? areaToForm(rl.acquiredArea) : emptyArea();
          updated[index] = current;
          return updated;
        } else {
          current.registryId = '';
          current.registryNo = '';
          current.inteqalNo = '';
          current.khasraEntry = defaultKhasraEntry;
          current.khewatNo = defaultKhewat;
          current.khasraArea = defaultKhasraArea;
          current.surrenderedArea = defaultKhasraArea;
          updated[index] = current;
          return updated;
        }
      } else if (field === 'registryId') {
        current.registryId = value;
        const reg = registries.find((r) => String(r._id) === String(value));
        if (reg) {
          current.registryNo = reg.registryNo || '';
          current.inteqalNo = reg.inteqalNo || '';
          if (reg.khewatNo && !current.khewatNo) {
            current.khewatNo = reg.khewatNo;
          }

          if (current.khasraNo && reg.lines?.length > 0) {
            const regLine = reg.lines.find((sl) => String(sl.khasraNo).trim() === String(current.khasraNo).trim());
            if (regLine) {
              if (regLine.khewatNo) current.khewatNo = regLine.khewatNo;
              if (regLine.khasraEntry) current.khasraEntry = regLine.khasraEntry?._id || regLine.khasraEntry;
              if (regLine.khasraArea || regLine.landOfKhasra) {
                current.khasraArea = areaToForm(regLine.khasraArea || regLine.landOfKhasra);
              }
              if (regLine.acquiredArea) {
                current.surrenderedArea = areaToForm(regLine.acquiredArea);
              }
            }
          } else if (reg.lines?.length === 1) {
            const firstL = reg.lines[0];
            if (!current.khasraNo) current.khasraNo = firstL.khasraNo || '';
            current.khasraEntry = firstL.khasraEntry?._id || firstL.khasraEntry || current.khasraEntry;
            current.khewatNo = firstL.khewatNo || reg.khewatNo || current.khewatNo;
            current.khasraArea = areaToForm(firstL.khasraArea || firstL.landOfKhasra || current.khasraArea);
            current.surrenderedArea = areaToForm(firstL.acquiredArea || current.surrenderedArea);
          }
        } else {
          current.registryNo = '';
          current.inteqalNo = '';
        }
        updated[index] = current;
        return updated;
      } else {
        current[field] = value;
        updated[index] = current;
        return updated;
      }
    });
  };

  const handleAddOutLine = () => setOutLandLines((prev) => [...prev, emptyOutLine()]);
  const handleRemoveOutLine = (index) => {
    setOutLandLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [emptyOutLine()]));
  };

  // -------------------------------------------------------------
  // IN LAND HANDLERS (Exact Registry Pattern)
  // -------------------------------------------------------------
  const inKhasraOptions = useMemo(() => sortKhasraEntries(inMozaKhasras), [inMozaKhasras]);

  const priorOwnedForInKhasra = (khasraEntryId) =>
    normalizeArea(inRegisteredTotals[String(khasraEntryId || '')] || {});

  const totalLandOwnedForInLine = (line) =>
    addAreas(priorOwnedForInKhasra(line.khasraEntry), parseAreaForm(line.acquiredArea));

  const transferPercentForInLine = (line) =>
    calcTransferPercent(totalLandOwnedForInLine(line), parseAreaForm(line.khasraArea));

  const remainingKhasraForInLine = (line) => {
    const kArea = parseAreaForm(line.khasraArea);
    if (!line.khasraEntry || !toSarsais(kArea)) return null;
    return subtractAreas(kArea, priorOwnedForInKhasra(line.khasraEntry));
  };

  const acquiredInTotal = useMemo(
    () => addAreas(...inLandLines.map((line) => parseAreaForm(line.acquiredArea))),
    [inLandLines]
  );

  const totalInAreaParsed = useMemo(() => parseAreaForm(inTotalArea), [inTotalArea]);
  const hasInTotalArea = toSarsais(totalInAreaParsed) > 0;
  const linesExceedInTotal = hasInTotalArea && toSarsais(acquiredInTotal) > toSarsais(totalInAreaParsed);
  const lineExceedsInTotal = (line) =>
    hasInTotalArea && toSarsais(parseAreaForm(line.acquiredArea)) > toSarsais(totalInAreaParsed);
  const remainingInArea = hasInTotalArea ? subtractAreas(totalInAreaParsed, acquiredInTotal) : null;

  const handleInMozaChange = (mozaId) => {
    setInMoza(mozaId);
    setInTotalArea(emptyArea());
    setInLandLines(mozaId ? [emptyInLine()] : []);
  };

  const findInKhasraOption = (line) => {
    if (line.khasraEntry) {
      return inKhasraOptions.find((k) => k._id === line.khasraEntry) || null;
    }
    if (line.khasraNo && line.khewatNo) {
      return inKhasraOptions.find(
        (k) => String(k.khasraNo) === String(line.khasraNo)
          && String(k.khewatNo) === String(line.khewatNo)
      ) || null;
    }
    return null;
  };

  const updateInLine = (index, patch) => {
    setInLandLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  };

  const handleInKhasraSelect = (index, entry) => {
    if (!entry) {
      updateInLine(index, {
        khasraEntry: '',
        khewatNo: '',
        khasraNo: '',
        khasraArea: emptyArea(),
        acquiredArea: emptyArea()
      });
      return;
    }
    updateInLine(index, {
      khasraEntry: entry._id,
      khewatNo: entry.khewatNo,
      khasraNo: entry.khasraNo,
      khasraArea: areaToForm(entry.landInKhasra),
      acquiredArea: emptyArea()
    });
  };

  const isInKhasraTaken = (entryId, lineIndex) =>
    inLandLines.some((line, i) => i !== lineIndex && line.khasraEntry === entryId);

  const handleAddInLine = () => {
    setInLandLines((prev) => [...prev, emptyInLine()]);
  };

  const handleRemoveInLine = (index) => {
    setInLandLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  // Calculation summaries
  const totalOut = useMemo(() => {
    return addAreas(...outLandLines.map((l) => parseAreaForm(l.surrenderedArea)));
  }, [outLandLines]);

  const totalIn = useMemo(() => {
    return hasInTotalArea ? totalInAreaParsed : acquiredInTotal;
  }, [hasInTotalArea, totalInAreaParsed, acquiredInTotal]);

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
        moza: l.moza || inMoza,
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
        moza: inMoza || l.moza,
        khasraEntry: l.khasraEntry || undefined,
        khewatNo: l.khewatNo?.trim?.() || l.khewatNo || '',
        khasraNo: l.khasraNo?.trim?.() || l.khasraNo || '',
        khasraArea: parseAreaForm(l.khasraArea),
        acquiredArea: parseAreaForm(l.acquiredArea),
        registryNo: l.registryNo || registryNo,
        inteqalNo: l.inteqalNo || inteqalNo,
        remarks: l.remarks?.trim?.() || l.remarks || ''
      }));

    if (!cleanOut.length && !cleanIn.length) {
      setError('Please provide at least one Out Land line or In Land line');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        exchangeRef,
        exchangeDate,
        party: party._id || party,
        dealNo: dealNo ? Number(dealNo) : undefined,
        registryNo: registryNo ? registryNo.trim() : undefined,
        inteqalNo: inteqalNo ? inteqalNo.trim() : undefined,
        moza: inMoza || undefined,
        remarks,
        outLandLines: cleanOut,
        inLandLines: cleanIn,
        totalInArea: parseAreaForm(inTotalArea),
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

  const selectedInMoza = mozas.find((m) => m._id === inMoza);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: 3,
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ExchangeIcon color="primary" sx={{ fontSize: 28 }} />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {exchangeId ? 'Edit Land Exchange' : 'New Land Exchange Record'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Surrender existing registries/khasras and acquire incoming replacement land
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3, bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'grey.950' : 'grey.50') }}>
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
                <Grid item xs={12} sm={3}>
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
                <Grid item xs={12} sm={3}>
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
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Registry No."
                    value={registryNo}
                    onChange={(e) => setRegistryNo(e.target.value)}
                    placeholder="e.g. 1052"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Inteqal No."
                    value={inteqalNo}
                    onChange={(e) => setInteqalNo(e.target.value)}
                    placeholder="e.g. 54"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
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

            {/* Side-By-Side Out Land vs In Land (Add Registry Style for In Land) */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {/* OUT LAND SECTION (Surrendered Land) */}
              <Grid item xs={12} lg={5}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    height: '100%',
                    borderRadius: 2,
                    border: '1.5px solid',
                    borderColor: 'warning.light',
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(237, 108, 2, 0.05)' : '#fffdfa')
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
                                {/* Moza */}
                                <Grid item xs={12} sm={6}>
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

                                {/* Khasra No. */}
                                <Grid item xs={12} sm={6}>
                                  {currentMozaKhasras.length > 0 ? (
                                    <Autocomplete
                                      freeSolo
                                      size="small"
                                      options={currentMozaKhasras.map((k) => String(k.khasraNo))}
                                      value={line.khasraNo || ''}
                                      onChange={(_, val) => handleOutLineChange(idx, 'khasraNo', val || '')}
                                      onInputChange={(_, val) => {
                                        if (val !== line.khasraNo) {
                                          handleOutLineChange(idx, 'khasraNo', val || '');
                                        }
                                      }}
                                      renderInput={(params) => (
                                        <TextField {...params} label="Khasra No." placeholder="Select or type khasra" />
                                      )}
                                    />
                                  ) : (
                                    <TextField
                                      fullWidth
                                      size="small"
                                      label="Khasra No."
                                      value={line.khasraNo || ''}
                                      onChange={(e) => handleOutLineChange(idx, 'khasraNo', e.target.value)}
                                      placeholder={line.moza ? 'Enter khasra number' : 'Select Moza first'}
                                    />
                                  )}
                                </Grid>

                                {/* Source Registry */}
                                <Grid item xs={12}>
                                  {(() => {
                                    const matchingRegistries = registries.filter((r) => {
                                      const rMozaId = r.moza?._id || r.moza || '';
                                      if (line.moza && String(rMozaId) !== String(line.moza)) return false;
                                      if (line.khasraNo && Array.isArray(r.lines)) {
                                        const hasKhasra = r.lines.some(
                                          (rl) => String(rl.khasraNo).trim() === String(line.khasraNo).trim()
                                        );
                                        if (!hasKhasra) return false;
                                      }
                                      return true;
                                    });

                                    const displayRegistries = matchingRegistries.length > 0
                                      ? matchingRegistries
                                      : (line.moza ? registries.filter((r) => String(r.moza?._id || r.moza) === String(line.moza)) : registries);

                                    return (
                                      <TextField
                                        select
                                        fullWidth
                                        size="small"
                                        label="Source Registry"
                                        value={line.registryId || ''}
                                        onChange={(e) => handleOutLineChange(idx, 'registryId', e.target.value)}
                                        helperText={
                                          line.khasraNo
                                            ? `${matchingRegistries.length} registry/registries created in Khasra ${line.khasraNo}`
                                            : line.moza
                                              ? `${displayRegistries.length} registries in selected Moza`
                                              : `${registries.length} total registries available`
                                        }
                                      >
                                        <MenuItem value="">
                                          <em>— Select / Manual —</em>
                                        </MenuItem>
                                        {displayRegistries.map((r) => {
                                          const matchedLine = line.khasraNo && r.lines
                                            ? r.lines.find((rl) => String(rl.khasraNo).trim() === String(line.khasraNo).trim())
                                            : null;
                                          const areaText = matchedLine ? formatKMS(matchedLine.acquiredArea) : formatKMS(r.totalArea);

                                          return (
                                            <MenuItem key={r._id} value={r._id}>
                                              Reg #{r.registryNo || '—'} {r.inteqalNo ? `(Inteqal: ${r.inteqalNo})` : ''} — {areaText} {r.moza?.name ? `[${r.moza.name}]` : ''} {matchedLine ? `(Khasra ${matchedLine.khasraNo})` : ''}
                                            </MenuItem>
                                          );
                                        })}
                                      </TextField>
                                    );
                                  })()}
                                </Grid>

                                {/* Registry Details */}
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Registry No."
                                    value={line.registryNo || ''}
                                    onChange={(e) => handleOutLineChange(idx, 'registryNo', e.target.value)}
                                    placeholder="e.g. 1052"
                                  />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Inteqal No."
                                    value={line.inteqalNo || ''}
                                    onChange={(e) => handleOutLineChange(idx, 'inteqalNo', e.target.value)}
                                    placeholder="e.g. 54"
                                  />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Khewat No."
                                    value={line.khewatNo || ''}
                                    onChange={(e) => handleOutLineChange(idx, 'khewatNo', e.target.value)}
                                    placeholder="e.g. 12/1"
                                  />
                                </Grid>

                                {/* Surrendered Area */}
                                <Grid item xs={12}>
                                  <Box sx={{ p: 1, bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#fbfbfb'), borderRadius: 1.5, border: '1px dashed', borderColor: 'divider' }}>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
                                      <Box>
                                        <Typography variant="caption" fontWeight={600} color="text.secondary" display="block">
                                          Surrendered Area (Kanal - Marla - Sarsai)
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          Total Khasra Area: {formatKMS(line.khasraArea)}
                                        </Typography>
                                      </Box>
                                      <AreaInputs
                                        value={line.surrenderedArea}
                                        onChange={(val) => handleOutLineChange(idx, 'surrenderedArea', val)}
                                      />
                                    </Stack>
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

              {/* IN LAND SECTION (Exact Add Registry Pattern) */}
              <Grid item xs={12} lg={7}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    height: '100%',
                    borderRadius: 2,
                    border: '1.5px solid',
                    borderColor: 'success.light',
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(46, 125, 50, 0.05)' : '#f9fdfa')
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip label="IN" size="small" color="success" sx={{ fontWeight: 700 }} />
                      <Typography variant="subtitle1" fontWeight={700}>
                        In Land (Acquired Land Registry)
                      </Typography>
                    </Stack>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                    Add incoming land exactly like adding a new Land Registry with Mouza, Total Area, Khasra selection, Total Land Owned, and Transfer %.
                  </Typography>

                  {/* Moza & Total Area Selector Header */}
                  <Grid container spacing={2} sx={{ mb: 2.5 }}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        required
                        select
                        label="Select Mouza"
                        value={inMoza}
                        onChange={(e) => handleInMozaChange(e.target.value)}
                      >
                        <MenuItem value=""><em>Select Mouza</em></MenuItem>
                        {mozas.map((m) => (
                          <MenuItem key={m._id} value={m._id}>Mouza {m.name}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                          Total Area (K · M · Sarsai) *
                        </Typography>
                        <AreaInputs
                          value={inTotalArea}
                          onChange={(area) => setInTotalArea(area)}
                        />
                        <Typography
                          variant="caption"
                          color={linesExceedInTotal ? 'error' : 'text.secondary'}
                          sx={{ display: 'block', mt: 0.25 }}
                        >
                          {hasInTotalArea
                            ? `Allocated ${formatKMS(acquiredInTotal)} · Remaining ${formatKMS(remainingInArea)}`
                            : 'Enter total area for incoming land'}
                          {linesExceedInTotal ? ' · exceeds total area' : ''}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {selectedInMoza && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.825rem' }}>
                      Mouza <strong>{selectedInMoza.name}</strong> — select a khasra and enter area; total land owned and transfer % update automatically.
                    </Typography>
                  )}

                  {!inMoza ? (
                    <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', mb: 2, bgcolor: 'background.paper' }}>
                      <Typography color="text.secondary">Select a mouza above to add khasra rows.</Typography>
                    </Paper>
                  ) : (
                    <>
                      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 440, mb: 1.5 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Khewat No.</TableCell>
                              <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Khasra No.</TableCell>
                              <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Khasra Area (K·M·S)</TableCell>
                              <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Area in Registry</TableCell>
                              <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Total Land Owned</TableCell>
                              <TableCell width={75} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Transfer %</TableCell>
                              <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Remarks</TableCell>
                              <TableCell width={40} />
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {inLandLines.map((line, index) => {
                              const priorOwned = priorOwnedForInKhasra(line.khasraEntry);
                              const totalOwned = totalLandOwnedForInLine(line);
                              const transferPct = transferPercentForInLine(line);
                              const remainingKhasra = remainingKhasraForInLine(line);
                              const rowAreaError = lineExceedsInTotal(line);

                              return (
                                <TableRow key={line.id || line.khasraEntry || `inline-${index}`}>
                                  {/* Khewat No. (Readonly auto-populated from khasra) */}
                                  <TableCell>
                                    <TextField
                                      size="small"
                                      value={line.khewatNo || ''}
                                      InputProps={{ readOnly: true }}
                                      placeholder="—"
                                      sx={{ width: 80 }}
                                    />
                                  </TableCell>

                                  {/* Khasra No. Autocomplete */}
                                  <TableCell>
                                    <Autocomplete
                                      size="small"
                                      disablePortal
                                      options={inKhasraOptions}
                                      value={findInKhasraOption(line)}
                                      onChange={(_, entry) => handleInKhasraSelect(index, entry)}
                                      getOptionLabel={formatKhasraSelectLabel}
                                      isOptionEqualToValue={(a, b) => a._id === b._id}
                                      getOptionDisabled={(option) => isInKhasraTaken(option._id, index)}
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
                                      sx={{ minWidth: 180 }}
                                    />
                                  </TableCell>

                                  {/* Khasra Area (K·M·S) */}
                                  <TableCell>
                                    <AreaInputs value={line.khasraArea} readOnly />
                                  </TableCell>

                                  {/* Area in Registry (Acquired Area) */}
                                  <TableCell>
                                    <Stack spacing={0.25}>
                                      <AreaInputs
                                        value={line.acquiredArea}
                                        onChange={(area) => updateInLine(index, { acquiredArea: area })}
                                      />
                                      {rowAreaError && hasInTotalArea && (
                                        <Typography variant="caption" color="error">
                                          Cannot exceed total area
                                        </Typography>
                                      )}
                                      {line.khasraEntry && remainingKhasra != null && (
                                        <Typography variant="caption" color="text.secondary">
                                          Max: {formatKMSOrZero(remainingKhasra)}
                                        </Typography>
                                      )}
                                    </Stack>
                                  </TableCell>

                                  {/* Total Land Owned */}
                                  <TableCell>
                                    <Stack spacing={0.25}>
                                      <AreaInputs
                                        value={areaToForm(totalOwned)}
                                        readOnly
                                      />
                                      {line.khasraEntry && (
                                        <Typography variant="caption" color="text.secondary">
                                          Prior: {formatKMS(priorOwned)}
                                        </Typography>
                                      )}
                                    </Stack>
                                  </TableCell>

                                  {/* Transfer % */}
                                  <TableCell>
                                    <TextField
                                      size="small"
                                      value={formatTransferPercent(transferPct)}
                                      InputProps={{ readOnly: true }}
                                      sx={{ width: 68 }}
                                    />
                                  </TableCell>

                                  {/* Remarks */}
                                  <TableCell>
                                    <TextField
                                      size="small"
                                      value={line.remarks || ''}
                                      onChange={(e) => updateInLine(index, { remarks: e.target.value })}
                                      fullWidth
                                      placeholder="Remarks"
                                    />
                                  </TableCell>

                                  {/* Delete row */}
                                  <TableCell>
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => handleRemoveInLine(index)}
                                      disabled={inLandLines.length <= 1}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </TableCell>
                                </TableRow>
                              );
                            })}

                            {inLandLines.length > 0 && (
                              <TableRow sx={{ bgcolor: linesExceedInTotal ? 'error.light' : 'grey.100' }}>
                                <TableCell colSpan={3}><strong>Allocated in rows</strong></TableCell>
                                <TableCell>
                                  <Typography variant="body2" fontWeight={700} color={linesExceedInTotal ? 'error' : 'inherit'}>
                                    {formatKMS(acquiredInTotal)}
                                  </Typography>
                                </TableCell>
                                <TableCell colSpan={4} />
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      <Button startIcon={<AddIcon />} onClick={handleAddInLine} disabled={!inMoza} sx={{ textTransform: 'none', fontWeight: 600 }}>
                        Add Row
                      </Button>
                    </>
                  )}

                  <Box sx={{ mt: 2, p: 1.5, bgcolor: 'success.50', borderRadius: 1.5, border: '1px dashed', borderColor: 'success.main' }}>
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
