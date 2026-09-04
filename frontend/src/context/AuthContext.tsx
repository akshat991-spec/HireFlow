import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { UserPublic, Role } from '../types/index.js';

interface AuthContextType {
  currentUser: UserPublic | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: Role) => Promise<void>;
  loginAs: (email: string) => Promise<void>; // quick-switch to a demo account
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>; // re-fetches /api/auth/me after role changes
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  login: async () => {},
  register: async () => {},
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
    description: 'Full pipeline authority, manage openings & panels',
  },
  {
    name: 'Alex Rivera',
    email: 'interviewer@hireflow.test',
    role: Role.INTERVIEWER,
    badge: 'Interviewer 1',
    description: 'Evaluate candidates & leave feedback',
  },
  {
    name: 'Elena Rostova',
    email: 'interviewer2@hireflow.test',
    role: Role.INTERVIEWER,
    badge: 'Interviewer 2',
    description: 'Technical evaluation panelist',
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
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await api.post<{ user: UserPublic; token: string }>('/api/auth/login', {
      email,
      password,
    });
    if (res.success && res.data) {
      localStorage.setItem('hireflow_token', res.data.token);
      setCurrentUser(res.data.user);
      (window as any).showToast?.(`Welcome back, ${res.data.user.name}!`, 'success');
      window.dispatchEvent(new CustomEvent('hireflow:alerts-updated'));
    }
  };

  const register = async (name: string, email: string, password: string, role: Role) => {
    const res = await api.post<{ user: UserPublic; token: string }>('/api/auth/register', {
      name,
      email,
      password,
      role,
    });
    if (res.success && res.data) {
      localStorage.setItem('hireflow_token', res.data.token);
      setCurrentUser(res.data.user);
      const roleMsg = role === Role.INTERVIEWER
        ? 'Assigned to sample candidates to get started!'
        : 'Access to all openings & candidate records enabled!';
      (window as any).showToast?.(`Account registered! ${roleMsg}`, 'success');
      window.dispatchEvent(new CustomEvent('hireflow:alerts-updated'));
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
    <AuthContext.Provider value={{ currentUser, loading, login, register, loginAs, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
