import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  Eye,
  Briefcase,
  Users,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Calendar,
  AlertCircle,
  BellOff,
  Loader2,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { StalledAlert, Stage, Role, Application } from '../types/index.js';
import { ApplicationDetailModal } from '../components/Applications/ApplicationDetailModal.js';
import { StageProgressionBar } from '../components/Applications/StageProgressionBar.js';

function getCandidateInitials(name: string): string {
  if (!name) return 'C';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const AlertsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [alerts, setAlerts] = useState<StalledAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissSuccess, setDismissSuccess] = useState<string | null>(null);

  // Application Detail Modal state
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const isRecruiter = currentUser?.role === Role.RECRUITER;
  const isInterviewer = currentUser?.role === Role.INTERVIEWER;

  const fetchAlerts = async () => {
    if (!isRecruiter) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ count: number; thresholdDays: number; alerts: StalledAlert[] }>(
        '/api/alerts/stalled'
      );
      if (res.success) {
        setAlerts(res.data.alerts);
        window.dispatchEvent(new CustomEvent('hireflow:alerts-updated'));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load stalled alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const handleGlobalUpdate = () => fetchAlerts();
    window.addEventListener('hireflow:alerts-updated', handleGlobalUpdate);
    return () => window.removeEventListener('hireflow:alerts-updated', handleGlobalUpdate);
  }, [currentUser]);

  const handleDismiss = async (alert: StalledAlert) => {
    setDismissingId(alert.applicationId);
    try {
      const res = await api.post<any>(`/api/alerts/stalled/${alert.applicationId}/dismiss`);
      if (res.success) {
        setAlerts((prev) => prev.filter((a) => a.applicationId !== alert.applicationId));
        setDismissSuccess(`Alert dismissed for ${alert.candidateName} in ${alert.currentStage}`);
        setTimeout(() => setDismissSuccess(null), 4000);
        // Refresh alert badge in navigation if global event listener is registered
        window.dispatchEvent(new CustomEvent('hireflow:alerts-updated'));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to dismiss alert');
    } finally {
      setDismissingId(null);
    }
  };

  const handleOpenDetail = (appId: string) => {
    setSelectedAppId(appId);
    setIsDetailModalOpen(true);
  };

  const maxDaysStalled = alerts.reduce((max, a) => Math.max(max, a.daysInStage), 0);
  const stageDistribution = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.currentStage] = (acc[a.currentStage] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Stalled Application Alerts</h1>
          <div className="page-subtitle-tracked">
            CANDIDATES SITTING IN THE SAME STAGE FOR MORE THAN 10 DAYS
          </div>
        </div>

        {isRecruiter && alerts.length > 0 && (
          <button
            className="btn btn-secondary"
            onClick={fetchAlerts}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
          >
            <RotateCcw size={14} />
            <span>Refresh Alerts</span>
          </button>
        )}
      </div>

      {/* Dismissal Success Banner */}
      {dismissSuccess && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#047857',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
          }}
        >
          <CheckCircle size={18} />
          <span>{dismissSuccess}</span>
        </div>
      )}

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
          <AlertCircle size={20} />
          <span>{error}</span>
          <button
            onClick={fetchAlerts}
            className="btn btn-secondary"
            style={{ marginLeft: 'auto', padding: '0.25rem 0.75rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Interviewer Restricted View Notice */}
      {isInterviewer && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            color: '#0369a1',
            fontSize: '0.9rem',
          }}
        >
          <ShieldCheck size={24} />
          <div>
            <strong>Recruiter-Only Feature:</strong> Stalled candidate pipeline alerts and dismissal workflows are managed by recruiters. Please review your assigned interviews under <strong>My Applications</strong>.
          </div>
        </div>
      )}

      {isRecruiter && (
        <>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: alerts.length > 0 ? '#fef2f2' : '#ecfdf5',
                  border: `1px solid ${alerts.length > 0 ? '#fecaca' : '#a7f3d0'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: alerts.length > 0 ? '#dc2626' : '#059669',
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Total Stalled Candidates
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {alerts.length}
                </div>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706',
                }}
              >
                <Clock size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Longest Stalled Time
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {maxDaysStalled > 0 ? `${maxDaysStalled} days` : '0 days'}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Stage Breakdown
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {Object.keys(stageDistribution).length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No stalled stages
                  </span>
                ) : (
                  Object.entries(stageDistribution).map(([stg, cnt]) => (
                    <span
                      key={stg}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        color: '#b45309',
                        fontWeight: 700,
                      }}
                    >
                      {stg}: {cnt}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Stalled Candidates Table */}
          {loading ? (
            <div className="card" style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Checking stalled candidate applications...
            </div>
          ) : alerts.length === 0 ? (
            /* Clean Empty State */
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#059669',
                }}
              >
                <Sparkles size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
                  No Stalled Candidates!
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '440px' }}>
                  All candidates across active job openings are progressing within the 10-day stage threshold or have been reviewed.
                </p>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#f8fafc',
                        borderBottom: '1px solid var(--border-color)',
                        color: 'var(--text-muted)',
                        fontSize: '0.725rem',
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        fontWeight: 700,
                      }}
                    >
                      <th style={{ padding: '1rem 1.5rem' }}>Candidate</th>
                      <th style={{ padding: '1rem 1.25rem' }}>Job Opening</th>
                      <th style={{ padding: '1rem 1.25rem' }}>Stage & Duration</th>
                      <th style={{ padding: '1rem 1.25rem', minWidth: '170px' }}>Stage Progression</th>
                      <th style={{ padding: '1rem 1.25rem' }}>Interview Panel</th>
                      <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert) => {
                      const initials = getCandidateInitials(alert.candidateName);
                      const panel = alert.interviewers || [];
                      const isDismissing = dismissingId === alert.applicationId;

                      return (
                        <tr
                          key={alert.id}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            transition: 'background 150ms ease',
                          }}
                          className="table-row-hover"
                        >
                          {/* Candidate */}
                          <td style={{ padding: '1rem 1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                              <div
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: 'var(--radius-sm)',
                                  backgroundColor: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  color: '#2563eb',
                                  flexShrink: 0,
                                }}
                              >
                                {initials}
                              </div>
                              <div>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    fontSize: '0.925rem',
                                    color: '#0f172a',
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => handleOpenDetail(alert.applicationId)}
                                >
                                  {alert.candidateName}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                  {alert.candidateEmail}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Job Opening */}
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#0f172a' }}>
                              {alert.jobTitle}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {alert.department}
                            </div>
                          </td>

                          {/* Stalled Duration Badge */}
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: 'var(--radius-full)',
                                  backgroundColor: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  color: '#dc2626',
                                  width: 'fit-content',
                                }}
                              >
                                <Clock size={12} />
                                <span>{alert.daysInStage} days in {alert.currentStage}</span>
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Entered: {new Date(alert.stageEnteredAt).toLocaleDateString()}
                              </span>
                            </div>
                          </td>

                          {/* Stage Progression Stepper */}
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <StageProgressionBar currentStage={alert.currentStage} />
                          </td>

                          {/* Interview Panel */}
                          <td style={{ padding: '1rem 1.25rem' }}>
                            {panel.length === 0 ? (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Unassigned
                              </span>
                            ) : (
                              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                {panel.map((intv) => (
                                  <span
                                    key={intv.id}
                                    style={{
                                      fontSize: '0.75rem',
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: 'var(--radius-sm)',
                                      backgroundColor: '#f0f9ff',
                                      color: '#0284c7',
                                      border: '1px solid #bae6fd',
                                    }}
                                  >
                                    {intv.name.split(' ')[0]}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Actions: View & Dismiss */}
                          <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                              <button
                                title="View Candidate Profile & History"
                                className="btn btn-secondary"
                                onClick={() => handleOpenDetail(alert.applicationId)}
                                style={{ padding: '0.35rem 0.65rem' }}
                              >
                                <Eye size={15} />
                              </button>

                              <button
                                title="Dismiss alert for this stage period"
                                className="btn btn-secondary"
                                onClick={() => handleDismiss(alert)}
                                disabled={isDismissing}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  fontSize: '0.8rem',
                                  gap: '0.35rem',
                                  color: '#b45309',
                                  borderColor: '#fde68a',
                                  backgroundColor: '#fffbeb',
                                }}
                              >
                                {isDismissing ? <Loader2 size={14} className="animate-spin" /> : <BellOff size={14} />}
                                <span>{isDismissing ? 'Dismissing...' : 'Dismiss'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Application Detail Modal */}
      <ApplicationDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        applicationId={selectedAppId}
        currentUser={currentUser}
        onApplicationUpdated={() => fetchAlerts()}
      />
    </div>
  );
};
