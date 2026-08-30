import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Filter,
  UserCheck,
  Eye,
  Edit2,
  Briefcase,
  Calendar,
  AlertCircle,
  ShieldCheck,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { Application, JobOpening, Stage, Role } from '../types/index.js';
import { ApplicationDetailModal } from '../components/Applications/ApplicationDetailModal.js';
import { ApplicationFormModal } from '../components/Applications/ApplicationFormModal.js';

const STAGE_COLORS: Record<Stage, { bg: string; text: string; border: string }> = {
  [Stage.APPLIED]: { bg: 'rgba(59, 130, 246, 0.15)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.3)' },
  [Stage.SCREENING]: { bg: 'rgba(139, 92, 246, 0.15)', text: '#c4b5fd', border: 'rgba(139, 92, 246, 0.3)' },
  [Stage.INTERVIEW]: { bg: 'rgba(14, 165, 233, 0.15)', text: '#7dd3fc', border: 'rgba(14, 165, 233, 0.3)' },
  [Stage.OFFER]: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fcd34d', border: 'rgba(245, 158, 11, 0.3)' },
  [Stage.HIRED]: { bg: 'rgba(16, 185, 129, 0.15)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.3)' },
  [Stage.REJECTED]: { bg: 'rgba(239, 68, 68, 0.15)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)' },
};

const COMMON_SOURCES = ['LinkedIn', 'Referral', 'Direct', 'Career Portal', 'Agency', 'GitHub', 'Inbound'];

export const CandidatesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [openings, setOpenings] = useState<JobOpening[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [openingFilter, setOpeningFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  // Sorting & Pagination State
  const [sortBy, setSortBy] = useState('applied_date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  const isRecruiter = currentUser?.role === Role.RECRUITER;
  const isInterviewer = currentUser?.role === Role.INTERVIEWER;

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (search.trim()) queryParams.set('search', search.trim());
      if (stageFilter) queryParams.set('stage', stageFilter);
      if (openingFilter) queryParams.set('jobOpeningId', openingFilter);
      if (sourceFilter) queryParams.set('source', sourceFilter);
      queryParams.set('sortBy', sortBy);
      queryParams.set('sortOrder', sortOrder);
      queryParams.set('page', page.toString());
      queryParams.set('pageSize', pageSize.toString());

      const res = await api.get<{
        items: Application[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(`/api/applications?${queryParams.toString()}`);

      if (res.success) {
        setApplications(res.data.items);
        setTotalCount(res.data.total);
        setTotalPages(res.data.totalPages);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  const fetchOpenings = async () => {
    try {
      const res = await api.get<JobOpening[]>('/api/openings?includeArchived=true', { silent: true });
      if (res.success) {
        setOpenings(res.data);
      }
    } catch {
      // Non-critical
    }
  };

  useEffect(() => {
    fetchOpenings();
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [search, stageFilter, openingFilter, sourceFilter, sortBy, sortOrder, page, pageSize, currentUser]);

  const handleResetFilters = () => {
    setSearch('');
    setStageFilter('');
    setOpeningFilter('');
    setSourceFilter('');
    setSortBy('applied_date');
    setSortOrder('desc');
    setPage(1);
  };

  const handleOpenDetail = (appId: string) => {
    setSelectedAppId(appId);
    setIsDetailModalOpen(true);
  };

  const handleEditApp = (app: Application) => {
    setEditingApp(app);
    setIsFormModalOpen(true);
  };

  const handleCreateNewApp = () => {
    setEditingApp(null);
    setIsFormModalOpen(true);
  };

  const hasActiveFilters = Boolean(search || stageFilter || openingFilter || sourceFilter || sortBy !== 'applied_date' || sortOrder !== 'desc');

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            {isInterviewer ? 'My Applications' : 'Candidates & Pipeline'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {isInterviewer
              ? `Showing candidates assigned to you (${currentUser?.name}) across all hiring pipelines.`
              : 'Search, filter, sort, and manage candidate applications across all accessible job openings.'}
          </p>
        </div>

        {isRecruiter && (
          <button
            className="btn btn-primary"
            onClick={handleCreateNewApp}
            disabled={openings.length === 0}
          >
            <Plus size={18} />
            <span>Add Candidate</span>
          </button>
        )}
      </div>

      {/* Role banner for interviewers */}
      {isInterviewer && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: 'rgba(14, 165, 233, 0.1)',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1.25rem',
            color: 'var(--secondary)',
            fontSize: '0.875rem',
          }}
        >
          <ShieldCheck size={20} />
          <div>
            <strong>Interviewer Access Active:</strong> Your view is server-side scoped to candidates where you are assigned to the interview panel.
          </div>
        </div>
      )}

      {/* Multi-Criteria Search & Filter Controls */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          backgroundColor: 'var(--bg-card)',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Top Row: Search + Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: 2, minWidth: '240px' }}>
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
              placeholder="Search candidate name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
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

          {/* Stage Filter */}
          <div style={{ flex: 1, minWidth: '140px' }}>
            <select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            >
              <option value="">All Stages</option>
              <option value={Stage.APPLIED}>Applied</option>
              <option value={Stage.SCREENING}>Screening</option>
              <option value={Stage.INTERVIEW}>Interview</option>
              <option value={Stage.OFFER}>Offer</option>
              <option value={Stage.HIRED}>Hired</option>
              <option value={Stage.REJECTED}>Rejected</option>
            </select>
          </div>

          {/* Job Opening Filter */}
          <div style={{ flex: 1.5, minWidth: '180px' }}>
            <select
              value={openingFilter}
              onChange={(e) => {
                setOpeningFilter(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            >
              <option value="">All Job Openings</option>
              {openings.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.title} ({op.department})
                </option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div style={{ flex: 1, minWidth: '140px' }}>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            >
              <option value="">All Sources</option>
              {COMMON_SOURCES.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bottom Row: Sorting + Reset */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.35rem 0.65rem',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.825rem',
                outline: 'none',
              }}
            >
              <option value="applied_date">Applied Date</option>
              <option value="current_stage">Stage</option>
              <option value="updated_at">Last Updated</option>
              <option value="candidate_name">Candidate Name</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
              title={`Toggle sort order (Currently ${sortOrder.toUpperCase()})`}
            >
              {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              <span>{sortOrder.toUpperCase()}</span>
            </button>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
            >
              <RotateCcw size={13} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
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
          <button
            onClick={fetchApplications}
            className="btn btn-secondary"
            style={{ marginLeft: 'auto', padding: '0.25rem 0.75rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading applications...
        </div>
      ) : applications.length === 0 ? (
        /* Zero Results Empty State */
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
            <Users size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              {isInterviewer ? 'No Assigned Applications Found' : 'No Applications Found'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', marginBottom: '1rem' }}>
              {isInterviewer
                ? 'You currently have no candidate applications assigned matching the selected filters.'
                : 'No candidate applications match your current search and filter criteria.'}
            </p>
            {hasActiveFilters && (
              <button onClick={handleResetFilters} className="btn btn-secondary" style={{ padding: '0.45rem 0.9rem' }}>
                <RotateCcw size={14} />
                <span>Clear All Filters</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Candidates Table / Grid */
        <div
          className="card"
          style={{
            padding: 0,
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '0.85rem 1.25rem' }}>Candidate</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Job Opening</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Current Stage</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Source</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Interview Panel</th>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Applied Date</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => {
                  const style = STAGE_COLORS[app.current_stage] || STAGE_COLORS[Stage.APPLIED];
                  const panel = app.interviewers || [];

                  return (
                    <tr
                      key={app.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 150ms ease',
                      }}
                      className="table-row-hover"
                    >
                      {/* Candidate Name & Email */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div
                          style={{ fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
                          onClick={() => handleOpenDetail(app.id)}
                        >
                          {app.candidate_name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {app.candidate_email}
                        </div>
                      </td>

                      {/* Job Opening */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {app.job_title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {app.department}
                        </div>
                      </td>

                      {/* Current Stage */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: style.bg,
                            color: style.text,
                            border: `1px solid ${style.border}`,
                            display: 'inline-block',
                          }}
                        >
                          {app.current_stage}
                          {app.current_stage === Stage.REJECTED && app.rejected_from_stage && (
                            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}> (from {app.rejected_from_stage})</span>
                          )}
                        </span>
                      </td>

                      {/* Source */}
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {app.source}
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
                                title={`${intv.name} (${intv.email})`}
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: 'var(--radius-sm)',
                                  backgroundColor: 'rgba(14, 165, 233, 0.15)',
                                  color: 'var(--secondary)',
                                  border: '1px solid rgba(14, 165, 233, 0.3)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                }}
                              >
                                <UserCheck size={12} />
                                <span>{intv.name.split(' ')[0]}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Applied Date */}
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {app.applied_date ? new Date(app.applied_date).toLocaleDateString() : '—'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                          <button
                            title="View Full Profile & Panel"
                            className="btn btn-secondary"
                            onClick={() => handleOpenDetail(app.id)}
                            style={{ padding: '0.35rem 0.6rem' }}
                          >
                            <Eye size={15} />
                          </button>

                          {isRecruiter && (
                            <button
                              title="Edit Candidate Details"
                              className="btn btn-secondary"
                              onClick={() => handleEditApp(app)}
                              style={{ padding: '0.35rem 0.6rem' }}
                            >
                              <Edit2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer with Metadata & Pagination Controls */}
          <div
            style={{
              padding: '0.85rem 1.25rem',
              backgroundColor: 'var(--bg-main)',
              borderTop: '1px solid var(--border-color)',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            {/* Metadata Count */}
            <div>
              Showing <strong style={{ color: 'var(--text-primary)' }}>{startRecord}–{endRecord}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{totalCount}</strong> applications
            </div>

            {/* Pagination Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* Page size selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem' }}>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Page Navigator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.5rem' }}
                  title="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '0.8rem' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.5rem' }}
                  title="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ApplicationDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        applicationId={selectedAppId}
        currentUser={currentUser}
        onApplicationUpdated={() => fetchApplications()}
      />

      <ApplicationFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={() => fetchApplications()}
        initialData={editingApp}
        jobOpeningId={editingApp?.job_opening_id || (openings[0]?.id || '')}
      />
    </div>
  );
};
