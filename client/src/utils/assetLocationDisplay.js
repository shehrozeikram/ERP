/** HQ building name — must match TaggedAssets transfer dialog option. */
export const ASSET_TAGGING_HQ_BUILDING = 'Sardar Plaza Head Quarter';

/**
 * When saving HQ custody: persist room as "Room N" if the user typed only a number,
 * or normalize "room 5" → "Room 5". Other text (e.g. "Conference A") is left as-is.
 */
export function normalizeHqRoomSegment(room) {
  const s = String(room ?? '').trim();
  if (!s) return '';
  if (/^room\s+/i.test(s)) {
    const rest = s.replace(/^room\s+/i, '').trim();
    return rest ? `Room ${rest}` : '';
  }
  if (/^\d+$/.test(s)) return `Room ${s}`;
  return s;
}

/**
 * Display: legacy values like "HQ, Ground Floor, 1" render as "... , Room 1".
 * Only applies when the first segment is the HQ building and the last segment is digits-only.
 * Not exported: keeps a single implementation so bundlers cannot drop a "seemingly unused" export
 * while `formatAssetLocationLabeledRows` still needs this logic.
 */
function applyHqRoomDisplayNormalization(location, hqBuilding = ASSET_TAGGING_HQ_BUILDING) {
  const loc = String(location ?? '').trim();
  if (!loc) return '';
  const parts = loc.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3 || parts[0] !== hqBuilding) return loc;
  const last = parts[parts.length - 1];
  if (/^\d+$/.test(last)) {
    parts[parts.length - 1] = `Room ${last}`;
    return parts.join(', ');
  }
  return loc;
}

export function formatAssetLocationForDisplay(location, hqBuilding = ASSET_TAGGING_HQ_BUILDING) {
  return applyHqRoomDisplayNormalization(location, hqBuilding);
}

const STORE_SEGMENT_LABELS = ['Store', 'Sub-store', 'Rack', 'Shelf', 'Bin'];

/**
 * Split a custody location string into labeled rows for detail UI (e.g. transfer history).
 * HQ paths → Building, Floor, Room. Store paths (comma-separated, non-HQ) → Store … Bin.
 * Single freeform string (no commas) → one "Location" row.
 */
export function formatAssetLocationLabeledRows(location, hqBuilding = ASSET_TAGGING_HQ_BUILDING) {
  const loc = applyHqRoomDisplayNormalization(location, hqBuilding);
  const trimmed = String(loc ?? '').trim();
  if (!trimmed) return [];

  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return [];

  if (parts[0] === hqBuilding) {
    const rows = [{ label: 'Building', value: parts[0] }];
    if (parts[1]) rows.push({ label: 'Floor', value: parts[1] });
    if (parts[2]) rows.push({ label: 'Room', value: parts[2] });
    for (let i = 3; i < parts.length; i += 1) {
      rows.push({ label: 'Detail', value: parts[i] });
    }
    return rows;
  }

  if (parts.length === 1) {
    return [{ label: 'Location', value: parts[0] }];
  }

  return parts.map((value, idx) => ({
    label: STORE_SEGMENT_LABELS[idx] || `Part ${idx + 1}`,
    value
  }));
}
