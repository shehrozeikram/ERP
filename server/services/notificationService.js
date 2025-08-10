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

      // Create notification
      const notification = new Notification({
        type: 'candidate_hired',
        title: '🎉 New Employee Hired',
        message: `Candidate ${candidate.firstName} ${candidate.lastName} has been successfully hired for the position of ${jobPosting.title} in ${jobPosting.department} department.`,
        priority: 'high',
        relatedEntity: 'candidate',
        relatedEntityId: candidate._id,
        relatedEntityRef: 'Candidate',
        actionRequired: true,
        actionType: 'review',
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
        recipients: uniqueRecipients.map(user => ({
          user: user._id,
          readAt: null,
          archivedAt: null
        })),
        createdBy: createdBy._id
      });

      await notification.save();
      
      console.log(`✅ Candidate hired notification created for ${uniqueRecipients.length} users (HR + Admin)`);
      
      return notification;
    } catch (error) {
      console.error('❌ Error creating candidate hired notification:', error);
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

      const notification = new Notification({
        type: 'employee_status_change',
        title: '👤 Employee Status Updated',
        message: `Employee ${employee.firstName} ${employee.lastName} status changed from ${oldStatus} to ${newStatus}.`,
        priority: 'medium',
        relatedEntity: 'employee',
        relatedEntityId: employee._id,
        relatedEntityRef: 'Employee',
        actionRequired: false,
        actionType: 'none',
        actionUrl: `/hr/employees/${employee._id}`,
        metadata: {
          employeeId: employee._id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          oldStatus,
          newStatus,
          changeDate: new Date()
        },
        recipients: uniqueRecipients.map(user => ({
          user: user._id,
          readAt: null,
          archivedAt: null
        })),
        createdBy: createdBy._id
      });

      await notification.save();
      console.log(`✅ Employee status change notification created for ${uniqueRecipients.length} users (HR + Admin)`);
      
      return notification;
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

      const notification = new Notification({
        type: 'attendance_update',
        title: '⏰ Attendance Update',
        message: `${employee.firstName} ${employee.lastName} ${action} at ${timeStr}.`,
        priority: 'low',
        relatedEntity: 'attendance',
        relatedEntityId: attendance._id,
        relatedEntityRef: 'Attendance',
        actionRequired: false,
        actionType: 'none',
        actionUrl: `/hr/attendance`,
        metadata: {
          employeeId: employee._id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          action,
          timestamp: time,
          deviceId: attendance.deviceId || 'Unknown'
        },
        recipients: hrUsers.map(user => ({
          user: user._id,
          readAt: null,
          archivedAt: null
        })),
        createdBy: createdBy._id
      });

      await notification.save();
      console.log(`✅ Attendance notification created`);
      
      return notification;
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

      const notification = new Notification({
        type: 'payroll_generated',
        title: '💰 Payroll Generated',
        message: `Payroll for ${employee.firstName} ${employee.lastName} has been generated for ${payroll.month}/${payroll.year}.`,
        priority: 'medium',
        relatedEntity: 'payroll',
        relatedEntityId: payroll._id,
        relatedEntityRef: 'Payroll',
        actionRequired: true,
        actionType: 'review',
        actionUrl: `/hr/payroll/${payroll._id}`,
        metadata: {
          employeeId: employee._id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          month: payroll.month,
          year: payroll.year,
          netSalary: payroll.netSalary,
          generatedDate: new Date()
        },
        recipients: hrUsers.map(user => ({
          user: user._id,
          readAt: null,
          archivedAt: null
        })),
        createdBy: createdBy._id
      });

      await notification.save();
      console.log(`✅ Payroll notification created`);
      
      return notification;
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

      const notification = new Notification({
        type: 'loan_approved',
        title: '🏦 Loan Application Processed',
        message: `Loan application for ${employee.firstName} ${employee.lastName} has been ${loan.status}. Amount: ${loan.amount} ${loan.currency}.`,
        priority: 'medium',
        relatedEntity: 'loan',
        relatedEntityId: loan._id,
        relatedEntityRef: 'Loan',
        actionRequired: loan.status === 'pending',
        actionType: loan.status === 'pending' ? 'approve' : 'none',
        actionUrl: `/hr/loans/${loan._id}`,
        metadata: {
          employeeId: employee._id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          loanAmount: loan.amount,
          currency: loan.currency,
          status: loan.status,
          processedDate: new Date()
        },
        recipients: hrUsers.map(user => ({
          user: user._id,
          readAt: null,
          archivedAt: null
        })),
        createdBy: createdBy._id
      });

      await notification.save();
      console.log(`✅ Loan notification created`);
      
      return notification;
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

      const notification = new Notification({
        type: 'system_alert',
        title,
        message,
        priority,
        relatedEntity: 'system',
        actionRequired: false,
        actionType: 'none',
        metadata,
        recipients: recipients.map(userId => ({
          user: userId,
          readAt: null,
          archivedAt: null
        })),
        createdBy: recipients[0] // Use first recipient as creator for system alerts
      });

      await notification.save();
      console.log(`✅ System alert notification created: ${title}`);
      
      return notification;
    } catch (error) {
      console.error('❌ Error creating system alert notification:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
