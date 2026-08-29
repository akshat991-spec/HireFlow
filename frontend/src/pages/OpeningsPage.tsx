import React from 'react';

export const OpeningsPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Job Openings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Manage open positions and candidate pipelines.
          </p>
        </div>
        <button className="btn btn-primary" id="btn-new-opening">+ Create Opening</button>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Job Openings view is ready for data integration.</p>
      </div>
    </div>
  );
};
