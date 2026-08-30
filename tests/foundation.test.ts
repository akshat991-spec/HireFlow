import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/auth.service.js';
import { Role } from '../src/types/index.js';

describe('HireFlow Backend Foundation', () => {
  const app = createApp();
  const testToken = AuthService.generateToken({
    id: 'test_user_1',
    name: 'Test Recruiter',
    email: 'test@hireflow.test',
    role: Role.RECRUITER,
  });

  it('GET /api/health returns operational status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data).toHaveProperty('database');
    expect(res.body.data).toHaveProperty('uptime');
  });

  it('GET /api/auth/me returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/auth/me returns user profile when authenticated', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('test@hireflow.test');
    expect(res.body.data.role).toBe(Role.RECRUITER);
  });

  it('GET /api/openings requires authentication', async () => {
    const res = await request(app).get('/api/openings');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/applications requires authentication', async () => {
    const res = await request(app).get('/api/applications');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
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
