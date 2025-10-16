const ITAsset = require('../models/it/ITAsset');
const SoftwareInventory = require('../models/it/SoftwareInventory');
const VendorContract = require('../models/it/VendorContract');
const ITVendor = require('../models/it/ITVendor');
const PurchaseOrder = require('../models/procurement/PurchaseOrder');
const Inventory = require('../models/procurement/Inventory');

class ITProcurementIntegrationService {
  
  /**
   * Create purchase order for IT asset
   */
  static async createAssetPurchaseOrder(assetRequestData, requesterId) {
    try {
      const {
        assetName,
        category,
        brand,
        model,
        quantity = 1,
        estimatedPrice,
        currency = 'PKR',
        supplier,
        priority = 'Medium',
        requiredDate,
        justification,
        specifications,
        accessories = []
      } = assetRequestData;

      // Create purchase order
      const purchaseOrder = new PurchaseOrder({
        poNumber: this.generatePONumber('IT'),
        supplier: supplier,
        requestedBy: requesterId,
        requestDate: new Date(),
        requiredDate: requiredDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        priority: priority,
        status: 'Pending Approval',
        currency: currency,
        items: [{
          itemName: assetName,
          description: `IT Asset: ${assetName} - ${brand} ${model}`,
          category: 'IT Hardware',
          quantity: quantity,
          unitPrice: estimatedPrice,
          totalPrice: estimatedPrice * quantity,
          specifications: specifications,
          accessories: accessories
        }],
        totalAmount: estimatedPrice * quantity,
        justification: justification,
        notes: `IT Asset Purchase Request: ${assetName} for IT Department`,
        attachments: []
      });

      await purchaseOrder.save();

      return {
        success: true,
        data: {
          purchaseOrder,
          estimatedCost: estimatedPrice * quantity,
          items: purchaseOrder.items.length
        },
        message: 'Purchase order created successfully for IT asset'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create purchase order for software license
   */
  static async createSoftwarePurchaseOrder(softwareRequestData, requesterId) {
    try {
      const {
        softwareName,
        version,
        licenseType,
        quantity = 1,
        estimatedPrice,
        currency = 'PKR',
        vendor,
        priority = 'Medium',
        requiredDate,
        justification,
        licenseCount,
        expiryDate
      } = softwareRequestData;

      // Create purchase order
      const purchaseOrder = new PurchaseOrder({
        poNumber: this.generatePONumber('SW'),
        supplier: vendor,
        requestedBy: requesterId,
        requestDate: new Date(),
        requiredDate: requiredDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        priority: priority,
        status: 'Pending Approval',
        currency: currency,
        items: [{
          itemName: `${softwareName} v${version}`,
          description: `Software License: ${softwareName} v${version} - ${licenseType} License`,
          category: 'IT Software',
          quantity: quantity,
          unitPrice: estimatedPrice,
          totalPrice: estimatedPrice * quantity,
          specifications: {
            licenseType,
            licenseCount,
            expiryDate,
            version
          }
        }],
        totalAmount: estimatedPrice * quantity,
        justification: justification,
        notes: `Software License Purchase Request: ${softwareName} for IT Department`,
        attachments: []
      });

      await purchaseOrder.save();

      return {
        success: true,
        data: {
          purchaseOrder,
          estimatedCost: estimatedPrice * quantity,
          items: purchaseOrder.items.length
        },
        message: 'Purchase order created successfully for software license'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create purchase order for license renewal
   */
  static async createLicenseRenewalOrder(renewalData, requesterId) {
    try {
      const software = await SoftwareInventory.findById(renewalData.softwareId);
      if (!software) {
        throw new Error('Software not found');
      }

      const {
        renewalPrice,
        currency = 'PKR',
        vendor,
        priority = 'High',
        requiredDate,
        justification,
        newExpiryDate
      } = renewalData;

      // Create purchase order
      const purchaseOrder = new PurchaseOrder({
        poNumber: this.generatePONumber('RN'),
        supplier: vendor,
        requestedBy: requesterId,
        requestDate: new Date(),
        requiredDate: requiredDate || new Date(software.expiryDate.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days before expiry
        priority: priority,
        status: 'Pending Approval',
        currency: currency,
        items: [{
          itemName: `${software.softwareName} License Renewal`,
          description: `License Renewal: ${software.softwareName} v${software.version}`,
          category: 'IT Software Renewal',
          quantity: 1,
          unitPrice: renewalPrice,
          totalPrice: renewalPrice,
          specifications: {
            currentExpiryDate: software.expiryDate,
            newExpiryDate,
            licenseCount: software.licenseCount.total,
            licenseType: software.licenseType
          }
        }],
        totalAmount: renewalPrice,
        justification: justification || `License renewal for ${software.softwareName} - expires ${software.expiryDate.toLocaleDateString()}`,
        notes: `Software License Renewal Request: ${software.softwareName} for IT Department`,
        attachments: []
      });

      await purchaseOrder.save();

      return {
        success: true,
        data: {
          purchaseOrder,
          software,
          renewalCost: renewalPrice
        },
        message: 'License renewal purchase order created successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create purchase order for IT vendor services
   */
  static async createVendorServiceOrder(serviceRequestData, requesterId) {
    try {
      const {
        vendorId,
        serviceDescription,
        serviceType,
        estimatedCost,
        currency = 'PKR',
        priority = 'Medium',
        requiredDate,
        justification,
        duration,
        deliverables = []
      } = serviceRequestData;

      const vendor = await ITVendor.findById(vendorId);
      if (!vendor) {
        throw new Error('Vendor not found');
      }

      // Create purchase order
      const purchaseOrder = new PurchaseOrder({
        poNumber: this.generatePONumber('SV'),
        supplier: vendor.vendorName,
        requestedBy: requesterId,
        requestDate: new Date(),
        requiredDate: requiredDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        priority: priority,
        status: 'Pending Approval',
        currency: currency,
        items: [{
          itemName: `${serviceType} - ${vendor.vendorName}`,
          description: serviceDescription,
          category: 'IT Services',
          quantity: 1,
          unitPrice: estimatedCost,
          totalPrice: estimatedCost,
          specifications: {
            serviceType,
            duration,
            deliverables,
            vendorId
          }
        }],
        totalAmount: estimatedCost,
        justification: justification,
        notes: `IT Service Request: ${serviceType} from ${vendor.vendorName}`,
        attachments: []
      });

      await purchaseOrder.save();

      return {
        success: true,
        data: {
          purchaseOrder,
          vendor,
          serviceCost: estimatedCost
        },
        message: 'Vendor service purchase order created successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process approved purchase order and create IT asset
   */
  static async processAssetPurchaseOrder(poId, receivedData) {
    try {
      const purchaseOrder = await PurchaseOrder.findById(poId);
      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      if (purchaseOrder.status !== 'Approved') {
        throw new Error('Purchase order must be approved before processing');
      }

      const item = purchaseOrder.items[0]; // Assuming single item for IT assets
      const {
        serialNumber,
        assetTag,
        condition = 'Excellent',
        warrantyExpiryDate,
        supplier
      } = receivedData;

      // Create IT asset
      const asset = new ITAsset({
        assetTag: assetTag || this.generateAssetTag(),
        assetName: item.itemName,
        category: item.category,
        brand: item.specifications?.brand || 'Unknown',
        model: item.specifications?.model || 'Unknown',
        serialNumber: serialNumber,
        purchaseDate: new Date(),
        purchasePrice: item.totalPrice,
        currency: purchaseOrder.currency,
        condition: condition,
        warrantyExpiryDate: warrantyExpiryDate,
        supplier: supplier || purchaseOrder.supplier,
        purchaseOrder: poId,
        specifications: item.specifications,
        accessories: item.specifications?.accessories || [],
        status: 'Available',
        isActive: true,
        createdBy: purchaseOrder.requestedBy
      });

      await asset.save();

      // Update purchase order status
      await PurchaseOrder.findByIdAndUpdate(poId, {
        status: 'Completed',
        completedDate: new Date(),
        receivedItems: [{
          itemName: item.itemName,
          receivedQuantity: item.quantity,
          receivedDate: new Date(),
          condition: condition,
          serialNumber: serialNumber,
          assetTag: assetTag
        }]
      });

      return {
        success: true,
        data: {
          asset,
          purchaseOrder: poId,
          totalCost: item.totalPrice
        },
        message: 'IT asset created successfully from purchase order'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process approved software purchase order
   */
  static async processSoftwarePurchaseOrder(poId, receivedData) {
    try {
      const purchaseOrder = await PurchaseOrder.findById(poId);
      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      if (purchaseOrder.status !== 'Approved') {
        throw new Error('Purchase order must be approved before processing');
      }

      const item = purchaseOrder.items[0];
      const {
        licenseKey,
        expiryDate,
        licenseCount,
        vendor
      } = receivedData;

      // Create software inventory
      const software = new SoftwareInventory({
        softwareName: item.itemName.split(' v')[0],
        version: item.specifications?.version || '1.0',
        category: item.specifications?.category || 'Other',
        licenseType: item.specifications?.licenseType || 'Perpetual',
        purchaseDate: new Date(),
        purchasePrice: item.totalPrice,
        currency: purchaseOrder.currency,
        licenseKey: licenseKey,
        expiryDate: expiryDate,
        licenseCount: {
          total: licenseCount || 1,
          used: 0,
          available: licenseCount || 1
        },
        vendor: vendor || purchaseOrder.supplier,
        purchaseOrder: poId,
        status: 'Active',
        isActive: true,
        createdBy: purchaseOrder.requestedBy
      });

      await software.save();

      // Update purchase order status
      await PurchaseOrder.findByIdAndUpdate(poId, {
        status: 'Completed',
        completedDate: new Date(),
        receivedItems: [{
          itemName: item.itemName,
          receivedQuantity: item.quantity,
          receivedDate: new Date(),
          licenseKey: licenseKey,
          expiryDate: expiryDate
        }]
      });

      return {
        success: true,
        data: {
          software,
          purchaseOrder: poId,
          totalCost: item.totalPrice
        },
        message: 'Software inventory created successfully from purchase order'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get IT procurement summary
   */
  static async getITProcurementSummary(startDate, endDate) {
    try {
      // Get IT-related purchase orders
      const itPurchaseOrders = await PurchaseOrder.find({
        'items.category': { $in: ['IT Hardware', 'IT Software', 'IT Services', 'IT Software Renewal'] },
        requestDate: { $gte: startDate, $lte: endDate }
      }).populate('requestedBy', 'firstName lastName');

      // Calculate totals by category
      const summary = {
        totalOrders: itPurchaseOrders.length,
        totalValue: 0,
        byCategory: {
          hardware: { count: 0, value: 0 },
          software: { count: 0, value: 0 },
          services: { count: 0, value: 0 },
          renewals: { count: 0, value: 0 }
        },
        byStatus: {
          pending: 0,
          approved: 0,
          completed: 0,
          cancelled: 0
        },
        byPriority: {
          high: 0,
          medium: 0,
          low: 0
        }
      };

      itPurchaseOrders.forEach(po => {
        summary.totalValue += po.totalAmount;
        
        // Categorize by item type
        po.items.forEach(item => {
          switch (item.category) {
            case 'IT Hardware':
              summary.byCategory.hardware.count++;
              summary.byCategory.hardware.value += item.totalPrice;
              break;
            case 'IT Software':
              summary.byCategory.software.count++;
              summary.byCategory.software.value += item.totalPrice;
              break;
            case 'IT Software Renewal':
              summary.byCategory.renewals.count++;
              summary.byCategory.renewals.value += item.totalPrice;
              break;
            case 'IT Services':
              summary.byCategory.services.count++;
              summary.byCategory.services.value += item.totalPrice;
              break;
          }
        });

        // Count by status
        summary.byStatus[po.status.toLowerCase()] = (summary.byStatus[po.status.toLowerCase()] || 0) + 1;
        
        // Count by priority
        summary.byPriority[po.priority.toLowerCase()] = (summary.byPriority[po.priority.toLowerCase()] || 0) + 1;
      });

      return {
        success: true,
        data: {
          period: { startDate, endDate },
          summary,
          purchaseOrders: itPurchaseOrders
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate purchase order number
   */
  static generatePONumber(type) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PO-${type}-${timestamp}-${random}`;
  }

  /**
   * Generate asset tag
   */
  static generateAssetTag() {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `IT-${timestamp}-${random}`;
  }

  /**
   * Auto-create renewal orders for expiring licenses
   */
  static async createAutoRenewalOrders() {
    try {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const expiringSoftware = await SoftwareInventory.find({
        isActive: true,
        expiryDate: {
          $lte: thirtyDaysFromNow,
          $gte: new Date()
        },
        autoRenewal: true
      }).populate('vendor');

      const renewalOrders = [];

      for (const software of expiringSoftware) {
        try {
          const result = await this.createLicenseRenewalOrder({
            softwareId: software._id,
            renewalPrice: software.renewalCost || (software.purchasePrice * 0.8), // 80% of original price
            vendor: software.vendor?.vendorName || 'Unknown',
            requiredDate: new Date(software.expiryDate.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days before expiry
            justification: `Auto-renewal for expiring license: ${software.softwareName} expires ${software.expiryDate.toLocaleDateString()}`,
            newExpiryDate: new Date(software.expiryDate.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 year from current expiry
          }, 'system'); // System user ID

          if (result.success) {
            renewalOrders.push(result.data);
          }
        } catch (error) {
          console.error(`Failed to create auto-renewal for ${software.softwareName}:`, error.message);
        }
      }

      return {
        success: true,
        data: {
          totalRenewals: renewalOrders.length,
          renewalOrders
        },
        message: `Auto-renewal orders created for ${renewalOrders.length} expiring licenses`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ITProcurementIntegrationService;
