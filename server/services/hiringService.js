const mongoose = require('mongoose');
const Candidate = require('../models/hr/Candidate');
const Application = require('../models/hr/Application');
const JobPosting = require('../models/hr/JobPosting');
const CandidateApproval = require('../models/hr/CandidateApproval');

class HiringService {
  constructor() {
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) {
      console.log('Hiring Service is already running');
      return;
    }

    try {
      console.log('🚀 Starting Hiring Service...');
      
      // Initialize hiring processes
      await this.initializeHiringProcesses();
      
      this.isRunning = true;
      console.log('✅ Hiring Service started successfully');
      
    } catch (error) {
      console.error('❌ Error starting Hiring Service:', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      console.log('Hiring Service is not running');
      return;
    }

    try {
      console.log('🛑 Stopping Hiring Service...');
      
      this.isRunning = false;
      
      console.log('✅ Hiring Service stopped successfully');
      
    } catch (error) {
      console.error('❌ Error stopping Hiring Service:', error);
      throw error;
    }
  }

  async initializeHiringProcesses() {
    try {
      console.log('📋 Initializing hiring processes...');
      
      // Check for pending applications that need processing
      await this.processPendingApplications();
      
      // Check for candidates that need approval
      await this.processPendingApprovals();
      
      // Check for expired job postings
      await this.processExpiredJobPostings();
      
      console.log('✅ Hiring processes initialized');
      
    } catch (error) {
      console.error('❌ Error initializing hiring processes:', error);
    }
  }

  async processPendingApplications() {
    try {
      const pendingApplications = await Application.find({ 
        status: 'Applied' 
      }).populate('candidate jobPosting');

      console.log(`📝 Processing ${pendingApplications.length} pending applications`);

      for (const application of pendingApplications) {
        try {
          await this.evaluateApplication(application);
        } catch (error) {
          console.error(`❌ Error processing application ${application._id}:`, error);
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing pending applications:', error);
    }
  }

  async processPendingApprovals() {
    try {
      const pendingApprovals = await CandidateApproval.find({ 
        status: 'Pending' 
      }).populate('candidate jobPosting');

      console.log(`⏳ Processing ${pendingApprovals.length} pending approvals`);

      for (const approval of pendingApprovals) {
        try {
          await this.processApproval(approval);
        } catch (error) {
          console.error(`❌ Error processing approval ${approval._id}:`, error);
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing pending approvals:', error);
    }
  }

  async processExpiredJobPostings() {
    try {
      const expiredPostings = await JobPosting.find({
        status: 'Active',
        endDate: { $lt: new Date() }
      });

      console.log(`⏰ Processing ${expiredPostings.length} expired job postings`);

      for (const posting of expiredPostings) {
        try {
          await this.closeExpiredJobPosting(posting);
        } catch (error) {
          console.error(`❌ Error closing expired posting ${posting._id}:`, error);
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing expired job postings:', error);
    }
  }

  async evaluateApplication(application) {
    try {
      console.log(`🔍 Evaluating application for ${application.candidate.name}`);

      // Basic evaluation logic
      const evaluation = await this.performEvaluation(application);
      
      // Update application status based on evaluation
      if (evaluation.score >= 70) {
        application.status = 'Shortlisted';
        application.evaluationScore = evaluation.score;
        application.evaluationNotes = evaluation.notes;
        
        // Create approval record
        await this.createApprovalRecord(application);
        
      } else if (evaluation.score >= 50) {
        application.status = 'Under Review';
        application.evaluationScore = evaluation.score;
        application.evaluationNotes = evaluation.notes;
        
      } else {
        application.status = 'Rejected';
        application.evaluationScore = evaluation.score;
        application.evaluationNotes = evaluation.notes;
      }

      await application.save();
      
      console.log(`✅ Application ${application._id} evaluated with score: ${evaluation.score}`);
      
    } catch (error) {
      console.error('❌ Error evaluating application:', error);
      throw error;
    }
  }

  async performEvaluation(application) {
    try {
      let score = 0;
      const notes = [];

      // Experience evaluation (0-30 points)
      if (application.candidate.experience) {
        const experienceYears = parseInt(application.candidate.experience) || 0;
        if (experienceYears >= 5) score += 30;
        else if (experienceYears >= 3) score += 25;
        else if (experienceYears >= 1) score += 20;
        else score += 10;
        
        notes.push(`Experience: ${experienceYears} years (${score} points)`);
      }

      // Education evaluation (0-25 points)
      if (application.candidate.education) {
        const education = application.candidate.education.toLowerCase();
        if (education.includes('phd') || education.includes('doctorate')) score += 25;
        else if (education.includes('masters') || education.includes('ms')) score += 20;
        else if (education.includes('bachelors') || education.includes('bs')) score += 15;
        else if (education.includes('diploma')) score += 10;
        else score += 5;
        
        notes.push(`Education: ${application.candidate.education} (${score} points)`);
      }

      // Skills evaluation (0-25 points)
      if (application.candidate.skills && application.candidate.skills.length > 0) {
        const requiredSkills = application.jobPosting.requirements || [];
        const candidateSkills = application.candidate.skills;
        
        let skillMatch = 0;
        for (const skill of requiredSkills) {
          if (candidateSkills.some(cs => 
            cs.toLowerCase().includes(skill.toLowerCase())
          )) {
            skillMatch++;
          }
        }
        
        const skillScore = Math.round((skillMatch / requiredSkills.length) * 25);
        score += skillScore;
        
        notes.push(`Skills match: ${skillMatch}/${requiredSkills.length} (${skillScore} points)`);
      }

      // Expected salary evaluation (0-20 points)
      if (application.candidate.expectedSalary && application.jobPosting.salaryRange) {
        const expected = application.candidate.expectedSalary;
        const range = application.jobPosting.salaryRange;
        
        if (expected <= range.max && expected >= range.min) score += 20;
        else if (expected <= range.max * 1.2) score += 15;
        else if (expected <= range.max * 1.5) score += 10;
        else score += 5;
        
        notes.push(`Salary expectations: ${expected} (${score} points)`);
      }

      return {
        score: Math.min(score, 100),
        notes: notes.join('; ')
      };
      
    } catch (error) {
      console.error('❌ Error performing evaluation:', error);
      return { score: 0, notes: 'Evaluation failed' };
    }
  }

  async createApprovalRecord(application) {
    try {
      const approval = new CandidateApproval({
        candidate: application.candidate._id,
        jobPosting: application.jobPosting._id,
        application: application._id,
        status: 'Pending',
        evaluationScore: application.evaluationScore,
        evaluationNotes: application.evaluationNotes
      });

      await approval.save();
      
      console.log(`✅ Approval record created for application ${application._id}`);
      
    } catch (error) {
      console.error('❌ Error creating approval record:', error);
      throw error;
    }
  }

  async processApproval(approval) {
    try {
      console.log(`📋 Processing approval for ${approval.candidate.name}`);

      // Check if approval has been pending for too long
      const daysPending = Math.floor((new Date() - approval.createdAt) / (1000 * 60 * 60 * 24));
      
      if (daysPending > 7) {
        // Send reminder to HR team
        await this.sendApprovalReminder(approval);
      }
      
    } catch (error) {
      console.error('❌ Error processing approval:', error);
    }
  }

  async closeExpiredJobPosting(posting) {
    try {
      console.log(`⏰ Closing expired job posting: ${posting.title}`);

      posting.status = 'Closed';
      posting.closedAt = new Date();
      
      await posting.save();
      
      // Update related applications
      await Application.updateMany(
        { jobPosting: posting._id, status: 'Applied' },
        { status: 'Position Closed' }
      );
      
      console.log(`✅ Job posting ${posting._id} closed successfully`);
      
    } catch (error) {
      console.error('❌ Error closing expired job posting:', error);
      throw error;
    }
  }

  async sendApprovalReminder(approval) {
    try {
      console.log(`📧 Sending approval reminder for ${approval._id}`);
      
      // Implementation for sending reminder emails/notifications
      // This would typically integrate with email/notification services
      
    } catch (error) {
      console.error('❌ Error sending approval reminder:', error);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      serviceName: 'Hiring Service'
    };
  }

  // Create joining document for candidate
  async createJoiningDocument(approvalId, formData) {
    try {
      console.log(`📝 Creating joining document for approval: ${approvalId}`);
      
      const JoiningDocument = require('../models/hr/JoiningDocument');
      const CandidateApproval = require('../models/hr/CandidateApproval');
      const Candidate = require('../models/hr/Candidate');
      
      // Find the approval
      const approval = await CandidateApproval.findById(approvalId)
        .populate('candidate jobPosting');
      
      if (!approval) {
        throw new Error('Approval not found');
      }

      if (approval.status !== 'approved') {
        throw new Error('Approval must be completed before creating joining document');
      }

      // Check if joining document already exists
      const existingDocument = await JoiningDocument.findOne({ approvalId });
      if (existingDocument) {
        throw new Error('Joining document already exists for this approval');
      }

      // Create joining document with mapped fields
      const joiningDocument = new JoiningDocument({
        approvalId: approval._id,
        candidateId: approval.candidate._id,
        jobPostingId: approval.jobPosting._id,
        // Map form fields
        employeeName: formData.employeeName || '',
        guardianRelation: formData.guardianRelation || '',
        guardianName: formData.guardianName || '',
        cnic: formData.cnic || '',
        contactNo: formData.contactNo || '',
        dutyLocation: formData.dutyLocation || '',
        dutyDate: formData.dutyDate || null,
        dutyTime: formData.dutyTime || '',
        department: formData.department || '',
        hodName: formData.hodName || '',
        joiningRemarks: formData.joiningRemarks || '',
        // Store complete form data as backup
        formData: formData,
        status: 'submitted',
        submittedAt: new Date()
      });

      await joiningDocument.save();

      // Update candidate status to joining_documents_filled
      await Candidate.findByIdAndUpdate(approval.candidate._id, {
        status: 'joining_documents_filled'
      });

      // Update onboarding record with joining document information
      try {
        console.log(`✅ Joining document created, onboarding will be updated when form is submitted`);
      } catch (onboardingError) {
        console.error(`❌ Note: Onboarding will be updated when onboarding form is submitted`);
        // Continue with the process even if onboarding update fails
      }

      console.log(`✅ Joining document created for candidate: ${approval.candidate.firstName} ${approval.candidate.lastName}`);

      // Send employee onboarding request email
      try {
        const EmailService = require('./emailService');
        const emailResult = await EmailService.sendEmployeeOnboardingRequest(approval);
        
        if (emailResult.success) {
          console.log(`✅ Employee onboarding request email sent to ${approval.candidate.email}`);
        } else {
          console.error(`❌ Failed to send employee onboarding request email:`, emailResult.error);
        }
      } catch (emailError) {
        console.error(`❌ Error sending employee onboarding request email:`, emailError.message);
      }

      return {
        success: true,
        message: 'Joining document created successfully',
        data: joiningDocument
      };

    } catch (error) {
      console.error('❌ Error creating joining document:', error);
      throw error;
    }
  }

  // Hire employee (create employee record)
  async hireEmployee(approvalId) {
    try {
      console.log(`🚀 Hiring employee for approval: ${approvalId}`);
      
      const CandidateApproval = require('../models/hr/CandidateApproval');
      const Employee = require('../models/hr/Employee');
      const JoiningDocument = require('../models/hr/JoiningDocument');
      const EmployeeOnboarding = require('../models/hr/EmployeeOnboarding');
      
      // Find the approval
      const approval = await CandidateApproval.findById(approvalId)
        .populate('candidate jobPosting');
      
      if (!approval) {
        throw new Error('Approval not found');
      }

      if (approval.status !== 'approved') {
        throw new Error('Approval must be completed before hiring employee');
      }

      // Check if joining document exists
      const joiningDocument = await JoiningDocument.findOne({ approvalId });
      if (!joiningDocument) {
        throw new Error('Joining document must be completed before hiring employee');
      }

      // Check if employee already exists
      const existingEmployee = await Employee.findOne({ 
        email: approval.candidate.email 
      });
      
      if (existingEmployee) {
        throw new Error('Employee already exists with this email');
      }

      // Create employee record (status: inactive)
      const employee = new Employee({
        firstName: approval.candidate.firstName,
        lastName: approval.candidate.lastName,
        email: approval.candidate.email,
        phone: approval.candidate.phone,
        dateOfBirth: approval.candidate.dateOfBirth,
        gender: approval.candidate.gender,
        nationality: approval.candidate.nationality,
        address: approval.candidate.address,
        currentPosition: approval.jobPosting.title,
        currentCompany: 'SGC',
        yearsOfExperience: approval.candidate.yearsOfExperience,
        expectedSalary: approval.candidate.expectedSalary,
        noticePeriod: approval.candidate.noticePeriod,
        education: approval.candidate.education,
        workExperience: approval.candidate.workExperience,
        skills: approval.candidate.skills,
        status: 'inactive', // Will be activated by HR
        joiningDate: new Date(),
        approvalId: approval._id
      });

      await employee.save();

      // Create employee onboarding record
      const employeeOnboarding = new EmployeeOnboarding({
        approvalId: approval._id,
        employeeId: employee._id,
        status: 'pending',
        createdBy: approval.createdBy || null
      });

      await employeeOnboarding.save();

      // Update candidate status to onboarding_completed
      await Candidate.findByIdAndUpdate(approval.candidate._id, {
        status: 'onboarding_completed'
      });

      // Update onboarding record with employee information
      try {
        const EmployeeOnboardingService = require('./employeeOnboardingService');
        await EmployeeOnboardingService.updateOnboardingWithEmployee(approval._id, employee._id);
        console.log(`✅ Onboarding updated with employee: ${employee._id}`);
      } catch (onboardingError) {
        console.error(`❌ Failed to update onboarding with employee:`, onboardingError.message);
        // Continue with the process even if onboarding update fails
      }

      console.log(`✅ Employee record created: ${employee.firstName} ${employee.lastName} (Status: inactive)`);

      // Create notification for HR team
      try {
        const NotificationService = require('./notificationService');
        await NotificationService.createEmployeeOnboardingNotification(
          employee,
          approval.jobPosting,
          approval
        );
        console.log(`✅ HR notification created for new employee onboarding`);
      } catch (notificationError) {
        console.error(`❌ Failed to create HR notification:`, notificationError.message);
      }

      return {
        success: true,
        message: 'Employee hired successfully',
        data: {
          employee: employee,
          onboarding: employeeOnboarding
        }
      };

    } catch (error) {
      console.error('❌ Error hiring employee:', error);
      throw error;
    }
  }
}

module.exports = new HiringService();
