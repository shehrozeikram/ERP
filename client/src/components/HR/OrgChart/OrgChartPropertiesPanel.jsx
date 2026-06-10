import React from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Button,
  Divider,
  Stack
} from '@mui/material';
import { Delete, Add } from '@mui/icons-material';
import { NODE_TYPE_OPTIONS } from './orgChartHelpers';

const OrgChartPropertiesPanel = ({
  node,
  parentOptions,
  parentId,
  onParentChange,
  onChange,
  onSave,
  onDelete,
  onAddChild,
  readOnly,
  saving
}) => (
  <Paper
    variant="outlined"
    sx={{
      width: 280,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 0,
      borderTop: 0,
      borderBottom: 0,
      borderRight: 0
    }}
  >
    <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider', bgcolor: '#EAE9E8' }}>
      <Typography variant="caption" fontWeight={700} sx={{ letterSpacing: '0.06em' }}>
        PROPERTIES
      </Typography>
    </Box>

    {!node ? (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Select a shape on the canvas to edit its properties.
        </Typography>
      </Box>
    ) : (
      <Stack spacing={2} sx={{ p: 2, overflow: 'auto' }}>
        <TextField
          label="Title / Designation"
          size="small"
          fullWidth
          value={node.title}
          onChange={(e) => onChange({ title: e.target.value })}
          disabled={readOnly}
        />
        <TextField
          label="Name"
          size="small"
          fullWidth
          value={node.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
          disabled={readOnly}
        />
        <FormControl fullWidth size="small">
          <InputLabel>Type</InputLabel>
          <Select
            label="Type"
            value={node.type}
            onChange={(e) => onChange({ type: e.target.value })}
            disabled={readOnly}
          >
            {NODE_TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Switch
              checked={!!node.isVacant}
              onChange={(e) => onChange({ isVacant: e.target.checked })}
              disabled={readOnly}
            />
          }
          label="Vacant"
        />

        {!node.isRoot && !readOnly && (
          <FormControl fullWidth size="small">
            <InputLabel>Reports to</InputLabel>
            <Select
              label="Reports to"
              value={parentId || ''}
              onChange={(e) => onParentChange(e.target.value)}
            >
              {parentOptions.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  {`${'  '.repeat(opt.depth)}${opt.title}${opt.name ? ` — ${opt.name}` : ''}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {!readOnly && (
          <>
            <Divider />
            <Button variant="contained" onClick={onSave} disabled={saving}>
              Save properties
            </Button>
            <Button variant="outlined" startIcon={<Add />} onClick={onAddChild}>
              Add child shape
            </Button>
            {!node.isRoot && (
              <Button color="error" variant="outlined" startIcon={<Delete />} onClick={onDelete}>
                Delete shape
              </Button>
            )}
          </>
        )}
      </Stack>
    )}
  </Paper>
);

export default OrgChartPropertiesPanel;
