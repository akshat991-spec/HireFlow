export enum Role {
  RECRUITER = 'recruiter',
  INTERVIEWER = 'interviewer',
}

export enum Stage {
  APPLIED = 'Applied',
  SCREENING = 'Screening',
  INTERVIEW = 'Interview',
  OFFER = 'Offer',
  HIRED = 'Hired',
}

export enum OpeningStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export interface User {
  id: string;
  email: string;
  name: string;
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
