import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Briefcase,
  Users,
  Calendar,
  Award,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  RotateCcw,
  Clock,
  Layers,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { DashboardData, HealthCheckData, Stage, StalledAlert, Role } from '../types/index.js';

const STAGE_THEME: Record<Stage, { bg: string; text: string; bar: string }> = {
  [Stage.APPLIED]: { bg: '#eff6ff', text: '#2563eb', bar: '#3b82f6' },
  [Stage.SCREENING]: { bg: '#f5f3ff', text: '#6366f1', bar: '#6366f1' },
  [Stage.INTERVIEW]: { bg: '#f0f9ff', text: '#0284c7', bar: '#0284c7' },
  [Stage.OFFER]: { bg: '#fffbeb', text: '#b45309', bar: '#f59e0b' },
  [Stage.HIRED]: { bg: '#ecfdf5', text: '#047857', bar: '#10b981' },
  [Stage.REJECTED]: { bg: '#fef2f2', text: '#b91c1c', bar: '#ef4444' },
};

function getCandidateInitials(name: string): string {
  if (!name) return 'C';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const DashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [stalledAlerts, setStalledAlerts] = useState<StalledAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const isRecruiter = currentUser?.role === Role.RECRUITER;

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const promises: [Promise<any>, Promise<any>?] = [
        api.get<DashboardData>('/api/dashboard/metrics'),
      ];

      if (isRecruiter) {
        promises.push(api.get<{ alerts: StalledAlert[] }>('/api/alerts/stalled', { silent: true }));
      }

      const [dashRes, alertsRes] = await Promise.all(promises);

      if (dashRes.success) {
        setData(dashRes.data);
        setLastRefreshed(new Date());
      }
      if (alertsRes && alertsRes.success && alertsRes.data?.alerts) {
        setStalledAlerts(alertsRes.data.alerts);
      } else {
        setStalledAlerts([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentUser]);

  const headline = data?.headline;
  const maxWeeklyCount = data?.weeklyTrend
    ? Math.max(...data.weeklyTrend.map((w) => w.count), 1)
    : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">{isRecruiter ? 'Recruitment Dashboard' : 'Interviewer Workspace'}</h1>
          <div className="page-subtitle-tracked">
            {isRecruiter
              ? 'REAL-TIME HIRING METRICS & WORKFLOW OVERVIEW'
              : 'YOUR ASSIGNED CANDIDATE PANEL, EVALUATIONS & INTERVIEWS'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            className="btn btn-secondary"
            onClick={fetchDashboardData}
            disabled={loading}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
          >
            <RotateCcw size={14} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <AlertTriangle size={20} />
          <span>{error}</span>
          <button
            onClick={fetchDashboardData}
            className="btn btn-secondary"
            style={{ marginLeft: 'auto', padding: '0.25rem 0.75rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. Primary Recruitment KPIs */}
      <div className="kpi-grid">
        {/* Open Positions / Assigned Roles */}
        <NavLink
          to={isRecruiter ? "/openings" : "/candidates"}
          style={{ textDecoration: 'none', color: 'inherit' }}
          className="card"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isRecruiter ? 'Open Positions' : 'Assigned Roles'}
              </div>
              <div id="metric-openings" style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
                {loading ? '—' : headline?.openPositions ?? 0}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#d97706',
              }}
            >
              <Briefcase size={20} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#d97706', marginTop: '0.75rem', fontWeight: 600 }}>
            <span>{isRecruiter ? 'Active openings directory' : 'Roles with assigned candidates'}</span>
            <ArrowUpRight size={13} />
          </div>
        </NavLink>

        {/* Active Candidates / My Candidates */}
        <NavLink
          to="/candidates"
          style={{ textDecoration: 'none', color: 'inherit' }}
          className="card"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isRecruiter ? 'Active Candidates' : 'My Candidates'}
              </div>
              <div id="metric-active" style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0066ff', marginTop: '0.35rem' }}>
                {loading ? '—' : headline?.activeApplications ?? 0}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0066ff',
              }}
            >
              <Users size={20} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#0066ff', marginTop: '0.75rem', fontWeight: 600 }}>
            <span>{isRecruiter ? 'View candidate pool' : 'Review assigned applications'}</span>
            <ArrowUpRight size={13} />
          </div>
        </NavLink>

        {/* Interviews This Week / My Interviews */}
        <NavLink
          to="/candidates?stage=INTERVIEW"
          style={{ textDecoration: 'none', color: 'inherit' }}
          className="card"
          title="Click to view candidates in the Interview stage"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isRecruiter ? 'Interviews This Week' : 'My Interviews'}
              </div>
              <div id="metric-interviews" style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0284c7', marginTop: '0.35rem' }}>
                {loading ? '—' : headline?.interviewsThisWeek ?? 0}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7',
              }}
            >
              <Calendar size={20} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#0284c7', marginTop: '0.75rem', fontWeight: 600 }}>
            <span>{isRecruiter ? 'Scheduled evaluations' : 'Panel candidates in interview'}</span>
            <ArrowUpRight size={13} />
          </div>
        </NavLink>

        {/* Hires This Month / Panel Hires */}
        <NavLink
          to="/candidates?stage=HIRED"
          style={{ textDecoration: 'none', color: 'inherit' }}
          className="card"
          title="Click to view candidates hired this month"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isRecruiter ? 'Hires This Month' : 'Panel Hires'}
              </div>
              <div id="metric-hires" style={{ fontSize: '2.2rem', fontWeight: 800, color: '#059669', marginTop: '0.35rem' }}>
                {loading ? '—' : headline?.hiresThisMonth ?? 0}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669',
              }}
            >
              <Award size={20} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#059669', marginTop: '0.75rem', fontWeight: 600 }}>
            <span>{isRecruiter ? 'Completed placements' : 'Assigned candidates hired'}</span>
            <ArrowUpRight size={13} />
          </div>
        </NavLink>
      </div>

      {/* 2. Middle Grid: Recruitment Stages & Influx Trend */}
      <div className="dashboard-two-col">
        {/* Candidates by Recruitment Stage */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Layers size={18} color="#0066ff" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isRecruiter ? 'Candidates by Recruitment Stage' : 'Assigned Candidates by Stage'}
              </h2>
            </div>
            <NavLink
              to="/candidates"
              style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
            >
              {isRecruiter ? 'View directory' : 'View my applications'}
            </NavLink>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {data?.byStage.map((s) => {
              const theme = STAGE_THEME[s.stage] || STAGE_THEME[Stage.APPLIED];

              return (
                <NavLink
                  key={s.stage}
                  to={`/candidates?stage=${s.stage}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    textDecoration: 'none',
                    padding: '0.4rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  className="hover-bg"
                  title={`View candidates in ${s.stage}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.stage}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{s.count}</strong> candidate{s.count === 1 ? '' : 's'} ({s.percentage}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: '7px',
                      borderRadius: '4px',
                      backgroundColor: '#f1f5f9',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.max(s.percentage, s.count > 0 ? 3 : 0)}%`,
                        backgroundColor: theme.bar,
                        borderRadius: '4px',
                        transition: 'width 300ms ease',
                      }}
                    />
                  </div>
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* 12-Week Quarterly Application Volume Trend */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <TrendingUp size={18} color="#d97706" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Application Influx (Last Quarter)
              </h2>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              12 WEEKS
            </span>
          </div>

          {/* Bar Chart Visualization */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                height: '140px',
                paddingTop: '0.75rem',
                gap: '6px',
              }}
            >
              {data?.weeklyTrend.map((week, idx) => {
                const barHeightPct = Math.max(10, Math.round((week.count / maxWeeklyCount) * 100));
                const isCurrentWeek = idx === (data?.weeklyTrend.length ?? 0) - 1;

                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.35rem',
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                    title={`Week of ${week.weekLabel}: ${week.count} application${week.count === 1 ? '' : 's'}`}
                  >
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: week.count > 0 ? '#0f172a' : '#cbd5e1' }}>
                      {week.count}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '28px',
                        height: `${barHeightPct}%`,
                        backgroundColor: isCurrentWeek
                          ? '#0066ff'
                          : week.count > 0
                          ? '#93c5fd'
                          : '#e2e8f0',
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.3s ease, background-color var(--transition-fast)',
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Numerical Day Labels */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '0.35rem',
                borderTop: '1px solid var(--border-color)',
                gap: '6px',
              }}
            >
              {data?.weeklyTrend.map((week, idx) => {
                const dayNum = week.weekLabel.split(' ')[1];
                const isCurrentWeek = idx === data.weeklyTrend.length - 1;

                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        color: isCurrentWeek ? '#0066ff' : 'var(--text-muted)',
                        fontWeight: isCurrentWeek ? 700 : 500,
                        display: 'block',
                      }}
                    >
                      {dayNum}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            {isRecruiter
              ? 'Weekly candidate applications received across open positions'
              : 'Weekly applications received for your assigned candidate positions'}
          </div>
        </div>
      </div>

      {/* 3. Bottom Grid: Openings Overview + Actionable Attention Alerts */}
      <div className="dashboard-two-col">
        {/* Applications by Job Opening */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Briefcase size={18} color="#0066ff" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isRecruiter ? 'Active Job Openings' : 'Your Assigned Job Roles'}
              </h2>
            </div>
            {isRecruiter ? (
              <NavLink
                to="/openings"
                style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
              >
                Manage Openings
              </NavLink>
            ) : (
              <NavLink
                to="/candidates"
                style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
              >
                View Candidates
              </NavLink>
            )}
          </div>

          {data?.byOpening.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {isRecruiter ? 'No open job positions available.' : 'No candidates currently assigned to your panel.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {data?.byOpening.slice(0, 5).map((op) => (
                <NavLink
                  key={op.jobOpeningId}
                  to={`/candidates?opening=${op.jobOpeningId}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 0.95rem',
                    backgroundColor: '#f8fafc',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'all var(--transition-fast)',
                  }}
                  className="hover-bg"
                  title={`View candidates for ${op.title}`}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {op.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.1rem 0.45rem',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: '#e2e8f0',
                          color: '#334155',
                          fontWeight: 600,
                        }}
                      >
                        {op.department}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {op.totalApplications} total applicant{op.totalApplications === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.6rem',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: '#eff6ff',
                        color: '#0066ff',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      {op.activeApplications} in progress
                    </span>
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </div>
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Actionable Attention Alerts */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Clock size={18} color="#dc2626" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isRecruiter ? 'Candidates Requiring Attention' : 'Your Panel Attention Items'}
              </h2>
            </div>
            {isRecruiter && (
              <NavLink
                to="/alerts"
                style={{ fontSize: '0.8rem', color: '#dc2626', textDecoration: 'none', fontWeight: 700 }}
              >
                Review All Alerts ({data?.stalledSummary.totalStalled ?? 0})
              </NavLink>
            )}
          </div>

          {stalledAlerts.length === 0 ? (
            <div
              style={{
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <CheckCircle2 size={32} color="#059669" />
              <div style={{ fontWeight: 700, color: '#047857', fontSize: '0.95rem' }}>
                {isRecruiter ? 'All Candidates on Schedule' : 'All Assigned Candidates on Schedule'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#065f46', maxWidth: '320px' }}>
                {isRecruiter
                  ? 'Zero applications have exceeded the 10-day inactivity threshold in their current stage.'
                  : 'Zero candidates on your panel have exceeded the 10-day inactivity threshold.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {isRecruiter
                  ? 'Applications waiting over 10 days without stage movement:'
                  : 'Your assigned candidates waiting over 10 days without stage movement:'}
              </div>

              {/* Direct candidate items instead of repetitive aggregate numbers */}
              {stalledAlerts.slice(0, 3).map((alert) => (
                <NavLink
                  key={alert.applicationId}
                  to={isRecruiter ? "/alerts" : "/candidates"}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 0.9rem',
                    backgroundColor: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: 'var(--radius-sm)',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'all var(--transition-fast)',
                  }}
                  className="hover-bg"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: '#ffedd5',
                        border: '1px solid #fdba74',
                        color: '#c2410c',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {getCandidateInitials(alert.candidateName)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {alert.candidateName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {alert.jobTitle}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: '#fee2e2',
                        color: '#b91c1c',
                        border: '1px solid #fca5a5',
                      }}
                    >
                      {alert.daysInStage}d at {alert.currentStage}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#c2410c', fontWeight: 600 }}>
                      Needs review
                    </span>
                  </div>
                </NavLink>
              ))}

              <NavLink
                to="/alerts"
                className="btn btn-secondary"
                style={{
                  marginTop: '0.25rem',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.85rem',
                  justifyContent: 'space-between',
                }}
              >
                <span>Manage Inactivity Alerts</span>
                <ChevronRight size={15} />
              </NavLink>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
