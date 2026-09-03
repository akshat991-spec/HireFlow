import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Shield, Menu, AlertTriangle, CheckCircle, Clock, X, ArrowRight, Loader2, BellOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { Role, StalledAlert } from '../../types/index.js';
import { api } from '../../services/api.js';

interface HeaderProps {
  onAddCandidate?: () => void;
  alertsCount?: number;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  alertsCount = 0,
  onToggleMobileMenu,
}) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const isRecruiter = currentUser?.role === Role.RECRUITER;

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownAlerts, setDropdownAlerts] = useState<StalledAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  const fetchDropdownAlerts = async () => {
    if (!isRecruiter) return;
    setLoadingAlerts(true);
    try {
      const res = await api.get<{ count: number; alerts: StalledAlert[] }>('/api/alerts/stalled', { silent: true });
      if (res.success) {
        setDropdownAlerts(res.data.alerts);
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingAlerts(false);
    }
  };

  const toggleDropdown = () => {
    if (!isDropdownOpen) {
      fetchDropdownAlerts();
    }
    setIsDropdownOpen((prev) => !prev);
  };

  const handleDismissAlert = async (e: React.MouseEvent, alert: StalledAlert) => {
    e.stopPropagation();
    setDismissingId(alert.applicationId);
    try {
      const res = await api.post(`/api/alerts/stalled/${alert.applicationId}/dismiss`);
      if (res.success) {
        setDropdownAlerts((prev) => prev.filter((a) => a.applicationId !== alert.applicationId));
        window.dispatchEvent(new CustomEvent('hireflow:alerts-updated'));
        (window as any).showToast?.(`Dismissed alert for ${alert.candidateName}`, 'success');
      }
    } catch (err: any) {
      (window as any).showToast?.(err.message || 'Failed to dismiss alert', 'error');
    } finally {
      setDismissingId(null);
    }
  };

  const handleNavigateToAlerts = () => {
    setIsDropdownOpen(false);
    navigate('/alerts');
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Sync dropdown when global alerts event fires
  useEffect(() => {
    const handleGlobalAlertUpdate = () => {
      if (isDropdownOpen) {
        fetchDropdownAlerts();
      }
    };
    window.addEventListener('hireflow:alerts-updated', handleGlobalAlertUpdate);
    return () => window.removeEventListener('hireflow:alerts-updated', handleGlobalAlertUpdate);
  }, [isDropdownOpen]);

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
      {/* Mobile Menu Hamburger Button */}
      <button
        className="mobile-menu-btn"
        onClick={onToggleMobileMenu}
        title="Open Navigation Menu"
      >
        <Menu size={22} />
      </button>

      {/* Workspace Context & Quick Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1, maxWidth: '440px' }}>
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
            placeholder="Search candidates, job roles, or stages..."
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

      {/* Right Controls: Role Badge + Alerts Bell + User Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginLeft: 'auto', position: 'relative' }}>
        {/* Role Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: isRecruiter ? '#eff6ff' : '#f0f9ff',
            border: `1px solid ${isRecruiter ? '#bfdbfe' : '#bae6fd'}`,
            fontSize: '0.75rem',
            fontWeight: 700,
            color: isRecruiter ? '#1d4ed8' : '#0369a1',
            whiteSpace: 'nowrap',
          }}
        >
          <Shield size={12} />
          <span>{isRecruiter ? 'Recruiter' : 'Interviewer'}</span>
        </div>

        {/* Dynamic Alerts Bell Button */}
        <div style={{ position: 'relative' }}>
          <button
            ref={bellButtonRef}
            onClick={toggleDropdown}
            style={{
              background: isDropdownOpen ? '#f1f5f9' : 'none',
              border: 'none',
              color: isDropdownOpen ? '#0f172a' : 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.45rem',
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              borderRadius: 'var(--radius-sm)',
              transition: 'all var(--transition-fast)',
            }}
            title="Stalled Candidate Alerts & Notifications"
          >
            <Bell size={19} />
            {alertsCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  minWidth: '17px',
                  height: '17px',
                  padding: '0 4px',
                  borderRadius: '9px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid #ffffff',
                  boxShadow: '0 1px 3px rgba(220, 38, 38, 0.4)',
                }}
              >
                {alertsCount}
              </span>
            )}
          </button>

          {/* Interactive Notification Popover Dropdown */}
          {isDropdownOpen && (
            <div
              ref={dropdownRef}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '360px',
                maxWidth: '90vw',
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                border: '1px solid #e2e8f0',
                zIndex: 9999,
                overflow: 'hidden',
                animation: 'slideDown 0.15s ease-out',
              }}
            >
              {/* Dropdown Header */}
              <div
                style={{
                  padding: '0.85rem 1rem',
                  backgroundColor: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={16} color="#d97706" />
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                    Stalled Alerts
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: alertsCount > 0 ? '#fef2f2' : '#f1f5f9',
                      color: alertsCount > 0 ? '#dc2626' : '#64748b',
                      fontWeight: 700,
                    }}
                  >
                    {alertsCount} active
                  </span>
                </div>
                <button
                  onClick={() => setIsDropdownOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '0.2rem',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Dropdown Body */}
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {loadingAlerts ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                    <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                    <span style={{ fontSize: '0.8rem' }}>Checking active alerts...</span>
                  </div>
                ) : dropdownAlerts.length === 0 ? (
                  <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
                    <CheckCircle size={32} color="#10b981" style={{ margin: '0 auto 0.5rem auto' }} />
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a', margin: '0 0 0.25rem 0' }}>
                      All candidates moving swiftly!
                    </p>
                    <p style={{ fontSize: '0.775rem', color: '#64748b', margin: 0 }}>
                      No candidates sitting in a stage for over 10 days.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {dropdownAlerts.map((alert) => (
                      <div
                        key={alert.applicationId}
                        style={{
                          padding: '0.75rem 1rem',
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                          backgroundColor: '#ffffff',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                              {alert.candidateName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {alert.jobTitle}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: '#dc2626',
                              backgroundColor: '#fef2f2',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              border: '1px solid #fee2e2',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <Clock size={10} />
                            {alert.daysInStage}d in {alert.currentStage}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <button
                            onClick={(e) => handleDismissAlert(e, alert)}
                            disabled={dismissingId === alert.applicationId}
                            style={{
                              fontSize: '0.725rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor: '#fffbeb',
                              border: '1px solid #fde68a',
                              color: '#b45309',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            {dismissingId === alert.applicationId ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <BellOff size={11} />
                            )}
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dropdown Footer */}
              <div
                style={{
                  padding: '0.65rem 1rem',
                  backgroundColor: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  textAlign: 'center',
                }}
              >
                <button
                  onClick={handleNavigateToAlerts}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>Go to Stalled Alerts Dashboard</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

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
            flexShrink: 0,
          }}
          title={`${currentUser?.name} (${currentUser?.email})`}
        >
          {initials}
        </div>
      </div>
    </header>
  );
};
