import React, { useRef, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  LinearProgress,
  Stack,
  Chip,
  Paper
} from '@mui/material';
import {
  AttachFile as AttachFileIcon,
  Delete as DeleteIcon,
  OpenInNew as OpenInNewIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import { compressImages, MAX_ATTACHMENTS } from '../../utils/compressImage';

const resolveUrl = (relativePath) => {
  if (!relativePath) return '';
  if (relativePath.startsWith('http') || relativePath.startsWith('blob:')) return relativePath;
  const apiBase = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:5001/api`;
  const origin = apiBase.replace(/\/api\/?$/, '');
  return `${origin}${relativePath.startsWith('/') ? relativePath : `/${relativePath}`}`;
};

const formatBytes = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * BillAttachmentsPanel
 *
 * Props:
 *   pendingFiles     {File[]}           - newly picked files not yet uploaded
 *   setPendingFiles  (files: File[]) => void
 *   savedAttachments {Array}            - already-saved attachment objects from DB ({url, originalName, ...})
 *   onRemoveSaved    (index: number) => void
 *   compressing      {boolean}
 *   compressProgress {{ done: number, total: number }} | null
 *   readOnly         {boolean}
 */
const BillAttachmentsPanel = ({
  pendingFiles = [],
  setPendingFiles,
  savedAttachments = [],
  onRemoveSaved,
  compressing = false,
  compressProgress = null,
  readOnly = false
}) => {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const totalCount = savedAttachments.length + pendingFiles.length;
  const remaining = MAX_ATTACHMENTS - totalCount;

  const addFiles = useCallback(
    async (rawFiles) => {
      if (!rawFiles || !rawFiles.length || readOnly) return;
      const allowedCount = Math.max(0, remaining);
      if (allowedCount === 0) return;
      const sliced = Array.from(rawFiles).slice(0, allowedCount);
      setPendingFiles((prev) => [...prev, ...sliced]);
    },
    [remaining, readOnly, setPendingFiles]
  );

  const handleInputChange = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const removePending = (idx) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const thumbStyle = {
    width: 72,
    height: 72,
    objectFit: 'cover',
    borderRadius: 1,
    border: '1px solid',
    borderColor: 'divider'
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <Typography variant="subtitle2" fontWeight={600}>
          Attachments
        </Typography>
        <Chip
          size="small"
          label={`${totalCount} / ${MAX_ATTACHMENTS}`}
          color={totalCount >= MAX_ATTACHMENTS ? 'error' : 'default'}
          variant="outlined"
        />
        {compressing && compressProgress && (
          <Typography variant="caption" color="text.secondary">
            Compressing {compressProgress.done}/{compressProgress.total}…
          </Typography>
        )}
      </Stack>

      {compressing && (
        <LinearProgress
          variant="determinate"
          value={compressProgress ? Math.round((compressProgress.done / compressProgress.total) * 100) : 0}
          sx={{ mb: 1, borderRadius: 1 }}
        />
      )}

      {/* Saved attachments */}
      {savedAttachments.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          {savedAttachments.map((att, idx) => {
            const url = resolveUrl(att.url);
            const isImage = att.mimeType?.startsWith('image/');
            return (
              <Paper
                key={idx}
                variant="outlined"
                sx={{ p: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 88, position: 'relative' }}
              >
                {isImage ? (
                  <Box component="img" src={url} alt={att.originalName || `attachment-${idx + 1}`} sx={thumbStyle} />
                ) : (
                  <Box sx={{ ...thumbStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.100' }}>
                    <ImageIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
                  </Box>
                )}
                <Typography variant="caption" noWrap sx={{ maxWidth: 80, mt: 0.25 }}>
                  {att.originalName || `#${idx + 1}`}
                </Typography>
                {att.sizeBytes > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    {formatBytes(att.sizeBytes)}
                  </Typography>
                )}
                <Stack direction="row" spacing={0.25} mt={0.25}>
                  <Tooltip title="Open">
                    <IconButton size="small" component="a" href={url} target="_blank" rel="noopener noreferrer">
                      <OpenInNewIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                  {!readOnly && (
                    <Tooltip title="Remove">
                      <IconButton size="small" color="error" onClick={() => onRemoveSaved(idx)}>
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* Pending (new) files */}
      {pendingFiles.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          {pendingFiles.map((file, idx) => {
            const previewUrl = URL.createObjectURL(file);
            const isImage = file.type?.startsWith('image/');
            return (
              <Paper
                key={idx}
                variant="outlined"
                sx={{ p: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 88, position: 'relative', borderColor: 'primary.light' }}
              >
                {isImage ? (
                  <Box
                    component="img"
                    src={previewUrl}
                    alt={file.name}
                    sx={thumbStyle}
                    onLoad={() => URL.revokeObjectURL(previewUrl)}
                  />
                ) : (
                  <Box sx={{ ...thumbStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.100' }}>
                    <ImageIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
                  </Box>
                )}
                <Typography variant="caption" noWrap sx={{ maxWidth: 80, mt: 0.25 }}>
                  {file.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  {formatBytes(file.size)}
                </Typography>
                {!readOnly && (
                  <Tooltip title="Remove">
                    <IconButton size="small" color="error" onClick={() => removePending(idx)}>
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Paper>
            );
          })}
        </Box>
      )}

      {/* Drop zone / add button */}
      {!readOnly && remaining > 0 && (
        <Box
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          sx={{
            border: '2px dashed',
            borderColor: dragOver ? 'primary.main' : 'divider',
            borderRadius: 1,
            p: 1.5,
            textAlign: 'center',
            bgcolor: dragOver ? 'action.hover' : 'transparent',
            transition: 'all 0.15s'
          }}
        >
          <input
            ref={inputRef}
            type="file"
            hidden
            multiple
            accept="image/*,application/pdf"
            onChange={handleInputChange}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<AttachFileIcon />}
            onClick={() => inputRef.current?.click()}
            disabled={compressing}
          >
            Add images / PDFs
          </Button>
          <Typography variant="caption" display="block" color="text.secondary" mt={0.5}>
            Drag & drop or click · up to {remaining} more · images compressed automatically
          </Typography>
        </Box>
      )}

      {!readOnly && remaining === 0 && (
        <Typography variant="caption" color="warning.main">
          Maximum {MAX_ATTACHMENTS} attachments reached.
        </Typography>
      )}
    </Box>
  );
};

export default BillAttachmentsPanel;
