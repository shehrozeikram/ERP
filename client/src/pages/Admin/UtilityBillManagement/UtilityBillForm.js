import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Autocomplete,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Skeleton,
  Avatar,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import api from '../../../services/api';
import centralizedStoreService from '../../../services/centralizedStoreService';
import {
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import utilityBillService from '../../../services/utilityBillService';
import { getImageUrl, handleImageError } from '../../../utils/imageService';
import { useAuth } from '../../../contexts/AuthContext';
import {
  approverSearchOnInputChange,
  mergeApproverOptionList,
  optionsForManagerApprover,
  optionsForHodApprover
} from '../../../utils/dualApproverAutocomplete';
import {
  isWorkflowAuditBlockingEditStatus,
  WorkflowAuditFeedbackPanel
} from '../../../components/Admin/workflowAuditReturn';
import { formatDateTime } from '../../../utils/dateUtils';
import { compressImages } from '../../../utils/compressImage';
import { getStoreItemId } from '../../../utils/utilityBillAttachments';

const userDisplayName = (user) => {
  if (!user) return '';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.fullName || user.email || user.employeeId || '';
};
const getUserId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id || value.id || value.userId || '');
};

/** Server-required header fields when UI only collects vendor + line items */
const applyCentralizedStoreBillDefaults = (payload, lines, total) => {
  const today = new Date();
  const todayYmd = today.toISOString().split('T')[0];
  payload.billDate = todayYmd;

  const lineDueTimes = lines
    .map((l) => (l.dueDate ? new Date(l.dueDate) : null))
    .filter((d) => d && !Number.isNaN(d.getTime()));
  if (lineDueTimes.length > 0) {
    const maxT = Math.max(...lineDueTimes.map((d) => d.getTime()));
    payload.dueDate = new Date(maxT).toISOString().split('T')[0];
  } else {
    const due = new Date(today);
    due.setDate(due.getDate() + 30);
    payload.dueDate = due.toISOString().split('T')[0];
  }

  payload.amount = total;
  payload.lastMonthAmount = 0;
  payload.grandTotal = total;
  payload.balanceAmount = total;
  payload.forWhat =
    lines
      .map((l) => [l.categoryName, l.itemLabel, l.description].filter(Boolean).join(' — '))
      .join('; ')
      .slice(0, 1000) || 'Centralized store bill';
  const first = lines[0] || {};
  payload.site = first.site || 'Head Office';
  payload.location = first.location || 'Main Office';
  payload.accountNumber = first.meterNumber ? String(first.meterNumber) : '';
  payload.department = '';
  payload.custodian = '';
  return payload;
};

const MAX_LINE_ATTACHMENTS = 50; // max images per line item

/**
 * Mini gallery inside the Attachment column of each bill line.
 * Shows saved thumbnails + pending file previews; an "Add" button picks more images/PDFs.
 */
const LineAttachmentCell = ({ line, idx, updateBillLine, resolveUrl, readOnly }) => {
  const inputRef = React.useRef(null);
  const [cellCompressing, setCellCompressing] = React.useState(false);
  const savedUrls = line.attachmentUrls && line.attachmentUrls.length
    ? line.attachmentUrls
    : (line.attachmentUrl ? [line.attachmentUrl] : []);
  const pending = line._pendingFiles || [];
  const total = savedUrls.length + pending.length;
  const remaining = MAX_LINE_ATTACHMENTS - total;

  const addFiles = async (files) => {
    if (!files || !files.length || readOnly) return;
    const allowed = Array.from(files).slice(0, Math.max(0, remaining));
    setCellCompressing(true);
    try {
      const compressed = await compressImages(allowed);
      updateBillLine(idx, '_pendingFiles', [...pending, ...compressed]);
    } finally {
      setCellCompressing(false);
    }
  };

  const removeSaved = (urlIdx) => {
    const next = savedUrls.filter((_, i) => i !== urlIdx);
    updateBillLine(idx, 'attachmentUrls', next);
    updateBillLine(idx, 'attachmentUrl', next[0] || '');
  };

  const removePending = (fileIdx) => {
    updateBillLine(idx, '_pendingFiles', pending.filter((_, i) => i !== fileIdx));
  };

  const thumbSx = {
    width: 40, height: 40, objectFit: 'cover',
    borderRadius: '4px', border: '1px solid', borderColor: 'divider', display: 'block'
  };

  return (
    <Stack spacing={0.5}>
      {/* Saved thumbnails */}
      {savedUrls.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={0.5}>
          {savedUrls.map((url, i) => (
            <Box key={i} sx={{ position: 'relative', display: 'inline-flex' }}>
              <Box
                component="img"
                src={resolveUrl(url)}
                alt={`attachment-${i + 1}`}
                sx={thumbSx}
                onClick={() => window.open(resolveUrl(url), '_blank')}
                style={{ cursor: 'pointer' }}
              />
              {!readOnly && (
                <Box
                  onClick={() => removeSaved(i)}
                  sx={{
                    position: 'absolute', top: -4, right: -4,
                    width: 14, height: 14, borderRadius: '50%',
                    bgcolor: 'error.main', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, cursor: 'pointer', lineHeight: 1
                  }}
                >×</Box>
              )}
            </Box>
          ))}
        </Stack>
      )}
      {/* Pending new files */}
      {pending.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={0.5}>
          {pending.map((file, i) => {
            const isImg = file.type?.startsWith('image/');
            const src = isImg ? URL.createObjectURL(file) : null;
            return (
              <Box key={i} sx={{ position: 'relative', display: 'inline-flex' }}>
                {isImg
                  ? <Box component="img" src={src} alt={file.name} sx={{ ...thumbSx, borderColor: 'primary.light' }} onLoad={() => src && URL.revokeObjectURL(src)} />
                  : <Box sx={{ ...thumbSx, bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'text.secondary' }}>PDF</Box>
                }
                <Box
                  onClick={() => removePending(i)}
                  sx={{
                    position: 'absolute', top: -4, right: -4,
                    width: 14, height: 14, borderRadius: '50%',
                    bgcolor: 'warning.main', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, cursor: 'pointer', lineHeight: 1
                  }}
                >×</Box>
              </Box>
            );
          })}
        </Stack>
      )}
      {/* Add button */}
      {!readOnly && remaining > 0 && (
        <>
          <input
            ref={inputRef}
            type="file"
            hidden
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
          <Button
            variant="text"
            size="small"
            disabled={cellCompressing}
            sx={{ alignSelf: 'flex-start', p: 0, minWidth: 0, fontSize: '0.75rem' }}
            onClick={() => inputRef.current?.click()}
          >
            {cellCompressing ? 'Compressing…' : (total === 0 ? '+ Attach' : `+ Add (${remaining} left)`)}
          </Button>
        </>
      )}
      {!readOnly && remaining === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
          Max {MAX_LINE_ATTACHMENTS} reached
        </Typography>
      )}
    </Stack>
  );
};

/** Default due date for new store bill line (YYYY-MM-DD) */
const defaultLineDueYmd = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
};

/** Open uploaded bill line file (served under /uploads on API host) */
const resolveUploadPublicUrl = (relativePath) => {
  if (!relativePath) return '';
  if (relativePath.startsWith('http')) return relativePath;
  const apiBase = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:5001/api`;
  const origin = apiBase.replace(/\/api\/?$/, '');
  return `${origin}${relativePath.startsWith('/') ? relativePath : `/${relativePath}`}`;
};

const ADD_NEW_VENDOR_OPTION = {
  _id: '__ADD_NEW_VENDOR__',
  name: '+ Add new vendor…',
  isAddNew: true
};

const emptyQuickVendorForm = () => ({
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  paymentTerms: 'Cash'
});

const UtilityBillForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isCentralizedStoreBill = location.pathname.startsWith('/admin/centralized-store/bill');
  const isEdit = Boolean(id);
  const backPath = isCentralizedStoreBill ? '/admin/centralized-store/bills' : '/admin/utility-bills';
  const defaultType = searchParams.get('type') || 'Electricity';
  const accountHeadOptions = ['President Personal', 'SGCHQ', 'Boly.pk', 'Usman Solar'];

  const [formData, setFormData] = useState({
    accountHead: '',
    site: 'Head Office',
    utilityType: defaultType,
    provider: '',
    payeeName: '',
    accountNumber: '',
    billDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    amount: 0,
    lastMonthAmount: 0,
    forWhat: '',
    notes: '',
    location: 'Main Office',
    department: '',
    custodian: 'Lt.Col.Safeer Ahmed'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [masterDataLoading, setMasterDataLoading] = useState(false);
  const [managerApprover, setManagerApprover] = useState(null);
  const [hodApprover, setHodApprover] = useState(null);
  const [approverOptions, setApproverOptions] = useState([]);
  const [approverLoading, setApproverLoading] = useState(false);
  const [workflowLocksEdit, setWorkflowLocksEdit] = useState(false);
  const [auditReturnedNotice, setAuditReturnedNotice] = useState(false);
  /** Full bill from API in edit mode — used to show audit observation thread (incl. admin replies). */
  const [loadedBillForAudit, setLoadedBillForAudit] = useState(null);
  /** Loaded bill approval state (edit mode only); null before fetch or on create */
  const [loadedApprovalStatus, setLoadedApprovalStatus] = useState(null);
  const [useStoreBill, setUseStoreBill] = useState(isCentralizedStoreBill);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [payeeType, setPayeeType] = useState('vendor');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [financeEmployees, setFinanceEmployees] = useState([]);
  const [storeCategories, setStoreCategories] = useState([]);
  const [storeItems, setStoreItems] = useState([]);
  const [selectedBillCategory, setSelectedBillCategory] = useState(null);
  const [pendingStoreItem, setPendingStoreItem] = useState(null);
  const [billLines, setBillLines] = useState([]);
  const [companiesList, setCompaniesList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorSaving, setVendorSaving] = useState(false);
  const [quickVendorForm, setQuickVendorForm] = useState(emptyQuickVendorForm);

  const requesterId = getUserId(user);
  const mergedApproverOptions = useMemo(
    () => mergeApproverOptionList(approverOptions, managerApprover, hodApprover),
    [approverOptions, managerApprover, hodApprover]
  );
  const managerApproverSelectOptions = useMemo(
    () => optionsForManagerApprover({ optionsMerged: mergedApproverOptions, requesterId, hodApprover }),
    [mergedApproverOptions, requesterId, hodApprover]
  );
  const hodApproverSelectOptions = useMemo(
    () => optionsForHodApprover({ optionsMerged: mergedApproverOptions, requesterId, managerApprover }),
    [mergedApproverOptions, requesterId, managerApprover]
  );

  useEffect(() => {
    fetchMasterData();
    if (isEdit) {
      fetchBill();
    } else {
      setWorkflowLocksEdit(false);
      setAuditReturnedNotice(false);
      setLoadedApprovalStatus(null);
    }
  }, [id, isEdit]);

  useEffect(() => {
    if (isCentralizedStoreBill) {
      setUseStoreBill(true);
    }
  }, [isCentralizedStoreBill]);

  useEffect(() => {
    if (!billLines.length || selectedBillCategory || !storeCategories.length) return;
    const firstLine = billLines[0];
    const firstCatName = firstLine.categoryName;
    if (firstCatName) {
      const cat = storeCategories.find((c) => c.name === firstCatName);
      if (cat) {
        setSelectedBillCategory(cat);
        return;
      }
    }
    if (firstLine.storeItem && storeItems.length) {
      const item = storeItems.find((i) => String(i._id) === String(firstLine.storeItem));
      const catId = item?.category?._id || item?.category;
      if (catId) {
        const cat = storeCategories.find((c) => String(c._id) === String(catId));
        if (cat) setSelectedBillCategory(cat);
      }
    }
  }, [billLines, storeCategories, storeItems, selectedBillCategory]);

  const fetchMasterData = async () => {
    try {
      setMasterDataLoading(true);
      const [res, catalogRes, vendorsRes, companiesRes, projectsRes] = await Promise.all([
        utilityBillService.getFormMasterData(),
        centralizedStoreService.getCatalog().catch(() => ({ data: {} })),
        api.get('/procurement/vendors', { params: { limit: 500, status: 'Active' } }).catch(() => ({ data: { data: { vendors: [] } } })),
        api.get('/hr/companies', { params: { status: 'active' } }).catch(() => ({ data: { data: [] } })),
        api.get('/hr/projects', { params: { status: 'Active' } }).catch(() => ({ data: { data: [] } }))
      ]);
      const payload = res?.data || {};
      setDepartments(payload.departments || []);
      setEmployees(payload.employees || []);
      setStoreCategories(catalogRes?.data?.categories || []);
      setStoreItems(catalogRes?.data?.items || []);
      setVendors(vendorsRes?.data?.data?.vendors || vendorsRes?.data?.vendors || []);
      setCompaniesList(companiesRes?.data?.data || []);
      setProjectsList(projectsRes?.data?.data || []);
      if (isCentralizedStoreBill) {
        setFinanceEmployees(payload.financePayeeEmployees || []);
      }
    } catch (err) {
      console.error('Error fetching utility bill master data:', err);
      setError(err.response?.data?.message || 'Failed to load department and custodian lists');
    } finally {
      setMasterDataLoading(false);
    }
  };

  const vendorAutocompleteOptions = useMemo(
    () => [ADD_NEW_VENDOR_OPTION, ...(vendors || [])],
    [vendors]
  );

  const handleVendorAutocompleteChange = (_, value) => {
    if (value?.isAddNew) {
      setQuickVendorForm(emptyQuickVendorForm());
      setVendorDialogOpen(true);
      return;
    }
    setSelectedVendor(value);
    if (isCentralizedStoreBill && value) {
      setFormData((prev) => ({
        ...prev,
        payeeName: (value.payeeName || '').trim() || value.name || ''
      }));
    }
  };

  const handleQuickVendorCreate = async () => {
    const name = quickVendorForm.name.trim();
    if (!name) {
      setError('Vendor name is required');
      return;
    }
    try {
      setVendorSaving(true);
      setError(null);
      const res = await api.post('/procurement/vendors/quick', {
        ...quickVendorForm,
        name
      });
      const created = res.data?.data;
      if (!created?._id) {
        throw new Error('Vendor was not returned from server');
      }
      setVendors((prev) => {
        const list = prev || [];
        if (list.some((v) => String(v._id) === String(created._id))) return list;
        return [...list, created].sort((a, b) => String(a.name).localeCompare(String(b.name)));
      });
      setSelectedVendor(created);
      if (isCentralizedStoreBill) {
        setFormData((prev) => ({
          ...prev,
          payeeName: (created.payeeName || '').trim() || created.name || ''
        }));
      }
      setVendorDialogOpen(false);
      setQuickVendorForm(emptyQuickVendorForm());
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create vendor');
    } finally {
      setVendorSaving(false);
    }
  };

  const billLinesTotal = billLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const addedStoreItemIds = useMemo(
    () => new Set(billLines.map((l) => String(l.storeItem || '')).filter(Boolean)),
    [billLines]
  );

  const itemsInSelectedCategory = useMemo(() => {
    if (!selectedBillCategory?._id) return [];
    const catId = String(selectedBillCategory._id);
    return storeItems.filter((item) => String(item.category?._id || item.category) === catId);
  }, [storeItems, selectedBillCategory]);

  useEffect(() => {
    if (!useStoreBill) return;
    setFormData((prev) => ({ ...prev, amount: billLinesTotal }));
  }, [billLinesTotal, useStoreBill]);

  const addBillLineFromItem = (storeItem) => {
    if (!storeItem) return;
    const storeItemId = String(storeItem._id);
    if (addedStoreItemIds.has(storeItemId)) {
      setError('This item is already on the bill. Remove it first to add again.');
      return;
    }
    setError(null);
    const categoryName = storeItem.category?.name || selectedBillCategory?.name || '';
    const lineLabel = categoryName ? `${categoryName} — ${storeItem.name}` : storeItem.name;
    setBillLines((prev) => [
      ...prev,
      {
        storeItem: storeItem._id,
        itemCode: String(storeItem.code || '').trim(),
        categoryName,
        itemLabel: storeItem.name,
        itemName: lineLabel,
        description: storeItem.description || storeItem.name,
        utilityType: storeItem.utilityType,
        meterNumber: storeItem.meterNumber || '',
        location: storeItem.location || '',
        site: storeItem.site || '',
        amount: storeItem.defaultAmount || 0,
        expenseAccount: storeItem.expenseAccount?._id || storeItem.expenseAccount,
        expenseAccountNumber: storeItem.expenseAccount?.accountNumber || '',
        dueDate: defaultLineDueYmd(),
        attachmentUrl: '',
        attachmentUrls: [],
        _pendingFiles: []
      }
    ]);
    setPendingStoreItem(null);
  };

  const handleAddPendingStoreItem = () => {
    if (!selectedBillCategory) {
      setError('Select a category first.');
      return;
    }
    if (!pendingStoreItem) {
      setError('Select an item to add.');
      return;
    }
    addBillLineFromItem(pendingStoreItem);
  };

  const updateBillLine = (index, field, value) => {
    setBillLines((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const removeBillLine = (index) => {
    setBillLines((prev) => prev.filter((_, i) => i !== index));
  };

  const fetchBill = async () => {
    setLoadedApprovalStatus(null);
    try {
      setLoading(true);
      const response = await utilityBillService.getUtilityBill(id);
      const bill = response.data;

      setLoadedApprovalStatus(bill.approvalStatus || 'Draft');
      setUseStoreBill(Boolean(bill.useCentralizedStore && bill.billLines?.length));
      const mappedLines = (bill.billLines || []).map((line) => {
        const itemName = line.itemName || '';
        const parts = itemName.includes(' — ') ? itemName.split(' — ') : [];
        const storeItemObj = line.storeItem && typeof line.storeItem === 'object' ? line.storeItem : null;
        const categoryName =
          parts.length > 1
            ? parts[0]
            : (storeItemObj?.category?.name || '');
        const itemLabel =
          storeItemObj?.name ||
          (parts.length > 1 ? parts.slice(1).join(' — ') : itemName);
        return {
          storeItem: storeItemObj?._id || line.storeItem,
          itemCode: String(line.itemCode || storeItemObj?.code || '').trim(),
          categoryName,
          itemLabel,
          itemName,
          description: line.description || '',
          utilityType: line.utilityType || '',
          meterNumber: line.meterNumber || '',
          location: line.location || '',
          site: line.site || '',
          amount: line.amount || 0,
          expenseAccount: line.expenseAccount?._id || line.expenseAccount,
          expenseAccountNumber: line.expenseAccount?.accountNumber || line.expenseAccountNumber || '',
          dueDate: line.dueDate ? new Date(line.dueDate).toISOString().split('T')[0] : defaultLineDueYmd(),
          attachmentUrl: line.attachmentUrl || '',
          attachmentUrls: Array.isArray(line.attachmentUrls) && line.attachmentUrls.length
            ? line.attachmentUrls
            : (line.attachmentUrl ? [line.attachmentUrl] : []),
          _pendingFiles: []
        };
      });
      setBillLines(mappedLines);
      if (bill.payeeEmployee) {
        const e = typeof bill.payeeEmployee === 'object' ? bill.payeeEmployee : null;
        const name = e
          ? [e.firstName, e.lastName].filter(Boolean).join(' ').trim() || e.employeeId || bill.provider
          : bill.provider || '';
        setPayeeType('employee');
        setSelectedEmployee({
          _id: e?._id || bill.payeeEmployee,
          name,
          employeeId: e?.employeeId || ''
        });
        setSelectedVendor(null);
      } else if (bill.vendorId) {
        const v = typeof bill.vendorId === 'object' ? bill.vendorId : null;
        setPayeeType('vendor');
        setSelectedVendor(v || { _id: bill.vendorId, name: bill.provider });
        setSelectedEmployee(null);
      } else {
        setPayeeType('vendor');
        setSelectedVendor(null);
        setSelectedEmployee(null);
      }

      setFormData({
        accountHead: bill.accountHead || '',
        site: bill.site || '',
        utilityType: bill.utilityType || defaultType,
        provider: bill.provider || '',
        payeeName: bill.provider || '',
        accountNumber: bill.accountNumber || '',
        billDate: bill.billDate ? new Date(bill.billDate).toISOString().split('T')[0] : '',
        dueDate: bill.dueDate ? new Date(bill.dueDate).toISOString().split('T')[0] : '',
        amount: bill.amount || 0,
        lastMonthAmount: bill.lastMonthAmount || 0,
        forWhat: bill.forWhat || '',
        notes: bill.notes || '',
        location: bill.location || 'Main Office',
        department: bill.department || '',
        custodian: bill.custodian || ''
      });

      // Set image preview if bill has an image
      if (bill.billImage) {
        setImagePreview(getImageUrl(bill.billImage));
      }


      const draftApprovers = bill.draftApproverIds || [];
      const chainApprovers = (bill.approvalChain || []).map((step) => step.approver).filter(Boolean);
      const approvers = draftApprovers.length ? draftApprovers : chainApprovers;
      setManagerApprover(approvers[0] && typeof approvers[0] === 'object' ? approvers[0] : null);
      setHodApprover(approvers[1] && typeof approvers[1] === 'object' ? approvers[1] : null);

      setWorkflowLocksEdit(
        bill.approvalStatus === 'Approved' && isWorkflowAuditBlockingEditStatus(bill.auditStatus)
      );
      setAuditReturnedNotice(bill.auditStatus === 'Returned from Audit');
      setLoadedBillForAudit(bill);
    } catch (err) {
      setError('Failed to fetch utility bill details');
      console.error('Error fetching bill:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };


  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await saveBill('draft');
  };

  const loadApproverOptions = async (search = '') => {
    try {
      setApproverLoading(true);
      const response = await utilityBillService.getApproverCandidates({
        search,
        limit: isCentralizedStoreBill ? 500 : 50,
        ...(isCentralizedStoreBill ? { allUsers: true } : {})
      });
      setApproverOptions(response.data || []);
    } catch {
      setApproverOptions([]);
    } finally {
      setApproverLoading(false);
    }
  };

  useEffect(() => {
    loadApproverOptions('');
  }, []);

  const showSubmitForApproval =
    !isEdit ||
    loadedApprovalStatus == null ||
    loadedApprovalStatus === 'Draft' ||
    loadedApprovalStatus === 'Rejected';
  const internalApprovalComplete = isEdit && loadedApprovalStatus === 'Approved';

  const saveBill = async (mode = 'draft') => {
    if (isEdit && workflowLocksEdit) {
      setError('This bill cannot be edited while it is with audit. Wait until it is returned for correction.');
      return;
    }
    if (mode === 'submit' && !showSubmitForApproval) {
      setError('This bill is not in a state that can be sent to approval authorities again.');
      return;
    }
    if (mode === 'submit' && (!managerApprover?._id || !hodApprover?._id)) {
      setError('Please select Manager Approver and Head Of Department Approver before submitting.');
      return;
    }

    const managerApproverId = getUserId(managerApprover);
    const hodApproverId = getUserId(hodApprover);
    const requesterId = getUserId(user);

    if (mode === 'submit' && [managerApproverId, hodApproverId].includes(requesterId)) {
      setError('Requester cannot be selected as Manager or Head Of Department approver.');
      return;
    }

    if (mode === 'submit' && managerApproverId === hodApproverId) {
      setError('Manager Approver and Head Of Department Approver must be different.');
      return;
    }

    if (useStoreBill) {
      if (isCentralizedStoreBill && payeeType === 'employee') {
        if (!selectedEmployee?._id) {
          setError('Select an employee from the list.');
          return;
        }
      } else if (!selectedVendor?._id) {
        setError('Select a supplier / vendor from the list.');
        return;
      }
      if (isCentralizedStoreBill && !(formData.payeeName || '').trim()) {
        setError('Payee name is required.');
        return;
      }
      if (!billLines.length || billLines.every((l) => !(Number(l.amount) > 0))) {
        setError('Add at least one item: select category, pick item, click Add Item, and enter amount.');
        return;
      }
      if (billLines.some((l) => !l.dueDate)) {
        setError('Each line item must have a due date.');
        return;
      }
    }
    
    try {
      setLoading(true);
      setError(null);

      const payload = { ...formData };
      if (useStoreBill) {
        if (isCentralizedStoreBill) {
          payload.provider = (formData.payeeName || '').trim();
        } else if (payeeType === 'employee' && selectedEmployee) {
          payload.provider = selectedEmployee.name;
        } else {
          payload.provider = selectedVendor.name;
        }
        payload.amount = billLinesTotal;
        payload.useCentralizedStore = true;
        payload.utilityType = billLines[0]?.utilityType || 'Other';
        if (isCentralizedStoreBill) {
          applyCentralizedStoreBillDefaults(payload, billLines, billLinesTotal);
        } else if (billLines[0]?.site) {
          payload.site = billLines[0].site;
          if (billLines[0]?.location) payload.location = billLines[0].location;
        }
      }

      const submitData = new FormData();
      
      Object.keys(payload).forEach((key) => {
        const val = payload[key];
        if (val === null || val === undefined) return;
        if (val === '' && !(isCentralizedStoreBill && key === 'notes')) return;
        submitData.append(key, val);
      });

      if (useStoreBill) {
        const linesPayload = billLines.map((l) => ({
          storeItem: getStoreItemId(l.storeItem) || l.storeItem,
          itemCode: l.itemCode || '',
          categoryName: l.categoryName,
          itemLabel: l.itemLabel,
          itemName: l.itemName,
          description: l.description,
          utilityType: l.utilityType,
          meterNumber: l.meterNumber,
          location: l.location,
          site: l.site,
          amount: l.amount,
          expenseAccount: l.expenseAccount,
          expenseAccountNumber: l.expenseAccountNumber,
          dueDate: l.dueDate || '',
          attachmentUrl: l.attachmentUrl || '',
          attachmentUrls: l.attachmentUrls || []
        }));
        if (isCentralizedStoreBill && payeeType === 'employee' && selectedEmployee?._id) {
          submitData.append('payeeEmployee', selectedEmployee._id);
        } else {
          submitData.append('vendorId', selectedVendor._id);
        }
        submitData.append('useCentralizedStore', 'true');
        submitData.append('billLines', JSON.stringify(linesPayload));

        // Per-line attachments: files are already compressed on pick, just append them
        if (isCentralizedStoreBill) {
          for (const l of billLines) {
            const sid = getStoreItemId(l.storeItem);
            if (!sid) continue;
            // Tell the server which saved URLs to keep
            const savedUrls = l.attachmentUrls || (l.attachmentUrl ? [l.attachmentUrl] : []);
            submitData.append(`existingLineAttachments_${sid}`, JSON.stringify(savedUrls));
            if (l._pendingFiles && l._pendingFiles.length > 0) {
              l._pendingFiles.forEach((file, i) => {
                submitData.append(`lineAttachment_${sid}_${i}`, file);
              });
            }
          }
        }
      }

      const approverIds = [managerApproverId, hodApproverId].filter(Boolean);
      if (!internalApprovalComplete) {
        submitData.append('draftApproverIds', JSON.stringify(approverIds));
      }

      // Add image if selected
      if (selectedImage) {
        submitData.append('billImage', selectedImage);
      }

      let savedBill;
      if (isEdit) {
        const response = await utilityBillService.updateUtilityBill(id, submitData);
        savedBill = response.data;
      } else {
        const response = await utilityBillService.createUtilityBill(submitData);
        savedBill = response.data;
      }

      if (mode === 'submit') {
        await utilityBillService.submitUtilityBill(savedBill._id, { approverIds });
        navigate(
          isCentralizedStoreBill
            ? `/admin/centralized-store/bills/${savedBill._id}`
            : `/admin/utility-bills/${savedBill._id}`
        );
        return;
      }

      if (internalApprovalComplete && isEdit) {
        navigate(
          isCentralizedStoreBill
            ? `/admin/centralized-store/bills/${id}`
            : `/admin/utility-bills/${id}`
        );
        return;
      }

      navigate(backPath);
    } catch (err) {
      setError(err.response?.data?.message || (isEdit ? 'Failed to update utility bill' : 'Failed to create utility bill'));
      console.error('Error saving bill:', err);
    } finally {
      setLoading(false);
    }
  };

  const utilityTypes = [
    'Electricity',
    'Water',
    'Gas',
    'Internet',
    'Phone',
    'Maintenance',
    'Security',
    'Cleaning',
    'Other'
  ];

  const getEmployeeName = (employee) => (
    employee.fullName ||
    [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
    employee.employeeId ||
    'Unnamed Employee'
  );

  const getEmployeeOptionValue = (employee) => {
    const employeeName = getEmployeeName(employee);
    return employee.employeeId ? `${employeeName} (${employee.employeeId})` : employeeName;
  };

  if (loading && isEdit) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Header Skeleton */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width="25%" height={40} />
          <Skeleton variant="rectangular" width={80} height={36} borderRadius={1} />
        </Box>

        <Card>
          <CardContent>
            {/* Form Skeleton */}
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="30%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="40%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="50%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="35%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="45%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="30%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12}>
                <Skeleton variant="text" height={20} width="40%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={120} width="100%" />
              </Grid>
              <Grid item xs={12}>
                <Skeleton variant="text" height={20} width="25%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={80} width="100%" />
              </Grid>
              
              {/* Image Upload Skeleton */}
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Skeleton variant="rectangular" width={120} height={80} />
                  <Box flexGrow={1}>
                    <Skeleton variant="text" height={20} width="40%" sx={{ mb: 1 }} />
                    <Skeleton variant="rectangular" height={36} width="140" />
                  </Box>
                </Box>
              </Grid>

              {/* Buttons Skeleton */}
              <Grid item xs={12}>
                <Box display="flex" gap={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                  <Skeleton variant="rectangular" width={80} height={36} borderRadius={1} />
                  <Skeleton variant="rectangular" width={120} height={36} borderRadius={1} />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1">
            {isCentralizedStoreBill
              ? (isEdit ? 'Edit Centralized Store Bill' : 'Create Centralized Store Bill')
              : (isEdit ? 'Edit Utility Bill' : 'Create New Utility Bill')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => navigate(backPath)}
        >
          {isCentralizedStoreBill ? 'Back to Store Setup' : 'Back to Bills'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {isEdit && loadedBillForAudit && (
        <WorkflowAuditFeedbackPanel
          document={loadedBillForAudit}
          formatDateTime={formatDateTime}
          userDisplayName={userDisplayName}
          visualVariant="settlement"
          answerTitle="Your reply:"
          answeredIntro={null}
          returnedIntro={
            <>
              Audit feedback and your replies are shown below. Update the bill if needed, then open{' '}
              <strong>bill detail</strong> and use <strong>Resend to Pre-Audit</strong>.
            </>
          }
        />
      )}

      {isEdit && workflowLocksEdit && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          This bill is currently with audit. Editing is disabled until audit returns it for correction.
        </Alert>
      )}
      {isEdit && internalApprovalComplete && !workflowLocksEdit && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Manager and Head of Department have already approved this bill. Use <strong>Update bill</strong> to save memo
          changes only — this does <strong>not</strong> send the bill back to approval authorities.{' '}
          {auditReturnedNotice ? (
            <>
              When you are done, open the <strong>bill detail</strong> page and use <strong>Resend to Pre-Audit</strong>{' '}
              to return it to the audit queue.
            </>
          ) : (
            <>
              Use the <strong>bill detail</strong> page for the next workflow step (for example Pre-Audit or other
              departments), when those actions are available.
            </>
          )}
        </Alert>
      )}

      {/* Form */}
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <fieldset
              disabled={workflowLocksEdit}
              style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}
            >
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                  <Typography variant="h6">{isCentralizedStoreBill ? 'Bill details' : 'Basic Information'}</Typography>
                  {!isCentralizedStoreBill && (
                    <FormControlLabel
                      control={<Switch checked={useStoreBill} onChange={(e) => setUseStoreBill(e.target.checked)} />}
                      label="Use Centralized Store (vendor + line items)"
                    />
                  )}
                  <Link component={RouterLink} to="/admin/centralized-store" variant="body2">
                    Manage store setup
                  </Link>
                </Stack>
              </Grid>

              {(useStoreBill || isCentralizedStoreBill) && (
                <>
                  <Grid item xs={12}>
                    <Typography variant="h6" sx={{ mt: 1 }}>
                      Bill items
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Choose <strong>category</strong>, then <strong>item</strong>, click Add Item.
                      On each row set due date, attachment (optional), site, location, description, and amount. Set approval authorities before submit.
                    </Typography>
                  </Grid>
                  {isCentralizedStoreBill && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                        Payee type
                      </Typography>
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={payeeType}
                        onChange={(_, v) => {
                          if (!v) return;
                          setPayeeType(v);
                          if (v === 'vendor') setSelectedEmployee(null);
                          else setSelectedVendor(null);
                          setFormData((prev) => ({ ...prev, payeeName: '' }));
                        }}
                      >
                        <ToggleButton value="vendor">Vendor</ToggleButton>
                        <ToggleButton value="employee">Employee</ToggleButton>
                      </ToggleButtonGroup>
                    </Grid>
                  )}
                  <Grid item xs={12} md={isCentralizedStoreBill ? 3 : 6}>
                    {isCentralizedStoreBill ? (
                      payeeType === 'employee' ? (
                        <Autocomplete
                          fullWidth
                          loading={masterDataLoading}
                          options={financeEmployees}
                          getOptionLabel={(o) =>
                            o?.employeeId ? `${o.employeeId} — ${o.name}` : (o?.name || '')
                          }
                          value={selectedEmployee}
                          onChange={(_, emp) => {
                            setSelectedEmployee(emp);
                            if (emp) {
                              setFormData((prev) => ({ ...prev, payeeName: emp.name || '' }));
                            }
                          }}
                          isOptionEqualToValue={(a, b) => String(a?._id) === String(b?._id)}
                          noOptionsText={
                            masterDataLoading
                              ? 'Loading employees…'
                              : 'No active employees found (same list as Finance → Vendors & Employees)'
                          }
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Employee"
                              required
                              fullWidth
                              helperText="Active employees from Finance → Vendors & Employees"
                            />
                          )}
                        />
                      ) : (
                        <Autocomplete
                          fullWidth
                          options={vendorAutocompleteOptions}
                          getOptionLabel={(o) => o?.name || ''}
                          value={selectedVendor}
                          onChange={handleVendorAutocompleteChange}
                          isOptionEqualToValue={(a, b) => String(a?._id) === String(b?._id)}
                          filterOptions={(opts, state) => {
                            const term = state.inputValue.trim().toLowerCase();
                            const filtered = opts.filter((o) => {
                              if (o.isAddNew) return true;
                              if (!term) return true;
                              return (o.name || '').toLowerCase().includes(term)
                                || (o.supplierId || '').toLowerCase().includes(term);
                            });
                            const addNew = filtered.find((o) => o.isAddNew) || ADD_NEW_VENDOR_OPTION;
                            const rest = filtered.filter((o) => !o.isAddNew);
                            return [addNew, ...rest];
                          }}
                          renderOption={(props, option) => (
                            <li
                              {...props}
                              key={option.isAddNew ? '__add_new__' : option._id}
                              style={option.isAddNew ? { fontWeight: 600, color: '#1976d2' } : undefined}
                            >
                              {option.name}
                              {!option.isAddNew && option.supplierId ? (
                                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                  ({option.supplierId})
                                </Typography>
                              ) : null}
                            </li>
                          )}
                          renderInput={(params) => (
                            <TextField {...params} label="Supplier / Vendor" required fullWidth />
                          )}
                        />
                      )
                    ) : (
                      <Autocomplete
                        options={vendorAutocompleteOptions}
                        getOptionLabel={(o) => o?.name || ''}
                        value={selectedVendor}
                        onChange={handleVendorAutocompleteChange}
                        isOptionEqualToValue={(a, b) => String(a?._id) === String(b?._id)}
                        filterOptions={(opts, state) => {
                          const term = state.inputValue.trim().toLowerCase();
                          const filtered = opts.filter((o) => {
                            if (o.isAddNew) return true;
                            if (!term) return true;
                            return (o.name || '').toLowerCase().includes(term)
                              || (o.supplierId || '').toLowerCase().includes(term);
                          });
                          const addNew = filtered.find((o) => o.isAddNew) || ADD_NEW_VENDOR_OPTION;
                          const rest = filtered.filter((o) => !o.isAddNew);
                          return [addNew, ...rest];
                        }}
                        renderOption={(props, option) => (
                          <li
                            {...props}
                            key={option.isAddNew ? '__add_new__' : option._id}
                            style={option.isAddNew ? { fontWeight: 600, color: '#1976d2' } : undefined}
                          >
                            {option.name}
                            {!option.isAddNew && option.supplierId ? (
                              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                ({option.supplierId})
                              </Typography>
                            ) : null}
                          </li>
                        )}
                        renderInput={(params) => (
                          <TextField {...params} label="Supplier / Vendor" required fullWidth />
                        )}
                      />
                    )}
                  </Grid>
                  {isCentralizedStoreBill && (
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        required
                        label="Payee Name"
                        name="payeeName"
                        value={formData.payeeName}
                        onChange={handleChange('payeeName')}
                        placeholder="Name on payment / cheque"
                        helperText={
                          payeeType === 'vendor'
                            ? 'Auto-filled from vendor; edit if payment goes to a different name'
                            : 'Auto-filled from employee; edit if needed'
                        }
                      />
                    </Grid>
                  )}
                  <Grid item xs={12} md={isCentralizedStoreBill ? 3 : 4}>
                    <FormControl fullWidth>
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={selectedBillCategory?._id || ''}
                        label="Category"
                        onChange={(e) => {
                          const cat = storeCategories.find((c) => String(c._id) === String(e.target.value));
                          setSelectedBillCategory(cat || null);
                          setPendingStoreItem(null);
                        }}
                      >
                        <MenuItem value="">
                          <em>Select category</em>
                        </MenuItem>
                        {storeCategories.map((cat) => (
                          <MenuItem key={cat._id} value={cat._id}>
                            {cat.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={isCentralizedStoreBill ? 3 : 4}>
                    <Autocomplete
                      fullWidth
                      disabled={!selectedBillCategory}
                      options={itemsInSelectedCategory}
                      getOptionLabel={(o) => o?.name || ''}
                      value={pendingStoreItem}
                      isOptionEqualToValue={(a, b) => String(a?._id) === String(b?._id)}
                      getOptionDisabled={(o) => addedStoreItemIds.has(String(o._id))}
                      onChange={(_, item) => setPendingStoreItem(item)}
                      renderOption={(props, option) => (
                        <li {...props} key={option._id}>
                          {option.name}
                          {addedStoreItemIds.has(String(option._id)) ? ' (already added)' : ''}
                        </li>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Item"
                          fullWidth
                          placeholder={selectedBillCategory ? 'e.g. Meter 1' : 'Select category first'}
                          helperText={
                            billLines.length
                              ? 'Optional — only needed when adding another line'
                              : 'Select category, then pick an item to add'
                          }
                        />
                      )}
                    />
                  </Grid>
                  <Grid
                    item
                    xs={12}
                    md={isCentralizedStoreBill ? 3 : 4}
                    sx={{ display: 'flex', alignItems: 'flex-end' }}
                  >
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      fullWidth
                      sx={{ minHeight: 56 }}
                      disabled={!pendingStoreItem}
                      onClick={handleAddPendingStoreItem}
                    >
                      Add Item
                    </Button>
                  </Grid>
                  {isCentralizedStoreBill && (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        label="Narration"
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange('notes')}
                        placeholder="Reference text shown on the bill (e.g. GRN, PO, indent, payment terms)"
                        inputProps={{ maxLength: 2000 }}
                        helperText="This text appears in the Narration section on the bill view and printout."
                      />
                    </Grid>
                  )}
                  <Grid item xs={12}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Category</TableCell>
                          <TableCell>Item</TableCell>
                          <TableCell>Description</TableCell>
                          {isCentralizedStoreBill && <TableCell>Company</TableCell>}
                          {isCentralizedStoreBill && <TableCell>Project</TableCell>}
                          {!isCentralizedStoreBill && <TableCell>Location</TableCell>}
                          <TableCell>Due date</TableCell>
                          <TableCell>Attachment</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell width={48} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {billLines.map((line, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{line.categoryName || '—'}</TableCell>
                            <TableCell>{line.itemLabel || line.itemName}</TableCell>
                            <TableCell>
                              <TextField size="small" fullWidth value={line.description} onChange={(e) => updateBillLine(idx, 'description', e.target.value)} />
                            </TableCell>
                            {isCentralizedStoreBill && (
                              <TableCell sx={{ minWidth: 160 }}>
                                <FormControl size="small" fullWidth>
                                  <Select
                                    value={line.site || ''}
                                    onChange={(e) => updateBillLine(idx, 'site', e.target.value)}
                                    displayEmpty
                                  >
                                    <MenuItem value="" disabled>
                                      <em>Select Company</em>
                                    </MenuItem>
                                    {companiesList.map((c) => (
                                      <MenuItem key={c._id} value={c.name}>
                                        {c.name}
                                      </MenuItem>
                                    ))}
                                    {line.site && !companiesList.some((c) => c.name === line.site) && (
                                      <MenuItem value={line.site}>
                                        {line.site}
                                      </MenuItem>
                                    )}
                                  </Select>
                                </FormControl>
                              </TableCell>
                            )}
                            {isCentralizedStoreBill ? (
                              <TableCell sx={{ minWidth: 160 }}>
                                <FormControl size="small" fullWidth>
                                  <Select
                                    value={line.location || ''}
                                    onChange={(e) => updateBillLine(idx, 'location', e.target.value)}
                                    displayEmpty
                                  >
                                    <MenuItem value="" disabled>
                                      <em>Select Project</em>
                                    </MenuItem>
                                    {projectsList.map((p) => (
                                      <MenuItem key={p._id} value={p.name}>
                                        {p.name}
                                      </MenuItem>
                                    ))}
                                    {line.location && !projectsList.some((p) => p.name === line.location) && (
                                      <MenuItem value={line.location}>
                                        {line.location}
                                      </MenuItem>
                                    )}
                                  </Select>
                                </FormControl>
                              </TableCell>
                            ) : (
                              <TableCell>{line.location || line.site || '—'}</TableCell>
                            )}
                            <TableCell>
                              <TextField
                                size="small"
                                type="date"
                                value={line.dueDate || ''}
                                onChange={(e) => updateBillLine(idx, 'dueDate', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ width: 150 }}
                              />
                            </TableCell>
                            <TableCell sx={{ minWidth: 160, maxWidth: 240 }}>
                              <LineAttachmentCell
                                line={line}
                                idx={idx}
                                updateBillLine={updateBillLine}
                                resolveUrl={resolveUploadPublicUrl}
                                readOnly={workflowLocksEdit}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <TextField size="small" type="number" value={line.amount} onChange={(e) => updateBillLine(idx, 'amount', e.target.value)} sx={{ width: 120 }} />
                            </TableCell>
                            <TableCell>
                              <IconButton size="small" color="error" onClick={() => removeBillLine(idx)}><DeleteIcon /></IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!billLines.length && (
                          <TableRow>
                            <TableCell colSpan={isCentralizedStoreBill ? 9 : 8} align="center" sx={{ color: 'text.secondary' }}>
                              Select category and item, then click Add Item
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    <Typography variant="subtitle2" align="right" sx={{ mt: 1 }}>
                      Total: PKR {billLinesTotal.toLocaleString()}
                    </Typography>
                  </Grid>
                </>
              )}

              {!isCentralizedStoreBill && !useStoreBill && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Account Head</InputLabel>
                  <Select
                    value={formData.accountHead}
                    onChange={handleChange('accountHead')}
                    label="Account Head"
                  >
                    <MenuItem value="">
                      <em>Select account head</em>
                    </MenuItem>
                    {accountHeadOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              )}

              {!isCentralizedStoreBill && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Site"
                  value={formData.site}
                  onChange={handleChange('site')}
                  placeholder="Enter site location"
                />
              </Grid>
              )}

              {!isCentralizedStoreBill && !useStoreBill && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Utility Type</InputLabel>
                  <Select
                    value={formData.utilityType}
                    onChange={handleChange('utilityType')}
                    label="Utility Type"
                  >
                    {utilityTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              )}

              {!isCentralizedStoreBill && !useStoreBill && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Provider"
                    value={formData.provider}
                    onChange={handleChange('provider')}
                    required
                    placeholder="e.g., K-Electric"
                  />
                </Grid>
              )}

              {!isCentralizedStoreBill && (
              <>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Reference No"
                  value={formData.accountNumber}
                  onChange={handleChange('accountNumber')}
                  placeholder="Optional reference number"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Location"
                  value={formData.location}
                  onChange={handleChange('location')}
                  placeholder="e.g., Main Office"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth disabled={masterDataLoading}>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={formData.department}
                    onChange={handleChange('department')}
                    label="Department"
                  >
                    <MenuItem value="">
                      <em>Select department</em>
                    </MenuItem>
                    {formData.department && !departments.some((department) => department.name === formData.department) && (
                      <MenuItem value={formData.department}>
                        {formData.department}
                      </MenuItem>
                    )}
                    {departments.map((department) => (
                      <MenuItem key={department._id} value={department.name}>
                        {department.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth disabled={masterDataLoading}>
                  <InputLabel>Custodian</InputLabel>
                  <Select
                    value={formData.custodian}
                    onChange={handleChange('custodian')}
                    label="Custodian"
                  >
                    <MenuItem value="">
                      <em>Select custodian</em>
                    </MenuItem>
                    {formData.custodian && !employees.some((employee) => getEmployeeOptionValue(employee) === formData.custodian) && (
                      <MenuItem value={formData.custodian}>
                        {formData.custodian}
                      </MenuItem>
                    )}
                    {employees.map((employee) => {
                      const optionValue = getEmployeeOptionValue(employee);
                      return (
                        <MenuItem key={employee._id} value={optionValue}>
                          {optionValue}
                          {employee.placementDepartment?.name ? ` - ${employee.placementDepartment.name}` : ''}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Date Information
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Bill Date"
                  type="date"
                  value={formData.billDate}
                  onChange={handleChange('billDate')}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Due Date"
                  type="date"
                  value={formData.dueDate}
                  onChange={handleChange('dueDate')}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Amount Information
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={useStoreBill ? billLinesTotal : formData.amount}
                  onChange={handleChange('amount')}
                  required
                  inputProps={{ min: 0, step: 0.01 }}
                  InputProps={{ readOnly: useStoreBill }}
                  helperText={useStoreBill ? 'Total from bill items above' : undefined}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Last Month Amount"
                  type="number"
                  value={formData.lastMonthAmount}
                  onChange={handleChange('lastMonthAmount')}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Additional Information
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="For What"
                  value={formData.forWhat}
                  onChange={handleChange('forWhat')}
                  multiline
                  rows={3}
                  placeholder="Explain what this utility bill is for..."
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Bill Image
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <input
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="bill-image-upload"
                    type="file"
                    onChange={handleImageChange}
                  />
                  <label htmlFor="bill-image-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<CloudUploadIcon />}
                      size="small"
                    >
                      Upload Image
                    </Button>
                  </label>
                  {imagePreview && (
                    <IconButton
                      onClick={handleRemoveImage}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </Box>

                {imagePreview && (
                  <Box sx={{ mt: 2 }}>
                    <Avatar
                      src={imagePreview}
                      alt="Bill Preview"
                      sx={{
                        width: 200,
                        height: 200,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                      onError={(e) => handleImageError(e)}
                    />
                  </Box>
                )}
              </Grid>
              </>
              )}

              {/* Approval Section — only when bill can still be submitted to Manager / HOD */}
              {showSubmitForApproval && (
              <>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Approvals
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {isCentralizedStoreBill
                    ? 'Choose Manager and Head Of Department approvers before submitting. All active users are listed.'
                    : 'Choose Manager and Head Of Department approvers before submitting. You can also save as draft. Only users whose department in User Management is Administration (code ADMIN) are listed.'}
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Sig of Requester"
                  value={userDisplayName(user)}
                  InputProps={{ readOnly: true }}
                  helperText="Auto-filled from logged-in user"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={managerApproverSelectOptions}
                  value={managerApprover}
                  loading={approverLoading}
                  onChange={(_, value) => setManagerApprover(value)}
                  onOpen={() => loadApproverOptions('')}
                  onInputChange={approverSearchOnInputChange(loadApproverOptions)}
                  getOptionLabel={(option) => userDisplayName(option)}
                  isOptionEqualToValue={(option, value) => option._id === value._id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Manager Approver"
                      placeholder="Search manager approver"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={hodApproverSelectOptions}
                  value={hodApprover}
                  loading={approverLoading}
                  onChange={(_, value) => setHodApprover(value)}
                  onOpen={() => loadApproverOptions('')}
                  onInputChange={approverSearchOnInputChange(loadApproverOptions)}
                  getOptionLabel={(option) => userDisplayName(option)}
                  isOptionEqualToValue={(option, value) => option._id === value._id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Head Of Department Approver"
                      placeholder="Search HOD approver"
                    />
                  )}
                />
              </Grid>
              </>
              )}
            </Grid>
            </fieldset>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate(backPath)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={loading || workflowLocksEdit}
                  >
                    {loading ? 'Saving...' : internalApprovalComplete ? 'Update bill' : 'Save Draft'}
                  </Button>
                  {showSubmitForApproval && (
                  <Button
                    type="button"
                    variant="contained"
                    color="success"
                    startIcon={<SendIcon />}
                    disabled={loading || workflowLocksEdit}
                    onClick={() => saveBill('submit')}
                  >
                    Submit for Approval
                  </Button>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

      <Dialog open={vendorDialogOpen} onClose={() => !vendorSaving && setVendorDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add new vendor</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Vendor name"
                value={quickVendorForm.name}
                onChange={(e) => setQuickVendorForm((p) => ({ ...p, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Contact person"
                value={quickVendorForm.contactPerson}
                onChange={(e) => setQuickVendorForm((p) => ({ ...p, contactPerson: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Phone"
                value={quickVendorForm.phone}
                onChange={(e) => setQuickVendorForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={quickVendorForm.email}
                onChange={(e) => setQuickVendorForm((p) => ({ ...p, email: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={quickVendorForm.address}
                onChange={(e) => setQuickVendorForm((p) => ({ ...p, address: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Payment terms</InputLabel>
                <Select
                  value={quickVendorForm.paymentTerms}
                  label="Payment terms"
                  onChange={(e) => setQuickVendorForm((p) => ({ ...p, paymentTerms: e.target.value }))}
                >
                  <MenuItem value="Cash">Cash</MenuItem>
                  <MenuItem value="Credit 7 days">Credit 7 days</MenuItem>
                  <MenuItem value="Credit 15 days">Credit 15 days</MenuItem>
                  <MenuItem value="Credit 30 days">Credit 30 days</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVendorDialogOpen(false)} disabled={vendorSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleQuickVendorCreate} disabled={vendorSaving}>
            {vendorSaving ? <CircularProgress size={22} /> : 'Save vendor'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UtilityBillForm;