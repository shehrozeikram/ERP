import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Alert,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  MenuItem,
  Autocomplete,
  CircularProgress,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Send as SendIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import generalCashApprovalService from '../../../services/generalCashApprovalService';
import {
  approverSearchOnInputChange,
  mergeApproverOptionList,
  optionsForManagerApprover,
  optionsForHodApprover
} from '../../../utils/dualApproverAutocomplete';
import { resolveUploadPublicUrl } from '../../../components/CashApprovals/cashApprovalGeneralDocumentUtils';
import LineAttachmentCell from '../../../components/common/LineAttachmentCell';
import {
  appendCashApprovalLineAttachmentsToFormData,
  emptyGeneralCashApprovalLine,
  serializeCashApprovalItemsForSubmit
} from '../../../utils/cashApprovalFormAttachments';

const userDisplayName = (u) => {
  if (!u) return '';
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || '';
};

const employeeAdvanceLabel = (emp) => {
  if (!emp) return '';
  const name = [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim() || emp.employeeId || '';
  const code = emp.employeeId ? ` (${emp.employeeId})` : '';
  if (emp.advanceAccount?.accountNumber) {
    return `${name}${code} — ${emp.advanceAccount.accountNumber} ${emp.advanceAccount.name || ''}`.trim();
  }
  if (emp.willCreateAdvanceAccount) {
    return `${name}${code} — Advances to employees (1120-… on save)`;
  }
  return `${name}${code}`;
};

const getUserId = (u) => {
  if (!u) return '';
  if (typeof u === 'string') return u;
  return String(u._id || u.id || '');
};

const emptyLine = emptyGeneralCashApprovalLine;

const recalcLine = (line) => {
  const qty = Number(line.quantity) || 0;
  const rate = Number(line.unitPrice) || 0;
  const amount = Math.round(qty * rate * 100) / 100;
  return { ...line, amount };
};

const GeneralCashApprovalForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [lines, setLines] = useState([emptyLine()]);
  const [header, setHeader] = useState({
    purpose: '',
    notes: '',
    requestingDepartment: user?.department || '',
    priority: 'Urgent',
    approvalDate: new Date().toISOString().split('T')[0],
    expectedPurchaseDate: ''
  });
  const [advanceEmployee, setAdvanceEmployee] = useState(null);
  const [advanceEmployeeOptions, setAdvanceEmployeeOptions] = useState([]);
  const [advanceEmployeeLoading, setAdvanceEmployeeLoading] = useState(false);
  const [managerApprover, setManagerApprover] = useState(null);
  const [hodApprover, setHodApprover] = useState(null);
  const [approverOptions, setApproverOptions] = useState([]);
  const [approverLoading, setApproverLoading] = useState(false);
  const [loadedDeptApproval, setLoadedDeptApproval] = useState('Draft');

  const linesTotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0),
    [lines]
  );

  const advanceEmployeeOptionsMerged = useMemo(() => {
    const map = new Map();
    (advanceEmployeeOptions || []).forEach((o) => {
      if (o?._id) map.set(String(o._id), o);
    });
    if (advanceEmployee?._id) {
      map.set(String(advanceEmployee._id), advanceEmployee);
    }
    return [...map.values()];
  }, [advanceEmployeeOptions, advanceEmployee]);

  const loadApproverOptions = async (search = '') => {
    try {
      setApproverLoading(true);
      const res = await generalCashApprovalService.getApproverCandidates({ search, limit: 500, allUsers: true });
      setApproverOptions(res.data || []);
    } catch {
      setApproverOptions([]);
    } finally {
      setApproverLoading(false);
    }
  };

  const loadAdvanceEmployees = async (search = '') => {
    try {
      setAdvanceEmployeeLoading(true);
      const res = await generalCashApprovalService.getAdvanceEmployees({ search, limit: 500 });
      const rows = Array.isArray(res?.data) ? res.data : [];
      setAdvanceEmployeeOptions(rows);
      if (!rows.length && !search) {
        setError((prev) => prev || 'No active employees found. Ensure HR has employees with employment status Active.');
      }
    } catch (err) {
      setAdvanceEmployeeOptions([]);
      const msg = err.response?.data?.message || 'Could not load employees for Advance to';
      toast.error(msg);
    } finally {
      setAdvanceEmployeeLoading(false);
    }
  };

  const loadDepartments = async () => {
    setDepartmentsLoading(true);
    try {
      const res = await generalCashApprovalService.getDepartments();
      const list = Array.isArray(res?.data) ? res.data : [];
      setDepartmentOptions(list);
    } catch (err) {
      setDepartmentOptions([]);
      const msg = err.response?.data?.message || 'Could not load departments';
      toast.error(msg);
    } finally {
      setDepartmentsLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
    loadApproverOptions('');
    loadAdvanceEmployees('');
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await generalCashApprovalService.getById(id);
        const ca = res.data;
        if (ca.originatingModule !== 'general') {
          setError('Not a General module cash approval');
          return;
        }
        if (!['Draft', 'Pending Approval', 'Returned from Audit'].includes(ca.status)) {
          setError('This cash approval can no longer be edited');
          return;
        }
        setHeader({
          purpose: ca.purpose || '',
          notes: ca.notes || '',
          requestingDepartment: ca.requestingDepartment || '',
          priority: ca.priority || 'Urgent',
          approvalDate: ca.approvalDate ? new Date(ca.approvalDate).toISOString().split('T')[0] : '',
          expectedPurchaseDate: ca.expectedPurchaseDate
            ? new Date(ca.expectedPurchaseDate).toISOString().split('T')[0]
            : ''
        });
        setLoadedDeptApproval(ca.departmentApprovalStatus || 'Draft');
        if (ca.advanceToEmployee) {
          const emp = typeof ca.advanceToEmployee === 'object' ? ca.advanceToEmployee : null;
          const acct = typeof ca.advanceGlAccount === 'object' ? ca.advanceGlAccount : null;
          if (emp) {
            const selected = {
              _id: emp._id,
              employeeId: emp.employeeId,
              firstName: emp.firstName,
              lastName: emp.lastName,
              hasUser: true,
              hasAdvanceAccount: Boolean(acct || ca.advanceGlAccountNumber),
              advanceAccount: acct
                ? {
                  _id: acct._id,
                  accountNumber: acct.accountNumber || ca.advanceGlAccountNumber,
                  name: acct.name
                }
                : ca.advanceGlAccountNumber
                  ? { accountNumber: ca.advanceGlAccountNumber, name: 'Advances to employees' }
                  : null
            };
            setAdvanceEmployee(selected);
            setAdvanceEmployeeOptions((prev) => {
              const map = new Map(prev.map((o) => [String(o._id), o]));
              map.set(String(selected._id), selected);
              return [...map.values()];
            });
          }
        }
        const mapped = (ca.items || []).map((li) => recalcLine({
          itemName: li.itemName || li.description || '',
          description: li.specification || li.description || '',
          location: li.location || '',
          unit: li.unit || 'pcs',
          quantity: li.quantity ?? 1,
          unitPrice: li.unitPrice ?? 0,
          amount: li.amount ?? 0,
          attachments: li.attachments || [],
          _pendingFiles: []
        }));
        setLines(mapped.length ? mapped : [emptyLine()]);
        const chain = ca.departmentApprovalChain || [];
        const draftIds = ca.draftApproverIds || [];
        const mgrId = chain[0]?.approver?._id || chain[0]?.approver || draftIds[0]?._id || draftIds[0];
        const hodId = chain[1]?.approver?._id || chain[1]?.approver || draftIds[1]?._id || draftIds[1];
        if (mgrId) {
          const found = chain[0]?.approver && typeof chain[0].approver === 'object'
            ? chain[0].approver
            : approverOptions.find((o) => String(o._id) === String(mgrId));
          if (found) setManagerApprover(found);
        }
        if (hodId) {
          const found = chain[1]?.approver && typeof chain[1].approver === 'object'
            ? chain[1].approver
            : approverOptions.find((o) => String(o._id) === String(hodId));
          if (found) setHodApprover(found);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  const updateLine = (idx, fieldOrPatch, value) => {
    setLines((prev) => {
      const next = [...prev];
      const patch =
        typeof fieldOrPatch === 'object' && fieldOrPatch !== null && value === undefined
          ? fieldOrPatch
          : { [fieldOrPatch]: value };
      next[idx] = recalcLine({ ...next[idx], ...patch });
      return next;
    });
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx) => setLines((prev) => (prev.length <= 1 ? [emptyLine()] : prev.filter((_, i) => i !== idx)));

  const buildFormData = (mode) => {
    const fd = new FormData();
    fd.append('generalModule', 'true');
    fd.append('originatingModule', 'general');
    fd.append('purpose', header.purpose.trim());
    fd.append('notes', header.notes || '');
    fd.append('requestingDepartment', header.requestingDepartment || user?.department || '');
    fd.append('priority', header.priority);
    fd.append('approvalDate', header.approvalDate);
    if (header.expectedPurchaseDate) fd.append('expectedPurchaseDate', header.expectedPurchaseDate);
    if (advanceEmployee?._id) {
      fd.append('advanceToEmployee', advanceEmployee._id);
      if (advanceEmployee.advanceAccount?._id) {
        fd.append('advanceGlAccount', advanceEmployee.advanceAccount._id);
        fd.append('advanceGlAccountNumber', advanceEmployee.advanceAccount.accountNumber || '');
      }
    }
    if (mode === 'submit') fd.append('submit', 'true');

    fd.append('items', JSON.stringify(serializeCashApprovalItemsForSubmit(lines)));
    appendCashApprovalLineAttachmentsToFormData(fd, lines);

    const approverIds = [getUserId(managerApprover), getUserId(hodApprover)].filter(Boolean);
    fd.append('draftApproverIds', JSON.stringify(approverIds));
    if (mode === 'submit') fd.append('approverIds', JSON.stringify(approverIds));

    return fd;
  };

  const validate = (mode) => {
    if (!header.requestingDepartment?.trim()) return 'Department is required';
    if (!advanceEmployee?._id) return 'Advance to (employee) is required';
    if (!header.purpose.trim()) return 'Purpose / narration is required';
    if (!lines.some((l) => (l.itemName || l.description) && Number(l.amount) > 0)) {
      return 'Add at least one line item with name and amount';
    }
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      if (!(l.itemName?.trim() || l.description?.trim())) {
        return `Line ${i + 1}: item name or description is required`;
      }
      if (!(Number(l.quantity) > 0)) return `Line ${i + 1}: quantity must be greater than zero`;
      if (!(Number(l.amount) > 0)) return `Line ${i + 1}: total amount must be greater than zero`;
    }
    if (mode === 'submit') {
      if (!managerApprover?._id || !hodApprover?._id) {
        return 'Select Manager Approver and Head Of Department Approver before submitting';
      }
      const rid = getUserId(user);
      if ([getUserId(managerApprover), getUserId(hodApprover)].includes(rid)) {
        return 'Requester cannot be selected as Manager or HOD approver';
      }
      if (getUserId(managerApprover) === getUserId(hodApprover)) {
        return 'Manager and HOD approvers must be different';
      }
    }
    return '';
  };

  const handleSave = async (mode) => {
    const validationError = validate(mode);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const fd = buildFormData(mode);
      let requestId = id;
      if (isEdit) {
        await generalCashApprovalService.update(id, fd);
      } else {
        const created = await generalCashApprovalService.create(fd);
        requestId = created.data?._id;
      }
      if (mode === 'submit' && isEdit && loadedDeptApproval === 'Draft') {
        await generalCashApprovalService.submit(requestId, {
          approverIds: [getUserId(managerApprover), getUserId(hodApprover)]
        });
      }
      navigate(`/general/cash-approvals/${requestId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const optionsMerged = mergeApproverOptionList(approverOptions, managerApprover, hodApprover);
  const managerOptions = optionsForManagerApprover({
    optionsMerged,
    requesterId: user,
    hodApprover
  });
  const hodOptions = optionsForHodApprover({
    optionsMerged,
    requesterId: user,
    managerApprover
  });

  const showApprovals =
    !isEdit || loadedDeptApproval === 'Draft' || loadedDeptApproval === 'Rejected';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>
        {isEdit ? 'Edit cash approval' : 'New cash approval'}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Department</InputLabel>
              <Select
                label="Department"
                value={header.requestingDepartment || ''}
                onChange={(e) => setHeader({ ...header, requestingDepartment: e.target.value })}
                disabled={departmentsLoading}
              >
                <MenuItem value="">
                  <em>{departmentsLoading ? 'Loading departments...' : 'Select department'}</em>
                </MenuItem>
                {departmentOptions.map((d) => (
                  <MenuItem key={d._id || d.name} value={d.name}>
                    {d.name}
                  </MenuItem>
                ))}
              </Select>
              {!departmentsLoading && departmentOptions.length === 0 && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  No departments available. Contact HR to add active departments.
                </Typography>
              )}
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              select
              label="Priority"
              value={header.priority}
              onChange={(e) => setHeader({ ...header, priority: e.target.value })}
            >
              {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Approval date"
              value={header.approvalDate}
              onChange={(e) => setHeader({ ...header, approvalDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              multiline
              minRows={2}
              label="Purpose / narration"
              value={header.purpose}
              onChange={(e) => setHeader({ ...header, purpose: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Autocomplete
              options={advanceEmployeeOptionsMerged}
              value={advanceEmployee}
              loading={advanceEmployeeLoading}
              openOnFocus
              onChange={(_, v) => setAdvanceEmployee(v)}
              onOpen={() => loadAdvanceEmployees('')}
              onInputChange={approverSearchOnInputChange(loadAdvanceEmployees)}
              getOptionLabel={employeeAdvanceLabel}
              isOptionEqualToValue={(a, b) => String(a?._id) === String(b?._id)}
              filterOptions={(opts) => opts}
              noOptionsText={
                advanceEmployeeLoading
                  ? 'Loading employees…'
                  : 'No employees found — type a name or employee ID to search'
              }
              renderOption={(props, option) => (
                <li {...props} key={option._id}>
                  {employeeAdvanceLabel(option)}
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Advance to (employee)"
                  required
                  placeholder="Type name or employee ID to search…"
                  helperText="Select employee. Advances to employees GL (1120-…) is linked or created automatically on save."
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={2}
              label="Notes (optional)"
              value={header.notes}
              onChange={(e) => setHeader({ ...header, notes: e.target.value })}
            />
          </Grid>
        </Grid>

        <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Line items</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add items with name, description, location, unit, quantity, rate, and attachments (compressed images/PDF, up to 50 per line).
        </Typography>

        <Table size="small" sx={{ mb: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell>Item name</TableCell>
              <TableCell>Description / narration</TableCell>
              <TableCell>Location</TableCell>
              <TableCell width={90}>Unit</TableCell>
              <TableCell width={80}>Qty</TableCell>
              <TableCell width={100}>Rate</TableCell>
              <TableCell width={110} align="right">Total</TableCell>
              <TableCell width={160}>Attachments</TableCell>
              <TableCell width={48} />
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((line, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <TextField size="small" fullWidth value={line.itemName} onChange={(e) => updateLine(idx, 'itemName', e.target.value)} />
                </TableCell>
                <TableCell>
                  <TextField size="small" fullWidth value={line.description} onChange={(e) => updateLine(idx, 'description', e.target.value)} />
                </TableCell>
                <TableCell>
                  <TextField size="small" fullWidth value={line.location} onChange={(e) => updateLine(idx, 'location', e.target.value)} />
                </TableCell>
                <TableCell>
                  <TextField size="small" fullWidth value={line.unit} onChange={(e) => updateLine(idx, 'unit', e.target.value)} />
                </TableCell>
                <TableCell>
                  <TextField size="small" type="number" fullWidth value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} inputProps={{ min: 0, step: 'any' }} />
                </TableCell>
                <TableCell>
                  <TextField size="small" type="number" fullWidth value={line.unitPrice} onChange={(e) => updateLine(idx, 'unitPrice', e.target.value)} inputProps={{ min: 0, step: 'any' }} />
                </TableCell>
                <TableCell align="right">{Number(line.amount || 0).toFixed(2)}</TableCell>
                <TableCell>
                  <LineAttachmentCell
                    line={line}
                    onLineChange={(patch) => updateLine(idx, patch)}
                    resolveUrl={resolveUploadPublicUrl}
                  />
                </TableCell>
                <TableCell>
                  <IconButton size="small" color="error" onClick={() => removeLine(idx)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Button startIcon={<AddIcon />} onClick={addLine} sx={{ mb: 2 }}>Add item</Button>
        <Typography variant="subtitle1" align="right" fontWeight={600} sx={{ mb: 3 }}>
          Grand total: PKR {linesTotal.toFixed(2)}
        </Typography>

        {showApprovals && (
          <>
            <Typography variant="h6" gutterBottom>Approvals</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose Manager and Head Of Department approvers before submitting.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Sig. of requester" value={userDisplayName(user)} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={managerOptions}
                  value={managerApprover}
                  loading={approverLoading}
                  onChange={(_, v) => setManagerApprover(v)}
                  onOpen={() => loadApproverOptions('')}
                  onInputChange={approverSearchOnInputChange(loadApproverOptions)}
                  getOptionLabel={userDisplayName}
                  isOptionEqualToValue={(a, b) => a._id === b._id}
                  renderInput={(params) => <TextField {...params} size="small" label="Manager approver" />}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={hodOptions}
                  value={hodApprover}
                  loading={approverLoading}
                  onChange={(_, v) => setHodApprover(v)}
                  onOpen={() => loadApproverOptions('')}
                  onInputChange={approverSearchOnInputChange(loadApproverOptions)}
                  getOptionLabel={userDisplayName}
                  isOptionEqualToValue={(a, b) => a._id === b._id}
                  renderInput={(params) => <TextField {...params} size="small" label="Head of department approver" />}
                />
              </Grid>
            </Grid>
          </>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
          <Button startIcon={<CancelIcon />} onClick={() => navigate('/general/cash-approvals')}>Cancel</Button>
          <Button variant="outlined" startIcon={<SaveIcon />} disabled={saving} onClick={() => handleSave('draft')}>
            Save draft
          </Button>
          <Button variant="contained" startIcon={<SendIcon />} disabled={saving} onClick={() => handleSave('submit')}>
            Submit for approval
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default GeneralCashApprovalForm;
