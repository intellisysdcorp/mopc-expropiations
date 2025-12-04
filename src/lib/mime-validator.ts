import { FILE_SIGNATURES } from './file-security';

// Enhanced MIME type validation with multiple detection methods
export interface MimeTypeDetection {
  declaredMimeType: string;
  detectedByMagicBytes: string[];
  detectedByExtension: string;
  confidence: number;
  isConsistent: boolean;
  recommendedMimeType: string;
  warnings: string[];
}

// MIME type to extension mapping
export const MIME_TYPE_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/tiff': ['.tif', '.tiff'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'text/html': ['.html', '.htm'],
  'application/zip': ['.zip'],
  'application/x-rar-compressed': ['.rar'],
  'application/x-7z-compressed': ['.7z'],
};

// Extension to MIME type mapping
export const EXTENSION_MIME_TYPES: Record<string, string> = {};
for (const [mimeType, extensions] of Object.entries(MIME_TYPE_EXTENSIONS)) {
  for (const ext of extensions) {
    EXTENSION_MIME_TYPES[ext] = mimeType;
  }
}

// Safe MIME types (lower risk)
export const SAFE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
]);

// Dangerous MIME types that require extra scrutiny
export const DANGEROUS_MIME_TYPES = new Set([
  'application/javascript',
  'text/javascript',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
]);

// MIME types that can contain embedded content
export const CONTAINER_MIME_TYPES = new Set([
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.substring(lastDot).toLowerCase();
}

/**
 * Detect MIME type by file extension
 */
export function detectMimeTypeByExtension(fileName: string): string {
  const ext = getFileExtension(fileName);
  return EXTENSION_MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Detect MIME type by magic bytes with confidence scoring
 */
export function detectMimeTypeByMagicBytes(buffer: Buffer): Array<{ mimeType: string; confidence: number }> {
  const detections: Array<{ mimeType: string; confidence: number }> = [];

  for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
    if (signatures.length === 0) continue;

    for (const signature of signatures) {
      if (buffer.length >= signature.length) {
        const fileHeader = buffer.slice(0, signature.length);
        if (fileHeader.equals(signature)) {
          // Calculate confidence based on signature uniqueness
          let confidence = 0.8; // Base confidence

          // Higher confidence for more unique signatures
          if (signature.length >= 8) confidence = 0.95;
          else if (signature.length >= 6) confidence = 0.9;
          else if (signature.length >= 4) confidence = 0.85;

          // Special cases with higher confidence
          if (mimeType === 'application/pdf' && buffer.toString('ascii', 0, 5) === '%PDF-') {
            confidence = 0.99;
          }

          detections.push({ mimeType, confidence });
          break; // Found matching signature for this MIME type
        }
      }
    }
  }

  // Sort by confidence (highest first)
  return detections.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Analyze text content to determine if it's actually what it claims to be
 */
export function analyzeTextContent(buffer: Buffer): {
  isPlainText: boolean;
  isCSV: boolean;
  isHTML: boolean;
  confidence: number;
  warnings: string[];
} {
  const content = buffer.toString('utf-8', 0, Math.min(1024, buffer.length)); // First 1KB
  const warnings: string[] = [];

  // Check for null bytes (indicates binary file)
  if (buffer.includes(0)) {
    return { isPlainText: false, isCSV: false, isHTML: false, confidence: 0, warnings: ['File contains null bytes - not text'] };
  }

  // Check if it's HTML
  const htmlPatterns = [
    /<!DOCTYPE\s+html/i,
    /<html\s/i,
    /<head\s/i,
    /<body\s/i,
    /<script/i,
    /<div\s/i,
  ];

  const htmlMatches = htmlPatterns.filter(pattern => pattern.test(content)).length;
  const isHTML = htmlMatches >= 2;

  // Check if it's CSV
  const csvPatterns = [
    /^[^,]+,[^,]+/, // Basic CSV structure
    /"[^"]*","[^"]*"/, // Quoted CSV
  ];

  const lines = content.split('\n').slice(0, 10); // First 10 lines
  const csvLines = lines.filter(line => {
    const trimmedLine = line.trim();
    return csvPatterns.some(pattern => pattern.test(trimmedLine));
  }).length;

  const isCSV = csvLines >= Math.min(3, lines.length * 0.6);

  // Check if it's plain text
  const printableChars = buffer.filter(byte =>
    (byte >= 32 && byte <= 126) || // Printable ASCII
    byte === 9 || byte === 10 || byte === 13 // Tab, LF, CR
  ).length;

  const printableRatio = printableChars / buffer.length;
  const isPlainText = printableRatio > 0.9 && !isHTML && !isCSV;

  // Calculate confidence
  let confidence = 0;
  if (isHTML) confidence = 0.9;
  else if (isCSV) confidence = 0.8;
  else if (isPlainText) confidence = 0.8;

  // Add warnings for suspicious content
  if (content.includes('<script') && !isHTML) {
    warnings.push('File contains script tags but is not detected as HTML');
  }

  if (content.includes('eval(') || content.includes('exec(')) {
    warnings.push('File contains potentially dangerous function calls');
  }

  return { isPlainText, isCSV, isHTML, confidence, warnings };
}

/**
 * Comprehensive MIME type validation
 */
export function validateMimeType(
  declaredMimeType: string,
  fileName: string,
  fileBuffer: Buffer
): MimeTypeDetection {
  const warnings: string[] = [];

  // Detect by extension
  const detectedByExtension = detectMimeTypeByExtension(fileName);

  // Detect by magic bytes
  const magicByteDetections = detectMimeTypeByMagicBytes(fileBuffer);
  const detectedByMagicBytes = magicByteDetections.map(d => d.mimeType);

  // Determine recommended MIME type
  let recommendedMimeType = declaredMimeType;
  let confidence = 0.5; // Base confidence

  // Trust magic bytes the most
  if (magicByteDetections.length > 0) {
    const bestMatch = magicByteDetections[0];
    if (bestMatch) {
      recommendedMimeType = bestMatch.mimeType;
      confidence = bestMatch.confidence;
    }
  }

  // Fall back to extension detection if no magic bytes match
  if (detectedByMagicBytes.length === 0 && detectedByExtension !== 'application/octet-stream') {
    recommendedMimeType = detectedByExtension;
    confidence = 0.6;
  }

  // Special handling for text files
  if (declaredMimeType.startsWith('text/') || detectedByExtension === '.txt' || detectedByExtension === '.csv') {
    const textAnalysis = analyzeTextContent(fileBuffer);

    if (textAnalysis.isHTML && declaredMimeType === 'text/plain') {
      recommendedMimeType = 'text/html';
      warnings.push('File appears to be HTML but declared as plain text');
    } else if (textAnalysis.isCSV && declaredMimeType === 'text/plain') {
      recommendedMimeType = 'text/csv';
      warnings.push('File appears to be CSV but declared as plain text');
    }

    warnings.push(...textAnalysis.warnings);
  }

  // Check for MIME type consistency
  const isConsistent =
    declaredMimeType === recommendedMimeType ||
    detectedByMagicBytes.includes(declaredMimeType) ||
    detectedByExtension === declaredMimeType;

  // Add warnings for inconsistencies
  if (!isConsistent) {
    if (declaredMimeType !== recommendedMimeType) {
      warnings.push(`Declared MIME type (${declaredMimeType}) doesn't match detected type (${recommendedMimeType})`);
    }

    if (detectedByMagicBytes.length > 0 && !detectedByMagicBytes.includes(declaredMimeType)) {
      warnings.push(`File signature doesn't match declared MIME type: ${declaredMimeType}`);
    }
  }

  // Special warnings for dangerous MIME types
  if (DANGEROUS_MIME_TYPES.has(declaredMimeType)) {
    warnings.push(`Dangerous MIME type detected: ${declaredMimeType}`);
  }

  // Check for container MIME types that might contain malicious content
  if (CONTAINER_MIME_TYPES.has(recommendedMimeType)) {
    warnings.push(`Container file detected - contents should be scanned for malware`);
  }

  return {
    declaredMimeType,
    detectedByMagicBytes,
    detectedByExtension,
    confidence,
    isConsistent,
    recommendedMimeType,
    warnings,
  };
}

/**
 * Check if MIME type is allowed for upload
 */
export function isMimeTypeAllowed(
  mimeType: string,
  allowedMimeTypes: string[] = []
): { allowed: boolean; reason?: string } {
  // If no allow list provided, use default safe list
  const allowedList = allowedMimeTypes.length > 0
    ? allowedMimeTypes
    : Object.keys(MIME_TYPE_EXTENSIONS);

  // Check dangerous MIME types
  if (DANGEROUS_MIME_TYPES.has(mimeType)) {
    return { allowed: false, reason: `Dangerous MIME type not allowed: ${mimeType}` };
  }

  // Check if in allowed list
  if (!allowedList.includes(mimeType)) {
    return { allowed: false, reason: `MIME type not in allowed list: ${mimeType}` };
  }

  return { allowed: true };
}

/**
 * Get MIME type category for additional validation
 */
export function getMimeTypeCategory(mimeType: string): {
  category: 'document' | 'image' | 'text' | 'archive' | 'other';
  riskLevel: 'low' | 'medium' | 'high';
  requiresScanning: boolean;
} {
  if (mimeType.startsWith('image/')) {
    return {
      category: 'image',
      riskLevel: SAFE_MIME_TYPES.has(mimeType) ? 'low' : 'medium',
      requiresScanning: false,
    };
  }

  if (mimeType.startsWith('text/')) {
    return {
      category: 'text',
      riskLevel: mimeType === 'text/html' ? 'medium' : 'low',
      requiresScanning: mimeType === 'text/html',
    };
  }

  if ([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ].includes(mimeType)) {
    return {
      category: 'document',
      riskLevel: 'medium',
      requiresScanning: true,
    };
  }

  if ([
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
  ].includes(mimeType)) {
    return {
      category: 'archive',
      riskLevel: 'high',
      requiresScanning: true,
    };
  }

  return {
    category: 'other',
    riskLevel: 'high',
    requiresScanning: true,
  };
}