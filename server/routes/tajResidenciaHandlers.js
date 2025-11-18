/**
 * Reusable CRUD handlers for Taj Residencia routes
 * Eliminates repetitive code across all entity routes
 */

const createCRUDHandlers = (Model, entityName, options = {}) => {
  const {
    numberField = `${entityName.toLowerCase()}Number`,
    numberPrefix = entityName.substring(0, 2).toUpperCase(),
    searchFields = [],
    populateFields = [],
    customFilters = {}
  } = options;

  // Build query from filters
  const buildQuery = (req) => {
    const { search, status, currentStep, priority, ...otherFilters } = req.query;
    const query = {};

    // Search filter
    if (search) {
      query.$or = searchFields.map(field => ({
        [field]: { $regex: search, $options: 'i' }
      }));
    }

    // Standard filters
    if (status) query.status = status;
    if (currentStep) query.currentStep = currentStep;
    if (priority) query.priority = priority;

    // Custom filters
    Object.keys(customFilters).forEach(key => {
      if (req.query[key]) {
        query[customFilters[key]] = req.query[key];
      }
    });

    // Other filters (landIdentification, recordVerification, etc.)
    Object.keys(otherFilters).forEach(key => {
      if (key !== 'page' && key !== 'limit' && key !== 'search') {
        query[key] = otherFilters[key];
      }
    });

    return query;
  };

  // Get all with pagination
  const getAll = async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const query = buildQuery(req);

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: populateFields
      };

      const result = await Model.paginate(query, options);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error(`Error fetching ${entityName}:`, error);
      res.status(500).json({
        success: false,
        message: `Error fetching ${entityName}`,
        error: error.message
      });
    }
  };

  // Get single by ID
  const getById = async (req, res) => {
    try {
      const populate = populateFields.length > 0 
        ? populateFields.map(field => {
            if (typeof field === 'string') {
              return { path: field, select: 'fullName email' };
            }
            return field;
          })
        : [];

      const item = await Model.findById(req.params.id).populate(populate);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${entityName} not found`
        });
      }

      res.json({ success: true, data: item });
    } catch (error) {
      console.error(`Error fetching ${entityName}:`, error);
      res.status(500).json({
        success: false,
        message: `Error fetching ${entityName}`,
        error: error.message
      });
    }
  };

  // Create new
  const create = async (req, res) => {
    try {
      const data = {
        ...req.body,
        createdBy: req.user._id
      };

      // Generate number if not provided
      if (!data[numberField]) {
        const count = await Model.countDocuments();
        data[numberField] = `${numberPrefix}-${String(count + 1).padStart(6, '0')}`;
      }

      const item = new Model(data);
      await item.save();

      // Add initial workflow history
      if (item.workflowHistory) {
        item.workflowHistory.push({
          step: 'creation',
          action: `${entityName} created`,
          performedBy: req.user._id,
          notes: `Initial creation of ${entityName.toLowerCase()}`
        });
        await item.save();
      }

      const populate = populateFields.filter(f => 
        typeof f === 'object' && (f.path === 'createdBy' || f.path === 'assignedTo')
      );
      const populated = await Model.findById(item._id).populate(populate);

      res.status(201).json({
        success: true,
        message: `${entityName} created successfully`,
        data: populated
      });
    } catch (error) {
      console.error(`Error creating ${entityName}:`, error);
      res.status(500).json({
        success: false,
        message: `Error creating ${entityName}`,
        error: error.message
      });
    }
  };

  // Update
  const update = async (req, res) => {
    try {
      const item = await Model.findById(req.params.id);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${entityName} not found`
        });
      }

      const previousStatus = item.status;
      const previousStep = item.currentStep;

      Object.assign(item, req.body);
      item.updatedBy = req.user._id;

      // Add workflow history if status or step changed
      if (item.workflowHistory) {
        if (req.body.status && req.body.status !== previousStatus) {
          item.workflowHistory.push({
            step: item.currentStep,
            action: `Status changed from ${previousStatus} to ${req.body.status}`,
            performedBy: req.user._id,
            previousStatus,
            newStatus: req.body.status,
            notes: req.body.workflowNotes || ''
          });
        }

        if (req.body.currentStep && req.body.currentStep !== previousStep) {
          item.workflowHistory.push({
            step: req.body.currentStep,
            action: `Step changed from ${previousStep} to ${req.body.currentStep}`,
            performedBy: req.user._id,
            notes: req.body.stepNotes || ''
          });
        }
      }

      await item.save();

      const populate = populateFields.filter(f => 
        typeof f === 'object' && ['createdBy', 'updatedBy', 'assignedTo', 'workflowHistory.performedBy'].includes(f.path)
      );
      const populated = await Model.findById(item._id).populate(populate);

      res.json({
        success: true,
        message: `${entityName} updated successfully`,
        data: populated
      });
    } catch (error) {
      console.error(`Error updating ${entityName}:`, error);
      res.status(500).json({
        success: false,
        message: `Error updating ${entityName}`,
        error: error.message
      });
    }
  };

  // Delete
  const remove = async (req, res) => {
    try {
      const item = await Model.findById(req.params.id);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${entityName} not found`
        });
      }

      await Model.findByIdAndDelete(req.params.id);
      res.json({
        success: true,
        message: `${entityName} deleted successfully`
      });
    } catch (error) {
      console.error(`Error deleting ${entityName}:`, error);
      res.status(500).json({
        success: false,
        message: `Error deleting ${entityName}`,
        error: error.message
      });
    }
  };

  // Update workflow step
  const updateWorkflow = async (req, res) => {
    try {
      const { step, action, notes } = req.body;
      const item = await Model.findById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${entityName} not found`
        });
      }

      if (!item.workflowHistory) {
        return res.status(400).json({
          success: false,
          message: 'Workflow history not available for this entity'
        });
      }

      const previousStep = item.currentStep;
      item.currentStep = step;

      item.workflowHistory.push({
        step,
        action: action || `Moved to step: ${step}`,
        performedBy: req.user._id,
        notes: notes || ''
      });

      await item.save();

      const populated = await Model.findById(item._id)
        .populate('workflowHistory.performedBy', 'fullName email');

      res.json({
        success: true,
        message: 'Workflow step updated successfully',
        data: populated
      });
    } catch (error) {
      console.error('Error updating workflow step:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating workflow step',
        error: error.message
      });
    }
  };

  return {
    getAll,
    getById,
    create,
    update,
    remove,
    updateWorkflow
  };
};

module.exports = { createCRUDHandlers };

