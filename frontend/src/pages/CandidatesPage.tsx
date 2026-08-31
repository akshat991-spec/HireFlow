import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Filter,
  Eye,
  Edit2,
  Calendar,
  AlertCircle,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  FastForward,
  UserX,
  Download,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { Application, JobOpening, Stage, Role } from '../types/index.js';
import { ApplicationDetailModal } from '../components/Applications/ApplicationDetailModal.js';
import { ApplicationFormModal } from '../components/Applications/ApplicationFormModal.js';
import {
  BulkActionResultsModal,
  BulkActionSummaryData,
} from '../components/Applications/BulkActionResultsModal.js';
import { StageProgressionBar } from '../components/Applications/StageProgressionBar.js';

const COMMON_SOURCES = ['LinkedIn', 'Referral', 'Direct', 'Direct Agency', 'Career Portal', 'Agency', 'GitHub'];

function getCandidateInitials(name: string): string {
  if (!name) return 'C';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const CandidatesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();

  const [applications, setApplications] = useState<Application[]>([]);
  const [openings, setOpenings] = useState<JobOpening[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Search & Filter State
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [stageFilter, setStageFilter] = useState(searchParams.get('stage') || '');
  const [openingFilter, setOpeningFilter] = useState(searchParams.get('opening') || '');
  const [sourceFilter, setSourceFilter] = useState('');

  // Sorting & Pagination State
  const [sortBy, setSortBy] = useState('applied_date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isConfirmingBulkReject, setIsConfirmingBulkReject] = useState(false);
  const [bulkSummaryData, setBulkSummaryData] = useState<BulkActionSummaryData | null>(null);

  // CSV Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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
    const stage = searchParams.get('stage');
    const opening = searchParams.get('opening');
    const q = searchParams.get('search');
    if (stage !== null) setStageFilter(stage);
    if (opening !== null) setOpeningFilter(opening);
    if (q !== null) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    fetchApplications();
    setSelectedIds([]);
  }, [search, stageFilter, openingFilter, sourceFilter, sortBy, sortOrder, page, pageSize, currentUser]);

  const handleResetFilters = () => {
    setSearch('');
    setStageFilter('');
    setOpeningFilter('');
    setSourceFilter('');
    setSortBy('applied_date');
    setSortOrder('desc');
    setPage(1);
    setSelectedIds([]);
  };

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.length === applications.length && applications.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(applications.map((a) => a.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Bulk advance handler
  const handleBulkAdvance = async () => {
    if (selectedIds.length === 0 || isBulkProcessing) return;
    setIsBulkProcessing(true);
    try {
      const res = await api.post<any>('/api/applications/bulk/advance', {
        applicationIds: selectedIds,
        note: 'Bulk stage advance performed by recruiter',
      });

      if (res.success) {
        setBulkSummaryData({
          actionType: 'ADVANCE',
          total: res.data.total,
          successful: res.data.successful,
          refused: res.data.refused,
          results: res.data.results,
        });
        setSelectedIds([]);
        fetchApplications();
      }
    } catch (err: any) {
      setError(err.message || 'Bulk advance failed');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Bulk reject handler
  const handleBulkReject = async () => {
    if (selectedIds.length === 0 || isBulkProcessing) return;
    if (!isConfirmingBulkReject) {
      setIsConfirmingBulkReject(true);
      return;
    }

    setIsBulkProcessing(true);
    try {
      const res = await api.post<any>('/api/applications/bulk/reject', {
        applicationIds: selectedIds,
        note: 'Bulk rejection performed by recruiter',
      });

      if (res.success) {
        setBulkSummaryData({
          actionType: 'REJECT',
          total: res.data.total,
          successful: res.data.successful,
          refused: res.data.refused,
          results: res.data.results,
        });
        setSelectedIds([]);
        setIsConfirmingBulkReject(false);
        fetchApplications();
      }
    } catch (err: any) {
      setError(err.message || 'Bulk reject failed');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // CSV Export handler
  const handleExportCsv = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);
    try {
      const token = localStorage.getItem('hireflow_token');
      const response = await fetch('/api/applications/export', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.message || 'Failed to export CSV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hireflow_pipeline_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err: any) {
      setExportError(err.message || 'Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
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
  const isAllSelected = applications.length > 0 && selectedIds.length === applications.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < applications.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">
            {isInterviewer ? 'My Applications' : 'Applications'}
          </h1>
          <div className="page-subtitle-tracked">
            SHOWING {totalCount} TOTAL CANDIDATES
          </div>
        </div>

        {isRecruiter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleCreateNewApp}
              disabled={openings.length === 0}
            >
              <Plus size={17} />
              <span>Add Candidate</span>
            </button>
          </div>
        )}
      </div>

      {/* CSV Export Success / Error Banners */}
      {exportSuccess && (
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
          <CheckCircle2 size={18} />
          <span>Pipeline snapshot CSV export downloaded successfully!</span>
        </div>
      )}

      {exportError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{exportError}</span>
        </div>
      )}

      {/* Role banner for interviewers */}
      {isInterviewer && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1.25rem',
            color: '#0369a1',
            fontSize: '0.875rem',
          }}
        >
          <ShieldCheck size={20} />
          <div>
            <strong>Interviewer Access Active:</strong> Your view is server-side scoped to candidates where you are assigned to the interview panel.
          </div>
        </div>
      )}

      {/* Floating Selection Action Bar for Recruiters */}
      {isRecruiter && selectedIds.length > 0 && (
        <div
          style={{
            backgroundColor: isConfirmingBulkReject ? '#fef2f2' : '#ffffff',
            border: isConfirmingBulkReject ? '1px solid #fecaca' : '1px solid #cbd5e1',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            boxShadow: 'var(--shadow-md)',
            animation: 'fadeIn 200ms ease',
            flexWrap: 'wrap',
          }}
        >
          {isConfirmingBulkReject ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#b91c1c', fontWeight: 600, fontSize: '0.875rem' }}>
                <AlertTriangle size={18} />
                <span>Are you sure you want to reject <strong>{selectedIds.length}</strong> selected candidate{selectedIds.length > 1 ? 's' : ''}?</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  onClick={() => setIsConfirmingBulkReject(false)}
                  disabled={isBulkProcessing}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkReject}
                  disabled={isBulkProcessing}
                  className="btn btn-danger"
                  style={{ padding: '0.4rem 0.95rem', fontSize: '0.85rem', gap: '0.4rem' }}
                >
                  {isBulkProcessing && <Loader2 size={14} className="animate-spin" />}
                  <span>Confirm Bulk Rejection</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    backgroundColor: 'var(--gold-bg)',
                    color: 'var(--gold-light)',
                    border: '1px solid var(--gold-border)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                  }}
                >
                  {selectedIds.length}
                </span>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>
                  Candidate{selectedIds.length > 1 ? 's' : ''} Selected
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  onClick={handleBulkAdvance}
                  disabled={isBulkProcessing}
                  className="btn btn-primary"
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', gap: '0.4rem' }}
                  title="Advance each selected candidate to their next valid stage"
                >
                  {isBulkProcessing ? <Loader2 size={14} className="animate-spin" /> : <FastForward size={15} />}
                  <span>Bulk Advance</span>
                </button>

                <button
                  onClick={handleBulkReject}
                  disabled={isBulkProcessing}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.85rem',
                    gap: '0.4rem',
                    color: 'var(--danger)',
                    borderColor: '#fca5a5',
                  }}
                  title="Reject selected candidates"
                >
                  <UserX size={15} />
                  <span>Bulk Reject</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedIds([]);
                    setIsConfirmingBulkReject(false);
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                >
                  Deselect
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Multi-Criteria Search & Filter Controls Bar */}
      <div
        className="card"
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          gap: '0.85rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: 2.2, minWidth: '240px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
            }}
          />
          <input
            type="text"
            placeholder="Search candidates..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem 0.55rem 2.35rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 'var(--radius-sm)',
              color: '#0f172a',
              fontSize: '0.875rem',
              fontWeight: 500,
              outline: 'none',
            }}
          />
        </div>

        {/* Job Role Filter Pill */}
        <div style={{ flex: 1.2, minWidth: '150px' }}>
          <select
            value={openingFilter}
            onChange={(e) => {
              setOpeningFilter(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 'var(--radius-sm)',
              color: '#334155',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">Job Role ⌵</option>
            {openings.map((op) => (
              <option key={op.id} value={op.id}>
                {op.title}
              </option>
            ))}
          </select>
        </div>

        {/* Stage Filter Pill */}
        <div style={{ flex: 1, minWidth: '130px' }}>
          <select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 'var(--radius-sm)',
              color: '#334155',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">Stage ⌵</option>
            <option value={Stage.APPLIED}>Applied</option>
            <option value={Stage.SCREENING}>Screening</option>
            <option value={Stage.INTERVIEW}>Interview</option>
            <option value={Stage.OFFER}>Offer Extended</option>
            <option value={Stage.HIRED}>Hired</option>
            <option value={Stage.REJECTED}>Rejected</option>
          </select>
        </div>

        {/* Source Filter Pill */}
        <div style={{ flex: 1, minWidth: '130px' }}>
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 'var(--radius-sm)',
              color: '#334155',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">Source ⌵</option>
            {COMMON_SOURCES.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>
        </div>

        {/* Export CSV Button */}
        {isRecruiter && (
          <button
            className="btn btn-gold"
            onClick={handleExportCsv}
            disabled={isExporting}
            style={{ padding: '0.5rem 0.95rem', fontSize: '0.85rem', gap: '0.45rem' }}
            title="Export all active applications to CSV"
          >
            {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        )}

        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.825rem' }}
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        )}
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

      {/* Zero Results Empty State (only when not loading and empty) */}
      {!loading && applications.length === 0 ? (
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
              backgroundColor: '#fffbeb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706',
            }}
          >
            <Search size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
              {isInterviewer ? 'No Assigned Applications' : 'No Applications Found'}
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
        /* Applications Table */
        <div className="table-container table-responsive" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 150ms ease' }}>
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
                  {isRecruiter && (
                    <th style={{ padding: '1rem 0.75rem 1rem 1.5rem', width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = isSomeSelected;
                        }}
                        onChange={handleToggleSelectAll}
                        title="Select/Deselect All on Current Page"
                      />
                    </th>
                  )}
                  <th style={{ padding: '1rem 1.25rem' }}>Candidate</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Job Opening</th>
                  <th style={{ padding: '1rem 1.25rem', minWidth: '190px' }}>Stage Progression</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Source</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Applied Date</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => {
                  const isSelected = selectedIds.includes(app.id);
                  const initials = getCandidateInitials(app.candidate_name);
                  const formattedDate = app.applied_date
                    ? new Date(app.applied_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—';

                  return (
                    <tr
                      key={app.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isSelected ? '#fffbeb' : undefined,
                        transition: 'background 150ms ease',
                      }}
                      className="table-row-hover"
                    >
                      {/* Checkbox for Recruiter */}
                      {isRecruiter && (
                        <td style={{ padding: '1rem 0.75rem 1rem 1.5rem' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(app.id)}
                          />
                        </td>
                      )}

                      {/* Candidate: Avatar + Name + Subtitle Role/Email */}
                      <td style={{ padding: '1rem 1.25rem' }}>
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
                              onClick={() => handleOpenDetail(app.id)}
                            >
                              {app.candidate_name}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                              {app.candidate_email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Job Opening */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#0f172a' }}>
                          {app.job_title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {app.department}
                        </div>
                      </td>

                      {/* Stage Progression Stepper Bar */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <StageProgressionBar
                          currentStage={app.current_stage}
                          rejectedFromStage={app.rejected_from_stage}
                        />
                      </td>

                      {/* Source */}
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: '#475569' }}>
                        {app.source}
                      </td>

                      {/* Applied Date */}
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                        {formattedDate}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
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
              padding: '0.85rem 1.5rem',
              backgroundColor: '#f8fafc',
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
              Showing <strong style={{ color: '#0f172a' }}>{startRecord}–{endRecord}</strong> of <strong style={{ color: '#0f172a' }}>{totalCount}</strong> applications
            </div>

            {/* Pagination Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              {/* Page size selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.8rem' }}>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 'var(--radius-sm)',
                    color: '#0f172a',
                    fontSize: '0.8rem',
                    outline: 'none',
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
                <span style={{ fontSize: '0.8rem', color: '#475569' }}>
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

      {/* Bulk Action Results Modal */}
      <BulkActionResultsModal
        isOpen={Boolean(bulkSummaryData)}
        onClose={() => setBulkSummaryData(null)}
        data={bulkSummaryData}
      />

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
