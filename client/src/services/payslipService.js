import api from './api';
import { formatPKR } from '../utils/currency';

// Format currency helper
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return formatPKR(0);
  }
  return formatPKR(amount);
};

// Get all payslips with filters
export const getPayslips = async (params = {}) => {
  try {
    const response = await api.get('/payslips', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get payslip by ID
export const getPayslipById = async (id) => {
  try {
    const response = await api.get(`/payslips/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create new payslip
export const createPayslip = async (payslipData) => {
  try {
    const response = await api.post('/payslips', payslipData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update payslip
export const updatePayslip = async (id, payslipData) => {
  try {
    const response = await api.put(`/payslips/${id}`, payslipData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Delete payslip
export const deletePayslip = async (id) => {
  try {
    const response = await api.delete(`/payslips/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Generate payslip (change status from draft to generated)
export const generatePayslip = async (id) => {
  try {
    const response = await api.put(`/payslips/${id}/generate`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Approve payslip
export const approvePayslip = async (id) => {
  try {
    const response = await api.put(`/payslips/${id}/approve`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Mark payslip as paid
export const markPayslipAsPaid = async (id, paymentData) => {
  try {
    const response = await api.put(`/payslips/${id}/mark-paid`, paymentData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Bulk generate payslips
export const bulkGeneratePayslips = async (bulkData) => {
  try {
    const response = await api.post('/payslips/bulk-generate', bulkData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get payslip statistics
export const getPayslipStats = async (params = {}) => {
  try {
    const response = await api.get('/payslips/stats/overview', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get payslips for specific employee
export const getEmployeePayslips = async (employeeId, params = {}) => {
  try {
    const response = await api.get(`/payslips/employee/${employeeId}`, { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get payslip status color
export const getPayslipStatusColor = (status) => {
  switch (status) {
    case 'draft':
      return 'default';
    case 'generated':
      return 'info';
    case 'approved':
      return 'warning';
    case 'paid':
      return 'success';
    case 'cancelled':
      return 'error';
    default:
      return 'default';
  }
};

// Get payslip status label
export const getPayslipStatusLabel = (status) => {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'generated':
      return 'Generated';
    case 'approved':
      return 'Approved';
    case 'paid':
      return 'Paid';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
};

// Format payslip data for display
export const formatPayslipData = (payslip) => {
  return {
    ...payslip,
    formattedEarnings: {
      basicSalary: formatCurrency(payslip.earnings?.basicSalary),
      houseRent: formatCurrency(payslip.earnings?.houseRent),
      medicalAllowance: formatCurrency(payslip.earnings?.medicalAllowance),
      conveyanceAllowance: formatCurrency(payslip.earnings?.conveyanceAllowance),
      specialAllowance: formatCurrency(payslip.earnings?.specialAllowance),
      otherAllowances: formatCurrency(payslip.earnings?.otherAllowances),
      overtime: formatCurrency(payslip.earnings?.overtime),
      bonus: formatCurrency(payslip.earnings?.bonus),
      incentives: formatCurrency(payslip.earnings?.incentives),
      arrears: formatCurrency(payslip.earnings?.arrears),
      otherEarnings: formatCurrency(payslip.earnings?.otherEarnings)
    },
    formattedDeductions: {
      providentFund: formatCurrency(payslip.deductions?.providentFund),
      eobi: formatCurrency(payslip.deductions?.eobi),
      incomeTax: formatCurrency(payslip.deductions?.incomeTax),
      loanDeduction: formatCurrency(payslip.deductions?.loanDeduction),
      advanceDeduction: formatCurrency(payslip.deductions?.advanceDeduction),
      lateDeduction: formatCurrency(payslip.deductions?.lateDeduction),
      absentDeduction: formatCurrency(payslip.deductions?.absentDeduction),
      otherDeductions: formatCurrency(payslip.deductions?.otherDeductions)
    },
    formattedTotals: {
      grossSalary: formatCurrency(payslip.grossSalary),
      totalEarnings: formatCurrency(payslip.totalEarnings),
      totalDeductions: formatCurrency(payslip.totalDeductions),
      netSalary: formatCurrency(payslip.netSalary)
    },
    statusColor: getPayslipStatusColor(payslip.status),
    statusLabel: getPayslipStatusLabel(payslip.status)
  };
};

export default {
  getPayslips,
  getPayslipById,
  createPayslip,
  updatePayslip,
  deletePayslip,
  generatePayslip,
  approvePayslip,
  markPayslipAsPaid,
  bulkGeneratePayslips,
  getPayslipStats,
  getEmployeePayslips,
  formatPayslipData,
  getPayslipStatusColor,
  getPayslipStatusLabel
}; 