import { prisma } from './prisma';
import { DocumentType, DocumentCategory, DocumentStatus, DocumentSecurityLevel } from '@prisma/client';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { DocumentFormData } from '@/types/client';
import { logger } from '@/lib/logger';

// File upload configuration
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
  // Text files
  'text/plain',
  'text/csv',
  'text/html',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
];

// Storage configuration
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'documents');

// Document type configurations based on case stages
export const STAGE_DOCUMENT_TYPES = {
  'RECEPCION_SOLICITUD': ['LEGAL', 'ADMINISTRATIVE', 'CORRESPONDENCE'],
  'VALIDACION_PRELIMINAR': ['LEGAL', 'ADMINISTRATIVE', 'EVIDENCE'],
  'EVALUACION_TECNICA': ['TECHNICAL', 'PLAN', 'EVIDENCE', 'PHOTO'],
  'DICTAMEN_JURIDICO': ['LEGAL', 'REPORT', 'APPRAISAL'],
  'TASACION': ['APPRAISAL', 'FINANCIAL', 'PLAN', 'PHOTO'],
  'NEGOCIACION': ['CORRESPONDENCE', 'FINANCIAL', 'CONTRACT'],
  'DOCUMENTACION_LEGAL': ['LEGAL', 'PERMIT', 'CONTRACT', 'ADMINISTRATIVE'],
  'PAGO': ['FINANCIAL', 'CONTRACT', 'CORRESPONDENCE'],
  'ENTREGA': ['ADMINISTRATIVE', 'LEGAL', 'PHOTO'],
  'CIERRE': ['REPORT', 'ADMINISTRATIVE', 'LEGAL'],
};

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// Generate unique file path
function generateFilePath(originalName: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext);
  return `${timestamp}-${random}-${name}${ext}`;
}

// Calculate file hash
async function calculateFileHash(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

// Create directory for date-based organization
async function createDateDirectory(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const dateDir = path.join(UPLOAD_DIR, String(year), month, day);
  await fs.mkdir(dateDir, { recursive: true });

  return dateDir;
}

// Extract text content for indexing (simplified version)
async function extractTextContent(filePath: string, mimeType: string): Promise<string> {
  try {
    switch (mimeType) {
      case 'text/plain':
        const buffer = await fs.readFile(filePath);
        return buffer.toString('utf-8');

      case 'application/pdf':
        // TODO: Implement PDF text extraction using pdf-parse or similar
        return '';

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        // TODO: Implement DOCX text extraction using mammoth.js or similar
        return '';

      default:
        return '';
    }
  } catch (error) {
    logger.error('Error extracting text content:', error);
    return '';
  }
}

// Create document with file
export async function createDocumentWithFile({
  file,
  documentData,
  userId,
}: {
  file: File;
  documentData: Partial<DocumentFormData>;
  userId: string;
}) {
  // Validate file
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds maximum allowed size (100MB)');
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('File type not allowed');
  }

  // Ensure upload directory exists
  await ensureUploadDir();
  const dateDir = await createDateDirectory();

  // Generate file path and save file
  const fileName = generateFilePath(file.name);
  const filePath = path.join(dateDir, fileName);

  // Save file to disk
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  // Calculate file hash
  const fileHash = await calculateFileHash(filePath);

  // Extract text content for indexing
  const contentText = await extractTextContent(filePath, file.type);

  // Create document record with separated required and conditional fields
  const baseDocumentPayload = {
    title: documentData.title || file.name,
    fileName: fileName,
    originalFileName: file.name,
    filePath: path.relative(process.cwd(), filePath),
    fileSize: file.size,
    mimeType: file.type,
    fileHash,
    documentType: documentData.documentType as DocumentType || DocumentType.OTHER,
    category: documentData.category as DocumentCategory || DocumentCategory.ADMINISTRATIVE,
    status: DocumentStatus.DRAFT,
    securityLevel: documentData.securityLevel as DocumentSecurityLevel || DocumentSecurityLevel.INTERNAL,
    version: 1,
    isLatest: true,
    isDraft: true,
    uploadedById: userId,
    contentText,
    isIndexed: contentText.length > 0,
  };

  // Add conditional fields only if they have meaningful values
  const documentPayload: any = { ...baseDocumentPayload };

  if (documentData.description) {
    documentPayload.description = documentData.description;
  }

  if (documentData.caseId) {
    documentPayload.caseId = documentData.caseId;
  }

  if (documentData.tags) {
    documentPayload.tags = documentData.tags;
  }

  if (documentData.metadata) {
    documentPayload.metadata = documentData.metadata;
  }

  if (documentData.customFields) {
    documentPayload.customFields = documentData.customFields;
  }

  if (documentData.retentionPeriod) {
    documentPayload.retentionPeriod = documentData.retentionPeriod;
  }

  if (documentData.expiresAt) {
    documentPayload.expiresAt = new Date(documentData.expiresAt);
  }

  if (contentText.length > 0) {
    documentPayload.indexedAt = new Date();
  }

  const document = await prisma.document.create({
    data: documentPayload,
    include: {
      uploadedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      case: {
        select: {
          id: true,
          fileNumber: true,
          title: true,
        },
      },
    },
  });

  // Create initial document history entry
  await prisma.documentHistory.create({
    data: {
      documentId: document.id,
      action: 'UPLOADED',
      description: `Document uploaded: ${file.name}`,
      userId,
      fileSize: file.size,
      fileName: file.name,
      filePath: document.filePath,
      metadata: {
        originalFileName: file.name,
        mimeType: file.type,
        uploadTimestamp: new Date().toISOString(),
      },
    },
  });

  // Create tags if provided
  if (documentData.tags) {
    const tags = documentData.tags.split(',').map(tag => tag.trim()).filter(Boolean);
    for (const tag of tags) {
      await prisma.documentTag.create({
        data: {
          documentId: document.id,
          tag,
        },
      });
    }
  }

  return {
    ...document,
    uploadedBy: document.uploadedBy ? {
      ...document.uploadedBy,
      fullName: `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}`,
    } : undefined,
    fileSizeFormatted: formatFileSize(document.fileSize),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

// Get document by ID with access check
export async function getDocumentById(documentId: string, userId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      uploadedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      case: {
        select: {
          id: true,
          fileNumber: true,
          title: true,
          departmentId: true,
          createdById: true,
          assignedToId: true,
          supervisedById: true,
        },
      },
      tagsRelations: {
        select: {
          id: true,
          tag: true,
          color: true,
        },
      },
      _count: {
        select: {
          versions: true,
          history: true,
          signatures: true,
        },
      },
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  // Check access permissions
  const hasAccess =
    document.uploadedById === userId ||
    (document.case && (
      document.case.createdById === userId ||
      document.case.assignedToId === userId ||
      document.case.supervisedById === userId ||
      await hasDepartmentAccess(userId, document.case.departmentId)
    ));

  if (!hasAccess && document.securityLevel !== 'PUBLIC') {
    throw new Error('Access denied');
  }

  return document;
}

// Update document
export async function updateDocument(
  documentId: string,
  userId: string,
  updateData: Partial<DocumentFormData>
) {
  // Check permissions first
  await getDocumentById(documentId, userId);

  const updateFields: any = {};

  if (updateData.title !== undefined) updateFields.title = updateData.title;
  if (updateData.description !== undefined) updateFields.description = updateData.description;
  if (updateData.documentType !== undefined) updateFields.documentType = updateData.documentType as DocumentType;
  if (updateData.category !== undefined) updateFields.category = updateData.category as DocumentCategory;
  if (updateData.securityLevel !== undefined) updateFields.securityLevel = updateData.securityLevel as DocumentSecurityLevel;
  if (updateData.tags !== undefined) updateFields.tags = updateData.tags;
  if (updateData.metadata !== undefined) updateFields.metadata = updateData.metadata;
  if (updateData.customFields !== undefined) updateFields.customFields = updateData.customFields;
  if (updateData.retentionPeriod !== undefined) updateFields.retentionPeriod = updateData.retentionPeriod;
  if (updateData.expiresAt !== undefined) updateFields.expiresAt = updateData.expiresAt ? new Date(updateData.expiresAt) : null;

  const document = await prisma.document.update({
    where: { id: documentId },
    data: updateFields,
    include: {
      uploadedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      case: {
        select: {
          id: true,
          fileNumber: true,
          title: true,
        },
      },
    },
  });

  // Create history entry
  await prisma.documentHistory.create({
    data: {
      documentId,
      action: 'EDITED',
      description: `Document updated: ${document.title}`,
      userId,
      newValue: JSON.stringify(updateData),
      metadata: {
        updateTimestamp: new Date().toISOString(),
      },
    },
  });

  return document;
}

// Delete document
export async function deleteDocument(documentId: string, userId: string) {
  const document = await getDocumentById(documentId, userId);

  if (document.uploadedById !== userId) {
    throw new Error('Only the document owner can delete it');
  }

  // Soft delete by archiving
  const updated = await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'ARCHIVED',
      isLatest: false,
    },
  });

  // Create history entry
  await prisma.documentHistory.create({
    data: {
      documentId,
      action: 'DELETED',
      description: `Document deleted: ${document.title}`,
      userId,
      metadata: {
        deletionTimestamp: new Date().toISOString(),
      },
    },
  });

  return updated;
}

// Get document versions
export async function getDocumentVersions(documentId: string, userId: string) {
  await getDocumentById(documentId, userId); // Check access

  const versions = await prisma.documentVersion.findMany({
    where: { documentId },
    include: {
      creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { version: 'desc' },
  });

  return versions.map(v => ({
    ...v,
    uploadedBy: {
      ...v.creator,
      fullName: `${v.creator.firstName} ${v.creator.lastName}`,
    },
    fileSizeFormatted: formatFileSize(v.fileSize),
    createdAt: v.createdAt.toISOString(),
  }));
}

// Helper functions
async function hasDepartmentAccess(userId: string, departmentId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      departmentId: true,
      role: {
        select: { name: true }
      }
    },
  });

  if (!user) return false;

  const sameDepartment = user.departmentId === departmentId;
  const hasAdminAccess = user.role?.name === 'super_admin' ||
                        user.role?.name === 'department_admin';

  return sameDepartment || hasAdminAccess;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Create document version with file (exported for use in API routes)
export async function createDocumentVersion({
  documentId,
  file,
  versionData,
  userId,
  versionNumber,
}: {
  documentId: string;
  file: File;
  versionData: any;
  userId: string;
  versionNumber: number;
}) {
  const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'documents', 'versions');

  // Ensure upload directory exists
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }

  // Generate unique file path
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(file.name);
  const name = path.basename(file.name, ext);
  const fileName = `v${versionNumber}-${timestamp}-${random}-${name}${ext}`;
  const filePath = path.join(UPLOAD_DIR, fileName);

  // Save file to disk
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  // Calculate file hash
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Create document version record
  const version = await prisma.documentVersion.create({
    data: {
      documentId,
      version: versionNumber,
      title: versionData.title || file.name,
      description: versionData.description,
      fileName: fileName,
      filePath: path.relative(process.cwd(), filePath),
      fileSize: file.size,
      mimeType: file.type,
      fileHash,
      changeSummary: versionData.changeDescription,
      createdBy: userId,
      diffData: versionData.customFields || {},
    },
    include: {
      creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Create history entry
  await prisma.documentHistory.create({
    data: {
      documentId,
      action: 'VERSIONED',
      description: `Version ${versionNumber} uploaded: ${file.name}`,
      userId,
      fileSize: file.size,
      fileName: file.name,
      filePath: path.relative(process.cwd(), filePath),
      metadata: {
        originalFileName: file.name,
        mimeType: file.type,
        uploadTimestamp: new Date().toISOString(),
        versionNumber,
      },
    },
  });

  return version;
}