import jwt, { JwtPayload } from 'jsonwebtoken';
import env from '../config/env';

export interface TokenPayload {
  userId: string;
  role: string;
  entityId?: string;
  isPlatformOwner?: boolean;
  [key: string]: any;
}

/**
 * Generate Access Token
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
};

/**
 * Generate Refresh Token
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
  });
};

/**
 * Verify Access Token
 */
export const verifyAccessToken = (token: string): TokenPayload & JwtPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload & JwtPayload;
};

/**
 * Verify Refresh Token
 */
export const verifyRefreshToken = (token: string): TokenPayload & JwtPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload & JwtPayload;
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
