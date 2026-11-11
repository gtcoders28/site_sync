import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { APIResponse } from '../../utils/apiResponse';
import { DEALER_TYPE } from '../../config/constants';
import env from '../../config/env';

export class AuthController {
  constructor() {
    this.createDistributor = this.createDistributor.bind(this);
    this.registerDealer = this.registerDealer.bind(this);
    this.registerRetailer = this.registerRetailer.bind(this);
    this.registerCustomer = this.registerCustomer.bind(this);
    this.registerInfluencer = this.registerInfluencer.bind(this);
    this.signIn = this.signIn.bind(this);
    this.signInDistributor = this.signInDistributor.bind(this);
    this.signInDealer = this.signInDealer.bind(this);
    this.signInRetailer = this.signInRetailer.bind(this);
    this.signInCustomer = this.signInCustomer.bind(this);
    this.signInInfluencer = this.signInInfluencer.bind(this);
    this.signInStaff = this.signInStaff.bind(this);
    this.refreshToken = this.refreshToken.bind(this);
    this.logout = this.logout.bind(this);
    this.getMe = this.getMe.bind(this);
  }

  async createDistributor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.createDistributor(req.body, req.user);
      APIResponse.created(res, 'Distributor created successfully by Platform Owner', result);
    } catch (err) {
      next(err);
    }
  }

  async registerDealer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.signUpDealer(req.body, req.user);
      const message = result.requiresApproval
        ? 'Dealer registered successfully. Awaiting approval from assigned distributor.'
        : 'Dealer registered successfully.';
      APIResponse.created(res, message, result);
    } catch (err) {
      next(err);
    }
  }

  async registerRetailer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.signUpDealer(
        { ...req.body, dealerType: DEALER_TYPE.RETAILER },
        req.user
      );
      const message = result.requiresApproval
        ? 'Retailer registered successfully. Awaiting approval from assigned parent.'
        : 'Retailer registered successfully.';
      APIResponse.created(res, message, result);
    } catch (err) {
      next(err);
    }
  }

  async registerCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.signUpCustomer(req.body, req.user);
      const message = result.requiresApproval
        ? 'Customer registered successfully. Awaiting approval from dealer.'
        : 'Customer registered successfully.';
      APIResponse.created(res, message, result);
    } catch (err) {
      next(err);
    }
  }

  async registerInfluencer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.signUpInfluencer(req.body, req.user);
      APIResponse.created(res, 'Influencer registered successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async signIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.signIn(req.body);

      // Set secure HTTP-only cookie for refresh token
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      APIResponse.success(res, 'Sign in successful', result);
    } catch (err) {
      next(err);
    }
  }

  async signInDistributor(req: Request, res: Response, next: NextFunction): Promise<void> {
    req.body.role = 'distributor';
    return this.signIn(req, res, next);
  }

  async signInDealer(req: Request, res: Response, next: NextFunction): Promise<void> {
    req.body.role = 'dealer';
    return this.signIn(req, res, next);
  }

  async signInRetailer(req: Request, res: Response, next: NextFunction): Promise<void> {
    req.body.role = 'retailer';
    return this.signIn(req, res, next);
  }

  async signInCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    req.body.role = 'customer';
    return this.signIn(req, res, next);
  }

  async signInInfluencer(req: Request, res: Response, next: NextFunction): Promise<void> {
    req.body.role = 'influencer';
    return this.signIn(req, res, next);
  }

  async signInStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    req.body.role = 'staff';
    return this.signIn(req, res, next);
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.body.refreshToken || req.cookies?.refreshToken;
      const tokens = await authService.refreshToken(token);

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      APIResponse.success(res, 'Tokens refreshed successfully', tokens);
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie('refreshToken');
      APIResponse.success(res, 'Logged out successfully');
    } catch (err) {
      next(err);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      APIResponse.success(res, 'Current user profile', req.user);
    } catch (err) {
      next(err);
    }
  }

  async getPublicDistributors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await authService.getPublicDistributors();
      APIResponse.success(res, 'Active distributors retrieved', list);
    } catch (err) {
      next(err);
    }
  }

  async getPublicDealers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await authService.getPublicDealers();
      APIResponse.success(res, 'Active dealers retrieved', list);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
export default authController;
