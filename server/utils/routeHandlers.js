/**
 * Reusable route handler utilities for common CRUD operations
 * Lightweight and optimized for performance
 */

/**
 * Generic error handler for duplicate key and validation errors
 */
const handleRouteError = (error, defaultMessage = 'Operation failed') => {
  // Handle duplicate key errors (E11000)
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];
    const fieldName = field?.replace(/Id$/, ' ID').replace(/([A-Z])/g, ' $1').trim() || field || 'field';
    return {
      status: 400,
      message: `A record with this ${fieldName} already exists`
    };
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return {
      status: 400,
      message: 'Validation failed',
      errors: Object.values(error.errors).map(err => err.message)
    };
  }

  // Handle other errors
  return {
    status: 500,
    message: error.message || defaultMessage
  };
};

/**
 * Generic create handler for simple entities
 */
const createSimpleEntity = async (Model, req, options = {}) => {
  const {
    nameField = 'name',
    requiredFields = [],
    defaultValues = {},
    transformData = (data) => data,
    populateFields = []
  } = options;

  // Check for duplicate name
  const existing = await Model.findOne({ [nameField]: req.body[nameField]?.trim() });
  if (existing) {
    return {
      status: 400,
      message: `A record with this ${nameField} already exists`
    };
  }

  // Build entity data
  const entityData = {
    ...transformData(req.body),
    ...defaultValues,
    createdBy: req.user?.id
  };

  // Set status to Active if field exists
  if (Model.schema.paths.status && !entityData.status) {
    entityData.status = 'Active';
  }

  const entity = new Model(entityData);
  await entity.save();

  // Populate fields if specified
  if (populateFields.length > 0) {
    await entity.populate(populateFields.join(' '));
  }

  return {
    status: 201,
    data: entity,
    message: 'Record created successfully'
  };
};

/**
 * Generic GET handler for listing entities
 */
const listEntities = async (Model, req, options = {}) => {
  const {
    defaultQuery = { status: 'Active' },
    searchFields = ['name'],
    sortBy = { name: 1 },
    allowFilters = []
  } = options;

  const { search, ...queryParams } = req.query;
  const query = { ...defaultQuery };

  // Add allowed filters from query params
  allowFilters.forEach(filter => {
    if (queryParams[filter]) {
      query[filter] = queryParams[filter];
    }
  });

  // Add search functionality
  if (search && searchFields.length > 0) {
    query.$or = searchFields.map(field => ({
      [field]: { $regex: search, $options: 'i' }
    }));
  }

  const entities = await Model.find(query).sort(sortBy);

  return {
    status: 200,
    data: entities
  };
};

module.exports = {
  handleRouteError,
  createSimpleEntity,
  listEntities
};

