import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { UserPublic, Role } from '../types/index.js';

interface AuthContextType {
  currentUser: UserPublic | null;
  loading: boolean;
  loginAs: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  loginAs: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export const DEMO_ACCOUNTS = [
  {
    name: 'Sarah Connor',
    email: 'recruiter@hireflow.test',
    role: Role.RECRUITER,
    badge: 'Recruiter',
  },
  {
    name: 'Alex Rivera',
    email: 'interviewer@hireflow.test',
    role: Role.INTERVIEWER,
    badge: 'Interviewer 1',
  },
  {
    name: 'Elena Rostova',
    email: 'interviewer2@hireflow.test',
    role: Role.INTERVIEWER,
    badge: 'Interviewer 2',
  },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await api.get<UserPublic>('/api/auth/me', { silent: true });
      if (res.success && res.data) {
        setCurrentUser(res.data);
      } else {
        // Automatically login as Sarah Recruiter by default
        await loginAs('recruiter@hireflow.test');
      }
    } catch {
      await loginAs('recruiter@hireflow.test');
    } finally {
      setLoading(false);
    }
  };

  const loginAs = async (email: string) => {
    try {
      const res = await api.post<{ user: UserPublic; token: string }>('/api/auth/login', {
        email,
        password: 'password123',
      });
      if (res.success && res.data) {
        localStorage.setItem('hireflow_token', res.data.token);
        setCurrentUser(res.data.user);
        (window as any).showToast?.(`Switched to ${res.data.user.name} (${res.data.user.role})`, 'success');
        window.dispatchEvent(new CustomEvent('hireflow:alerts-updated'));
      }
    } catch (err: any) {
      console.error('Failed to login:', err);
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout', {}, { silent: true });
    } catch {
      // Ignore
    } finally {
      localStorage.removeItem('hireflow_token');
      setCurrentUser(null);
      (window as any).showToast?.('Logged out successfully', 'info');
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, loading, loginAs, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
