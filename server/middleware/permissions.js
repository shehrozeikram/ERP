const checkPermission = (permission) => {
  return (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Admin has all permissions
      if (user.role === 'admin') {
        return next();
      }

      // Define permission mappings
      const permissionMappings = {
        loan_approval: ['admin', 'hr_manager'],
        loan_disbursement: ['admin', 'hr_manager', 'finance_manager'],
        loan_management: ['admin', 'hr_manager'],
        loan_view: ['admin', 'hr_manager', 'finance_manager', 'employee'],
        loan_create: ['admin', 'hr_manager', 'employee'],
        settlement_approval: ['admin', 'hr_manager', 'general_manager'],
        settlement_processing: ['admin', 'hr_manager', 'finance_manager'],
        settlement_management: ['admin', 'hr_manager'],
        settlement_view: ['admin', 'hr_manager', 'finance_manager', 'employee'],
        settlement_create: ['admin', 'hr_manager'],
        
        // Talent Acquisition
        talent_acquisition: ['admin', 'hr_manager'],
        job_postings: ['admin', 'hr_manager'],
        candidates: ['admin', 'hr_manager'],
        applications: ['admin', 'hr_manager'],
        
        // Vehicle Management
        vehicle: ['admin'],
        vehicle_create: ['admin'],
        vehicle_update: ['admin'],
        vehicle_delete: ['admin'],
        vehicle_view: ['admin'],
        
        // Grocery Management
        grocery: ['admin'],
        grocery_create: ['admin'],
        grocery_update: ['admin'],
        grocery_delete: ['admin'],
        grocery_view: ['admin'],
        
        // Supplier Management
        supplier: ['admin'],
        supplier_create: ['admin'],
        supplier_update: ['admin'],
        supplier_delete: ['admin'],
        supplier_view: ['admin'],
        
        // Petty Cash Management
        petty_cash: ['admin'],
        petty_cash_create: ['admin'],
        petty_cash_update: ['admin'],
        petty_cash_delete: ['admin'],
        petty_cash_view: ['admin'],
        petty_cash_approve: ['admin'],
        
        // Event Management
        event: ['admin'],
        event_create: ['admin'],
        event_update: ['admin'],
        event_delete: ['admin'],
        event_view: ['admin'],
        
        // Staff Management
        staff_assignment: ['admin'],
        staff_assignment_create: ['admin'],
        staff_assignment_update: ['admin'],
        staff_assignment_delete: ['admin'],
        staff_assignment_view: ['admin'],
        
        // Location Management
        location: ['admin'],
        location_create: ['admin'],
        location_update: ['admin'],
        location_delete: ['admin'],
        location_view: ['admin'],
        
        // Utility Bills Management
        utility: ['admin'],
        utility_create: ['admin'],
        utility_update: ['admin'],
        utility_delete: ['admin'],
        utility_view: ['admin']
      };

      const allowedRoles = permissionMappings[permission];
      
      if (!allowedRoles) {
        return res.status(403).json({ message: 'Permission not defined' });
      }

      if (allowedRoles.includes(user.role)) {
        return next();
      }

      return res.status(403).json({ 
        message: 'Insufficient permissions to perform this action' 
      });
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ message: 'Error checking permissions' });
    }
  };
};

module.exports = {
  checkPermission
}; 