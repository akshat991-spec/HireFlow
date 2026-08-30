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

export const PROGRESSION_STAGES: readonly Stage[] = [
  Stage.APPLIED,
  Stage.SCREENING,
  Stage.INTERVIEW,
  Stage.OFFER,
  Stage.HIRED,
] as const;

export enum EventType {
  APPLICATION_CREATED = 'APPLICATION_CREATED',
  STAGE_CHANGE = 'STAGE_CHANGE',
  REJECTION = 'REJECTION',
  REINSTATEMENT = 'REINSTATEMENT',
  INTERVIEWER_FEEDBACK = 'INTERVIEWER_FEEDBACK',
  INTERVIEWER_ASSIGNED = 'INTERVIEWER_ASSIGNED',
  INTERVIEWER_REMOVED = 'INTERVIEWER_REMOVED',
}

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: Date;
  updated_at: Date;
}

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at?: Date;
}

export interface AuthUserPayload {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface JobOpening {
  id: string;
  title: string;
  department: string;
  description: string;
  status: OpeningStatus;
  created_at: Date;
  updated_at: Date;
}

export interface Application {
  id: string;
  job_opening_id: string;
  candidate_name: string;
  candidate_email: string;
  source: string;
  notes?: string | null;
  current_stage: Stage;
  applied_date: Date;
  stage_entered_at: Date;
  rejected_from_stage?: Stage | null;
  created_at: Date;
  updated_at: Date;
  job_title?: string;
  department?: string;
  interviewers?: UserPublic[];
}

export interface ApplicationInterviewer {
  application_id: string;
  user_id: string;
  assigned_at: Date;
}

export interface TimelineEvent {
  id: string;
  application_id: string;
  event_type: EventType;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_role?: Role | null;
  old_stage?: Stage | null;
  new_stage?: Stage | null;
  note_content?: string | null;
  created_at: Date;
}

export interface StalledAlertDismissal {
  id: string;
  application_id: string;
  user_id: string;
  stage: Stage;
  stage_entered_at: Date;
  dismissed_at: Date;
}

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export type StandardResponse<T = unknown> = ApiResponse<T> | ApiErrorResponse;
