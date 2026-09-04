import React, { useEffect, useState } from 'react';
import {
  X,
  Mail,
  Calendar,
  Briefcase,
  MapPin,
  FileText,
  Download,
  ExternalLink,
  Check,
  CheckCircle,
  XCircle,
  RotateCcw,
  UserPlus,
  Trash2,
  Send,
  MessageSquare,
  Clock,
  UserCheck,
  UserMinus,
  Tag,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { api } from '../../services/api.js';
import {
  Application,
  UserPublic,
  TimelineEvent,
  Stage,
  Role,
  PROGRESSION_STAGES,
  EventType,
} from '../../types/index.js';

interface ApplicationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string | null;
  currentUser?: UserPublic | null;
  onApplicationUpdated?: () => void;
}

const PIPELINE_STAGES = [
  { stage: Stage.APPLIED, label: 'APPLIED' },
  { stage: Stage.SCREENING, label: 'SCREEN' },
  { stage: Stage.INTERVIEW, label: 'INTERVIEW' },
  { stage: Stage.OFFER, label: 'OFFER' },
  { stage: Stage.HIRED, label: 'HIRED' },
];

function getInitials(name: string): string {
  if (!name) return 'C';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays === 1) return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const ApplicationDetailModal: React.FC<ApplicationDetailModalProps> = ({
  isOpen,
  onClose,
  applicationId,
  currentUser,
  onApplicationUpdated,
}) => {
  const [application, setApplication] = useState<Application | null>(null);
  const [interviewers, setInterviewers] = useState<UserPublic[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [availableInterviewers, setAvailableInterviewers] = useState<UserPublic[]>([]);
  const [selectedInterviewerId, setSelectedInterviewerId] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'overview' | 'panel' | 'feedback' | 'history'>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [stageNote, setStageNote] = useState('');
  const [showStageNoteInput, setShowStageNoteInput] = useState(false);
  const [pendingNextStage, setPendingNextStage] = useState<Stage | null>(null);

  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReinstateConfirm, setShowReinstateConfirm] = useState(false);
  const [reinstateNote, setReinstateNote] = useState('');

  const isRecruiter = currentUser?.role === Role.RECRUITER;

  const fetchApplicationDetails = async () => {
    if (!applicationId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await api.get<{
        application: Application;
        interviewers: UserPublic[];
        timeline: TimelineEvent[];
      }>(`/api/applications/${applicationId}`);

      if (res.success) {
        setApplication(res.data.application);
        setInterviewers(res.data.interviewers || []);
        setTimeline(res.data.timeline || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load candidate details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableInterviewers = async () => {
    if (!isRecruiter) return;
    try {
      const res = await api.get<UserPublic[]>('/api/auth/interviewers', { silent: true });
      if (res.success) {
        setAvailableInterviewers(res.data);
      }
    } catch {

    }
  };

  useEffect(() => {
    if (isOpen && applicationId) {
      fetchApplicationDetails();
      if (isRecruiter) {
        fetchAvailableInterviewers();
      }
    } else {
      setApplication(null);
      setInterviewers([]);
      setTimeline([]);
      setFeedbackText('');
      setStageNote('');
      setShowStageNoteInput(false);
      setPendingNextStage(null);
      setShowRejectConfirm(false);
      setShowReinstateConfirm(false);
      setRejectReason('');
      setReinstateNote('');
      setActiveTab('overview');
    }
  }, [isOpen, applicationId, isRecruiter]);

  if (!isOpen) return null;

  const currentStage = application?.current_stage;
  const currentProgIndex = currentStage ? PROGRESSION_STAGES.indexOf(currentStage) : -1;
  const nextStage = currentProgIndex >= 0 && currentProgIndex < PROGRESSION_STAGES.length - 1
    ? PROGRESSION_STAGES[currentProgIndex + 1]
    : null;

  const assignedIds = new Set(interviewers.map((i) => i.id));
  const unassignedOptions = availableInterviewers.filter((i) => !assignedIds.has(i.id));

  const feedbackEvents = timeline.filter((e) => e.event_type === EventType.INTERVIEWER_FEEDBACK);

  const handleAssignInterviewer = async () => {
    if (!applicationId || !selectedInterviewerId) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/api/applications/${applicationId}/interviewers`, {
        userId: selectedInterviewerId,
      });
      if (res.success) {
        (window as any).showToast?.('Interviewer added to panel', 'success');
        setSelectedInterviewerId('');
        fetchApplicationDetails();
        onApplicationUpdated?.();
      }
    } catch (err: any) {
      (window as any).showToast?.(err.message || 'Failed to assign interviewer', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveInterviewer = async (userId: string, userName: string) => {
    if (!applicationId) return;
    setActionLoading(true);
    try {
      const res = await api.delete(`/api/applications/${applicationId}/interviewers/${userId}`);
      if (res.success) {
        (window as any).showToast?.(`Removed ${userName} from interview panel`, 'success');
        fetchApplicationDetails();
        onApplicationUpdated?.();
      }
    } catch (err: any) {
      (window as any).showToast?.(err.message || 'Failed to remove interviewer', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvanceStage = async (target: Stage) => {
    if (!applicationId) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/api/applications/${applicationId}/stage`, {
        targetStage: target,
        note: stageNote.trim() || undefined,
      });
      if (res.success) {
        (window as any).showToast?.(`Candidate moved to ${target}`, 'success');
        setStageNote('');
        setShowStageNoteInput(false);
        setPendingNextStage(null);
        fetchApplicationDetails();
        onApplicationUpdated?.();
        window.dispatchEvent(new CustomEvent('hireflow:alerts-updated'));
      }
    } catch (err: any) {
      (window as any).showToast?.(err.message || 'Failed to advance stage', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!applicationId) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/api/applications/${applicationId}/reject`, {
        note: rejectReason.trim() || undefined,
      });
      if (res.success) {
        (window as any).showToast?.('Candidate marked as rejected', 'success');
        setShowRejectConfirm(false);
        setRejectReason('');
        fetchApplicationDetails();
        onApplicationUpdated?.();
        window.dispatchEvent(new CustomEvent('hireflow:alerts-updated'));
      }
    } catch (err: any) {
      (window as any).showToast?.(err.message || 'Failed to reject candidate', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReinstate = async () => {
    if (!applicationId) return;
    setActionLoading(true);
    try {
      const res = await api.post<{ current_stage: Stage }>(`/api/applications/${applicationId}/reinstate`, {
        note: reinstateNote.trim() || 'Candidate reinstated by recruiter',
      });
      if (res.success) {
        (window as any).showToast?.(`Candidate reinstated to ${res.data.current_stage}`, 'success');
        setShowReinstateConfirm(false);
        setReinstateNote('');
        fetchApplicationDetails();
        onApplicationUpdated?.();
        window.dispatchEvent(new CustomEvent('hireflow:alerts-updated'));
      }
    } catch (err: any) {
      (window as any).showToast?.(err.message || 'Failed to reinstate candidate', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() || !applicationId) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/api/applications/${applicationId}/feedback`, {
        feedback: feedbackText.trim(),
      });
      if (res.success) {
        (window as any).showToast?.('Interviewer feedback submitted', 'success');
        setFeedbackText('');
        fetchApplicationDetails();
        onApplicationUpdated?.();
      }
    } catch (err: any) {
      (window as any).showToast?.(err.message || 'Failed to submit feedback', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '1.5rem',
      }}
    >
      <div
        className="card modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '960px',
          maxHeight: '94vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          borderRadius: '16px',
          padding: '2rem 2.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                border: '1.5px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.6rem',
                color: '#2563eb',
                fontFamily: 'var(--font-brand)',
                flexShrink: 0,
              }}
            >
              {application ? getInitials(application.candidate_name) : 'C'}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h2
                  style={{
                    fontSize: '1.85rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-heading)',
                    color: '#0f172a',
                    letterSpacing: '-0.025em',
                  }}
                >
                  {application?.candidate_name || 'Loading candidate...'}
                </h2>

                {application?.job_title && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '6px',
                    }}
                  >
                    {application.job_title}
                  </span>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  color: '#64748b',
                  fontSize: '0.875rem',
                  marginTop: '0.35rem',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MapPin size={15} color="#94a3b8" />
                  <span>San Francisco, CA (Remote ok)</span>
                </span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Mail size={15} color="#94a3b8" />
                  <span>{application?.candidate_email}</span>
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {isRecruiter && application && (
              <>
                {application.current_stage !== Stage.REJECTED && !showRejectConfirm && !showStageNoteInput && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowRejectConfirm(true);
                      setShowStageNoteInput(false);
                    }}
                    disabled={actionLoading}
                    style={{
                      padding: '0.55rem 1.15rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#dc2626',
                      backgroundColor: '#ffffff',
                      borderColor: '#fca5a5',
                    }}
                    title="Reject this candidate from the hiring pipeline"
                  >
                    Reject Candidate
                  </button>
                )}
                {application.current_stage !== Stage.REJECTED && nextStage && !showStageNoteInput && !showRejectConfirm && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setPendingNextStage(nextStage);
                      setShowStageNoteInput(true);
                    }}
                    disabled={actionLoading}
                    style={{
                      padding: '0.55rem 1.35rem',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      backgroundColor: '#0066ff',
                      color: '#ffffff',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0, 102, 255, 0.25)',
                      gap: '0.5rem',
                    }}
                    title={`Advance candidate directly to ${nextStage}`}
                  >
                    <span>Advance to {nextStage}</span>
                    <ArrowRight size={16} />
                  </button>
                )}
                {application.current_stage === Stage.REJECTED && !showReinstateConfirm && (
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowReinstateConfirm(true)}
                    disabled={actionLoading}
                    style={{
                      padding: '0.55rem 1.35rem',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      backgroundColor: '#059669',
                      gap: '0.5rem',
                    }}
                    title={`Restore candidate to ${application.rejected_from_stage || 'previous stage'}`}
                  >
                    <RotateCcw size={16} />
                    <span>Reinstate to {application.rejected_from_stage || 'Pipeline'}</span>
                  </button>
                )}
              </>
            )}

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
              }}
              title="Close modal"
            >
              <X size={22} />
            </button>
          </div>
        </div>
        {showStageNoteInput && pendingNextStage && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              padding: '1rem 1.25rem',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              animation: 'fadeIn 150ms ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1d4ed8', fontWeight: 700, fontSize: '0.9rem' }}>
              <ArrowRight size={17} />
              <span>Advance Candidate to <strong>{pendingNextStage}</strong> Stage</span>
            </div>
            <input
              type="text"
              placeholder={`Optional note or transition assessment for moving to ${pendingNextStage}...`}
              value={stageNote}
              onChange={(e) => setStageNote(e.target.value)}
              disabled={actionLoading}
              style={{
                width: '100%',
                padding: '0.5rem 0.85rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowStageNoteInput(false);
                  setPendingNextStage(null);
                }}
                disabled={actionLoading}
                style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleAdvanceStage(pendingNextStage)}
                disabled={actionLoading}
                style={{ padding: '0.45rem 1.15rem', fontSize: '0.85rem', backgroundColor: '#0066ff' }}
              >
                {actionLoading && <Loader2 size={14} className="animate-spin" />}
                <span>Confirm Advance to {pendingNextStage}</span>
              </button>
            </div>
          </div>
        )}
        {showRejectConfirm && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              padding: '1rem 1.25rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              animation: 'fadeIn 150ms ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b91c1c', fontWeight: 700, fontSize: '0.9rem' }}>
              <AlertTriangle size={18} />
              <span>Confirm Candidate Rejection</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#7f1d1d' }}>
              Are you sure you want to reject <strong>{application?.candidate_name}</strong> from the active pipeline? Progression will be stopped at <strong>{application?.current_stage}</strong> stage. You can reinstate this candidate later.
            </div>
            <input
              type="text"
              placeholder="Provide an optional rejection reason or feedback notes..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              disabled={actionLoading}
              style={{
                width: '100%',
                padding: '0.5rem 0.85rem',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowRejectConfirm(false);
                  setRejectReason('');
                }}
                disabled={actionLoading}
                style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleReject}
                disabled={actionLoading}
                style={{ padding: '0.45rem 1.15rem', fontSize: '0.85rem' }}
              >
                {actionLoading && <Loader2 size={14} className="animate-spin" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        )}
        {showReinstateConfirm && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              padding: '1rem 1.25rem',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '10px',
              animation: 'fadeIn 150ms ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#047857', fontWeight: 700, fontSize: '0.9rem' }}>
              <RotateCcw size={17} />
              <span>Reinstate Candidate to Active Pipeline</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#065f46' }}>
              This will restore <strong>{application?.candidate_name}</strong> to their previous stage: <strong>{application?.rejected_from_stage || 'APPLIED'}</strong>.
            </div>
            <input
              type="text"
              placeholder="Optional reinstatement note..."
              value={reinstateNote}
              onChange={(e) => setReinstateNote(e.target.value)}
              disabled={actionLoading}
              style={{
                width: '100%',
                padding: '0.5rem 0.85rem',
                border: '1px solid #6ee7b7',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowReinstateConfirm(false);
                  setReinstateNote('');
                }}
                disabled={actionLoading}
                style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleReinstate}
                disabled={actionLoading}
                style={{ padding: '0.45rem 1.15rem', fontSize: '0.85rem', backgroundColor: '#059669' }}
              >
                {actionLoading && <Loader2 size={14} className="animate-spin" />}
                <span>Confirm Reinstatement</span>
              </button>
            </div>
          </div>
        )}
        {application && application.current_stage !== Stage.REJECTED && (
          <div
            className="stepper-scroll-container"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '1.25rem 1.5rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div className="stepper-track-min" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  position: 'absolute',
                  top: '13px',
                  left: '20px',
                  right: '20px',
                  height: '2px',
                  backgroundColor: '#e2e8f0',
                  zIndex: 1,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '13px',
                  left: '20px',
                  width: `${Math.min(100, Math.max(0, (currentProgIndex / (PIPELINE_STAGES.length - 1)) * 100))}%`,
                  height: '2px',
                  backgroundColor: '#0066ff',
                  zIndex: 2,
                  transition: 'width 300ms ease',
                }}
              />

              {PIPELINE_STAGES.map((item, idx) => {
                const isPassed = idx < currentProgIndex;
                const isCurrent = idx === currentProgIndex;

                return (
                  <div
                    key={item.stage}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      zIndex: 3,
                    }}
                  >
                    {isPassed ? (
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: '#0066ff',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={14} strokeWidth={3} />
                      </div>
                    ) : isCurrent ? (
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: '#ffffff',
                          border: '2px solid #0066ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <div
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: '#0066ff',
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: '#ffffff',
                          border: '2px solid #cbd5e1',
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontSize: '0.725rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        color: isCurrent || isPassed ? '#0066ff' : '#94a3b8',
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '2rem' }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.65rem 0',
              fontSize: '0.9rem',
              fontWeight: activeTab === 'overview' ? 700 : 500,
              color: activeTab === 'overview' ? '#0066ff' : '#64748b',
              borderBottom: activeTab === 'overview' ? '2px solid #0066ff' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            Overview
          </button>

          <button
            onClick={() => setActiveTab('panel')}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.65rem 0',
              fontSize: '0.9rem',
              fontWeight: activeTab === 'panel' ? 700 : 500,
              color: activeTab === 'panel' ? '#0066ff' : '#64748b',
              borderBottom: activeTab === 'panel' ? '2px solid #0066ff' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            Interview Panel ({interviewers.length})
          </button>

          <button
            onClick={() => setActiveTab('feedback')}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.65rem 0',
              fontSize: '0.9rem',
              fontWeight: activeTab === 'feedback' ? 700 : 500,
              color: activeTab === 'feedback' ? '#0066ff' : '#64748b',
              borderBottom: activeTab === 'feedback' ? '2px solid #0066ff' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            Feedback ({feedbackEvents.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.65rem 0',
              fontSize: '0.9rem',
              fontWeight: activeTab === 'history' ? 700 : 500,
              color: activeTab === 'history' ? '#0066ff' : '#64748b',
              borderBottom: activeTab === 'history' ? '2px solid #0066ff' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            History ({timeline.length})
          </button>
        </div>
        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
            Loading candidate details & timeline...
          </div>
        ) : error ? (
          <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px' }}>
            {error}
          </div>
        ) : application ? (
          <>
            {activeTab === 'overview' && (
              <div className="modal-two-col">
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingBottom: '1rem',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <FileText size={20} color="#0066ff" />
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                        {application.candidate_name.replace(/\s+/g, '_')}_Resume.pdf
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#64748b' }}>
                      <button
                        title="Download Resume"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex' }}
                      >
                        <Download size={18} />
                      </button>
                      <button
                        title="Open Document"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex' }}
                      >
                        <ExternalLink size={18} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>
                      Experience
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>
                          Senior Engineer at TechFlow
                        </span>
                        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>2020 – Present</span>
                      </div>
                      <ul style={{ paddingLeft: '1.2rem', color: '#475569', fontSize: '0.85rem', lineHeight: '1.6' }}>
                        <li>Led migration of core frontend systems to modern component architecture.</li>
                        <li>Improved core web vitals and client runtime latency by 40%.</li>
                        <li>Mentored junior developers and participated in architectural review.</li>
                      </ul>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>
                      Skills
                    </h4>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                      {['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Tailwind CSS', 'GraphQL', 'Next.js'].map((sk) => (
                        <span
                          key={sk}
                          style={{
                            fontSize: '0.78rem',
                            padding: '0.3rem 0.75rem',
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            borderRadius: 'var(--radius-full)',
                            fontWeight: 500,
                          }}
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                  {application.notes && (
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                        Recruiter Notes
                      </h4>
                      <div style={{ fontSize: '0.875rem', color: '#334155', whiteSpace: 'pre-wrap' }}>
                        {application.notes}
                      </div>
                    </div>
                  )}
                </div>
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                    Activity History
                  </h3>

                  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: '5px',
                        top: '8px',
                        bottom: '8px',
                        width: '2px',
                        backgroundColor: '#e2e8f0',
                        zIndex: 1,
                      }}
                    />

                    {timeline.length === 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem', paddingLeft: '1.5rem' }}>
                        No events recorded yet.
                      </div>
                    ) : (
                      timeline.map((evt) => (
                        <div
                          key={evt.id}
                          style={{
                            position: 'relative',
                            paddingLeft: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            zIndex: 2,
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              left: '0px',
                              top: '5px',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: '#475569',
                              border: '2px solid #ffffff',
                              boxShadow: '0 0 0 1px #cbd5e1',
                            }}
                          />

                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                            {formatRelativeTime(evt.created_at)}
                          </div>

                          <div style={{ fontSize: '0.875rem', color: '#0f172a', fontWeight: 600 }}>
                            {evt.event_type === EventType.APPLICATION_CREATED && 'Application received via ' + (application.source || 'Portal')}
                            {evt.event_type === EventType.STAGE_CHANGE && `Advanced to ${evt.new_stage} stage.`}
                            {evt.event_type === EventType.REJECTION && 'Candidate marked as rejected.'}
                            {evt.event_type === EventType.REINSTATEMENT && `Candidate reinstated to ${evt.new_stage}.`}
                            {evt.event_type === EventType.INTERVIEWER_ASSIGNED && `${evt.actor_name || 'Recruiter'} assigned an interviewer.`}
                            {evt.event_type === EventType.INTERVIEWER_REMOVED && 'Interviewer removed from panel.'}
                            {evt.event_type === EventType.INTERVIEWER_FEEDBACK && `${evt.actor_name || 'Interviewer'} submitted feedback.`}
                          </div>
                          {evt.event_type === EventType.INTERVIEWER_FEEDBACK && evt.note_content && (
                            <div
                              style={{
                                marginTop: '0.35rem',
                                padding: '0.65rem 0.85rem',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                color: '#334155',
                                fontStyle: 'italic',
                                lineHeight: '1.5',
                              }}
                            >
                              "{evt.note_content}"
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'panel' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                    Assigned Interview Panel ({interviewers.length})
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
                  {interviewers.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                      No interviewers assigned to this panel yet.
                    </div>
                  ) : (
                    interviewers.map((intv) => (
                      <div
                        key={intv.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.85rem 1rem',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              backgroundColor: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              color: '#2563eb',
                              fontSize: '0.85rem',
                            }}
                          >
                            {getInitials(intv.name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>{intv.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{intv.email}</div>
                          </div>
                        </div>

                        {isRecruiter && (
                          <button
                            title="Remove from panel"
                            onClick={() => handleRemoveInterviewer(intv.id, intv.name)}
                            disabled={actionLoading}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '0.35rem',
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {isRecruiter && (
                  <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '480px', marginTop: '0.5rem' }}>
                    <select
                      value={selectedInterviewerId}
                      onChange={(e) => setSelectedInterviewerId(e.target.value)}
                      disabled={actionLoading || unassignedOptions.length === 0}
                      style={{
                        flex: 1,
                        padding: '0.5rem 0.85rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                      }}
                    >
                      <option value="">
                        {unassignedOptions.length === 0 ? 'All interviewers assigned' : 'Select interviewer to add to panel...'}
                      </option>
                      {unassignedOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name} ({opt.email})
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-secondary"
                      onClick={handleAssignInterviewer}
                      disabled={!selectedInterviewerId || actionLoading}
                      style={{ padding: '0.5rem 0.95rem', fontSize: '0.85rem' }}
                    >
                      <UserPlus size={16} />
                      <span>Add</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'feedback' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                    Submit Candidate Feedback
                  </h4>
                  <form onSubmit={handleSubmitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <textarea
                      rows={3}
                      placeholder="Write evaluation, technical assessment, communication notes, or hiring recommendation..."
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      disabled={actionLoading}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        resize: 'vertical',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={!feedbackText.trim() || actionLoading}
                        style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                      >
                        <Send size={15} />
                        <span>Submit Feedback</span>
                      </button>
                    </div>
                  </form>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                    Recorded Evaluations ({feedbackEvents.length})
                  </h4>
                  {feedbackEvents.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                      No feedback submitted for this candidate yet.
                    </div>
                  ) : (
                    feedbackEvents.map((evt) => (
                      <div
                        key={evt.id}
                        style={{
                          padding: '1rem',
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}>
                          <span>
                            Evaluation by <strong style={{ color: '#0f172a' }}>{evt.actor_name}</strong>
                          </span>
                          <span>{new Date(evt.created_at).toLocaleDateString()}</span>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#334155', fontStyle: 'italic' }}>
                          "{evt.note_content}"
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            {activeTab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Complete immutable timeline of all stage transitions, interviewer assignments, feedback, and notes.
                </div>
                {timeline.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    No timeline events recorded yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {timeline.map((evt) => {
                      const isStageChange = evt.event_type === EventType.STAGE_CHANGE;
                      const isFeedback = evt.event_type === EventType.INTERVIEWER_FEEDBACK;
                      const isPanel = evt.event_type === EventType.INTERVIEWER_ASSIGNED || evt.event_type === EventType.INTERVIEWER_REMOVED;
                      const isRejection = evt.event_type === EventType.REJECTION || evt.new_stage === Stage.REJECTED;
                      const isReinstated = evt.event_type === EventType.REINSTATEMENT || evt.old_stage === Stage.REJECTED;

                      return (
                        <div
                          key={evt.id}
                          style={{
                            padding: '1rem 1.25rem',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.45rem',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span
                                style={{
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: 'var(--radius-full)',
                                  fontSize: '0.725rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                  backgroundColor: isRejection ? '#fef2f2' : isReinstated ? '#ecfdf5' : isStageChange ? '#eff6ff' : isFeedback ? '#f5f3ff' : '#f0f9ff',
                                  color: isRejection ? '#dc2626' : isReinstated ? '#059669' : isStageChange ? '#2563eb' : isFeedback ? '#7c3aed' : '#0284c7',
                                  border: `1px solid ${isRejection ? '#fecaca' : isReinstated ? '#a7f3d0' : isStageChange ? '#bfdbfe' : isFeedback ? '#ddd6fe' : '#bae6fd'}`,
                                }}
                              >
                                {isRejection ? 'REJECTED' : isReinstated ? 'REINSTATED' : isStageChange ? 'STAGE ADVANCE' : isFeedback ? 'EVALUATION' : isPanel ? 'PANEL UPDATE' : evt.event_type.replace(/_/g, ' ')}
                              </span>
                              {isStageChange && evt.old_stage && evt.new_stage && (
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                                  {evt.old_stage} → {evt.new_stage}
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.75rem', color: '#64748b' }}>
                              {evt.actor_name && (
                                <span>by <strong>{evt.actor_name}</strong></span>
                              )}
                              <span>•</span>
                              <span>{formatRelativeTime(evt.created_at)}</span>
                            </div>
                          </div>

                          {evt.note_content && (
                            <div
                              style={{
                                fontSize: '0.85rem',
                                color: '#334155',
                                backgroundColor: '#f8fafc',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '6px',
                                borderLeft: '3px solid #cbd5e1',
                                marginTop: '0.2rem',
                                fontStyle: isFeedback ? 'italic' : 'normal',
                              }}
                            >
                              {evt.note_content}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};
