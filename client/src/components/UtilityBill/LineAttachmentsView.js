import React, { useEffect, useMemo, useState } from 'react';
import { Box, IconButton, Link, Typography } from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import {
  buildLineAttachmentSlides,
  resolveUploadFileHref
} from '../../utils/utilityBillAttachments';
import AttachmentCarouselDialog from './AttachmentCarouselDialog';

/**
 * Read-only attachment carousel for bill / cash approval line items.
 */
const LineAttachmentsView = ({
  line,
  thumbSize = 56,
  previewTitle = 'Attachment',
  resolveHref = resolveUploadFileHref
}) => {
  const slides = useMemo(
    () => buildLineAttachmentSlides(line, resolveHref),
    [line, resolveHref]
  );
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [imgError, setImgError] = useState({});

  const slideKey = slides.map((s) => s.href).join('|');

  useEffect(() => {
    setIndex(0);
    setImgError({});
  }, [line?.storeItem, slideKey]);

  useEffect(() => {
    if (index >= slides.length && slides.length > 0) {
      setIndex(slides.length - 1);
    }
  }, [index, slides.length]);

  if (!slides.length) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    );
  }

  const current = slides[index];
  const hasMultiple = slides.length > 1;

  const goPrev = (e) => {
    e?.stopPropagation?.();
    setIndex((i) => (i - 1 + slides.length) % slides.length);
  };

  const goNext = (e) => {
    e?.stopPropagation?.();
    setIndex((i) => (i + 1) % slides.length);
  };

  const openViewer = () => {
    if (current.isPdf) {
      window.open(current.href, '_blank', 'noopener,noreferrer');
      return;
    }
    setViewerOpen(true);
  };

  const thumbSx = {
    width: thumbSize,
    height: thumbSize,
    objectFit: 'cover',
    borderRadius: '4px',
    border: '1px solid',
    borderColor: 'divider',
    display: 'block',
    cursor: 'pointer',
    flexShrink: 0
  };

  const handleImgError = (slideIndex) => {
    setImgError((prev) => ({ ...prev, [slideIndex]: true }));
  };

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.25,
            width: '100%',
            maxWidth: thumbSize + (hasMultiple ? 56 : 0)
          }}
        >
          {hasMultiple && (
            <IconButton
              size="small"
              onClick={goPrev}
              aria-label="Previous attachment"
              sx={{ p: 0.25 }}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          )}

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: thumbSize,
              minHeight: thumbSize
            }}
          >
            {current.isPdf ? (
              <Link
                href={current.href}
                target="_blank"
                rel="noopener noreferrer"
                variant="caption"
                sx={{
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: thumbSize,
                  height: thumbSize,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '4px',
                  bgcolor: 'grey.50'
                }}
              >
                PDF
              </Link>
            ) : imgError[index] ? (
              <Link
                href={current.href}
                target="_blank"
                rel="noopener noreferrer"
                variant="caption"
                sx={{
                  fontSize: '0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  width: thumbSize,
                  height: thumbSize,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '4px',
                  bgcolor: 'grey.50',
                  px: 0.5
                }}
              >
                Open
              </Link>
            ) : (
              <Box
                component="img"
                src={current.href}
                alt={`Attachment ${index + 1} of ${slides.length}`}
                sx={thumbSx}
                onClick={openViewer}
                onError={() => handleImgError(index)}
              />
            )}
          </Box>

          {hasMultiple && (
            <IconButton
              size="small"
              onClick={goNext}
              aria-label="Next attachment"
              sx={{ p: 0.25 }}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {hasMultiple && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
            {index + 1} / {slides.length}
          </Typography>
        )}
      </Box>

      <AttachmentCarouselDialog
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        slides={slides}
        initialIndex={index}
        title={previewTitle}
        onIndexChange={setIndex}
      />
    </>
  );
};

export default LineAttachmentsView;
