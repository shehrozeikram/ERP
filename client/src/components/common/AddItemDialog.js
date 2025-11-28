/**
 * Reusable dialog component for adding new items
 * Lightweight and flexible
 */
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Box
} from '@mui/material';

const AddItemDialog = ({
  open,
  onClose,
  title,
  formData,
  onChange,
  onSave,
  loading = false,
  fields = [],
  maxWidth = 'sm'
}) => {
  const handleFieldChange = (field, value) => {
    if (onChange) {
      onChange(field, value);
    }
  };

  const renderField = (field) => {
    const { name, label, type = 'text', required = false, options = [], multiline = false, rows = 1, ...props } = field;

    if (type === 'select') {
      return (
        <Grid item xs={12} md={options.length > 3 ? 12 : 6} key={name}>
          {/* Select will be handled by parent component */}
        </Grid>
      );
    }

    return (
      <Grid item xs={12} md={options.length > 3 ? 12 : 6} key={name}>
        <TextField
          fullWidth
          label={label}
          value={formData[name] || ''}
          onChange={(e) => handleFieldChange(name, e.target.value)}
          required={required}
          multiline={multiline}
          rows={rows}
          {...props}
        />
      </Grid>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            {fields.map(renderField)}
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={onSave} variant="contained" disabled={loading}>
          {loading ? 'Adding...' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddItemDialog;

