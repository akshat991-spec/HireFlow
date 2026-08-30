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

export interface JobOpening {
  id: string;
  title: string;
  department: string;
  description: string;
  status: OpeningStatus;
  created_at: string;
  updated_at: string;
  application_count?: number;
  active_count?: number;
  applications?: Application[];
}

export interface Application {
  id: string;
  job_opening_id: string;
  candidate_name: string;
  candidate_email: string;
  source: string;
  notes?: string | null;
  current_stage: Stage;
  applied_date: string;
  stage_entered_at: string;
  rejected_from_stage?: Stage | null;
  created_at: string;
  updated_at: string;
  job_title?: string;
  department?: string;
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
