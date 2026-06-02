/** Build multipart fields for cash approval line attachments */

export function serializeCashApprovalItemsForSubmit(items) {
  return (items || []).map((item) => {
    const { _pendingFiles, _pendingFile, ...rest } = item;
    return {
      ...rest,
      attachments: (rest.attachments || []).filter((a) => a && (a.url || typeof a === 'string'))
    };
  });
}

export function appendCashApprovalLineAttachmentsToFormData(fd, items) {
  (items || []).forEach((line, idx) => {
    const pending = line._pendingFiles || (line._pendingFile ? [line._pendingFile] : []);
    pending.forEach((file, fileIdx) => {
      if (file instanceof File) {
        fd.append(`lineAttachment_${idx}_${fileIdx}`, file);
      }
    });
    const urls = (line.attachments || [])
      .map((a) => (typeof a === 'string' ? a : a?.url))
      .filter(Boolean);
    fd.append(`existingLineAttachments_${idx}`, JSON.stringify(urls));
  });
}

export const emptyCashApprovalLine = () => ({
  description: '',
  specification: '',
  brand: '',
  quantity: 1,
  unit: 'pcs',
  unitPrice: 0,
  taxRate: 0,
  discount: 0,
  amount: 0,
  attachments: [],
  _pendingFiles: []
});

export const emptyGeneralCashApprovalLine = () => ({
  itemName: '',
  description: '',
  location: '',
  unit: 'pcs',
  quantity: 1,
  unitPrice: 0,
  amount: 0,
  attachments: [],
  _pendingFiles: []
});
