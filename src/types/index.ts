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

export const STAGE_ORDER: readonly Stage[] = [
  Stage.APPLIED,
  Stage.SCREENING,
  Stage.INTERVIEW,
  Stage.OFFER,
  Stage.HIRED,
] as const;

export enum OpeningStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum EventType {
  CREATED = 'created',
  STAGE_CHANGE = 'stage_change',
  REJECTED = 'rejected',
  REINSTATED = 'reinstated',
  FEEDBACK = 'feedback',
  INTERVIEWER_ASSIGNED = 'interviewer_assigned',
  INTERVIEWER_REMOVED = 'interviewer_removed',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: Date;
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
  stage_entered_at: Date;
  is_rejected: boolean;
  rejected_from_stage?: Stage | null;
  created_at: Date;
  updated_at: Date;
}

export interface TimelineEvent {
  id: string;
  application_id: string;
  event_type: EventType;
  actor_id?: string | null;
  old_stage?: Stage | null;
  new_stage?: Stage | null;
  note_content?: string | null;
  created_at: Date;
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
