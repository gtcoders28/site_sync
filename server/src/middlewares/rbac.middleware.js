const { APIError } = require('../errors/apiError');
const { ROLES } = require('../config/constants');

/**
 * Middleware to restrict route access to specific roles
 * @param  {...string} allowedRoles 
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(APIError.unauthorized('Authentication required'));
    }

    const userRole = req.user.role;
    const isPlatformOwner = req.user.isPlatformOwner;

    // Platform owner has full access if platform_owner_distributor or distributor is in allowedRoles
    if (
      isPlatformOwner &&
      (allowedRoles.includes(ROLES.PLATFORM_OWNER_DISTRIBUTOR) || allowedRoles.includes(ROLES.DISTRIBUTOR))
    ) {
      return next();
    }

    if (allowedRoles.includes(userRole)) {
      return next();
    }

    return next(
      APIError.forbidden(
        `Access denied. Role '${userRole}' is not authorized to access this resource.`,
        'INSUFFICIENT_PERMISSIONS'
      )
    );
  };
};

/**
 * Middleware strictly requiring Platform Owner
 */
const requirePlatformOwner = (req, res, next) => {
  if (!req.user) {
    return next(APIError.unauthorized('Authentication required'));
  }
  if (!req.user.isPlatformOwner) {
    return next(
      APIError.forbidden('This operation is strictly restricted to the Platform Owner.', 'PLATFORM_OWNER_REQUIRED')
    );
  }
  next();
};

module.exports = {
  authorizeRoles,
  requirePlatformOwner,
};
