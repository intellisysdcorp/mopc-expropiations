import type {
  MeetingType,
  MeetingPriority,
  MeetingStatus
} from '@prisma/client';

/**
 * Type for creating a new meeting. This is a subset of the Meeting model
 * that only includes the fields needed for meeting creation.
 * Excludes auto-generated fields like id, timestamps, and computed fields.
 */
export interface MeetingCreateData {
  // Core meeting information
  title: string;
  description?: string | null;
  meetingType: MeetingType;
  priority: MeetingPriority;
  status: MeetingStatus;

  // Meeting details
  location?: string | null;
  virtual: boolean;
  meetingUrl?: string | null;
  dialInInfo?: string | null;
  room?: string | null;
  equipment: string[];

  // Scheduling
  scheduledStart: Date;
  scheduledEnd: Date;
  timezone: string;

  // Duration
  plannedDuration: number;

  // Recurrence
  isRecurring: boolean;
  recurrenceRule?: Record<string, any>;
  parentMeetingId?: string | null;

  // Meeting settings
  maxParticipants?: number | null;
  allowGuests: boolean;
  requireApproval: boolean;
  isPrivate: boolean;
  recordMeeting: boolean;
  enableChat: boolean;
  enableScreenShare: boolean;

  // Organizer and chair
  organizerId: string;
  chairId?: string | null;

  // Optional references
  caseId?: string | null;
  agendaTemplateId?: string | null;
  tags?: string | null;

  // Metadata
  metadata: Record<string, any>;
}

/**
 * Type for updating an existing meeting. All fields are optional
 * to allow partial updates.
 */
export interface MeetingUpdateData {
  // Core meeting information
  title?: string;
  description?: string | null;
  meetingType?: MeetingType;
  priority?: MeetingPriority;
  status?: MeetingStatus;

  // Meeting details
  location?: string | null;
  virtual?: boolean;
  meetingUrl?: string | null;
  dialInInfo?: string | null;
  room?: string | null;
  equipment?: Record<string, any> | null;

  // Scheduling
  scheduledStart?: Date;
  scheduledEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  timezone?: string;

  // Duration
  plannedDuration?: number;
  actualDuration?: number;

  // Recurrence
  isRecurring?: boolean;
  recurrenceRule?: Record<string, any> | null;
  parentMeetingId?: string | null;

  // Meeting settings
  maxParticipants?: number | null;
  allowGuests?: boolean;
  requireApproval?: boolean;
  isPrivate?: boolean;
  recordMeeting?: boolean;
  enableChat?: boolean;
  enableScreenShare?: boolean;

  // Organizer and chair
  chairId?: string | null;

  // Optional references
  caseId?: string | null;
  agendaTemplateId?: string | null;
  tags?: string | null;

  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Meeting conflict information for scheduling validation
 */
export interface MeetingConflict {
  type: "PARTICIPANT_UNAVAILABLE" | "ROOM_UNAVAILABLE";
  meetingId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  description: string;
}

/**
 * Meeting validation schema for Zod
 */
export interface MeetingValidationSchema {
  title: string;
  description?: string;
  meetingType: MeetingType;
  priority?: MeetingPriority;
  location?: string;
  virtual?: boolean;
  meetingUrl?: string;
  dialInInfo?: string;
  room?: string;
  equipment?: string[];
  scheduledStart: string; // Date string from request
  scheduledEnd: string;   // Date string from request
  timezone?: string;
  maxParticipants?: number;
  allowGuests?: boolean;
  requireApproval?: boolean;
  isPrivate?: boolean;
  recordMeeting?: boolean;
  enableChat?: boolean;
  enableScreenShare?: boolean;
  chairId?: string;
  caseId?: string;
  agendaTemplateId?: string;
  tags?: string;
  metadata?: Record<string, any>;
  isRecurring?: boolean;
  recurrenceRule?: Record<string, any>;
}