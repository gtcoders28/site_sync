import request from 'supertest';
import app from '../src/app';

describe('RBAC & Authentication Middleware', () => {
  describe('Protected Routes Authentication', () => {
    it('should reject unauthenticated access to /api/v1/users/me with 401', async () => {
      const res = await request(app).get('/api/v1/users/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject malformed Bearer token with 401', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid-token-xyz');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated access to /api/v1/approvals with 401', async () => {
      const res = await request(app).get('/api/v1/approvals');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated access to /api/v1/analytics/platform-owner with 401', async () => {
      const res = await request(app).get('/api/v1/analytics/platform-owner');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
