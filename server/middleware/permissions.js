const { hasPermission, checkSubRoleAccess } = require('../config/permissions');

const checkPermission = (permission) => {
  return (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Check permission using centralized config
      if (hasPermission(user.role, permission)) {
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

const checkSubRolePermission = (module, submodule, action) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Check sub-role access
      const hasAccess = await checkSubRoleAccess(user.id, module, submodule, action);
      
      if (hasAccess) {
        return next();
      }

      return res.status(403).json({ 
        message: 'Insufficient sub-role permissions to perform this action' 
      });
    } catch (error) {
      console.error('Sub-role permission check error:', error);
      return res.status(500).json({ message: 'Error checking sub-role permissions' });
    }
  };
};

module.exports = {
  checkPermission,
  checkSubRolePermission
}; 