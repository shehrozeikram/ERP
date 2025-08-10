# Candidate Approval System

## Overview

The Candidate Approval System is a hierarchical workflow that manages the approval process for candidates who have passed the interview stage in the talent acquisition process. The system implements a 5-level approval hierarchy with sequential approval requirements.

## Approval Hierarchy

The system follows a strict 5-level hierarchical approval process:

1. **Assistant Manager HR** - First level approval
2. **Manager HR** - Second level approval  
3. **HOD HR** - Third level approval
4. **Vice President** - Fourth level approval
5. **CEO** - Final approval

## Workflow Process

### 1. Candidate Status Flow
```
Interviewed → Passed → Approval Pending → Approval In Progress → Approved → Offered → Hired
```

### 2. Approval Process
1. **Candidate passes interview** → Status changes to "Passed"
2. **HR creates approval workflow** → Status changes to "Approval Pending"
3. **Email sent to first approver** (Assistant Manager HR)
4. **Sequential approval process**:
   - Each approver receives email notification
   - Approver reviews candidate information
   - Approver provides digital signature and comments
   - Upon approval, email sent to next level
   - Process continues until all 5 levels approve
5. **Final approval** → Status changes to "Approved"
6. **Appointment letter sent** to candidate

## Features

### ✅ Core Features
- **Hierarchical Approval Workflow** - 5-level sequential approval
- **Email Notifications** - Automatic emails to each approver
- **Digital Signatures** - Each approver provides digital signature
- **Progress Tracking** - Visual progress indicators
- **Comments System** - Approvers can add comments
- **Status Management** - Automatic status updates
- **Reminder System** - Send reminders to pending approvers
- **Audit Trail** - Complete history of all approvals

### ✅ Email Templates
- **Approval Request Email** - Sent to each approver
- **Approval Reminder Email** - Sent as follow-up
- **Appointment Letter** - Sent to candidate upon final approval

### ✅ Frontend Components
- **Approval Management** - Create and manage approval workflows
- **Approval Detail View** - Comprehensive candidate information
- **Approval Actions** - Approve/reject with digital signature
- **Progress Tracking** - Visual stepper showing approval progress
- **Status Indicators** - Color-coded status chips

## Database Schema

### CandidateApproval Model
```javascript
{
  candidate: ObjectId,           // Reference to candidate
  jobPosting: ObjectId,          // Reference to job posting
  application: ObjectId,         // Reference to application
  status: String,                // pending, in_progress, approved, rejected, cancelled
  currentLevel: Number,          // 1-5, current approval level
  approvalLevels: [{
    level: Number,               // 1-5
    title: String,               // Role title
    approver: ObjectId,          // Reference to approver user
    approverEmail: String,       // Approver email
    status: String,              // pending, approved, rejected
    approvedAt: Date,            // Approval timestamp
    comments: String,            // Approver comments
    signature: String            // Digital signature
  }],
  finalDecision: String,         // approved, rejected
  finalDecisionBy: ObjectId,     // Final approver
  finalDecisionAt: Date,         // Final decision timestamp
  emailNotifications: [{
    type: String,                // approval_request, reminder, appointment_letter
    level: Number,               // Approval level
    sentTo: String,              // Recipient email
    sentAt: Date,                // Email timestamp
    status: String               // pending, sent, delivered, failed
  }]
}
```

## API Endpoints

### Candidate Approvals
- `POST /api/candidate-approvals` - Create approval workflow
- `GET /api/candidate-approvals` - Get all approvals
- `GET /api/candidate-approvals/pending` - Get pending approvals for user
- `GET /api/candidate-approvals/:id` - Get approval by ID
- `POST /api/candidate-approvals/:id/approve` - Approve at current level
- `POST /api/candidate-approvals/:id/reject` - Reject at current level
- `POST /api/candidate-approvals/:id/remind` - Send reminder email
- `DELETE /api/candidate-approvals/:id` - Cancel approval workflow

## Frontend Routes

### Management Routes
- `/hr/candidate-approvals` - Approval management dashboard
- `/hr/approvals/:id` - Detailed approval view

### Navigation
The approval system is accessible through:
- **HR Module** → **Talent Acquisition** → **Candidate Approvals**

## Usage Instructions

### For HR Managers (Creating Approvals)

1. **Navigate to Candidate Approvals**
   - Go to HR → Talent Acquisition → Candidate Approvals

2. **Create Approval Workflow**
   - Click "Create Approval Workflow"
   - Select candidate with "Passed" status
   - Select job posting and application
   - Enter 5 approver emails (one for each level)
   - Submit to start workflow

3. **Monitor Progress**
   - View approval progress in the dashboard
   - Send reminders to pending approvers
   - Track completion status

### For Approvers

1. **Receive Email Notification**
   - Check email for approval request
   - Click link to access approval page

2. **Review Candidate Information**
   - View comprehensive candidate details
   - Review education, experience, skills
   - Check interview feedback and results

3. **Provide Approval**
   - Add comments (optional for approval, required for rejection)
   - Provide digital signature
   - Check confirmation box
   - Submit approval or rejection

4. **System Actions**
   - Upon approval: Email sent to next level
   - Upon rejection: Process stops, candidate notified

## Email Templates

### Approval Request Email
- **Subject**: 🔐 Candidate Approval Required - Level X - [Candidate Name]
- **Content**: Candidate details, position info, approval instructions
- **Actions**: Links to approve/reject

### Approval Reminder Email
- **Subject**: ⏰ Reminder: Candidate Approval Pending - Level X - [Candidate Name]
- **Content**: Friendly reminder with candidate details
- **Actions**: Link to approve

### Hiring Confirmation Email
- **Subject**: 🎉 Congratulations! You're Hired - [Position]
- **Content**: Final hiring confirmation, onboarding process, next steps
- **Actions**: Welcome message and onboarding information

### Appointment Letter
- **Subject**: 🎉 Congratulations! Appointment Letter - [Position]
- **Content**: Congratulations, approval completion, next steps
- **Actions**: Welcome message and onboarding information

## Status Management

### Candidate Status Updates
- `passed` → `approval_pending` (workflow created)
- `approval_pending` → `approval_in_progress` (first approval)
- `approval_in_progress` → `hired` (all levels approved - CEO final approval)
- `hired` → `offered` (offer letter sent - if needed)
- `offered` → `offer_accepted` (candidate accepts offer)

### Approval Status Updates
- `pending` → `in_progress` (first level approved)
- `in_progress` → `approved` (all levels approved)
- `in_progress` → `rejected` (any level rejected)

## Testing

### Test Script
Run the test script to verify the approval system:
```bash
cd server/scripts
node testApprovalSystem.js
```

### Test Scenarios
1. **Create Approval Workflow** - Test workflow creation
2. **Sequential Approvals** - Test all 5 levels
3. **Email Notifications** - Test email sending
4. **Rejection Handling** - Test rejection workflow
5. **Status Updates** - Test candidate status changes

## Configuration

### Environment Variables
```env
# Email Configuration
FRONTEND_URL=http://localhost:3000

# Email Service (Mailtrap for testing)
MAILTRAP_HOST=sandbox.smtp.mailtrap.io
MAILTRAP_PORT=2525
MAILTRAP_USER=your_username
MAILTRAP_PASS=your_password
```

### Approver Email Configuration
**For Testing Purposes**: All approval emails are currently configured to go to `shehrozeikram2@gmail.com`

**Production Configuration**: Update approver emails in the approval creation form:
- Level 1: Assistant Manager HR email
- Level 2: Manager HR email
- Level 3: HOD HR email
- Level 4: Vice President email
- Level 5: CEO email

## Security & Permissions

### Access Control
- **HR Managers**: Can create and manage approval workflows
- **Approvers**: Can only approve/reject at their level
- **System**: Automatic email notifications and status updates

### Data Validation
- Required 5 approver emails
- Valid candidate status (must be "passed")
- Digital signature requirement
- Confirmation checkbox for approvals

## Troubleshooting

### Common Issues

1. **Email Not Sending**
   - Check Mailtrap configuration
   - Verify approver email addresses
   - Check email service logs

2. **Approval Not Progressing**
   - Verify approver email matches user email
   - Check approval level status
   - Review approval workflow logs

3. **Status Not Updating**
   - Check candidate status validation
   - Verify approval completion
   - Review database transactions

### Debug Information
- Check server logs for approval workflow events
- Monitor email delivery status
- Review approval history in database

## Future Enhancements

### Planned Features
- **Bulk Approval** - Approve multiple candidates
- **Approval Templates** - Pre-configured approval workflows
- **Mobile Notifications** - Push notifications for approvers
- **Advanced Analytics** - Approval time tracking and metrics
- **Integration** - Connect with external HR systems

### Customization Options
- **Flexible Hierarchy** - Configurable approval levels
- **Conditional Approvals** - Skip levels based on criteria
- **Parallel Approvals** - Multiple approvers at same level
- **Escalation Rules** - Automatic escalation for delays

## Support

For technical support or questions about the approval system:
- Check the server logs for error messages
- Review the approval workflow documentation
- Contact the development team for assistance

---

**Version**: 1.0.0  
**Last Updated**: December 2024  
**Maintained By**: SGC ERP Development Team 