const EmployeeOnboarding = require('../models/hr/EmployeeOnboarding');
const Employee = require('../models/hr/Employee');
const Candidate = require('../models/hr/Candidate');
const CandidateApproval = require('../models/hr/CandidateApproval');
const JoiningDocument = require('../models/hr/JoiningDocument');
const EmailService = require('./emailService');

class EmployeeOnboardingService {
  /**
   * Start onboarding process when joining document is submitted
   */
  async startOnboarding(approvalId) {
    try {
      console.log(`🚀 Starting employee onboarding for approval: ${approvalId}`);
      
      // Find the approval with related data
      const approval = await CandidateApproval.findById(approvalId)
        .populate('candidate')
        .populate('jobPosting');
      
      if (!approval) {
        throw new Error('Approval not found');
      }
      
      // Find the joining document
      const joiningDocument = await JoiningDocument.findOne({ approvalId });
      if (!joiningDocument) {
        throw new Error('Joining document not found');
      }
      
      // Check if onboarding already exists
      let onboarding = await EmployeeOnboarding.findOne({ approvalId });
      if (onboarding) {
        console.log(`⚠️ Onboarding already exists for approval: ${approvalId}`);
        return onboarding;
      }
      
      // Create new onboarding record
      onboarding = new EmployeeOnboarding({
        candidateId: approval.candidate._id,
        approvalId: approval._id,
        joiningDocumentId: joiningDocument._id,
        status: 'pending'
      });
      
      await onboarding.save();
      console.log(`✅ Created onboarding record: ${onboarding._id}`);
      
      // Send onboarding email to candidate
      await this.sendOnboardingEmail(onboarding);
      
      // Send notification to HR (simplified for now)
      await this.notifyHR(onboarding);
      
      return onboarding;
    } catch (error) {
      console.error(`❌ Error starting onboarding:`, error);
      throw error;
    }
  }
  
  /**
   * Send onboarding email to candidate
   */
  async sendOnboardingEmail(onboarding) {
    try {
      const approval = await CandidateApproval.findById(onboarding.approvalId)
        .populate('candidate')
        .populate('jobPosting');
      
      const emailResult = await EmailService.sendEmployeeOnboardingEmail(approval, onboarding);
      
      if (emailResult.success) {
        onboarding.onboardingEmailSent = true;
        onboarding.onboardingEmailSentAt = new Date();
        await onboarding.save();
        console.log(`✅ Onboarding email sent successfully`);
      } else {
        console.log(`⚠️ Failed to send onboarding email:`, emailResult.error);
      }
    } catch (error) {
      console.error(`❌ Error sending onboarding email:`, error);
    }
  }
  
  /**
   * Notify HR about new onboarding (simplified)
   */
  async notifyHR(onboarding) {
    try {
      const approval = await CandidateApproval.findById(onboarding.approvalId)
        .populate('candidate')
        .populate('jobPosting');
      
      // For now, just log the notification instead of using the notification service
      console.log(`🔔 HR Notification: New employee onboarding started for ${approval.candidate.firstName} ${approval.candidate.lastName}`);
      console.log(`📋 Onboarding ID: ${onboarding._id}`);
      console.log(`👤 Candidate: ${approval.candidate.firstName} ${approval.candidate.lastName}`);
      console.log(`💼 Position: ${approval.jobPosting?.title || 'N/A'}`);
      console.log(`🏢 Department: ${approval.jobPosting?.department?.name || 'N/A'}`);
      
      // TODO: Implement proper HR notification when notification service is ready
      // await NotificationService.createNotification({...});
      
      console.log(`✅ HR notification logged for onboarding: ${onboarding._id}`);
    } catch (error) {
      console.error(`❌ Error notifying HR:`, error);
    }
  }
  
  /**
   * Process onboarding form submission
   */
  async processOnboardingForm(onboardingId, formData) {
    try {
      console.log(`📝 Processing onboarding form for: ${onboardingId}`);
      
      const onboarding = await EmployeeOnboarding.findById(onboardingId)
        .populate('candidateId')
        .populate('approvalId');
      
      if (!onboarding) {
        throw new Error('Onboarding record not found');
      }
      
      // Update onboarding data
      onboarding.onboardingData = formData;
      onboarding.status = 'completed';
      await onboarding.save();
      
      // Create new employee with draft status (or update existing)
      const employee = await this.createDraftEmployee(onboarding, formData);
      
      // Update onboarding with employee reference
      onboarding.employeeId = employee._id;
      onboarding.status = 'completed';
      await onboarding.save();
      
      console.log(`✅ Onboarding completed and employee created/updated: ${employee._id}`);
      
      // Notify HR that onboarding is complete
      await this.notifyHROnboardingComplete(onboarding);
      
      return { 
        success: true, 
        onboarding, 
        employee,
        message: employee.employmentStatus === 'Draft' ? 
          'Employee onboarding completed successfully! Employee record is now in draft status and ready for HR review.' :
          'Employee onboarding completed successfully! Existing employee record has been updated.'
      };
    } catch (error) {
      console.error(`❌ Error processing onboarding form:`, error);
      throw error;
    }
  }
  
  /**
   * Create draft employee from onboarding data
   */
  async createDraftEmployee(onboarding, formData) {
    try {
      console.log(`👤 Creating draft employee from onboarding data`);
      console.log('Form data received:', formData);
      
      // Check if candidate already has an employee record
      const existingEmployee = await Employee.findOne({ 
        candidateId: onboarding.candidateId 
      });
      
      if (existingEmployee) {
        console.log(`⚠️ Candidate already has employee record: ${existingEmployee._id}`);
        console.log(`🔄 Updating existing employee instead of creating new one`);
        
        // Update existing employee with new onboarding data
        const updatedEmployee = await Employee.findByIdAndUpdate(
          existingEmployee._id,
          {
            // Update basic information if it's different
            firstName: formData.firstName || existingEmployee.firstName,
            lastName: formData.lastName || existingEmployee.lastName,
            email: formData.email || existingEmployee.email,
            phone: formData.phone || existingEmployee.phone,
            dateOfBirth: formData.dateOfBirth || existingEmployee.dateOfBirth,
            gender: formData.gender || existingEmployee.gender,
            nationality: formData.nationality || existingEmployee.nationality,
            religion: formData.religion || existingEmployee.religion,
            maritalStatus: formData.maritalStatus || existingEmployee.maritalStatus,
            
            // Update employment details
            startDate: formData.startDate || existingEmployee.startDate,
            employmentType: formData.employmentType || existingEmployee.employmentType,
            qualification: formData.qualification || existingEmployee.qualification,
            probationPeriodMonths: formData.probationPeriodMonths || existingEmployee.probationPeriodMonths,
            
            // Update onboarding reference
            onboardingId: onboarding._id,
            
            // Set status back to draft for review
            employmentStatus: 'Draft',
            isActive: false
          },
          { new: true }
        );
        
        console.log(`✅ Updated existing employee: ${updatedEmployee._id}`);
        return updatedEmployee;
      }
      
      // Generate unique employee ID
      const employeeCount = await Employee.countDocuments();
      const employeeId = `EMP${String(employeeCount + 1).padStart(6, '0')}`;
      
      // Generate unique ID card to avoid duplicates
      let uniqueIdCard = formData.idCard;
      let counter = 1;
      while (await Employee.findOne({ idCard: uniqueIdCard })) {
        uniqueIdCard = `${formData.idCard}-${counter}`;
        counter++;
      }
      
      console.log(`🆔 Generated unique ID card: ${uniqueIdCard} (original: ${formData.idCard})`);
      
      // Prepare employee data with safe defaults for draft status
      const employeeData = {
        employeeId,
        firstName: formData.firstName || 'Unknown',
        lastName: formData.lastName || 'Unknown',
        email: formData.email || 'unknown@company.com',
        phone: formData.phone || 'N/A',
        dateOfBirth: formData.dateOfBirth || new Date(),
        gender: formData.gender || 'other',
        idCard: uniqueIdCard, // Use unique ID card
        nationality: formData.nationality || 'Unknown',
        religion: formData.religion || 'Other',
        maritalStatus: formData.maritalStatus || 'Single',
        
        // Address - make optional for draft employees
        address: {
          street: formData.address?.street || 'To be filled by HR',
          city: null, // Will be set when HR reviews
          state: null, // Will be set when HR reviews
          country: null // Will be set when HR reviews
        },
        
        // Emergency Contact - make optional for draft employees
        emergencyContact: {
          name: formData.emergencyContact?.name || 'To be filled by HR',
          relationship: formData.emergencyContact?.relationship || 'To be filled by HR',
          phone: formData.emergencyContact?.phone || 'To be filled by HR',
          email: formData.emergencyContact?.email || 'To be filled by HR'
        },
        
        // Employment Details - make optional for draft employees
        position: null, // Will be set when HR reviews
        department: null, // Will be set when HR reviews
        startDate: formData.startDate || new Date(),
        employmentType: formData.employmentType || 'Full-time',
        salary: {
          gross: formData.salary?.gross || 0,
          basic: formData.salary?.basic || 0
        },
        
        // Bank Details - make optional for draft employees
        bankName: null, // Will be set when HR reviews
        
        // Required fields with defaults for draft employees
        qualification: formData.qualification || 'To be filled by HR',
        appointmentDate: formData.startDate || new Date(),
        probationPeriodMonths: formData.probationPeriodMonths || 6,
        
        employmentStatus: 'Draft', // Start as draft
        isActive: false, // Not active until HR approves
        
        // Link to candidate and onboarding
        candidateId: onboarding.candidateId,
        onboardingId: onboarding._id
      };
      
      console.log('Employee data prepared:', employeeData);
      
      const employee = new Employee(employeeData);
      await employee.save();
      
      console.log(`✅ Draft employee created: ${employee._id}`);
      
      return employee;
    } catch (error) {
      console.error(`❌ Error creating draft employee:`, error);
      console.error('Error details:', error.message);
      if (error.errors) {
        console.error('Validation errors:', error.errors);
      }
      throw error;
    }
  }
  
  /**
   * Notify HR that onboarding is complete (simplified)
   */
  async notifyHROnboardingComplete(onboarding) {
    try {
      const approval = await CandidateApproval.findById(onboarding.approvalId)
        .populate('candidate')
        .populate('jobPosting');
      
      // For now, just log the notification
      console.log(`🔔 HR Notification: Employee onboarding completed for ${approval.candidate.firstName} ${approval.candidate.lastName}`);
      console.log(`✅ Employee created with ID: ${onboarding.employeeId}`);
      console.log(`📋 Onboarding ID: ${onboarding._id}`);
      console.log(`👤 Candidate: ${approval.candidate.firstName} ${approval.candidate.lastName}`);
      console.log(`💼 Position: ${approval.jobPosting?.title || 'N/A'}`);
      console.log(`🏢 Department: ${approval.jobPosting?.department?.name || 'N/A'}`);
      
      // TODO: Implement proper HR notification when notification service is ready
      // await NotificationService.createNotification({...});
      
      console.log(`✅ HR notified of onboarding completion`);
    } catch (error) {
      console.error(`❌ Error notifying HR of completion:`, error);
    }
  }
  
  /**
   * Get onboarding details for public access
   */
  async getPublicOnboarding(onboardingId) {
    try {
      console.log(`🔍 Getting public onboarding for ID: ${onboardingId}`);
      console.log(`🔍 Type of onboardingId: ${typeof onboardingId}`);
      
      const onboarding = await EmployeeOnboarding.findById(onboardingId)
        .populate('candidateId')
        .populate('approvalId')
        .populate('joiningDocumentId');
      
      console.log(`🔍 Onboarding found:`, onboarding);
      
      if (!onboarding) {
        console.log(`❌ No onboarding found for ID: ${onboardingId}`);
        throw new Error('Onboarding not found');
      }
      
      console.log(`✅ Onboarding retrieved successfully:`, onboarding._id);
      
      return { success: true, data: onboarding };
    } catch (error) {
      console.error(`❌ Error getting public onboarding:`, error);
      throw error;
    }
  }
  
  /**
   * Get all onboarding records for HR
   */
  async getAllOnboarding(filters = {}) {
    try {
      const query = {};
      
      if (filters.status) query.status = filters.status;
      if (filters.candidateId) query.candidateId = filters.candidateId;
      
      const onboarding = await EmployeeOnboarding.find(query)
        .populate('candidateId', 'firstName lastName email')
        .populate('approvalId')
        .populate('employeeId', 'employeeId firstName lastName')
        .sort({ createdAt: -1 });
      
      return { success: true, data: onboarding };
    } catch (error) {
      console.error(`❌ Error getting onboarding records:`, error);
      throw error;
    }
  }
}

module.exports = new EmployeeOnboardingService();
