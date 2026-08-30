import React from 'react';
import { CheckCircle2, XCircle, X, ArrowRight, AlertTriangle } from 'lucide-react';
import { Stage } from '../../types/index.js';

export interface BulkResultItem {
  applicationId: string;
  candidateName: string;
  candidateEmail?: string;
  success: boolean;
  status: 'SUCCESS' | 'REFUSED';
  oldStage?: Stage;
  targetStage?: Stage;
  reason?: string;
  message?: string;
}

export interface BulkActionSummaryData {
  actionType: 'ADVANCE' | 'REJECT';
  total: number;
  successful: number;
  refused: number;
  results: BulkResultItem[];
}

interface BulkActionResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: BulkActionSummaryData | null;
}

export const BulkActionResultsModal: React.FC<BulkActionResultsModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!isOpen || !data) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
          maxWidth: '620px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              Bulk {data.actionType === 'ADVANCE' ? 'Advance' : 'Reject'} Results
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Processed {data.total} application(s) independently
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.35rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Summary Metric Badges */}
        <div
          style={{
            padding: '1rem 1.5rem',
            backgroundColor: 'var(--bg-main)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            gap: '1rem',
          }}
        >
          <div
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <CheckCircle2 size={24} style={{ color: 'var(--success)' }} />
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)' }}>
                {data.successful}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Succeeded
              </div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              backgroundColor: data.refused > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${data.refused > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <XCircle size={24} style={{ color: data.refused > 0 ? 'var(--danger)' : 'var(--text-muted)' }} />
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: data.refused > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                {data.refused}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Refused
              </div>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div
          style={{
            padding: '1rem 1.5rem',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {data.results.map((item, index) => {
            const isSuccess = item.success;
            return (
              <div
                key={item.applicationId || index}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-main)',
                  border: `1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {isSuccess ? (
                    <CheckCircle2 size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  ) : (
                    <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {item.candidateName}
                    </div>
                    {item.candidateEmail && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {item.candidateEmail}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  {isSuccess ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--success)' }}>
                      <span style={{ fontWeight: 600 }}>{item.oldStage}</span>
                      <ArrowRight size={13} />
                      <span style={{ fontWeight: 700 }}>{item.targetStage}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: '#fca5a5', maxWidth: '280px', textAlign: 'right' }}>
                      {item.reason}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <button className="btn btn-primary" onClick={onClose} style={{ padding: '0.5rem 1.25rem' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
