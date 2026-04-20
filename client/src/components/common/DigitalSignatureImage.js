import React from 'react';
import { Box, Typography } from '@mui/material';
import { getImageUrl } from '../../utils/imageService';

/**
 * Renders a user's uploaded profile digital signature image when `digitalSignature` path is set.
 * @param {string|{ digitalSignature?: string }} userOrPath — User object or raw `/uploads/...` path
 */
export function DigitalSignatureImage({ userOrPath, alt = 'Signature', sx = {} }) {
  const path = typeof userOrPath === 'string' ? userOrPath : userOrPath?.digitalSignature;
  if (!path || !String(path).trim()) return null;
  return (
    <Box
      component="img"
      src={getImageUrl(path)}
      alt={alt}
      sx={{
        maxHeight: 52,
        maxWidth: 160,
        objectFit: 'contain',
        objectPosition: 'left bottom',
        display: 'block',
        mx: 'auto',
        '@media print': { maxHeight: 44, maxWidth: 140 },
        ...sx
      }}
    />
  );
}

function personLabel(user) {
  if (!user) return '';
  const n = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return n || user.email || '';
}

/**
 * Purchase order print / view: show on-file signature images (and CEO typed fallback when no image).
 */
export function ProcurementDigitalSignaturesRow({ purchaseOrder }) {
  const po = purchaseOrder || {};
  const slots = [
    { label: 'Pre-Audit', user: po.auditApprovedBy, date: po.auditApprovedAt, typedFallback: null },
    {
      label: 'CEO',
      user: po.ceoApprovedBy,
      date: po.ceoApprovedAt,
      typedFallback: po.ceoDigitalSignature
    },
    { label: 'Finance', user: po.financeApprovedBy, date: po.financeApprovedAt, typedFallback: null },
    {
      label: 'Quality Assurance',
      user: po.qaStatus === 'Passed' ? po.qaCheckedBy : null,
      date: po.qaCheckedAt,
      typedFallback: null
    }
  ];

  const hasAny = slots.some(
    (s) =>
      (s.user && s.user.digitalSignature) ||
      (s.typedFallback && String(s.typedFallback).trim() && s.label === 'CEO')
  );
  if (!hasAny) return null;

  return (
    <Box
      sx={{
        mt: 2,
        pt: 2,
        borderTop: '1px dashed',
        borderColor: 'divider',
        '@media print': { mt: 1.5, pt: 1.5, pageBreakInside: 'avoid' }
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 1, fontWeight: 600 }}
      >
        Electronic signatures (on file)
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'flex-start' }}>
        {slots.map((s) => {
          const hasImg = s.user && s.user.digitalSignature;
          const typed =
            s.label === 'CEO' && !hasImg && s.typedFallback && String(s.typedFallback).trim()
              ? String(s.typedFallback).trim()
              : '';
          if (!hasImg && !typed) return null;
          return (
            <Box key={s.label} sx={{ textAlign: 'center', minWidth: 110, maxWidth: 180 }}>
              {hasImg ? <DigitalSignatureImage userOrPath={s.user} alt={s.label} /> : null}
              {typed ? (
                <Typography
                  variant="body2"
                  sx={{
                    fontStyle: 'italic',
                    minHeight: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: 0.5
                  }}
                >
                  {typed}
                </Typography>
              ) : null}
              <Typography variant="caption" display="block" sx={{ mt: 0.5, fontWeight: 600 }}>
                {s.label}
              </Typography>
              {s.user ? (
                <Typography variant="caption" color="text.secondary" display="block">
                  {personLabel(s.user)}
                </Typography>
              ) : null}
              {s.date ? (
                <Typography variant="caption" color="text.secondary" display="block">
                  {new Date(s.date).toLocaleDateString()}
                </Typography>
              ) : null}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
