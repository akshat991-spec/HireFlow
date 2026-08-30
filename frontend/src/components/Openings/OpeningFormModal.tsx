import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../services/api.js';
import { JobOpening, OpeningStatus } from '../../types/index.js';

interface OpeningFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (opening: JobOpening) => void;
  initialData?: JobOpening | null;
}

export const OpeningFormModal: React.FC<OpeningFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}) => {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<OpeningStatus>(OpeningStatus.OPEN);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDepartment(initialData.department);
      setDescription(initialData.description);
      setStatus(initialData.status);
    } else {
      setTitle('');
      setDepartment('');
      setDescription('');
      setStatus(OpeningStatus.OPEN);
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isEditing = !!initialData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Job title is required');
      return;
    }
    if (!department.trim()) {
      setError('Department is required');
      return;
    }
    if (!description.trim()) {
      setError('Job description is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (isEditing) {
        const res = await api.put<JobOpening>(`/api/openings/${initialData.id}`, {
          title: title.trim(),
          department: department.trim(),
          description: description.trim(),
          status,
        });
        if (res.success) {
          (window as any).showToast?.('Job opening updated successfully', 'success');
          onSuccess({
            ...initialData,
            title: title.trim(),
            department: department.trim(),
            description: description.trim(),
            status,
          });
          onClose();
        }
      } else {
        const res = await api.post<JobOpening>('/api/openings', {
          title: title.trim(),
          department: department.trim(),
          description: description.trim(),
          status,
        });
        if (res.success) {
          (window as any).showToast?.('Job opening created successfully', 'success');
          onSuccess(res.data);
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save job opening');
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
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          padding: '2rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {isEditing ? 'Edit Job Opening' : 'Create New Job Opening'}
          </h2>
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

        {error && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--danger)',
              color: '#fca5a5',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.25rem',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Job Title <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.925rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Department <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Engineering, Sales, Product"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.925rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Description & Requirements <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide role overview, core responsibilities, and qualifications..."
              disabled={submitting}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.925rem',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {isEditing && (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OpeningStatus)}
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.925rem',
                  outline: 'none',
                }}
              >
                <option value={OpeningStatus.OPEN}>Active (OPEN)</option>
                <option value={OpeningStatus.ARCHIVED}>Archived (ARCHIVED)</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Opening'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
