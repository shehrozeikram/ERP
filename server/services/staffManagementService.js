const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const StaffType = require('../models/hr/StaffType');
const GenericStaffAssignment = require('../models/hr/GenericStaffAssignment');
const Location = require('../models/hr/Location');
const Department = require('../models/hr/Department');
const Vehicle = require('../models/hr/Vehicle');
const Project = require('../models/hr/Project');

class StaffManagementService {
  
  // ==================== STAFF TYPE MANAGEMENT ====================
  
  /**
   * Get all active staff types with assignment configs
   */
  static async getStaffTypes(options = {}) {
    try {
      const {
        includeInactive = false,
        populateTargets = false,
        sortBy = 'name',
        sortOrder = 'asc'
      } = options;
      
      const query = { status: includeInactive ? { $in: ['Active', 'Inactive'] } : 'Active' };
      
      let staffTypes = StaffType.find(query)
        .populate({ path: 'createdBy', select: 'firstName lastName email' })
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
      
      // Note: assignmentTargets are embedded documents, not references
      // populateTargets parameter is kept for API compatibility but doesn't affect the query
      
      return await staffTypes.exec();
    } catch (error) {
      console.error('Error fetching staff types:', error);
      throw new Error('Failed to fetch staff types');
    }
  }
  
  /**
   * Create a new staff type
   */
  static async createStaffType(staffTypeData, createdBy) {
    try {
      // Validate required fields
      const { code, name, assignmentTargets } = staffTypeData;
      
      if (!code || !name) {
        throw new Error('Code and name are required');
      }
      
      // Check for duplicate code
      const existing = await StaffType.findOne({ code: code.toUpperCase() });
      if (existing) {
        throw new Error('Staff type code already exists');
      }
      
      // Create staff type
      const staffType = new StaffType({
        ...staffTypeData,
        code: code.toUpperCase(),
        createdBy
      });
      
      await staffType.save();
      return await StaffType.findByIdAndUpdate(
        staffType._id,
        { createdBy },
        { new: true }
      ).populate('createdBy', 'firstName lastName');
      
    } catch (error) {
      console.error('Error creating staff type:', error);
      throw error;
    }
  }
  
  /**
   * Update staff type
   */
  static async updateStaffType(staffTypeId, updateData, modifiedBy) {
    try {
      const staffType = await StaffType.findById(staffTypeId);
      if (!staffType) {
        throw new Error('Staff type not found');
      }
      
      // Check code uniqueness if being updated
      if (updateData.code && updateData.code !== staffType.code) {
        const existing = await StaffType.findOne({ 
          code: updateData.code.toUpperCase(),
          _id: { $ne: staffTypeId }
        });
        if (existing) {
          throw new Error('Staff type code already exists');
        }
        updateData.code = updateData.code.toUpperCase();
      }
      
      const updatedStaffType = await StaffType.findByIdAndUpdate(
        staffTypeId,
        { 
          ...updateData, 
          lastModifiedBy: modifiedBy 
        },
        { new: true, runValidators: true }
      ).populate('createdBy lastModifiedBy', 'firstName lastName email');
      
      return updatedStaffType;
    } catch (error) {
      console.error('Error updating staff type:', error);
      throw error;
    }
  }
  
  // ==================== STAFF ASSIGNMENT MANAGEMENT ====================
  
  /**
   * Get staff assignments with filters
   */
  static async getAssignments(filters = {}) {
    try {
      const {
        employeeId,
        staffTypeId,
        targetType,
        targetId,
        status = 'Active',
        includeCompleted = false,
        sortBy = 'startDate',
        sortOrder = 'desc',
        page = 1,
        limit = 20
      } = filters;
      
      let query = {};
      
      // Apply filters
      if (employeeId) query.employee = employeeId;
      if (staffTypeId) query.staffType = staffTypeId;
      if (targetType) query['targets.type'] = targetType;
      if (targetId) query['targets.targetId'] = targetId;
      
      // Status filter
      if (includeCompleted) {
        query.status = { $in: ['Pending', 'Active', 'Completed'] };
      } else {
        query.status = status === 'All' ? { $ne: 'Cancelled' } : status;
      }
      
      // Build query with pagination
      const skip = (page - 1) * limit;
      
      const assignments = await GenericStaffAssignment.find(query)
        .populate('employee', 'employeeId firstName lastName email phone department')
        .populate('staffType', 'code name icon color assignmentTargets')
        .populate('targets.targetId', '_id name code status')
        .populate('reportingManager', 'firstName lastName employeeId')
        .populate('assignedBy', 'firstName lastName email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      
      // Get total count for pagination
      const total = await GenericStaffAssignment.countDocuments(query);
      
      // Calculate additional fields
      const enrichedAssignments = assignments.map(assignment => {
        const { employee, staffType, targets } = assignment;
        return {
          ...assignment,
          employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
          staffTypeName: staffType ? staffType.name : 'Unknown',
          targetsSummary: targets ? targets.map(t => t.label).join(', ') : 'No targets',
          isOverdue: assignment.endDate && new Date(assignment.endDate) < new Date() && assignment.status === 'Active'
        };
      });
      
      return {
        assignments: enrichedAssignments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
      
    } catch (error) {
      console.error('Error fetching assignments:', error);
      throw new Error('Failed to fetch staff assignments');
    }
  }
  
  /**
   * Create new staff assignment
   */
  static async createAssignment(assignmentData, assignedBy) {
    try {
      // Validate employee exists and is active
      const employee = await Employee.findById(assignmentData.employee);
      if (!employee || employee.status !== 'Active') {
        throw new Error('Invalid or inactive employee');
      }
      
      // Validate staff type
      const staffType = await StaffType.findById(assignmentData.staffType);
      if (!staffType || staffType.status !== 'Active') {
        throw new Error('Invalid or inactive staff type');
      }
      
      // Check for existing active assignment conflict
      const existingAssignment = await GenericStaffAssignment.findOne({
        employee: assignmentData.employee,
        status: 'Active'
      });
      
      if (existingAssignment) {
        throw new Error('Employee already has an active assignment');
      }
      
      // Validate assignment targets
      const validation = await staffType.validateAssignment(assignmentData);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      
      // Create assignment
      const assignment = new GenericStaffAssignment({
        ...assignmentData,
        assignedBy
      });
      
      await assignment.save();
      
      // Populate result
      const result = await GenericStaffAssignment.findById(assignment._id)
        .populate('employee', 'employeeId firstName lastName email phone department')
        .populate('staffType', 'code name icon color')
        .populate('targets.targetId', '_id name code')
        .populate('reportingManager', 'firstName lastName employeeId')
        .populate('assignedBy', 'firstName lastName email');
      
      return result;
      
    } catch (error) {
      console.error('Error creating assignment:', error);
      throw error;
    }
  }
  
  /**
   * Update staff assignment
   */
  static async updateAssignment(assignmentId, updateData, modifiedBy) {
    try {
      const assignment = await GenericStaffAssignment.findById(assignmentId);
      if (!assignment) {
        throw new Error('Assignment not found');
      }
      
      // Track changes
      const changes = this.getChangedFields(assignment, updateData);
      if (changes.length > 0) {
        assignment.addChangeEntry('UPDATE', changes, modifiedBy, updateData.changeNotes);
      }
      
      // Update assignment
      const updatedAssignment = await GenericStaffAssignment.findByIdAndUpdate(
        assignmentId,
        { 
          ...updateData, 
          lastModifiedBy: modifiedBy,
          changeHistory: assignment.changeHistory
        },
        { new: true, runValidators: true }
      )
      .populate('employee', 'employeeId firstName lastName email phone')
      .populate('staffType', 'code name icon color')
      .populate('targets.targetId', '_id name code')
      .populate('reportingManager', 'firstName lastName employeeId');
      
      return updatedAssignment;
      
    } catch (error) {
      console.error('Error updating assignment:', error);
      throw error;
    }
  }
  
  /**
   * Get assignment dashboard data
   */
  static async getDashboardData() {
    try {
      // Parallel queries for performance
      const [
        totalAssignments,
        activeAssignments,
        staffTypesCount,
        assignmentsByType,
        recentAssignments,
        upcomingDeadlines
      ] = await Promise.all([
        GenericStaffAssignment.countDocuments(),
        GenericStaffAssignment.countDocuments({ status: 'Active' }),
        StaffType.countDocuments({ status: 'Active' }),
        GenericStaffAssignment.aggregate([
          { $match: { status: { $in: ['Active', 'Pending'] } } },
          { $group: { _id: '$staffType', count: { $sum: 1 } } },
          { $lookup: { from: 'stafftypes', foreignField: '_id', localField: '_id', as: 'staffType' } },
          { $unwind: '$staffType' },
          { $project: { staffType: '$staffType.name', count: 1, icon: '$staffType.icon', color: '$staffType.color' } },
          { $sort: { count: -1 } }
        ]),
        GenericStaffAssignment.find({ status: { $in: ['Active', 'Pending'] } })
          .populate('employee', 'firstName lastName')
          .populate('staffType', 'name icon color')
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        GenericStaffAssignment.find({
          endDate: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
          status: 'Active'
        })
        .populate('employee', 'firstName lastName')
        .populate('staffType', 'name icon')
        .sort({ endDate: 1 })
        .limit(5)
        .lean()
      ]);
      
      return {
        overview: {
          totalAssignments,
          activeAssignments,
          staffTypesCount,
          completionRate: totalAssignments > 0 ? Math.round((activeAssignments / totalAssignments) * 100) : 0
        },
        assignmentsByType,
        recentAssignments,
        upcomingDeadlines,
        calculatedAt: new Date()
      };
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw new Error('Failed to fetch dashboard data');
    }
  }
  
  /**
   * Get assignment target options
   */
  static async getAssignmentTargets(staffTypeId) {
    try {
      const staffType = await StaffType.findById(staffTypeId);
      if (!staffType) {
        throw new Error('Staff type not found');
      }
      
      const options = {};
      
      for (const target of staffType.assignmentTargets) {
        switch (target.type) {
          case 'location':
            options[target.type] = await Location.find({ status: 'Active' }).select('_id name locationId type address');
            break;
          case 'department':
            options[target.type] = await Department.find({ status: 'Active' }).select('_id name code');
            break;
          case 'vehicle':
            options[target.type] = await Vehicle.find({ status: 'Active' }).select('_id make model licensePlate');
            break;
          case 'project':
            options[target.type] = await Project.find({ status: 'Active' }).select('_id name code');
            break;
          default:
            options[target.type] = [];
        }
      }
      
      return options;
      
    } catch (error) {
      console.error('Error fetching assignment targets:', error);
      throw new Error('Failed to fetch assignment targets');
    }
  }
  
  // ==================== UTILITY METHODS ====================
  
  /**
   * Helper method to track field changes
   */
  static getChangedFields(oldDoc, newData) {
    const changes = [];
    
    Object.keys(newData).forEach(key => {
      if (oldDoc[key] !== newData[key]) {
        changes.push({
          field: key,
          oldValue: oldDoc[key],
          newValue: newData[key]
        });
      }
    });
    
    return changes;
  }
  
  /**
   * Bulk assignment operations
   */
  static async bulkUpdateAssignments(assignmentIds, updateData, modifiedBy) {
    try {
      const result = await GenericStaffAssignment.updateMany(
        { _id: { $in: assignmentIds } },
        { 
          ...updateData, 
          lastModifiedBy: modifiedBy 
        }
      );
      
      return result;
      
    } catch (error) {
      console.error('Error bulk updating assignments:', error);
      throw new Error('Failed to bulk update assignments');
    }
  }
  
  /**
   * Search assignments with regex fallback or full-text search
   */
  static async searchAssignments(searchTerm, filters = {}) {
    try {
      let query;
      
      try {
        // Try full-text search first (requires text index)
        const searchFilters = {
          ...filters,
          $text: { $search: searchTerm }
        };
        
        return await GenericStaffAssignment
          .find(searchFilters, { score: { $meta: 'textScore' } })
          .populate('employee', 'firstName lastName employeeId')
          .populate('staffType', 'name code icon')
          .populate('targets.targetId', 'name code')
          .sort({ score: { $meta: 'textScore' } })
          .lean();
          
      } catch (textError) {
        if (textError.codeName === 'IndexNotFound') {
          // Fallback to regex search if text index doesn't exist
          console.warn('Text index not found, falling back to regex search');
          
          const regexPattern = new RegExp(searchTerm, 'i');
          const regexFilters = {
            ...filters,
            $or: [
              { title: regexPattern },
              { description: regexPattern },
              { notes: regexPattern },
              { tags: { $in: [regexPattern] } }
            ]
          };
          
          return await GenericStaffAssignment
            .find(regexFilters)
            .populate('employee', 'firstName lastName employeeId')
            .populate('staffType', 'name code icon')
            .populate('targets.targetId', 'name code')
            .sort({ createdAt: -1 })
            .lean();
        }
        throw textError;
      }
      
    } catch (error) {
      console.error('Error searching assignments:', error);
      throw new Error('Failed to search assignments');
    }
  }
}

module.exports = StaffManagementService;
