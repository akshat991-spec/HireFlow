import React from 'react';
import { NavLink } from 'react-router-dom';
import { Search, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { Role } from '../../types/index.js';

interface HeaderProps {
  onAddCandidate?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const { currentUser } = useAuth();
  const isRecruiter = currentUser?.role === Role.RECRUITER;

  const initials = currentUser?.name
    ? currentUser.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'HF';

  return (
    <header className="top-bar" style={{ gap: '2rem' }}>
      {/* Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.45rem',
            fontWeight: 700,
            color: '#d97706',
            letterSpacing: '-0.01em',
          }}
        >
          HireFlow
        </span>
      </div>

      {/* Top Navigation Links */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', marginRight: 'auto' }}>
        <NavLink
          to="/dashboard"
          style={({ isActive }) => ({
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: isActive ? 600 : 500,
            color: isActive ? '#0f172a' : 'var(--text-secondary)',
            padding: '0.4rem 0',
            borderBottom: isActive ? '2px solid #d97706' : '2px solid transparent',
            transition: 'all var(--transition-fast)',
          })}
        >
          Dashboard
        </NavLink>

        <NavLink
          to="/openings"
          style={({ isActive }) => ({
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: isActive ? 600 : 500,
            color: isActive ? '#0f172a' : 'var(--text-secondary)',
            padding: '0.4rem 0',
            borderBottom: isActive ? '2px solid #d97706' : '2px solid transparent',
            transition: 'all var(--transition-fast)',
          })}
        >
          Active Roles
        </NavLink>

        <NavLink
          to="/candidates"
          style={({ isActive }) => ({
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: isActive ? 600 : 500,
            color: isActive ? '#0f172a' : 'var(--text-secondary)',
            padding: '0.4rem 0',
            borderBottom: isActive ? '2px solid #d97706' : '2px solid transparent',
            transition: 'all var(--transition-fast)',
          })}
        >
          Pipelines
        </NavLink>

        <NavLink
          to="/alerts"
          style={({ isActive }) => ({
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: isActive ? 600 : 500,
            color: isActive ? '#0f172a' : 'var(--text-secondary)',
            padding: '0.4rem 0',
            borderBottom: isActive ? '2px solid #d97706' : '2px solid transparent',
            transition: 'all var(--transition-fast)',
          })}
        >
          Reports & Alerts
        </NavLink>
      </nav>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <button
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '0.35rem',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Search"
        >
          <Search size={18} />
        </button>

        <NavLink
          to="/alerts"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '0.35rem',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
          }}
          title="Notifications"
        >
          <Bell size={18} />
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: '#d97706',
            }}
          />
        </NavLink>

        {/* User avatar pill */}
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: '#eff6ff',
            border: '1.5px solid #bfdbfe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.8rem',
            color: '#2563eb',
          }}
        >
          {initials}
        </div>
      </div>
    </header>
  );
};
