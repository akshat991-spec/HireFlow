import React from 'react';

export const CandidatesPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Candidates Search & Pipeline</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Find, filter, advance, and manage candidate applications.
        </p>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Candidates pipeline view is ready for data integration.</p>
      </div>
    </div>
  );
};
