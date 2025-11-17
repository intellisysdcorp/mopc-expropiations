import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { validateFileSecurity, generateSecureFileName, validateFilePath } from './file-security';
import { logger } from '@/lib/logger';

// Upload configuration
const UPLOAD_TEMP_DIR = path.join(process.cwd(), 'uploads', 'temp');
const UPLOAD_FINAL_DIR = path.join(process.cwd(), 'uploads', 'documents');
const MAX_TEMP_FILE_AGE = 30 * 60 * 1000; // 30 minutes

// Ensure upload directories exist
async function ensureUploadDirectories() {
  try {
    await fs.access(UPLOAD_TEMP_DIR);
  } catch {
    await fs.mkdir(UPLOAD_TEMP_DIR, { recursive: true });
  }

  try {
    await fs.access(UPLOAD_FINAL_DIR);
  } catch {
    await fs.mkdir(UPLOAD_FINAL_DIR, { recursive: true });
  }
}

// Clean up old temporary files
async function cleanupTempFiles() {
  try {
    const files = await fs.readdir(UPLOAD_TEMP_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(UPLOAD_TEMP_DIR, file);
      try {
        const stats = await fs.stat(filePath);
        if (now - stats.mtime.getTime() > MAX_TEMP_FILE_AGE) {
          await fs.unlink(filePath);
          logger.info(`Cleaned up old temporary file: ${file}`);
        }
      } catch (error) {
        logger.error(`Error checking temp file ${file}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error cleaning up temp files:', error);
  }
}

// Run cleanup periodically
setInterval(cleanupTempFiles, 10 * 60 * 1000); // Every 10 minutes
cleanupTempFiles(); // Run once on startup

// Helper function to count files recursively
async function countFilesRecursive(dir: string): Promise<{ count: number; size: number }> {
  let count = 0;
  let size = 0;

  const entries = await fs.readdir(dir);
  for (const entry of entries) {
    const entryPath = path.join(dir, entry);
    const stats = await fs.stat(entryPath);

    if (stats.isDirectory()) {
      const subStats = await countFilesRecursive(entryPath);
      count += subStats.count;
      size += subStats.size;
    } else {
      count++;
      size += stats.size;
    }
  }

  return { count, size };
}

export interface AtomicUploadOptions {
  expectedMimeType: string;
  originalFileName: string;
  userId: string;
  caseId?: string;
  maxSize?: number;
  skipSecurityValidation?: boolean;
}

export interface AtomicUploadResult {
  success: boolean;
  tempFilePath?: string;
  finalFilePath?: string;
  fileName?: string;
  fileSize: number;
  fileHash?: string;
  securityValidation?: any;
  error?: string;
  cleanup: () => Promise<void>;
}

/**
 * Generate a secure temporary file path
 */
function generateTempFilePath(originalFileName: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(16).toString('hex');
  const ext = path.extname(originalFileName);
  return path.join(UPLOAD_TEMP_DIR, `temp-${timestamp}-${random}${ext}`);
}

/**
 * Create date-based directory structure in final upload location
 */
async function createDateDirectory(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const dateDir = path.join(UPLOAD_FINAL_DIR, year, month, day);
  await fs.mkdir(dateDir, { recursive: true });
  return dateDir;
}

/**
 * Calculate file hash
 */
async function calculateFileHash(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Atomic file upload with security validation
 */
export async function atomicFileUpload(
  fileBuffer: Buffer,
  options: AtomicUploadOptions
): Promise<AtomicUploadResult> {
  const cleanupCallbacks: Array<() => Promise<void>> = [];

  const cleanup = async () => {
    for (const callback of cleanupCallbacks) {
      try {
        await callback();
      } catch (error) {
        logger.error('Error during cleanup:', error);
      }
    }
  };

  try {
    // Ensure directories exist
    await ensureUploadDirectories();

    // Generate temporary file path
    const tempFilePath = generateTempFilePath(options.originalFileName);

    // Validate file size
    const fileSize = fileBuffer.length;
    const maxSize = options.maxSize || 100 * 1024 * 1024; // Default 100MB

    if (fileSize > maxSize) {
      return {
        success: false,
        fileSize,
        error: `File size ${Math.round(fileSize / 1024 / 1024)}MB exceeds maximum allowed size ${Math.round(maxSize / 1024 / 1024)}MB`,
        cleanup,
      };
    }

    // Write file to temporary location first
    await fs.writeFile(tempFilePath, fileBuffer);

    // Add cleanup for temp file
    cleanupCallbacks.push(async () => {
      try {
        await fs.unlink(tempFilePath);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    });

    // Validate file path security
    if (!validateFilePath(tempFilePath, UPLOAD_TEMP_DIR)) {
      return {
        success: false,
        fileSize,
        error: 'Invalid file path detected',
        cleanup,
      };
    }

    // Perform security validation (unless explicitly skipped)
    let securityValidation;
    if (!options.skipSecurityValidation) {
      securityValidation = await validateFileSecurity(
        tempFilePath,
        options.originalFileName,
        options.expectedMimeType,
        fileSize
      );

      if (!securityValidation.isValid) {
        return {
          success: false,
          fileSize,
          error: `Security validation failed: ${securityValidation.errors.join(', ')}`,
          securityValidation,
          cleanup,
        };
      }
    }

    // Calculate file hash
    const fileHash = await calculateFileHash(tempFilePath);

    // Generate final file name and path
    const secureFileName = generateSecureFileName(options.originalFileName);
    const dateDir = await createDateDirectory();
    const finalFilePath = path.join(dateDir, secureFileName);

    // Validate final path
    if (!validateFilePath(finalFilePath, UPLOAD_FINAL_DIR)) {
      return {
        success: false,
        fileSize,
        error: 'Invalid final file path detected',
        cleanup,
      };
    }

    // Check if final file already exists (collision detection)
    try {
      await fs.access(finalFilePath);
      // If file exists, generate a new name with additional random suffix
      const randomSuffix = crypto.randomBytes(4).toString('hex');
      const nameWithoutExt = path.basename(secureFileName, path.extname(secureFileName));
      const ext = path.extname(secureFileName);
      const newFileName = `${nameWithoutExt}-${randomSuffix}${ext}`;
      const newFinalFilePath = path.join(dateDir, newFileName);

      if (!validateFilePath(newFinalFilePath, UPLOAD_FINAL_DIR)) {
        return {
          success: false,
          fileSize,
          error: 'Invalid alternative file path detected',
          cleanup,
        };
      }

      // Move file to new location
      await fs.rename(tempFilePath, newFinalFilePath);

      return {
        success: true,
        finalFilePath: newFinalFilePath,
        fileName: newFileName,
        fileSize,
        fileHash,
        securityValidation,
        cleanup: async () => {
          try {
            await fs.unlink(newFinalFilePath);
          } catch (error) {
            // Ignore if file doesn't exist
          }
        },
      };
    } catch (error) {
      // File doesn't exist, proceed with original name
    }

    // Atomically move file from temporary to final location
    await fs.rename(tempFilePath, finalFilePath);

    // Add cleanup for final file
    cleanupCallbacks.push(async () => {
      try {
        await fs.unlink(finalFilePath);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    });

    return {
      success: true,
      finalFilePath,
      fileName: secureFileName,
      fileSize,
      fileHash,
      securityValidation,
      cleanup: async () => {
        try {
          await fs.unlink(finalFilePath);
        } catch (error) {
          // Ignore if file doesn't exist
        }
      },
    };

  } catch (error) {
    logger.error('Error during atomic file upload:', error);

    // Cleanup on error
    await cleanup();

    return {
      success: false,
      fileSize: fileBuffer.length,
      error: error instanceof Error ? error.message : 'Unknown error during file upload',
      cleanup: async () => {}, // No cleanup needed as it's already done
    };
  }
}

/**
 * Upload multiple files atomically with transaction-like behavior
 */
export async function atomicMultipleFileUpload(
  files: Array<{ buffer: Buffer; options: AtomicUploadOptions }>
): Promise<{
  success: boolean;
  results: AtomicUploadResult[];
  totalSize: number;
  error?: string;
}> {
  const results: AtomicUploadResult[] = [];
  const uploadedFiles: Array<{ fileName: string; filePath: string }> = [];
  let totalSize = 0;

  try {
    // Upload all files
    for (const { buffer, options } of files) {
      const result = await atomicFileUpload(buffer, options);
      results.push(result);
      totalSize += result.fileSize;

      if (!result.success) {
        // If any file fails, cleanup all uploaded files
        for (const uploadedFile of uploadedFiles) {
          try {
            await fs.unlink(uploadedFile.filePath);
          } catch (error) {
            logger.error(`Error cleaning up file ${uploadedFile.fileName}:`, error);
          }
        }

        return {
          success: false,
          results,
          totalSize,
          error: `Upload failed for file ${options.originalFileName}: ${result.error}`,
        };
      }

      if (result.finalFilePath && result.fileName) {
        uploadedFiles.push({
          fileName: result.fileName,
          filePath: result.finalFilePath,
        });
      }
    }

    return {
      success: true,
      results,
      totalSize,
    };

  } catch (error) {
    // Cleanup all uploaded files on catastrophic failure
    for (const uploadedFile of uploadedFiles) {
      try {
        await fs.unlink(uploadedFile.filePath);
      } catch (cleanupError) {
        logger.error(`Error cleaning up file ${uploadedFile.fileName}:`, cleanupError);
      }
    }

    return {
      success: false,
      results,
      totalSize,
      error: error instanceof Error ? error.message : 'Unknown error during multiple file upload',
    };
  }
}

/**
 * Verify file integrity after upload
 */
export async function verifyFileIntegrity(
  filePath: string,
  expectedHash: string,
  expectedSize: number
): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);

    // Check file size
    if (stats.size !== expectedSize) {
      logger.error(`File size mismatch: expected ${expectedSize}, got ${stats.size}`);
      return false;
    }

    // Check file hash
    const actualHash = await calculateFileHash(filePath);
    if (actualHash !== expectedHash) {
      logger.error(`File hash mismatch: expected ${expectedHash}, got ${actualHash}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error verifying file integrity:', error);
    return false;
  }
}

/**
 * Get upload statistics
 */
export async function getUploadStatistics(): Promise<{
  tempFilesCount: number;
  tempFilesSize: number;
  finalFilesCount: number;
  finalFilesSize: number;
}> {
  let tempFilesCount = 0;
  let tempFilesSize = 0;
  let finalFilesCount = 0;
  let finalFilesSize = 0;

  try {
    // Count temporary files
    const tempFiles = await fs.readdir(UPLOAD_TEMP_DIR);
    for (const file of tempFiles) {
      const filePath = path.join(UPLOAD_TEMP_DIR, file);
      try {
        const stats = await fs.stat(filePath);
        tempFilesCount++;
        tempFilesSize += stats.size;
      } catch (error) {
        // Skip files that can't be accessed
      }
    }

    const finalStats = await countFilesRecursive(UPLOAD_FINAL_DIR);
    finalFilesCount = finalStats.count;
    finalFilesSize = finalStats.size;

  } catch (error) {
    logger.error('Error getting upload statistics:', error);
  }

  return {
    tempFilesCount,
    tempFilesSize,
    finalFilesCount,
    finalFilesSize,
  };
}