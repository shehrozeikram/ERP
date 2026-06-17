import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { AttachFile as AttachFileIcon, PictureAsPdf as PdfIcon } from '@mui/icons-material';
import {
  getFirstAttachment,
  getFirstImageAttachment,
  getAttachmentHref,
  isPdfAttachment
} from '../../utils/fixedAssetAttachments';

export default function AssetAttachmentThumb({ asset, size = 48 }) {
  const imageAtt = getFirstImageAttachment(asset);
  const imageHref = imageAtt ? getAttachmentHref(imageAtt) : null;

  if (imageHref) {
    const label = imageAtt.originalName || imageAtt.filename || 'Asset image';
    return (
      <Tooltip title={label}>
        <Box
          component="a"
          href={imageHref}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: 'inline-block', lineHeight: 0 }}
        >
          <Box
            component="img"
            src={imageHref}
            alt={label}
            sx={{
              width: size,
              height: size,
              objectFit: 'cover',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'grey.100'
            }}
          />
        </Box>
      </Tooltip>
    );
  }

  const fileAtt = getFirstAttachment(asset);
  if (!fileAtt) {
    return <Typography variant="caption" color="text.disabled">—</Typography>;
  }

  const fileHref = getAttachmentHref(fileAtt);
  const label = fileAtt.originalName || fileAtt.filename || 'Attachment';
  const Icon = isPdfAttachment(fileAtt) ? PdfIcon : AttachFileIcon;

  return (
    <Tooltip title={label}>
      <Box
        component="a"
        href={fileHref || undefined}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          width: size,
          height: size,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'grey.50',
          color: 'text.secondary',
          textDecoration: 'none'
        }}
      >
        <Icon fontSize="small" />
      </Box>
    </Tooltip>
  );
}
