import { NextRequest } from 'next/server';
import { validateFileSecurity } from './file-security';
import { validateMimeType, isMimeTypeAllowed, getMimeTypeCategory } from './mime-validator';
import { scanFileForMalware } from './malware-scanner';
import { atomicFileUpload, AtomicUploadOptions } from './atomic-upload';
import { checkRateLimit, recordRequest, checkSuspiciousActivity } from './rate-limiter';
import { logger } from '../lib/logger';
import { UserRole } from '@prisma/client';

// Comprehensive file upload security configuration
export interface FileUploadSecurityConfig {
  allowedMimeTypes: string[];
  maxFileSize: number;
  maxFilesPerRequest: number;
  requireMalwareScan: boolean;
  allowSuspiciousFiles: boolean;
  enableRateLimit: boolean;
  userRole: UserRole;
  enableStrictValidation: boolean;
}

// Helper function to convert Prisma UserRole to string-based role for rate limiter
function prismaRoleToRateLimiterRole(prismaRole: UserRole): string {
  const roleMapping = {
    [UserRole.SUPER_ADMIN]: 'super_admin',
    [UserRole.DEPARTMENT_ADMIN]: 'department_admin',
    [UserRole.ANALYST]: 'analyst',
    [UserRole.SUPERVISOR]: 'supervisor',
    [UserRole.TECHNICAL_MEETING_COORDINATOR]: 'technical_meeting_coordinator',
    [UserRole.OBSERVER]: 'observer'
  };
  return roleMapping[prismaRole] || 'default';
}

// Default security configurations for different user roles
export const DEFAULT_SECURITY_CONFIGS: Record<string, FileUploadSecurityConfig> = {
  [UserRole.SUPER_ADMIN]: {
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/tiff',
      'text/plain',
      'text/csv',
      'text/html',
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
    ],
    maxFileSize: 200 * 1024 * 1024, // 200MB
    maxFilesPerRequest: 20,
    requireMalwareScan: true,
    allowSuspiciousFiles: true, // Admins can override
    enableRateLimit: true,
    userRole: UserRole.SUPER_ADMIN,
    enableStrictValidation: false,
  },
  [UserRole.DEPARTMENT_ADMIN]: {
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain',
      'text/csv',
      'application/zip',
    ],
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxFilesPerRequest: 10,
    requireMalwareScan: true,
    allowSuspiciousFiles: false,
    enableRateLimit: true,
    userRole: UserRole.DEPARTMENT_ADMIN,
    enableStrictValidation: true,
  },
  [UserRole.ANALYST]: {
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'text/csv',
    ],
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFilesPerRequest: 5,
    requireMalwareScan: true,
    allowSuspiciousFiles: false,
    enableRateLimit: true,
    userRole: UserRole.ANALYST,
    enableStrictValidation: true,
  },
  [UserRole.SUPERVISOR]: {
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'text/csv',
    ],
    maxFileSize: 75 * 1024 * 1024, // 75MB
    maxFilesPerRequest: 8,
    requireMalwareScan: true,
    allowSuspiciousFiles: false,
    enableRateLimit: true,
    userRole: UserRole.SUPERVISOR,
    enableStrictValidation: true,
  },
  [UserRole.TECHNICAL_MEETING_COORDINATOR]: {
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'text/csv',
    ],
    maxFileSize: 25 * 1024 * 1024, // 25MB
    maxFilesPerRequest: 3,
    requireMalwareScan: true,
    allowSuspiciousFiles: false,
    enableRateLimit: true,
    userRole: UserRole.TECHNICAL_MEETING_COORDINATOR,
    enableStrictValidation: true,
  },
  [UserRole.OBSERVER]: {
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'text/plain',
      'text/csv',
    ],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFilesPerRequest: 1,
    requireMalwareScan: true,
    allowSuspiciousFiles: false,
    enableRateLimit: true,
    userRole: UserRole.OBSERVER,
    enableStrictValidation: true,
  },
  'default': {
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'text/plain',
    ],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFilesPerRequest: 1,
    requireMalwareScan: true,
    allowSuspiciousFiles: false,
    enableRateLimit: true,
    userRole: UserRole.OBSERVER, // Use OBSERVER as fallback
    enableStrictValidation: true,
  },
};

// Comprehensive file upload validation result
export interface FileUploadValidationResult {
  allowed: boolean;
  reason?: string;
  warnings: string[];
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresManualReview: boolean;
  validationDetails: {
    mimeValidation: {
      declaredMimeType: string;
      detectedByMagicBytes: string[];
      detectedByExtension: string;
      confidence: number;
      isConsistent: boolean;
      recommendedMimeType: string;
      warnings: string[];
    } | null;
    securityValidation: {
      isValid: boolean;
      errors: string[];
      warnings: string[];
      metadata: {
        actualMimeType: string | undefined;
        detectedSignatures: string[];
        fileSize: number;
        isExecutable: boolean;
        hasSuspiciousContent: boolean;
      };
    } | null;
    malwareScan: {
      isClean: boolean;
      threats: Array<{
        type: 'virus' | 'trojan' | 'worm' | 'spyware' | 'adware' | 'suspicious' | 'policy_violation';
        name: string;
        description: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        confidence: number;
      }>;
      scanTime: number;
      confidence: number;
      warnings: string[];
      metadata: {
        fileSize: number;
        fileHash: string;
        scannedAt: string;
        scannerVersion: string;
      };
    } | null;
    rateLimit: {
      allowed: boolean;
      remainingRequests: number;
      remainingUploads: number;
      remainingStorageMB: number;
      resetTime: number;
      error?: string;
    } | null;
  };
  recommendations: string[];
}

/**
 * Validate file upload request with comprehensive security checks
 */
export async function validateFileUpload(
  request: NextRequest,
  file: File,
  userRole: UserRole = UserRole.OBSERVER,
  options: Partial<FileUploadSecurityConfig> = {}
): Promise<FileUploadValidationResult> {
  const baseConfig: FileUploadSecurityConfig = DEFAULT_SECURITY_CONFIGS[userRole] ?? DEFAULT_SECURITY_CONFIGS['default'] ?? DEFAULT_SECURITY_CONFIGS[UserRole.OBSERVER]!;
  const config: FileUploadSecurityConfig = {
    ...baseConfig,
    ...options,
  };

  const warnings: string[] = [];
  const recommendations: string[] = [];
  let securityLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  let requiresManualReview = false;

  // Initialize validation details
  const validationDetails: FileUploadValidationResult['validationDetails'] = {
    mimeValidation: null,
    securityValidation: null,
    malwareScan: null,
    rateLimit: null,
  };

  try {
    // 1. Rate limiting check
    if (config.enableRateLimit) {
      const uploadSizeMB = file.size / (1024 * 1024);
      const rateLimiterRole = prismaRoleToRateLimiterRole(config.userRole) as any;
      const rateLimitResult = checkRateLimit(request, rateLimiterRole, true, uploadSizeMB);

      validationDetails.rateLimit = rateLimitResult;

      if (!rateLimitResult.allowed) {
        return {
          allowed: false,
          reason: rateLimitResult.error || 'Rate limit exceeded',
          warnings,
          securityLevel: 'high',
          requiresManualReview: true,
          validationDetails,
          recommendations: ['Wait before uploading more files'],
        };
      }

      // Check for suspicious activity
      if (checkSuspiciousActivity(request)) {
        securityLevel = 'high';
        warnings.push('Suspicious upload pattern detected');
        requiresManualReview = true;
      }
    }

    // 2. Basic file size and count validation
    if (file.size > config.maxFileSize) {
      return {
        allowed: false,
        reason: `File size ${Math.round(file.size / 1024 / 1024)}MB exceeds limit of ${Math.round(config.maxFileSize / 1024 / 1024)}MB`,
        warnings,
        securityLevel: 'medium',
        requiresManualReview: false,
        validationDetails,
        recommendations: ['Compress the file or upload a smaller version'],
      };
    }

    // 3. MIME type validation
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeValidation = validateMimeType(file.type, file.name, buffer);

    validationDetails.mimeValidation = mimeValidation;

    // Check if MIME type is allowed
    const mimeTypeCheck = isMimeTypeAllowed(mimeValidation.recommendedMimeType, config.allowedMimeTypes);
    if (!mimeTypeCheck.allowed) {
      return {
        allowed: false,
        reason: mimeTypeCheck.reason || 'MIME type not allowed',
        warnings,
        securityLevel: 'medium',
        requiresManualReview: false,
        validationDetails,
        recommendations: ['Convert file to allowed format'],
      };
    }

    // Add warnings for MIME type inconsistencies
    if (!mimeValidation.isConsistent) {
      warnings.push(...mimeValidation.warnings);
      if (securityLevel === 'low') {
        securityLevel = 'medium';
      }
      requiresManualReview = true;
    }

    // 4. Security validation
    const securityValidation = await validateFileSecurity(
      '', // We don't have a file path yet, use buffer validation
      file.name,
      mimeValidation.recommendedMimeType,
      file.size
    );

    validationDetails.securityValidation = securityValidation;

    if (!securityValidation.isValid && !config.allowSuspiciousFiles) {
      return {
        allowed: false,
        reason: `Security validation failed: ${securityValidation.errors.join(', ')}`,
        warnings: [...warnings, ...securityValidation.warnings],
        securityLevel: 'high',
        requiresManualReview: true,
        validationDetails,
        recommendations: ['Scan file for malware and remove threats'],
      };
    }

    warnings.push(...securityValidation.warnings);

    // 5. Malware scanning
    if (config.requireMalwareScan) {
      // For quick validation, we'll scan the buffer directly
      // In a real implementation, you'd save to temp file first
      const malwareScan = await quickMalwareScanLocal(file.name, buffer);

      validationDetails.malwareScan = malwareScan;

      if (!malwareScan.isClean) {
        const criticalThreats = malwareScan.threats.filter(t => t.severity === 'critical');
        const highThreats = malwareScan.threats.filter(t => t.severity === 'high');

        if (criticalThreats.length > 0 && !config.allowSuspiciousFiles) {
          return {
            allowed: false,
            reason: `Malware detected: ${criticalThreats.map(t => t.name).join(', ')}`,
            warnings: [...warnings, 'Malware threats detected'],
            securityLevel: 'critical',
            requiresManualReview: true,
            validationDetails,
            recommendations: ['Remove malware from file'],
          };
        }

        if (highThreats.length > 0) {
          securityLevel = 'high';
          warnings.push('High-risk threats detected');
          requiresManualReview = true;
        }
      }
    }

    // 6. Determine final security level and recommendations
    const mimeCategory = getMimeTypeCategory(mimeValidation.recommendedMimeType);

    if (mimeCategory.riskLevel === 'high') {
      securityLevel = 'high';
      warnings.push('High-risk file type uploaded');
    }

    if (config.enableStrictValidation && mimeValidation.confidence < 0.8) {
      if (securityLevel === 'low') {
        securityLevel = 'medium';
      }
      warnings.push('File type confidence is low');
      requiresManualReview = true;
    }

    // Generate recommendations
    if (securityLevel === 'high') {
      recommendations.push('Manual security review recommended');
    }

    if (mimeValidation.warnings.length > 0) {
      recommendations.push('Consider converting file to a more standard format');
    }

    if (file.size > config.maxFileSize * 0.8) {
      recommendations.push('File is large - consider compression');
    }

    // Record the request for rate limiting
    if (config.enableRateLimit) {
      const rateLimiterRole = prismaRoleToRateLimiterRole(config.userRole) as any;
      recordRequest(request, rateLimiterRole, true, file.size / (1024 * 1024));
    }

    return {
      allowed: true,
      warnings,
      securityLevel,
      requiresManualReview,
      validationDetails,
      recommendations,
    };

  } catch (error) {
    logger.error('Error during file upload validation:', error);

    return {
      allowed: false,
      reason: 'Validation system error',
      warnings: ['Validation failed due to system error'],
      securityLevel: 'high',
      requiresManualReview: true,
      validationDetails,
      recommendations: ['Try uploading the file again'],
    };
  }
}

/**
 * Quick malware scan for buffer (helper function)
 */
async function quickMalwareScanLocal(_fileName: string, buffer: Buffer): Promise<{
  isClean: boolean;
  threats: Array<{
    type: 'virus' | 'trojan' | 'worm' | 'spyware' | 'adware' | 'suspicious' | 'policy_violation';
    name: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
  }>;
  scanTime: number;
  confidence: number;
  warnings: string[];
  metadata: {
    fileSize: number;
    fileHash: string;
    scannedAt: string;
    scannerVersion: string;
  };
}> {
  // This is a simplified version that works with buffers
  // In production, you'd save to temp file and use the full scanner
  const threats: Array<{
    type: 'virus' | 'trojan' | 'worm' | 'spyware' | 'adware' | 'suspicious' | 'policy_violation';
    name: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
  }> = [];

  // Check for EICAR test signature
  const eicarPattern = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
  if (buffer.includes(eicarPattern)) {
    threats.push({
      type: 'virus',
      name: 'EICAR-Test-File',
      description: 'EICAR Antivirus Test File',
      severity: 'low',
      confidence: 0.95,
    });
  }

  // Check for executable headers
  if (buffer.length >= 2) {
    const header = buffer.subarray(0, 2);
    if (header.equals(Buffer.from([0x4D, 0x5A]))) { // MZ
      threats.push({
        type: 'suspicious',
        name: 'PE-Executable',
        description: 'Windows PE executable detected',
        severity: 'high',
        confidence: 0.9,
      });
    }
  }

  return {
    isClean: threats.length === 0,
    threats,
    scanTime: Date.now(),
    confidence: threats.length === 0 ? 1.0 : 0.8,
    warnings: threats.length > 0 ? ['Suspicious content detected'] : [],
    metadata: {
      fileSize: buffer.length,
      fileHash: '', // Would calculate actual hash in production
      scannedAt: new Date().toISOString(),
      scannerVersion: '1.0.0',
    },
  };
}

/**
 * Secure file upload with comprehensive validation
 */
export async function secureFileUpload(
  request: NextRequest,
  file: File,
  userRole: UserRole = UserRole.OBSERVER,
  uploadOptions: Partial<AtomicUploadOptions> = {},
  securityOptions: Partial<FileUploadSecurityConfig> = {}
): Promise<{
  success: boolean;
  filePath?: string;
  fileName?: string;
  validation: FileUploadValidationResult;
  error?: string;
  cleanup?: () => Promise<void>;
}> {
  // 1. Validate the upload request
  const validation = await validateFileUpload(request, file, userRole, securityOptions);

  if (!validation.allowed) {
    return {
      success: false,
      validation,
      error: validation.reason || 'File validation failed',
    };
  }

  try {
    // 2. Perform atomic upload
    const baseConfig: FileUploadSecurityConfig = DEFAULT_SECURITY_CONFIGS[userRole] ?? DEFAULT_SECURITY_CONFIGS['default'] ?? DEFAULT_SECURITY_CONFIGS[UserRole.OBSERVER]!;
    const config: FileUploadSecurityConfig = {
      ...baseConfig,
      ...securityOptions,
    };

    const mimeValidation = validation.validationDetails.mimeValidation;
    if (!mimeValidation) {
      return {
        success: false,
        validation,
        error: 'MIME validation failed',
      };
    }

    const uploadOptionsAtomic: AtomicUploadOptions & {
      expectedMimeType: string;
      originalFileName: string;
      userId: string;
      maxSize: number;
      skipSecurityValidation: boolean;
    } = {
      expectedMimeType: mimeValidation.recommendedMimeType,
      originalFileName: file.name,
      userId: uploadOptions.userId || 'unknown',
      maxSize: config.maxFileSize,
      skipSecurityValidation: true, // Already done above
      ...uploadOptions,
    };

    // Only add caseId if it's defined (for exactOptionalPropertyTypes compliance)
    if (uploadOptions.caseId !== undefined) {
      uploadOptionsAtomic.caseId = uploadOptions.caseId;
    }

    const uploadResult = await atomicFileUpload(Buffer.from(await file.arrayBuffer()), uploadOptionsAtomic);

    if (!uploadResult.success) {
      return {
        success: false,
        validation,
        error: uploadResult.error || 'Upload failed',
      };
    }

    // 3. Perform comprehensive malware scan on uploaded file
    if (config.requireMalwareScan && uploadResult.finalFilePath) {
      const malwareScan = await scanFileForMalware(
        uploadResult.finalFilePath,
        file.name,
        mimeValidation.recommendedMimeType
      );

      validation.validationDetails.malwareScan = malwareScan;

      if (!malwareScan.isClean && !config.allowSuspiciousFiles) {
        // Clean up the uploaded file
        await uploadResult.cleanup();

        return {
          success: false,
          validation,
          error: `Malware detected: ${malwareScan.threats.map(t => t.name).join(', ')}`,
        };
      }

      // Update warnings and security level based on scan results
      if (malwareScan.threats.length > 0) {
        validation.warnings.push(`Malware scan found ${malwareScan.threats.length} threat(s)`);
        if (validation.securityLevel === 'low') {
          validation.securityLevel = 'medium';
        }
      }
    }

    const result: {
      success: boolean;
      validation: FileUploadValidationResult;
      filePath?: string;
      fileName?: string;
      cleanup?: () => Promise<void>;
    } = {
      success: true,
      validation,
    };

    // Only include optional properties when they have values (for exactOptionalPropertyTypes compliance)
    if (uploadResult.finalFilePath !== undefined) {
      result.filePath = uploadResult.finalFilePath;
    }
    if (uploadResult.fileName !== undefined) {
      result.fileName = uploadResult.fileName;
    }
    if (uploadResult.cleanup !== undefined) {
      result.cleanup = uploadResult.cleanup;
    }

    return result;

  } catch (error) {
    logger.error('Error during secure file upload:', error);

    return {
      success: false,
      validation,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Get security headers for upload responses
 */
export function getSecurityHeaders(validation: FileUploadValidationResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-File-Security-Level': validation.securityLevel,
    'X-File-Requires-Review': validation.requiresManualReview.toString(),
    'X-Validation-Warnings': validation.warnings.length.toString(),
  };

  if (validation.validationDetails.malwareScan) {
    headers['X-Malware-Scan-Result'] = validation.validationDetails.malwareScan.isClean ? 'clean' : 'threats-detected';
    headers['X-Malware-Threats-Count'] = validation.validationDetails.malwareScan.threats.length.toString();
  }

  return headers;
}