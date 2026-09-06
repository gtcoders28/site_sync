const authService = require('./auth.service');
const { APIResponse } = require('../../utils/apiResponse');

class AuthController {
  constructor() {
    this.createDistributor = this.createDistributor.bind(this);
    this.registerDealer = this.registerDealer.bind(this);
    this.registerCustomer = this.registerCustomer.bind(this);
    this.registerInfluencer = this.registerInfluencer.bind(this);
    this.signIn = this.signIn.bind(this);
    this.signInDistributor = this.signInDistributor.bind(this);
    this.signInDealer = this.signInDealer.bind(this);
    this.signInCustomer = this.signInCustomer.bind(this);
    this.signInInfluencer = this.signInInfluencer.bind(this);
    this.refreshToken = this.refreshToken.bind(this);
    this.logout = this.logout.bind(this);
    this.getMe = this.getMe.bind(this);
  }

  async createDistributor(req, res, next) {
    try {
      const result = await authService.createDistributor(req.body, req.user);
      return APIResponse.created(res, 'Distributor created successfully by Platform Owner', result);
    } catch (err) {
      next(err);
    }
  }

  async registerDealer(req, res, next) {
    try {
      const result = await authService.signUpDealer(req.body, req.user);
      const message = result.requiresApproval
        ? 'Dealer registered successfully. Awaiting approval from assigned distributor.'
        : 'Dealer registered successfully.';
      return APIResponse.created(res, message, result);
    } catch (err) {
      next(err);
    }
  }

  async registerCustomer(req, res, next) {
    try {
      const result = await authService.signUpCustomer(req.body, req.user);
      const message = result.requiresApproval
        ? 'Customer registered successfully. Awaiting approval from dealer.'
        : 'Customer registered successfully.';
      return APIResponse.created(res, message, result);
    } catch (err) {
      next(err);
    }
  }

  async registerInfluencer(req, res, next) {
    try {
      const result = await authService.signUpInfluencer(req.body, req.user);
      return APIResponse.created(res, 'Influencer registered successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async signIn(req, res, next) {
    try {
      const result = await authService.signIn(req.body);

      // Set secure HTTP-only cookie for refresh token if desired
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return APIResponse.success(res, 'Sign in successful', result);
    } catch (err) {
      next(err);
    }
  }

  async signInDistributor(req, res, next) {
    req.body.role = 'distributor';
    return this.signIn(req, res, next);
  }

  async signInDealer(req, res, next) {
    req.body.role = 'dealer';
    return this.signIn(req, res, next);
  }

  async signInCustomer(req, res, next) {
    req.body.role = 'customer';
    return this.signIn(req, res, next);
  }

  async signInInfluencer(req, res, next) {
    req.body.role = 'influencer';
    return this.signIn(req, res, next);
  }

  async refreshToken(req, res, next) {
    try {
      const token = req.body.refreshToken || req.cookies?.refreshToken;
      const tokens = await authService.refreshToken(token);

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return APIResponse.success(res, 'Tokens refreshed successfully', tokens);
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      res.clearCookie('refreshToken');
      return APIResponse.success(res, 'Logged out successfully');
    } catch (err) {
      next(err);
    }
  }

  async getMe(req, res, next) {
    try {
      return APIResponse.success(res, 'Current user profile', req.user);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
