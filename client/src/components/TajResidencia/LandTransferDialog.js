import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { SwapHoriz as TransferIcon } from '@mui/icons-material';
import toast from 'react-hot-toast';
import landAcquisitionPurchaseService from '../../services/landAcquisitionPurchaseService';
import landAcquisitionTransferService from '../../services/landAcquisitionTransferService';
import landAcquisitionPartyService from '../../services/landAcquisitionPartyService';
import { getMozaKhasras } from '../../services/landAcquisitionMozaService';
import {
  addAreas,
  areaToDecimalKanal,
  areaToForm,
  emptyArea,
  formatAreaReadable,
  parseAreaForm
} from '../../utils/landAreaUnits';
import { formatKhasraSelectLabel, sortKhasraEntries } from '../../utils/landKhasraDisplay';
import LandTransferPaymentsPanel, {
  defaultTransferPaymentRows,
  DEFAULT_TRANSFER_PAYMENT_TYPES,
  mapTransferPaymentsFromApi,
  serializeTransferPayments
} from './LandTransferPaymentsPanel';
import { numberToWords } from '../../utils/numberToWords';

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const AreaInputs = ({ value, onChange, readOnly = false, size = 'small' }) => (
  <Stack direction="row" spacing={1}>
    {[
      { key: 'kanal', label: 'Kanal' },
      { key: 'marla', label: 'Marla' },
      { key: 'sarsai', label: 'Sarsai' }
    ].map(({ key, label }) => (
      <TextField
        key={key}
        size={size}
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

const partyLabel = (party) => {
  if (!party) return '';
  return [party.name, party.cnic].filter(Boolean).join(' — ');
};

const emptyForm = () => ({
  referenceNo: '',
  transferNo: '',
  transferDate: new Date().toISOString().slice(0, 10),
  intiqalNo: '',
  registryNo: '',
  seller: null,
  purchaser: null,
  selectedKhasras: [],
  purchaseArea: emptyArea(),
  transferArea: emptyArea()
});

export default function LandTransferDialog({
  open,
  purchaseId,
  transferId = null,
  onClose,
  onSaved
}) {
  const isEdit = Boolean(transferId);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deals, setDeals] = useState([]);
  const [selectedDealId, setSelectedDealId] = useState('');
  const [purchase, setPurchase] = useState(null);
  const [mozaKhasras, setMozaKhasras] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [transferPayments, setTransferPayments] = useState(defaultTransferPaymentRows);
  const [customPaymentTypes, setCustomPaymentTypes] = useState([]);

  const purchaseSizeInKanal = useMemo(
    () => areaToDecimalKanal(parseAreaForm(form.purchaseArea)),
    [form.purchaseArea]
  );

  const transferSizeInKanal = useMemo(
    () => areaToDecimalKanal(parseAreaForm(form.transferArea)),
    [form.transferArea]
  );

  const ratePerKanal = useMemo(
    () => Number(purchase?.ratePerKanal) || 0,
    [purchase?.ratePerKanal]
  );

  const totalTransferPayments = useMemo(
    () => roundMoney(transferPayments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)),
    [transferPayments]
  );

  const loadParties = useCallback(async () => {
    try {
      const [sellerRes, buyerRes] = await Promise.all([
        landAcquisitionPartyService.getParties({ type: 'seller', limit: 100, page: 1 }),
        landAcquisitionPartyService.getParties({ type: 'buyer', limit: 100, page: 1 })
      ]);
      setSellers(sellerRes.data || []);
      setBuyers(buyerRes.data || []);
    } catch {
      setSellers([]);
      setBuyers([]);
    }
  }, []);

  // Load all deals for the dropdown (create mode only)
  const loadDeals = useCallback(async () => {
    try {
      const res = await landAcquisitionPurchaseService.getDeals();
      setDeals(res.data || []);
    } catch {
      setDeals([]);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadParties(), loadDeals()]);

      if (isEdit) {
        const transferRes = await landAcquisitionTransferService.getTransfer(transferId);
        const transfer = transferRes.data;
        const linkedPurchaseId = transfer.landPurchase?._id || transfer.landPurchase;
        const purchaseRes = await landAcquisitionPurchaseService.getPurchase(linkedPurchaseId);
        const purchaseRow = purchaseRes.data;
        setPurchase(purchaseRow);

        const mozaId = purchaseRow.moza?._id || purchaseRow.moza;
        const khasraRes = await getMozaKhasras(mozaId);
        const khasraOptions = sortKhasraEntries(khasraRes.data?.data || []);
        setMozaKhasras(khasraOptions);

        const selectedKhasras = (transfer.lines || [])
          .map((line) => {
            const entryId = line.khasraEntry?._id || line.khasraEntry;
            if (entryId) {
              return khasraOptions.find((k) => String(k._id) === String(entryId));
            }
            return khasraOptions.find((k) => 
              k.khasraNo === line.khasraNo && 
              (!line.khewatNo || k.khewatNo === line.khewatNo)
            );
          })
          .filter(Boolean);

        setForm({
          referenceNo: transfer.referenceNo || '',
          transferNo: transfer.transferNo || '',
          transferDate: transfer.transferDate
            ? new Date(transfer.transferDate).toISOString().slice(0, 10)
            : '',
          intiqalNo: transfer.intiqalNo || '',
          registryNo: transfer.registryNo || '',
          seller: transfer.seller || null,
          purchaser: transfer.purchaser || null,
          selectedKhasras,
          purchaseArea: areaToForm(transfer.purchaseArea),
          transferArea: areaToForm(transfer.transferArea)
        });
        const paymentRows = mapTransferPaymentsFromApi(transfer.transferPayments);
        setTransferPayments(paymentRows);
        const customTypes = paymentRows
          .map((row) => row.paymentType)
          .filter((type) => type && !DEFAULT_TRANSFER_PAYMENT_TYPES.includes(type));
        setCustomPaymentTypes([...new Set(customTypes)]);
        return;
      }

      // Create mode: no purchaseId pre-selected — user picks from deal dropdown
      if (!purchaseId) {
        setSelectedDealId('');
        setPurchase(null);
        setMozaKhasras([]);
        setForm(emptyForm());
        setTransferPayments(defaultTransferPaymentRows());
        setCustomPaymentTypes([]);
        return;
      }

      const [purchaseRes, numbersRes] = await Promise.all([
        landAcquisitionPurchaseService.getPurchase(purchaseId),
        landAcquisitionTransferService.getNextNumbers()
      ]);
      const purchaseRow = purchaseRes.data;
      setPurchase(purchaseRow);

      const mozaId = purchaseRow.moza?._id || purchaseRow.moza;
      const khasraRes = await getMozaKhasras(mozaId);
      const khasraOptions = sortKhasraEntries(khasraRes.data?.data || []);
      setMozaKhasras(khasraOptions);

      const purchaseIds = new Set((purchaseRow.lines || []).map((line) => String(line.khasraEntry?._id || line.khasraEntry)).filter(Boolean));
      const defaultKhasras = khasraOptions.filter((entry) => 
        purchaseIds.has(String(entry._id)) || 
        (purchaseRow.lines || []).some(l => l.khasraNo === entry.khasraNo && (!l.khewatNo || l.khewatNo === entry.khewatNo) && !l.khasraEntry)
      );
      // Use the deal's recorded totalArea directly
      const purchaseArea = purchaseRow.totalArea || { kanal: 0, marla: 0, sarsai: 0 };

      setForm({
        referenceNo: numbersRes.data?.referenceNo || '',
        transferNo: numbersRes.data?.transferNo || '',
        transferDate: new Date().toISOString().slice(0, 10),
        intiqalNo: '',
        registryNo: '',
        seller: purchaseRow.seller || null,
        purchaser: purchaseRow.purchaser || null,
        selectedKhasras: defaultKhasras,
        purchaseArea: areaToForm(purchaseArea),
        transferArea: areaToForm(purchaseArea)
      });
      setTransferPayments(defaultTransferPaymentRows());
      setCustomPaymentTypes([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load transfer details');
    } finally {
      setLoading(false);
    }
  }, [open, purchaseId, transferId, isEdit, loadParties, loadDeals]);

  // When user picks a deal from the dropdown, load that purchase
  const handleDealChange = useCallback(async (dealId) => {
    setSelectedDealId(dealId);
    if (!dealId) {
      setPurchase(null);
      setMozaKhasras([]);
      setForm(emptyForm());
      return;
    }
    setLoading(true);
    try {
      const deal = deals.find((d) => String(d._id) === String(dealId));
      const [purchaseRes, numbersRes] = await Promise.all([
        landAcquisitionPurchaseService.getPurchase(deal._id),
        landAcquisitionTransferService.getNextNumbers()
      ]);
      const purchaseRow = purchaseRes.data;
      setPurchase(purchaseRow);

      const mozaId = purchaseRow.moza?._id || purchaseRow.moza;
      const khasraRes = await getMozaKhasras(mozaId);
      const khasraOptions = sortKhasraEntries(khasraRes.data?.data || []);
      setMozaKhasras(khasraOptions);

      const purchaseIds = new Set((purchaseRow.lines || []).map((line) => String(line.khasraEntry?._id || line.khasraEntry)).filter(Boolean));
      const defaultKhasras = khasraOptions.filter((entry) => 
        purchaseIds.has(String(entry._id)) || 
        (purchaseRow.lines || []).some(l => l.khasraNo === entry.khasraNo && (!l.khewatNo || l.khewatNo === entry.khewatNo) && !l.khasraEntry)
      );
      
      const purchaseArea = purchaseRow.totalArea || { kanal: 0, marla: 0, sarsai: 0 };

      setForm({
        referenceNo: numbersRes.data?.referenceNo || '',
        transferNo: numbersRes.data?.transferNo || '',
        transferDate: new Date().toISOString().slice(0, 10),
        intiqalNo: '',
        registryNo: '',
        seller: purchaseRow.seller || null,
        purchaser: purchaseRow.purchaser || null,
        selectedKhasras: defaultKhasras,
        purchaseArea: areaToForm(purchaseArea),
        transferArea: areaToForm(purchaseArea)
      });
      setTransferPayments(defaultTransferPaymentRows());
      setCustomPaymentTypes([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load purchase for selected deal');
    } finally {
      setLoading(false);
    }
  }, [deals]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const handleKhasraChange = (_, value) => {
    const calculatedArea = value.reduce(
      (sum, entry) => addAreas(sum, entry.landInKhasra || {}),
      { kanal: 0, marla: 0, sarsai: 0 }
    );
    setForm((prev) => ({
      ...prev,
      selectedKhasras: value,
      transferArea: areaToForm(calculatedArea)
    }));
  };

  const buildPayload = () => {
    const lines = form.selectedKhasras.map((entry) => ({
      khasraEntry: entry._id,
      khewatNo: entry.khewatNo || '',
      khasraNo: entry.khasraNo || '',
      khasraArea: entry.landInKhasra || {}
    }));

    return {
      landPurchase: purchase?._id,
      referenceNo: form.referenceNo.trim(),
      transferDate: form.transferDate,
      intiqalNo: form.intiqalNo.trim(),
      registryNo: form.registryNo.trim(),
      seller: form.seller?._id || null,
      sellerCnic: form.seller?.cnic || '',
      sellerName: form.seller?.name || '',
      purchaser: form.purchaser?._id || null,
      purchaserCnic: form.purchaser?.cnic || '',
      purchaserName: form.purchaser?.name || '',
      lines,
      purchaseArea: parseAreaForm(form.purchaseArea),
      transferArea: parseAreaForm(form.transferArea),
      ratePerKanal,
      transferPayments: serializeTransferPayments(transferPayments),
      totalTransferPaymentsInWords: numberToWords(totalTransferPayments)
    };
  };

  const validateForm = () => {
    if (!form.seller) return 'Please select a seller';
    if (!form.referenceNo.trim()) return 'Reference number is required';
    if (!form.transferDate) return 'Transfer date is required';
    if (!form.selectedKhasras.length) return 'Please select at least one khasra';
    if (!transferSizeInKanal) return 'Transfer size is required';
    if (transferSizeInKanal > purchaseSizeInKanal) {
      return 'Transfer size cannot exceed selected purchase land size';
    }
    return '';
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
        await landAcquisitionTransferService.updateTransfer(transferId, payload);
        toast.success('Land transfer updated');
      } else {
        await landAcquisitionTransferService.createTransfer(payload);
        toast.success('Land transfer created');
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save land transfer';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <TransferIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {isEdit ? 'Edit Land Transfer' : 'Create Land Transfer'}
            </Typography>
            {purchase?.purchaseNo && (
              <Typography variant="body2" color="text.secondary">
                From Land Purchase {purchase.purchaseNo}
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: 'grey.50' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? (
          <CircularProgress size={28} sx={{ display: 'block', mx: 'auto', my: 4 }} />
        ) : (
          <Stack spacing={2.5}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Land Selection</Typography>
              <Grid container spacing={2}>
                {/* Deal No — dropdown in create mode, read-only in edit mode */}
                <Grid item xs={12} md={4}>
                  {isEdit ? (
                    <TextField
                      fullWidth
                      size="small"
                      label="Deal No"
                      value={purchase?.dealNo ?? ''}
                      InputProps={{ readOnly: true }}
                    />
                  ) : (
                    <TextField
                      fullWidth
                      select
                      size="small"
                      label="Deal No *"
                      value={selectedDealId}
                      onChange={(e) => handleDealChange(e.target.value)}
                      helperText={deals.length ? `${deals.length} deals available` : 'Loading deals...'}
                    >
                      <MenuItem value="">— Select Deal —</MenuItem>
                      {deals.map((d) => (
                        <MenuItem key={d._id} value={d._id}>
                          Deal {d.dealNo} — {d.purchaseNo}{d.mozaName ? ` (${d.mozaName})` : ''}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Land Purchase No"
                    value={purchase?.purchaseNo ?? ''}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Moza"
                    value={purchase?.moza?.name ?? ''}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    multiple
                    options={mozaKhasras}
                    value={form.selectedKhasras}
                    onChange={handleKhasraChange}
                    getOptionLabel={formatKhasraSelectLabel}
                    isOptionEqualToValue={(opt, val) => String(opt?._id) === String(val?._id)}
                    disabled={!mozaKhasras.length}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        label="Select Khasras *"
                        placeholder={mozaKhasras.length ? 'Select one or more khasras' : 'Loading khasras...'}
                        helperText={`${form.selectedKhasras.length} selected — all khasras from ${purchase?.moza?.name || 'moza'}`}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Purchase Land Size
                  </Typography>
                  <AreaInputs value={form.purchaseArea} onChange={() => {}} readOnly />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Total Size in Kanal"
                    value={purchaseSizeInKanal ? purchaseSizeInKanal.toFixed(4) : '0.0000'}
                    InputProps={{ readOnly: true }}
                    sx={{ '& .MuiInputBase-input': { bgcolor: 'primary.50', fontWeight: 700 } }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Size Summary"
                    value={formatAreaReadable(parseAreaForm(form.purchaseArea))}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              </Grid>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Transfer Information</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={sellers}
                    value={form.seller}
                    onChange={(_, value) => setForm((prev) => ({ ...prev, seller: value }))}
                    getOptionLabel={partyLabel}
                    isOptionEqualToValue={(opt, val) => String(opt?._id) === String(val?._id)}
                    renderInput={(params) => (
                      <TextField {...params} size="small" label="Seller *" placeholder="Select seller" />
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
                      <TextField {...params} size="small" label="Purchaser" placeholder="Select purchaser" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Reference No *"
                    value={form.referenceNo}
                    onChange={(e) => setForm((prev) => ({ ...prev, referenceNo: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Land Transfer No"
                    value={form.transferNo}
                    InputProps={{ readOnly: true }}
                    helperText="Auto-generated"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Transfer Date *"
                    value={form.transferDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, transferDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Intiqal #"
                    value={form.intiqalNo}
                    onChange={(e) => setForm((prev) => ({ ...prev, intiqalNo: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Registry #"
                    value={form.registryNo}
                    onChange={(e) => setForm((prev) => ({ ...prev, registryNo: e.target.value }))}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 0.5 }} />
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1, mb: 1 }}>
                    Transfer Size
                  </Typography>
                  <AreaInputs
                    value={form.transferArea}
                    onChange={(transferArea) => setForm((prev) => ({ ...prev, transferArea }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Total Size in Kanal"
                    value={transferSizeInKanal ? transferSizeInKanal.toFixed(4) : '0.0000'}
                    InputProps={{ readOnly: true }}
                    sx={{ '& .MuiInputBase-input': { bgcolor: 'primary.50', fontWeight: 700 } }}
                  />
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
                <Chip label={`Transfer ${formatAreaReadable(parseAreaForm(form.transferArea))}`} size="small" />
                <Chip label={`Charges PKR ${formatMoney(totalTransferPayments)}`} color="warning" size="small" variant="outlined" />
              </Stack>
            </Paper>

            <LandTransferPaymentsPanel
              payments={transferPayments}
              onChange={setTransferPayments}
              customTypes={customPaymentTypes}
              onAddCustomType={(name) => setCustomPaymentTypes((prev) => [...new Set([...prev, name])])}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || loading}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {isEdit ? 'Update Transfer' : 'Create Transfer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
