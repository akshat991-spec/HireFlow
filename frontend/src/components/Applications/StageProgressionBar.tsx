import React from 'react';
import { Stage } from '../../types/index.js';

interface StageProgressionBarProps {
  currentStage: Stage;
  rejectedFromStage?: Stage | null;
}

const STAGES = [
  Stage.APPLIED,
  Stage.SCREENING,
  Stage.INTERVIEW,
  Stage.OFFER,
  Stage.HIRED,
];

const STAGE_LABELS: Record<Stage, string> = {
  [Stage.APPLIED]: 'Applied',
  [Stage.SCREENING]: 'Screening',
  [Stage.INTERVIEW]: 'Interview',
  [Stage.OFFER]: 'Offer Extended',
  [Stage.HIRED]: 'Hired',
  [Stage.REJECTED]: 'Rejected',
};

const STAGE_COLORS: Record<Stage, { line: string; glow: string; text: string }> = {
  [Stage.APPLIED]: { line: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', text: '#2563eb' },
  [Stage.SCREENING]: { line: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)', text: '#4f46e5' },
  [Stage.INTERVIEW]: { line: '#0284c7', glow: 'rgba(2, 132, 199, 0.4)', text: '#0369a1' },
  [Stage.OFFER]: { line: '#d97706', glow: 'rgba(217, 119, 6, 0.4)', text: '#b45309' },
  [Stage.HIRED]: { line: '#059669', glow: 'rgba(5, 150, 105, 0.4)', text: '#047857' },
  [Stage.REJECTED]: { line: '#dc2626', glow: 'rgba(220, 38, 38, 0.4)', text: '#b91c1c' },
};

export const StageProgressionBar: React.FC<StageProgressionBarProps> = ({
  currentStage,
  rejectedFromStage,
}) => {
  if (currentStage === Stage.REJECTED) {
    const originIdx = rejectedFromStage ? STAGES.indexOf(rejectedFromStage) : 0;
    const activeColor = STAGE_COLORS[Stage.REJECTED];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '150px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', position: 'relative' }}>
          {STAGES.map((s, idx) => {
            const isPassed = idx <= originIdx;
            return (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  backgroundColor: isPassed ? '#fca5a5' : '#e2e8f0',
                  transition: 'all 200ms ease',
                }}
              />
            );
          })}
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono, monospace)',
            color: activeColor.text,
            fontWeight: 600,
          }}
        >
          Rejected {rejectedFromStage ? `(from ${rejectedFromStage})` : ''}
        </span>
      </div>
    );
  }

  const currentIndex = STAGES.indexOf(currentStage);
  const color = STAGE_COLORS[currentStage] || STAGE_COLORS[Stage.APPLIED];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '150px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', position: 'relative' }}>
        {STAGES.map((s, idx) => {
          const isActive = idx === currentIndex;
          const isPassed = idx <= currentIndex;

          return (
            <div
              key={s}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                backgroundColor: isPassed ? color.line : '#e2e8f0',
                position: 'relative',
                transition: 'all 200ms ease',
              }}
            >
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    right: '-3px',
                    top: '-3px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    border: `2px solid ${color.line}`,
                    boxShadow: `0 0 6px ${color.glow}`,
                    zIndex: 2,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <span
        style={{
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono, monospace)',
          color: color.text,
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}
      >
        {STAGE_LABELS[currentStage]}
      </span>
    </div>
  );
};
