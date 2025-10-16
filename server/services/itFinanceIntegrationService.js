const ITAsset = require('../models/it/ITAsset');
const SoftwareInventory = require('../models/it/SoftwareInventory');
const VendorContract = require('../models/it/VendorContract');
const ITVendor = require('../models/it/ITVendor');
const JournalEntry = require('../models/finance/JournalEntry');
const Account = require('../models/finance/Account');

class ITFinanceIntegrationService {
  
  /**
   * Create journal entry for IT asset purchase
   */
  static async recordAssetPurchase(assetData, purchaseData) {
    try {
      const {
        assetName,
        category,
        purchasePrice,
        currency = 'PKR',
        purchaseDate,
        supplier,
        paymentMethod = 'Cash',
        accountId // Chart of accounts account ID
      } = { ...assetData, ...purchaseData };

      // Find or create IT Asset account
      let assetAccount = await Account.findOne({ 
        accountName: 'IT Assets', 
        accountType: 'Asset' 
      });

      if (!assetAccount) {
        assetAccount = new Account({
          accountName: 'IT Assets',
          accountCode: '1500',
          accountType: 'Asset',
          description: 'Information Technology Assets',
          isActive: true
        });
        await assetAccount.save();
      }

      // Find or create Accounts Payable account
      let payableAccount = await Account.findOne({ 
        accountName: 'Accounts Payable', 
        accountType: 'Liability' 
      });

      if (!payableAccount) {
        payableAccount = new Account({
          accountName: 'Accounts Payable',
          accountCode: '2000',
          accountType: 'Liability',
          description: 'Amounts owed to suppliers',
          isActive: true
        });
        await payableAccount.save();
      }

      // Create journal entry for asset purchase
      const journalEntry = new JournalEntry({
        date: purchaseDate,
        reference: `IT Asset Purchase - ${assetName}`,
        description: `Purchase of ${assetName} from ${supplier}`,
        entries: [
          {
            account: assetAccount._id,
            debit: purchasePrice,
            credit: 0,
            description: `Asset Purchase - ${assetName}`
          },
          {
            account: payableAccount._id,
            debit: 0,
            credit: purchasePrice,
            description: `Amount owed to ${supplier}`
          }
        ],
        totalDebit: purchasePrice,
        totalCredit: purchasePrice,
        status: 'Posted',
        createdBy: purchaseData.createdBy
      });

      await journalEntry.save();

      return {
        success: true,
        data: {
          journalEntry,
          assetAccount,
          payableAccount
        },
        message: 'Asset purchase recorded in finance module'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create journal entry for software license purchase
   */
  static async recordSoftwarePurchase(softwareData, purchaseData) {
    try {
      const {
        softwareName,
        version,
        purchasePrice,
        currency = 'PKR',
        purchaseDate,
        vendor,
        paymentMethod = 'Cash',
        accountId
      } = { ...softwareData, ...purchaseData };

      // Find or create Software Licenses account
      let softwareAccount = await Account.findOne({ 
        accountName: 'Software Licenses', 
        accountType: 'Asset' 
      });

      if (!softwareAccount) {
        softwareAccount = new Account({
          accountName: 'Software Licenses',
          accountCode: '1501',
          accountType: 'Asset',
          description: 'Software License Assets',
          isActive: true
        });
        await softwareAccount.save();
      }

      // Find or create Accounts Payable account
      let payableAccount = await Account.findOne({ 
        accountName: 'Accounts Payable', 
        accountType: 'Liability' 
      });

      if (!payableAccount) {
        payableAccount = new Account({
          accountName: 'Accounts Payable',
          accountCode: '2000',
          accountType: 'Liability',
          description: 'Amounts owed to suppliers',
          isActive: true
        });
        await payableAccount.save();
      }

      // Create journal entry for software purchase
      const journalEntry = new JournalEntry({
        date: purchaseDate,
        reference: `Software License Purchase - ${softwareName}`,
        description: `Purchase of ${softwareName} v${version} from ${vendor}`,
        entries: [
          {
            account: softwareAccount._id,
            debit: purchasePrice,
            credit: 0,
            description: `Software License - ${softwareName}`
          },
          {
            account: payableAccount._id,
            debit: 0,
            credit: purchasePrice,
            description: `Amount owed to ${vendor}`
          }
        ],
        totalDebit: purchasePrice,
        totalCredit: purchasePrice,
        status: 'Posted',
        createdBy: purchaseData.createdBy
      });

      await journalEntry.save();

      return {
        success: true,
        data: {
          journalEntry,
          softwareAccount,
          payableAccount
        },
        message: 'Software purchase recorded in finance module'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate and record asset depreciation
   */
  static async calculateAssetDepreciation(assetId, depreciationPeriod = 'monthly') {
    try {
      const asset = await ITAsset.findById(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      if (!asset.purchasePrice || !asset.purchaseDate) {
        throw new Error('Asset purchase information incomplete');
      }

      // Calculate depreciation based on straight-line method
      const usefulLife = this.getAssetUsefulLife(asset.category);
      const monthlyDepreciation = asset.purchasePrice / (usefulLife * 12);
      
      // Find or create Accumulated Depreciation account
      let accumulatedDepreciationAccount = await Account.findOne({ 
        accountName: 'Accumulated Depreciation - IT Assets', 
        accountType: 'Asset' 
      });

      if (!accumulatedDepreciationAccount) {
        accumulatedDepreciationAccount = new Account({
          accountName: 'Accumulated Depreciation - IT Assets',
          accountCode: '1502',
          accountType: 'Asset',
          description: 'Accumulated Depreciation for IT Assets',
          isActive: true
        });
        await accumulatedDepreciationAccount.save();
      }

      // Find or create Depreciation Expense account
      let depreciationExpenseAccount = await Account.findOne({ 
        accountName: 'Depreciation Expense - IT', 
        accountType: 'Expense' 
      });

      if (!depreciationExpenseAccount) {
        depreciationExpenseAccount = new Account({
          accountName: 'Depreciation Expense - IT',
          accountCode: '6500',
          accountType: 'Expense',
          description: 'Depreciation Expense for IT Assets',
          isActive: true
        });
        await depreciationExpenseAccount.save();
      }

      // Create journal entry for depreciation
      const journalEntry = new JournalEntry({
        date: new Date(),
        reference: `IT Asset Depreciation - ${asset.assetName}`,
        description: `Monthly depreciation for ${asset.assetName} (${asset.assetTag})`,
        entries: [
          {
            account: depreciationExpenseAccount._id,
            debit: monthlyDepreciation,
            credit: 0,
            description: `Depreciation Expense - ${asset.assetName}`
          },
          {
            account: accumulatedDepreciationAccount._id,
            debit: 0,
            credit: monthlyDepreciation,
            description: `Accumulated Depreciation - ${asset.assetName}`
          }
        ],
        totalDebit: monthlyDepreciation,
        totalCredit: monthlyDepreciation,
        status: 'Posted',
        createdBy: asset.createdBy
      });

      await journalEntry.save();

      // Update asset with depreciation information
      await ITAsset.findByIdAndUpdate(assetId, {
        $inc: { 
          'depreciation.accumulatedDepreciation': monthlyDepreciation,
          'depreciation.currentBookValue': -monthlyDepreciation
        },
        $set: {
          'depreciation.lastDepreciationDate': new Date(),
          'depreciation.monthlyDepreciation': monthlyDepreciation
        }
      });

      return {
        success: true,
        data: {
          journalEntry,
          depreciationAmount: monthlyDepreciation,
          accumulatedDepreciation: (asset.depreciation?.accumulatedDepreciation || 0) + monthlyDepreciation,
          currentBookValue: (asset.depreciation?.currentBookValue || asset.purchasePrice) - monthlyDepreciation
        },
        message: 'Asset depreciation recorded successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Record vendor payment for IT services
   */
  static async recordVendorPayment(contractId, paymentData) {
    try {
      const contract = await VendorContract.findById(contractId).populate('vendor');
      if (!contract) {
        throw new Error('Contract not found');
      }

      const {
        paymentAmount,
        paymentDate,
        paymentMethod = 'Bank Transfer',
        reference,
        accountId
      } = paymentData;

      // Find or create IT Services Expense account
      let itServicesAccount = await Account.findOne({ 
        accountName: 'IT Services Expense', 
        accountType: 'Expense' 
      });

      if (!itServicesAccount) {
        itServicesAccount = new Account({
          accountName: 'IT Services Expense',
          accountCode: '6501',
          accountType: 'Expense',
          description: 'IT Services and Maintenance Expenses',
          isActive: true
        });
        await itServicesAccount.save();
      }

      // Find or create Bank account
      let bankAccount = await Account.findOne({ 
        accountName: 'Bank Account', 
        accountType: 'Asset' 
      });

      if (!bankAccount) {
        bankAccount = new Account({
          accountName: 'Bank Account',
          accountCode: '1000',
          accountType: 'Asset',
          description: 'Main Bank Account',
          isActive: true
        });
        await bankAccount.save();
      }

      // Create journal entry for vendor payment
      const journalEntry = new JournalEntry({
        date: paymentDate,
        reference: reference || `Vendor Payment - ${contract.vendor.vendorName}`,
        description: `Payment to ${contract.vendor.vendorName} for ${contract.contractNumber}`,
        entries: [
          {
            account: itServicesAccount._id,
            debit: paymentAmount,
            credit: 0,
            description: `IT Services - ${contract.vendor.vendorName}`
          },
          {
            account: bankAccount._id,
            debit: 0,
            credit: paymentAmount,
            description: `Bank Payment - ${reference || contract.contractNumber}`
          }
        ],
        totalDebit: paymentAmount,
        totalCredit: paymentAmount,
        status: 'Posted',
        createdBy: paymentData.createdBy
      });

      await journalEntry.save();

      return {
        success: true,
        data: {
          journalEntry,
          contract,
          paymentAmount
        },
        message: 'Vendor payment recorded successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get IT financial summary
   */
  static async getITFinancialSummary(startDate, endDate) {
    try {
      // Get IT asset purchases
      const assetPurchases = await JournalEntry.find({
        'entries.account': await Account.findOne({ accountName: 'IT Assets' }).select('_id'),
        date: { $gte: startDate, $lte: endDate },
        status: 'Posted'
      }).populate('entries.account', 'accountName');

      // Get software purchases
      const softwarePurchases = await JournalEntry.find({
        'entries.account': await Account.findOne({ accountName: 'Software Licenses' }).select('_id'),
        date: { $gte: startDate, $lte: endDate },
        status: 'Posted'
      }).populate('entries.account', 'accountName');

      // Get IT services expenses
      const itServicesExpenses = await JournalEntry.find({
        'entries.account': await Account.findOne({ accountName: 'IT Services Expense' }).select('_id'),
        date: { $gte: startDate, $lte: endDate },
        status: 'Posted'
      }).populate('entries.account', 'accountName');

      // Get depreciation expenses
      const depreciationExpenses = await JournalEntry.find({
        'entries.account': await Account.findOne({ accountName: 'Depreciation Expense - IT' }).select('_id'),
        date: { $gte: startDate, $lte: endDate },
        status: 'Posted'
      }).populate('entries.account', 'accountName');

      // Calculate totals
      const totalAssetPurchases = assetPurchases.reduce((sum, entry) => 
        sum + entry.entries.reduce((entrySum, e) => entrySum + (e.debit || 0), 0), 0);

      const totalSoftwarePurchases = softwarePurchases.reduce((sum, entry) => 
        sum + entry.entries.reduce((entrySum, e) => entrySum + (e.debit || 0), 0), 0);

      const totalServicesExpenses = itServicesExpenses.reduce((sum, entry) => 
        sum + entry.entries.reduce((entrySum, e) => entrySum + (e.debit || 0), 0), 0);

      const totalDepreciation = depreciationExpenses.reduce((sum, entry) => 
        sum + entry.entries.reduce((entrySum, e) => entrySum + (e.debit || 0), 0), 0);

      return {
        success: true,
        data: {
          period: { startDate, endDate },
          summary: {
            totalAssetPurchases,
            totalSoftwarePurchases,
            totalServicesExpenses,
            totalDepreciation,
            totalITExpenses: totalAssetPurchases + totalSoftwarePurchases + totalServicesExpenses + totalDepreciation
          },
          details: {
            assetPurchases: assetPurchases.length,
            softwarePurchases: softwarePurchases.length,
            servicesExpenses: itServicesExpenses.length,
            depreciationEntries: depreciationExpenses.length
          }
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
   * Get useful life for asset category
   */
  static getAssetUsefulLife(category) {
    const usefulLives = {
      'Laptop': 3,
      'Desktop': 4,
      'Server': 5,
      'Printer': 3,
      'Scanner': 3,
      'Router': 4,
      'Switch': 4,
      'Access Point': 3,
      'Firewall': 5,
      'UPS': 3,
      'Monitor': 4,
      'Keyboard': 2,
      'Mouse': 2,
      'Webcam': 3,
      'Headset': 2,
      'Projector': 5,
      'Tablet': 3,
      'Smartphone': 2,
      'Other': 3
    };

    return usefulLives[category] || 3; // Default 3 years
  }

  /**
   * Record monthly depreciation for all IT assets
   */
  static async recordMonthlyDepreciation() {
    try {
      const assets = await ITAsset.find({
        isActive: true,
        purchaseDate: { $exists: true },
        purchasePrice: { $gt: 0 }
      });

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const asset of assets) {
        try {
          const result = await this.calculateAssetDepreciation(asset._id);
          if (result.success) {
            successCount++;
            results.push({
              assetId: asset._id,
              assetName: asset.assetName,
              status: 'success',
              depreciationAmount: result.data.depreciationAmount
            });
          } else {
            errorCount++;
            results.push({
              assetId: asset._id,
              assetName: asset.assetName,
              status: 'error',
              error: result.error
            });
          }
        } catch (error) {
          errorCount++;
          results.push({
            assetId: asset._id,
            assetName: asset.assetName,
            status: 'error',
            error: error.message
          });
        }
      }

      return {
        success: true,
        data: {
          totalAssets: assets.length,
          successCount,
          errorCount,
          results
        },
        message: `Monthly depreciation processed for ${successCount} assets, ${errorCount} errors`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ITFinanceIntegrationService;
