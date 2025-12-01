// Prisma types - only used in server components
import type {
  User,
  Case,
  Department,
  Role,
  Document,
  Activity,
  Meeting,
  MeetingParticipant,
  MeetingAgendaItem,
  MeetingDecision,
  MeetingCommitment,
  MeetingDocument,
  MeetingMinutes,
  Observation,
  ObservationResponse,
} from '@prisma/client';

// Export Prisma types as server-only types
export type {
  User as PrismaUser,
  Case as PrismaCase,
  Department as PrismaDepartment,
  Role as PrismaRole,
  Document as PrismaDocument,
  Activity as PrismaActivity,
  Meeting as PrismaMeeting,
  MeetingParticipant as PrismaMeetingParticipant,
  MeetingAgendaItem as PrismaMeetingAgendaItem,
  MeetingDecision as PrismaMeetingDecision,
  MeetingCommitment as PrismaMeetingCommitment,
  MeetingDocument as PrismaMeetingDocument,
  MeetingMinutes as PrismaMeetingMinutes,
  MeetingTemplate as PrismaMeetingTemplate,
  MeetingNotification as PrismaMeetingNotification,
  Observation as PrismaObservation,
  ObservationResponse as PrismaObservationResponse
} from '@prisma/client';

// Server-only types that extend Prisma types
export interface UserWithRelations extends User {
  department: Department;
  role: Role;
}

export interface CaseWithRelations extends Case {
  department: Department;
  createdBy: User;
  assignedTo?: User;
  supervisedBy?: User;
  documents: Document[];
  _count: {
    documents: number;
    activities: number;
    histories: number;
  };
}

export interface DepartmentWithChildren extends Department {
  children: Department[];
  _count: {
    users: number;
    cases: number;
  };
}

export interface ActivityWithUser extends Activity {
  user: User;
}

export interface CaseFilters {
  status?: string;
  priority?: string;
  departmentId?: string;
  assignedToId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
}

export interface CaseStats {
  total: number;
  active: number;
  completed: number;
  pending: number;
  overdue: number;
  avgDuration: number;
}

export interface UserPermissions {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canAssign: boolean;
  canSupervise: boolean;
  canExport: boolean;
  canManageUsers: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  permissions: UserPermissions;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface CaseStage {
  id: string;
  name: string;
  description: string;
  order: number;
  duration: number; // in days
  requiredDocuments: string[];
  permissions: string[];
}

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  createdAt: Date;
  entityType?: string;
  entityId?: string;
}

export interface DashboardStats {
  totalCases: number;
  activeCases: number;
  completedCases: number;
  pendingTasks: number;
  overdueCases: number;
  recentActivities: ActivityWithUser[];
  casesByDepartment: Array<{
    department: string;
    count: number;
  }>;
  casesByStatus: Array<{
    status: string;
    count: number;
  }>;
}

export interface FileUpload {
  file: File;
  title: string;
  description?: string;
  tags?: string[];
  isPublic: boolean;
}

export interface SearchFilters {
  query?: string;
  entityType?: 'case' | 'user' | 'document' | 'department';
  departmentId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  filters: CaseFilters;
  fields: string[];
  includeDocuments: boolean;
  includeHistory: boolean;
}

export interface SystemConfig {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  category: string;
  description?: string;
}

// Meeting-related server types
export interface MeetingWithRelations extends Meeting {
  organizer: User;
  chair?: User;
  case?: Case;
  participants: MeetingParticipant[];
  agendaItems: MeetingAgendaItem[];
  decisions: MeetingDecision[];
  commitments: MeetingCommitment[];
  documents: MeetingDocument[];
  minutes: MeetingMinutes[];
  _count: {
    participants: number;
    agendaItems: number;
    decisions: number;
    commitments: number;
    documents: number;
  };
}

export interface MeetingParticipantWithUser extends MeetingParticipant {
  user?: User;
}

export interface MeetingAgendaItemWithRelations extends MeetingAgendaItem {
  documents: MeetingDocument[];
  decision?: MeetingDecision;
}

export interface MeetingDecisionWithRelations extends MeetingDecision {
  agendaItem?: MeetingAgendaItem;
  proposer: User;
  reviewer?: User;
  approver?: User;
  commitments: MeetingCommitment[];
}

export interface MeetingCommitmentWithRelations extends MeetingCommitment {
  meeting: Meeting;
  decision?: MeetingDecision;
  assignee: User;
  assigner: User;
  reviewer?: User;
  approver?: User;
  progressUpdates: Array<{
    id: string;
    progressPercentage: number;
    notes?: string;
    updatedBy: string;
    updatedAt: Date;
  }>;
}

export interface MeetingFilters {
  meetingType?: string;
  status?: string;
  priority?: string;
  departmentId?: string;
  organizerId?: string;
  chairId?: string;
  caseId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
  virtual?: boolean;
  isRecurring?: boolean;
}

export interface MeetingStats {
  total: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  upcoming: number;
  thisWeek: number;
  thisMonth: number;
  avgDuration: number;
  effectivenessScore: number;
}

// Re-export observation types
export type {
  ObservationWithRelations,
  ObservationResponseWithUser,
  CreateObservationRequest,
  CreateObservationResponseRequest,
  ObservationFilters,
  ObservationStats,
  ObservationActivity
} from './observation';

export type { ObservationPriority, ObservationStatus } from './observation';

// Re-export meeting types
export type {
  MeetingCreateData,
  MeetingUpdateData,
  MeetingConflict,
  MeetingValidationSchema
} from './meeting';

// Re-export notification types
export type {
  NotificationCreateData,
  NotificationUpdateData,
  CreateNotificationRequest,
  NotificationFilters,
  NotificationStats,
  NotificationWithRelations,
  NotificationDeliveryConfig,
  NotificationTemplateVariables,
  NotificationCreateResponse,
  UserNotificationPreference,
  UpdateUserNotificationPreference,
  CreateUserNotificationPreference,
  CreateNotificationTemplateRequest,
  NotificationTemplateResponse,
  NotificationTemplateStatistics,
  UpdateNotificationTemplateRequest,
  NotificationTemplateFilters,
  TemplateExtraction
} from './notification';