/**
 * Helpers for Manager + HOD approver Autocompletes (Utility Bills, Rental, Payment Settlement).
 * MUI fires onInputChange with reason "reset" after picking an option; refetching then shrinks the shared list.
 */

export function approverSearchOnInputChange(loadOptions) {
  return (_event, newInputValue, reason) => {
    if (reason === 'input') {
      loadOptions(newInputValue);
    }
  };
}

const idStr = (u) => {
  if (u == null || u === '') return '';
  if (typeof u === 'string') return u;
  return String(u._id || u.id || u.userId || '');
};

/** Union API list with current selections so values stay in options[]. */
export function mergeApproverOptionList(apiList, ...selected) {
  const map = new Map();
  (apiList || []).forEach((o) => {
    if (o && o._id) map.set(String(o._id), o);
  });
  (selected || []).flat().forEach((o) => {
    if (o && o._id) map.set(String(o._id), o);
  });
  return [...map.values()];
}

export function optionsForManagerApprover({ optionsMerged, requesterId, hodApprover }) {
  const rid = idStr(requesterId);
  const hid = idStr(hodApprover);
  return optionsMerged.filter((o) => {
    const oid = idStr(o);
    if (rid && oid === rid) return false;
    if (hid && oid === hid) return false;
    return true;
  });
}

export function optionsForHodApprover({ optionsMerged, requesterId, managerApprover }) {
  const rid = idStr(requesterId);
  const mid = idStr(managerApprover);
  return optionsMerged.filter((o) => {
    const oid = idStr(o);
    if (rid && oid === rid) return false;
    if (mid && oid === mid) return false;
    return true;
  });
}
