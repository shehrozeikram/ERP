const express = require('express');
const router = express.Router();
const EvaluationDocument = require('../models/hr/EvaluationDocument');
const Employee = require('../models/hr/Employee');

// Public route to get evaluation document by ID with token
router.get('/:id', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const document = await EvaluationDocument.findById(req.params.id)
      .populate('employee', 'firstName lastName employeeId email designation')
      .populate('evaluator', 'firstName lastName employeeId email designation')
      .populate('department', 'name');
    
    if (!document) {
      return res.status(404).json({ error: 'Evaluation document not found' });
    }

    // Verify token
    if (document.accessToken !== token) {
      return res.status(403).json({ error: 'Invalid or expired access token' });
    }
    
    res.json(document);
  } catch (error) {
    console.error('Error fetching evaluation document:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation document' });
  }
});

// Public route to update evaluation document with token
router.put('/:id', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    // Find document first to verify token
    const existingDoc = await EvaluationDocument.findById(req.params.id);
    if (!existingDoc) {
      return res.status(404).json({ error: 'Evaluation document not found' });
    }

    // Verify token
    if (existingDoc.accessToken !== token) {
      return res.status(403).json({ error: 'Invalid or expired access token' });
    }

    // Extract only the fields that should be updated (exclude references and system fields)
    const {
      department, // Exclude - already set, and might be sent as string
      employee, // Exclude - should not be changed
      evaluator, // Exclude - should not be changed
      accessToken, // Exclude - system field
      createdAt, // Exclude - system field
      updatedAt, // Exclude - system field
      ...evaluationData
    } = req.body;

    // Check if status is changing to 'submitted' and approval levels need to be initialized
    const isSubmitting = req.body.status === 'submitted' && existingDoc.status !== 'submitted';

    const updateData = {
      ...evaluationData,
      ...(req.body.status === 'submitted' && { submittedAt: new Date() }),
      ...(req.body.status === 'completed' && { completedAt: new Date() })
    };

    // Initialize approval levels if submitting for the first time
    if (isSubmitting && (!existingDoc.approvalLevels || existingDoc.approvalLevels.length === 0)) {
      const approvalLevels = [
        {
          level: 1,
          title: 'Assistant Vice President / CHRO SGC',
          approverName: 'Fahad Fareed',
          status: 'pending'
        },
        {
          level: 2,
          title: 'Chairman Steering Committee',
          approverName: 'Ahmad Tansim',
          status: 'pending'
        },
        {
          level: 3,
          title: 'CEO SGC',
          approverName: 'Sardar Umer Tanveer',
          status: 'pending'
        },
        {
          level: 4,
          title: 'President SGC',
          approverName: 'Sardar Tanveer Ilyas',
          status: 'pending'
        }
      ];
      
      updateData.approvalLevels = approvalLevels;
      updateData.approvalStatus = 'pending';
      updateData.currentApprovalLevel = 1;
      
      // Try to find and link approvers by name
      for (let i = 0; i < approvalLevels.length; i++) {
        const approver = await Employee.findOne({
          $or: [
            { firstName: { $regex: new RegExp(approvalLevels[i].approverName.split(' ')[0], 'i') }, 
              lastName: { $regex: new RegExp(approvalLevels[i].approverName.split(' ').slice(1).join(' '), 'i') } },
            { firstName: { $regex: new RegExp(approvalLevels[i].approverName.split(' ')[0], 'i') } }
          ]
        });
        
        if (approver) {
          updateData.approvalLevels[i].approver = approver._id;
        }
      }
    }

    const document = await EvaluationDocument.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('employee', 'firstName lastName employeeId email')
      .populate('evaluator', 'firstName lastName employeeId email')
      .populate('department', 'name');
    
    res.json(document);
  } catch (error) {
    console.error('Error updating evaluation document:', error);
    res.status(500).json({ error: 'Failed to update evaluation document' });
  }
});

module.exports = router;

