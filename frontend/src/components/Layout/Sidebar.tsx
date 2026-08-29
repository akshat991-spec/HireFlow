import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Users, Bell } from 'lucide-react';

interface SidebarProps {
  alertsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ alertsCount = 0 }) => {
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

      <div className="user-profile" id="user-profile-widget">
        <div className="user-avatar" id="user-avatar-initials">R</div>
        <div className="user-info">
          <span className="user-name" id="user-display-name">Demo Recruiter</span>
          <span className="user-role-badge" id="user-display-role">Recruiter</span>
        </div>
      </div>
    </aside>
  );
};
