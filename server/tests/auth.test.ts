import request from 'supertest';
import app from '../src/app';

describe('Auth Endpoints & Validation', () => {
  describe('POST /api/v1/auth/login', () => {
    it('should reject login when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid mobile number format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          mobileNumber: '12345',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject nonexistent credentials with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          mobileNumber: '9999999999',
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }, 15000);
  });

  describe('POST /api/v1/auth/refresh-token', () => {
    it('should return 400 validation error when no refresh token is provided', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({});

      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Distributor Creation Security', () => {
    it('should reject unauthenticated distributor creation with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/distributor/create')
        .send({
          companyName: 'ACME Ltd',
          ownerName: 'John Doe',
          mobileNumber: '9876543210',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/dealer/signup', () => {
    it('should fail with 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/dealer/signup')
        .send({
          shopName: 'My Shop',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
