// Utility function for formatting Pakistani Rupees (PKR)
export const formatPKR = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₨0';
  }
  
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Format PKR with decimal places for precise amounts
export const formatPKRWithDecimals = (amount, decimals = 2) => {
  if (amount === null || amount === undefined) {
    return '₨0.00';
  }
  
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(amount);
};

// Format large amounts with K, M, B suffixes
export const formatPKRCompact = (amount) => {
  if (amount === null || amount === undefined) {
    return '₨0';
  }
  
  if (amount >= 1000000000) {
    return `₨${(amount / 1000000000).toFixed(1)}B`;
  } else if (amount >= 1000000) {
    return `₨${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `₨${(amount / 1000).toFixed(1)}K`;
  } else {
    return formatPKR(amount);
  }
};

// Parse PKR string back to number
export const parsePKR = (currencyString) => {
  if (!currencyString) return 0;
  
  // Remove currency symbol and commas
  const cleanString = currencyString.replace(/[₨,\s]/g, '');
  return parseFloat(cleanString) || 0;
};

// Default export for backward compatibility
export default formatPKR; 