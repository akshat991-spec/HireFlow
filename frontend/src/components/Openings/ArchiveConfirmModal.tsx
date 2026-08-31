import React, { useState } from 'react';
import { Archive, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { JobOpening, OpeningStatus } from '../../types/index.js';

interface ArchiveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (openingId: string) => void;
  opening: JobOpening | null;
}

export const ArchiveConfirmModal: React.FC<ArchiveConfirmModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  opening,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !opening) return null;

  const handleArchive = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ id: string; status: OpeningStatus }>(
        `/api/openings/${opening.id}/archive`
      );
      if (res.success) {
        (window as any).showToast?.(
          `'${opening.title}' has been archived. All candidate applications are preserved.`,
          'info'
        );
        onSuccess(opening.id);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to archive opening');
    } finally {
      setSubmitting(false);
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
          maxWidth: '480px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          padding: '2rem',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--warning)',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Archive Job Opening?
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Are you sure you want to archive <strong>{opening.title}</strong>?
            </p>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.4,
          }}
        >
          ℹ️ Archiving hides this opening from default active views. <strong>All associated candidates and pipeline records will remain intact</strong> and can be accessed or restored at any time.
        </div>

        {error && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--danger)',
              color: '#fca5a5',
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1rem',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleArchive}
            disabled={submitting}
            style={{
              backgroundColor: 'var(--warning)',
              color: '#000000',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            className="btn"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
            <span>{submitting ? 'Archiving...' : 'Confirm Archive'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
