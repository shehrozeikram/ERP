const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'shehrozeikram2@gmail.com', // Your Gmail address
        pass: 'khzv jkft zpml uwtj' // Your Gmail app password
      }
    });
  }

  // Send shortlist notification email
  async sendShortlistNotification(candidate, jobPosting, application) {
    try {
      const htmlContent = this.generateShortlistEmailHTML(candidate, jobPosting, application);
      const textContent = this.generateShortlistEmailText(candidate, jobPosting, application);
      
      const mailOptions = {
        from: `"SGC ERP HR Team" <shehrozeikram2@gmail.com>`,
        to: candidate.email,
        subject: `🎉 Congratulations! You've Been Shortlisted - ${jobPosting.title}`,
        html: htmlContent,
        text: textContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Shortlist email sent to ${candidate.email}: ${result.messageId}`);
      
      // Update candidate with email delivery status (only if candidate has _id)
      if (candidate._id) {
        const Candidate = require('../models/hr/Candidate');
        await Candidate.findByIdAndUpdate(candidate._id, {
          $push: {
            emailNotifications: {
              type: 'shortlist',
              jobPosting: jobPosting._id,
              sentAt: new Date(),
              deliveredAt: new Date(), // For Mailtrap, we assume delivered
              deliveryStatus: 'delivered',
              messageId: result.messageId,
              emailContent: {
                subject: mailOptions.subject,
                htmlContent: htmlContent,
                textContent: textContent
              }
            }
          }
        });
      }
      
      return {
        success: true,
        messageId: result.messageId,
        email: candidate.email,
        deliveryStatus: 'delivered'
      };
    } catch (error) {
      console.error(`❌ Failed to send shortlist email to ${candidate.email}:`, error.message);
      
      // Update candidate with failed delivery status (only if candidate has _id)
      if (candidate._id) {
        const Candidate = require('../models/hr/Candidate');
        await Candidate.findByIdAndUpdate(candidate._id, {
          $push: {
            emailNotifications: {
              type: 'shortlist',
              jobPosting: jobPosting._id,
              sentAt: new Date(),
              deliveryStatus: 'failed',
              errorMessage: error.message,
              emailContent: {
                subject: `🎉 Congratulations! You've Been Shortlisted - ${jobPosting.title}`,
                htmlContent: '',
                textContent: ''
              }
            }
          }
        });
      }
      
      return {
        success: false,
        error: error.message,
        email: candidate.email,
        deliveryStatus: 'failed'
      };
    }
  }

  // Send bulk shortlist notifications
  async sendBulkShortlistNotifications(shortlistedApplications) {
    const results = [];
    
    for (const application of shortlistedApplications) {
      try {
        // Handle case where candidate might not exist yet
        let candidate = application.candidate;
        if (!candidate && application.personalInfo) {
          candidate = {
            email: application.personalInfo.email,
            firstName: application.personalInfo.firstName,
            lastName: application.personalInfo.lastName
          };
        }
        
        if (candidate) {
          const result = await this.sendShortlistNotification(
            candidate,
            application.jobPosting,
            application
          );
          results.push(result);
        } else {
          results.push({
            success: false,
            error: 'No candidate information available',
            email: 'Unknown'
          });
        }
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          email: application.candidate?.email || application.personalInfo?.email || 'Unknown'
        });
      }
    }

    return results;
  }

  // Generate HTML email template
  generateShortlistEmailHTML(candidate, jobPosting, application) {
    const evaluation = application.evaluation;
    const score = evaluation?.overallScore || 'N/A';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Shortlist Notification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .highlight { background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50; }
          .score-box { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ffc107; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .button { display: inline-block; background: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .badge { display: inline-block; background: #4caf50; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
            <h2>You've Been Shortlisted</h2>
            <p>Your application has been selected for the next round</p>
          </div>
          
          <div class="content">
            <div class="highlight">
              <h3>Dear ${candidate.firstName} ${candidate.lastName},</h3>
              <p>We are pleased to inform you that your application for the position of <strong>${jobPosting.title}</strong> has been shortlisted!</p>
              <p>Your qualifications and experience have impressed our hiring team, and we would like to move forward with your application.</p>
            </div>

            <div class="score-box">
              <h4>📊 Your Application Score</h4>
              <p><strong>Overall Score:</strong> ${score}/100</p>
              ${evaluation ? `
                <p><strong>Requirements Match:</strong> ${evaluation.requirementsMatch}/100</p>
                <p><strong>Experience Match:</strong> ${evaluation.experienceMatch}/100</p>
                <p><strong>Skills Match:</strong> ${evaluation.skillsMatch}/100</p>
              ` : ''}
            </div>

            <div class="details">
              <h4>📋 Position Details</h4>
              <p><strong>Job Title:</strong> ${jobPosting.title}</p>
              <p><strong>Department:</strong> ${jobPosting.department?.name || 'N/A'}</p>
              <p><strong>Location:</strong> ${jobPosting.location?.name || 'N/A'}</p>
              <p><strong>Employment Type:</strong> ${jobPosting.employmentType?.replace('_', ' ').toUpperCase() || 'N/A'}</p>
              ${jobPosting.salaryRange ? `
                <p><strong>Salary Range:</strong> ${jobPosting.salaryRange.min} - ${jobPosting.salaryRange.max} ${jobPosting.salaryRange.currency}</p>
              ` : ''}
            </div>

            <div class="details">
              <h4>📅 Next Steps</h4>
              <p>Our HR team will contact you within the next few days to schedule an interview and discuss the next steps in the hiring process.</p>
              <p>Please ensure your contact information is up to date and be prepared for a phone call or email from our team.</p>
            </div>

                          <div class="details">
                <h4>📞 Contact Information</h4>
                <p>If you have any questions, please don't hesitate to contact us:</p>
                <p><strong>Email:</strong> shehrozeikram2@gmail.com</p>
                <p><strong>Phone:</strong> +92-XXX-XXXXXXX</p>
              </div>

            <div style="text-align: center; margin: 30px 0;">
              <span class="badge">SHORTLISTED</span>
              <p style="margin-top: 10px; font-size: 14px; color: #666;">
                Application ID: ${application.applicationId || application._id}
              </p>
            </div>
          </div>

          <div class="footer">
            <p>This is an automated message from SGC ERP System</p>
            <p>Please do not reply to this email. For inquiries, contact our HR team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate plain text email template
  generateShortlistEmailText(candidate, jobPosting, application) {
    const evaluation = application.evaluation;
    const score = evaluation?.overallScore || 'N/A';
    
    return `
Congratulations! You've Been Shortlisted

Dear ${candidate.firstName} ${candidate.lastName},

We are pleased to inform you that your application for the position of ${jobPosting.title} has been shortlisted!

Your qualifications and experience have impressed our hiring team, and we would like to move forward with your application.

APPLICATION SCORE:
- Overall Score: ${score}/100
${evaluation ? `
- Requirements Match: ${evaluation.requirementsMatch}/100
- Experience Match: ${evaluation.experienceMatch}/100
- Skills Match: ${evaluation.skillsMatch}/100
` : ''}

POSITION DETAILS:
- Job Title: ${jobPosting.title}
- Department: ${jobPosting.department?.name || 'N/A'}
- Location: ${jobPosting.location?.name || 'N/A'}
- Employment Type: ${jobPosting.employmentType?.replace('_', ' ').toUpperCase() || 'N/A'}
${jobPosting.salaryRange ? `- Salary Range: ${jobPosting.salaryRange.min} - ${jobPosting.salaryRange.max} ${jobPosting.salaryRange.currency}` : ''}

NEXT STEPS:
Our HR team will contact you within the next few days to schedule an interview and discuss the next steps in the hiring process.

Please ensure your contact information is up to date and be prepared for a phone call or email from our team.

CONTACT INFORMATION:
If you have any questions, please don't hesitate to contact us:
- Email: shehrozeikram2@gmail.com
- Phone: +92-XXX-XXXXXXX

Application ID: ${application.applicationId || application._id}

---
This is an automated message from SGC ERP System
Please do not reply to this email. For inquiries, contact our HR team.
    `;
  }

  // Send approval request email
  async sendApprovalRequest(approval, level) {
    try {
      const currentLevel = approval.approvalLevels.find(l => l.level === level);
      const approverEmail = currentLevel.approverEmail;
      
      const htmlContent = this.generateApprovalRequestHTML(approval, level);
      const textContent = this.generateApprovalRequestText(approval, level);
      
      const mailOptions = {
        from: `"SGC ERP HR Team" <shehrozeikram2@gmail.com>`,
        to: approverEmail,
        subject: `🔐 Candidate Approval Required - Level ${level} - ${approval.candidate.firstName} ${approval.candidate.lastName}`,
        html: htmlContent,
        text: textContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Approval request email sent to ${approverEmail}: ${result.messageId}`);
      
      // Update approval with email status
      currentLevel.emailSentAt = new Date();
      currentLevel.emailDeliveredAt = new Date();
      currentLevel.emailStatus = 'delivered';
      await approval.save();
      
      return {
        success: true,
        messageId: result.messageId,
        email: approverEmail,
        deliveryStatus: 'delivered'
      };
    } catch (error) {
      console.error(`❌ Failed to send approval request email:`, error.message);
      
      // Update approval with failed status
      const currentLevel = approval.approvalLevels.find(l => l.level === level);
      currentLevel.emailStatus = 'failed';
      await approval.save();
      
      return {
        success: false,
        error: error.message,
        deliveryStatus: 'failed'
      };
    }
  }

  // Send approval reminder email
  async sendApprovalReminder(approval, level) {
    try {
      const currentLevel = approval.approvalLevels.find(l => l.level === level);
      const approverEmail = currentLevel.approverEmail;
      
      const htmlContent = this.generateApprovalReminderHTML(approval, level);
      const textContent = this.generateApprovalReminderText(approval, level);
      
      const mailOptions = {
        from: `"SGC ERP HR Team" <shehrozeikram2@gmail.com>`,
        to: approverEmail,
        subject: `⏰ Reminder: Candidate Approval Pending - Level ${level} - ${approval.candidate.firstName} ${approval.candidate.lastName}`,
        html: htmlContent,
        text: textContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Approval reminder email sent to ${approverEmail}: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId,
        email: approverEmail,
        deliveryStatus: 'delivered'
      };
    } catch (error) {
      console.error(`❌ Failed to send approval reminder email:`, error.message);
      return {
        success: false,
        error: error.message,
        deliveryStatus: 'failed'
      };
    }
  }

  // Send appointment letter to candidate
  async sendAppointmentLetter(approval) {
    try {
      const htmlContent = this.generateAppointmentLetterHTML(approval);
      const textContent = this.generateAppointmentLetterText(approval);
      
      const mailOptions = {
        from: `"SGC ERP HR Team" <shehrozeikram2@gmail.com>`,
        to: approval.candidate.email,
        subject: `🎉 Congratulations! Appointment Letter - ${approval.jobPosting.title}`,
        html: htmlContent,
        text: textContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Appointment letter sent to ${approval.candidate.email}: ${result.messageId}`);
      
      // Update approval with email notification
      approval.emailNotifications.push({
        type: 'appointment_letter',
        sentTo: approval.candidate.email,
        sentAt: new Date(),
        deliveredAt: new Date(),
        status: 'delivered',
        messageId: result.messageId
      });
      await approval.save();
      
      return {
        success: true,
        messageId: result.messageId,
        email: approval.candidate.email,
        deliveryStatus: 'delivered'
      };
    } catch (error) {
      console.error(`❌ Failed to send appointment letter:`, error.message);
      return {
        success: false,
        error: error.message,
        deliveryStatus: 'failed'
      };
    }
  }

  // Send hiring confirmation email to candidate
  async sendHiringConfirmation(approval) {
    try {
      const htmlContent = this.generateHiringConfirmationHTML(approval);
      const textContent = this.generateHiringConfirmationText(approval);
      
      const mailOptions = {
        from: `"SGC ERP HR Team" <shehrozeikram2@gmail.com>`,
        to: approval.candidate.email,
        subject: `🎉 Congratulations! You're Hired - ${approval.jobPosting.title}`,
        html: htmlContent,
        text: textContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Hiring confirmation email sent to ${approval.candidate.email}: ${result.messageId}`);
      
      // Update approval with email notification
      approval.emailNotifications.push({
        type: 'hiring_confirmation',
        sentTo: approval.candidate.email,
        sentAt: new Date(),
        deliveredAt: new Date(),
        status: 'delivered',
        messageId: result.messageId
      });
      await approval.save();
      
      return {
        success: true,
        messageId: result.messageId,
        email: approval.candidate.email,
        deliveryStatus: 'delivered'
      };
    } catch (error) {
      console.error(`❌ Failed to send hiring confirmation email:`, error.message);
      return {
        success: false,
        error: error.message,
        deliveryStatus: 'failed'
      };
    }
  }

  // Send employee onboarding email to candidate
  async sendEmployeeOnboardingEmail(approval, onboarding) {
    try {
      const htmlContent = this.generateEmployeeOnboardingHTML(approval, onboarding);
      const textContent = this.generateEmployeeOnboardingText(approval, onboarding);
      
      const mailOptions = {
        from: `"SGC ERP HR Team" <shehrozeikram2@gmail.com>`,
        to: approval.candidate.email,
        subject: `🚀 Complete Your Employee Onboarding - ${approval.jobPosting.title}`,
        html: htmlContent,
        text: textContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Employee onboarding email sent to ${approval.candidate.email}: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId,
        email: approval.candidate.email,
        deliveryStatus: 'delivered'
      };
    } catch (error) {
      console.error(`❌ Failed to send employee onboarding email:`, error.message);
      return {
        success: false,
        error: error.message,
        deliveryStatus: 'failed'
      };
    }
  }

  // Generate approval request HTML
  generateApprovalRequestHTML(approval, level) {
    const currentLevel = approval.approvalLevels.find(l => l.level === level);
    const levelTitles = {
      1: 'Assistant Manager HR',
      2: 'Manager HR',
      3: 'HOD HR',
      4: 'Vice President',
      5: 'CEO'
    };
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Candidate Approval Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .candidate-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #3498db; }
          .approval-button { display: inline-block; background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          .reject-button { display: inline-block; background: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .badge { background: #f39c12; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Candidate Approval Required</h1>
            <p>Level ${level}: ${levelTitles[level]}</p>
          </div>
          
          <div class="content">
            <p>Dear ${levelTitles[level]},</p>
            
            <p>A candidate has passed the interview process and requires your approval to proceed with the hiring process.</p>
            
            <div class="candidate-info">
              <h3>📋 Candidate Information</h3>
              <p><strong>Name:</strong> ${approval.candidate.firstName} ${approval.candidate.lastName}</p>
              <p><strong>Email:</strong> ${approval.candidate.email}</p>
              <p><strong>Phone:</strong> ${approval.candidate.phone}</p>
              <p><strong>Position:</strong> ${approval.jobPosting.title}</p>
              <p><strong>Department:</strong> ${approval.jobPosting.department?.name || 'N/A'}</p>
              <p><strong>Application ID:</strong> ${approval.application.applicationId || approval.application._id}</p>
            </div>
            
            <div class="candidate-info">
              <h3>📊 Interview Results</h3>
              <p>The candidate has successfully passed all interview stages and technical assessments.</p>
              <p><strong>Status:</strong> <span class="badge">PASSED INTERVIEW</span></p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p><strong>Please review the candidate's information and provide your approval:</strong></p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/public-approval/${approval._id}" class="approval-button">Review & Approve</a>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/public-approval/${approval._id}" class="reject-button">Review & Reject</a>
            </div>
            
            ${this.generatePreviousApprovalsHTML(approval, level)}
            
            <div class="candidate-info">
              <h3>⚠️ Important Notes</h3>
              <ul>
                <li>This approval is part of a 5-level hierarchical approval process</li>
                <li>Your approval is required before the process can proceed to the next level</li>
                <li>You can add comments and provide your digital signature during approval</li>
                <li>If you reject, the process will stop and the candidate will be notified</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated message from SGC ERP System</p>
            <p>Please do not reply to this email. For inquiries, contact our HR team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate approval request text
  generatePreviousApprovalsHTML(approval, level) {
    if (level === 1) {
      return ''; // No previous approvals for level 1
    }
    
    const previousApprovals = approval.approvalLevels
      .filter(l => l.level < level && l.status === 'approved')
      .sort((a, b) => a.level - b.level);
    
    if (previousApprovals.length === 0) {
      return '';
    }
    
    const levelTitles = {
      1: 'Assistant Manager HR',
      2: 'Manager HR',
      3: 'HOD HR',
      4: 'Vice President',
      5: 'CEO'
    };
    
    const approvalsHTML = previousApprovals.map(approval => `
      <div style="background: #e8f5e8; padding: 10px; margin: 5px 0; border-left: 4px solid #27ae60; border-radius: 3px;">
        <strong>Level ${approval.level}: ${levelTitles[approval.level]}</strong><br>
        <strong>Status:</strong> ✅ Approved<br>
        <strong>Approved At:</strong> ${new Date(approval.approvedAt).toLocaleString()}<br>
        ${approval.comments ? `<strong>Comments:</strong> ${approval.comments}<br>` : ''}
        ${approval.signature ? `<strong>Signature:</strong> ${approval.signature}<br>` : ''}
      </div>
    `).join('');
    
    return `
      <div class="candidate-info">
        <h3>📋 Previous Approvals</h3>
        ${approvalsHTML}
      </div>
    `;
  }

  generatePreviousApprovalsText(approval, level) {
    if (level === 1) {
      return ''; // No previous approvals for level 1
    }
    
    const previousApprovals = approval.approvalLevels
      .filter(l => l.level < level && l.status === 'approved')
      .sort((a, b) => a.level - b.level);
    
    if (previousApprovals.length === 0) {
      return '';
    }
    
    const levelTitles = {
      1: 'Assistant Manager HR',
      2: 'Manager HR',
      3: 'HOD HR',
      4: 'Vice President',
      5: 'CEO'
    };
    
    let text = '\nPREVIOUS APPROVALS:\n';
    previousApprovals.forEach(approval => {
      text += `- Level ${approval.level}: ${levelTitles[approval.level]} - ✅ Approved\n`;
      text += `  Approved At: ${new Date(approval.approvedAt).toLocaleString()}\n`;
      if (approval.comments) {
        text += `  Comments: ${approval.comments}\n`;
      }
      if (approval.signature) {
        text += `  Signature: ${approval.signature}\n`;
      }
      text += '\n';
    });
    
    return text;
  }

  generateApprovalRequestText(approval, level) {
    const levelTitles = {
      1: 'Assistant Manager HR',
      2: 'Manager HR',
      3: 'HOD HR',
      4: 'Vice President',
      5: 'CEO'
    };
    
    return `
Candidate Approval Request - Level ${level}: ${levelTitles[level]}

Dear ${levelTitles[level]},

A candidate has passed the interview process and requires your approval to proceed with the hiring process.

CANDIDATE INFORMATION:
- Name: ${approval.candidate.firstName} ${approval.candidate.lastName}
- Email: ${approval.candidate.email}
- Phone: ${approval.candidate.phone}
- Position: ${approval.jobPosting.title}
- Department: ${approval.jobPosting.department?.name || 'N/A'}
- Application ID: ${approval.application.applicationId || approval.application._id}

INTERVIEW RESULTS:
The candidate has successfully passed all interview stages and technical assessments.
Status: PASSED INTERVIEW

APPROVAL PROCESS:
This approval is part of a 5-level hierarchical approval process:
1. Assistant Manager HR
2. Manager HR
3. HOD HR
4. Vice President
5. CEO

Your approval is required before the process can proceed to the next level.

${this.generatePreviousApprovalsText(approval, level)}

TO APPROVE OR REJECT:
Please visit: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/public-approval/${approval._id}

You can add comments and provide your digital signature during approval.

IMPORTANT NOTES:
- If you reject, the process will stop and the candidate will be notified
- Your decision will be recorded with timestamp and signature
- You can review all candidate documents and interview feedback

---
This is an automated message from SGC ERP System
Please do not reply to this email. For inquiries, contact our HR team.
    `;
  }

  // Generate approval reminder HTML
  generateApprovalReminderHTML(approval, level) {
    const currentLevel = approval.approvalLevels.find(l => l.level === level);
    const levelTitles = {
      1: 'Assistant Manager HR',
      2: 'Manager HR',
      3: 'HOD HR',
      4: 'Vice President',
      5: 'CEO'
    };
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Approval Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f39c12; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .reminder { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .approval-button { display: inline-block; background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Approval Reminder</h1>
            <p>Level ${level}: ${levelTitles[level]}</p>
          </div>
          
          <div class="content">
            <div class="reminder">
              <h3>🔔 Reminder</h3>
              <p>This is a friendly reminder that you have a pending candidate approval request.</p>
              <p><strong>Candidate:</strong> ${approval.candidate.firstName} ${approval.candidate.lastName}</p>
              <p><strong>Position:</strong> ${approval.jobPosting.title}</p>
              <p><strong>Application ID:</strong> ${approval.application.applicationId || approval.application._id}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/approvals/${approval._id}" class="approval-button">Review & Approve Now</a>
            </div>
            
            <p>Please review and provide your approval to keep the hiring process moving forward.</p>
          </div>
          
          <div class="footer">
            <p>This is an automated reminder from SGC ERP System</p>
            <p>Please do not reply to this email. For inquiries, contact our HR team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate approval reminder text
  generateApprovalReminderText(approval, level) {
    const levelTitles = {
      1: 'Assistant Manager HR',
      2: 'Manager HR',
      3: 'HOD HR',
      4: 'Vice President',
      5: 'CEO'
    };
    
    return `
Approval Reminder - Level ${level}: ${levelTitles[level]}

This is a friendly reminder that you have a pending candidate approval request.

CANDIDATE INFORMATION:
- Name: ${approval.candidate.firstName} ${approval.candidate.lastName}
- Position: ${approval.jobPosting.title}
- Application ID: ${approval.application.applicationId || approval.application._id}

Please review and provide your approval to keep the hiring process moving forward.

TO APPROVE:
Please visit: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/approvals/${approval._id}

---
This is an automated reminder from SGC ERP System
Please do not reply to this email. For inquiries, contact our HR team.
    `;
  }

  // Generate appointment letter HTML
  generateAppointmentLetterHTML(approval) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appointment Letter</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #27ae60; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .offer-details { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #27ae60; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .badge { background: #27ae60; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
            <p>Your Appointment Letter</p>
          </div>
          
          <div class="content">
            <p>Dear ${approval.candidate.firstName} ${approval.candidate.lastName},</p>
            
            <p>We are delighted to inform you that after a thorough review of your application and successful completion of our interview process, we are pleased to offer you the position of <strong>${approval.jobPosting.title}</strong> at our organization.</p>
            
            <div class="offer-details">
              <h3>📋 Position Details</h3>
              <p><strong>Job Title:</strong> ${approval.jobPosting.title}</p>
              <p><strong>Department:</strong> ${approval.jobPosting.department?.name || 'N/A'}</p>
              <p><strong>Application ID:</strong> ${approval.application.applicationId || approval.application._id}</p>
              <p><strong>Status:</strong> <span class="badge">APPROVED</span></p>
            </div>
            
            <div class="offer-details">
              <h3>✅ Approval Process Completed</h3>
              <p>Your application has been successfully approved through our 5-level hierarchical approval process:</p>
              <ol>
                <li>✅ Assistant Manager HR - Approved</li>
                <li>✅ Manager HR - Approved</li>
                <li>✅ HOD HR - Approved</li>
                <li>✅ Vice President - Approved</li>
                <li>✅ CEO - Approved</li>
              </ol>
            </div>
            
            <div class="offer-details">
              <h3>📞 Next Steps</h3>
              <p>Our HR team will contact you within the next 2-3 business days to discuss:</p>
              <ul>
                <li>Detailed offer letter and compensation package</li>
                <li>Employment terms and conditions</li>
                <li>Onboarding process and start date</li>
                <li>Required documentation and background checks</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p><strong>Welcome to our team!</strong></p>
              <p>We look forward to having you join us and contribute to our organization's success.</p>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated message from SGC ERP System</p>
            <p>Please do not reply to this email. For inquiries, contact our HR team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate appointment letter text
  generateAppointmentLetterText(approval) {
    return `
Congratulations! Your Appointment Letter

Dear ${approval.candidate.firstName} ${approval.candidate.lastName},

We are delighted to inform you that after a thorough review of your application and successful completion of our interview process, we are pleased to offer you the position of ${approval.jobPosting.title} at our organization.

POSITION DETAILS:
- Job Title: ${approval.jobPosting.title}
- Department: ${approval.jobPosting.department?.name || 'N/A'}
- Application ID: ${approval.application.applicationId || approval.application._id}
- Status: APPROVED

APPROVAL PROCESS COMPLETED:
Your application has been successfully approved through our 5-level hierarchical approval process:
1. ✅ Assistant Manager HR - Approved
2. ✅ Manager HR - Approved
3. ✅ HOD HR - Approved
4. ✅ Vice President - Approved
5. ✅ CEO - Approved

NEXT STEPS:
Our HR team will contact you within the next 2-3 business days to discuss:
- Detailed offer letter and compensation package
- Employment terms and conditions
- Onboarding process and start date
- Required documentation and background checks

Welcome to our team! We look forward to having you join us and contribute to our organization's success.

---
This is an automated message from SGC ERP System
Please do not reply to this email. For inquiries, contact our HR team.
    `;
  }

  // Send job offer email
  async sendJobOffer(candidate, jobPosting, offerDetails) {
    try {
      const htmlContent = this.generateJobOfferHTML(candidate, jobPosting, offerDetails);
      const textContent = this.generateJobOfferText(candidate, jobPosting, offerDetails);
      
      const mailOptions = {
        from: `"SGC ERP HR Team" <shehrozeikram2@gmail.com>`,
        to: candidate.email,
        subject: `🎉 Job Offer - ${jobPosting.title} Position`,
        html: htmlContent,
        text: textContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Job offer email sent to ${candidate.email}: ${result.messageId}`);
      
      // Update candidate with email delivery status
      if (candidate._id) {
        const Candidate = require('../models/hr/Candidate');
        await Candidate.findByIdAndUpdate(candidate._id, {
          $push: {
            emailNotifications: {
              type: 'offer',
              jobPosting: jobPosting._id,
              sentAt: new Date(),
              deliveredAt: new Date(),
              deliveryStatus: 'delivered',
              messageId: result.messageId,
              emailContent: {
                subject: mailOptions.subject,
                htmlContent: htmlContent,
                textContent: textContent
              }
            }
          }
        });
      }
      
      return {
        success: true,
        messageId: result.messageId,
        email: candidate.email,
        deliveryStatus: 'delivered'
      };
    } catch (error) {
      console.error(`❌ Failed to send job offer email to ${candidate.email}:`, error.message);
      return {
        success: false,
        error: error.message,
        email: candidate.email,
        deliveryStatus: 'failed'
      };
    }
  }

  // Send offer acceptance confirmation email
  async sendOfferAcceptanceConfirmation(candidate, jobPosting) {
    try {
      const htmlContent = this.generateOfferAcceptanceHTML(candidate, jobPosting);
      const textContent = this.generateOfferAcceptanceText(candidate, jobPosting);
      
      const mailOptions = {
        from: `"SGC ERP HR Team" <shehrozeikram2@gmail.com>`,
        to: candidate.email,
        subject: `✅ Offer Accepted - ${jobPosting.title} Position`,
        html: htmlContent,
        text: textContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Offer acceptance confirmation sent to ${candidate.email}: ${result.messageId}`);
      
      // Update candidate with email delivery status
      if (candidate._id) {
        const Candidate = require('../models/hr/Candidate');
        await Candidate.findByIdAndUpdate(candidate._id, {
          $push: {
            emailNotifications: {
              type: 'offer_accepted',
              jobPosting: jobPosting._id,
              sentAt: new Date(),
              deliveredAt: new Date(),
              deliveryStatus: 'delivered',
              messageId: result.messageId,
              emailContent: {
                subject: mailOptions.subject,
                htmlContent: htmlContent,
                textContent: textContent
              }
            }
          }
        });
      }
      
      return {
        success: true,
        messageId: result.messageId,
        email: candidate.email,
        deliveryStatus: 'delivered'
      };
    } catch (error) {
      console.error(`❌ Failed to send offer acceptance confirmation to ${candidate.email}:`, error.message);
      return {
        success: false,
        error: error.message,
        email: candidate.email,
        deliveryStatus: 'failed'
      };
    }
  }

  // Generate job offer HTML
  generateJobOfferHTML(candidate, jobPosting, offerDetails) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Offer - ${jobPosting.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .offer-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #27ae60; }
          .salary { font-size: 24px; color: #27ae60; font-weight: bold; }
          .cta-button { display: inline-block; background: #27ae60; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
            <h2>You've Been Offered the Position</h2>
          </div>
          
          <div class="content">
            <p>Dear <strong>${candidate.firstName} ${candidate.lastName}</strong>,</p>
            
            <p>We are delighted to inform you that after careful consideration of your application and interview performance, we are pleased to offer you the position of <strong>${jobPosting.title}</strong> at our organization.</p>
            
            <div class="offer-details">
              <h3>📋 Offer Details</h3>
              <p><strong>Position:</strong> ${jobPosting.title}</p>
              <p><strong>Department:</strong> ${offerDetails.department || jobPosting.department?.name || 'N/A'}</p>
              <p><strong>Offered Salary:</strong> <span class="salary">PKR ${offerDetails.salary?.toLocaleString() || 'To be discussed'}</span></p>
              <p><strong>Offer Date:</strong> ${new Date().toLocaleDateString()}</p>
              <p><strong>Offer Expires:</strong> ${offerDetails.expiryDate || '7 days from today'}</p>
            </div>
            
            <div class="offer-details">
              <h3>📝 Next Steps</h3>
              <p>To accept this offer, please click the button below:</p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/candidates/offer/${candidate._id}" class="cta-button">✅ Accept Offer</a>
              
              <p><strong>Important:</strong> This offer is valid for ${offerDetails.expiryDate || '7 days'}. Please respond within this timeframe.</p>
            </div>
            
            <div class="offer-details">
              <h3>📞 Questions?</h3>
              <p>If you have any questions about this offer or need clarification on any terms, please don't hesitate to contact our HR team.</p>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated message from SGC ERP System</p>
            <p>Please do not reply to this email. For inquiries, contact our HR team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate job offer text
  generateJobOfferText(candidate, jobPosting, offerDetails) {
    return `
Congratulations! You've Been Offered the Position

Dear ${candidate.firstName} ${candidate.lastName},

We are delighted to inform you that after careful consideration of your application and interview performance, we are pleased to offer you the position of ${jobPosting.title} at our organization.

OFFER DETAILS:
- Position: ${jobPosting.title}
- Department: ${offerDetails.department || jobPosting.department?.name || 'N/A'}
- Offered Salary: PKR ${offerDetails.salary?.toLocaleString() || 'To be discussed'}
- Offer Date: ${new Date().toLocaleDateString()}
- Offer Expires: ${offerDetails.expiryDate || '7 days from today'}

NEXT STEPS:
To accept this offer, please visit: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/candidates/offer/${candidate._id}

Important: This offer is valid for ${offerDetails.expiryDate || '7 days'}. Please respond within this timeframe.

If you have any questions about this offer or need clarification on any terms, please don't hesitate to contact our HR team.

---
This is an automated message from SGC ERP System
Please do not reply to this email. For inquiries, contact our HR team.
    `;
  }

  // Generate offer acceptance HTML
  generateOfferAcceptanceHTML(candidate, jobPosting) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Offer Accepted - ${jobPosting.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #27ae60; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .status { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #27ae60; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Offer Accepted!</h1>
            <h2>Welcome to Our Team</h2>
          </div>
          
          <div class="content">
            <p>Dear <strong>${candidate.firstName} ${candidate.lastName}</strong>,</p>
            
            <p>Thank you for accepting our offer for the position of <strong>${jobPosting.title}</strong>! We're excited to have you join our team.</p>
            
            <div class="status">
              <h3>📋 Current Status</h3>
              <p><strong>Status:</strong> Offer Accepted</p>
              <p><strong>Next Step:</strong> Approval Pending</p>
              <p><strong>Timeline:</strong> 2-3 business days for final approval</p>
            </div>
            
            <div class="status">
              <h3>📝 What Happens Next?</h3>
              <p>1. Your acceptance has been recorded in our system</p>
              <p>2. Our HR team will review and process your application</p>
              <p>3. You'll receive final approval confirmation within 2-3 business days</p>
              <p>4. We'll then proceed with onboarding and employment documentation</p>
            </div>
            
            <div class="status">
              <h3>📞 Stay Connected</h3>
              <p>We'll keep you updated on the progress. If you have any questions, please contact our HR team.</p>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated message from SGC ERP System</p>
            <p>Please do not reply to this email. For inquiries, contact our HR team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate offer acceptance text
  generateOfferAcceptanceText(candidate, jobPosting) {
    return `
Offer Accepted! Welcome to Our Team

Dear ${candidate.firstName} ${candidate.lastName},

Thank you for accepting our offer for the position of ${jobPosting.title}! We're excited to have you join our team.

CURRENT STATUS:
- Status: Offer Accepted
- Next Step: Approval Pending
- Timeline: 2-3 business days for final approval

WHAT HAPPENS NEXT?
1. Your acceptance has been recorded in our system
2. Our HR team will review and process your application
3. You'll receive final approval confirmation within 2-3 business days
4. We'll then proceed with onboarding and employment documentation

Stay connected! We'll keep you updated on the progress. If you have any questions, please contact our HR team.

---
This is an automated message from SGC ERP System
Please do not reply to this email. For inquiries, contact our HR team.
    `;
  }

  // Generate hiring confirmation HTML
  generateHiringConfirmationHTML(approval) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Congratulations! You're Hired</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #27ae60; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .status { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #27ae60; }
          .next-steps { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #f39c12; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .badge { background: #27ae60; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
            <h2>You're Officially Hired!</h2>
            <p>Welcome to the SGC Family</p>
          </div>
          
          <div class="content">
            <p>Dear <strong>${approval.candidate.firstName} ${approval.candidate.lastName}</strong>,</p>
            
            <p>We are thrilled to inform you that after a thorough review and approval process, you have been <strong>officially hired</strong> for the position of <strong>${approval.jobPosting.title}</strong> at SGC!</p>
            
            <div class="status">
              <h3>✅ Final Status</h3>
              <p><strong>Status:</strong> <span class="badge">HIRED</span></p>
              <p><strong>Position:</strong> ${approval.jobPosting.title}</p>
              <p><strong>Department:</strong> ${approval.jobPosting.department?.name || 'N/A'}</p>
              <p><strong>Application ID:</strong> ${approval.application.applicationId || approval.application._id}</p>
            </div>
            
            <div class="status" style="text-align: center; background: #fff3cd; border-left: 4px solid #ffc107;">
              <h3>📄 Important: Complete Your Joining Document</h3>
              <p>To complete your onboarding process, you need to fill out and submit the official joining document. This document is required for your employment records and must be completed within 48 hours.</p>
              
              <p><strong>Please click the button below to access and complete your joining document:</strong></p>
              
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/public-joining-document/${approval._id}" style="display: inline-block; background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                📝 Complete Joining Document
              </a>
              
              <p><em>Note: This document will be automatically saved to your employee record once completed.</em></p>
            </div>
            
            <div class="next-steps">
              <h3>🚀 What Happens Next?</h3>
              <p><strong>1. Onboarding Process:</strong> Our HR team will contact you within 24-48 hours to begin the onboarding process.</p>
              <p><strong>2. Documentation:</strong> You'll receive employment contracts and required documentation to review and sign.</p>
              <p><strong>3. Start Date:</strong> We'll discuss and confirm your official start date.</p>
              <p><strong>4. Welcome Package:</strong> You'll receive company information, policies, and welcome materials.</p>
            </div>
            
            <div class="status">
              <h3>📞 Contact Information</h3>
              <p>If you have any questions about the onboarding process or need to discuss your start date, please contact our HR team.</p>
              <p><strong>Email:</strong> hr@sgc.com</p>
              <p><strong>Phone:</strong> +92-XXX-XXXXXXX</p>
            </div>
            
            <div class="next-steps">
              <h3>🎯 Welcome to the Team!</h3>
              <p>We're excited to have you join our organization and look forward to working together. Your skills and experience will be valuable assets to our team.</p>
              <p>Once again, congratulations on your new role!</p>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated message from SGC ERP System</p>
            <p>Please do not reply to this email. For inquiries, contact our HR team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate hiring confirmation text
  generateHiringConfirmationText(approval) {
    return `
Congratulations! You're Officially Hired!

Dear ${approval.candidate.firstName} ${approval.candidate.lastName},

We are thrilled to inform you that after a thorough review and approval process, you have been officially hired for the position of ${approval.jobPosting.title} at SGC!

FINAL STATUS:
- Status: HIRED
- Position: ${approval.jobPosting.title}
- Department: ${approval.jobPosting.department?.name || 'N/A'}
- Application ID: ${approval.application.applicationId || approval.application._id}

IMPORTANT: COMPLETE YOUR JOINING DOCUMENT
To complete your onboarding process, you need to fill out and submit the official joining document. This document is required for your employment records and must be completed within 48 hours.

Please visit this link to complete your joining document:
${process.env.FRONTEND_URL || 'http://localhost:3000'}/public-joining-document/${approval._id}

WHAT HAPPENS NEXT?
1. Onboarding Process: Our HR team will contact you within 24-48 hours to begin the onboarding process.
2. Documentation: You'll receive employment contracts and required documentation to review and sign.
3. Start Date: We'll discuss and confirm your official start date.
4. Welcome Package: You'll receive company information, policies, and welcome materials.

CONTACT INFORMATION:
If you have any questions about the onboarding process or need to discuss your start date, please contact our HR team.
- Email: hr@sgc.com
- Phone: +92-XXX-XXXXXXX

WELCOME TO THE TEAM!
We're excited to have you join our organization and look forward to working together. Your skills and experience will be valuable assets to our team.

Once again, congratulations on your new role!

---
This is an automated message from SGC ERP System
Please do not reply to this email. For inquiries, contact our HR team.
    `;
  }

  // Generate employee onboarding HTML
  generateEmployeeOnboardingHTML(approval, onboarding) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Complete Your Employee Onboarding</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3498db; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .status { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #3498db; }
          .next-steps { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #f39c12; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .badge { background: #3498db; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 Welcome to SGC!</h1>
            <h2>Complete Your Employee Onboarding</h2>
            <p>Next Step: Employee Registration</p>
          </div>
          
          <div class="content">
            <p>Dear <strong>${approval.candidate.firstName} ${approval.candidate.lastName}</strong>,</p>
            
            <p>Congratulations on completing your joining document! Now it's time to complete your employee onboarding process. This will create your official employee record in our system.</p>
            
            <div class="status">
              <h3>✅ Current Status</h3>
              <p><strong>Status:</strong> <span class="badge">JOINING DOCUMENT COMPLETED</span></p>
              <p><strong>Position:</strong> ${approval.jobPosting.title}</p>
              <p><strong>Department:</strong> ${approval.jobPosting.department?.name || 'N/A'}</p>
              <p><strong>Onboarding ID:</strong> ${onboarding._id}</p>
            </div>
            
            <div class="status" style="text-align: center; background: #d1ecf1; border-left: 4px solid #17a2b8;">
              <h3>📋 Complete Your Employee Profile</h3>
              <p>To finalize your employment, you need to complete your employee onboarding form. This includes:</p>
              <ul style="text-align: left; display: inline-block;">
                <li>Personal information and contact details</li>
                <li>Employment details and start date</li>
                <li>Bank account information</li>
                <li>Emergency contacts</li>
                <li>Required documents and certificates</li>
              </ul>
              
              <p><strong>Please click the button below to complete your employee onboarding:</strong></p>
              
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/public-employee-onboarding/${onboarding._id}" style="display: inline-block; background: #17a2b8; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                🚀 Complete Employee Onboarding
              </a>
              
              <p><em>Note: This form will create your employee record with draft status. HR will review and activate your account.</em></p>
            </div>
            
            <div class="next-steps">
              <h3>🔄 What Happens Next?</h3>
              <p><strong>1. Complete Onboarding Form:</strong> Fill out all required employee information</p>
              <p><strong>2. HR Review:</strong> Our HR team will review your information</p>
              <p><strong>3. Account Activation:</strong> Your employee account will be activated</p>
              <p><strong>4. Welcome Package:</strong> You'll receive access to company systems and policies</p>
            </div>
            
            <div class="status">
              <h3>📞 Need Help?</h3>
              <p>If you have any questions about the onboarding process or need assistance, please contact our HR team.</p>
              <p><strong>Email:</strong> hr@sgc.com</p>
              <p><strong>Phone:</strong> +92-XXX-XXXXXXX</p>
            </div>
            
            <div class="next-steps">
              <h3>🎯 Almost There!</h3>
              <p>You're just one step away from becoming an official SGC employee. Complete your onboarding form to get started!</p>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated message from SGC ERP System</p>
            <p>Please do not reply to this email. For inquiries, contact our HR team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate employee onboarding text
  generateEmployeeOnboardingText(approval, onboarding) {
    return `
Complete Your Employee Onboarding

Dear ${approval.candidate.firstName} ${approval.candidate.lastName},

Congratulations on completing your joining document! Now it's time to complete your employee onboarding process. This will create your official employee record in our system.

CURRENT STATUS:
- Status: JOINING DOCUMENT COMPLETED
- Position: ${approval.jobPosting.title}
- Department: ${approval.jobPosting.department?.name || 'N/A'}
- Onboarding ID: ${onboarding._id}

COMPLETE YOUR EMPLOYEE PROFILE:
To finalize your employment, you need to complete your employee onboarding form. This includes:
- Personal information and contact details
- Employment details and start date
- Bank account information
- Emergency contacts
- Required documents and certificates

Please visit this link to complete your employee onboarding:
${process.env.FRONTEND_URL || 'http://localhost:3000'}/public-employee-onboarding/${onboarding._id}

WHAT HAPPENS NEXT?
1. Complete Onboarding Form: Fill out all required employee information
2. HR Review: Our HR team will review your information
3. Account Activation: Your employee account will be activated
4. Welcome Package: You'll receive access to company systems and policies

NEED HELP?
If you have any questions about the onboarding process or need assistance, please contact our HR team.
- Email: hr@sgc.com
- Phone: +92-XXX-XXXXXXX

ALMOST THERE!
You're just one step away from becoming an official SGC employee. Complete your onboarding form to get started!

---
This is an automated message from SGC ERP System
Please do not reply to this email. For inquiries, contact our HR team.
    `;
  }

  // Test email configuration
  async testEmailConfig() {
    try {
      const testEmail = {
        from: `"SGC ERP Test" <shehrozeikram2@gmail.com>`,
        to: 'shehroze.ikram@txy.co',
        subject: 'SGC ERP Email Service Test',
        text: 'This is a test email to verify the email service configuration.',
        html: '<h1>Email Service Test</h1><p>This is a test email to verify the email service configuration.</p>'
      };

      const result = await this.transporter.sendMail(testEmail);
      return {
        success: true,
        messageId: result.messageId,
        message: 'Email service is working correctly'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Email service configuration error'
      };
    }
  }
}

module.exports = new EmailService(); 