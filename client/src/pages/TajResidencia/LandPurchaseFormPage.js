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
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
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

const STEPS = ['Parties Info', 'Deal Information', 'Payment Information', 'Dealer Information'];

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
  purchaser: null,
  dealer: null,
  moza: '',
  selectedKhasras: [],
  totalArea: emptyArea(),
  ratePerKanal: '',
  govtLandValue: '',
  tokenAmount: '',
  paymentMode: '',
  paymentRemarks: ''
});

const partyLabel = (party) => {
  if (!party) return '';
  return [party.name, party.cnic].filter(Boolean).join(' — ');
};

export default function LandPurchaseFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [sellers, setSellers] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [mozas, setMozas] = useState([]);
  const [mozaKhasras, setMozaKhasras] = useState([]);

  const totalSizeInKanal = useMemo(
    () => areaToDecimalKanal(parseAreaForm(form.totalArea)),
    [form.totalArea]
  );

  const agreedAmount = useMemo(
    () => Math.round(totalSizeInKanal * (Number(form.ratePerKanal) || 0) * 100) / 100,
    [totalSizeInKanal, form.ratePerKanal]
  );

  const balanceAmount = useMemo(
    () => Math.max(0, Math.round((agreedAmount - (Number(form.tokenAmount) || 0)) * 100) / 100),
    [agreedAmount, form.tokenAmount]
  );

  const loadParties = useCallback(async () => {
    try {
      const [sellerRes, buyerRes, dealerRes] = await Promise.all([
        landAcquisitionPartyService.getParties({ type: 'seller', limit: 100, page: 1 }),
        landAcquisitionPartyService.getParties({ type: 'buyer', limit: 100, page: 1 }),
        landAcquisitionPartyService.getParties({ type: 'dealer', limit: 100, page: 1 })
      ]);
      setSellers(sellerRes.data || []);
      setBuyers(buyerRes.data || []);
      setDealers(dealerRes.data || []);
    } catch {
      setSellers([]);
      setBuyers([]);
      setDealers([]);
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
          purchaser: row.purchaser || null,
          dealer: row.dealer || null,
          moza: mozaId,
          selectedKhasras,
          totalArea: areaToForm(row.totalArea),
          ratePerKanal: row.ratePerKanal ?? '',
          govtLandValue: row.govtLandValue ?? '',
          tokenAmount: row.tokenAmount ?? '',
          paymentMode: row.paymentMode || '',
          paymentRemarks: row.paymentRemarks || ''
        });
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load purchase'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const validateStep = (step) => {
    if (step === 0) {
      if (!form.seller) return 'Please select a seller';
      if (!form.purchaser) return 'Please select a purchaser';
    }
    if (step === 1) {
      if (!form.purchaseDate) return 'Date is required';
      if (!form.moza) return 'Please select a moza';
      if (!form.selectedKhasras.length) return 'Please select at least one khasra';
      if (!totalSizeInKanal) return 'Please enter land size';
      if (!Number(form.ratePerKanal)) return 'Rate per kanal is required';
    }
    return '';
  };

  const handleNext = () => {
    const msg = validateStep(activeStep);
    if (msg) {
      toast.error(msg);
      return;
    }
    setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => setActiveStep((prev) => Math.max(prev - 1, 0));

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
      purchaser: form.purchaser?._id,
      dealer: form.dealer?._id || null,
      moza: form.moza,
      lines,
      totalArea: parseAreaForm(form.totalArea),
      ratePerKanal: Number(form.ratePerKanal) || 0,
      ratePerKanalInWords: numberToWords(Number(form.ratePerKanal) || 0),
      agreedAmountInWords: numberToWords(agreedAmount),
      govtLandValue: Number(form.govtLandValue) || 0,
      govtLandValueInWords: numberToWords(Number(form.govtLandValue) || 0),
      tokenAmount: Number(form.tokenAmount) || 0,
      tokenAmountInWords: numberToWords(Number(form.tokenAmount) || 0),
      paymentMode: form.paymentMode,
      paymentRemarks: form.paymentRemarks
    };
  };

  const handleSave = async () => {
    for (let step = 0; step < STEPS.length - 1; step += 1) {
      const msg = validateStep(step);
      if (msg) {
        toast.error(msg);
        setActiveStep(step);
        return;
      }
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
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {activeStep === 0 && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="h6" fontWeight={700} gutterBottom>Parties Info</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select the seller and purchaser for this land deal.
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
              <Autocomplete
                options={buyers}
                value={form.purchaser}
                onChange={(_, value) => setForm((prev) => ({ ...prev, purchaser: value }))}
                getOptionLabel={partyLabel}
                isOptionEqualToValue={(opt, val) => String(opt?._id) === String(val?._id)}
                renderInput={(params) => (
                  <TextField {...params} label="Purchaser *" placeholder="Select purchaser" />
                )}
              />
            </Grid>
          </Grid>
        )}

        {activeStep === 1 && (
          <Grid container spacing={2}>
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
                onChange={(totalArea) => setForm((prev) => ({ ...prev, totalArea }))}
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
                onChange={(e) => setForm((prev) => ({ ...prev, ratePerKanal: e.target.value }))}
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
                label="Agreed Amount"
                value={agreedAmount ? agreedAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 }) : '0.00'}
                InputProps={{ readOnly: true }}
                sx={{ '& .MuiInputBase-input': { bgcolor: 'primary.50' } }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Agreed Amount In Words"
                value={numberToWords(agreedAmount)}
                InputProps={{ readOnly: true }}
                sx={{ '& .MuiInputBase-input': { bgcolor: 'primary.50' } }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Govt Land Value"
                value={form.govtLandValue}
                onChange={(e) => setForm((prev) => ({ ...prev, govtLandValue: e.target.value }))}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Govt Land Value In Words"
                value={numberToWords(Number(form.govtLandValue) || 0)}
                InputProps={{ readOnly: true }}
                sx={{ '& .MuiInputBase-input': { bgcolor: 'primary.50' } }}
              />
            </Grid>
          </Grid>
        )}

        {activeStep === 2 && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Token Amount"
                value={form.tokenAmount}
                onChange={(e) => setForm((prev) => ({ ...prev, tokenAmount: e.target.value }))}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Token Amount In Words"
                value={numberToWords(Number(form.tokenAmount) || 0)}
                InputProps={{ readOnly: true }}
                sx={{ '& .MuiInputBase-input': { bgcolor: 'primary.50' } }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Balance Amount"
                value={balanceAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                InputProps={{ readOnly: true }}
                sx={{ '& .MuiInputBase-input': { bgcolor: 'primary.50' } }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Payment Mode"
                value={form.paymentMode}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentMode: e.target.value }))}
              >
                <MenuItem value="">Select mode</MenuItem>
                <MenuItem value="Cash">Cash</MenuItem>
                <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                <MenuItem value="Cheque">Cheque</MenuItem>
                <MenuItem value="Pay Order">Pay Order</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Payment Remarks"
                value={form.paymentRemarks}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentRemarks: e.target.value }))}
              />
            </Grid>
          </Grid>
        )}

        {activeStep === 3 && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={dealers}
                value={form.dealer}
                onChange={(_, value) => setForm((prev) => ({ ...prev, dealer: value }))}
                getOptionLabel={partyLabel}
                isOptionEqualToValue={(opt, val) => String(opt?._id) === String(val?._id)}
                renderInput={(params) => (
                  <TextField {...params} label="Dealer" placeholder="Select dealer (optional)" />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Summary</Typography>
                <Typography variant="body2"><strong>Purchase No:</strong> {form.purchaseNo || '—'}</Typography>
                <Typography variant="body2"><strong>Deal No:</strong> {form.dealNo || '—'}</Typography>
                <Typography variant="body2"><strong>Seller:</strong> {form.seller?.name || '—'}</Typography>
                <Typography variant="body2"><strong>Purchaser:</strong> {form.purchaser?.name || '—'}</Typography>
                <Typography variant="body2"><strong>Dealer:</strong> {form.dealer?.name || '—'}</Typography>
                <Typography variant="body2"><strong>Moza:</strong> {mozas.find((m) => String(m._id) === String(form.moza))?.name || '—'}</Typography>
                <Typography variant="body2"><strong>Khasras:</strong> {form.selectedKhasras.map((k) => k.khasraNo).join(', ') || '—'}</Typography>
                <Typography variant="body2"><strong>Size:</strong> {formatAreaReadable(parseAreaForm(form.totalArea))}</Typography>
                <Typography variant="body2"><strong>Agreed Amount:</strong> PKR {agreedAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</Typography>
              </Paper>
            </Grid>
          </Grid>
        )}

        <Stack direction="row" justifyContent="space-between" sx={{ mt: 4 }}>
          <Button disabled={activeStep === 0 || saving} onClick={handleBack}>
            Back
          </Button>
          <Stack direction="row" spacing={1}>
            {activeStep < STEPS.length - 1 ? (
              <Button variant="contained" endIcon={<NextIcon />} onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                disabled={saving}
                onClick={handleSave}
              >
                {isEdit ? 'Update Land Purchase' : 'Complete Land Purchase'}
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
