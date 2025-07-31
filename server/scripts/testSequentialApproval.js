const mongoose = require('mongoose');
const Candidate = require('../models/hr/Candidate');
const CandidateApproval = require('../models/hr/CandidateApproval');
const JobPosting = require('../models/hr/JobPosting');
const Application = require('../models/hr/Application');
const User = require('../models/User');
const EmailService = require('../services/emailService');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function testSequentialApproval() {
  try {
    console.log('🔍 Finding Sarah Ahmed and approval workflow...');
    
    const sarah = await Candidate.findOne({ 
      email: 'sarah.ahmed.nodejs@example.com' 
    });
    
    if (!sarah) {
      console.log('❌ Sarah Ahmed not found.');
      return;
    }
    
    const approval = await CandidateApproval.findOne({ candidate: sarah._id })
      .populate('candidate', 'firstName lastName email phone')
      .populate('jobPosting', 'title department')
      .populate('application', 'applicationId');
    
    if (!approval) {
      console.log('❌ No approval workflow found for Sarah.');
      return;
    }
    
    console.log(`✅ Found approval workflow: ${approval._id}`);
    console.log(`   Current Level: ${approval.currentLevel}`);
    console.log(`   Status: ${approval.status}`);
    
    // Simulate approval at each level
    const levels = [
      { level: 1, email: 'assistant.hr@company.com', name: 'Assistant Manager HR' },
      { level: 2, email: 'manager.hr@company.com', name: 'Manager HR' },
      { level: 3, email: 'hod.hr@company.com', name: 'HOD HR' },
      { level: 4, email: 'vp@company.com', name: 'Vice President' },
      { level: 5, email: 'ceo@company.com', name: 'CEO' }
    ];
    
    for (const levelInfo of levels) {
      console.log(`\n🔄 Processing Level ${levelInfo.level}: ${levelInfo.name}`);
      
      // Find current level in approval
      const currentLevel = approval.approvalLevels.find(l => l.level === levelInfo.level);
      
      if (!currentLevel) {
        console.log(`   ❌ Level ${levelInfo.level} not found in approval levels`);
        continue;
      }
      
      console.log(`   Current Status: ${currentLevel.status}`);
      
      if (currentLevel.status === 'pending') {
        // Simulate approval
        console.log(`   ✅ Approving Level ${levelInfo.level}...`);
        
        currentLevel.status = 'approved';
        currentLevel.approver = '6884f7fc1010ce455f3797e0'; // Admin user ID
        currentLevel.approvedAt = new Date();
        currentLevel.comments = `Approved by ${levelInfo.name} - Candidate meets all requirements`;
        currentLevel.signature = levelInfo.name;
        
        await approval.save();
        
        console.log(`   ✅ Level ${levelInfo.level} approved successfully`);
        
        // Check if this was the final approval
        const approvedLevels = approval.approvalLevels.filter(l => l.status === 'approved').length;
        
        if (approvedLevels === 5) {
          console.log(`\n🎉 ALL LEVELS APPROVED! Finalizing approval...`);
          
          approval.status = 'approved';
          approval.finalDecision = 'approved';
          approval.finalDecisionBy = '6884f7fc1010ce455f3797e0';
          approval.finalDecisionAt = new Date();
          approval.completedAt = new Date();
          
          await approval.save();
          
          // Update candidate status
          await Candidate.findByIdAndUpdate(sarah._id, {
            status: 'approved',
            updatedBy: '6884f7fc1010ce455f3797e0'
          });
          
          console.log(`✅ Candidate status updated to 'approved'`);
          
          // Send appointment letter
          console.log(`📧 Sending appointment letter to candidate...`);
          await EmailService.sendAppointmentLetter(approval);
          console.log(`✅ Appointment letter sent to ${sarah.email}`);
          
          console.log(`\n🎉 COMPLETE WORKFLOW SUCCESSFUL!`);
          break;
        } else {
          // Send email to next level
          const nextLevel = levelInfo.level + 1;
          console.log(`📧 Sending email to Level ${nextLevel}...`);
          
          try {
            await EmailService.sendApprovalRequest(approval, nextLevel);
            console.log(`✅ Email sent to Level ${nextLevel} approver`);
            
            // Update approval status
            approval.currentLevel = nextLevel;
            approval.status = 'in_progress';
            await approval.save();
            
            // Update candidate status
            await Candidate.findByIdAndUpdate(sarah._id, {
              status: 'approval_in_progress',
              updatedBy: '6884f7fc1010ce455f3797e0'
            });
            
          } catch (error) {
            console.error(`❌ Failed to send email to Level ${nextLevel}:`, error.message);
          }
        }
      } else {
        console.log(`   ⏭️  Level ${levelInfo.level} already processed (${currentLevel.status})`);
      }
    }
    
    console.log('\n📊 Final Approval Summary:');
    approval.approvalLevels.forEach(level => {
      const levelNames = {
        1: 'Assistant Manager HR',
        2: 'Manager HR',
        3: 'HOD HR',
        4: 'Vice President',
        5: 'CEO'
      };
      console.log(`   Level ${level.level} (${levelNames[level.level]}): ${level.status}`);
      if (level.status === 'approved') {
        console.log(`     ✅ Approved at: ${level.approvedAt}`);
        console.log(`     📝 Comments: ${level.comments}`);
        console.log(`     ✍️  Signature: ${level.signature}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error during sequential approval test:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testSequentialApproval(); 