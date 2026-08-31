import React from 'react';
import { NavLink } from 'react-router-dom';
import { Search, Bell, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { Role } from '../../types/index.js';

interface HeaderProps {
  onAddCandidate?: () => void;
  alertsCount?: number;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  alertsCount = 0,
}) => {
  const { currentUser } = useAuth();
  const isRecruiter = currentUser?.role === Role.RECRUITER;

  const initials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'HF';

  return (
    <header className="top-bar">
      {/* Workspace Context & Quick Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1, maxWidth: '480px' }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '0.85rem',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search candidates, roles, or pipeline..."
            style={{
              width: '100%',
              padding: '0.45rem 0.85rem 0.45rem 2.4rem',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.84rem',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'all var(--transition-fast)',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#0066ff';
              e.target.style.backgroundColor = '#ffffff';
              e.target.style.boxShadow = '0 0 0 3px rgba(0, 102, 255, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-color)';
              e.target.style.backgroundColor = '#f8fafc';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* Right Controls: Alerts Bell + Persona Role Badge + Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginLeft: 'auto' }}>
        {/* Role Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.25rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: isRecruiter ? '#eff6ff' : '#f0f9ff',
            border: `1px solid ${isRecruiter ? '#bfdbfe' : '#bae6fd'}`,
            fontSize: '0.75rem',
            fontWeight: 700,
            color: isRecruiter ? '#1d4ed8' : '#0369a1',
          }}
        >
          <Shield size={12} />
          <span>{isRecruiter ? 'Recruiter' : 'Interviewer'}</span>
        </div>

        {/* Alerts Bell */}
        <NavLink
          to="/alerts"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '0.4rem',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            borderRadius: 'var(--radius-sm)',
            transition: 'color var(--transition-fast)',
          }}
          title="Stalled Candidate Alerts"
        >
          <Bell size={18} />
          {alertsCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                minWidth: '16px',
                height: '16px',
                padding: '0 3px',
                borderRadius: '8px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid #ffffff',
              }}
            >
              {alertsCount}
            </span>
          )}
        </NavLink>

        {/* User Avatar */}
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: isRecruiter ? '#eff6ff' : '#f0f9ff',
            border: `1.5px solid ${isRecruiter ? '#bfdbfe' : '#bae6fd'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.8rem',
            color: isRecruiter ? '#2563eb' : '#0284c7',
          }}
          title={`${currentUser?.name} (${currentUser?.email})`}
        >
          {initials}
        </div>
      </div>
    </header>
  );
};
