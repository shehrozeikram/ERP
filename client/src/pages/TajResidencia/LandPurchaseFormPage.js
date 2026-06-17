import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import landAcquisitionPurchaseService from '../../services/landAcquisitionPurchaseService';
import landAcquisitionPartyService from '../../services/landAcquisitionPartyService';
import { getMozas, getMozaKhasras } from '../../services/landAcquisitionMozaService';
import {
  areaToDecimalKanal,
  areaToForm,
  emptyArea,
  formatAreaReadable,
  parseAreaForm
} from '../../utils/landAreaUnits';
import { numberToWords } from '../../utils/numberToWords';
import { formatKhasraSelectLabel, sortKhasraEntries } from '../../utils/landKhasraDisplay';

const AreaInputs = ({ value, onChange, readOnly = false }) => (
  <Stack direction="row" spacing={1}>
    {[
      { key: 'kanal', label: 'Kanal' },
      { key: 'marla', label: 'Marla' },
      { key: 'sarsai', label: 'Sarsai' }
    ].map(({ key, label }) => (
      <TextField
        key={key}
        size="small"
        label={label}
        type="number"
        value={value[key]}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        inputProps={{ min: 0, step: key === 'sarsai' ? 0.5 : 1 }}
        disabled={readOnly}
        sx={{ flex: 1 }}
      />
    ))}
  </Stack>
);

const emptyForm = () => ({
  dealNo: '',
  purchaseNo: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  project: 'Taj Residencia',
  seller: null,
  moza: '',
  selectedKhasras: [],
  totalArea: emptyArea(),
  ratePerKanal: '',
  agreedAmount: ''
});

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const calcAgreedFromRate = (rate, kanal) => roundMoney((Number(rate) || 0) * (Number(kanal) || 0));

const calcRateFromAgreed = (agreed, kanal) => {
  const size = Number(kanal) || 0;
  if (!size) return 0;
  return roundMoney((Number(agreed) || 0) / size);
};

const partyLabel = (party) => {
  if (!party) return '';
  return [party.name, party.cnic].filter(Boolean).join(' — ');
};

export default function LandPurchaseFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [sellers, setSellers] = useState([]);
  const [mozas, setMozas] = useState([]);
  const [mozaKhasras, setMozaKhasras] = useState([]);
  const [priceDriver, setPriceDriver] = useState('rate');

  const totalSizeInKanal = useMemo(
    () => areaToDecimalKanal(parseAreaForm(form.totalArea)),
    [form.totalArea]
  );

  const resolvedAgreedAmount = useMemo(
    () => {
      if (form.agreedAmount !== '') {
        return roundMoney(form.agreedAmount);
      }
      return calcAgreedFromRate(form.ratePerKanal, totalSizeInKanal);
    },
    [form.agreedAmount, form.ratePerKanal, totalSizeInKanal]
  );

  const loadParties = useCallback(async () => {
    try {
      const sellerRes = await landAcquisitionPartyService.getParties({ type: 'seller', limit: 100, page: 1 });
      setSellers(sellerRes.data || []);
    } catch {
      setSellers([]);
    }
  }, []);

  useEffect(() => {
    loadParties();
    getMozas().then((res) => setMozas(res.data?.data || [])).catch(() => setMozas([]));
  }, [loadParties]);

  useEffect(() => {
    if (!form.moza) {
      setMozaKhasras([]);
      return;
    }
    getMozaKhasras(form.moza)
      .then((res) => setMozaKhasras(sortKhasraEntries(res.data?.data || [])))
      .catch(() => setMozaKhasras([]));
  }, [form.moza]);

  useEffect(() => {
    if (!isEdit) {
      landAcquisitionPurchaseService.getNextNumbers()
        .then((res) => {
          const data = res.data || {};
          setForm((prev) => ({
            ...prev,
            dealNo: data.dealNo ?? '',
            purchaseNo: data.purchaseNo ?? ''
          }));
        })
        .catch(() => {});
    }
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit) return;

    setLoading(true);
    landAcquisitionPurchaseService.getPurchase(id)
      .then(async (res) => {
        const row = res.data;
        const mozaId = row.moza?._id || row.moza || '';
        let khasraOptions = [];
        if (mozaId) {
          try {
            const khasraRes = await getMozaKhasras(mozaId);
            khasraOptions = sortKhasraEntries(khasraRes.data?.data || []);
            setMozaKhasras(khasraOptions);
          } catch {
            khasraOptions = [];
          }
        }

        const selectedKhasras = (row.lines || [])
          .map((line) => khasraOptions.find((k) => String(k._id) === String(line.khasraEntry)))
          .filter(Boolean);

        setForm({
          dealNo: row.dealNo,
          purchaseNo: row.purchaseNo,
          purchaseDate: row.purchaseDate ? new Date(row.purchaseDate).toISOString().slice(0, 10) : '',
          project: row.project || 'Taj Residencia',
          seller: row.seller || null,
          moza: mozaId,
          selectedKhasras,
          totalArea: areaToForm(row.totalArea),
          ratePerKanal: row.ratePerKanal ?? '',
          agreedAmount: row.agreedAmount ?? ''
        });
        setPriceDriver('rate');
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load purchase'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const handleTotalAreaChange = (totalArea) => {
    setForm((prev) => {
      const kanal = areaToDecimalKanal(parseAreaForm(totalArea));
      if (priceDriver === 'amount' && prev.agreedAmount !== '') {
        return {
          ...prev,
          totalArea,
          ratePerKanal: kanal > 0 ? String(calcRateFromAgreed(prev.agreedAmount, kanal)) : prev.ratePerKanal
        };
      }
      if (prev.ratePerKanal !== '') {
        return {
          ...prev,
          totalArea,
          agreedAmount: String(calcAgreedFromRate(prev.ratePerKanal, kanal))
        };
      }
      return { ...prev, totalArea };
    });
  };

  const handleRatePerKanalChange = (value) => {
    setPriceDriver('rate');
    setForm((prev) => {
      const kanal = areaToDecimalKanal(parseAreaForm(prev.totalArea));
      return {
        ...prev,
        ratePerKanal: value,
        agreedAmount: value === '' ? '' : String(calcAgreedFromRate(value, kanal))
      };
    });
  };

  const handleAgreedAmountChange = (value) => {
    setPriceDriver('amount');
    setForm((prev) => {
      const kanal = areaToDecimalKanal(parseAreaForm(prev.totalArea));
      return {
        ...prev,
        agreedAmount: value,
        ratePerKanal: value === '' ? '' : String(calcRateFromAgreed(value, kanal))
      };
    });
  };

  const validateForm = () => {
    if (!form.seller) return 'Please select a seller';
    if (!form.purchaseDate) return 'Date is required';
    if (!form.moza) return 'Please select a moza';
    if (!form.selectedKhasras.length) return 'Please select at least one khasra';
    if (!totalSizeInKanal) return 'Please enter land size';
    if (!Number(form.ratePerKanal) && !Number(form.agreedAmount)) {
      return 'Rate per kanal or agreed amount is required';
    }
    return '';
  };

  const buildPayload = () => {
    const lines = form.selectedKhasras.map((entry) => ({
      khasraEntry: entry._id,
      khewatNo: entry.khewatNo || '',
      khasraNo: entry.khasraNo || '',
      khasraArea: entry.landInKhasra || {}
    }));

    return {
      purchaseDate: form.purchaseDate,
      project: form.project,
      seller: form.seller?._id,
      moza: form.moza,
      lines,
      totalArea: parseAreaForm(form.totalArea),
      ratePerKanal: Number(form.ratePerKanal) || calcRateFromAgreed(form.agreedAmount, totalSizeInKanal),
      ratePerKanalInWords: numberToWords(Number(form.ratePerKanal) || calcRateFromAgreed(form.agreedAmount, totalSizeInKanal)),
      agreedAmountInWords: numberToWords(resolvedAgreedAmount)
    };
  };

  const handleSave = async () => {
    const msg = validateForm();
    if (msg) {
      toast.error(msg);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = buildPayload();
      if (isEdit) {
        await landAcquisitionPurchaseService.updatePurchase(id, payload);
        toast.success('Land purchase updated');
      } else {
        await landAcquisitionPurchaseService.createPurchase(payload);
        toast.success('Land purchase created');
      }
      navigate('/taj-residencia/land-purchase');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save land purchase';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box p={4} textAlign="center">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/taj-residencia/land-purchase')}>
          Back
        </Button>
        <Typography variant="h5" fontWeight={700}>
          {isEdit ? 'Edit Land Purchase' : 'Create Land Purchase'}
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="h6" fontWeight={700} gutterBottom>Deal Information</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Enter land purchase and deal details.
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Autocomplete
              options={sellers}
              value={form.seller}
              onChange={(_, value) => setForm((prev) => ({ ...prev, seller: value }))}
              getOptionLabel={partyLabel}
              isOptionEqualToValue={(opt, val) => String(opt?._id) === String(val?._id)}
              renderInput={(params) => (
                <TextField {...params} label="Seller *" placeholder="Select seller" />
              )}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Deal No"
              value={form.dealNo}
              InputProps={{ readOnly: true }}
              helperText="Auto-generated"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="date"
              label="Date *"
              value={form.purchaseDate}
              onChange={(e) => setForm((prev) => ({ ...prev, purchaseDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              label="Project"
              value={form.project}
              onChange={(e) => setForm((prev) => ({ ...prev, project: e.target.value }))}
            >
              <MenuItem value="Taj Residencia">Taj Residencia</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Land Purchase No"
              value={form.purchaseNo}
              InputProps={{ readOnly: true }}
              helperText="Auto-generated"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              label="Moza *"
              value={form.moza}
              onChange={(e) => setForm((prev) => ({
                ...prev,
                moza: e.target.value,
                selectedKhasras: []
              }))}
            >
              <MenuItem value="">Select Moza</MenuItem>
              {mozas.map((m) => (
                <MenuItem key={m._id} value={m._id}>{m.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <Autocomplete
              multiple
              options={mozaKhasras}
              value={form.selectedKhasras}
              onChange={(_, value) => setForm((prev) => ({ ...prev, selectedKhasras: value }))}
              getOptionLabel={formatKhasraSelectLabel}
              isOptionEqualToValue={(opt, val) => String(opt?._id) === String(val?._id)}
              disabled={!form.moza}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Khasra *"
                  placeholder={form.moza ? 'Select khasra' : 'Select moza first'}
                  helperText={`${form.selectedKhasras.length} selected`}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Size</Typography>
            <AreaInputs
              value={form.totalArea}
              onChange={handleTotalAreaChange}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Total Size In Kanal"
              value={totalSizeInKanal ? totalSizeInKanal.toFixed(4) : '0.0000'}
              InputProps={{ readOnly: true }}
              sx={{ '& .MuiInputBase-input': { bgcolor: 'primary.50' } }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Size summary"
              value={formatAreaReadable(parseAreaForm(form.totalArea))}
              InputProps={{ readOnly: true }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Rate Per Kanal *"
              value={form.ratePerKanal}
              onChange={(e) => handleRatePerKanalChange(e.target.value)}
              inputProps={{ min: 0 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Rate Per Kanal In Words"
              value={numberToWords(Number(form.ratePerKanal) || 0)}
              InputProps={{ readOnly: true }}
              sx={{ '& .MuiInputBase-input': { bgcolor: 'primary.50' } }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Agreed Amount"
              value={form.agreedAmount}
              onChange={(e) => handleAgreedAmountChange(e.target.value)}
              inputProps={{ min: 0 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Agreed Amount In Words"
              value={numberToWords(resolvedAgreedAmount)}
              InputProps={{ readOnly: true }}
              sx={{ '& .MuiInputBase-input': { bgcolor: 'primary.50' } }}
            />
          </Grid>
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Summary</Typography>
              <Typography variant="body2"><strong>Purchase No:</strong> {form.purchaseNo || '—'}</Typography>
              <Typography variant="body2"><strong>Deal No:</strong> {form.dealNo || '—'}</Typography>
              <Typography variant="body2"><strong>Seller:</strong> {form.seller?.name || '—'}</Typography>
              <Typography variant="body2"><strong>Moza:</strong> {mozas.find((m) => String(m._id) === String(form.moza))?.name || '—'}</Typography>
              <Typography variant="body2"><strong>Khasras:</strong> {form.selectedKhasras.map((k) => k.khasraNo).join(', ') || '—'}</Typography>
              <Typography variant="body2"><strong>Size:</strong> {formatAreaReadable(parseAreaForm(form.totalArea))}</Typography>
              <Typography variant="body2"><strong>Agreed Amount:</strong> PKR {resolvedAgreedAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</Typography>
            </Paper>
          </Grid>
        </Grid>

        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 4 }}>
          <Button
            variant="contained"
            color="success"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            disabled={saving}
            onClick={handleSave}
          >
            {isEdit ? 'Update Land Purchase' : 'Create Land Purchase'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
