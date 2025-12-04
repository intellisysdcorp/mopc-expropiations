// Client-safe types - no Prisma imports

export interface User {
  id: string;
  email: string;
  name: string;
  departmentId: string;
  roleId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  parentId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Role {
  id: string;
  name: string;
  permissions: Record<string, boolean>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Case {
  id: string;
  fileNumber: string;
  title: string;
  description?: string;
  currentStage: string;
  priority: string;
  status: string;
  startDate: Date;
  expectedEndDate?: Date;
  actualEndDate?: Date;
  isDraft?: boolean;
  propertyAddress: string;
  propertyCity: string;
  propertyProvince: string;
  propertyDescription?: string;
  propertyCoordinates?: string;
  propertyArea?: number;
  propertyType?: string;
  ownerName: string;
  ownerIdentification?: string;
  ownerContact?: string;
  ownerEmail?: string;
  ownerAddress?: string;
  ownerType?: string;
  estimatedValue?: number;
  actualValue?: number;
  appraisalValue?: number;
  compensationAmount?: number;
  currency: string;
  expropriationDecree?: string;
  judicialCaseNumber?: string;
  legalStatus?: string;
  progressPercentage: number;
  departmentId: string;
  createdById: string;
  assignedToId?: string;
  supervisedById?: string;
  createdAt: Date;
  updatedAt: Date;
  department?: {
    id: string;
    name: string;
    code: string;
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  supervisedBy?: {
    id: string;
    name: string;
    email: string;
  };
  activities?: Activity[];
  _count?: {
    documents: number;
    histories: number;
    activities: number;
  };
}

export interface Document {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  originalFileName?: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileHash?: string;
  documentType: string;
  category: string;
  status: string;
  securityLevel: string;
  version: number;
  isLatest: boolean;
  isDraft: boolean;
  isPublic: boolean;
  isEncrypted: boolean;
  tags?: string;
  metadata?: any;
  customFields?: any;
  retentionPeriod?: number;
  expiresAt?: Date;
  contentText?: string;
  isIndexed?: boolean;
  indexedAt?: Date;
  downloadCount?: number;
  caseId?: string;
  uploadedById: string;
  createdAt: Date;
  updatedAt: Date;
  uploadedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    fullName?: string;
  };
  case?: {
    id: string;
    fileNumber: string;
    title: string;
  };
  tagsRelations?: Array<{
    id: string;
    tag: string;
    color?: string;
  }>;
  _count?: {
    versions: number;
    history: number;
    signatures: number;
  };
  fileSizeFormatted?: string;
}

// Document form types
export interface DocumentFormData {
  title: string;
  description?: string;
  documentType: string;
  category: string;
  securityLevel: string;
  caseId?: string;
  tags?: string;
  metadata?: any;
  customFields?: any;
  retentionPeriod?: number;
  expiresAt?: string;
}

// Document search and filter types
export interface DocumentSearchInput {
  query?: string;
  documentType?: string;
  category?: string;
  status?: string;
  securityLevel?: string;
  caseId?: string;
  uploadedById?: string;
  tags?: string;
  sortBy?: string;
  sortOrder?: string;
  page: number;
  limit: number;
  dateFrom?: Date;
  dateTo?: Date;
}

// Document version interface
export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  title: string;
  description?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileHash?: string;
  changeDescription?: string;
  isDraft: boolean;
  createdById: string;
  createdAt: Date;
  uploadedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    fullName?: string;
  };
  fileSizeFormatted?: string;
}

// Document history interface
export interface DocumentHistory {
  id: string;
  documentId: string;
  action: string;
  description?: string;
  userId: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  notes?: string;
  fileSize?: number;
  fileName?: string;
  filePath?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  createdAt: Date;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    fullName?: string;
  };
}

export interface Activity {
  id: string;
  action: string;
  description?: string;
  entityType: string;
  entityId: string;
  userId: string;
  createdAt: Date;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    name: string;
    email: string;
  };
}

// Client-safe extended types
export interface UserWithDepartment extends User {
  department: Department;
  role: Role;
}

// User type returned by API endpoints (includes role and extended fields)
export interface DepartmentUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  phone?: string;
  isActive: boolean;
  isSuspended: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  role: {
    id: string;
    name: string;
    description: string;
  };
  _count?: {
    createdCases: number;
    assignedCases: number;
    supervisedCases: number;
    activities: number;
    documents: number;
  };
  totalCases?: number;
}

// Helper type for users in forms (with computed fields)
export interface FormUser extends DepartmentUser {
  name: string; // Computed from firstName + lastName
}

export interface DepartmentWithUsers extends Department {
  _count: {
    users: number;
    cases: number;
  };
}

export interface ActivityWithUser extends Activity {
  user: User;
}

// Search and filter types
export interface CaseSearchInput {
  query?: string;
  status?: string;
  priority?: string;
  currentStage?: string;
  departmentId?: string;
  assignedToId?: string;
  createdBy?: string;
  startDateFrom?: Date;
  startDateTo?: Date;
  expectedEndDateFrom?: Date;
  expectedEndDateTo?: Date;
  ownerName?: string;
  propertyAddress?: string;
  fileNumber?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: string;
}