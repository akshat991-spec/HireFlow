import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.js';
import { AuthPage } from './pages/AuthPage.js';
import { AppLayout } from './components/Layout/AppLayout.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { OpeningsPage } from './pages/OpeningsPage.js';
import { CandidatesPage } from './pages/CandidatesPage.js';
import { AlertsPage } from './pages/AlertsPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { Role } from './types/index.js';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          gap: '1rem',
          color: '#64748b',
        }}
      >
        <Loader2 size={36} className="animate-spin" color="#0066ff" />
        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Loading HireFlow...</span>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="openings" element={<OpeningsPage />} />
        <Route path="candidates" element={<CandidatesPage />} />
        <Route
          path="alerts"
          element={currentUser?.role === Role.RECRUITER ? <AlertsPage /> : <Navigate to="/dashboard" replace />}
        />
        <Route path="login" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
