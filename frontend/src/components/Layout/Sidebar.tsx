import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Users, Bell, UserSwitch, Check } from 'lucide-react';
import { useAuth, DEMO_ACCOUNTS } from '../../context/AuthContext.js';
import { Role } from '../../types/index.js';

interface SidebarProps {
  alertsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ alertsCount = 0 }) => {
  const { currentUser, loginAs, loading } = useAuth();
  const [showSwitchDropdown, setShowSwitchDropdown] = useState(false);

  const initials = currentUser?.name
    ? currentUser.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'HF';

  const isRecruiter = currentUser?.role === Role.RECRUITER;

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">HF</div>
        <div className="brand-name">HireFlow</div>
      </div>

      <nav>
        <ul className="nav-menu">
          <li>
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              id="nav-dashboard"
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/openings"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              id="nav-openings"
            >
              <Briefcase size={18} />
              <span>Job Openings</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/candidates"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              id="nav-candidates"
            >
              <Users size={18} />
              <span>Candidates</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/alerts"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              id="nav-alerts"
            >
              <Bell size={18} />
              <span>Stalled Alerts</span>
              {alertsCount > 0 && <span className="nav-badge">{alertsCount}</span>}
            </NavLink>
          </li>
        </ul>
      </nav>

      {/* User profile & demo account switcher */}
      <div style={{ position: 'relative', marginTop: 'auto' }}>
        <div
          className="user-profile"
          id="user-profile-widget"
          onClick={() => setShowSwitchDropdown(!showSwitchDropdown)}
          style={{ cursor: 'pointer', position: 'relative' }}
          title="Click to switch demo accounts / personas"
        >
          <div
            className="user-avatar"
            id="user-avatar-initials"
            style={{
              backgroundColor: isRecruiter ? 'var(--primary)' : 'var(--secondary)',
            }}
          >
            {initials}
          </div>
          <div className="user-info" style={{ flex: 1 }}>
            <span className="user-name" id="user-display-name">
              {currentUser?.name || 'Loading...'}
            </span>
            <span
              className="user-role-badge"
              id="user-display-role"
              style={{
                backgroundColor: isRecruiter ? 'rgba(79, 70, 229, 0.25)' : 'rgba(14, 165, 233, 0.25)',
                color: isRecruiter ? 'var(--primary-light)' : 'var(--secondary)',
              }}
            >
              {currentUser?.role || '...'}
            </span>
          </div>
        </div>

        {/* Switch Dropdown Menu */}
        {showSwitchDropdown && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              marginBottom: '0.5rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: '0.5rem',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                padding: '0.25rem 0.5rem',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '0.25rem',
              }}
            >
              Switch Role / Persona
            </div>
            {DEMO_ACCOUNTS.map((acc) => {
              const active = currentUser?.email === acc.email;
              return (
                <button
                  key={acc.email}
                  onClick={async () => {
                    await loginAs(acc.email);
                    setShowSwitchDropdown(false);
                  }}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.45rem 0.6rem',
                    backgroundColor: active ? 'rgba(79, 70, 229, 0.2)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: active ? 'var(--primary-light)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.825rem',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{acc.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{acc.badge}</div>
                  </div>
                  {active && <Check size={16} color="var(--primary)" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
