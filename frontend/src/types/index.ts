export enum Role {
  RECRUITER = 'RECRUITER',
  INTERVIEWER = 'INTERVIEWER',
}

export enum OpeningStatus {
  OPEN = 'OPEN',
  ARCHIVED = 'ARCHIVED',
}

export enum Stage {
  APPLIED = 'APPLIED',
  SCREENING = 'SCREENING',
  INTERVIEW = 'INTERVIEW',
  OFFER = 'OFFER',
  HIRED = 'HIRED',
  REJECTED = 'REJECTED',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface HealthCheckData {
  status: string;
  environment: string;
  database: string;
  uptime: number;
  timestamp: string;
}

export interface DashboardMetrics {
  openPositions: number;
  activeApplications: number;
  interviewsThisWeek: number;
  hiresThisMonth: number;
  byOpening: unknown[];
  byStage: unknown[];
  weeklyTrend: unknown[];
}
