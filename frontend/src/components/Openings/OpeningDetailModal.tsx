import React, { useEffect, useState } from 'react';
import { X, Briefcase, Users, Calendar, ArrowRight, Eye } from 'lucide-react';
import { api } from '../../services/api.js';
import { JobOpening, Stage, OpeningStatus, Application, Role } from '../../types/index.js';
import { ApplicationFormModal } from '../Applications/ApplicationFormModal.js';
import { ApplicationDetailModal } from '../Applications/ApplicationDetailModal.js';
import { useAuth } from '../../context/AuthContext.js';

interface OpeningDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  openingId: string | null;
  onEdit: (opening: JobOpening) => void;
  onArchive: (opening: JobOpening) => void;
  onRestore: (opening: JobOpening) => void;
}

const STAGE_COLORS: Record<Stage, { bg: string; text: string; border: string }> = {
  [Stage.APPLIED]: { bg: 'rgba(59, 130, 246, 0.15)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.3)' },
  [Stage.SCREENING]: { bg: 'rgba(139, 92, 246, 0.15)', text: '#c4b5fd', border: 'rgba(139, 92, 246, 0.3)' },
  [Stage.INTERVIEW]: { bg: 'rgba(14, 165, 233, 0.15)', text: '#7dd3fc', border: 'rgba(14, 165, 233, 0.3)' },
  [Stage.OFFER]: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fcd34d', border: 'rgba(245, 158, 11, 0.3)' },
  [Stage.HIRED]: { bg: 'rgba(16, 185, 129, 0.15)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.3)' },
  [Stage.REJECTED]: { bg: 'rgba(239, 68, 68, 0.15)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)' },
};

export const OpeningDetailModal: React.FC<OpeningDetailModalProps> = ({
  isOpen,
  onClose,
  openingId,
  onEdit,
  onArchive,
  onRestore,
}) => {
  const { currentUser } = useAuth();
  const [opening, setOpening] = useState<JobOpening | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchOpeningDetails = () => {
    if (!openingId) return;
    setLoading(true);
    setError(null);

    api.get<JobOpening>(`/api/openings/${openingId}`)
      .then((res) => {
        if (res.success) {
          setOpening(res.data);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load opening details');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen && openingId) {
      fetchOpeningDetails();
    }
  }, [isOpen, openingId]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          padding: '2rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{opening?.title || 'Loading position...'}</h2>
              {opening && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor:
                      opening.status === OpeningStatus.OPEN
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(100, 116, 139, 0.25)',
                    color: opening.status === OpeningStatus.OPEN ? 'var(--success)' : 'var(--text-muted)',
                    border: `1px solid ${
                      opening.status === OpeningStatus.OPEN ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'
                    }`,
                  }}
                >
                  {opening.status}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Briefcase size={15} /> {opening?.department}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Users size={15} /> {opening?.application_count || 0} Total Applications
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
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading position details...
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
        ) : opening ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Job Description
              </h3>
              <div
                style={{
                  backgroundColor: 'var(--bg-main)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {opening.description}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Applications in this Opening ({opening.applications?.length || 0})
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setEditingApp(null);
                    setIsAppModalOpen(true);
                  }}
                  className="btn btn-primary"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                >
                  Add Candidate
                </button>
              </div>

              {(!opening.applications || opening.applications.length === 0) ? (
                <div
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    padding: '1.5rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--border-color)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.875rem',
                  }}
                >
                  No applications received for this position yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {opening.applications.map((app) => {
                    const style = STAGE_COLORS[app.current_stage] || STAGE_COLORS[Stage.APPLIED];
                    return (
                      <div
                        key={app.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{app.candidate_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {app.candidate_email} • Source: {app.source}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              padding: '0.2rem 0.55rem',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: style.bg,
                              color: style.text,
                              border: `1px solid ${style.border}`,
                            }}
                          >
                            {app.current_stage}
                            {app.current_stage === Stage.REJECTED && app.rejected_from_stage && (
                              <span style={{ fontSize: '0.7rem', opacity: 0.8 }}> (from {app.rejected_from_stage})</span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAppId(app.id);
                              setIsDetailModalOpen(true);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            title="View candidate details & interview panel"
                          >
                            <Eye size={14} />
                            <span>View</span>
                          </button>
                          {currentUser?.role === Role.RECRUITER && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingApp(app);
                                setIsAppModalOpen(true);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              {currentUser?.role === Role.RECRUITER && (
                opening.status === OpeningStatus.OPEN ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onArchive(opening);
                    }}
                    className="btn btn-secondary"
                    style={{ color: 'var(--warning)' }}
                  >
                    Archive Opening
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRestore(opening);
                    }}
                    className="btn btn-secondary"
                    style={{ color: 'var(--success)' }}
                  >
                    Restore Opening
                  </button>
                )
              )}
              {currentUser?.role === Role.RECRUITER && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(opening);
                  }}
                  className="btn btn-primary"
                >
                  Edit Position
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <ApplicationFormModal
        isOpen={isAppModalOpen}
        onClose={() => setIsAppModalOpen(false)}
        onSuccess={() => fetchOpeningDetails()}
        jobOpeningId={opening?.id}
        initialData={editingApp}
      />

      <ApplicationDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        applicationId={selectedAppId}
        currentUser={currentUser}
        onApplicationUpdated={() => fetchOpeningDetails()}
      />
    </div>
  );
};
