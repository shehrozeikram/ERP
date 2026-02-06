import { useState } from 'react';
import dayjs from 'dayjs';
import { createInvoice, updateInvoice, fetchInvoicesForProperty } from '../services/propertyInvoiceService';

// Generate invoice number helper function
export const generateInvoiceNumber = (propertySrNo, year, month, type = 'GEN') => {
  const paddedMonth = String(month).padStart(2, '0');
  const paddedIndex = String(propertySrNo || 1).padStart(4, '0');
  
  let typePrefix = 'GEN';
  
  // Handle known types
  if (type === 'CAM' || type === 'CMC') {
    typePrefix = 'CMC';
  } else if (type === 'ELECTRICITY' || type === 'ELC') {
    typePrefix = 'ELC';
  } else if (type === 'RENT' || type === 'REN') {
    typePrefix = 'REN';
  } else if (type === 'MIXED' || type === 'MIX') {
    typePrefix = 'MIX';
  } else if (type === 'GEN' || type === 'GENERAL') {
    typePrefix = 'GEN';
  } else if (type && type.length > 0) {
    // For custom types, use first 3 letters (uppercase, remove non-letters)
    const cleaned = type.toUpperCase().replace(/[^A-Z]/g, '');
    typePrefix = cleaned.substring(0, 3).padEnd(3, 'X');
  }
  
  return `INV-${typePrefix}-${year}-${paddedMonth}-${paddedIndex}`;
};

/**
 * Reusable hook for invoice creation
 * @param {Object} options - Configuration options
 * @param {string} options.defaultChargeType - Default charge type (e.g., 'CAM', 'ELECTRICITY', 'RENT', 'OTHER')
 * @param {string} options.defaultInvoiceType - Default invoice type prefix for invoice number
 * @param {boolean} options.includeCAM - Whether to include CAM in backend call
 * @param {boolean} options.includeElectricity - Whether to include Electricity in backend call
 * @param {boolean} options.includeRent - Whether to include Rent in backend call
 */
export const useInvoiceCreation = (options = {}) => {
  const {
    defaultChargeType = 'OTHER',
    defaultInvoiceType = 'GEN',
    includeCAM = false,
    includeElectricity = false,
    includeRent = false
  } = options;

  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceProperty, setInvoiceProperty] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceWasSaved, setInvoiceWasSaved] = useState(false);
  const [propertyInvoices, setPropertyInvoices] = useState({});

  const handleCreateInvoice = async (property = null) => {
    setInvoiceProperty(property);
    setInvoiceData(null);
    setInvoiceError('');
    setInvoiceWasSaved(false);
    setInvoiceDialogOpen(true);

    try {
      setInvoiceLoading(true);
      
      const now = dayjs();
      const periodFrom = now.startOf('month').toDate();
      const periodTo = now.endOf('month').toDate();
      
      // Use defaultChargeType for invoice number prefix instead of defaultInvoiceType
      const invoiceNumber = generateInvoiceNumber(
        property?.srNo || 1,
        now.year(),
        now.month() + 1,
        defaultChargeType
      );
      
      setInvoiceData({
        invoiceNumber,
        invoiceDate: new Date(),
        dueDate: dayjs(periodTo).add(15, 'day').toDate(),
        periodFrom,
        periodTo,
        chargeTypes: [defaultChargeType],
        charges: [{
          type: defaultChargeType,
          description: '',
          amount: 0,
          arrears: 0,
          total: 0
        }],
        subtotal: 0,
        totalArrears: 0,
        grandTotal: 0,
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        customerAddress: '',
        sector: ''
      });
    } catch (err) {
      setInvoiceError(err.response?.data?.message || 'Failed to prepare invoice');
      const now = dayjs();
      const periodFrom = now.startOf('month').toDate();
      const periodTo = now.endOf('month').toDate();
      // Use defaultChargeType for invoice number prefix instead of defaultInvoiceType
      const invoiceNumber = generateInvoiceNumber(
        property?.srNo || 1,
        now.year(),
        now.month() + 1,
        defaultChargeType
      );
      
      setInvoiceData({
        invoiceNumber,
        invoiceDate: new Date(),
        dueDate: dayjs(periodTo).add(15, 'day').toDate(),
        periodFrom,
        periodTo,
        chargeTypes: [defaultChargeType],
        charges: [{
          type: defaultChargeType,
          description: '',
          amount: 0,
          arrears: 0,
          total: 0
        }],
        subtotal: 0,
        totalArrears: 0,
        grandTotal: 0,
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        customerAddress: '',
        sector: ''
      });
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleEditInvoice = async (property, invoice) => {
    setInvoiceProperty(property);
    setInvoiceData(invoice);
    setInvoiceError('');
    setInvoiceWasSaved(true);
    setInvoiceDialogOpen(true);
  };

  // Helper to get first 3 letters of charge type for invoice number
  const getChargeTypePrefix = (chargeType) => {
    if (!chargeType) return 'GEN';
    const cleaned = chargeType.toUpperCase().replace(/[^A-Z]/g, ''); // Remove non-letters
    return cleaned.substring(0, 3).padEnd(3, 'X'); // Take first 3, pad if needed
  };

  // Helper to update invoice number based on charge types
  const updateInvoiceNumberFromCharges = (charges, currentInvoiceNumber) => {
    if (!charges || charges.length === 0) return currentInvoiceNumber;
    
    // Use the first charge type to determine the prefix
    const firstChargeType = charges[0]?.type;
    if (!firstChargeType) return currentInvoiceNumber;
    
    const prefix = getChargeTypePrefix(firstChargeType);
    
    // Replace the type part in invoice number (format: INV-GEN-YYYY-MM-XXXX)
    // Find and replace the middle part (GEN, OTH, MAI, etc.)
    const parts = currentInvoiceNumber.split('-');
    if (parts.length >= 2) {
      // Replace the second part (GEN) with the new prefix
      parts[1] = prefix;
      return parts.join('-');
    }
    
    // Fallback: if format is different, try to replace GEN or construct new one
    if (currentInvoiceNumber.includes('-GEN-')) {
      return currentInvoiceNumber.replace('-GEN-', `-${prefix}-`);
    }
    
    // If we can't parse, generate a new one
    const now = dayjs();
    return generateInvoiceNumber(1, now.year(), now.month() + 1, prefix);
  };

  const handleInvoiceFieldChange = (field, value) => {
    if (!invoiceData) return;
    
    if (field.startsWith('charge.')) {
      const [, chargeIndex, chargeField] = field.split('.');
      const updatedCharges = [...invoiceData.charges];
      updatedCharges[chargeIndex] = {
        ...updatedCharges[chargeIndex],
        [chargeField]: chargeField === 'amount' || chargeField === 'arrears' ? Number(value) || 0 : value
      };
      
      // Recalculate total for this charge
      const charge = updatedCharges[chargeIndex];
      charge.total = (charge.amount || 0) + (charge.arrears || 0);
      
      // Recalculate invoice totals
      const subtotal = updatedCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
      const totalArrears = updatedCharges.reduce((sum, charge) => sum + (charge.arrears || 0), 0);
      const grandTotal = subtotal + totalArrears;
      
      // Update invoice number if charge type changed
      let updatedInvoiceNumber = invoiceData.invoiceNumber;
      if (chargeField === 'type') {
        updatedInvoiceNumber = updateInvoiceNumberFromCharges(updatedCharges, invoiceData.invoiceNumber);
      }
      
      setInvoiceData({
        ...invoiceData,
        invoiceNumber: updatedInvoiceNumber,
        charges: updatedCharges,
        subtotal,
        totalArrears,
        grandTotal
      });
    } else {
      // Use functional update to avoid stale state when multiple fields change in sequence (e.g. periodTo + dueDate)
      const resolvedValue = field === 'periodFrom' || field === 'periodTo' || field === 'dueDate' || field === 'invoiceDate'
        ? (value ? new Date(value) : null)
        : field === 'grandTotal' || field === 'subtotal' || field === 'totalArrears'
        ? Number(value) || 0
        : value;
      setInvoiceData((prev) => ({
        ...prev,
        [field]: resolvedValue
      }));
    }
  };

  const handleSaveInvoice = async () => {
    if (!invoiceData) {
      setInvoiceError('Invoice data is incomplete');
      return;
    }

    try {
      setInvoiceLoading(true);
      setInvoiceError('');
      
      if (invoiceData._id) {
        // Update existing invoice
        const updateData = {
          invoiceNumber: invoiceData.invoiceNumber,
          invoiceDate: invoiceData.invoiceDate ? (invoiceData.invoiceDate instanceof Date ? invoiceData.invoiceDate : new Date(invoiceData.invoiceDate)) : new Date(),
          dueDate: invoiceData.dueDate,
          periodFrom: invoiceData.periodFrom,
          periodTo: invoiceData.periodTo,
          charges: invoiceData.charges,
          subtotal: invoiceData.subtotal,
          totalArrears: invoiceData.totalArrears,
          grandTotal: invoiceData.grandTotal
        };

        // Add customer details if no property
        if (!invoiceProperty?._id) {
          updateData.customerName = invoiceData.customerName || '';
          updateData.customerEmail = invoiceData.customerEmail || '';
          updateData.customerPhone = invoiceData.customerPhone || '';
          updateData.customerAddress = invoiceData.customerAddress || '';
          updateData.sector = invoiceData.sector || '';
        }

        const response = await updateInvoice(invoiceData._id, updateData);

        setInvoiceData(response.data?.data || invoiceData);
        setInvoiceWasSaved(true);
        
        if (invoiceProperty?._id) {
          const invoiceResponse = await fetchInvoicesForProperty(invoiceProperty._id);
          setPropertyInvoices(prev => ({ ...prev, [invoiceProperty._id]: invoiceResponse.data?.data || [] }));
        }
        
        setTimeout(() => {
          handleCloseInvoiceDialog();
        }, 1500);
        return;
      }
      
      // Create new invoice
      if (invoiceProperty?._id) {
        // Property-based invoice
        const response = await createInvoice(invoiceProperty._id, {
          includeCAM,
          includeElectricity,
          includeRent,
          invoiceDate: invoiceData.invoiceDate ? (invoiceData.invoiceDate instanceof Date ? invoiceData.invoiceDate : new Date(invoiceData.invoiceDate)) : new Date(),
          periodFrom: invoiceData.periodFrom,
          periodTo: invoiceData.periodTo,
          dueDate: invoiceData.dueDate,
          charges: invoiceData.charges || []
        });

        const savedInvoice = response.data?.data || invoiceData;
        setInvoiceData(savedInvoice);
        setInvoiceWasSaved(true);
        
        const invoiceResponse = await fetchInvoicesForProperty(invoiceProperty._id);
        setPropertyInvoices(prev => ({ ...prev, [invoiceProperty._id]: invoiceResponse.data?.data || [] }));
      } else {
        // Open invoice (no property) - let backend auto-generate invoice number with increment
        const response = await createInvoice(null, {
          invoiceNumber: '', // Empty string to let backend auto-generate with increment
          invoiceDate: invoiceData.invoiceDate ? (invoiceData.invoiceDate instanceof Date ? invoiceData.invoiceDate : new Date(invoiceData.invoiceDate)) : new Date(),
          periodFrom: invoiceData.periodFrom,
          periodTo: invoiceData.periodTo,
          dueDate: invoiceData.dueDate,
          charges: invoiceData.charges || [],
          customerName: invoiceData.customerName || '',
          customerEmail: invoiceData.customerEmail || '',
          customerPhone: invoiceData.customerPhone || '',
          customerAddress: invoiceData.customerAddress || '',
          sector: invoiceData.sector || ''
        });

        const savedInvoice = response.data?.data || invoiceData;
        setInvoiceData(savedInvoice);
        setInvoiceWasSaved(true);
      }
      
      setTimeout(() => {
        handleCloseInvoiceDialog();
      }, 1500);
    } catch (err) {
      setInvoiceError(err.response?.data?.message || 'Failed to save invoice');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleCloseInvoiceDialog = () => {
    setInvoiceDialogOpen(false);
    setInvoiceProperty(null);
    setInvoiceData(null);
    setInvoiceError('');
    setInvoiceWasSaved(false);
  };

  const addCharge = () => {
    if (!invoiceData) return;
    setInvoiceData({
      ...invoiceData,
      charges: [
        ...invoiceData.charges,
        {
          type: defaultChargeType,
          description: '',
          amount: 0,
          arrears: 0,
          total: 0
        }
      ],
      chargeTypes: [...new Set([...invoiceData.chargeTypes, defaultChargeType])]
    });
  };

  const removeCharge = (index) => {
    if (!invoiceData || invoiceData.charges.length <= 1) return;
    const updatedCharges = invoiceData.charges.filter((_, i) => i !== index);
    const chargeTypes = [...new Set(updatedCharges.map(c => c.type))];
    
    const subtotal = updatedCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
    const totalArrears = updatedCharges.reduce((sum, charge) => sum + (charge.arrears || 0), 0);
    const grandTotal = subtotal + totalArrears;
    
    setInvoiceData({
      ...invoiceData,
      charges: updatedCharges,
      chargeTypes,
      subtotal,
      totalArrears,
      grandTotal
    });
  };

  return {
    // State
    invoiceDialogOpen,
    invoiceProperty,
    invoiceData,
    invoiceLoading,
    invoiceError,
    invoiceWasSaved,
    propertyInvoices,
    
    // Actions
    handleCreateInvoice,
    handleEditInvoice,
    handleInvoiceFieldChange,
    handleSaveInvoice,
    handleCloseInvoiceDialog,
    addCharge,
    removeCharge,
    setInvoiceData,
    setInvoiceError
  };
};
