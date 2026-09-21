import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import { APIError } from '../errors/apiError';
import { query } from '../database';
import { ROLES } from '../config/constants';

export interface UserContext {
  id: string;
  userId: string;
  entityId: string;
  mobileNumber: string;
  role: string;
  isPlatformOwner: boolean;
  distributorId?: string | null;
  dealerId?: string | null;
  status: string;
  profile: any;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: UserContext | null;
    }
  }
}

/**
 * Authenticate JWT token and attach user profile to request
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | null = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(APIError.unauthorized('Authentication required. No token provided.'));
    }

    let decoded: any;
    try {
      decoded = verifyAccessToken(token);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return next(APIError.unauthorized('Token expired. Please refresh your token.', 'TOKEN_EXPIRED'));
      }
      return next(APIError.unauthorized('Invalid authentication token.', 'INVALID_TOKEN'));
    }

    const { userId, role } = decoded;

    // Resolve user from the relevant table
    let userRow: any = null;
    let isPlatformOwner = false;
    let actualRole = role;

    if (role === ROLES.PLATFORM_OWNER_DISTRIBUTOR || role === ROLES.DISTRIBUTOR) {
      const dbRes = await query(
        `SELECT distributor_id AS id, mobile_number, company_name, owner_name, email, 
                is_platform_owner, parent_distributor_id, invite_code, status 
         FROM distributors WHERE distributor_id = $1`,
        [userId]
      );
      userRow = dbRes.rows[0];
      if (userRow) {
        isPlatformOwner = userRow.is_platform_owner === true;
        actualRole = isPlatformOwner ? ROLES.PLATFORM_OWNER_DISTRIBUTOR : ROLES.DISTRIBUTOR;
      }
    } else if (role === ROLES.DEALER) {
      const dbRes = await query(
        `SELECT dealer_id AS id, distributor_id, parent_dealer_id, mobile_number, 
                shop_name, owner_name, dealer_type, invite_code, status 
         FROM dealers WHERE dealer_id = $1`,
        [userId]
      );
      userRow = dbRes.rows[0];
    } else if (role === ROLES.CUSTOMER) {
      const dbRes = await query(
        `SELECT customer_id AS id, mobile_number, name, email, referral_code, 
                referred_by_customer_id, onboarding_dealer_id, status 
         FROM customers WHERE customer_id = $1`,
        [userId]
      );
      userRow = dbRes.rows[0];
    } else if (role === ROLES.INFLUENCER) {
      const dbRes = await query(
        `SELECT influencer_id AS id, distributor_id, dealer_id, mobile_number, 
                name, referral_code, status 
         FROM influencers WHERE influencer_id = $1`,
        [userId]
      );
      userRow = dbRes.rows[0];
    }

    if (!userRow) {
      return next(APIError.unauthorized('User associated with this token no longer exists.'));
    }

    // Check account status
    if (userRow.status !== 'active') {
      return next(
        APIError.forbidden(
          `Your account is currently ${userRow.status}. Please contact support or await approval.`,
          'ACCOUNT_NOT_ACTIVE'
        )
      );
    }

    // Attach enriched user context to req
    req.user = {
      id: userRow.id,
      userId: userRow.id,
      entityId: userRow.id,
      mobileNumber: userRow.mobile_number,
      role: actualRole,
      isPlatformOwner,
      distributorId: userRow.distributor_id || (actualRole === ROLES.DISTRIBUTOR || isPlatformOwner ? userRow.id : null),
      dealerId: userRow.dealer_id || (actualRole === ROLES.DEALER ? userRow.id : null),
      status: userRow.status,
      profile: userRow,
    };

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Optional Authentication Middleware
 */
export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.accessToken;

  if ((!authHeader || !authHeader.startsWith('Bearer ')) && !cookieToken) {
    req.user = null;
    return next();
  }

  return authenticate(req, res, next);
};

export default {
  authenticate,
  optionalAuthenticate,
};
