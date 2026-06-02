import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { compressImages, MAX_ATTACHMENTS } from '../../utils/compressImage';
import {
  getLineAttachmentUrls,
  isAttachmentPdf
} from '../../utils/utilityBillAttachments';
import { resolveUploadFileHref } from '../../utils/uploadPaths';

const MAX_LINE_ATTACHMENTS = MAX_ATTACHMENTS;

/**
 * Multi-image/PDF line attachments with client-side compression (utility bills, cash approvals).
 */
const LineAttachmentCell = ({
  line,
  onLineChange,
  readOnly = false,
  resolveUrl = resolveUploadFileHref
}) => {
  const inputRef = React.useRef(null);
  const [cellCompressing, setCellCompressing] = React.useState(false);
  const savedUrls = getLineAttachmentUrls(line);
  const pending = line._pendingFiles || [];
  const total = savedUrls.length + pending.length;
  const remaining = MAX_LINE_ATTACHMENTS - total;

  const patchLine = (patch) => onLineChange?.({ ...line, ...patch });

  const setSavedUrls = (urls) => {
    if (Array.isArray(line.attachments)) {
      patchLine({
        attachments: urls.map((url) => {
          const prev = (line.attachments || []).find((a) => (a?.url || a) === url);
          return typeof prev === 'object' && prev !== null
            ? { ...prev, url }
            : { url, uploadedAt: new Date().toISOString() };
        }),
        attachmentUrls: urls,
        attachmentUrl: urls[0] || ''
      });
    } else {
      patchLine({ attachmentUrls: urls, attachmentUrl: urls[0] || '' });
    }
  };

  const addFiles = async (files) => {
    if (!files?.length || readOnly) return;
    const allowed = Array.from(files).slice(0, Math.max(0, remaining));
    setCellCompressing(true);
    try {
      const compressed = await compressImages(allowed);
      patchLine({ _pendingFiles: [...pending, ...compressed] });
    } finally {
      setCellCompressing(false);
    }
  };

  const removeSaved = (urlIdx) => {
    setSavedUrls(savedUrls.filter((_, i) => i !== urlIdx));
  };

  const removePending = (fileIdx) => {
    patchLine({ _pendingFiles: pending.filter((_, i) => i !== fileIdx) });
  };

  const thumbSx = {
    width: 40,
    height: 40,
    objectFit: 'cover',
    borderRadius: '4px',
    border: '1px solid',
    borderColor: 'divider',
    display: 'block'
  };

  return (
    <Stack spacing={0.5}>
      {savedUrls.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={0.5}>
          {savedUrls.map((url, i) => {
            const att = (line.attachments || []).find((a) => a?.url === url) || (line.attachments || [])[i];
            const mime = att?.mimeType || '';
            const href = resolveUrl(url, mime);
            const isPdf = isAttachmentPdf(url, mime);
            return (
            <Box key={`${url}-${i}`} sx={{ position: 'relative', display: 'inline-flex' }}>
              {isPdf ? (
                <Box
                  sx={{
                    ...thumbSx,
                    bgcolor: 'grey.100',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    color: 'text.secondary',
                    cursor: 'pointer'
                  }}
                  onClick={() => window.open(href, '_blank')}
                >
                  PDF
                </Box>
              ) : (
              <Box
                component="img"
                src={href}
                alt={`attachment-${i + 1}`}
                sx={thumbSx}
                onClick={() => window.open(href, '_blank')}
                style={{ cursor: 'pointer' }}
              />
              )}
              {!readOnly && (
                <Box
                  onClick={() => removeSaved(i)}
                  sx={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    bgcolor: 'error.main',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    cursor: 'pointer',
                    lineHeight: 1
                  }}
                >
                  ×
                </Box>
              )}
            </Box>
          );
          })}
        </Stack>
      )}
      {pending.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={0.5}>
          {pending.map((file, i) => {
            const isImg = file.type?.startsWith('image/');
            const src = isImg ? URL.createObjectURL(file) : null;
            return (
              <Box key={`${file.name}-${i}`} sx={{ position: 'relative', display: 'inline-flex' }}>
                {isImg ? (
                  <Box
                    component="img"
                    src={src}
                    alt={file.name}
                    sx={{ ...thumbSx, borderColor: 'primary.light' }}
                    onLoad={() => src && URL.revokeObjectURL(src)}
                  />
                ) : (
                  <Box
                    sx={{
                      ...thumbSx,
                      bgcolor: 'grey.100',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      color: 'text.secondary'
                    }}
                  >
                    PDF
                  </Box>
                )}
                <Box
                  onClick={() => removePending(i)}
                  sx={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    bgcolor: 'warning.main',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    cursor: 'pointer',
                    lineHeight: 1
                  }}
                >
                  ×
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}
      {!readOnly && remaining > 0 && (
        <>
          <input
            ref={inputRef}
            type="file"
            hidden
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Button
            variant="text"
            size="small"
            disabled={cellCompressing}
            sx={{ alignSelf: 'flex-start', p: 0, minWidth: 0, fontSize: '0.75rem' }}
            onClick={() => inputRef.current?.click()}
          >
            {cellCompressing ? 'Compressing…' : total === 0 ? '+ Attach' : `+ Add (${remaining} left)`}
          </Button>
        </>
      )}
      {!readOnly && remaining === 0 && total > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
          Max {MAX_LINE_ATTACHMENTS} reached
        </Typography>
      )}
    </Stack>
  );
};

export default LineAttachmentCell;
