# Email Notification System Setup Guide

This guide will help you configure the email notification system to send shortlist notifications to candidates from your email address `shehroze.ikram@txy.co`.

## 📧 Email Configuration

### For Gmail (Recommended)

1. **Enable 2-Factor Authentication**
   - Go to your Google Account settings
   - Navigate to Security
   - Enable 2-Step Verification

2. **Generate App Password**
   - Go to Google Account settings
   - Navigate to Security → 2-Step Verification
   - Click on "App passwords"
   - Select "Mail" and "Other (Custom name)"
   - Enter "SGC ERP" as the name
   - Copy the generated 16-character password

3. **Update Environment Variables**
   ```env
   # Email Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=shehroze.ikram@txy.co
   SMTP_PASS=your_16_character_app_password
   EMAIL_PASSWORD=your_16_character_app_password
   ```

### For Other Email Providers

#### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=shehroze.ikram@txy.co
SMTP_PASS=your_password
```

#### Yahoo Mail
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=shehroze.ikram@txy.co
SMTP_PASS=your_app_password
```

#### Custom SMTP Server
```env
SMTP_HOST=your_smtp_server.com
SMTP_PORT=587
SMTP_USER=shehroze.ikram@txy.co
SMTP_PASS=your_password
```

## 🧪 Testing the Email System

1. **Run the test script**
   ```bash
   cd server
   node scripts/testEmailSystem.js
   ```

2. **Check the output**
   - ✅ Email service is working correctly
   - ✅ Test email sent successfully
   - ✅ Individual email sending tested
   - ✅ Bulk email sending tested

3. **Verify in your inbox**
   - Check your email inbox for test emails
   - Verify the email content and formatting

## 📋 Email Features

### Automatic Email Sending
- ✅ **Individual Notifications**: Emails sent automatically when candidates are shortlisted
- ✅ **Bulk Notifications**: Send emails to all shortlisted candidates at once
- ✅ **Professional Templates**: Beautiful HTML and plain text email templates
- ✅ **Personalized Content**: Includes candidate name, job details, and application score

### Email Content
- 🎉 **Congratulations Message**: Professional shortlist notification
- 📊 **Application Score**: Shows evaluation results (overall score, requirements match, etc.)
- 📋 **Position Details**: Job title, department, location, salary range
- 📅 **Next Steps**: Clear instructions for the hiring process
- 📞 **Contact Information**: Your email and phone number

### Email Template Features
- 🎨 **Beautiful Design**: Professional gradient header and clean layout
- 📱 **Mobile Responsive**: Works well on all devices
- 🎯 **Branded**: Includes your company information
- 📊 **Score Display**: Shows application evaluation scores
- 🔗 **Application ID**: Includes unique application identifier

## 🚀 Using the Email System

### In HR Interface
1. **Go to Applications section**
2. **Click "Send Emails" button**
3. **System will send emails to all shortlisted candidates**
4. **Check the success/failure results**

### Automatic Sending
- Emails are sent automatically when applications are evaluated and shortlisted
- No manual intervention required
- System logs all email activities

## 🔧 Troubleshooting

### Common Issues

1. **Authentication Error**
   - Ensure you're using App Password for Gmail
   - Check if 2FA is enabled
   - Verify email and password are correct

2. **Connection Error**
   - Check SMTP_HOST and SMTP_PORT
   - Ensure firewall allows SMTP connections
   - Try different port (465 for SSL, 587 for TLS)

3. **Email Not Received**
   - Check spam/junk folder
   - Verify recipient email address
   - Check email provider settings

### Debug Steps
1. Run the test script: `node scripts/testEmailSystem.js`
2. Check server logs for error messages
3. Verify environment variables are set correctly
4. Test with a different email provider if needed

## 📊 Email Statistics

The system tracks:
- ✅ **Successful emails**: Number of emails sent successfully
- ❌ **Failed emails**: Number of emails that failed to send
- 📧 **Total processed**: Total number of email attempts
- 📝 **Error details**: Specific error messages for failed emails

## 🔒 Security Considerations

- ✅ **App Passwords**: Use app-specific passwords instead of regular passwords
- ✅ **Environment Variables**: Store sensitive data in .env file
- ✅ **SMTP Security**: Use TLS/SSL for secure email transmission
- ✅ **Rate Limiting**: Built-in delays to prevent spam

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Run the test script to identify specific problems
3. Verify your email provider settings
4. Contact your email provider for SMTP configuration help

---

**Note**: Make sure to keep your email credentials secure and never commit them to version control. 