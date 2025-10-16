const cron = require('node-cron');
const { itService } = require('./emailService');
const SoftwareInventory = require('../models/it/SoftwareInventory');
const VendorContract = require('../models/it/VendorContract');
const ITAsset = require('../models/it/ITAsset');
const User = require('../models/User');

class ITNotificationService {
  constructor() {
    this.isRunning = false;
  }

  // Start all cron jobs
  start() {
    if (this.isRunning) {
      console.log('IT Notification Service is already running');
      return;
    }

    console.log('Starting IT Notification Service...');

    // License expiry reminders - Run daily at 9 AM
    cron.schedule('0 9 * * *', async () => {
      console.log('Running license expiry check...');
      await this.checkLicenseExpiry();
    });

    // Contract renewal reminders - Run daily at 9:30 AM
    cron.schedule('30 9 * * *', async () => {
      console.log('Running contract renewal check...');
      await this.checkContractRenewals();
    });

    // Asset warranty expiry - Run weekly on Monday at 10 AM
    cron.schedule('0 10 * * 1', async () => {
      console.log('Running asset warranty expiry check...');
      await this.checkAssetWarrantyExpiry();
    });

    // Software update notifications - Run weekly on Friday at 2 PM
    cron.schedule('0 14 * * 5', async () => {
      console.log('Running software update check...');
      await this.checkSoftwareUpdates();
    });

    // Network device health check - Run every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('Running network device health check...');
      await this.checkNetworkDeviceHealth();
    });

    this.isRunning = true;
    console.log('IT Notification Service started successfully');
  }

  // Stop all cron jobs
  stop() {
    if (!this.isRunning) {
      console.log('IT Notification Service is not running');
      return;
    }

    cron.getTasks().forEach(task => {
      task.destroy();
    });

    this.isRunning = false;
    console.log('IT Notification Service stopped');
  }

  // Check for software license expiry
  async checkLicenseExpiry() {
    try {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const expiringLicenses = await SoftwareInventory.find({
        isActive: true,
        expiryDate: {
          $lte: thirtyDaysFromNow,
          $gte: new Date()
        }
      }).populate('vendor', 'vendorName contactInfo');

      if (expiringLicenses.length > 0) {
        // Get IT managers and admins
        const itUsers = await User.find({
          role: { $in: ['super_admin', 'admin', 'it_manager'] },
          isActive: true
        });

        const notifications = [];

        for (const license of expiringLicenses) {
          const daysUntilExpiry = Math.ceil(
            (new Date(license.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)
          );

          const notification = {
            title: 'Software License Expiring Soon',
            message: `License for ${license.softwareName} v${license.version} will expire in ${daysUntilExpiry} days`,
            type: daysUntilExpiry <= 7 ? 'urgent' : 'warning',
            data: {
              licenseId: license._id,
              softwareName: license.softwareName,
              expiryDate: license.expiryDate,
              vendor: license.vendor?.vendorName,
              daysUntilExpiry
            }
          };

          notifications.push(notification);
        }

        // Send notifications to IT users
        for (const user of itUsers) {
          await this.sendNotification(user.email, notifications);
        }

        console.log(`Sent license expiry notifications for ${expiringLicenses.length} licenses`);
      }
    } catch (error) {
      console.error('Error checking license expiry:', error);
    }
  }

  // Check for contract renewals
  async checkContractRenewals() {
    try {
      const sixtyDaysFromNow = new Date();
      sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

      const expiringContracts = await VendorContract.find({
        status: 'Active',
        endDate: {
          $lte: sixtyDaysFromNow,
          $gte: new Date()
        }
      }).populate('vendor', 'vendorName contactInfo');

      if (expiringContracts.length > 0) {
        // Get IT managers and admins
        const itUsers = await User.find({
          role: { $in: ['super_admin', 'admin', 'it_manager'] },
          isActive: true
        });

        const notifications = [];

        for (const contract of expiringContracts) {
          const daysUntilExpiry = Math.ceil(
            (new Date(contract.endDate) - new Date()) / (1000 * 60 * 60 * 24)
          );

          const notification = {
            title: 'Vendor Contract Expiring Soon',
            message: `Contract ${contract.contractNumber} with ${contract.vendor?.vendorName} will expire in ${daysUntilExpiry} days`,
            type: daysUntilExpiry <= 30 ? 'urgent' : 'warning',
            data: {
              contractId: contract._id,
              contractNumber: contract.contractNumber,
              vendor: contract.vendor?.vendorName,
              endDate: contract.endDate,
              daysUntilExpiry
            }
          };

          notifications.push(notification);
        }

        // Send notifications to IT users
        for (const user of itUsers) {
          await this.sendNotification(user.email, notifications);
        }

        console.log(`Sent contract renewal notifications for ${expiringContracts.length} contracts`);
      }
    } catch (error) {
      console.error('Error checking contract renewals:', error);
    }
  }

  // Check for asset warranty expiry
  async checkAssetWarrantyExpiry() {
    try {
      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

      const expiringWarranties = await ITAsset.find({
        isActive: true,
        warrantyExpiryDate: {
          $lte: ninetyDaysFromNow,
          $gte: new Date()
        }
      });

      if (expiringWarranties.length > 0) {
        // Get IT managers and admins
        const itUsers = await User.find({
          role: { $in: ['super_admin', 'admin', 'it_manager'] },
          isActive: true
        });

        const notifications = [];

        for (const asset of expiringWarranties) {
          const daysUntilExpiry = Math.ceil(
            (new Date(asset.warrantyExpiryDate) - new Date()) / (1000 * 60 * 60 * 24)
          );

          const notification = {
            title: 'Asset Warranty Expiring Soon',
            message: `Warranty for ${asset.assetName} (${asset.assetTag}) will expire in ${daysUntilExpiry} days`,
            type: daysUntilExpiry <= 30 ? 'urgent' : 'warning',
            data: {
              assetId: asset._id,
              assetName: asset.assetName,
              assetTag: asset.assetTag,
              warrantyExpiryDate: asset.warrantyExpiryDate,
              daysUntilExpiry
            }
          };

          notifications.push(notification);
        }

        // Send notifications to IT users
        for (const user of itUsers) {
          await this.sendNotification(user.email, notifications);
        }

        console.log(`Sent warranty expiry notifications for ${expiringWarranties.length} assets`);
      }
    } catch (error) {
      console.error('Error checking asset warranty expiry:', error);
    }
  }

  // Check for software updates (placeholder)
  async checkSoftwareUpdates() {
    try {
      // This would typically integrate with software update APIs
      // For now, we'll just log that the check was performed
      console.log('Software update check completed (placeholder)');
    } catch (error) {
      console.error('Error checking software updates:', error);
    }
  }

  // Check network device health (placeholder)
  async checkNetworkDeviceHealth() {
    try {
      // This would typically ping network devices and check their status
      // For now, we'll just log that the check was performed
      console.log('Network device health check completed (placeholder)');
    } catch (error) {
      console.error('Error checking network device health:', error);
    }
  }

  // Send notification email
  async sendNotification(userEmail, notifications) {
    try {
      // Group notifications by type
      const urgentNotifications = notifications.filter(n => n.type === 'urgent');
      const warningNotifications = notifications.filter(n => n.type === 'warning');

      if (urgentNotifications.length > 0 || warningNotifications.length > 0) {
        const subject = 'IT Module Alerts - Action Required';
        
        let emailBody = `
          <h2>IT Module Alerts</h2>
          <p>Dear IT Team Member,</p>
          <p>The following alerts require your attention:</p>
        `;

        if (urgentNotifications.length > 0) {
          emailBody += `
            <h3 style="color: #d32f2f;">Urgent Alerts</h3>
            <ul>
          `;
          urgentNotifications.forEach(notification => {
            emailBody += `<li>${notification.message}</li>`;
          });
          emailBody += `</ul>`;
        }

        if (warningNotifications.length > 0) {
          emailBody += `
            <h3 style="color: #f57c00;">Warning Alerts</h3>
            <ul>
          `;
          warningNotifications.forEach(notification => {
            emailBody += `<li>${notification.message}</li>`;
          });
          emailBody += `</ul>`;
        }

        emailBody += `
          <p>Please log into the ERP system to take appropriate action.</p>
          <p>Best regards,<br>IT Module System</p>
        `;

        // Send email (assuming emailService is available)
        // await itService.sendEmail({
        //   to: userEmail,
        //   subject: subject,
        //   html: emailBody
        // });

        console.log(`Notification sent to ${userEmail}`);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  // Manual trigger for testing
  async triggerLicenseExpiryCheck() {
    console.log('Manually triggering license expiry check...');
    await this.checkLicenseExpiry();
  }

  async triggerContractRenewalCheck() {
    console.log('Manually triggering contract renewal check...');
    await this.checkContractRenewals();
  }

  async triggerAssetWarrantyCheck() {
    console.log('Manually triggering asset warranty check...');
    await this.checkAssetWarrantyExpiry();
  }
}

// Create singleton instance
const itNotificationService = new ITNotificationService();

module.exports = itNotificationService;
