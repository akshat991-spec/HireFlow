import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('HireFlow Backend Foundation', () => {
  const app = createApp();

  it('GET /api/health returns operational status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data).toHaveProperty('database');
    expect(res.body.data).toHaveProperty('uptime');
  });

  it('GET /api/auth/me returns skeleton auth response', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/openings returns initialized empty list', async () => {
    const res = await request(app).get('/api/openings');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/applications returns initialized pagination skeleton', async () => {
    const res = await request(app).get('/api/applications');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data).toHaveProperty('total');
  });

  it('GET /api/alerts/stalled returns alerts skeleton', async () => {
    const res = await request(app).get('/api/alerts/stalled');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('count');
  });

  it('GET /api/dashboard/metrics returns dashboard metrics skeleton', async () => {
    const res = await request(app).get('/api/dashboard/metrics');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('openPositions');
    expect(res.body.data).toHaveProperty('activeApplications');
  });

  it('handles 404 for unknown endpoints uniformly', async () => {
    const res = await request(app).get('/api/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
