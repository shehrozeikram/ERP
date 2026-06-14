import React from 'react';
import {
  Box,
  Checkbox,
  FormHelperText,
  Rating,
  Stack,
  TextField,
  ToggleButton,
  Typography
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioIcon
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';

const RATING_LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
const OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const DynamicQuestionField = ({
  question,
  value,
  onChange,
  disabled = false,
  error = '',
  readOnly = false,
  showLabel = true,
  variant = 'default'
}) => {
  const theme = useTheme();
  const isWizard = variant === 'wizard';

  const handleChange = (next) => {
    if (!readOnly) onChange(question.key, next);
  };

  const labelBlock = showLabel ? (
    <Box sx={{ mb: isWizard ? 3 : 2 }}>
      <Typography
        variant={isWizard ? 'h5' : 'body1'}
        fontWeight={isWizard ? 700 : 600}
        sx={{ lineHeight: 1.4 }}
      >
        {question.label}
        {question.required && (
          <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>*</Typography>
        )}
      </Typography>
      {question.description && (
        <Typography
          variant={isWizard ? 'body1' : 'body2'}
          color="text.secondary"
          sx={{ mt: 1 }}
        >
          {question.description}
        </Typography>
      )}
    </Box>
  ) : null;

  const choiceCardSx = (selected) => ({
    px: isWizard ? 2.5 : 2,
    py: isWizard ? 2 : 1.5,
    borderRadius: isWizard ? 3 : 2,
    border: '2px solid',
    borderColor: selected ? 'primary.main' : 'divider',
    bgcolor: selected ? alpha(theme.palette.primary.main, 0.1) : 'background.paper',
    cursor: disabled || readOnly ? 'default' : 'pointer',
    transition: 'all 0.2s ease',
    transform: selected && isWizard ? 'scale(1.01)' : 'none',
    boxShadow: selected
      ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.18)}`
      : 'none',
    '&:hover': disabled || readOnly ? {} : {
      borderColor: selected ? 'primary.main' : 'primary.light',
      boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.14)}`,
      transform: isWizard ? 'translateY(-1px)' : 'none'
    }
  });

  const letterBadge = (index, selected) => (
    <Box
      sx={{
        minWidth: isWizard ? 36 : 28,
        height: isWizard ? 36 : 28,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: isWizard ? '0.9rem' : '0.75rem',
        bgcolor: selected
          ? 'primary.main'
          : alpha(theme.palette.grey[500], 0.1),
        color: selected ? 'primary.contrastText' : 'text.secondary',
        flexShrink: 0
      }}
    >
      {OPTION_LETTERS[index] || index + 1}
    </Box>
  );

  const renderError = () => (
    error ? (
      <FormHelperText error sx={{ mt: 1.5, mx: 0, fontSize: isWizard ? '0.9rem' : undefined }}>
        {error}
      </FormHelperText>
    ) : null
  );

  switch (question.type) {
    case 'textarea':
      return (
        <Box>
          {labelBlock}
          <TextField
            fullWidth
            multiline
            minRows={isWizard ? 5 : 4}
            placeholder="Share your thoughts…"
            value={value || ''}
            disabled={disabled || readOnly}
            error={Boolean(error)}
            onChange={(e) => handleChange(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                fontSize: isWizard ? '1.05rem' : undefined,
                bgcolor: readOnly ? alpha(theme.palette.grey[500], 0.04) : 'background.paper'
              }
            }}
          />
          {renderError()}
        </Box>
      );

    case 'number':
      return (
        <Box>
          {labelBlock}
          <TextField
            fullWidth
            type="number"
            placeholder="Enter a number"
            value={value ?? ''}
            disabled={disabled || readOnly}
            error={Boolean(error)}
            onChange={(e) => handleChange(e.target.value === '' ? '' : Number(e.target.value))}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                fontSize: isWizard ? '1.1rem' : undefined
              }
            }}
          />
          {renderError()}
        </Box>
      );

    case 'date':
      return (
        <Box>
          {labelBlock}
          <TextField
            fullWidth
            type="date"
            value={value || ''}
            disabled={disabled || readOnly}
            error={Boolean(error)}
            InputLabelProps={{ shrink: true }}
            onChange={(e) => handleChange(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />
          {renderError()}
        </Box>
      );

    case 'rating': {
      const max = question.max || 5;
      const min = question.min || 1;
      const numValue = Number(value) || 0;
      const labelIndex = Math.min(
        RATING_LABELS.length - 1,
        Math.max(0, Math.round(((numValue - min) / Math.max(max - min, 1)) * (RATING_LABELS.length - 1)))
      );

      return (
        <Box>
          {labelBlock}
          <Stack
            alignItems="center"
            spacing={2}
            sx={{
              p: isWizard ? 4 : 2.5,
              borderRadius: 3,
              border: '1px solid',
              borderColor: error ? 'error.main' : 'divider',
              bgcolor: alpha(theme.palette.primary.main, 0.04)
            }}
          >
            <Rating
              value={numValue}
              max={max}
              disabled={disabled || readOnly}
              size="large"
              onChange={(_, next) => handleChange(next || 0)}
              sx={{ fontSize: isWizard ? '3rem' : '2.4rem' }}
            />
            <Box textAlign="center">
              <Typography variant={isWizard ? 'h6' : 'body2'} fontWeight={600} color="primary.main">
                {numValue ? RATING_LABELS[labelIndex] : 'Tap a star to rate'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {min} — {max}
              </Typography>
            </Box>
          </Stack>
          {renderError()}
        </Box>
      );
    }

    case 'yes_no':
      return (
        <Box>
          {labelBlock}
          <Stack direction="row" spacing={2} flexWrap="wrap" justifyContent={isWizard ? 'center' : 'flex-start'}>
            {[
              { val: 'yes', label: 'Yes', emoji: '✓' },
              { val: 'no', label: 'No', emoji: '✗' }
            ].map(({ val, label }) => (
              <ToggleButton
                key={val}
                value={val}
                selected={value === val}
                disabled={disabled || readOnly}
                onClick={() => handleChange(val)}
                sx={{
                  px: isWizard ? 6 : 4,
                  py: isWizard ? 2 : 1.25,
                  borderRadius: '16px !important',
                  border: '2px solid !important',
                  borderColor: value === val ? 'primary.main' : 'divider',
                  bgcolor: value === val ? alpha(theme.palette.primary.main, 0.12) : 'background.paper',
                  fontWeight: 700,
                  fontSize: isWizard ? '1.1rem' : undefined,
                  textTransform: 'none',
                  minWidth: isWizard ? 140 : undefined,
                  '&.Mui-selected': {
                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                    color: 'primary.main'
                  }
                }}
              >
                {label}
              </ToggleButton>
            ))}
          </Stack>
          {renderError()}
        </Box>
      );

    case 'single_choice':
      return (
        <Box>
          {labelBlock}
          <Stack spacing={isWizard ? 1.5 : 1.25}>
            {(question.options || []).map((opt, index) => {
              const selected = value === opt.value;
              return (
                <Box
                  key={opt.value}
                  onClick={() => !disabled && !readOnly && handleChange(opt.value)}
                  sx={choiceCardSx(selected)}
                >
                  <Stack direction="row" alignItems="center" spacing={2}>
                    {isWizard ? letterBadge(index, selected) : (
                      selected
                        ? <CheckCircleIcon color="primary" fontSize="small" />
                        : <RadioIcon color="disabled" fontSize="small" />
                    )}
                    <Typography
                      variant={isWizard ? 'body1' : 'body1'}
                      fontWeight={selected ? 600 : 400}
                      sx={{ fontSize: isWizard ? '1.05rem' : undefined }}
                    >
                      {opt.label}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
          {renderError()}
        </Box>
      );

    case 'multiple_choice':
      return (
        <Box>
          {labelBlock}
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ mb: 1.5, fontSize: isWizard ? '0.85rem' : undefined }}
          >
            Select all that apply
          </Typography>
          <Stack spacing={isWizard ? 1.5 : 1.25}>
            {(question.options || []).map((opt, index) => {
              const selected = Array.isArray(value) ? value : [];
              const checked = selected.includes(opt.value);
              return (
                <Box
                  key={opt.value}
                  onClick={() => {
                    if (disabled || readOnly) return;
                    const next = checked
                      ? selected.filter((v) => v !== opt.value)
                      : [...selected, opt.value];
                    handleChange(next);
                  }}
                  sx={choiceCardSx(checked)}
                >
                  <Stack direction="row" alignItems="center" spacing={2}>
                    {isWizard ? letterBadge(index, checked) : (
                      <Checkbox checked={checked} tabIndex={-1} disableRipple sx={{ p: 0 }} />
                    )}
                    <Typography
                      fontWeight={checked ? 600 : 400}
                      sx={{ fontSize: isWizard ? '1.05rem' : undefined }}
                    >
                      {opt.label}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
          {renderError()}
        </Box>
      );

    default:
      return (
        <Box>
          {labelBlock}
          <TextField
            fullWidth
            placeholder="Type your answer…"
            value={value || ''}
            disabled={disabled || readOnly}
            error={Boolean(error)}
            onChange={(e) => handleChange(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                fontSize: isWizard ? '1.05rem' : undefined
              }
            }}
          />
          {renderError()}
        </Box>
      );
  }
};

export default DynamicQuestionField;
