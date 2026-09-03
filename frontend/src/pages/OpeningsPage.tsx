import React, { useEffect, useState } from 'react';
import { Briefcase, Plus, Search, Archive, RotateCcw, Edit2, Eye, Users, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api.js';
import { JobOpening, OpeningStatus } from '../types/index.js';
import { OpeningFormModal } from '../components/Openings/OpeningFormModal.js';
import { ArchiveConfirmModal } from '../components/Openings/ArchiveConfirmModal.js';
import { OpeningDetailModal } from '../components/Openings/OpeningDetailModal.js';

export const OpeningsPage: React.FC = () => {
  const [openings, setOpenings] = useState<JobOpening[]>([]);
  const [activeTab, setActiveTab] = useState<'OPEN' | 'ARCHIVED'>('OPEN');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingOpening, setEditingOpening] = useState<JobOpening | null>(null);

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archivingOpening, setArchivingOpening] = useState<JobOpening | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchOpenings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<JobOpening[]>(`/api/openings?status=${activeTab}`);
      if (res.success) {
        setOpenings(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load job openings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenings();
  }, [activeTab]);

  const handleCreateNew = () => {
    setEditingOpening(null);
    setIsFormModalOpen(true);
  };

  const handleEdit = (opening: JobOpening) => {
    setEditingOpening(opening);
    setIsFormModalOpen(true);
  };

  const handleView = (opening: JobOpening) => {
    setSelectedOpeningId(opening.id);
    setIsDetailModalOpen(true);
  };

  const handleArchiveClick = (opening: JobOpening) => {
    setArchivingOpening(opening);
    setIsArchiveModalOpen(true);
  };

  const handleRestoreClick = async (opening: JobOpening) => {
    setRestoringId(opening.id);
    try {
      const res = await api.post<{ id: string; status: OpeningStatus }>(`/api/openings/${opening.id}/restore`);
      if (res.success) {
        (window as any).showToast?.(`'${opening.title}' has been restored to active status`, 'success');
        fetchOpenings();
      }
    } catch (err: any) {
      (window as any).showToast?.(err.message || 'Failed to restore opening', 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const filteredOpenings = openings.filter((op) => {
    const q = searchQuery.toLowerCase();
    return op.title.toLowerCase().includes(q) || op.department.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Job Openings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Manage positions, departments, job specifications, and hiring workflows.
          </p>
        </div>
        <button
          className="btn btn-primary"
          id="btn-create-opening"
          onClick={handleCreateNew}
        >
          <Plus size={18} />
          <span>Post New Opening</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--bg-card)',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('OPEN')}
            id="tab-open-positions"
            className="btn"
            style={{
              backgroundColor: activeTab === 'OPEN' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'OPEN' ? '#ffffff' : 'var(--text-secondary)',
              padding: '0.45rem 1rem',
              fontWeight: 600,
            }}
          >
            Active Openings
          </button>
          <button
            onClick={() => setActiveTab('ARCHIVED')}
            id="tab-archived-positions"
            className="btn"
            style={{
              backgroundColor: activeTab === 'ARCHIVED' ? 'var(--border-color)' : 'transparent',
              color: activeTab === 'ARCHIVED' ? '#ffffff' : 'var(--text-secondary)',
              padding: '0.45rem 1rem',
              fontWeight: 600,
            }}
          >
            Archived
          </button>
        </div>

        <div style={{ position: 'relative', minWidth: '260px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search by title or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem 0.5rem 2.2rem',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--danger)',
            color: '#fca5a5',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={fetchOpenings} className="btn btn-secondary" style={{ marginLeft: 'auto', padding: '0.25rem 0.75rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} className="card" style={{ height: '220px', opacity: 0.5 }}>
              <div style={{ height: '20px', width: '40%', backgroundColor: 'var(--border-color)', borderRadius: '4px', marginBottom: '1rem' }} />
              <div style={{ height: '24px', width: '75%', backgroundColor: 'var(--border-color)', borderRadius: '4px', marginBottom: '1.5rem' }} />
              <div style={{ height: '60px', width: '100%', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      ) : filteredOpenings.length === 0 ? (
        /* Empty State */
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
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(79, 70, 229, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <Briefcase size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              {activeTab === 'OPEN' ? 'No Active Job Openings' : 'No Archived Job Openings'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px' }}>
              {activeTab === 'OPEN'
                ? 'Get started by creating your first job opening to manage candidates and interview panels.'
                : 'Archived positions will be listed here. Archiving an opening preserves all historical candidates without deleting data.'}
            </p>
          </div>
          {activeTab === 'OPEN' && (
            <button className="btn btn-primary" onClick={handleCreateNew}>
              <Plus size={18} />
              <span>Create Opening</span>
            </button>
          )}
        </div>
      ) : (
        /* Openings Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1.25rem' }}>
          {filteredOpenings.map((opening) => (
            <div
              key={opening.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.25rem',
                borderLeft: `4px solid ${opening.status === OpeningStatus.OPEN ? 'var(--primary)' : 'var(--text-muted)'}`,
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: 'var(--secondary)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {opening.department}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
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
                </div>

                <h3
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    marginBottom: '0.5rem',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleView(opening)}
                >
                  {opening.title}
                </h3>

                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {opening.description}
                </p>
              </div>

              {/* Metrics & Action Footer */}
              <div
                style={{
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <Users size={16} />
                  <span>
                    <strong style={{ color: 'var(--text-primary)' }}>{opening.application_count ?? 0}</strong> candidates (
                    <strong style={{ color: 'var(--secondary)' }}>{opening.active_count ?? 0}</strong> active)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    onClick={() => handleView(opening)}
                    title="View Opening Details"
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.6rem' }}
                  >
                    <Eye size={15} />
                  </button>

                  <button
                    onClick={() => handleEdit(opening)}
                    title="Edit Opening"
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.6rem' }}
                  >
                    <Edit2 size={15} />
                  </button>

                  {opening.status === OpeningStatus.OPEN ? (
                    <button
                      onClick={() => handleArchiveClick(opening)}
                      title="Archive Opening"
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.6rem', color: 'var(--warning)' }}
                    >
                      <Archive size={15} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRestoreClick(opening)}
                      disabled={restoringId === opening.id}
                      title="Restore Opening to active status"
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.6rem', color: 'var(--success)' }}
                    >
                      {restoringId === opening.id ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <OpeningFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={() => fetchOpenings()}
        initialData={editingOpening}
      />

      <ArchiveConfirmModal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        onSuccess={() => fetchOpenings()}
        opening={archivingOpening}
      />

      <OpeningDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        openingId={selectedOpeningId}
        onEdit={(op) => handleEdit(op)}
        onArchive={(op) => handleArchiveClick(op)}
        onRestore={(op) => handleRestoreClick(op)}
      />
    </div>
  );
};
