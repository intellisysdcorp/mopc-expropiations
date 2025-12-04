import type {
  ActivityType,
  Observation as PrismaObservation,
  ObservationResponse as PrismaObservationResponse,
  ObservationPriority,
  ObservationStatus,
  Prisma
} from '@prisma/client';

// Re-export Prisma enums
export type { ObservationPriority, ObservationStatus };

// Define response type as it's a string in the schema
export type ObservationResponseType = 'ACKNOWLEDGMENT' | 'CLARIFICATION' | 'ACTION' | 'RESOLUTION';

// Re-export Prisma types as server-only types
export type Observation = PrismaObservation;
export type ObservationResponse = PrismaObservationResponse;

// Request/response types for API endpoints
export interface CreateObservationRequest {
  caseId: string;
  stage?: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  priority: ObservationPriority;
  assignedTo?: string;
  deadline?: string;
  parentObservationId?: string;
  responseTo?: string;
  tags?: string;
}

export interface CreateObservationResponseRequest {
  observationId: string;
  response: string;
  responseType: ObservationResponseType;
  attachments?: Prisma.InputJsonValue;
}

export interface ObservationWithRelations extends PrismaObservation {
  case: {
    id: string;
    fileNumber: string;
    title: string;
    currentStage: string;
  };
  observer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  parentObservation?: {
    id: string;
    title: string;
  };
  childObservations: Array<{
    id: string;
    title: string;
    status: ObservationStatus;
    createdAt: Date;
  }>;
  responses: ObservationResponseWithUser[];
  _count: {
    childObservations: number;
    responses: number;
  };
}

export interface ObservationResponseWithUser extends PrismaObservationResponse {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  observation: {
    id: string;
    title: string;
    observer: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

export interface ObservationFilters {
  caseId?: string;
  stage?: string;
  priority?: ObservationPriority;
  status?: ObservationStatus;
  assignedTo?: string;
  observedBy?: string;
  parentObservationId?: string;
}

export interface ObservationStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  overdue: number;
  byPriority: Record<ObservationPriority, number>;
  byCategory: Record<string, number>;
  avgResponseTime: number;
}

export interface ObservationActivity {
  action: ActivityType;
  entityType: string;
  entityId: string;
  description: string;
  userId: string;
  caseId?: string;
  metadata?: {
    observationId?: string;
    priority?: ObservationPriority;
    category?: string;
    responseType?: string;
  };
}