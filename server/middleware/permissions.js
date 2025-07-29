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
        loan_create: ['admin', 'hr_manager', 'employee']
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