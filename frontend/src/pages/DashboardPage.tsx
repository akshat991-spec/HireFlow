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
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api.js';
import { DashboardData, HealthCheckData, Stage } from '../types/index.js';

const STAGE_THEME: Record<Stage, { bg: string; text: string; bar: string }> = {
  [Stage.APPLIED]: { bg: '#eff6ff', text: '#2563eb', bar: '#3b82f6' },
  [Stage.SCREENING]: { bg: '#f5f3ff', text: '#6366f1', bar: '#6366f1' },
  [Stage.INTERVIEW]: { bg: '#f0f9ff', text: '#0284c7', bar: '#0284c7' },
  [Stage.OFFER]: { bg: '#fffbeb', text: '#b45309', bar: '#f59e0b' },
  [Stage.HIRED]: { bg: '#ecfdf5', text: '#047857', bar: '#10b981' },
  [Stage.REJECTED]: { bg: '#fef2f2', text: '#b91c1c', bar: '#ef4444' },
};

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [health, setHealth] = useState<HealthCheckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchDashboardMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, healthRes] = await Promise.all([
        api.get<DashboardData>('/api/dashboard/metrics'),
        api.get<HealthCheckData>('/api/health', { silent: true }),
      ]);

      if (dashRes.success) {
        setData(dashRes.data);
        setLastRefreshed(new Date());
      }
      if (healthRes.success) {
        setHealth(healthRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardMetrics();
  }, []);

  const headline = data?.headline;
  const maxWeeklyCount = data?.weeklyTrend
    ? Math.max(...data.weeklyTrend.map((w) => w.count), 1)
    : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Recruitment Dashboard</h1>
          <div className="page-subtitle-tracked">
            REAL-TIME PIPELINE ANALYTICS & TALENT FUNNEL
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            className="btn btn-secondary"
            onClick={fetchDashboardMetrics}
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
            onClick={fetchDashboardMetrics}
            className="btn btn-secondary"
            style={{ marginLeft: 'auto', padding: '0.25rem 0.75rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. Headline KPI Cards */}
      <div className="kpi-grid">
        {/* Open Positions */}
        <NavLink
          to="/openings"
          style={{ textDecoration: 'none', color: 'inherit' }}
          className="card"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Open Positions
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
            <span>Manage active openings</span>
            <ArrowUpRight size={13} />
          </div>
        </NavLink>

        {/* Active Candidates */}
        <NavLink
          to="/candidates"
          style={{ textDecoration: 'none', color: 'inherit' }}
          className="card"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Candidates
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
            <span>View candidate pipeline</span>
            <ArrowUpRight size={13} />
          </div>
        </NavLink>

        {/* Interviews This Week */}
        <NavLink
          to="/candidates?stage=INTERVIEW"
          style={{ textDecoration: 'none', color: 'inherit' }}
          className="card"
          title="Click to view candidates in the Interview stage"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Interviews This Week
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
            <span>View interview candidates</span>
            <ArrowUpRight size={13} />
          </div>
        </NavLink>

        {/* Hires This Month */}
        <NavLink
          to="/candidates?stage=HIRED"
          style={{ textDecoration: 'none', color: 'inherit' }}
          className="card"
          title="Click to view candidates hired this month"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Hires This Month
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
            <span>View hired candidates</span>
            <ArrowUpRight size={13} />
          </div>
        </NavLink>
      </div>

      {/* 2. Middle Grid: Pipeline Funnel + 12-Week Quarterly Trend */}
      <div className="dashboard-two-col">
        {/* Pipeline Stage Distribution Funnel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Layers size={18} color="#0066ff" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Candidate Pipeline by Stage
              </h2>
            </div>
            <NavLink
              to="/candidates"
              style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
            >
              View all
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
                Application Volume (Last Quarter)
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
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              height: '160px',
              paddingTop: '1rem',
              paddingBottom: '0.5rem',
              gap: '6px',
            }}
          >
            {data?.weeklyTrend.map((week, idx) => {
              const barHeightPct = Math.max(10, Math.round((week.count / maxWeeklyCount) * 100));

              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.4rem',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                  title={`${week.weekLabel}: ${week.count} applications`}
                >
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: week.count > 0 ? '#0f172a' : '#cbd5e1' }}>
                    {week.count}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '28px',
                      height: `${barHeightPct}%`,
                      backgroundColor: week.count > 0 ? '#0066ff' : '#e2e8f0',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 250ms ease',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '32px',
                    }}
                  >
                    {week.weekLabel.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Weekly candidate applications received across open positions
          </div>
        </div>
      </div>

      {/* 3. Bottom Grid: Top Openings + Stalled Pipeline Summary */}
      <div className="dashboard-two-col">
        {/* Applications by Job Opening */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Applications by Job Opening
            </h2>
            <NavLink
              to="/openings"
              style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
            >
              View All Openings
            </NavLink>
          </div>

          {data?.byOpening.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No open job positions available.
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
                    padding: '0.65rem 0.85rem',
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
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      {op.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {op.department}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {op.totalApplications} total
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#0066ff' }}>
                        {op.activeApplications} active
                      </div>
                    </div>
                  </div>
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Stalled Applications Health Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <AlertTriangle size={18} color="#dc2626" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Stalled Pipeline Health
              </h2>
            </div>
            <NavLink
              to="/alerts"
              style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
            >
              Review Alerts
            </NavLink>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div
              style={{
                padding: '0.85rem',
                backgroundColor: (data?.stalledSummary.totalStalled ?? 0) > 0 ? '#fef2f2' : '#ecfdf5',
                border: `1px solid ${(data?.stalledSummary.totalStalled ?? 0) > 0 ? '#fecaca' : '#a7f3d0'}`,
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Un-dismissed Stalled
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: (data?.stalledSummary.totalStalled ?? 0) > 0 ? '#dc2626' : '#059669' }}>
                {data?.stalledSummary.totalStalled ?? 0}
              </div>
            </div>

            <div
              style={{
                padding: '0.85rem',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Longest Stalled Time
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706' }}>
                {(data?.stalledSummary.longestDays ?? 0) > 0 ? `${data?.stalledSummary.longestDays}d` : '0d'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Stalled Stage Breakdown:
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {Object.keys(data?.stalledSummary.byStage || {}).length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle2 size={14} />
                  <span>No active bottlenecks detected (&gt; 10 days)</span>
                </div>
              ) : (
                Object.entries(data?.stalledSummary.byStage || {}).map(([stage, count]) => (
                  <span
                    key={stage}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      fontWeight: 700,
                    }}
                  >
                    {stage}: {count}
                  </span>
                ))
              )}
            </div>
          </div>

          <NavLink
            to="/alerts"
            className="btn btn-secondary"
            style={{ marginTop: 'auto', padding: '0.45rem 0.85rem', fontSize: '0.85rem', justifyContent: 'space-between' }}
          >
            <span>Open Stalled Alerts Manager</span>
            <ChevronRight size={15} />
          </NavLink>
        </div>
      </div>

      {/* Footer System Status Banner */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.85rem 1.25rem',
          backgroundColor: '#ffffff',
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
          <span>
            API Service: <strong style={{ color: 'var(--text-primary)' }}>Operational</strong> ({health?.environment}) • PostgreSQL Database: <strong style={{ color: 'var(--text-primary)' }}>{health?.database}</strong>
          </span>
        </div>
        <div>
          Server Uptime: <strong style={{ color: 'var(--text-primary)' }}>{Math.floor(health?.uptime || 0)}s</strong>
        </div>
      </div>
    </div>
  );
};
