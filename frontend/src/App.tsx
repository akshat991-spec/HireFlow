import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/Layout/AppLayout.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { OpeningsPage } from './pages/OpeningsPage.js';
import { CandidatesPage } from './pages/CandidatesPage.js';
import { AlertsPage } from './pages/AlertsPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="openings" element={<OpeningsPage />} />
        <Route path="candidates" element={<CandidatesPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
