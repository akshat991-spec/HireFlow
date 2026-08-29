import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="top-bar">
      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
        Hiring Pipeline Management Platform
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <span
          style={{
            fontSize: '0.8rem',
            background: 'var(--bg-card)',
            padding: '0.3rem 0.6rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-muted)',
          }}
        >
          v1.0-alpha
        </span>
      </div>
    </header>
  );
};
