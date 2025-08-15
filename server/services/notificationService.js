const Notification = require('../models/hr/Notification');
const User = require('../models/User');

class NotificationService {
  /**
   * Create a notification for candidate hiring
   */
  static async createCandidateHiredNotification(candidate, jobPosting, createdBy) {
    try {
      // Get all HR users AND admin users who should receive this notification
      const hrUsers = await User.find({
        role: { $in: ['admin', 'hr_manager'] },
        department: 'HR',
        isActive: true
      });

      // Also get admin users from any department
      const adminUsers = await User.find({
        role: 'admin',
        isActive: true
      });

      // Combine both sets of users, removing duplicates
      const allRecipients = [...hrUsers, ...adminUsers];
      const uniqueRecipients = allRecipients.filter((user, index, self) => 
        index === self.findIndex(u => u._id.toString() === user._id.toString())
      );

      if (uniqueRecipients.length === 0) {
        console.log('⚠️ No HR users or admin users found to send candidate hired notification');
        return null;
      }

      // Create a notification for each recipient
      const notifications = [];
      for (const recipient of uniqueRecipients) {
        const notification = new Notification({
          recipient: recipient._id,
          title: '🎉 New Employee Hired',
          message: `Candidate ${candidate.firstName} ${candidate.lastName} has been successfully hired for the position of ${jobPosting.title} in ${jobPosting.department} department.`,
          type: 'success',
          category: 'approval',
          priority: 'high',
          actionUrl: `/hr/employees/new-employee-onboarding/${candidate._id}`,
          metadata: {
            candidateId: candidate._id,
            candidateName: `${candidate.firstName} ${candidate.lastName}`,
            candidateEmail: candidate.email,
            candidatePhone: candidate.phone,
            jobTitle: jobPosting.title,
            department: jobPosting.department,
            hireDate: new Date(),
            salary: candidate.offer?.offeredSalary || 'Not specified'
          },
          createdBy: createdBy._id
        });

        await notification.save();
        notifications.push(notification);
      }
      
      console.log(`✅ Candidate hired notifications created for ${uniqueRecipients.length} users (HR + Admin)`);
      
      return notifications;
    } catch (error) {
      console.error('❌ Error creating candidate hired notification:', error);
      throw error;
    }
  }

  /**
   * Create a notification for employee onboarding completion
   */
  static async createEmployeeOnboardingNotification(employee, jobPosting, approval) {
    try {
      // Get all HR users AND admin users who should receive this notification
      const hrUsers = await User.find({
        role: { $in: ['admin', 'hr_manager'] },
        department: 'HR',
        isActive: true
      });

      // Also get admin users from any department
      const adminUsers = await User.find({
        role: 'admin',
        isActive: true
      });

      // Combine both sets of users, removing duplicates
      const allRecipients = [...hrUsers, ...adminUsers];
      const uniqueRecipients = allRecipients.filter((user, index, self) => 
        index === self.findIndex(u => u._id.toString() === user._id.toString())
      );

      if (uniqueRecipients.length === 0) {
        console.log('⚠️ No HR users or admin users found to send onboarding completion notification');
        return null;
      }

      // Create a notification for each recipient
      const notifications = [];
      for (const recipient of uniqueRecipients) {
        const notification = new Notification({
          recipient: recipient._id,
          title: '📋 Employee Onboarding Completed',
          message: `Employee ${employee.firstName} ${employee.lastName} has completed their onboarding form for the position of ${jobPosting?.title || 'N/A'} in ${jobPosting?.department?.name || 'N/A'} department.`,
          type: 'info',
          category: 'approval',
          priority: 'medium',
          actionUrl: `/hr/employees/${employee._id}`,
          metadata: {
            employeeId: employee._id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            employeeEmail: employee.email,
            employeePhone: employee.phone,
            jobTitle: jobPosting?.title || 'N/A',
            department: jobPosting?.department?.name || 'N/A',
            onboardingDate: new Date(),
            employeeStatus: employee.status
          },
          createdBy: approval.createdBy || uniqueRecipients[0]._id // Use first recipient as creator if no approval creator
        });

        await notification.save();
        notifications.push(notification);
      }
      
      console.log(`✅ Employee onboarding notifications created for ${uniqueRecipients.length} users (HR + Admin)`);
      
      return notifications;
    } catch (error) {
      console.error('❌ Error creating employee onboarding notification:', error);
      throw error;
    }
  }

  /**
   * Create a notification for employee status change
   */
  static async createEmployeeStatusChangeNotification(employee, oldStatus, newStatus, createdBy) {
    try {
      // Get HR users AND admin users
      const hrUsers = await User.find({
        role: { $in: ['admin', 'hr_manager'] },
        department: 'HR',
        isActive: true
      });

      // Also get admin users from any department
      const adminUsers = await User.find({
        role: 'admin',
        isActive: true
      });

      // Combine both sets of users, removing duplicates
      const allRecipients = [...hrUsers, ...adminUsers];
      const uniqueRecipients = allRecipients.filter((user, index, self) => 
        index === self.findIndex(u => u._id.toString() === user._id.toString())
      );

      if (uniqueRecipients.length === 0) return null;

      // Create a notification for each recipient
      const notifications = [];
      for (const recipient of uniqueRecipients) {
        const notification = new Notification({
          recipient: recipient._id,
          title: '👤 Employee Status Updated',
          message: `Employee ${employee.firstName} ${employee.lastName} status changed from ${oldStatus} to ${newStatus}.`,
          type: 'info',
          category: 'other',
          priority: 'medium',
          actionUrl: `/hr/employees/${employee._id}`,
          metadata: {
            employeeId: employee._id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            oldStatus,
            newStatus,
            changeDate: new Date()
          },
          createdBy: createdBy._id
        });

        await notification.save();
        notifications.push(notification);
      }
      
      console.log(`✅ Employee status change notifications created for ${uniqueRecipients.length} users (HR + Admin)`);
      
      return notifications;
    } catch (error) {
      console.error('❌ Error creating employee status change notification:', error);
      throw error;
    }
  }

  /**
   * Create a notification for attendance updates
   */
  static async createAttendanceNotification(attendance, employee, createdBy) {
    try {
      const hrUsers = await User.find({
        role: { $in: ['admin', 'hr_manager'] },
        department: 'HR',
        isActive: true
      });

      if (hrUsers.length === 0) return null;

      const action = attendance.checkIn ? 'checked in' : 'checked out';
      const time = attendance.checkIn?.time || attendance.checkOut?.time;
      const timeStr = time ? new Date(time).toLocaleTimeString() : 'now';

      // Create a notification for each HR user
      const notifications = [];
      for (const hrUser of hrUsers) {
        const notification = new Notification({
          recipient: hrUser._id,
          title: '⏰ Attendance Update',
          message: `${employee.firstName} ${employee.lastName} ${action} at ${timeStr}.`,
          type: 'info',
          category: 'attendance',
          priority: 'low',
          actionUrl: `/hr/attendance`,
          metadata: {
            employeeId: employee._id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            action,
            timestamp: time,
            deviceId: attendance.deviceId || 'Unknown'
          },
          createdBy: createdBy._id
        });

        await notification.save();
        notifications.push(notification);
      }
      
      console.log(`✅ Attendance notifications created for ${hrUsers.length} HR users`);
      
      return notifications;
    } catch (error) {
      console.error('❌ Error creating attendance notification:', error);
      throw error;
    }
  }

  /**
   * Create a notification for payroll generation
   */
  static async createPayrollNotification(payroll, employee, createdBy) {
    try {
      const hrUsers = await User.find({
        role: { $in: ['admin', 'hr_manager'] },
        department: 'HR',
        isActive: true
      });

      if (hrUsers.length === 0) return null;

      // Create a notification for each HR user
      const notifications = [];
      for (const hrUser of hrUsers) {
        const notification = new Notification({
          recipient: hrUser._id,
          title: '💰 Payroll Generated',
          message: `Payroll for ${employee.firstName} ${employee.lastName} has been generated for ${payroll.month}/${payroll.year}.`,
          type: 'info',
          category: 'payroll',
          priority: 'medium',
          actionUrl: `/hr/payroll/${payroll._id}`,
          metadata: {
            employeeId: employee._id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            month: payroll.month,
            year: payroll.year,
            netSalary: payroll.netSalary,
            generatedDate: new Date()
          },
          createdBy: createdBy._id
        });

        await notification.save();
        notifications.push(notification);
      }
      
      console.log(`✅ Payroll notifications created for ${hrUsers.length} HR users`);
      
      return notifications;
    } catch (error) {
      console.error('❌ Error creating payroll notification:', error);
      throw error;
    }
  }

  /**
   * Create a notification for loan approval
   */
  static async createLoanNotification(loan, employee, createdBy) {
    try {
      const hrUsers = await User.find({
        role: { $in: ['admin', 'hr_manager'] },
        department: 'HR',
        isActive: true
      });

      if (hrUsers.length === 0) return null;

      // Create a notification for each HR user
      const notifications = [];
      for (const hrUser of hrUsers) {
        const notification = new Notification({
          recipient: hrUser._id,
          title: '🏦 Loan Application Processed',
          message: `Loan application for ${employee.firstName} ${employee.lastName} has been ${loan.status}. Amount: ${loan.amount} ${loan.currency}.`,
          type: 'info',
          category: 'other',
          priority: 'medium',
          actionUrl: `/hr/loans/${loan._id}`,
          metadata: {
            employeeId: employee._id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            loanAmount: loan.amount,
            currency: loan.currency,
            status: loan.status,
            processedDate: new Date()
          },
          createdBy: createdBy._id
        });

        await notification.save();
        notifications.push(notification);
      }
      
      console.log(`✅ Loan notifications created for ${hrUsers.length} HR users`);
      
      return notifications;
    } catch (error) {
      console.error('❌ Error creating loan notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a specific user
   */
  static async getUserNotifications(userId, options = {}) {
    try {
      return await Notification.getForUser(userId, options);
    } catch (error) {
      console.error('❌ Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread count for a user
   */
  static async getUnreadCount(userId) {
    try {
      return await Notification.getUnreadCount(userId);
    } catch (error) {
      console.error('❌ Error getting unread count:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    try {
      return await Notification.markAsRead(notificationId, userId);
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark notification as archived
   */
  static async markAsArchived(notificationId, userId) {
    try {
      return await Notification.markAsArchived(notificationId, userId);
    } catch (error) {
      console.error('❌ Error marking notification as archived:', error);
      throw error;
    }
  }

  /**
   * Delete expired notifications
   */
  static async deleteExpiredNotifications() {
    try {
      const result = await Notification.deleteMany({
        expiresAt: { $lt: new Date() }
      });
      
      if (result.deletedCount > 0) {
        console.log(`🧹 Deleted ${result.deletedCount} expired notifications`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error deleting expired notifications:', error);
      throw error;
    }
  }

  /**
   * Create system alert notification
   */
  static async createSystemAlert(title, message, priority = 'medium', recipients = [], metadata = {}) {
    try {
      if (recipients.length === 0) {
        // Get all admin users if no specific recipients
        const adminUsers = await User.find({
          role: 'admin',
          isActive: true
        });
        recipients = adminUsers.map(user => user._id);
      }

      // Create a notification for each recipient
      const notifications = [];
      for (const recipientId of recipients) {
        const notification = new Notification({
          recipient: recipientId,
          title,
          message,
          type: 'system',
          category: 'system',
          priority,
          metadata,
          createdBy: recipients[0] // Use first recipient as creator for system alerts
        });

        await notification.save();
        notifications.push(notification);
      }
      
      console.log(`✅ System alert notifications created for ${recipients.length} users: ${title}`);
      
      return notifications;
    } catch (error) {
      console.error('❌ Error creating system alert notification:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
