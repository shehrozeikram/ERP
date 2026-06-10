import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Stack,
  Typography
} from '@mui/material';
import { NODE_TYPE_OPTIONS } from './orgChartHelpers';

const emptyForm = {
  title: '',
  name: '',
  type: 'management',
  isVacant: false
};

const OrgChartNodeFormDialog = ({
  open,
  mode = 'create',
  initialValues,
  onClose,
  onSubmit,
  submitting = false
}) => {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) {
      setForm({
        title: initialValues?.title || '',
        name: initialValues?.name || '',
        type: initialValues?.type || 'management',
        isVacant: !!initialValues?.isVacant
      });
    }
  }, [open, initialValues]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSubmit({
      title: form.title.trim(),
      name: form.name.trim(),
      type: form.type,
      isVacant: form.isVacant
    });
  };

  const selectedType = NODE_TYPE_OPTIONS.find((o) => o.value === form.type);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{mode === 'edit' ? 'Edit position' : 'Add position'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title / Designation"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              fullWidth
              autoFocus
              placeholder="e.g. Director Finance"
            />
            <TextField
              label="Name (optional)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              placeholder="e.g. Mansoor Zareen"
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {NODE_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedType && (
              <Typography variant="caption" color="text.secondary">
                {selectedType.hint}
              </Typography>
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={form.isVacant}
                  onChange={(e) => setForm((f) => ({ ...f, isVacant: e.target.checked }))}
                />
              }
              label="Vacant position (shown in red)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitting || !form.title.trim()}>
            {mode === 'edit' ? 'Save changes' : 'Add'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default OrgChartNodeFormDialog;
