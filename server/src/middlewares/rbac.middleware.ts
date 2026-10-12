import { Request, Response, NextFunction } from 'express';
import { APIError } from '../errors/apiError';
import { ROLES } from '../config/constants';

/**
 * Middleware to restrict route access to specific roles
 */
export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
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
export const requirePlatformOwner = (req: Request, res: Response, next: NextFunction): void => {
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

/**
 * Middleware requiring specific staff operational permission if caller is staff
 */
export const requireStaffPermission = (permissionKey: 'canCreateInvoices' | 'canApproveRegistrations') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(APIError.unauthorized('Authentication required'));
    }
    if (req.user.role === ROLES.STAFF) {
      if (!req.user.permissions || !req.user.permissions[permissionKey]) {
        return next(
          APIError.forbidden(
            `Staff member is not authorized for '${permissionKey}'.`,
            'INSUFFICIENT_STAFF_PERMISSIONS'
          )
        );
      }
    }
    next();
  };
};

export default {
  authorizeRoles,
  requirePlatformOwner,
  requireStaffPermission,
};
