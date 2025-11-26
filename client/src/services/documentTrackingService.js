import api from './api';

/**
 * Document Tracking Service
 * Handles all API calls related to document tracking
 */

// ==================== DOCUMENT MASTER OPERATIONS ====================

/**
 * Get all documents with filters and pagination
 * @param {Object} filters - Filter options (page, limit, status, category, search, department, owner, currentHolder)
 * @returns {Promise} API response with documents and pagination
 */
export const getDocuments = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.status) params.append('status', filters.status);
  if (filters.category) params.append('category', filters.category);
  if (filters.search) params.append('search', filters.search);
  if (filters.department) params.append('department', filters.department);
  if (filters.owner) params.append('owner', filters.owner);
  if (filters.currentHolder) params.append('currentHolder', filters.currentHolder);

  const response = await api.get(`/document-tracking?${params.toString()}`);
  return response.data;
};

/**
 * Get single document by ID
 * @param {string} id - Document ID
 * @returns {Promise} API response with document details
 */
export const getDocument = async (id) => {
  const response = await api.get(`/document-tracking/${id}`);
  return response.data;
};

/**
 * Create new document
 * @param {Object} documentData - Document data
 * @returns {Promise} API response with created document
 */
export const createDocument = async (documentData) => {
  const response = await api.post('/document-tracking', documentData);
  return response.data;
};

/**
 * Update document
 * @param {string} id - Document ID
 * @param {Object} documentData - Updated document data
 * @returns {Promise} API response with updated document
 */
export const updateDocument = async (id, documentData) => {
  const response = await api.put(`/document-tracking/${id}`, documentData);
  return response.data;
};

/**
 * Delete document (soft delete)
 * @param {string} id - Document ID
 * @returns {Promise} API response
 */
export const deleteDocument = async (id) => {
  const response = await api.delete(`/document-tracking/${id}`);
  return response.data;
};

// ==================== DOCUMENT MOVEMENT OPERATIONS ====================

/**
 * Get document timeline (movement history)
 * @param {string} id - Document ID
 * @returns {Promise} API response with document and movement history
 */
export const getDocumentTimeline = async (id) => {
  const response = await api.get(`/document-tracking/${id}/timeline`);
  return response.data;
};

/**
 * Move document to another user/department
 * @param {string} id - Document ID
 * @param {Object} movementData - Movement data (toUser, toDepartment, reason, comments, statusAfter)
 * @returns {Promise} API response with updated document and movement record
 */
export const moveDocument = async (id, movementData) => {
  const response = await api.post(`/document-tracking/${id}/move`, movementData);
  return response.data;
};

/**
 * Acknowledge receipt of document
 * @param {string} id - Document ID
 * @returns {Promise} API response
 */
export const acknowledgeReceipt = async (id) => {
  const response = await api.post(`/document-tracking/${id}/receive`);
  return response.data;
};

/**
 * Get pending movements for current user
 * @returns {Promise} API response with pending movements
 */
export const getPendingMovements = async () => {
  const response = await api.get('/document-tracking/movements/pending');
  return response.data;
};

/**
 * Get all movements for current user
 * @param {Object} options - Options (limit)
 * @returns {Promise} API response with movements
 */
export const getMyMovements = async (options = {}) => {
  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit);

  const response = await api.get(`/document-tracking/movements/my-movements?${params.toString()}`);
  return response.data;
};

// ==================== DASHBOARD OPERATIONS ====================

/**
 * Get dashboard statistics
 * @returns {Promise} API response with statistics
 */
export const getDashboardStats = async () => {
  const response = await api.get('/document-tracking/dashboard/stats');
  return response.data;
};

// ==================== QR CODE OPERATIONS ====================

/**
 * Get QR code image URL
 * @param {string} id - Document ID
 * @returns {string} QR code image URL
 */
export const getQRCodeUrl = (id) => {
  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
  return `${baseUrl}/api/document-tracking/${id}/qr-code`;
};

/**
 * Download QR code
 * @param {string} id - Document ID
 * @returns {Promise} Blob response
 */
export const downloadQRCode = async (id) => {
  const response = await api.get(`/document-tracking/${id}/qr-code/download`, {
    responseType: 'blob'
  });
  return response.data;
};

// ==================== EXPORT OPERATIONS ====================

/**
 * Export documents to CSV
 * @param {Object} filters - Filter options
 * @returns {Promise} Blob response
 */
export const exportToCSV = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.category) params.append('category', filters.category);
  if (filters.department) params.append('department', filters.department);

  const response = await api.get(`/document-tracking/export/csv?${params.toString()}`, {
    responseType: 'blob'
  });
  return response.data;
};

export default {
  getDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  getDocumentTimeline,
  moveDocument,
  acknowledgeReceipt,
  getPendingMovements,
  getMyMovements,
  getDashboardStats
};

