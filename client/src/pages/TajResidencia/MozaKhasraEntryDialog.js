import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { emptyArea, areaToForm } from '../../utils/landAreaUnits';

export const AREA_FIELDS = [
  { key: 'landInKhasra', label: 'Land in Khasra' }
];

export const emptyEntryForm = (srNo = '') => ({
  srNo: srNo === '' ? '' : String(srNo),
  khasraNo: '',
  khewatNo: '',
  landInKhasra: emptyArea(),
  mozaRef: ''
});

const entryToForm = (entry) => ({
  srNo: String(entry.srNo ?? ''),
  khasraNo: entry.khasraNo || '',
  khewatNo: entry.khewatNo || '',
  landInKhasra: areaToForm(entry.landInKhasra),
  mozaRef: entry.mozaRef || ''
});

const MozaKhasraEntryDialog = ({ open, onClose, onSave, entry, suggestedSrNo, saving, mozaName }) => {
  const [form, setForm] = useState(emptyEntryForm());

  useEffect(() => {
    if (!open) return;
    setForm(entry ? entryToForm(entry) : emptyEntryForm(suggestedSrNo || ''));
  }, [open, entry, suggestedSrNo]);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setArea = (areaKey, unit) => (e) => {
    setForm((prev) => ({
      ...prev,
      [areaKey]: { ...prev[areaKey], [unit]: e.target.value }
    }));
  };

  const handleSubmit = () => onSave(form);

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="md" fullWidth>
      <DialogTitle>{entry ? 'Edit Khasra Record' : 'Add Khasra Record'}{mozaName ? ` — ${mozaName}` : ''}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={4} sm={2}>
            <TextField fullWidth required label="Sr No" type="number" value={form.srNo} onChange={set('srNo')} inputProps={{ min: 1 }} />
          </Grid>
          <Grid item xs={4} sm={5}>
            <TextField fullWidth required label="Khasra No." value={form.khasraNo} onChange={set('khasraNo')} />
          </Grid>
          <Grid item xs={4} sm={5}>
            <TextField fullWidth required label="Khewat No." value={form.khewatNo} onChange={set('khewatNo')} />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" gutterBottom>Land areas (Kanal · Marla · Sarsai)</Typography>

        {AREA_FIELDS.map(({ key, label }) => (
          <Box key={key} sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              {label}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              {['kanal', 'marla', 'sarsai'].map((unit) => (
                <TextField
                  key={unit}
                  size="small"
                  label={unit === 'kanal' ? 'K' : unit === 'marla' ? 'M' : 'S'}
                  type="number"
                  value={form[key][unit]}
                  onChange={setArea(key, unit)}
                  inputProps={{ min: 0 }}
                  sx={{ width: 72 }}
                />
              ))}
            </Stack>
          </Box>
        ))}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Moza ref" value={form.mozaRef} onChange={set('mozaRef')} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving || !form.khasraNo.trim() || !form.khewatNo.trim()}>
          {saving ? 'Saving…' : entry ? 'Update' : 'Add Record'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MozaKhasraEntryDialog;
