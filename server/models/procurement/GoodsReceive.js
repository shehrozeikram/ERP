const mongoose = require('mongoose');

const goodsReceiveSchema = new mongoose.Schema({
  receiveNumber: {
    type: String,
    unique: true,
    required: false,
    trim: true
  },
  receiveDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  supplierName: {
    type: String,
    trim: true
  },
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder'
  },
  poNumber: {
    type: String,
    trim: true
  },
  supplierAddress: {
    type: String,
    trim: true
  },
  narration: {
    type: String,
    trim: true
  },
  prNumber: {
    type: String,
    trim: true
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store'
  },
  storeSnapshot: {
    type: String,
    trim: true,
    default: 'Main Store'
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  gatePassNo: {
    type: String,
    trim: true
  },
  currency: {
    type: String,
    trim: true,
    default: 'Rupees'
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  otherCharges: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    default: 0,
    min: 0
  },
  observation: {
    type: String,
    trim: true
  },
  preparedByName: {
    type: String,
    trim: true
  },
  items: [{
    productCode: {
      type: String,
      trim: true
    },
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: false
    },
    itemCode: {
      type: String,
      required: true
    },
    itemName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unit: {
      type: String,
      required: true
    },
    unitPrice: {
      type: Number,
      default: 0
    },
    valueExcludingSalesTax: {
      type: Number,
      default: 0
    },
    subStore: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store'
    },
    location: {
      rack: { type: String, trim: true },
      shelf: { type: String, trim: true },
      bin: { type: String, trim: true }
    },
    notes: String
  }],
  totalItems: {
    type: Number,
    default: 0
  },
  totalQuantity: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    trim: true
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Received', 'Complete', 'Partial'],
    default: 'Partial'
  },
  // Finance / billing integration
  billingStatus: {
    type: String,
    enum: ['nothing_to_bill', 'waiting_bills', 'fully_billed'],
    default: 'nothing_to_bill'
  },
  billedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  // AP bill generated from this GRN
  vendorBill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountsPayable'
  },
  vendorBillNumber: {
    type: String,
    trim: true
  },
  // Journal entry posted on receipt
  journalEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry'
  },
  financePosted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Pre-save: Generate receive number if not provided (GR00000129 style)
goodsReceiveSchema.pre('save', async function(next) {
  if (!this.receiveNumber) {
    const count = await mongoose.model('GoodsReceive').countDocuments();
    this.receiveNumber = `GR${String(count + 1).padStart(8, '0')}`;
  }

  if (this.items && this.items.length > 0) {
    this.totalItems = this.items.length;
    this.totalQuantity = this.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    this.items.forEach((item) => {
      item.valueExcludingSalesTax = (item.quantity || 0) * (item.unitPrice || 0);
    });
    const subtotal = this.items.reduce((sum, item) => sum + (item.valueExcludingSalesTax || 0), 0);
    this.netAmount = subtotal - (this.discount || 0) + (this.otherCharges || 0);
    this.total = this.netAmount;
  }

  next();
});

// Shared logic: sync GRN items to inventory and create stock transactions
goodsReceiveSchema.statics.syncItemsToInventory = async function(grnDoc) {
  const receivedStatuses = ['Received', 'Complete', 'Partial'];
  if (!grnDoc || !receivedStatuses.includes(grnDoc.status) || !grnDoc.items || grnDoc.items.length === 0) return;
  if (!grnDoc.project) {
    console.error('GoodsReceive syncItemsToInventory: project is required');
    return;
  }

  const receiveNumber = grnDoc.receiveNumber || grnDoc._id?.toString() || 'GRN';
  const storeId = grnDoc.store?._id || grnDoc.store;
  const storeSnapshot = grnDoc.storeSnapshot || 'Main Store';
  const projectId = grnDoc.project._id || grnDoc.project;
  const Inventory = mongoose.model('Inventory');
  const StockTransaction = mongoose.model('StockTransaction');
  const Store = mongoose.model('Store');
  const items = Array.isArray(grnDoc.items) ? grnDoc.items : [];

  // Pre-fetch store names for snapshots to avoid repeated DB calls
  const storeNameCache = {};
  const resolveStoreName = async (id) => {
    if (!id) return '';
    const key = id.toString();
    if (!storeNameCache[key]) {
      const s = await Store.findById(id).select('name').lean();
      storeNameCache[key] = s?.name || '';
    }
    return storeNameCache[key];
  };

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx] && typeof items[idx].toObject === 'function' ? items[idx].toObject() : items[idx];
    if (!item || item.quantity == null) continue;
    try {
      const linkedId = item.inventoryItem?._id || item.inventoryItem;
      const codeStr = item.itemCode != null ? String(item.itemCode).trim() : (item.productCode != null ? String(item.productCode).trim() : '');
      const nameStr = item.itemName != null ? String(item.itemName).trim() : '';

      // Resolve sub-store: item-level subStore overrides GRN-level store
      const subStoreId = item.subStore?._id || item.subStore || null;
      const txStoreId = subStoreId || storeId;
      const subStoreSnapshot = subStoreId ? await resolveStoreName(subStoreId) : '';
      const qty = Number(item.quantity) || 0;

      // ── Linked store item: add stock to existing master item (matches finance GRN journal) ──
      if (linkedId) {
        const inv = await Inventory.findById(linkedId);
        if (!inv) {
          console.error(`GoodsReceive syncItemsToInventory: inventoryItem not found ${linkedId}`);
          continue;
        }
        if (storeId) {
          inv.store = storeId;
          inv.storeSnapshot = storeSnapshot;
        }
        if (subStoreId) {
          inv.subStore = subStoreId;
          inv.subStoreSnapshot = subStoreSnapshot;
        }
        if (item.location && (item.location.rack || item.location.shelf || item.location.bin)) {
          inv.location = {
            rack: item.location.rack || '',
            shelf: item.location.shelf || '',
            bin: item.location.bin || ''
          };
        }
        await inv.save();
        await inv.addStock(
          qty,
          receiveNumber,
          item.notes || `Received via GRN ${receiveNumber}`,
          grnDoc.receivedBy,
          Number(item.unitPrice) || 0
        );
        if (qty > 0 && txStoreId) {
          const currentBalance = await StockTransaction.getBalance(txStoreId, projectId, inv._id);
          const balanceAfter = currentBalance + qty;
          await StockTransaction.create({
            store: txStoreId,
            storeSnapshot: subStoreSnapshot || storeSnapshot,
            project: projectId,
            item: inv._id,
            itemCode: inv.itemCode,
            itemName: inv.name,
            transactionType: 'IN',
            quantity: qty,
            unit: inv.unit,
            unitPrice: Number(item.unitPrice) || 0,
            referenceType: 'GRN',
            referenceId: grnDoc._id,
            referenceNumber: receiveNumber,
            balanceAfter,
            location: {
              rack: item.location?.rack || '',
              shelf: item.location?.shelf || '',
              bin: item.location?.bin || ''
            },
            description: `Received via GRN ${receiveNumber}`,
            notes: item.notes || '',
            createdBy: grnDoc.receivedBy
          });
        }
        continue;
      }

      // ── No explicit link: first try to resolve existing inventory by itemCode/name ──
      if (!linkedId) {
        let resolvedInv = null;
        if (codeStr && codeStr !== '—') {
          resolvedInv = await Inventory.findOne({ itemCode: codeStr });
        }
        if (!resolvedInv && nameStr && nameStr !== '—') {
          resolvedInv = await Inventory.findOne({ name: nameStr }).sort({ createdAt: -1 });
        }
        if (resolvedInv) {
          if (storeId) {
            resolvedInv.store = storeId;
            resolvedInv.storeSnapshot = storeSnapshot;
          }
          if (subStoreId) {
            resolvedInv.subStore = subStoreId;
            resolvedInv.subStoreSnapshot = subStoreSnapshot;
          }
          if (item.location && (item.location.rack || item.location.shelf || item.location.bin)) {
            resolvedInv.location = {
              rack: item.location.rack || '',
              shelf: item.location.shelf || '',
              bin: item.location.bin || ''
            };
          }
          await resolvedInv.save();
          await resolvedInv.addStock(
            qty,
            receiveNumber,
            item.notes || `Received via GRN ${receiveNumber}`,
            grnDoc.receivedBy,
            Number(item.unitPrice) || 0
          );
          if (qty > 0 && txStoreId) {
            const currentBalance = await StockTransaction.getBalance(txStoreId, projectId, resolvedInv._id);
            const balanceAfter = currentBalance + qty;
            await StockTransaction.create({
              store: txStoreId,
              storeSnapshot: subStoreSnapshot || storeSnapshot,
              project: projectId,
              item: resolvedInv._id,
              itemCode: resolvedInv.itemCode,
              itemName: resolvedInv.name,
              transactionType: 'IN',
              quantity: qty,
              unit: resolvedInv.unit,
              unitPrice: Number(item.unitPrice) || 0,
              referenceType: 'GRN',
              referenceId: grnDoc._id,
              referenceNumber: receiveNumber,
              balanceAfter,
              location: {
                rack: item.location?.rack || '',
                shelf: item.location?.shelf || '',
                bin: item.location?.bin || ''
              },
              description: `Received via GRN ${receiveNumber}`,
              notes: item.notes || '',
              createdBy: grnDoc.receivedBy
            });
          }
          continue;
        }
      }

      // ── Fallback: create a GRN-specific inventory row only when no item match exists ──
      let baseCode = (codeStr && codeStr !== '—') ? codeStr : nameStr || `ITEM-${idx + 1}`;
      let uniqueCode = `${baseCode}-GRN${receiveNumber}-${idx + 1}`;

      let existing = await Inventory.findOne({ itemCode: uniqueCode });
      if (existing) {
        const timestamp = Date.now().toString().slice(-6);
        uniqueCode = `${baseCode}-GRN${receiveNumber}-${idx + 1}-${timestamp}`;
      }

      const name = (nameStr && nameStr !== '—') ? nameStr : uniqueCode;

      const barcodeValue = await Inventory.generateBarcodeValue(uniqueCode);

      const inv = new Inventory({
        itemCode: uniqueCode,
        name,
        description: item.description || `Received via GRN ${receiveNumber}`,
        category: item.category || 'Other',
        unit: (item.unit && item.unit !== '—') ? item.unit : 'Nos',
        quantity: 0,
        unitPrice: Number(item.unitPrice) || 0,
        barcode: barcodeValue,
        barcodeType: 'CODE128',
        store: storeId || undefined,
        storeSnapshot: storeSnapshot,
        subStore: subStoreId || undefined,
        subStoreSnapshot: subStoreSnapshot,
        location: {
          rack: item.location?.rack || '',
          shelf: item.location?.shelf || '',
          bin: item.location?.bin || ''
        },
        createdBy: grnDoc.receivedBy
      });
      await inv.save();

      await inv.addStock(
        qty,
        receiveNumber,
        item.notes || `Received via GRN ${receiveNumber}`,
        grnDoc.receivedBy,
        Number(item.unitPrice) || 0
      );

      if (qty > 0 && txStoreId) {
        const currentBalance = await StockTransaction.getBalance(txStoreId, projectId, inv._id);
        const balanceAfter = currentBalance + qty;

        await StockTransaction.create({
          store: txStoreId,
          storeSnapshot: subStoreSnapshot || storeSnapshot,
          project: projectId,
          item: inv._id,
          itemCode: uniqueCode,
          itemName: name,
          transactionType: 'IN',
          quantity: qty,
          unit: inv.unit,
          unitPrice: Number(item.unitPrice) || 0,
          referenceType: 'GRN',
          referenceId: grnDoc._id,
          referenceNumber: receiveNumber,
          balanceAfter,
          location: {
            rack: item.location?.rack || '',
            shelf: item.location?.shelf || '',
            bin: item.location?.bin || ''
          },
          description: `Received via GRN ${receiveNumber}`,
          notes: item.notes || '',
          createdBy: grnDoc.receivedBy
        });
      }
    } catch (error) {
      console.error(`GoodsReceive syncItemsToInventory error for item ${item.itemCode}:`, error);
    }
  }
};

// Post-save: Update inventory when goods are received
goodsReceiveSchema.post('save', async function(doc) {
  try {
    await this.constructor.syncItemsToInventory(doc);
  } catch (error) {
    console.error('GoodsReceive post-save syncItemsToInventory error:', error);
  }
});

goodsReceiveSchema.index({ receiveNumber: 1 });
goodsReceiveSchema.index({ receiveDate: -1 });
goodsReceiveSchema.index({ supplier: 1 });
goodsReceiveSchema.index({ status: 1 });

module.exports = mongoose.model('GoodsReceive', goodsReceiveSchema);
