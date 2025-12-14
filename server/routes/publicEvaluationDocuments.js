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

    // If form is already submitted, return error for public access (prevents duplicate access)
    if (document.status === 'submitted' || document.status === 'completed') {
      return res.status(400).json({ 
        error: 'This evaluation form has already been submitted and cannot be accessed again.',
        alreadySubmitted: true
      });
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

    // Prevent duplicate submissions - if already submitted, reject the update
    if (req.body.status === 'submitted' && (existingDoc.status === 'submitted' || existingDoc.status === 'completed')) {
      return res.status(400).json({ 
        error: 'This evaluation form has already been submitted and cannot be modified.',
        alreadySubmitted: true
      });
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

    // Check if status is changing to 'submitted'
    const isSubmitting = req.body.status === 'submitted' && existingDoc.status !== 'submitted';

    // Ensure project is set from employee before submission (for Level 0 routing)
    if (isSubmitting && !existingDoc.project && existingDoc.employee) {
      try {
        const employee = await Employee.findById(existingDoc.employee)
          .populate('placementProject', '_id')
          .populate('placementDepartment', '_id');
        
        if (employee && employee.placementProject) {
          evaluationData.project = employee.placementProject._id;
        }
        if (employee && employee.placementDepartment && !existingDoc.department) {
          evaluationData.department = employee.placementDepartment._id;
        }
      } catch (err) {
        console.warn('Could not populate employee project for Level 0 routing:', err.message);
      }
    }

    const updateData = {
      ...evaluationData,
      ...(req.body.status === 'submitted' && { submittedAt: new Date() }),
      ...(req.body.status === 'completed' && { completedAt: new Date() })
    };

    // DO NOT manually set approval levels here - let the pre-save middleware handle Level 0 routing
    // The middleware will check for Level 0 approvers first, then initialize Level 1-4 if needed

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

