import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    (window as any).showToast = (
      message: string,
      type: 'info' | 'success' | 'error' = 'success',
      duration = 3200
    ) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    };

    return () => {
      delete (window as any).showToast;
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div
      id="toast-container"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: '1.25rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        maxWidth: '420px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        // Green styling for success & info (silent confirmation notifications)
        const bgColor = isError ? '#fef2f2' : '#ecfdf5';
        const borderColor = isError ? '#fecaca' : '#6ee7b7';
        const textColor = isError ? '#991b1b' : '#065f46';
        const iconColor = isError ? '#dc2626' : '#059669';

        return (
          <div
            key={toast.id}
            className="toast-hover-pill"
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              backgroundColor: bgColor,
              border: `1px solid ${borderColor}`,
              color: textColor,
              padding: '0.65rem 1rem',
              borderRadius: '9999px',
              boxShadow: isError
                ? '0 10px 25px -5px rgba(220, 38, 38, 0.15), 0 4px 6px -2px rgba(0,0,0,0.05)'
                : '0 10px 25px -5px rgba(5, 150, 105, 0.18), 0 4px 6px -2px rgba(0,0,0,0.05)',
              fontSize: '0.85rem',
              fontWeight: 600,
              animation: 'toastSlideIn 250ms cubic-bezier(0.16, 1, 0.3, 1)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {isError ? (
              <AlertCircle size={17} color={iconColor} style={{ flexShrink: 0 }} />
            ) : (
              <CheckCircle2 size={17} color={iconColor} style={{ flexShrink: 0 }} />
            )}
            <span style={{ flex: 1, lineHeight: 1.35 }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                color: textColor,
                opacity: 0.6,
                cursor: 'pointer',
                padding: '0.1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'opacity 150ms ease',
              }}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
