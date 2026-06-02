import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Typography
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useZoomPanImage } from '../../hooks/useZoomPanImage';
import ZoomPanImageToolbar from '../common/ZoomPanImageToolbar';

/**
 * Full-size attachment viewer with carousel, zoom, and pan (reuses utility bill image viewer behavior).
 */
const AttachmentCarouselDialog = ({
  open,
  onClose,
  slides = [],
  initialIndex = 0,
  title = 'Attachment',
  onIndexChange
}) => {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  useEffect(() => {
    if (open) onIndexChange?.(index);
  }, [open, index, onIndexChange]);

  const count = slides.length;
  const hasMultiple = count > 1;
  const current = slides[index];
  const isImage = current && !current.isPdf;

  const {
    zoomIn,
    zoomOut,
    resetView,
    startDrag,
    containerSx,
    imageSx,
    containerHandlers
  } = useZoomPanImage(open && isImage ? `${index}-${current.href}` : null);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + count) % count);
  }, [count]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % count);
  }, [count]);

  useEffect(() => {
    if (!open || !count) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, count, goPrev, goNext, onClose]);

  if (!count || !current) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { bgcolor: 'grey.900', color: 'common.white' }
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'grey.700'
        }}
      >
        <Typography variant="subtitle1" component="span">
          {title}
          {hasMultiple ? ` · ${index + 1} / ${count}` : ''}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isImage && (
            <ZoomPanImageToolbar
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onReset={resetView}
              iconColor="common.white"
            />
          )}
          <IconButton onClick={onClose} aria-label="Close" sx={{ color: 'common.white' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      <DialogContent
        {...(isImage ? containerHandlers : {})}
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: { xs: 280, sm: 420 },
          p: { xs: 1, sm: 2 },
          ...(isImage ? containerSx : { overflow: 'hidden' })
        }}
      >
        {hasMultiple && (
          <IconButton
            onClick={goPrev}
            aria-label="Previous attachment"
            sx={{
              position: 'absolute',
              left: 8,
              zIndex: 2,
              bgcolor: 'rgba(0,0,0,0.45)',
              color: 'common.white',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' }
            }}
          >
            <ChevronLeftIcon fontSize="large" />
          </IconButton>
        )}

        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: '100%',
            mx: hasMultiple ? 6 : 0
          }}
        >
          {current.isPdf ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                PDF document
              </Typography>
              <Button
                variant="contained"
                href={current.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open PDF in new tab
              </Button>
            </Box>
          ) : (
            <Box
              component="img"
              src={current.href}
              alt={`${title} ${index + 1}`}
              onMouseDown={startDrag}
              sx={{
                ...imageSx,
                borderRadius: 1
              }}
            />
          )}
        </Box>

        {hasMultiple && (
          <IconButton
            onClick={goNext}
            aria-label="Next attachment"
            sx={{
              position: 'absolute',
              right: 8,
              zIndex: 2,
              bgcolor: 'rgba(0,0,0,0.45)',
              color: 'common.white',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' }
            }}
          >
            <ChevronRightIcon fontSize="large" />
          </IconButton>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AttachmentCarouselDialog;
