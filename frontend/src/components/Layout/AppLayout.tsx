import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';
import { ToastContainer } from '../Common/ToastContainer.js';
import { useAuth } from '../../context/AuthContext.js';
import { Role } from '../../types/index.js';
import { api } from '../../services/api.js';

export const AppLayout: React.FC = () => {
  const { currentUser } = useAuth();
  const [alertsCount, setAlertsCount] = useState<number>(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const fetchAlertsCount = async () => {
    if (currentUser?.role !== Role.RECRUITER) {
      setAlertsCount(0);
      return;
    }
    try {
      const res = await api.get<{ count: number }>('/api/alerts/count', { silent: true });
      if (res.success) {
        setAlertsCount(res.data.count);
      }
    } catch {
      // Non-critical
    }
  };

  useEffect(() => {
    fetchAlertsCount();
    const handleUpdate = () => fetchAlertsCount();
    window.addEventListener('hireflow:alerts-updated', handleUpdate);
    return () => window.removeEventListener('hireflow:alerts-updated', handleUpdate);
  }, [currentUser]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="app-layout">
      <Sidebar
        alertsCount={alertsCount}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />
      <main className="main-wrapper">
        <Header
          alertsCount={alertsCount}
          onToggleSidebar={toggleSidebar}
          isSidebarCollapsed={isSidebarCollapsed}
        />
        <div className="page-container" id="main-view">
          <Outlet />
        </div>
      </main>
      <ToastContainer />
    </div>
  );
};
