import React, { useState } from 'react';
import {
  Briefcase,
  Users,
  Lock,
  Mail,
  User,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuth, DEMO_ACCOUNTS } from '../context/AuthContext.js';
import { Role } from '../types/index.js';

export const AuthPage: React.FC = () => {
  const { login, register, loginAs } = useAuth();

  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>(Role.RECRUITER);

  // States
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'LOGIN') {
        if (!email.trim() || !password) {
          throw new Error('Please enter both your email address and password');
        }
        await login(email.trim(), password);
      } else {
        if (!name.trim()) {
          throw new Error('Please enter your full name');
        }
        if (!email.trim()) {
          throw new Error('Please enter your email address');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }
        await register(name.trim(), email.trim(), password, selectedRole);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setError(null);
    setSubmitting(true);
    try {
      await loginAs(demoEmail);
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        padding: '2rem 1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {/* Header Branding */}
        <div
          style={{
            padding: '2.25rem 2rem 1.5rem 2rem',
            textAlign: 'center',
            borderBottom: '1px solid #f1f5f9',
            backgroundColor: '#ffffff',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0066ff 0%, #0044cc 100%)',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '1.25rem',
              marginBottom: '0.85rem',
              boxShadow: '0 4px 12px rgba(0, 102, 255, 0.3)',
            }}
          >
            HF
          </div>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: '#0f172a',
              margin: '0 0 0.35rem 0',
            }}
          >
            Hire<span style={{ color: '#0066ff' }}>Flow</span>
          </h1>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
            Hiring Workflow & Candidate Journey Platform
          </p>
        </div>

        {/* Tab Toggle (Sign In vs Register) */}
        <div
          style={{
            display: 'flex',
            padding: '0.5rem 1.5rem 0 1.5rem',
            backgroundColor: '#ffffff',
            gap: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('LOGIN');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.92rem',
              color: mode === 'LOGIN' ? '#0066ff' : '#64748b',
              borderBottom: `2.5px solid ${mode === 'LOGIN' ? '#0066ff' : 'transparent'}`,
              transition: 'all 0.2s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('REGISTER');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.92rem',
              color: mode === 'REGISTER' ? '#0066ff' : '#64748b',
              borderBottom: `2.5px solid ${mode === 'REGISTER' ? '#0066ff' : 'transparent'}`,
              transition: 'all 0.2s ease',
            }}
          >
            Create Account
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '1.75rem 2rem 2.25rem 2rem' }}>
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {/* Registration Name Field */}
            {mode === 'REGISTER' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.35rem',
                  }}
                >
                  Full Name
                </label>
                <div style={{ position: 'relative' }}>
                  <User
                    size={16}
                    style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                  />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Morgan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem 0.65rem 2.35rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '0.35rem',
                }}
              >
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                />
                <input
                  type="email"
                  required
                  placeholder={mode === 'LOGIN' ? 'recruiter@hireflow.test' : 'alex@company.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem 0.65rem 2.35rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '0.35rem',
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                />
                <input
                  type="password"
                  required
                  placeholder={mode === 'LOGIN' ? '••••••••' : 'Min 6 characters'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem 0.65rem 2.35rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Role Selection (Registration only) */}
            {mode === 'REGISTER' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.5rem',
                  }}
                >
                  Select Your Account Role
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {/* Recruiter Option Card */}
                  <div
                    onClick={() => setSelectedRole(Role.RECRUITER)}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '10px',
                      border: `2px solid ${selectedRole === Role.RECRUITER ? '#0066ff' : '#e2e8f0'}`,
                      backgroundColor: selectedRole === Role.RECRUITER ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Briefcase size={16} color={selectedRole === Role.RECRUITER ? '#0066ff' : '#64748b'} />
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: selectedRole === Role.RECRUITER ? '#0066ff' : '#0f172a' }}>
                          Recruiter
                        </span>
                      </div>
                      {selectedRole === Role.RECRUITER && <CheckCircle2 size={16} color="#0066ff" />}
                    </div>
                    <p style={{ fontSize: '0.74rem', color: '#64748b', margin: 0, lineHeight: 1.35 }}>
                      Full hiring authority, create openings, advance candidates & manage alerts.
                    </p>
                  </div>

                  {/* Interviewer Option Card */}
                  <div
                    onClick={() => setSelectedRole(Role.INTERVIEWER)}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '10px',
                      border: `2px solid ${selectedRole === Role.INTERVIEWER ? '#0066ff' : '#e2e8f0'}`,
                      backgroundColor: selectedRole === Role.INTERVIEWER ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Users size={16} color={selectedRole === Role.INTERVIEWER ? '#0066ff' : '#64748b'} />
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: selectedRole === Role.INTERVIEWER ? '#0066ff' : '#0f172a' }}>
                          Interviewer
                        </span>
                      </div>
                      {selectedRole === Role.INTERVIEWER && <CheckCircle2 size={16} color="#0066ff" />}
                    </div>
                    <p style={{ fontSize: '0.74rem', color: '#64748b', margin: 0, lineHeight: 1.35 }}>
                      Review assigned candidates, conduct panel interviews & submit feedback.
                    </p>
                  </div>
                </div>

                {/* Pre-population notice */}
                <div
                  style={{
                    marginTop: '0.65rem',
                    padding: '0.55rem 0.75rem',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    fontSize: '0.76rem',
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <Sparkles size={14} style={{ flexShrink: 0 }} />
                  <span>
                    {selectedRole === Role.INTERVIEWER
                      ? '3 active candidates will be auto-assigned to your panel so your view is pre-populated!'
                      : 'You will immediately see all active job openings, candidate pipelines, and metrics.'}
                  </span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#0066ff',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 102, 255, 0.25)',
                transition: 'all 0.15s ease',
                marginTop: '0.5rem',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>{mode === 'LOGIN' ? 'Signing in...' : 'Creating account...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'LOGIN' ? 'Sign In to Workspace' : 'Create Account & Start'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* 1-Click Quick Demo Login Section */}
          <div style={{ marginTop: '1.75rem', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
            <div
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#64748b',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem',
                textAlign: 'center',
              }}
            >
              Or Instant 1-Click Demo Accounts
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoLogin(acc.email)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover-bg"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: acc.role === Role.RECRUITER ? '#eff6ff' : '#f0fdf4',
                        color: acc.role === Role.RECRUITER ? '#0066ff' : '#16a34a',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {acc.role === Role.RECRUITER ? 'R' : 'I'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#0f172a' }}>
                        {acc.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {acc.email}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '999px',
                      backgroundColor: acc.role === Role.RECRUITER ? '#dbeafe' : '#dcfce7',
                      color: acc.role === Role.RECRUITER ? '#1d4ed8' : '#15803d',
                    }}
                  >
                    {acc.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
