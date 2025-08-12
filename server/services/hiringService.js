const Candidate = require('../models/hr/Candidate');
const CandidateApproval = require('../models/hr/CandidateApproval');
const JoiningDocument = require('../models/hr/JoiningDocument');
const Employee = require('../models/hr/Employee');
const EmailService = require('./emailService');
const EmployeeOnboardingService = require('./employeeOnboardingService');

class HiringService {
  async hireEmployee(approvalId) {
    try {
      console.log(`🚀 Starting hiring process for approval ${approvalId}`);
      
      // Find the approval
      const approval = await CandidateApproval.findById(approvalId)
        .populate('candidate')
        .populate('jobPosting');
      
      if (!approval) {
        throw new Error('Approval not found');
      }
      
      // Update candidate status to hired
      await Candidate.findByIdAndUpdate(approval.candidate._id, {
        status: 'hired',
        'hiringDetails.hiredAt': new Date(),
        'hiringDetails.approvalId': approval._id
      });
      
      // Update approval with hiring details
      approval.hiringDate = new Date();
      await approval.save();
      
      console.log(`✅ Updated candidate status to 'hired'`);
      console.log(`✅ Updated approval with hiring details`);
      
      return { success: true, approval };
    } catch (error) {
      console.error(`❌ Error in hireEmployee:`, error);
      throw error;
    }
  }

  async createJoiningDocument(approvalId, formData) {
    try {
      console.log(`📝 Creating joining document for approval ${approvalId}`);
      
      // Find the approval
      const approval = await CandidateApproval.findById(approvalId)
        .populate('candidate')
        .populate('jobPosting');
      
      if (!approval) {
        throw new Error('Approval not found');
      }
      
      // Create joining document
      const joiningDocument = new JoiningDocument({
        approvalId: approval._id,
        candidateId: approval.candidate._id,
        employeeName: formData.employeeName,
        position: formData.position,
        department: formData.department,
        guardianRelation: formData.guardianRelation,
        guardianName: formData.guardianName,
        cnic: formData.cnic,
        contactNo: formData.contactNo,
        dutyLocation: formData.dutyLocation,
        dutyDate: formData.dutyDate ? new Date(formData.dutyDate) : null,
        dutyTime: formData.dutyTime,
        verificationDepartment: formData.verificationDepartment,
        hodName: formData.hodName,
        joiningRemarks: formData.joiningRemarks,
        status: 'pending'
      });
      
      await joiningDocument.save();
      
      // Update candidate status to joining_documents_filled
      await Candidate.findByIdAndUpdate(approval.candidate._id, {
        status: 'joining_documents_filled',
        'hiringDetails.joiningDocumentId': joiningDocument._id
      });
      
      // Update approval with joining document reference
      approval.joiningDocumentId = joiningDocument._id;
      await approval.save();
      
      console.log(`✅ Created joining document: ${joiningDocument._id}`);
      console.log(`✅ Updated candidate status to 'joining_documents_filled'`);
      
      // Start the employee onboarding process
      console.log(`🚀 Starting employee onboarding process...`);
      await EmployeeOnboardingService.startOnboarding(approval._id);
      
      return { success: true, joiningDocument };
    } catch (error) {
      console.error(`❌ Error in createJoiningDocument:`, error);
      throw error;
    }
  }

  async getPublicJoiningDocument(approvalId) {
    try {
      console.log(`🔍 Fetching public joining document for approval ${approvalId}`);
      
      // Find the approval
      const approval = await CandidateApproval.findById(approvalId)
        .populate('candidate')
        .populate('jobPosting')
        .populate('application');
      
      if (!approval) {
        throw new Error('Approval not found');
      }
      
      // Check if joining document exists
      let joiningDocument = await JoiningDocument.findOne({ approvalId });
      
      // If no joining document exists, we can't create one without the required form data
      if (!joiningDocument) {
        console.log(`📝 No joining document found for approval ${approvalId}`);
        
        return {
          success: true,
          data: {
            approval: approval,
            joiningDocument: null,
            message: 'No joining document found. Please fill out the form to create one.'
          }
        };
      }
      
      return {
        success: true,
        data: {
          approval: approval,
          joiningDocument: joiningDocument
        }
      };
    } catch (error) {
      console.error(`❌ Error in getPublicJoiningDocument:`, error);
      throw error;
    }
  }
}

module.exports = new HiringService();
