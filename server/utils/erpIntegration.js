const axios = require('axios');

const erpCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches the Customer Account Statement from the external ERP database.
 * @param {string|number} orderCode 
 * @returns {Promise<Object>} An object containing the mapped fields or null if failed.
 */
async function fetchStatementFromERP(orderCode) {
  if (!orderCode) return null;

  const now = Date.now();
  const cached = erpCache.get(orderCode);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await axios.post(
      'http://erp.taj-residencia.com/api/v1/db/default.aspx',
      {
        db: 'IERP',
        procedure: 'SP_RPT_CustomerAccountStatement',
        isWrite: false,
        parameters: { OrderCode: parseInt(orderCode, 10) || orderCode }
      },
      {
        headers: {
          'X-API-Key': 'tovus_sec_key_2026_dfdsalsdfjhf23423h324h234kj234lkjhH434',
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 seconds timeout
      }
    );

    const data = response.data;
    const records = data.Data || data.data; // Handle PascalCase or camelCase
    
    if (records && Array.isArray(records) && records.length > 0) {
      // The statement returns an array of records (one per installment typically).
      // The aggregate fields (SalePrice, TotalReceived, CurrentPayable) are the same on all rows.
      const row = records[0];
      const result = {
        salePrice: Number(row.SalePrice) || 0,
        received: Number(row.TotalReceived) || 0,
        currentlyDue: Number(row.CurrentPayable) || 0
      };
      erpCache.set(orderCode, { data: result, timestamp: now });
      return result;
    }
    erpCache.set(orderCode, { data: null, timestamp: now });
    return null;
  } catch (error) {
    // console.error(`Error fetching ERP statement for OrderCode ${orderCode}:`, error.message);
    return null; // Return null so we can fallback to the local DB values if the API fails
  }
}

/**
 * Decorates an array of recovery assignments with live data from the ERP.
 * It maps over the rows concurrently.
 * @param {Array} rows 
 * @returns {Promise<Array>} The rows array with updated financial fields.
 */
async function decorateWithERPData(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const decoratedRows = [];
  const chunkSize = 20;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(async (row) => {
        const liveData = await fetchStatementFromERP(row.orderCode);
        if (liveData) {
          return {
            ...row,
            salePrice: liveData.salePrice !== undefined ? liveData.salePrice : row.salePrice,
            received: liveData.received !== undefined ? liveData.received : row.received,
            currentlyDue: liveData.currentlyDue !== undefined ? liveData.currentlyDue : row.currentlyDue,
            _erpDataFetched: true // flag to indicate data is live
          };
        }
        return row; // Fallback to local DB values
      })
    );
    decoratedRows.push(...chunkResults);
  }

  return decoratedRows;
}

module.exports = {
  fetchStatementFromERP,
  decorateWithERPData
};
