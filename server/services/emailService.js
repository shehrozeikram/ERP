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