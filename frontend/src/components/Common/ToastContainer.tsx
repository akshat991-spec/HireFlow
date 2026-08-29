import React, { useState, useEffect } from 'react';

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    (window as any).showToast = (message: string, type: 'info' | 'success' | 'error' = 'info', duration = 3500) => {
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

  return (
    <div id="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
};
