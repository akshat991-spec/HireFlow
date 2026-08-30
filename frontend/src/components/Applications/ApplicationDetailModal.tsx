import React, { useEffect, useState } from 'react';
import {
  X,
  User,
  Mail,
  Calendar,
  Briefcase,
  UserCheck,
  UserPlus,
  Trash2,
  CheckCircle,
  XCircle,
  RotateCcw,
  MessageSquare,
  Clock,
  Send,
  AlertCircle,
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

const STAGE_COLORS: Record<Stage, { bg: string; text: string; border: string }> = {
  [Stage.APPLIED]: { bg: 'rgba(59, 130, 246, 0.15)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.3)' },
  [Stage.SCREENING]: { bg: 'rgba(139, 92, 246, 0.15)', text: '#c4b5fd', border: 'rgba(139, 92, 246, 0.3)' },
  [Stage.INTERVIEW]: { bg: 'rgba(14, 165, 233, 0.15)', text: '#7dd3fc', border: 'rgba(14, 165, 233, 0.3)' },
  [Stage.OFFER]: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fcd34d', border: 'rgba(245, 158, 11, 0.3)' },
  [Stage.HIRED]: { bg: 'rgba(16, 185, 129, 0.15)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.3)' },
  [Stage.REJECTED]: { bg: 'rgba(239, 68, 68, 0.15)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)' },
};

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
      setError(err.message || 'Failed to load application details');
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
      // Ignore if unauthorized
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
    }
  }, [isOpen, applicationId, isRecruiter]);

  if (!isOpen) return null;

  // Calculate next stage in pipeline
  const currentStage = application?.current_stage;
  const currentProgIndex = currentStage ? PROGRESSION_STAGES.indexOf(currentStage) : -1;
  const nextStage = currentProgIndex >= 0 && currentProgIndex < PROGRESSION_STAGES.length - 1
    ? PROGRESSION_STAGES[currentProgIndex + 1]
    : null;

  // Handle Assign Interviewer
  const handleAssignInterviewer = async () => {
    if (!selectedInterviewerId || !applicationId) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/api/applications/${applicationId}/interviewers`, {
        userId: selectedInterviewerId,
      });
      if (res.success) {
        (window as any).showToast?.('Interviewer assigned to panel successfully', 'success');
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
    if (note === null) return; // User cancelled

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
      const res = await api.post(`/api/applications/${applicationId}/reinstate`, {
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

  const assignedIds = new Set(interviewers.map((i) => i.id));
  const unassignedOptions = availableInterviewers.filter((i) => !assignedIds.has(i.id));
  const stageStyle = currentStage ? STAGE_COLORS[currentStage] || STAGE_COLORS[Stage.APPLIED] : STAGE_COLORS[Stage.APPLIED];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(5px)',
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
          maxWidth: '860px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {application?.candidate_name || 'Loading candidate...'}
              </h2>
              {application && (
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: stageStyle.bg,
                    color: stageStyle.text,
                    border: `1px solid ${stageStyle.border}`,
                  }}
                >
                  {application.current_stage}
                  {application.current_stage === Stage.REJECTED && application.rejected_from_stage && (
                    <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>
                      {' '}(from {application.rejected_from_stage})
                    </span>
                  )}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={15} /> {application?.candidate_email}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Briefcase size={15} /> {application?.job_title} ({application?.department})
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Tag size={15} /> Source: {application?.source}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={15} /> Applied: {application?.applied_date ? new Date(application.applied_date).toLocaleDateString() : ''}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              padding: '0.25rem',
            }}
          >
            <X size={22} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading candidate details & interview panel...
          </div>
        ) : error ? (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--danger)',
              color: '#fca5a5',
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {error}
          </div>
        ) : application ? (
          <>
            {/* Notes banner if present */}
            {application.notes && (
              <div
                style={{
                  backgroundColor: 'var(--bg-main)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.9rem',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Candidate Notes
                </div>
                <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{application.notes}</div>
              </div>
            )}

            {/* Recruiter Stage Controls */}
            {isRecruiter && (
              <div
                style={{
                  backgroundColor: 'var(--bg-main)',
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Pipeline Controls
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {application.current_stage !== Stage.REJECTED && nextStage && (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                        disabled={actionLoading}
                        onClick={() => {
                          setPendingNextStage(nextStage);
                          setShowStageNoteInput(true);
                        }}
                      >
                        <CheckCircle size={16} />
                        <span>Advance to {nextStage}</span>
                      </button>
                    )}

                    {application.current_stage !== Stage.REJECTED && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', color: 'var(--danger)' }}
                        disabled={actionLoading}
                        onClick={handleReject}
                      >
                        <XCircle size={16} />
                        <span>Reject Candidate</span>
                      </button>
                    )}

                    {application.current_stage === Stage.REJECTED && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', color: 'var(--success)' }}
                        disabled={actionLoading}
                        onClick={handleReinstate}
                      >
                        <RotateCcw size={16} />
                        <span>Reinstate Candidate</span>
                      </button>
                    )}
                  </div>
                </div>

                {showStageNoteInput && pendingNextStage && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <input
                      type="text"
                      placeholder={`Optional note for advancing to ${pendingNextStage}...`}
                      value={stageNote}
                      onChange={(e) => setStageNote(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '0.45rem 0.75rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                      }}
                    />
                    <button
                      className="btn btn-primary"
                      style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                      disabled={actionLoading}
                      onClick={() => handleAdvanceStage(pendingNextStage)}
                    >
                      Confirm
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                      onClick={() => {
                        setShowStageNoteInput(false);
                        setPendingNextStage(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Grid Layout: Interview Panel (Left) & Feedback/Timeline (Right) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {/* Left Column: Interview Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <UserCheck size={18} color="var(--secondary)" />
                    <span>Interview Panel ({interviewers.length})</span>
                  </h3>
                </div>

                {/* Assigned Interviewers List */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    minHeight: '120px',
                  }}
                >
                  {interviewers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No interviewers assigned to this candidate yet.
                    </div>
                  ) : (
                    interviewers.map((interviewer) => (
                      <div
                        key={interviewer.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: 'var(--bg-card)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: 'rgba(14, 165, 233, 0.2)',
                              color: 'var(--secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                            }}
                          >
                            {interviewer.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{interviewer.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{interviewer.email}</div>
                          </div>
                        </div>

                        {isRecruiter && (
                          <button
                            title="Remove from panel"
                            onClick={() => handleRemoveInterviewer(interviewer.id, interviewer.name)}
                            disabled={actionLoading}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--danger)',
                              cursor: 'pointer',
                              padding: '0.3rem',
                              opacity: 0.8,
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Recruiter Assign New Interviewer Form */}
                {isRecruiter && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <select
                      value={selectedInterviewerId}
                      onChange={(e) => setSelectedInterviewerId(e.target.value)}
                      disabled={actionLoading || unassignedOptions.length === 0}
                      style={{
                        flex: 1,
                        padding: '0.5rem 0.75rem',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
                    >
                      <option value="">
                        {unassignedOptions.length === 0 ? 'No more interviewers available' : 'Select interviewer to assign...'}
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
                      style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem' }}
                    >
                      <UserPlus size={16} />
                      <span>Assign</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: Feedback Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MessageSquare size={18} color="var(--primary)" />
                  <span>Interviewer Feedback</span>
                </h3>

                <form onSubmit={handleSubmitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <textarea
                    rows={3}
                    placeholder="Enter interview evaluation, strengths, red flags, or recommendation..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    disabled={actionLoading}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!feedbackText.trim() || actionLoading}
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                    >
                      <Send size={15} />
                      <span>Submit Feedback</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Timeline Audit History */}
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={18} color="var(--accent)" />
                  <span>Immutable Application Timeline & Audit History</span>
                </h3>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--bg-main)',
                    padding: '0.2rem 0.55rem',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  Append-Only • {timeline.length} Events
                </span>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  padding: '1rem',
                  maxHeight: '320px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                {timeline.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No timeline events recorded yet.
                  </div>
                ) : (
                  timeline.map((evt) => {
                    let badgeBg = 'rgba(100, 116, 139, 0.2)';
                    let badgeColor = 'var(--text-muted)';
                    let badgeBorder = 'var(--border-color)';

                    if (evt.event_type === EventType.APPLICATION_CREATED) {
                      badgeBg = 'rgba(59, 130, 246, 0.15)';
                      badgeColor = '#93c5fd';
                      badgeBorder = 'rgba(59, 130, 246, 0.3)';
                    } else if (evt.event_type === EventType.STAGE_CHANGE) {
                      badgeBg = 'rgba(79, 70, 229, 0.15)';
                      badgeColor = '#a5b4fc';
                      badgeBorder = 'rgba(79, 70, 229, 0.3)';
                    } else if (evt.event_type === EventType.REJECTION) {
                      badgeBg = 'rgba(239, 68, 68, 0.15)';
                      badgeColor = '#fca5a5';
                      badgeBorder = 'rgba(239, 68, 68, 0.3)';
                    } else if (evt.event_type === EventType.REINSTATEMENT) {
                      badgeBg = 'rgba(16, 185, 129, 0.15)';
                      badgeColor = '#6ee7b7';
                      badgeBorder = 'rgba(16, 185, 129, 0.3)';
                    } else if (evt.event_type === EventType.INTERVIEWER_ASSIGNED) {
                      badgeBg = 'rgba(14, 165, 233, 0.15)';
                      badgeColor = '#7dd3fc';
                      badgeBorder = 'rgba(14, 165, 233, 0.3)';
                    } else if (evt.event_type === EventType.INTERVIEWER_REMOVED) {
                      badgeBg = 'rgba(245, 158, 11, 0.15)';
                      badgeColor = '#fcd34d';
                      badgeBorder = 'rgba(245, 158, 11, 0.3)';
                    } else if (evt.event_type === EventType.INTERVIEWER_FEEDBACK) {
                      badgeBg = 'rgba(139, 92, 246, 0.15)';
                      badgeColor = '#c4b5fd';
                      badgeBorder = 'rgba(139, 92, 246, 0.3)';
                    }

                    return (
                      <div
                        key={evt.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                          padding: '0.75rem',
                          backgroundColor: 'var(--bg-card)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        {/* Event Header: Type, Stage Transition, Timestamp */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '0.15rem 0.5rem',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: badgeBg,
                                color: badgeColor,
                                border: `1px solid ${badgeBorder}`,
                              }}
                            >
                              {evt.event_type.replace(/_/g, ' ')}
                            </span>

                            {/* Stage Transition Indicator */}
                            {evt.old_stage && evt.new_stage && evt.old_stage !== evt.new_stage && (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{evt.old_stage}</span>
                                <span>→</span>
                                <span style={{ color: 'var(--primary-light)' }}>{evt.new_stage}</span>
                              </span>
                            )}
                          </div>

                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {new Date(evt.created_at).toLocaleString()}
                          </span>
                        </div>

                        {/* Event Body / Note / Feedback */}
                        {evt.event_type === EventType.INTERVIEWER_FEEDBACK ? (
                          <div
                            style={{
                              fontSize: '0.875rem',
                              color: 'var(--text-primary)',
                              backgroundColor: 'var(--bg-main)',
                              padding: '0.5rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              borderLeft: '3px solid var(--accent)',
                              marginTop: '0.2rem',
                              fontStyle: 'italic',
                            }}
                          >
                            "{evt.note_content}"
                          </div>
                        ) : (
                          evt.note_content && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '0.1rem' }}>
                              {evt.note_content}
                            </div>
                          )
                        )}

                        {/* Actor Info */}
                        {evt.actor_name && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            Action by: <strong style={{ color: 'var(--text-secondary)' }}>{evt.actor_name}</strong> ({evt.actor_role})
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
