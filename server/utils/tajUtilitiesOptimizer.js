/**
 * Centralized Optimization Utility for Taj Utilities & Charges Module
 * Provides caching, parallel queries, and optimized data processing
 */

// In-memory cache store for all overview endpoints
const cacheStore = new Map();

/**
 * Get cached data for a specific cache key
 * @param {string} cacheKey - Unique identifier for the cache entry
 * @param {number} ttl - Time to live in milliseconds (default: 30000 = 30 seconds)
 * @returns {any|null} - Cached data or null if expired/not found
 */
const getCached = (cacheKey, ttl = 30000) => {
  const cached = cacheStore.get(cacheKey);
  if (cached && cached.timestamp) {
    const age = Date.now() - cached.timestamp;
    if (age < ttl) {
      return cached.data;
    }
    // Cache expired, remove it
    cacheStore.delete(cacheKey);
  }
  return null;
};

/**
 * Set cached data for a specific cache key
 * @param {string} cacheKey - Unique identifier for the cache entry
 * @param {any} data - Data to cache
 */
const setCached = (cacheKey, data) => {
  cacheStore.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
};

/**
 * Clear cached data for a specific cache key
 * @param {string} cacheKey - Unique identifier for the cache entry
 */
const clearCached = (cacheKey) => {
  cacheStore.delete(cacheKey);
};

/**
 * Clear all Taj Utilities caches
 */
const clearAllTajUtilitiesCache = () => {
  const keysToDelete = [];
  cacheStore.forEach((value, key) => {
    if (key.startsWith('taj_utilities_')) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => cacheStore.delete(key));
};

/**
 * Fetch properties with optimized field selection and optional filters
 * @param {string} fields - Space-separated field names to select (optional)
 * @param {object} filters - Filter object with search, status, sector, categoryType (optional)
 * @returns {Promise<Array>} - Array of properties
 */
const fetchProperties = async (fields = null, filters = {}) => {
  const TajProperty = require('../models/tajResidencia/TajProperty');
  const queryFilters = {};
  
  // Apply filters
  if (filters.status) {
    queryFilters.status = filters.status;
  }
  if (filters.sector) {
    queryFilters.sector = filters.sector;
  }
  if (filters.categoryType) {
    queryFilters.categoryType = filters.categoryType;
  }
  if (filters.search) {
    const pattern = new RegExp(filters.search, 'i');
    queryFilters.$or = [
      { propertyName: pattern },
      { ownerName: pattern },
      { plotNumber: pattern },
      { address: pattern },
      { fullAddress: pattern },
      { sector: pattern },
      { propertyCode: pattern },
      { electricityWaterMeterNo: pattern },
      { 'meters.meterNo': pattern }
    ];
  }
  
  const query = TajProperty.find(queryFilters).sort({ srNo: 1 });
  
  if (fields) {
    query.select(fields);
  }
  
  return await query.lean();
};

/**
 * Pre-calculate addresses for all properties (optimization)
 * @param {Array} properties - Array of property objects
 * @returns {Map} - Map of propertyId -> address
 */
const preCalculateAddresses = (properties) => {
  const addressMap = new Map();
  properties.forEach(property => {
    const addr = property.address || property.fullAddress || 
      `${property.plotNumber || ''} ${property.street || ''} ${property.sector || ''}`.trim();
    addressMap.set(property._id.toString(), addr || null);
  });
  return addressMap;
};

/**
 * Collect property identifiers for query building (optimization)
 * @param {Array} properties - Array of property objects
 * @param {Map} addressMap - Pre-calculated address map
 * @returns {Object} - Object with propertyAddresses, plotNumbers, ownerNames arrays
 */
const collectPropertyIdentifiers = (properties, addressMap) => {
  const propertyAddresses = [];
  const plotNumbers = [];
  const ownerNames = [];
  
  properties.forEach(property => {
    const addr = addressMap.get(property._id.toString());
    if (addr && addr.length > 0) {
      propertyAddresses.push(addr);
    }
    if (property.plotNumber && typeof property.plotNumber === 'string' && property.plotNumber.trim().length > 0) {
      plotNumbers.push(property.plotNumber);
    }
    if (property.ownerName && typeof property.ownerName === 'string' && property.ownerName.trim().length > 0) {
      ownerNames.push(property.ownerName);
    }
  });
  
  return { propertyAddresses, plotNumbers, ownerNames };
};

/**
 * Build query conditions for matching charges by property identifiers
 * @param {Object} identifiers - Object with propertyAddresses, plotNumbers, ownerNames
 * @returns {Array} - Array of query conditions for $or
 */
const buildPropertyQueryConditions = ({ propertyAddresses, plotNumbers, ownerNames }) => {
  const conditions = [];
  if (propertyAddresses.length > 0) {
    conditions.push({ address: { $in: propertyAddresses } });
  }
  if (plotNumbers.length > 0) {
    conditions.push({ plotNo: { $in: plotNumbers } });
  }
  if (ownerNames.length > 0) {
    conditions.push({ owner: { $in: ownerNames } });
  }
  return conditions;
};

/**
 * Calculate property statistics in a single pass (optimization)
 * @param {Array} properties - Array of property objects
 * @returns {Object} - Object with totalProperties, totalActiveProperties, etc.
 */
const calculatePropertyStats = (properties) => {
  let totalProperties = properties.length;
  let totalActiveProperties = 0;
  let totalPendingProperties = 0;
  let totalCompletedProperties = 0;
  
  properties.forEach(p => {
    const status = (p.status || '').toLowerCase();
    if (status === 'active') totalActiveProperties++;
    else if (status === 'pending') totalPendingProperties++;
    else if (status === 'completed') totalCompletedProperties++;
  });
  
  return {
    totalProperties,
    totalActiveProperties,
    totalPendingProperties,
    totalCompletedProperties
  };
};

/**
 * Create a middleware function for cache checking
 * @param {string} cacheKey - Unique cache key for this endpoint
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Function} - Express middleware function
 */
const cacheMiddleware = (cacheKey, ttl = 30000) => {
  return (req, res, next) => {
    const cached = getCached(cacheKey, ttl);
    if (cached) {
      return res.json(cached);
    }
    // Attach cache functions to request for use in route handler
    req.cacheKey = cacheKey;
    req.setCache = (data) => setCached(cacheKey, data);
    next();
  };
};

/**
 * Optimize payment calculations (single pass)
 * @param {Array} charges - Array of charge objects with payments
 * @param {Function} getAmount - Function to get amount from charge
 * @param {Function} getArrears - Function to get arrears from charge
 * @returns {Object} - Object with allPayments, totalPaid, totalAmount, totalArrears, paymentStatus
 */
const calculatePayments = (charges, getAmount = (c) => c.amount || 0, getArrears = (c) => c.arrears || 0) => {
  const allPayments = [];
  let totalPaid = 0;
  let totalAmount = 0;
  let totalArrears = 0;
  
  charges.forEach(charge => {
    const amount = getAmount(charge);
    const arrears = getArrears(charge);
    totalAmount += amount;
    totalArrears += arrears;
    
    if (charge.payments && charge.payments.length > 0) {
      charge.payments.forEach(payment => {
        const paymentAmount = payment.totalAmount || payment.amount || 0;
        totalPaid += paymentAmount;
        allPayments.push({
          ...payment,
          chargeId: charge._id,
          chargeInvoiceNumber: charge.invoiceNumber
        });
      });
    }
  });
  
  const totalCAMAmount = totalAmount + totalArrears;
  let paymentStatus = 'unpaid';
  if (totalPaid >= totalCAMAmount && totalCAMAmount > 0) {
    paymentStatus = 'paid';
  } else if (totalPaid > 0) {
    paymentStatus = 'partial_paid';
  }
  
  // Set status on payments if needed
  if (allPayments.length > 0 && paymentStatus !== 'unpaid') {
    allPayments.forEach(payment => {
      payment.status = paymentStatus;
    });
  }
  
  return {
    allPayments,
    totalPaid,
    totalAmount,
    totalArrears,
    paymentStatus
  };
};

module.exports = {
  // Cache functions
  getCached,
  setCached,
  clearCached,
  clearAllTajUtilitiesCache,
  
  // Property utilities
  fetchProperties,
  preCalculateAddresses,
  collectPropertyIdentifiers,
  buildPropertyQueryConditions,
  calculatePropertyStats,
  
  // Middleware
  cacheMiddleware,
  
  // Payment calculations
  calculatePayments,
  
  // Cache keys constants
  CACHE_KEYS: {
    CAM_CHARGES_OVERVIEW: 'taj_utilities_cam_charges_overview',
    ELECTRICITY_OVERVIEW: 'taj_utilities_electricity_overview',
    PROPERTIES_LIST: 'taj_utilities_properties_list',
    RESIDENTS_LIST: 'taj_utilities_residents_list',
    RENTAL_PROPERTIES: 'taj_utilities_rental_properties',
    RENTAL_MANAGEMENT_PROPERTIES: 'taj_utilities_rental_management_properties',
    RENTAL_MANAGEMENT_PROPERTIES_LIST: 'taj_utilities_rental_management_properties_list',
    RENTAL_AGREEMENTS_LIST: 'taj_utilities_rental_agreements_list',
    UNASSIGNED_PROPERTIES: 'taj_utilities_unassigned_properties',
    INVOICES_OVERVIEW: 'taj_utilities_invoices_overview',
  }
};

