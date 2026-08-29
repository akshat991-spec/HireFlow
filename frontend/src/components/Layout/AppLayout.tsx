import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';
import { ToastContainer } from '../Common/ToastContainer.js';

export const AppLayout: React.FC = () => {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-wrapper">
        <Header />
        <div className="page-container" id="main-view">
          <Outlet />
        </div>
      </main>
      <ToastContainer />
    </div>
  );
};
