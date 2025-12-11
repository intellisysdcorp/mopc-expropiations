// Digital Signature types based on Prisma schema

import { ActivityType, SignatureType } from '@/prisma/client';

// Base User type for signature operations
export interface SignatureUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  isActive: boolean;
  isSuspended: boolean;
  createdAt: Date;
}

// User with role information for permission checks
export interface UserWithRole extends SignatureUser {
  role: {
    id: string;
    name: string;
    permissions?: any;
    description?: string;
    isActive: boolean;
  };
}

// Device info structure
export interface DeviceInfo {
  timestamp: string;
  sessionId: string;
  [key: string]: any;
}

// Core Digital Signature type
export interface DigitalSignature {
  id: string;
  userId: string;
  signatureType: SignatureType;
  entityType: string;
  entityId: string;
  signatureData: any; // Json - encrypted signature data

  // Metadata
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: any; // Json
  geolocation?: any; // Json
  biometricData?: any; // Json

  // Delegation
  delegatedBy?: string | null;
  delegationReason?: string | null;

  // Status
  isActive: boolean;
  revokedAt?: Date | null;
  revokedBy?: string | null;
  revokedReason?: string | null;

  createdAt: Date;
}

// Digital Signature with user relations included
export interface DigitalSignatureWithUser extends DigitalSignature {
  user: SignatureUser;
}

// Digital Signature for API responses (without sensitive data)
export interface DigitalSignatureResponse extends Omit<DigitalSignature, 'signatureData'> {
  signatureData: '***ENCRYPTED***';
  user?: SignatureUser;
}

// Types for signature operations
export interface CreateSignatureData {
  userId: string;
  signatureType: SignatureType;
  entityType: string;
  entityId: string;
  signatureData: string; // Base64 encoded string before encryption
  delegatedBy?: string;
  delegationReason?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: DeviceInfo;
}

export interface RevokeSignatureData {
  isActive: false;
  revokedAt: Date;
  revokedBy: string;
  revokedReason: string;
}

export interface SignatureVerificationResult {
  isValid: boolean;
  verifiedAt: Date;
  verifiedBy: string;
  signatureInfo: {
    id: string;
    signatureType: SignatureType;
    entityType: string;
    entityId: string;
    createdAt: Date;
    user: SignatureUser;
  };
}

// Activity types for logging
export interface ActivityMetadata {
  signatureId?: string;
  signatureType?: SignatureType;
  entityType?: string;
  entityId?: string;
  revocationReason?: string;
  verificationResult?: SignatureVerificationResult;
  [key: string]: any;
}

export interface CreateActivityData {
  action: ActivityType;
  entityType: string;
  entityId: string;
  description?: string;
  userId: string;
  metadata?: ActivityMetadata;
}

// Query filters for signature searches
export interface SignatureFilters {
  entityType?: string;
  entityId?: string;
  signatureType?: SignatureType;
  userId?: string;
  isActive?: boolean;
}

// API Request/Response types
export interface CreateSignatureRequest {
  signatureType: SignatureType;
  entityType: string;
  entityId: string;
  signatureData: string; // Base64 encoded
  delegatedBy?: string;
  delegationReason?: string;
}

export interface VerifySignatureRequest {
  signatureId: string;
  verificationData: string;
}

export interface RevokeSignatureRequest {
  reason: string;
}

export interface SignatureCreateResponse {
  id: string;
  userId: string;
  signatureType: SignatureType;
  entityType: string;
  entityId: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: DeviceInfo;
  delegatedBy?: string;
  delegationReason?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
  user: SignatureUser;
}

export interface SignatureRevokeResponse {
  message: string;
  signature: {
    id: string;
    revokedAt: Date | null;
    revokedReason: string | null;
  };
}