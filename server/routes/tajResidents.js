const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const TajResident = require('../models/tajResidencia/TajResident');
const TajTransaction = require('../models/tajResidencia/TajTransaction');
const TajProperty = require('../models/tajResidencia/TajProperty');
const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');
const { authMiddleware } = require('../middleware/auth');
const asyncHandler = require('../middleware/errorHandler').asyncHandler;
const {
  getCached,
  setCached,
  clearCached,
  CACHE_KEYS
} = require('../utils/tajUtilitiesOptimizer');

// Get all residents
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  // Extract pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;
  
  // OPTIMIZATION: Check cache first (only if no filters/search and default pagination)
  const hasFilters = req.query.search || req.query.accountType || req.query.isActive !== undefined;
  const isDefaultPagination = page === 1 && limit === 50;
  const cacheKey = (hasFilters || !isDefaultPagination) ? null : CACHE_KEYS.RESIDENTS_LIST;
  
  if (cacheKey) {
    const cached = getCached(cacheKey);
    if (cached) {
      console.log('📋 Returning cached residents list');
      return res.json(cached);
    }
  }
  
  const { search, accountType, isActive } = req.query;
  const query = {};

  if (search) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { cnic: new RegExp(search, 'i') },
      { contactNumber: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') }
    ];
  }

  if (accountType) query.accountType = accountType;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  // Get total count for pagination
  const total = await TajResident.countDocuments(query);

  // OPTIMIZATION: Select only needed fields and use lean with pagination
  let residents = await TajResident.find(query)
    .select('_id residentId name cnic contactNumber email accountType isActive properties balance createdBy updatedBy createdAt updatedAt')
    .populate('properties', 'propertyName plotNumber sector block fullAddress ownerName meters')
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName')
    .sort({ name: 1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Lightweight: Populate missing residentIds for existing records
  const residentsWithoutId = residents.filter(r => !r.residentId);
  if (residentsWithoutId.length > 0) {
    const allResidents = await TajResident.find({}, { residentId: 1 }).lean();
    let highestId = 0;
    allResidents.forEach(res => {
      if (res.residentId) {
        const numericId = parseInt(res.residentId.replace(/^0+/, ''));
        if (!isNaN(numericId) && numericId > highestId) {
          highestId = numericId;
        }
      }
    });
    
    // Update missing IDs synchronously for current response
    for (const resident of residentsWithoutId) {
      try {
        highestId++;
        const residentId = highestId.toString().padStart(5, '0');
        await TajResident.findByIdAndUpdate(resident._id, { residentId }, { new: false });
        resident.residentId = residentId;
      } catch (error) {
        console.error(`Error updating resident ID for ${resident._id}:`, error);
      }
    }
  }

  // Calculate property count and total remaining deposits for each resident
  const residentIds = residents.map(r => r._id);
  
  // Get all deposits for these residents
  const allDeposits = await TajTransaction.find({
    resident: { $in: residentIds },
    transactionType: 'deposit'
  }).select('resident amount _id').lean();
  
  // Get all deposit usages from bill_payment transactions
  const depositIds = allDeposits.map(d => d._id);
  const depositUsageMap = {};
  
  if (depositIds.length > 0) {
    const usedInPayments = await TajTransaction.find({
      'depositUsages.depositId': { $in: depositIds },
      transactionType: 'bill_payment'
    }).select('depositUsages').lean();
    
    usedInPayments.forEach(payment => {
      if (payment.depositUsages && Array.isArray(payment.depositUsages)) {
        payment.depositUsages.forEach(usage => {
          const depositId = usage.depositId?.toString();
          if (depositId) {
            depositUsageMap[depositId] = (depositUsageMap[depositId] || 0) + (usage.amount || 0);
          }
        });
      }
    });
  }
  
  // Calculate remaining deposits per resident
  const remainingDepositsByResident = {};
  allDeposits.forEach(deposit => {
    const residentId = deposit.resident.toString();
    const depositId = deposit._id.toString();
    const totalUsed = depositUsageMap[depositId] || 0;
    const remaining = Math.max(0, (deposit.amount || 0) - totalUsed);
    
    if (!remainingDepositsByResident[residentId]) {
      remainingDepositsByResident[residentId] = 0;
    }
    remainingDepositsByResident[residentId] += remaining;
  });
  
  // Calculate property count and add remaining deposits balance
  const residentsWithCount = residents.map(resident => {
    resident.propertyCount = resident.properties ? resident.properties.length : 0;
    // Add total remaining deposits as the balance
    resident.totalRemainingDeposits = remainingDepositsByResident[resident._id.toString()] || 0;
    return resident;
  });

  const totalPages = Math.ceil(total / limit);
  const response = { 
    success: true, 
    data: residentsWithCount,
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  };
  
  // OPTIMIZATION: Cache response if no filters and default pagination
  if (cacheKey) {
    setCached(cacheKey, response);
  }
  
  res.json(response);
}));

// Get unassigned properties (MUST come before /:id route)
router.get('/unassigned-properties', authMiddleware, asyncHandler(async (req, res) => {
  // OPTIMIZATION: Check cache first (only if no filters/search)
  const hasFilters = req.query.search || req.query.includeAssigned === 'true';
  const cacheKey = hasFilters ? null : CACHE_KEYS.UNASSIGNED_PROPERTIES;
  
  if (cacheKey) {
    const cached = getCached(cacheKey);
    if (cached) {
      console.log('📋 Returning cached unassigned properties');
      return res.json(cached);
    }
  }
  
  const { search, includeAssigned } = req.query;
  const query = {};

  // If includeAssigned is not true, only show unassigned properties
  if (includeAssigned !== 'true') {
    query.$or = [
      { resident: null },
      { resident: { $exists: false } }
    ];
  }

  if (search) {
    const searchRegex = new RegExp(search.trim(), 'i');
    const searchConditions = [
      { propertyName: searchRegex },
      { plotNumber: searchRegex },
      { sector: searchRegex },
      { block: searchRegex },
      { ownerName: searchRegex },
      { fullAddress: searchRegex },
      { rdaNumber: searchRegex },
      { street: searchRegex },
      { project: searchRegex }
    ];

    // If search is a number, also search by srNo
    if (!isNaN(search.trim()) && search.trim() !== '') {
      const srNoValue = parseInt(search.trim());
      if (!isNaN(srNoValue)) {
        searchConditions.push({ srNo: srNoValue });
      }
    }

    if (includeAssigned === 'true') {
      // If including assigned, just add search conditions
      query.$or = searchConditions;
    } else {
      // If only unassigned, combine with existing query
      query.$and = [
        {
          $or: searchConditions
        }
      ];
    }
  }

  // OPTIMIZATION: Use lean for better performance
  const properties = await TajProperty.find(query)
    .select('propertyName plotNumber sector block fullAddress ownerName contactNumber rdaNumber street project srNo resident meters')
    .populate('resident', 'name')
    .sort({ propertyName: 1 })
    .limit(200)
    .lean();

  const response = { success: true, data: properties };
  
  // OPTIMIZATION: Cache response if no filters
  if (cacheKey) {
    setCached(cacheKey, response);
  }
  
  res.json(response);
}));

// Get resident by ID
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const resident = await TajResident.findById(req.params.id)
    .populate('properties', 'propertyName plotNumber sector block fullAddress ownerName meters')
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName');

  if (!resident) {
    return res.status(404).json({ success: false, message: 'Resident not found' });
  }

  const residentObj = resident.toObject();
  residentObj.propertyCount = resident.properties ? resident.properties.length : 0;

  res.json({ success: true, data: residentObj });
}));

// Create resident
router.post(
  '/',
  authMiddleware,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('accountType').optional().isIn(['Resident', 'Property Dealer', 'Other']),
    body('balance').optional().isFloat({ min: 0 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const initialBalance = parseFloat(req.body.balance) || 0;
    
    // Set balance to 0 initially, will be updated if deposit is created
    const residentData = {
      ...req.body,
      balance: 0, // Start with 0, will be updated by deposit transaction
      createdBy: req.user.id
    };
    
    // Normalize email to lowercase
    if (residentData.email) {
      residentData.email = residentData.email.toLowerCase().trim();
    }

    const resident = new TajResident(residentData);
    await resident.save();

    // If initial balance is provided, create a deposit transaction
    if (initialBalance > 0) {
      const balanceBefore = 0;
      const balanceAfter = initialBalance;

      // Update resident balance
      resident.balance = balanceAfter;
      await resident.save();

      // Create deposit transaction (same as deposit endpoint)
      const transaction = new TajTransaction({
        resident: resident._id,
        transactionType: 'deposit',
        amount: initialBalance,
        balanceBefore,
        balanceAfter,
        description: req.body.notes || 'Initial Balance Deposit',
        paymentMethod: 'Cash', // Default payment method for initial balance
        createdBy: req.user.id
      });
      await transaction.save();
    }

    clearCached(CACHE_KEYS.RESIDENTS_LIST); // Invalidate cache on creation
    clearCached(CACHE_KEYS.UNASSIGNED_PROPERTIES); // Also invalidate unassigned properties cache

    await resident.populate('properties', 'propertyName plotNumber sector block fullAddress ownerName');
    await resident.populate('createdBy', 'firstName lastName');

    const residentObj = resident.toObject();
    residentObj.propertyCount = resident.properties ? resident.properties.length : 0;

    res.status(201).json({ success: true, data: residentObj });
  })
);

// Update resident
router.put('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const resident = await TajResident.findById(req.params.id);

  if (!resident) {
    return res.status(404).json({ success: false, message: 'Resident not found' });
  }

  // Normalize email to lowercase if provided
  if (req.body.email) {
    req.body.email = req.body.email.toLowerCase().trim();
  }

  Object.assign(resident, req.body);
  resident.updatedBy = req.user.id;
  await resident.save();

  await resident.populate('properties', 'propertyName plotNumber sector block fullAddress ownerName');
  await resident.populate('updatedBy', 'firstName lastName');

  const residentObj = resident.toObject();
  residentObj.propertyCount = resident.properties ? resident.properties.length : 0;

  clearCached(CACHE_KEYS.RESIDENTS_LIST); // Invalidate cache on update
  clearCached(CACHE_KEYS.UNASSIGNED_PROPERTIES); // Also invalidate unassigned properties cache
  res.json({ success: true, data: residentObj });
}));

// Delete resident (soft delete)
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const resident = await TajResident.findById(req.params.id);

  if (!resident) {
    return res.status(404).json({ success: false, message: 'Resident not found' });
  }

  resident.isActive = false;
  resident.updatedBy = req.user.id;
  await resident.save();

  clearCached(CACHE_KEYS.RESIDENTS_LIST); // Invalidate cache on deletion
  clearCached(CACHE_KEYS.UNASSIGNED_PROPERTIES); // Also invalidate unassigned properties cache
  res.json({ success: true, message: 'Resident deactivated successfully' });
}));

// Get transactions for a resident
router.get('/:id/transactions', authMiddleware, asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, transactionType, startDate, endDate } = req.query;
  const query = { resident: req.params.id };

  if (transactionType) query.transactionType = transactionType;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const transactions = await TajTransaction.find(query)
    .populate('depositUsages.depositId')
    .populate('resident', 'name accountType')
    .populate('targetResident', 'name accountType')
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await TajTransaction.countDocuments(query);

  // Calculate remaining amounts for deposit transactions
  // IMPORTANT: Get ALL deposit transactions for this resident (not just paginated ones)
  // to ensure remainingAmount is calculated correctly for all deposits
  const allDepositTransactions = await TajTransaction.find({
    resident: req.params.id,
    transactionType: 'deposit'
  }).select('_id amount');
  
  const allDepositIds = allDepositTransactions.map(d => d._id);
  
  // Calculate total used from each deposit by checking ALL bill_payment transactions
  const depositUsageMap = {};
  if (allDepositIds.length > 0) {
    const allPayments = await TajTransaction.find({
      resident: req.params.id,
      transactionType: 'bill_payment',
      'depositUsages.depositId': { $in: allDepositIds }
    }).select('depositUsages');
    
    allPayments.forEach(payment => {
      if (payment.depositUsages && Array.isArray(payment.depositUsages)) {
        payment.depositUsages.forEach(usage => {
          // Handle both ObjectId and populated object cases
          let depositId = null;
          if (usage.depositId) {
            // If it's an ObjectId or has _id, convert to string
            depositId = usage.depositId._id ? usage.depositId._id.toString() : usage.depositId.toString();
          }
          if (depositId) {
            if (!depositUsageMap[depositId]) {
              depositUsageMap[depositId] = 0;
            }
            depositUsageMap[depositId] += usage.amount || 0;
          }
        });
      }
    });
  }

  // Populate property information for bill_payment transactions
  const transactionsWithProperty = await Promise.all(transactions.map(async (txn) => {
    const txnObj = txn.toObject();
    
    // Add remaining amount to deposit transactions
    if (txn.transactionType === 'deposit') {
      const depositId = txn._id.toString();
      const totalUsed = depositUsageMap[depositId] || 0;
      txnObj.remainingAmount = Math.max(0, (txn.amount || 0) - totalUsed);
      txnObj.totalUsed = totalUsed;
    }
    
    // Populate property information for bill_payment transactions
    if (txn.transactionType === 'bill_payment' && txn.referenceId) {
      try {
        const invoice = await PropertyInvoice.findById(txn.referenceId)
          .populate('property', 'propertyName propertyType srNo');
        if (invoice && invoice.property) {
          txnObj.property = {
            _id: invoice.property._id,
            propertyName: invoice.property.propertyName,
            propertyType: invoice.property.propertyType,
            srNo: invoice.property.srNo
          };
        }
      } catch (error) {
        // If invoice not found or error, property will remain undefined
        console.error('Error populating property for transaction:', error);
      }
    }
    
    // Populate bank information for bill_payment transactions
    // If bank is not directly set, try to get it from deposit transactions
    if (txn.transactionType === 'bill_payment' && !txnObj.bank) {
      if (txn.depositUsages && Array.isArray(txn.depositUsages) && txn.depositUsages.length > 0) {
        // Get bank from the first deposit (deposits are already populated)
        const firstDeposit = txn.depositUsages[0]?.depositId;
        if (firstDeposit && firstDeposit.bank) {
          txnObj.bank = firstDeposit.bank;
        }
      }
    }
    
    return txnObj;
  }));

  res.json({
    success: true,
    data: {
      transactions: transactionsWithProperty,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    }
  });
}));

// Deposit money
router.post(
  '/:id/deposit',
  authMiddleware,
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('description').optional().trim(),
    body('paymentMethod').optional().isIn(['Cash', 'Bank Transfer', 'Cheque', 'Online', 'Other']),
    body('referenceNumberExternal').notEmpty().withMessage('Transaction Number is required').trim()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const resident = await TajResident.findById(req.params.id);
    if (!resident) {
      return res.status(404).json({ success: false, message: 'Resident not found' });
    }

    const { amount, description, paymentMethod, bank, referenceNumberExternal } = req.body;
    const amountNum = parseFloat(amount) || 0;
    if (amountNum <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }
    
    // Validate bank is provided for bank-related payment methods
    if ((paymentMethod === 'Bank Transfer' || paymentMethod === 'Cheque' || paymentMethod === 'Online') && !bank) {
      return res.status(400).json({ success: false, message: 'Bank selection is required for this payment method' });
    }
    
    const balanceBefore = resident.balance || 0;
    const balanceAfter = balanceBefore + amountNum;

    // Update resident balance
    resident.balance = balanceAfter;
    resident.updatedBy = req.user.id;
    await resident.save();

    // Create transaction record
    const transaction = new TajTransaction({
      resident: resident._id,
      transactionType: 'deposit',
      amount: amountNum,
      balanceBefore,
      balanceAfter,
      description: description || 'Deposit',
      paymentMethod,
      bank: bank || null,
      referenceNumberExternal,
      createdBy: req.user.id
    });
    await transaction.save();

    await transaction.populate('resident', 'name accountType');
    await transaction.populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Deposit successful',
      data: {
        transaction,
        newBalance: balanceAfter
      }
    });
  })
);

// Update deposit transaction
router.put(
  '/:id/transactions/:transactionId',
  authMiddleware,
  [
    body('amount').optional().isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('description').optional().trim(),
    body('paymentMethod').optional().isIn(['Cash', 'Bank Transfer', 'Cheque', 'Online', 'Other']),
    body('referenceNumberExternal').optional().trim()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const resident = await TajResident.findById(req.params.id);
    if (!resident) {
      return res.status(404).json({ success: false, message: 'Resident not found' });
    }

    const transaction = await TajTransaction.findById(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Only allow editing deposit transactions
    if (transaction.transactionType !== 'deposit') {
      return res.status(400).json({ success: false, message: 'Only deposit transactions can be edited' });
    }

    // Check if transaction belongs to this resident
    if (transaction.resident.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Transaction does not belong to this resident' });
    }

    const { amount, description, paymentMethod, bank, referenceNumberExternal } = req.body;
    const oldAmount = transaction.amount;
    const amountChanged = amount !== undefined && parseFloat(amount) !== oldAmount;

    // If amount is being changed, check if deposit has been used
    if (amountChanged) {
      const newAmount = parseFloat(amount) || 0;
      if (newAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
      }

      // Check if this deposit has been used in any payments
      const usedInPayments = await TajTransaction.find({
        'depositUsages.depositId': transaction._id
      });

      if (usedInPayments.length > 0) {
        // Calculate total amount used from this deposit
        const totalUsed = usedInPayments.reduce((sum, payment) => {
          const depositUsage = payment.depositUsages.find(du => du.depositId.toString() === transaction._id.toString());
          return sum + (depositUsage ? depositUsage.amount : 0);
        }, 0);

        // If reducing amount, ensure new amount is at least equal to total used
        if (newAmount < totalUsed) {
          return res.status(400).json({
            success: false,
            message: `Cannot reduce deposit amount below total used amount (${totalUsed.toFixed(2)}). Deposit has been used in ${usedInPayments.length} payment(s).`
          });
        }
      }

      // Recalculate resident balance
      const balanceDifference = newAmount - oldAmount;
      resident.balance = (resident.balance || 0) + balanceDifference;
      resident.updatedBy = req.user.id;
      await resident.save();

      // Update transaction amount and balance
      transaction.amount = newAmount;
      transaction.balanceAfter = resident.balance;
    }

    // Update other fields
    if (description !== undefined) transaction.description = description;
    if (paymentMethod !== undefined) transaction.paymentMethod = paymentMethod;
    if (bank !== undefined) transaction.bank = bank;
    if (referenceNumberExternal !== undefined) transaction.referenceNumberExternal = referenceNumberExternal;

    // Validate bank is provided for bank-related payment methods
    if ((transaction.paymentMethod === 'Bank Transfer' || transaction.paymentMethod === 'Cheque' || transaction.paymentMethod === 'Online') && !transaction.bank) {
      return res.status(400).json({ success: false, message: 'Bank selection is required for this payment method' });
    }

    await transaction.save();

    await transaction.populate('resident', 'name accountType');
    await transaction.populate('createdBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Deposit updated successfully',
      data: {
        transaction,
        newBalance: resident.balance
      }
    });
  })
);

// Delete deposit transaction
router.delete(
  '/:id/transactions/:transactionId',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const resident = await TajResident.findById(req.params.id);
    if (!resident) {
      return res.status(404).json({ success: false, message: 'Resident not found' });
    }

    const transaction = await TajTransaction.findById(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Only allow deleting deposit transactions
    if (transaction.transactionType !== 'deposit') {
      return res.status(400).json({ success: false, message: 'Only deposit transactions can be deleted' });
    }

    // Check if transaction belongs to this resident
    if (transaction.resident.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Transaction does not belong to this resident' });
    }

    // Check if this deposit has been used in any payments
    const usedInPayments = await TajTransaction.find({
      'depositUsages.depositId': transaction._id
    });

    if (usedInPayments.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete deposit that has been used in ${usedInPayments.length} payment(s). Please remove the payments first.`
      });
    }

    // Recalculate resident balance (subtract the deposit amount)
    const depositAmount = transaction.amount || 0;
    resident.balance = Math.max(0, (resident.balance || 0) - depositAmount);
    resident.updatedBy = req.user.id;
    await resident.save();

    // Delete the transaction
    await TajTransaction.findByIdAndDelete(transaction._id);

    res.json({
      success: true,
      message: 'Deposit deleted successfully',
      data: {
        newBalance: resident.balance
      }
    });
  })
);

// Transfer money to another resident
router.post(
  '/:id/transfer',
  authMiddleware,
  [
    body('targetResidentId').notEmpty().withMessage('Target resident ID is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('description').optional().trim()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { targetResidentId, amount, description } = req.body;
    const amountNum = parseFloat(amount) || 0;
    if (amountNum <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }

    if (req.params.id === targetResidentId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer to the same account'
      });
    }

    const sourceResident = await TajResident.findById(req.params.id);
    const targetResident = await TajResident.findById(targetResidentId);

    if (!sourceResident) {
      return res.status(404).json({ success: false, message: 'Source resident not found' });
    }
    if (!targetResident) {
      return res.status(404).json({ success: false, message: 'Target resident not found' });
    }

    const sourceBalanceBefore = sourceResident.balance || 0;
    if (sourceBalanceBefore < amountNum) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Update source resident balance
    const sourceBalanceAfter = sourceBalanceBefore - amountNum;
    sourceResident.balance = sourceBalanceAfter;
    sourceResident.updatedBy = req.user.id;
    await sourceResident.save();

    // Update target resident balance
    const targetBalanceBefore = targetResident.balance || 0;
    const targetBalanceAfter = targetBalanceBefore + amountNum;
    targetResident.balance = targetBalanceAfter;
    targetResident.updatedBy = req.user.id;
    await targetResident.save();

    // Create transaction records (one for source, one for target)
    const sourceTransaction = new TajTransaction({
      resident: sourceResident._id,
      transactionType: 'transfer',
      amount: amountNum,
      targetResident: targetResident._id,
      balanceBefore: sourceBalanceBefore,
      balanceAfter: sourceBalanceAfter,
      description: description || `Transfer to ${targetResident.name}`,
      createdBy: req.user.id
    });
    await sourceTransaction.save();

    const targetTransaction = new TajTransaction({
      resident: targetResident._id,
      transactionType: 'transfer',
      amount: amountNum,
      targetResident: sourceResident._id,
      balanceBefore: targetBalanceBefore,
      balanceAfter: targetBalanceAfter,
      description: description || `Transfer from ${sourceResident.name}`,
      createdBy: req.user.id
    });
    await targetTransaction.save();

    await sourceTransaction.populate('resident', 'name accountType');
    await sourceTransaction.populate('targetResident', 'name accountType');
    await sourceTransaction.populate('createdBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Transfer successful',
      data: {
        transaction: sourceTransaction,
        newBalance: sourceBalanceAfter
      }
    });
  })
);

// Assign properties to resident
router.post(
  '/:id/assign-properties',
  authMiddleware,
  [
    body('propertyIds').isArray().withMessage('Property IDs must be an array'),
    body('propertyIds.*').isMongoId().withMessage('Invalid property ID')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const resident = await TajResident.findById(req.params.id);
    if (!resident) {
      return res.status(404).json({ success: false, message: 'Resident not found' });
    }

    const { propertyIds } = req.body;

    // Verify all properties exist
    const properties = await TajProperty.find({ _id: { $in: propertyIds } });
    if (properties.length !== propertyIds.length) {
      return res.status(400).json({ success: false, message: 'One or more properties not found' });
    }

    // Get current property assignments to handle reassignment
    const propertiesToAssign = await TajProperty.find({ _id: { $in: propertyIds } });
    const propertiesToReassign = propertiesToAssign.filter(p => p.resident && p.resident.toString() !== resident._id.toString());
    
    // Remove properties from previous residents (if any)
    if (propertiesToReassign.length > 0) {
      const previousResidentIds = [...new Set(propertiesToReassign.map(p => p.resident.toString()))];
      for (const prevResidentId of previousResidentIds) {
        const prevResident = await TajResident.findById(prevResidentId);
        if (prevResident) {
          const reassignedPropertyIds = propertiesToReassign
            .filter(p => p.resident.toString() === prevResidentId)
            .map(p => p._id.toString());
          prevResident.properties = prevResident.properties.filter(
            p => !reassignedPropertyIds.includes(p.toString())
          );
          prevResident.updatedBy = req.user.id;
          await prevResident.save();
        }
      }
    }

    // Add properties to this resident (avoid duplicates)
    const existingPropertyIds = resident.properties.map(p => p.toString());
    // Ensure propertyIds are strings for comparison
    const propertyIdsStr = propertyIds.map(id => id.toString());
    const newPropertyIds = propertyIdsStr.filter(id => !existingPropertyIds.includes(id));
    
    if (newPropertyIds.length > 0) {
      // Convert back to ObjectIds for storage
      const mongoose = require('mongoose');
      const newPropertyObjectIds = newPropertyIds.map(id => new mongoose.Types.ObjectId(id));
      resident.properties.push(...newPropertyObjectIds);
      resident.updatedBy = req.user.id;
      await resident.save();
    }

    // Update all properties to reference this resident (handles both new assignments and reassignments)
    await TajProperty.updateMany(
      { _id: { $in: propertyIds } },
      { $set: { resident: resident._id } }
    );

    await resident.populate('properties', 'propertyName plotNumber sector block fullAddress ownerName');
    const residentObj = resident.toObject();
    residentObj.propertyCount = resident.properties ? resident.properties.length : 0;

    res.json({
      success: true,
      message: `${newPropertyIds.length} property/properties assigned successfully`,
      data: residentObj
    });
  })
);

// Unassign properties from resident
router.post(
  '/:id/unassign-properties',
  authMiddleware,
  [
    body('propertyIds').isArray().withMessage('Property IDs must be an array'),
    body('propertyIds.*').isMongoId().withMessage('Invalid property ID')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const resident = await TajResident.findById(req.params.id);
    if (!resident) {
      return res.status(404).json({ success: false, message: 'Resident not found' });
    }

    const { propertyIds } = req.body;

    // Remove properties from resident
    resident.properties = resident.properties.filter(
      p => !propertyIds.includes(p.toString())
    );
    resident.updatedBy = req.user.id;
    await resident.save();

    // Update properties to remove resident reference
    await TajProperty.updateMany(
      { _id: { $in: propertyIds } },
      { $set: { resident: null } }
    );

    await resident.populate('properties', 'propertyName plotNumber sector block fullAddress ownerName');
    const residentObj = resident.toObject();
    residentObj.propertyCount = resident.properties ? resident.properties.length : 0;

    res.json({
      success: true,
      message: `${propertyIds.length} property/properties unassigned successfully`,
      data: residentObj
    });
  })
);

// Auto-match properties by owner name
router.post(
  '/:id/auto-match-properties',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const resident = await TajResident.findById(req.params.id);
    if (!resident) {
      return res.status(404).json({ success: false, message: 'Resident not found' });
    }

    if (!resident.name) {
      return res.status(400).json({ success: false, message: 'Resident name is required for auto-matching' });
    }

    // Find properties with matching ownerName (case-insensitive, partial match)
    const nameRegex = new RegExp(resident.name.trim(), 'i');
    const matchedProperties = await TajProperty.find({
      ownerName: nameRegex,
      resident: { $in: [null, undefined] } // Only unassigned properties
    });

    if (matchedProperties.length === 0) {
      return res.json({
        success: true,
        message: 'No matching unassigned properties found',
        data: { matchedCount: 0, properties: [] }
      });
    }

    const propertyIds = matchedProperties.map(p => p._id);

    // Add properties to resident
    const existingPropertyIds = resident.properties.map(p => p.toString());
    const newPropertyIds = propertyIds.filter(id => !existingPropertyIds.includes(id.toString()));
    
    if (newPropertyIds.length > 0) {
      resident.properties.push(...newPropertyIds);
      resident.updatedBy = req.user.id;
      await resident.save();

      // Update properties to reference this resident
      await TajProperty.updateMany(
        { _id: { $in: newPropertyIds } },
        { $set: { resident: resident._id } }
      );
    }

    await resident.populate('properties', 'propertyName plotNumber sector block fullAddress ownerName');
    const residentObj = resident.toObject();
    residentObj.propertyCount = resident.properties ? resident.properties.length : 0;

    res.json({
      success: true,
      message: `${newPropertyIds.length} property/properties auto-matched and assigned`,
      data: {
        resident: residentObj,
        matchedProperties: matchedProperties.map(p => ({
          _id: p._id,
          propertyName: p.propertyName,
          plotNumber: p.plotNumber,
          sector: p.sector,
          block: p.block,
          fullAddress: p.fullAddress,
          ownerName: p.ownerName
        }))
      }
    });
  })
);

// Pay bill (generic payment)
router.post(
  '/:id/pay',
  authMiddleware,
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('referenceType').optional().isIn(['CAM', 'Electricity', 'Water', 'RENT', 'ELECTRICITY', 'Other']),
    body('referenceId').optional(),
    body('referenceNumber').optional().trim(),
    body('description').optional().trim(),
    body('paymentMethod').optional().isIn(['Cash', 'Bank Transfer', 'Cheque', 'Online', 'Other']),
    body('bankName').optional().trim(),
    body('bankReference').optional().trim(),
    body('paymentDate').optional().isISO8601().withMessage('Payment date must be a valid date')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const resident = await TajResident.findById(req.params.id);
    if (!resident) {
      return res.status(404).json({ success: false, message: 'Resident not found' });
    }

    const { 
      amount, 
      referenceType, 
      referenceId, 
      referenceNumber, 
      description,
      paymentMethod,
      bankName,
      bankReference,
      paymentDate,
      depositUsages // Array of { depositId, amount } objects
    } = req.body;
    const amountNum = parseFloat(amount) || 0;
    if (amountNum <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }
    
    // Validate bank is provided for bank-related payment methods
    // Exception: If depositUsages are provided, bank is not required (deposit already has bank info)
    if ((paymentMethod === 'Bank Transfer' || paymentMethod === 'Cheque' || paymentMethod === 'Online') && !bankName) {
      const hasDepositUsages = depositUsages && Array.isArray(depositUsages) && depositUsages.length > 0;
      if (!hasDepositUsages) {
        return res.status(400).json({ success: false, message: 'Bank selection is required for this payment method' });
      }
    }
    
    const balanceBefore = resident.balance || 0;

    if (balanceBefore < amountNum) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    const balanceAfter = balanceBefore - amountNum;

    // Update resident balance
    resident.balance = balanceAfter;
    resident.updatedBy = req.user.id;
    await resident.save();

    // Prepare transaction data - only include referenceId if it's a valid ObjectId
    const transactionData = {
      resident: resident._id,
      transactionType: 'bill_payment',
      amount: amountNum,
      balanceBefore,
      balanceAfter,
      description: description || `Payment for ${referenceType || 'bill'}`,
      createdBy: req.user.id
    };

    // Only add optional fields if they have valid values
    if (referenceType) {
      transactionData.referenceType = referenceType;
    }
    if (referenceId && referenceId.trim() !== '') {
      // Validate it's a valid ObjectId
      if (require('mongoose').Types.ObjectId.isValid(referenceId)) {
        transactionData.referenceId = referenceId;
      }
    }
    if (referenceNumber && referenceNumber.trim() !== '') {
      transactionData.referenceNumber = referenceNumber.trim();
    }
    if (paymentMethod) {
      transactionData.paymentMethod = paymentMethod;
    }
    if (bankName) {
      transactionData.bank = bankName;
    }
    if (bankReference && bankReference.trim() !== '') {
      transactionData.referenceNumberExternal = bankReference.trim();
    }
    
    // Add deposit usage tracking if provided
    if (depositUsages && Array.isArray(depositUsages) && depositUsages.length > 0) {
      transactionData.depositUsages = depositUsages.map(usage => ({
        depositId: usage.depositId,
        amount: parseFloat(usage.amount) || 0
      })).filter(usage => usage.depositId && usage.amount > 0);
    }

    // Create transaction record
    const transaction = new TajTransaction(transactionData);
    await transaction.save();

    // If referenceId is provided and it's a valid ObjectId, try to add payment to PropertyInvoice
    if (referenceId && require('mongoose').Types.ObjectId.isValid(referenceId)) {
      try {
        const invoice = await PropertyInvoice.findById(referenceId);
        if (invoice) {
          // Add payment to invoice
          const paymentEntry = {
            amount: amountNum,
            paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
            paymentMethod: paymentMethod || 'Bank Transfer',
            bankName: bankName || '',
            reference: bankReference || referenceNumber || '',
            notes: description || `Payment from deposit - ${transaction._id}`,
            recordedBy: req.user.id,
            recordedAt: new Date()
          };
          
          invoice.payments.push(paymentEntry);
          await invoice.save(); // This will trigger pre-save hook to update totalPaid, balance, and status
        }
      } catch (invoiceError) {
        // Log error but don't fail the payment transaction
        console.error('Error updating PropertyInvoice with payment:', invoiceError);
      }
    }

    await transaction.populate('resident', 'name accountType');
    await transaction.populate('createdBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Payment successful',
      data: {
        transaction,
        newBalance: balanceAfter
      }
    });
  })
);

// Get all deposits across all residents (for Deposits page)
router.get('/deposits/all', authMiddleware, asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, search, startDate, endDate } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build query
  const query = { transactionType: 'deposit' };

  // Date filter
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // Search filter (by resident name, transaction number, or description)
  if (search) {
    const residents = await TajResident.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { residentId: { $regex: search, $options: 'i' } }
      ]
    }).select('_id').lean();
    const residentIds = residents.map(r => r._id);
    
    query.$or = [
      { referenceNumberExternal: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { resident: { $in: residentIds } }
    ];
  }

  // Get total count
  const total = await TajTransaction.countDocuments(query);

  // Get deposits with pagination
  const deposits = await TajTransaction.find(query)
    .select('_id amount description paymentMethod bank referenceNumberExternal createdAt balanceBefore balanceAfter')
    .populate('resident', 'name residentId accountType')
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  // Calculate remaining amounts for deposits (optimized)
  const depositIds = deposits.map(d => d._id);
  if (depositIds.length > 0) {
    const depositUsageMap = {};
    const usedInPayments = await TajTransaction.find({
      'depositUsages.depositId': { $in: depositIds },
      transactionType: 'bill_payment'
    }).select('depositUsages').lean();

    usedInPayments.forEach(payment => {
      if (payment.depositUsages && Array.isArray(payment.depositUsages)) {
        payment.depositUsages.forEach(usage => {
          const depositId = usage.depositId?.toString();
          if (depositId && depositIds.some(id => id.toString() === depositId)) {
            depositUsageMap[depositId] = (depositUsageMap[depositId] || 0) + (usage.amount || 0);
          }
        });
      }
    });

    // Add remaining amount to each deposit
    deposits.forEach(deposit => {
      const depositId = deposit._id.toString();
      const totalUsed = depositUsageMap[depositId] || 0;
      deposit.remainingAmount = Math.max(0, (deposit.amount || 0) - totalUsed);
      deposit.totalUsed = totalUsed;
    });
  } else {
    deposits.forEach(deposit => {
      deposit.remainingAmount = deposit.amount || 0;
      deposit.totalUsed = 0;
    });
  }

  res.json({
    success: true,
    data: {
      deposits,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        total,
        hasNextPage: page < Math.ceil(total / parseInt(limit)),
        hasPrevPage: page > 1,
        limit: parseInt(limit)
      }
    }
  });
}));

module.exports = router;

