const mongoose = require('mongoose');

function normalizeLookupString(val) {
  if (val == null || val === '') return '';
  if (typeof val === 'string') return val.trim();
  return String(val).trim();
}

/**
 * When strict schema hid legacy keys, or imports used different field names,
 * merge serial / custodian from the raw collection document.
 */
async function applyRawFixedAssetLookupFallback(FixedAsset, leanAsset) {
  if (!leanAsset?._id) return leanAsset;
  const id =
    leanAsset._id instanceof mongoose.Types.ObjectId
      ? leanAsset._id
      : new mongoose.Types.ObjectId(leanAsset._id);

  const serialEmpty =
    leanAsset.serialNumber == null || String(leanAsset.serialNumber).trim() === '';
  const assignEmpty =
    leanAsset.assignedTo == null || String(leanAsset.assignedTo).trim() === '';
  if (!serialEmpty && !assignEmpty) return leanAsset;

  const raw = await FixedAsset.collection.findOne({ _id: id });
  if (!raw) return leanAsset;

  if (serialEmpty) {
    for (const key of ['serialNumber', 'SerialNumber', 'serial_no', 'sn']) {
      const v = raw[key];
      if (v != null && String(v).trim() !== '') {
        leanAsset.serialNumber = String(v).trim();
        break;
      }
    }
  }
  if (assignEmpty) {
    for (const key of ['assignedTo', 'AssignedTo', 'custodian']) {
      const v = raw[key];
      if (v != null && String(v).trim() !== '') {
        leanAsset.assignedTo = String(v).trim();
        break;
      }
    }
  }
  return leanAsset;
}

module.exports = { normalizeLookupString, applyRawFixedAssetLookupFallback };
