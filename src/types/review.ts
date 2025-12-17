import { Prisma } from '@/prisma/client';

// Types based on Prisma schema
export type ReviewType = "INTERNAL_CONTROL" | "TECHNICAL_ANALYSIS" | "LEGAL_REVIEW" | "FINANCIAL_REVIEW" | "SUPERVISORY_REVIEW" | "QUALITY_ASSURANCE";

export interface CreateAssignmentInput {
  caseId: string;
  reviewType: ReviewType;
  assignedTo: string;
  assignedBy: string;
  priority?: string;
  instructions?: string ;
  dueDate?: Date;
  estimatedTime?: number;
  parallelWith?: Prisma.InputJsonValue;
  dependsOn?: Prisma.InputJsonValue;
}

export interface CreateReviewInput {
  assignmentId: string;
  findings: string;
  recommendations?: string;
  conclusion: string;
  rating?: number;
  decision: 'APPROVED' | 'REJECTED' | 'CONDITIONAL' | 'NEEDS_REVISION';
  attachments?: string[];
}

// Type for creating a review payload for Prisma
export interface ReviewCreatePayload {
  assignmentId: string;
  reviewerId: string;
  findings: string;
  conclusion: string;
  decision: 'APPROVED' | 'REJECTED' | 'CONDITIONAL' | 'NEEDS_REVISION';
  ipAddress: string;
  recommendations?: string | null;
  rating?: number | null;
  attachments?: Prisma.InputJsonValue;
}