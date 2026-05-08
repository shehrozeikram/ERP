const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const KPITemplate = require('../models/hr/KPITemplate');
const KPICycle = require('../models/hr/KPICycle');
const KPIEvaluation = require('../models/hr/KPIEvaluation');
const Employee = require('../models/hr/Employee');

// --- KPI TEMPLATES ---

// Create a new template
router.post('/templates', [
  authMiddleware,
  // Add basic role check here or in middleware
  body('title').notEmpty().withMessage('Title is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one KPI item is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const template = new KPITemplate({
      ...req.body,
      createdBy: req.user._id
    });

    await template.save();
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all templates
router.get('/templates', authMiddleware, async (req, res) => {
  try {
    const templates = await KPITemplate.find()
      .populate('department', 'name')
      .populate('createdBy', 'firstName lastName')
      .sort('-createdAt');
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update a template
router.put('/templates/:id', authMiddleware, async (req, res) => {
  try {
    const template = await KPITemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a template
router.delete('/templates/:id', authMiddleware, async (req, res) => {
  try {
    const template = await KPITemplate.findByIdAndDelete(req.params.id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// --- KPI CYCLES ---

// Create a new cycle
router.post('/cycles', [
  authMiddleware,
  body('title').notEmpty().withMessage('Title is required'),
  body('template').notEmpty().withMessage('Template is required'),
  body('period.startDate').isISO8601().withMessage('Valid start date is required'),
  body('period.endDate').isISO8601().withMessage('Valid end date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    let resolvedEvaluatorId = req.body.evaluator;
    if (resolvedEvaluatorId) {
      // Check if this is an Employee ID (common if selected from employee list)
      const empEvaluator = await Employee.findById(resolvedEvaluatorId);
      if (empEvaluator && empEvaluator.user) {
        resolvedEvaluatorId = empEvaluator.user;
      }
    }

    const cycle = new KPICycle({
      ...req.body,
      evaluator: resolvedEvaluatorId,
      status: 'active', // Default to active so it's visible to employees
      createdBy: req.user._id
    });

    await cycle.save();

    // AUTO-ASSIGN: If a department was specified, automatically assign all employees in that department
    if (req.body.department) {
      const deptEmployees = await Employee.find({ 
        $or: [
          { department: req.body.department },
          { department: new mongoose.Types.ObjectId(req.body.department) }
        ]
      });
      
      if (deptEmployees.length > 0) {
        const template = await KPITemplate.findById(req.body.template);
        const evaluations = [];
        
        for (const emp of deptEmployees) {
          const evalItems = template.items.map(item => ({
            templateItemId: item._id,
            title: item.title,
            description: item.description,
            weight: item.weight,
            measurementType: item.measurementType
          }));

          // Find the User ID for the manager Employee
          // Priority: Cycle-level evaluator > Explicit Evaluator > Employee's Manager
          let evaluatorUserId = cycle.evaluator; 
          
          if (!evaluatorUserId && emp.manager) {
            const managerEmp = await Employee.findById(emp.manager);
            if (managerEmp && managerEmp.user) {
              evaluatorUserId = managerEmp.user;
            }
          }

          evaluations.push({
            cycle: cycle._id,
            employee: emp._id,
            evaluator: evaluatorUserId,
            kpiItems: evalItems,
            status: 'draft'
          });
        }
        
        if (evaluations.length > 0) {
          await KPIEvaluation.insertMany(evaluations);
          cycle.employees = deptEmployees.map(e => e._id);
          await cycle.save();
        }
      }
    }

    res.status(201).json({ success: true, data: cycle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all cycles
router.get('/cycles', authMiddleware, async (req, res) => {
  try {
    const cycles = await KPICycle.find()
      .populate('template', 'title totalWeight')
      .populate('department', 'name')
      .sort('-createdAt');
    res.json({ success: true, data: cycles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update a cycle
router.put('/cycles/:id', authMiddleware, async (req, res) => {
  try {
    const cycle = await KPICycle.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });
    res.json({ success: true, data: cycle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a cycle
router.delete('/cycles/:id', authMiddleware, async (req, res) => {
  try {
    const cycle = await KPICycle.findByIdAndDelete(req.params.id);
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });
    // Also delete associated evaluations? Usually yes.
    await KPIEvaluation.deleteMany({ cycle: req.params.id });
    res.json({ success: true, message: 'Cycle and associated evaluations deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign employees to cycle
router.post('/cycles/:id/assign', authMiddleware, async (req, res) => {
  try {
    const cycleId = req.params.id;
    const { employeeIds, evaluatorId } = req.body;

    const cycle = await KPICycle.findById(cycleId).populate('template');
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });

    // Update cycle employees list
    cycle.employees = [...new Set([...cycle.employees, ...employeeIds])];
    await cycle.save();

    // Create draft evaluations for each assigned employee
    const evaluations = [];
    for (const empId of employeeIds) {
      // Check if evaluation already exists
      const exists = await KPIEvaluation.findOne({ cycle: cycleId, employee: empId });
      if (!exists) {
        const employee = await Employee.findById(empId);
        
        const evalItems = cycle.template.items.map(item => ({
          templateItemId: item._id,
          title: item.title,
          description: item.description,
          weight: item.weight,
          measurementType: item.measurementType
        }));

        // CRITICAL FIX: If we use the manager from employee profile, 
        // we MUST get the User ID, not the Employee ID.
        let evaluatorUserId = evaluatorId; // Explicitly passed User ID
        if (!evaluatorUserId && employee && employee.manager) {
          const managerEmp = await Employee.findById(employee.manager);
          if (managerEmp && managerEmp.user) {
            evaluatorUserId = managerEmp.user;
          }
        }

        evaluations.push({
          cycle: cycleId,
          employee: empId,
          evaluator: evaluatorUserId,
          kpiItems: evalItems,
          status: 'draft'
        });
      }
    }

    if (evaluations.length > 0) {
      await KPIEvaluation.insertMany(evaluations);
    }

    res.json({ success: true, message: `Assigned ${evaluations.length} new employees` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// --- KPI EVALUATIONS ---

// Get MY evaluations (Employee viewing their own)
router.get('/evaluations/my', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found' });

    const evaluations = await KPIEvaluation.find({ employee: employee._id })
      .populate('cycle', 'title period status')
      .populate('evaluator', 'firstName lastName')
      .sort('-createdAt');

    res.json({ success: true, data: evaluations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get evaluations to review (Manager viewing assigned team)
router.get('/evaluations/review', authMiddleware, async (req, res) => {
  try {
    const isAdmin = ['admin', 'developer', 'super_admin'].includes(req.user.role);
    const query = { status: { $in: ['draft', 'self_submitted', 'under_review', 'completed'] } };
    
    // If not admin, only show evaluations where this user is the designated evaluator
    if (!isAdmin) {
      query.evaluator = req.user._id;
    }

    const evaluations = await KPIEvaluation.find(query)
      .populate('employee', 'firstName lastName employeeId department position')
      .populate('cycle', 'title period')
      .sort('-updatedAt');
      
    res.json({ success: true, data: evaluations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update an evaluation (Self Assessment OR Manager Review)
router.put('/evaluations/:id', authMiddleware, async (req, res) => {
  try {
    const { kpiItems, status, evaluatorComment, hrRemarks } = req.body;
    
    const evaluation = await KPIEvaluation.findById(req.params.id);
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation not found' });

    // Update items
    if (kpiItems && Array.isArray(kpiItems)) {
      kpiItems.forEach(updatedItem => {
        const item = evaluation.kpiItems.find(i => i._id.toString() === updatedItem._id);
        if (item) {
          if (updatedItem.selfScore !== undefined) item.selfScore = updatedItem.selfScore;
          if (updatedItem.selfComment !== undefined) item.selfComment = updatedItem.selfComment;
          if (updatedItem.evaluatorScore !== undefined) item.evaluatorScore = updatedItem.evaluatorScore;
          if (updatedItem.evaluatorComment !== undefined) item.evaluatorComment = updatedItem.evaluatorComment;
        }
      });
    }

    if (status) evaluation.status = status;
    if (evaluatorComment) evaluation.evaluatorComment = evaluatorComment;
    if (hrRemarks) evaluation.hrRemarks = hrRemarks;

    // If manager is reviewing
    if (status === 'completed' || status === 'under_review') {
      evaluation.evaluator = req.user._id;
      if (status === 'completed') evaluation.evaluationDate = new Date();
    }

    await evaluation.save();
    res.json({ success: true, data: evaluation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a specific evaluation
router.get('/evaluations/:id', authMiddleware, async (req, res) => {
  try {
    const evaluation = await KPIEvaluation.findById(req.params.id)
      .populate('employee', 'firstName lastName position department profileImage')
      .populate('cycle')
      .populate('evaluator', 'firstName lastName');
      
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation not found' });
    
    res.json({ success: true, data: evaluation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
