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
  Tag,
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

  // Actions state
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [stageNote, setStageNote] = useState('');
  const [showStageNoteInput, setShowStageNoteInput] = useState(false);
  const [pendingNextStage, setPendingNextStage] = useState<Stage | null>(null);

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
      // Non-critical
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
      setActiveTab('overview');
    }
  }, [isOpen, applicationId, isRecruiter]);

  if (!isOpen) return null;

  // Next stage calculation
  const currentStage = application?.current_stage;
  const currentProgIndex = currentStage ? PROGRESSION_STAGES.indexOf(currentStage) : -1;
  const nextStage = currentProgIndex >= 0 && currentProgIndex < PROGRESSION_STAGES.length - 1
    ? PROGRESSION_STAGES[currentProgIndex + 1]
    : null;

  // Interviewer assignments
  const assignedIds = new Set(interviewers.map((i) => i.id));
  const unassignedOptions = availableInterviewers.filter((i) => !assignedIds.has(i.id));

  // Feedback events count
  const feedbackEvents = timeline.filter((e) => e.event_type === EventType.INTERVIEWER_FEEDBACK);

  // Handle Assign Interviewer
  const handleAssignInterviewer = async () => {
    if (!selectedInterviewerId || !applicationId) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/api/applications/${applicationId}/interviewers`, {
        userId: selectedInterviewerId,
      });
      if (res.success) {
        (window as any).showToast?.('Interviewer assigned to panel', 'success');
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

  // Handle Remove Interviewer
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

  // Handle Stage Advancement
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
      }
    } catch (err: any) {
      (window as any).showToast?.(err.message || 'Failed to advance stage', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Rejection
  const handleReject = async () => {
    if (!applicationId) return;
    const note = prompt('Please provide a reason or note for rejecting this candidate:');
    if (note === null) return;

    setActionLoading(true);
    try {
      const res = await api.post(`/api/applications/${applicationId}/reject`, {
        note: note.trim() || undefined,
      });
      if (res.success) {
        (window as any).showToast?.('Candidate marked as rejected', 'success');
        fetchApplicationDetails();
        onApplicationUpdated?.();
      }
    } catch (err: any) {
      (window as any).showToast?.(err.message || 'Failed to reject candidate', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reinstatement
  const handleReinstate = async () => {
    if (!applicationId) return;
    setActionLoading(true);
    try {
      const res = await api.post<{ current_stage: Stage }>(`/api/applications/${applicationId}/reinstate`, {
        note: 'Candidate reinstated by recruiter',
      });
      if (res.success) {
        (window as any).showToast?.(`Candidate reinstated to ${res.data.current_stage}`, 'success');
        fetchApplicationDetails();
        onApplicationUpdated?.();
      }
    } catch (err: any) {
      (window as any).showToast?.(err.message || 'Failed to reinstate candidate', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Feedback Submission
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
        className="card"
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
        {/* 1. Top Candidate Profile Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Candidate Avatar */}
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

          {/* Action Buttons & Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isRecruiter && application && (
              <>
                {application.current_stage !== Stage.REJECTED && (
                  <button
                    className="btn btn-secondary"
                    onClick={handleReject}
                    disabled={actionLoading}
                    style={{
                      padding: '0.55rem 1.15rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#475569',
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                    }}
                  >
                    Reject
                  </button>
                )}

                {application.current_stage !== Stage.REJECTED && nextStage && (
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
                    }}
                  >
                    Advance to {nextStage}
                  </button>
                )}

                {application.current_stage === Stage.REJECTED && (
                  <button
                    className="btn btn-primary"
                    onClick={handleReinstate}
                    disabled={actionLoading}
                    style={{
                      padding: '0.55rem 1.35rem',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      backgroundColor: '#059669',
                    }}
                  >
                    <RotateCcw size={16} />
                    <span>Reinstate Candidate</span>
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

        {/* Note input prompt for advancement */}
        {showStageNoteInput && pendingNextStage && (
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              padding: '0.75rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          >
            <input
              type="text"
              placeholder={`Optional note for moving candidate to ${pendingNextStage}...`}
              value={stageNote}
              onChange={(e) => setStageNote(e.target.value)}
              style={{
                flex: 1,
                padding: '0.45rem 0.85rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.875rem',
              }}
            />
            <button
              className="btn btn-primary"
              onClick={() => handleAdvanceStage(pendingNextStage)}
              disabled={actionLoading}
              style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem' }}
            >
              Confirm Move
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowStageNoteInput(false);
                setPendingNextStage(null);
              }}
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* 2. Linear Pipeline Stepper Card (Exact matching design) */}
        {application && application.current_stage !== Stage.REJECTED && (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '1.5rem 2.5rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Connecting line */}
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
                    {/* Circle Indicator */}
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

                    {/* Label */}
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

        {/* 3. Underline Tab Navigation */}
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

        {/* 4. Tab Content */}
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
            {/* TAB: Overview (Two-column layout as in screenshot) */}
            {activeTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                {/* Left Column: Resume Document & Experience & Skills */}
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
                  {/* Resume File Header */}
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

                  {/* Experience Section */}
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

                  {/* Skills Section */}
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

                  {/* Candidate Notes if present */}
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

                {/* Right Column: Activity History (Timeline) */}
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
                    {/* Vertical connecting line */}
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
                          {/* Dot */}
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

                          {/* Feedback Quote Callout */}
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

            {/* TAB: Interview Panel */}
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

            {/* TAB: Feedback Submission & Evaluation */}
            {activeTab === 'feedback' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Submit Feedback Box */}
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

                {/* Submitted feedback list */}
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

            {/* TAB: History (Audit Log) */}
            {activeTab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Complete immutable timeline of all stage transitions, interviewer assignments, and notes.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {timeline.map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
                          {evt.event_type.replace(/_/g, ' ')}
                        </div>
                        {evt.note_content && (
                          <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.15rem' }}>
                            {evt.note_content}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {new Date(evt.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};
