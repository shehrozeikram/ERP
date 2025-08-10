# Candidate Approval Email Workflow System

## Overview
The SGC ERP system now includes a comprehensive 5-level approval workflow for candidates that automatically sends emails to approvers when their status is changed to "approval_pending". All approval emails are sent to `shehrozeikram2@gmail.com` for testing purposes.

## Workflow Levels

### 1. Assistant Manager HR (Level 1)
- **Trigger**: When candidate status changes to `approval_pending`
- **Action**: Automatically creates approval workflow and sends first email
- **Email**: Sent to `shehrozeikram2@gmail.com`

### 2. Manager HR (Level 2)
- **Trigger**: After Level 1 approval
- **Action**: Sends approval request email
- **Email**: Sent to `shehrozeikram2@gmail.com`

### 3. HOD HR (Level 3)
- **Trigger**: After Level 2 approval
- **Action**: Sends approval request email
- **Email**: Sent to `shehrozeikram2@gmail.com`

### 4. Vice President (Level 4)
- **Trigger**: After Level 3 approval
- **Action**: Sends approval request email
- **Email**: Sent to `shehrozeikram2@gmail.com`

### 5. CEO (Level 5)
- **Trigger**: After Level 4 approval
- **Action**: Sends approval request email
- **Email**: Sent to `shehrozeikram2@gmail.com`

## How It Works

### 1. Status Change Trigger
When a candidate's status is changed to `approval_pending` in the candidates route:

```javascript
// In server/routes/candidates.js
if (status === 'approval_pending') {
  console.log('🔄 Status changed to approval_pending - creating approval workflow...');
  
  // Check if approval workflow already exists
  const existingApproval = await CandidateApproval.findOne({ candidate: candidate._id });
  
  if (!existingApproval) {
    // Create new approval workflow
    const approval = new CandidateApproval({
      candidate: candidate._id,
      jobPosting: candidate.jobPosting?._id,
      application: candidate.application,
      createdBy: req.user._id,
      status: 'pending'
    });

    // Set all approver emails to shehrozeikram2@gmail.com
    approval.approvalLevels[0].approverEmail = 'shehrozeikram2@gmail.com'; // Assistant Manager HR
    approval.approvalLevels[1].approverEmail = 'shehrozeikram2@gmail.com'; // Manager HR
    approval.approvalLevels[2].approverEmail = 'shehrozeikram2@gmail.com'; // HOD HR
    approval.approvalLevels[3].approverEmail = 'shehrozeikram2@gmail.com'; // Vice President
    approval.approvalLevels[4].approverEmail = 'shehrozeikram2@gmail.com'; // CEO

    await approval.save();
    
    // Send first email to Level 1 (Assistant Manager HR)
    const EmailService = require('../services/emailService');
    const emailResult = await EmailService.sendApprovalRequest(populatedApproval, 1);
  }
}
```

### 2. Email Generation
The system generates professional HTML and text emails for each approval level:

```javascript
// In server/services/emailService.js
async sendApprovalRequest(approval, level) {
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
  return { success: true, messageId: result.messageId, email: approverEmail };
}
```

### 3. Workflow Progression
When an approver approves at any level:

```javascript
// In server/routes/candidateApprovals.js
// Check if this was the final approval
const approvedLevels = approval.approvalLevels.filter(level => level.status === 'approved').length;

if (approvedLevels === 5) {
  // All levels approved - Candidate is HIRED
  approval.status = 'approved';
  approval.finalDecision = 'approved';
  approval.completedAt = new Date();

  // Update candidate status to HIRED
  await Candidate.findByIdAndUpdate(approval.candidate._id, {
    status: 'hired',
    updatedBy: req.user._id
  });

  // Send hiring confirmation email to candidate
  await EmailService.sendHiringConfirmation(approval);
} else {
  // Move to next level
  const nextLevel = approvedLevels + 1;
  approval.currentLevel = nextLevel;
  approval.status = 'in_progress';

  // Update candidate status
  await Candidate.findByIdAndUpdate(approval.candidate._id, {
    status: 'approval_in_progress',
    updatedBy: req.user._id
  });

  // Send email to next approver
  await EmailService.sendApprovalRequest(approval, nextLevel);
}
```

## Email Templates

### Approval Request Email
Each approval request email includes:
- Professional header with SGC ERP branding
- Candidate information (name, email, phone, position, department)
- Interview results summary
- Approval and rejection buttons
- Previous approval history (for levels 2-5)
- Important notes about the approval process

### Email Features
- **Subject**: Clear indication of approval level and candidate name
- **HTML Content**: Professional, responsive design
- **Action Buttons**: Direct links to approve/reject
- **Candidate Details**: Complete information for decision making
- **Workflow Context**: Shows current level and total progress

## Public Approval System

The system includes public approval endpoints that allow approvers to approve via email links without logging into the system:

```javascript
// Public approval endpoint
router.post('/:id/approve-public', asyncHandler(async (req, res) => {
  const { comments, signature, approverEmail } = req.body;
  
  // Find current level for this approver email
  const currentLevel = approval.approvalLevels.find(
    level => level.approverEmail === approverEmail && level.status === 'pending'
  );
  
  // Process approval and move to next level
  // Same workflow progression logic as authenticated endpoint
}));
```

## Database Schema

### CandidateApproval Model
```javascript
const candidateApprovalSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
  jobPosting: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPosting', required: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'approved', 'rejected', 'cancelled'] },
  currentLevel: { type: Number, min: 1, max: 5, default: 1 },
  
  approvalLevels: [{
    level: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true, enum: ['Assistant Manager HR', 'Manager HR', 'HOD HR', 'Vice President', 'CEO'] },
    approverEmail: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedAt: Date,
    comments: String,
    signature: String,
    emailSentAt: Date,
    emailStatus: { type: String, enum: ['pending', 'sent', 'delivered', 'failed'], default: 'pending' }
  }],
  
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  finalDecision: { type: String, enum: ['approved', 'rejected'] },
  finalDecisionAt: Date
});
```

## Testing

### Manual Testing
1. Change a candidate's status to `approval_pending`
2. Check that approval workflow is created automatically
3. Verify first email is sent to Assistant Manager HR
4. Approve at each level and verify progression
5. Check that final approval sends hiring confirmation

### Automated Testing
Run the test script to verify workflow logic:
```bash
node test-email-workflow.js
```

## Configuration

### Email Settings
- **From Email**: `shehrozeikram2@gmail.com`
- **SMTP Service**: Gmail
- **App Password**: Configured for secure access

### Approval Emails
All approval emails are currently sent to `shehrozeikram2@gmail.com` for testing. In production, these can be changed to actual approver email addresses.

## Benefits

1. **Automated Workflow**: No manual intervention required to start approval process
2. **Professional Communication**: Standardized email templates with company branding
3. **Audit Trail**: Complete tracking of all approvals and decisions
4. **Flexible Approval**: Both authenticated and public approval options
5. **Status Tracking**: Real-time updates on candidate approval progress
6. **Email Notifications**: Automatic reminders and confirmations

## Future Enhancements

1. **Individual Email Addresses**: Configure separate emails for each approver level
2. **SMS Notifications**: Add SMS reminders for urgent approvals
3. **Approval Deadlines**: Set time limits for each approval level
4. **Escalation Rules**: Automatic escalation for delayed approvals
5. **Mobile App Integration**: Push notifications for mobile users

## Troubleshooting

### Common Issues
1. **Emails not sending**: Check Gmail app password and SMTP settings
2. **Workflow not progressing**: Verify approval level logic and database updates
3. **Candidate status not updating**: Check database connection and update queries

### Debug Logging
The system includes comprehensive logging for troubleshooting:
- Approval workflow creation
- Email sending status
- Workflow progression
- Final approval completion

## Conclusion

The candidate approval email workflow system is now fully functional and automatically handles the complete approval process from initial request to final hiring confirmation. All emails are sent to `shehrozeikram2@gmail.com` for testing, and the system maintains a complete audit trail of all approvals and decisions.
