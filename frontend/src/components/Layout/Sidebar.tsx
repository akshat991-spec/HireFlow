import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Bell,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth, DEMO_ACCOUNTS } from '../../context/AuthContext.js';
import { Role } from '../../types/index.js';

interface SidebarProps {
  alertsCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  alertsCount = 0,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { currentUser, loginAs, logout, loading } = useAuth();
  const [showSwitchDropdown, setShowSwitchDropdown] = useState(false);

  const initials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'HF';

  const isRecruiter = currentUser?.role === Role.RECRUITER;

  const handleNavClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      {/* Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', width: '100%', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
        <NavLink
          to="/dashboard"
          onClick={handleNavClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            textDecoration: 'none',
            color: 'inherit',
          }}
          title="HireFlow — Return to Dashboard"
        >
          <div className="brand-icon">HF</div>
          {!isCollapsed && (
            <div className="brand-name">
              Hire<span className="brand-accent">Flow</span>
            </div>
          )}
        </NavLink>

        {/* Mobile close button or Desktop collapse toggle */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Mobile Close X button */}
          {isMobileOpen && (
            <button
              onClick={onCloseMobile}
              title="Close Menu"
              className="mobile-menu-btn"
              style={{ display: 'flex', padding: '0.25rem', color: 'var(--text-muted)' }}
            >
              <X size={20} />
            </button>
          )}

          {/* Desktop collapse toggle button */}
          {!isCollapsed && onToggleCollapse && !isMobileOpen && (
            <button
              onClick={onToggleCollapse}
              title="Collapse Sidebar"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.3rem',
                display: 'flex',
                alignItems: 'center',
                borderRadius: 'var(--radius-sm)',
                transition: 'all var(--transition-fast)',
              }}
              className="hover-bg"
            >
              <PanelLeftClose size={18} />
            </button>
          )}
        </div>
      </div>

      {/* When collapsed on desktop, provide expand button right beneath brand */}
      {isCollapsed && onToggleCollapse && (
        <div style={{ marginTop: '0.75rem', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={onToggleCollapse}
            title="Expand Sidebar"
            style={{
              background: 'none',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
            }}
          >
            <PanelLeftOpen size={16} />
          </button>
        </div>
      )}

      {/* Navigation links */}
      <nav style={{ width: '100%' }}>
        <ul className="nav-menu">
          <li>
            <NavLink
              to="/dashboard"
              onClick={handleNavClick}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              id="nav-dashboard"
              title="Dashboard Overview"
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/openings"
              onClick={handleNavClick}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              id="nav-openings"
              title="Job Openings"
            >
              <Briefcase size={18} />
              <span>Job Openings</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/candidates"
              onClick={handleNavClick}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              id="nav-candidates"
              title={isRecruiter ? 'Candidate Pipelines' : 'My Applications'}
            >
              <Users size={18} />
              <span>{isRecruiter ? 'Candidates' : 'My Applications'}</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/alerts"
              onClick={handleNavClick}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              id="nav-alerts"
              title="Stalled Candidate Alerts"
            >
              <Bell size={18} />
              <span>Stalled Alerts</span>
              {alertsCount > 0 && <span className="nav-badge">{alertsCount}</span>}
            </NavLink>
          </li>
        </ul>
      </nav>

      {/* User profile & demo account switcher */}
      <div style={{ position: 'relative', marginTop: 'auto', width: '100%' }}>
        <div
          className="user-profile"
          id="user-profile-widget"
          onClick={() => setShowSwitchDropdown(!showSwitchDropdown)}
          style={{ cursor: 'pointer', position: 'relative' }}
          title={isCollapsed ? `${currentUser?.name} (${currentUser?.role}) — Click to switch persona` : 'Click to switch demo accounts / personas'}
        >
          <div
            className="user-avatar"
            id="user-avatar-initials"
            style={{
              backgroundColor: isRecruiter ? '#eff6ff' : '#f0f9ff',
              color: isRecruiter ? '#2563eb' : '#0284c7',
              border: `1.5px solid ${isRecruiter ? '#bfdbfe' : '#bae6fd'}`,
            }}
          >
            {initials}
          </div>
          {!isCollapsed && (
            <div className="user-info" style={{ flex: 1 }}>
              <span className="user-name" id="user-display-name">
                {currentUser?.name || 'Loading...'}
              </span>
              <span
                className="user-role-badge"
                id="user-display-role"
                style={{
                  color: isRecruiter ? '#2563eb' : '#0284c7',
                  fontWeight: 700,
                }}
              >
                {currentUser?.role || '...'}
              </span>
            </div>
          )}
        </div>

        {/* Switch Dropdown Menu */}
        {showSwitchDropdown && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: isCollapsed ? '100%' : 0,
              right: isCollapsed ? 'auto' : 0,
              marginLeft: isCollapsed ? '0.5rem' : 0,
              marginBottom: '0.5rem',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: '0.5rem',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              minWidth: '220px',
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
                    if (onCloseMobile) onCloseMobile();
                  }}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.45rem 0.6rem',
                    backgroundColor: active ? '#eff6ff' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: active ? '#0066ff' : 'var(--text-primary)',
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
                  {active && <Check size={16} color="#0066ff" />}
                </button>
              );
            })}

            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
              <button
                onClick={async () => {
                  await logout();
                  setShowSwitchDropdown(false);
                  if (onCloseMobile) onCloseMobile();
                }}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 0.6rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#dc2626',
                  cursor: 'pointer',
                  fontSize: '0.825rem',
                  textAlign: 'left',
                  width: '100%',
                  fontWeight: 600,
                }}
              >
                <LogOut size={15} />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
