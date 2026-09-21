import request from 'supertest';
import app from '../src/app';

describe('GET /health', () => {
  it('should return 200 with service health details', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('uptime');
    expect(res.body.data).toHaveProperty('timestamp');
    expect(res.body.data).toHaveProperty('environment');
  });

  it('should return 404 for unknown route', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint-xyz');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
