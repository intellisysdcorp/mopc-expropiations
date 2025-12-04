import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '@/lib/logger';

// File signatures (magic bytes) for validation
export const FILE_SIGNATURES = {
  // Documents
  'application/pdf': [
    Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]), // %PDF-
  ],
  'application/msword': [
    Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]), // DOC files
  ],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    Buffer.from([0x50, 0x4B, 0x03, 0x04]), // DOCX (ZIP container)
  ],
  'application/vnd.ms-excel': [
    Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]), // XLS files
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    Buffer.from([0x50, 0x4B, 0x03, 0x04]), // XLSX (ZIP container)
  ],
  'application/vnd.ms-powerpoint': [
    Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]), // PPT files
  ],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    Buffer.from([0x50, 0x4B, 0x03, 0x04]), // PPTX (ZIP container)
  ],

  // Images
  'image/jpeg': [
    Buffer.from([0xFF, 0xD8, 0xFF]), // JPEG
  ],
  'image/png': [
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG
  ],
  'image/gif': [
    Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), // GIF87a
    Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), // GIF89a
  ],
  'image/webp': [
    Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF (WebP container)
  ],
  'image/tiff': [
    Buffer.from([0x49, 0x49, 0x2A, 0x00]), // TIFF (little-endian)
    Buffer.from([0x4D, 0x4D, 0x00, 0x2A]), // TIFF (big-endian)
  ],

  // Text files
  'text/plain': [], // No specific signature, validated by content
  'text/csv': [], // No specific signature, validated by content
  'text/html': [
    Buffer.from([0x3C, 0x21, 0x44, 0x4F, 0x43, 0x54, 0x59, 0x50, 0x45]), // <!DOCTYPE
    Buffer.from([0x3C, 0x68, 0x74, 0x6D, 0x6C]), // <html
  ],

  // Archives (allowed but need extra validation)
  'application/zip': [
    Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP
    Buffer.from([0x50, 0x4B, 0x05, 0x06]), // ZIP
    Buffer.from([0x50, 0x4B, 0x07, 0x08]), // ZIP
  ],
  'application/x-rar-compressed': [
    Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00]), // RAR
    Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00]), // RAR5
  ],
  'application/x-7z-compressed': [
    Buffer.from([0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]), // 7z
  ],
};

// Dangerous file extensions to block
export const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
  '.ps1', '.sh', '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl',
  '.msi', '.deb', '.rpm', '.dmg', '.app', '.pkg', '.iso', '.img',
];

// Maximum file size for different types (in bytes)
export const FILE_SIZE_LIMITS = {
  'default': 100 * 1024 * 1024, // 100MB
  'image/jpeg': 50 * 1024 * 1024, // 50MB
  'image/png': 50 * 1024 * 1024, // 50MB
  'image/gif': 20 * 1024 * 1024, // 20MB
  'image/webp': 50 * 1024 * 1024, // 50MB
  'image/tiff': 100 * 1024 * 1024, // 100MB
  'text/plain': 10 * 1024 * 1024, // 10MB
  'text/csv': 50 * 1024 * 1024, // 50MB
  'text/html': 10 * 1024 * 1024, // 10MB
  'application/zip': 200 * 1024 * 1024, // 200MB (archives can be larger)
  'application/x-rar-compressed': 200 * 1024 * 1024, // 200MB
  'application/x-7z-compressed': 200 * 1024 * 1024, // 200MB
};

// Security validation result
export interface SecurityValidationResult {
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
}

/**
 * Validate file magic bytes against expected MIME type
 */
export async function validateFileMagicBytes(filePath: string, expectedMimeType: string): Promise<boolean> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const signatures = FILE_SIGNATURES[expectedMimeType as keyof typeof FILE_SIGNATURES];

    // Skip validation for MIME types without signatures
    if (!signatures || signatures.length === 0) {
      return true;
    }

    // Check if any signature matches
    for (const signature of signatures) {
      if (fileBuffer.length >= signature.length) {
        const fileHeader = fileBuffer.slice(0, signature.length);
        if (fileHeader.equals(signature)) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    logger.error('Error validating magic bytes:', error);
    return false;
  }
}

/**
 * Detect actual file type based on magic bytes
 */
export async function detectFileType(filePath: string): Promise<string[]> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const detectedTypes: string[] = [];

    for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
      if (signatures.length === 0) continue;

      for (const signature of signatures) {
        if (fileBuffer.length >= signature.length) {
          const fileHeader = fileBuffer.slice(0, signature.length);
          if (fileHeader.equals(signature)) {
            detectedTypes.push(mimeType);
            break;
          }
        }
      }
    }

    return detectedTypes;
  } catch (error) {
    logger.error('Error detecting file type:', error);
    return [];
  }
}

/**
 * Check if file extension is dangerous
 */
export function isDangerousExtension(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return DANGEROUS_EXTENSIONS.includes(ext);
}

/**
 * Check for suspicious content in text files
 */
export async function scanForSuspiciousContent(filePath: string, mimeType: string): Promise<string[]> {
  const suspiciousPatterns: string[] = [];

  try {
    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for script tags in HTML
      if (mimeType === 'text/html') {
        const scriptTagPattern = /<script[^>]*>.*?<\/script>/gi;
        if (scriptTagPattern.test(content)) {
          suspiciousPatterns.push('HTML contains script tags');
        }
      }

      // Check for executable patterns
      const executablePatterns = [
        /eval\s*\(/gi,
        /exec\s*\(/gi,
        /system\s*\(/gi,
        /powershell/i,
        /cmd\.exe/i,
        /bash\s+-/gi,
      ];

      for (const pattern of executablePatterns) {
        if (pattern.test(content)) {
          suspiciousPatterns.push(`Suspicious executable pattern detected: ${pattern.source}`);
          break;
        }
      }

      // Check for suspicious URLs
      const urlPatterns = [
        /https?:\/\/[^\s]*\.(exe|bat|scr|com)/gi,
        /javascript:/gi,
        /data:text\/html/gi,
      ];

      for (const pattern of urlPatterns) {
        if (pattern.test(content)) {
          suspiciousPatterns.push(`Suspicious URL pattern detected: ${pattern.source}`);
          break;
        }
      }
    }
  } catch (error) {
    logger.error('Error scanning for suspicious content:', error);
  }

  return suspiciousPatterns;
}

/**
 * Validate ZIP file for security risks (ZIP bombs, excessive compression)
 */
export async function validateZipSecurity(filePath: string): Promise<string[]> {
  const issues: string[] = [];

  try {
    // For now, just check file size ratio
    // In a real implementation, you'd use a ZIP library to inspect contents
    const stats = await fs.stat(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);

    // Warn if ZIP is very large (potential ZIP bomb)
    if (fileSizeMB > 100) {
      issues.push('Large ZIP file detected - potential ZIP bomb risk');
    }

    // TODO: Add more sophisticated ZIP validation using a library like yauzl
    // - Check compressed/uncompressed size ratio
    // - Validate number of files
    // - Check for deep directory structures
    // - Scan for malicious file names within archive

  } catch (error) {
    logger.error('Error validating ZIP security:', error);
    issues.push('Failed to validate ZIP file security');
  }

  return issues;
}

/**
 * Comprehensive file security validation
 */
export async function validateFileSecurity(
  filePath: string,
  fileName: string,
  expectedMimeType: string,
  fileSize: number
): Promise<SecurityValidationResult> {
  const result: SecurityValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    metadata: {
      detectedSignatures: [],
      fileSize,
      isExecutable: false,
      hasSuspiciousContent: false,
      actualMimeType: undefined,
    },
  };

  try {
    // 1. Check file extension
    if (isDangerousExtension(fileName)) {
      result.errors.push(`Dangerous file extension: ${path.extname(fileName)}`);
      result.metadata.isExecutable = true;
    }

    // 2. Check file size limits
    const sizeLimit = FILE_SIZE_LIMITS[expectedMimeType as keyof typeof FILE_SIZE_LIMITS] || FILE_SIZE_LIMITS.default;
    if (fileSize > sizeLimit) {
      result.errors.push(`File size ${Math.round(fileSize / 1024 / 1024)}MB exceeds limit of ${Math.round(sizeLimit / 1024 / 1024)}MB for type ${expectedMimeType}`);
    }

    // 3. Validate magic bytes
    const hasValidMagicBytes = await validateFileMagicBytes(filePath, expectedMimeType);
    if (!hasValidMagicBytes && FILE_SIGNATURES[expectedMimeType as keyof typeof FILE_SIGNATURES]?.length > 0) {
      result.errors.push(`File magic bytes do not match expected MIME type: ${expectedMimeType}`);
    }

    // 4. Detect actual file type
    const detectedTypes = await detectFileType(filePath);
    result.metadata.detectedSignatures = detectedTypes;
    if (detectedTypes.length > 0) {
      result.metadata.actualMimeType = detectedTypes[0];
    }

    // Check if detected type differs from expected
    if (detectedTypes.length > 0 && !detectedTypes.includes(expectedMimeType)) {
      result.errors.push(`File type mismatch: expected ${expectedMimeType}, detected ${detectedTypes.join(', ')}`);
    }

    // 5. Scan for suspicious content
    const suspiciousContent = await scanForSuspiciousContent(filePath, expectedMimeType);
    if (suspiciousContent.length > 0) {
      result.warnings.push(...suspiciousContent);
      result.metadata.hasSuspiciousContent = true;
    }

    // 6. Additional validation for archives
    if (['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'].includes(expectedMimeType)) {
      const archiveIssues = await validateZipSecurity(filePath);
      if (archiveIssues.length > 0) {
        result.warnings.push(...archiveIssues);
      }
    }

    // Determine overall validity
    result.isValid = result.errors.length === 0;

  } catch (error) {
    logger.error('Error during file security validation:', error);
    result.errors.push('Security validation failed due to system error');
    result.isValid = false;
  }

  return result;
}

/**
 * Generate secure file name (prevent path traversal)
 */
export function generateSecureFileName(originalName: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext);

  // Sanitize name - remove path separators and special characters
  const sanitizedName = name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 50); // Limit length

  return `${timestamp}-${random}-${sanitizedName}${ext}`;
}

/**
 * Validate file path to prevent directory traversal
 */
export function validateFilePath(filePath: string, allowedBasePath: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const resolvedBase = path.resolve(allowedBasePath);

  return resolvedPath.startsWith(resolvedBase);
}