const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'sandbox.smtp.mailtrap.io',
      port: 2525,
      secure: false,
      auth: {
        user: '0d5770511c00f0',
        pass: '53d7800c0f72cf'
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
      
      // Update candidate with email delivery status
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
      
      return {
        success: true,
        messageId: result.messageId,
        email: candidate.email,
        deliveryStatus: 'delivered'
      };
    } catch (error) {
      console.error(`❌ Failed to send shortlist email to ${candidate.email}:`, error.message);
      
      // Update candidate with failed delivery status
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
        const result = await this.sendShortlistNotification(
          application.candidate,
          application.jobPosting,
          application
        );
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          email: application.candidate?.email || 'Unknown'
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