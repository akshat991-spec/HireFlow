import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { HealthCheckData } from '../types/index.js';

export const DashboardPage: React.FC = () => {
  const [health, setHealth] = useState<HealthCheckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api.get<HealthCheckData>('/api/health', { silent: true })
      .then((res) => {
        if (mounted && res.success) {
          setHealth(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Dashboard Overview</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          High-level recruitment analytics and pipeline metrics.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
            Open Positions
          </div>
          <div id="metric-openings" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
            0
          </div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
            Active Candidates
          </div>
          <div id="metric-active" style={{ fontSize: '2rem', fontWeight: 700, color: '#818cf8', marginTop: '0.5rem' }}>
            0
          </div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
            Interviews This Week
          </div>
          <div id="metric-interviews" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--secondary)', marginTop: '0.5rem' }}>
            0
          </div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
            Hires This Month
          </div>
          <div id="metric-hires" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.5rem' }}>
            0
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem' }}>System & Foundation Status</h2>
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Checking backend service connection...</div>
        ) : error ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--danger)', fontSize: '0.9rem' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--danger)' }} />
            Backend connection error: {error}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--success)' }} />
            Backend API: <strong style={{ color: 'var(--text-primary)' }}>{health?.status}</strong> ({health?.environment}) • PostgreSQL:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{health?.database}</strong> • Uptime: {Math.floor(health?.uptime || 0)}s
          </div>
        )}
      </div>
    </div>
  );
};
