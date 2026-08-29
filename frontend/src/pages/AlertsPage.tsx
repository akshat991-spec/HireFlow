import React from 'react';

export const AlertsPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Stalled Application Alerts</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Applications sitting in the same stage for more than 10 days.
        </p>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Alerts view initialized.</p>
      </div>
    </div>
  );
};
