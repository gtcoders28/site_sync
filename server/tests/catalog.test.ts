import request from 'supertest';
import app from '../src/app';

describe('Catalog Endpoints', () => {
  describe('GET /api/v1/catalog/products', () => {
    it('should return 401 when accessed without credentials', async () => {
      const res = await request(app).get('/api/v1/catalog/products');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/catalog/products', () => {
    it('should reject unauthorized product creation with 401', async () => {
      const res = await request(app)
        .post('/api/v1/catalog/products')
        .send({
          variantName: 'Test Product',
          unitPrice: 100,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/catalog/brands', () => {
    it('should reject unauthenticated brand creation', async () => {
      const res = await request(app)
        .post('/api/v1/catalog/brands')
        .send({ brandName: 'Brand X' });

      expect(res.status).toBe(401);
    });
  });
});
