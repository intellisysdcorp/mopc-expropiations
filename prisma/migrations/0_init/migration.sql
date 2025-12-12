-- CreateTable
CREATE TABLE `departments` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `headUserId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `departments_code_key`(`code`),
    INDEX `departments_parentId_idx`(`parentId`),
    INDEX `departments_isActive_idx`(`isActive`),
    INDEX `departments_headUserId_idx`(`headUserId`),
    INDEX `departments_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('READ', 'WRITE', 'DELETE', 'ASSIGN', 'SUPERVISE', 'EXPORT', 'IMPORT', 'MANAGE_USERS', 'MANAGE_DEPARTMENTS', 'SYSTEM_CONFIG', 'VIEW_REPORTS', 'APPROVE_DECISIONS', 'VALIDATE_CHECKLISTS', 'SIGN_DOCUMENTS', 'APPROVE_WORKFLOWS', 'MANAGE_REVIEWS', 'CREATE_OBSERVATIONS', 'VIEW_RISK_ASSESSMENT', 'UPLOAD_DOCUMENTS', 'DOWNLOAD_DOCUMENTS', 'VIEW_DOCUMENTS', 'EDIT_DOCUMENTS', 'DELETE_DOCUMENTS', 'MANAGE_DOCUMENT_TEMPLATES', 'MANAGE_DOCUMENT_CATEGORIES', 'APPROVE_DOCUMENTS', 'SHARE_DOCUMENTS', 'VERSION_DOCUMENTS', 'PREVIEW_DOCUMENTS', 'SEARCH_DOCUMENTS', 'BULK_DOWNLOAD_DOCUMENTS', 'MANAGE_DOCUMENT_PERMISSIONS', 'SIGN_DOCUMENTS_DIGITAL', 'AUDIT_DOCUMENTS') NOT NULL,
    `description` VARCHAR(191) NULL,
    `resource` VARCHAR(191) NULL,
    `action` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `permissions_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `isGranted` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `role_permissions_roleId_permissionId_key`(`roleId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `permissions` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isSuspended` BOOLEAN NOT NULL DEFAULT false,
    `suspensionReason` VARCHAR(191) NULL,
    `suspendedAt` DATETIME(3) NULL,
    `suspendedBy` VARCHAR(191) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `lastLoginIp` VARCHAR(191) NULL,
    `lastLoginUserAgent` VARCHAR(191) NULL,
    `loginCount` INTEGER NOT NULL DEFAULT 0,
    `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `passwordResetToken` VARCHAR(191) NULL,
    `passwordResetExpires` DATETIME(3) NULL,
    `passwordChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `jobTitle` VARCHAR(191) NULL,
    `bio` VARCHAR(191) NULL,
    `officeLocation` VARCHAR(191) NULL,
    `workingHours` VARCHAR(191) NULL,
    `preferredLanguage` VARCHAR(191) NOT NULL DEFAULT 'es',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'America/Santo_Domingo',
    `twoFactorEnabled` BOOLEAN NOT NULL DEFAULT false,
    `twoFactorSecret` VARCHAR(191) NULL,
    `backupCodes` VARCHAR(191) NULL,
    `emailNotifications` BOOLEAN NOT NULL DEFAULT true,
    `emailMarketing` BOOLEAN NOT NULL DEFAULT false,
    `emailDigest` BOOLEAN NOT NULL DEFAULT true,
    `theme` VARCHAR(191) NOT NULL DEFAULT 'light',
    `dateRange` VARCHAR(191) NULL,
    `dashboardConfig` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_username_key`(`username`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_username_idx`(`username`),
    INDEX `users_departmentId_idx`(`departmentId`),
    INDEX `users_roleId_idx`(`roleId`),
    INDEX `users_isActive_idx`(`isActive`),
    INDEX `users_isSuspended_idx`(`isSuspended`),
    INDEX `users_lastLoginAt_idx`(`lastLoginAt`),
    INDEX `users_deletedAt_idx`(`deletedAt`),
    INDEX `users_departmentId_isActive_idx`(`departmentId`, `isActive`),
    INDEX `users_isActive_lastLoginAt_idx`(`isActive`, `lastLoginAt`),
    INDEX `users_deletedAt_isActive_idx`(`deletedAt`, `isActive`),
    INDEX `users_roleId_isActive_idx`(`roleId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `sessionToken` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `deviceInfo` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastAccessAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_sessions_sessionToken_key`(`sessionToken`),
    INDEX `user_sessions_sessionToken_idx`(`sessionToken`),
    INDEX `user_sessions_userId_idx`(`userId`),
    INDEX `user_sessions_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_histories` (
    `id` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `changedBy` VARCHAR(191) NULL,
    `changeReason` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,

    INDEX `password_histories_userId_idx`(`userId`),
    INDEX `password_histories_changedAt_idx`(`changedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_department_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignedBy` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `permissions` VARCHAR(191) NULL,

    INDEX `user_department_assignments_userId_idx`(`userId`),
    INDEX `user_department_assignments_departmentId_idx`(`departmentId`),
    UNIQUE INDEX `user_department_assignments_userId_departmentId_key`(`userId`, `departmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cases` (
    `id` VARCHAR(191) NOT NULL,
    `fileNumber` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `currentStage` ENUM('RECEPCION_SOLICITUD', 'VERIFICACION_REQUISITOS', 'CARGA_DOCUMENTOS', 'ASIGNACION_ANALISTA', 'ANALISIS_PRELIMINAR', 'NOTIFICACION_PROPIETARIO', 'PERITAJE_TECNICO', 'DETERMINACION_VALOR', 'OFERTA_COMPRA', 'NEGOCIACION', 'APROBACION_ACUERDO', 'ELABORACION_ESCRITURA', 'FIRMA_DOCUMENTOS', 'REGISTRO_PROPIEDAD', 'DESEMBOLSO_PAGO', 'ENTREGA_INMUEBLE', 'CIERRE_ARCHIVO', 'SUSPENDED', 'CANCELLED') NOT NULL DEFAULT 'RECEPCION_SOLICITUD',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('PENDIENTE', 'EN_PROGRESO', 'COMPLETADO', 'ARCHIVED', 'SUSPENDED', 'CANCELLED') NOT NULL DEFAULT 'PENDIENTE',
    `isDraft` BOOLEAN NOT NULL DEFAULT true,
    `startDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expectedEndDate` DATETIME(3) NULL,
    `actualEndDate` DATETIME(3) NULL,
    `propertyAddress` VARCHAR(191) NOT NULL,
    `propertyCity` VARCHAR(191) NOT NULL,
    `propertyProvince` VARCHAR(191) NOT NULL,
    `propertyDescription` VARCHAR(191) NULL,
    `propertyCoordinates` VARCHAR(191) NULL,
    `propertyArea` DOUBLE NULL,
    `propertyType` VARCHAR(191) NULL,
    `ownerName` VARCHAR(191) NOT NULL,
    `ownerIdentification` VARCHAR(191) NULL,
    `ownerContact` VARCHAR(191) NULL,
    `ownerEmail` VARCHAR(191) NULL,
    `ownerAddress` VARCHAR(191) NULL,
    `ownerType` VARCHAR(191) NULL,
    `estimatedValue` DOUBLE NULL,
    `actualValue` DOUBLE NULL,
    `appraisalValue` DOUBLE NULL,
    `compensationAmount` DOUBLE NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'DOP',
    `expropriationDecree` VARCHAR(191) NULL,
    `judicialCaseNumber` VARCHAR(191) NULL,
    `legalStatus` VARCHAR(191) NULL,
    `progressPercentage` DOUBLE NOT NULL DEFAULT 0,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `assignedToId` VARCHAR(191) NULL,
    `supervisedById` VARCHAR(191) NULL,

    UNIQUE INDEX `cases_fileNumber_key`(`fileNumber`),
    INDEX `cases_fileNumber_idx`(`fileNumber`),
    INDEX `cases_currentStage_idx`(`currentStage`),
    INDEX `cases_priority_idx`(`priority`),
    INDEX `cases_status_idx`(`status`),
    INDEX `cases_departmentId_idx`(`departmentId`),
    INDEX `cases_createdById_idx`(`createdById`),
    INDEX `cases_assignedToId_idx`(`assignedToId`),
    INDEX `cases_supervisedById_idx`(`supervisedById`),
    INDEX `cases_createdAt_idx`(`createdAt`),
    INDEX `cases_startDate_idx`(`startDate`),
    INDEX `cases_expectedEndDate_idx`(`expectedEndDate`),
    INDEX `cases_deletedAt_idx`(`deletedAt`),
    INDEX `cases_ownerName_idx`(`ownerName`),
    INDEX `cases_propertyAddress_idx`(`propertyAddress`),
    INDEX `cases_departmentId_status_idx`(`departmentId`, `status`),
    INDEX `cases_status_priority_idx`(`status`, `priority`),
    INDEX `cases_departmentId_currentStage_idx`(`departmentId`, `currentStage`),
    INDEX `cases_createdAt_expectedEndDate_idx`(`createdAt`, `expectedEndDate`),
    INDEX `cases_deletedAt_status_idx`(`deletedAt`, `status`),
    INDEX `cases_deletedAt_departmentId_idx`(`deletedAt`, `departmentId`),
    INDEX `cases_status_currentStage_idx`(`status`, `currentStage`),
    INDEX `cases_departmentId_priority_idx`(`departmentId`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `originalFileName` VARCHAR(191) NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `fileHash` VARCHAR(191) NULL,
    `documentType` ENUM('LEGAL_DOCUMENT', 'TECHNICAL_REPORT', 'FINANCIAL_RECORD', 'PROPERTY_DOCUMENT', 'IDENTIFICATION_DOCUMENT', 'NOTIFICATION_DOCUMENT', 'CONTRACT_DOCUMENT', 'PHOTOGRAPH', 'VIDEO', 'AUDIO', 'SPREADSHEET', 'PRESENTATION', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `category` ENUM('LEGAL', 'TECHNICAL', 'FINANCIAL', 'ADMINISTRATIVE', 'COMMUNICATION', 'PHOTOGRAPHIC', 'MULTIMEDIA', 'TEMPLATE', 'REFERENCE', 'CORRESPONDENCE') NOT NULL DEFAULT 'ADMINISTRATIVE',
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED', 'EXPIRED', 'UNDER_REVIEW', 'FINAL', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
    `securityLevel` ENUM('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET') NOT NULL DEFAULT 'INTERNAL',
    `version` INTEGER NOT NULL DEFAULT 1,
    `isLatest` BOOLEAN NOT NULL DEFAULT true,
    `isDraft` BOOLEAN NOT NULL DEFAULT true,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `isEncrypted` BOOLEAN NOT NULL DEFAULT false,
    `encryptionKey` VARCHAR(191) NULL,
    `tags` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `customFields` JSON NULL,
    `expiresAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `archivedBy` VARCHAR(191) NULL,
    `retentionPeriod` INTEGER NULL,
    `contentText` VARCHAR(191) NULL,
    `isIndexed` BOOLEAN NOT NULL DEFAULT false,
    `indexedAt` DATETIME(3) NULL,
    `thumbnailPath` VARCHAR(191) NULL,
    `previewGenerated` BOOLEAN NOT NULL DEFAULT false,
    `storageType` ENUM('LOCAL', 'CLOUD', 'HYBRID', 'BACKUP', 'ARCHIVE') NOT NULL DEFAULT 'LOCAL',
    `storageLocation` VARCHAR(191) NULL,
    `backupLocation` VARCHAR(191) NULL,
    `downloadCount` INTEGER NOT NULL DEFAULT 0,
    `viewCount` INTEGER NOT NULL DEFAULT 0,
    `lastAccessedAt` DATETIME(3) NULL,
    `lastAccessedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `caseId` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `templateId` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NULL,

    INDEX `documents_caseId_idx`(`caseId`),
    INDEX `documents_uploadedById_idx`(`uploadedById`),
    INDEX `documents_documentType_idx`(`documentType`),
    INDEX `documents_category_idx`(`category`),
    INDEX `documents_status_idx`(`status`),
    INDEX `documents_securityLevel_idx`(`securityLevel`),
    INDEX `documents_version_idx`(`version`),
    INDEX `documents_isLatest_idx`(`isLatest`),
    INDEX `documents_isPublic_idx`(`isPublic`),
    INDEX `documents_createdAt_idx`(`createdAt`),
    INDEX `documents_expiresAt_idx`(`expiresAt`),
    INDEX `documents_fileHash_idx`(`fileHash`),
    INDEX `documents_contentText_idx`(`contentText`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `case_histories` (
    `id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `field` VARCHAR(191) NULL,
    `previousValue` VARCHAR(191) NULL,
    `newValue` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `duration` INTEGER NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `caseId` VARCHAR(191) NOT NULL,
    `changedById` VARCHAR(191) NOT NULL,

    INDEX `case_histories_caseId_idx`(`caseId`),
    INDEX `case_histories_changedById_idx`(`changedById`),
    INDEX `case_histories_action_idx`(`action`),
    INDEX `case_histories_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activities` (
    `id` VARCHAR(191) NOT NULL,
    `action` ENUM('CREATED', 'UPDATED', 'DELETED', 'ASSIGNED', 'REASSIGNED', 'APPROVED', 'REJECTED', 'COMMENTED', 'UPLOADED', 'DOWNLOADED', 'VIEWED', 'ARCHIVED', 'RESTORED', 'EXPORTED', 'IMPORTED', 'LOGIN', 'LOGOUT', 'STATUS_CHANGED', 'STAGE_CHANGED', 'PROPERTY_UPDATED', 'OWNER_UPDATED', 'FINANCIAL_UPDATED', 'LEGAL_UPDATED', 'NOTE_ADDED', 'DOCUMENT_ADDED', 'ASSIGNMENT_CHANGED', 'PRIORITY_CHANGED') NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NULL,

    INDEX `activities_userId_idx`(`userId`),
    INDEX `activities_action_idx`(`action`),
    INDEX `activities_entityType_idx`(`entityType`),
    INDEX `activities_entityId_idx`(`entityId`),
    INDEX `activities_createdAt_idx`(`createdAt`),
    INDEX `activities_caseId_idx`(`caseId`),
    INDEX `activities_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `activities_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `activities_createdAt_userId_idx`(`createdAt`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `case_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `caseId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `case_assignments_caseId_userId_type_key`(`caseId`, `userId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_queue` (
    `id` VARCHAR(191) NOT NULL,
    `to` VARCHAR(191) NOT NULL,
    `cc` VARCHAR(191) NULL,
    `bcc` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `textContent` VARCHAR(191) NULL,
    `htmlContent` VARCHAR(191) NULL,
    `fromName` VARCHAR(191) NULL,
    `fromEmail` VARCHAR(191) NULL,
    `replyTo` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `scheduledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `provider` VARCHAR(191) NULL,
    `templateId` VARCHAR(191) NULL,
    `messageId` VARCHAR(191) NULL,
    `openedAt` DATETIME(3) NULL,
    `clickedAt` DATETIME(3) NULL,
    `bouncedAt` DATETIME(3) NULL,
    `bouncedReason` VARCHAR(191) NULL,
    `unsubscribedAt` DATETIME(3) NULL,
    `error` JSON NULL,
    `retryAfter` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `correlationId` VARCHAR(191) NULL,
    `batchId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `email_queue_status_idx`(`status`),
    INDEX `email_queue_priority_idx`(`priority`),
    INDEX `email_queue_scheduledAt_idx`(`scheduledAt`),
    INDEX `email_queue_sentAt_idx`(`sentAt`),
    INDEX `email_queue_batchId_idx`(`batchId`),
    INDEX `email_queue_correlationId_idx`(`correlationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reminder_configs` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `schedule` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `conditions` JSON NOT NULL,
    `templateId` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NULL,
    `message` VARCHAR(191) NULL,
    `recipients` JSON NOT NULL,
    `channels` JSON NOT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `maxReminders` INTEGER NOT NULL DEFAULT 3,
    `reminderInterval` INTEGER NOT NULL DEFAULT 24,
    `metadata` JSON NULL,
    `tags` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `reminder_configs_type_idx`(`type`),
    INDEX `reminder_configs_isActive_idx`(`isActive`),
    INDEX `reminder_configs_schedule_idx`(`schedule`),
    INDEX `reminder_configs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reminder_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `configId` VARCHAR(191) NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `executedAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `result` JSON NULL,
    `error` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `entityType` VARCHAR(191) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `nextRetryAt` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `correlationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `reminder_jobs_configId_idx`(`configId`),
    INDEX `reminder_jobs_status_idx`(`status`),
    INDEX `reminder_jobs_scheduledAt_idx`(`scheduledAt`),
    INDEX `reminder_jobs_executedAt_idx`(`executedAt`),
    INDEX `reminder_jobs_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `reminder_jobs_correlationId_idx`(`correlationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerAccountId` VARCHAR(191) NOT NULL,
    `refresh_token` VARCHAR(191) NULL,
    `access_token` VARCHAR(191) NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NULL,
    `id_token` VARCHAR(191) NULL,
    `session_state` VARCHAR(191) NULL,

    UNIQUE INDEX `accounts_provider_providerAccountId_key`(`provider`, `providerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(191) NOT NULL,
    `sessionToken` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sessions_sessionToken_key`(`sessionToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification_tokens` (
    `identifier` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `verification_tokens_token_key`(`token`),
    UNIQUE INDEX `verification_tokens_identifier_token_key`(`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_versions` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `fileHash` VARCHAR(191) NULL,
    `changeSummary` VARCHAR(191) NULL,
    `isMajorVersion` BOOLEAN NOT NULL DEFAULT false,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `diffData` JSON NULL,
    `checksum` VARCHAR(191) NULL,
    `compressedSize` INTEGER NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `publishedAt` DATETIME(3) NULL,
    `previousVersionId` VARCHAR(191) NULL,

    INDEX `document_versions_documentId_idx`(`documentId`),
    INDEX `document_versions_version_idx`(`version`),
    INDEX `document_versions_isActive_idx`(`isActive`),
    INDEX `document_versions_isPublished_idx`(`isPublished`),
    INDEX `document_versions_createdBy_idx`(`createdBy`),
    INDEX `document_versions_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `document_versions_documentId_version_key`(`documentId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_category_refs` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `category` ENUM('LEGAL', 'TECHNICAL', 'FINANCIAL', 'ADMINISTRATIVE', 'COMMUNICATION', 'PHOTOGRAPHIC', 'MULTIMEDIA', 'TEMPLATE', 'REFERENCE', 'CORRESPONDENCE') NOT NULL,
    `color` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `parentId` VARCHAR(191) NULL,
    `allowedTypes` JSON NULL,
    `defaultSecurity` ENUM('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET') NOT NULL DEFAULT 'INTERNAL',
    `retentionPeriod` INTEGER NULL,
    `autoArchiveRules` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `document_category_refs_name_key`(`name`),
    INDEX `document_category_refs_category_idx`(`category`),
    INDEX `document_category_refs_isActive_idx`(`isActive`),
    INDEX `document_category_refs_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `templateType` ENUM('LEGAL_TEMPLATE', 'FORM_TEMPLATE', 'REPORT_TEMPLATE', 'LETTER_TEMPLATE', 'CONTRACT_TEMPLATE', 'MEMO_TEMPLATE', 'CERTIFICATE_TEMPLATE', 'NOTIFICATION_TEMPLATE') NOT NULL,
    `category` ENUM('LEGAL', 'TECHNICAL', 'FINANCIAL', 'ADMINISTRATIVE', 'COMMUNICATION', 'PHOTOGRAPHIC', 'MULTIMEDIA', 'TEMPLATE', 'REFERENCE', 'CORRESPONDENCE') NOT NULL DEFAULT 'ADMINISTRATIVE',
    `content` VARCHAR(191) NOT NULL,
    `variables` JSON NULL,
    `placeholders` JSON NULL,
    `layout` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `usageCount` INTEGER NOT NULL DEFAULT 0,
    `lastUsedAt` DATETIME(3) NULL,
    `securityLevel` ENUM('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET') NOT NULL DEFAULT 'INTERNAL',
    `allowedRoles` JSON NULL,
    `requiredFields` JSON NULL,
    `requiresApproval` BOOLEAN NOT NULL DEFAULT false,
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_templates_templateType_idx`(`templateType`),
    INDEX `document_templates_category_idx`(`category`),
    INDEX `document_templates_isActive_idx`(`isActive`),
    INDEX `document_templates_isDefault_idx`(`isDefault`),
    INDEX `document_templates_createdBy_idx`(`createdBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_template_versions` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `changeLog` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `document_template_versions_templateId_idx`(`templateId`),
    INDEX `document_template_versions_version_idx`(`version`),
    UNIQUE INDEX `document_template_versions_templateId_version_key`(`templateId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `roleId` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `canView` BOOLEAN NOT NULL DEFAULT false,
    `canEdit` BOOLEAN NOT NULL DEFAULT false,
    `canDelete` BOOLEAN NOT NULL DEFAULT false,
    `canDownload` BOOLEAN NOT NULL DEFAULT false,
    `canShare` BOOLEAN NOT NULL DEFAULT false,
    `canSign` BOOLEAN NOT NULL DEFAULT false,
    `canApprove` BOOLEAN NOT NULL DEFAULT false,
    `expiresAt` DATETIME(3) NULL,
    `accessCount` INTEGER NOT NULL DEFAULT 0,
    `lastAccessed` DATETIME(3) NULL,
    `grantedBy` VARCHAR(191) NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reason` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_permissions_documentId_idx`(`documentId`),
    INDEX `document_permissions_userId_idx`(`userId`),
    INDEX `document_permissions_roleId_idx`(`roleId`),
    INDEX `document_permissions_departmentId_idx`(`departmentId`),
    INDEX `document_permissions_isActive_idx`(`isActive`),
    INDEX `document_permissions_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `document_permissions_documentId_userId_roleId_departmentId_key`(`documentId`, `userId`, `roleId`, `departmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_histories` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `action` ENUM('UPLOADED', 'DOWNLOADED', 'VIEWED', 'EDITED', 'DELETED', 'ARCHIVED', 'RESTORED', 'SHARED', 'SIGNED', 'APPROVED', 'REJECTED', 'VERSIONED', 'COPIED', 'MOVED', 'TAGGED', 'CATEGORIZED') NOT NULL,
    `field` VARCHAR(191) NULL,
    `previousValue` VARCHAR(191) NULL,
    `newValue` VARCHAR(191) NULL,
    `changeReason` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `userId` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `fileName` VARCHAR(191) NULL,
    `filePath` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `document_histories_documentId_idx`(`documentId`),
    INDEX `document_histories_action_idx`(`action`),
    INDEX `document_histories_userId_idx`(`userId`),
    INDEX `document_histories_createdAt_idx`(`createdAt`),
    INDEX `document_histories_field_idx`(`field`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_tags` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `document_tags_documentId_idx`(`documentId`),
    INDEX `document_tags_tag_idx`(`tag`),
    INDEX `document_tags_isActive_idx`(`isActive`),
    UNIQUE INDEX `document_tags_documentId_tag_key`(`documentId`, `tag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_actions` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `action` ENUM('UPLOADED', 'DOWNLOADED', 'VIEWED', 'EDITED', 'DELETED', 'ARCHIVED', 'RESTORED', 'SHARED', 'SIGNED', 'APPROVED', 'REJECTED', 'VERSIONED', 'COPIED', 'MOVED', 'TAGGED', 'CATEGORIZED') NOT NULL,
    `metadata` JSON NULL,
    `duration` INTEGER NULL,
    `userId` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `geolocation` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `document_actions_documentId_idx`(`documentId`),
    INDEX `document_actions_action_idx`(`action`),
    INDEX `document_actions_userId_idx`(`userId`),
    INDEX `document_actions_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_shares` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `shareToken` VARCHAR(191) NOT NULL,
    `shareType` VARCHAR(191) NOT NULL,
    `permissions` JSON NOT NULL,
    `password` VARCHAR(191) NULL,
    `maxViews` INTEGER NULL,
    `currentViews` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NULL,
    `sharedBy` VARCHAR(191) NOT NULL,
    `sharedWith` VARCHAR(191) NULL,
    `message` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastAccessed` DATETIME(3) NULL,

    UNIQUE INDEX `document_shares_shareToken_key`(`shareToken`),
    INDEX `document_shares_documentId_idx`(`documentId`),
    INDEX `document_shares_shareToken_idx`(`shareToken`),
    INDEX `document_shares_sharedBy_idx`(`sharedBy`),
    INDEX `document_shares_expiresAt_idx`(`expiresAt`),
    INDEX `document_shares_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_workflows` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `workflowType` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `steps` JSON NOT NULL,
    `currentStep` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `initiatedBy` VARCHAR(191) NOT NULL,
    `initiatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `completedBy` VARCHAR(191) NULL,
    `formData` JSON NULL,
    `decisions` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_workflows_documentId_idx`(`documentId`),
    INDEX `document_workflows_workflowType_idx`(`workflowType`),
    INDEX `document_workflows_status_idx`(`status`),
    INDEX `document_workflows_initiatedBy_idx`(`initiatedBy`),
    INDEX `document_workflows_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_workflow_steps` (
    `id` VARCHAR(191) NOT NULL,
    `workflowId` VARCHAR(191) NOT NULL,
    `stepOrder` INTEGER NOT NULL,
    `stepType` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `assignees` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `assignedTo` VARCHAR(191) NULL,
    `assignedAt` DATETIME(3) NULL,
    `completedBy` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `decision` VARCHAR(191) NULL,
    `comments` VARCHAR(191) NULL,
    `attachments` JSON NULL,
    `dueDate` DATETIME(3) NULL,
    `completedIn` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_workflow_steps_workflowId_idx`(`workflowId`),
    INDEX `document_workflow_steps_stepOrder_idx`(`stepOrder`),
    INDEX `document_workflow_steps_status_idx`(`status`),
    INDEX `document_workflow_steps_assignedTo_idx`(`assignedTo`),
    INDEX `document_workflow_steps_dueDate_idx`(`dueDate`),
    UNIQUE INDEX `document_workflow_steps_workflowId_stepOrder_key`(`workflowId`, `stepOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_comments` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `isEdited` BOOLEAN NOT NULL DEFAULT false,
    `editedAt` DATETIME(3) NULL,
    `isResolved` BOOLEAN NOT NULL DEFAULT false,
    `resolvedBy` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `page` INTEGER NULL,
    `position` JSON NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_comments_documentId_idx`(`documentId`),
    INDEX `document_comments_parentId_idx`(`parentId`),
    INDEX `document_comments_createdBy_idx`(`createdBy`),
    INDEX `document_comments_isResolved_idx`(`isResolved`),
    INDEX `document_comments_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_configs` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'string',
    `category` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_configs_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `department_stage_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `stage` ENUM('RECEPCION_SOLICITUD', 'VERIFICACION_REQUISITOS', 'CARGA_DOCUMENTOS', 'ASIGNACION_ANALISTA', 'ANALISIS_PRELIMINAR', 'NOTIFICACION_PROPIETARIO', 'PERITAJE_TECNICO', 'DETERMINACION_VALOR', 'OFERTA_COMPRA', 'NEGOCIACION', 'APROBACION_ACUERDO', 'ELABORACION_ESCRITURA', 'FIRMA_DOCUMENTOS', 'REGISTRO_PROPIEDAD', 'DESEMBOLSO_PAGO', 'ENTREGA_INMUEBLE', 'CIERRE_ARCHIVO', 'SUSPENDED', 'CANCELLED') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignedBy` VARCHAR(191) NULL,

    INDEX `department_stage_assignments_departmentId_idx`(`departmentId`),
    INDEX `department_stage_assignments_stage_idx`(`stage`),
    UNIQUE INDEX `department_stage_assignments_departmentId_stage_key`(`departmentId`, `stage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `department_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `isGranted` BOOLEAN NOT NULL DEFAULT true,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignedBy` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,

    INDEX `department_permissions_departmentId_idx`(`departmentId`),
    INDEX `department_permissions_permissionId_idx`(`permissionId`),
    UNIQUE INDEX `department_permissions_departmentId_permissionId_key`(`departmentId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `department_transfers` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `sourceDepartmentId` VARCHAR(191) NOT NULL,
    `destinationDepartmentId` VARCHAR(191) NOT NULL,
    `transferType` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `effectiveDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `scheduledFor` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `department_transfers_userId_idx`(`userId`),
    INDEX `department_transfers_sourceDepartmentId_idx`(`sourceDepartmentId`),
    INDEX `department_transfers_destinationDepartmentId_idx`(`destinationDepartmentId`),
    INDEX `department_transfers_status_idx`(`status`),
    INDEX `department_transfers_effectiveDate_idx`(`effectiveDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stages` (
    `id` VARCHAR(191) NOT NULL,
    `stage` ENUM('RECEPCION_SOLICITUD', 'VERIFICACION_REQUISITOS', 'CARGA_DOCUMENTOS', 'ASIGNACION_ANALISTA', 'ANALISIS_PRELIMINAR', 'NOTIFICACION_PROPIETARIO', 'PERITAJE_TECNICO', 'DETERMINACION_VALOR', 'OFERTA_COMPRA', 'NEGOCIACION', 'APROBACION_ACUERDO', 'ELABORACION_ESCRITURA', 'FIRMA_DOCUMENTOS', 'REGISTRO_PROPIEDAD', 'DESEMBOLSO_PAGO', 'ENTREGA_INMUEBLE', 'CIERRE_ARCHIVO', 'SUSPENDED', 'CANCELLED') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `sequenceOrder` INTEGER NOT NULL,
    `responsibleDepartment` VARCHAR(191) NOT NULL,
    `estimatedDuration` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `requiredDocuments` JSON NULL,
    `validationRules` JSON NULL,
    `autoAssignmentRules` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stages_stage_key`(`stage`),
    INDEX `stages_sequenceOrder_idx`(`sequenceOrder`),
    INDEX `stages_responsibleDepartment_idx`(`responsibleDepartment`),
    INDEX `stages_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `case_stage_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `stage` ENUM('RECEPCION_SOLICITUD', 'VERIFICACION_REQUISITOS', 'CARGA_DOCUMENTOS', 'ASIGNACION_ANALISTA', 'ANALISIS_PRELIMINAR', 'NOTIFICACION_PROPIETARIO', 'PERITAJE_TECNICO', 'DETERMINACION_VALOR', 'OFERTA_COMPRA', 'NEGOCIACION', 'APROBACION_ACUERDO', 'ELABORACION_ESCRITURA', 'FIRMA_DOCUMENTOS', 'REGISTRO_PROPIEDAD', 'DESEMBOLSO_PAGO', 'ENTREGA_INMUEBLE', 'CIERRE_ARCHIVO', 'SUSPENDED', 'CANCELLED') NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignedBy` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` VARCHAR(191) NULL,

    INDEX `case_stage_assignments_caseId_idx`(`caseId`),
    INDEX `case_stage_assignments_stage_idx`(`stage`),
    INDEX `case_stage_assignments_assignedBy_idx`(`assignedBy`),
    INDEX `case_stage_assignments_dueDate_idx`(`dueDate`),
    INDEX `case_stage_assignments_isActive_idx`(`isActive`),
    UNIQUE INDEX `case_stage_assignments_caseId_stage_key`(`caseId`, `stage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stage_progressions` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `fromStage` ENUM('RECEPCION_SOLICITUD', 'VERIFICACION_REQUISITOS', 'CARGA_DOCUMENTOS', 'ASIGNACION_ANALISTA', 'ANALISIS_PRELIMINAR', 'NOTIFICACION_PROPIETARIO', 'PERITAJE_TECNICO', 'DETERMINACION_VALOR', 'OFERTA_COMPRA', 'NEGOCIACION', 'APROBACION_ACUERDO', 'ELABORACION_ESCRITURA', 'FIRMA_DOCUMENTOS', 'REGISTRO_PROPIEDAD', 'DESEMBOLSO_PAGO', 'ENTREGA_INMUEBLE', 'CIERRE_ARCHIVO', 'SUSPENDED', 'CANCELLED') NULL,
    `toStage` ENUM('RECEPCION_SOLICITUD', 'VERIFICACION_REQUISITOS', 'CARGA_DOCUMENTOS', 'ASIGNACION_ANALISTA', 'ANALISIS_PRELIMINAR', 'NOTIFICACION_PROPIETARIO', 'PERITAJE_TECNICO', 'DETERMINACION_VALOR', 'OFERTA_COMPRA', 'NEGOCIACION', 'APROBACION_ACUERDO', 'ELABORACION_ESCRITURA', 'FIRMA_DOCUMENTOS', 'REGISTRO_PROPIEDAD', 'DESEMBOLSO_PAGO', 'ENTREGA_INMUEBLE', 'CIERRE_ARCHIVO', 'SUSPENDED', 'CANCELLED') NOT NULL,
    `progressionType` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `observations` VARCHAR(191) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `duration` INTEGER NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stage_progressions_caseId_idx`(`caseId`),
    INDEX `stage_progressions_fromStage_idx`(`fromStage`),
    INDEX `stage_progressions_toStage_idx`(`toStage`),
    INDEX `stage_progressions_progressionType_idx`(`progressionType`),
    INDEX `stage_progressions_approvedBy_idx`(`approvedBy`),
    INDEX `stage_progressions_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stage_checklists` (
    `id` VARCHAR(191) NOT NULL,
    `stage` ENUM('RECEPCION_SOLICITUD', 'VERIFICACION_REQUISITOS', 'CARGA_DOCUMENTOS', 'ASIGNACION_ANALISTA', 'ANALISIS_PRELIMINAR', 'NOTIFICACION_PROPIETARIO', 'PERITAJE_TECNICO', 'DETERMINACION_VALOR', 'OFERTA_COMPRA', 'NEGOCIACION', 'APROBACION_ACUERDO', 'ELABORACION_ESCRITURA', 'FIRMA_DOCUMENTOS', 'REGISTRO_PROPIEDAD', 'DESEMBOLSO_PAGO', 'ENTREGA_INMUEBLE', 'CIERRE_ARCHIVO', 'SUSPENDED', 'CANCELLED') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `itemType` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `stage_checklists_stage_idx`(`stage`),
    INDEX `stage_checklists_isRequired_idx`(`isRequired`),
    INDEX `stage_checklists_isActive_idx`(`isActive`),
    UNIQUE INDEX `stage_checklists_stage_sequence_key`(`stage`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checklist_completions` (
    `id` VARCHAR(191) NOT NULL,
    `caseStageId` VARCHAR(191) NOT NULL,
    `checklistId` VARCHAR(191) NOT NULL,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `completedBy` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `attachmentPath` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `checklist_completions_caseStageId_idx`(`caseStageId`),
    INDEX `checklist_completions_checklistId_idx`(`checklistId`),
    INDEX `checklist_completions_isCompleted_idx`(`isCompleted`),
    INDEX `checklist_completions_completedBy_idx`(`completedBy`),
    UNIQUE INDEX `checklist_completions_caseStageId_checklistId_key`(`caseStageId`, `checklistId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checklist_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `stage` ENUM('RECEPCION_SOLICITUD', 'VERIFICACION_REQUISITOS', 'CARGA_DOCUMENTOS', 'ASIGNACION_ANALISTA', 'ANALISIS_PRELIMINAR', 'NOTIFICACION_PROPIETARIO', 'PERITAJE_TECNICO', 'DETERMINACION_VALOR', 'OFERTA_COMPRA', 'NEGOCIACION', 'APROBACION_ACUERDO', 'ELABORACION_ESCRITURA', 'FIRMA_DOCUMENTOS', 'REGISTRO_PROPIEDAD', 'DESEMBOLSO_PAGO', 'ENTREGA_INMUEBLE', 'CIERRE_ARCHIVO', 'SUSPENDED', 'CANCELLED') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,
    `defaultItems` JSON NULL,
    `autoGenerate` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `checklist_templates_stage_idx`(`stage`),
    INDEX `checklist_templates_isActive_idx`(`isActive`),
    UNIQUE INDEX `checklist_templates_name_version_key`(`name`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checklist_items` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` ENUM('DOCUMENT', 'ACTION', 'VERIFICATION', 'APPROVAL', 'INSPECTION', 'SIGNATURE', 'PAYMENT') NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `sequence` INTEGER NOT NULL,
    `estimatedTime` INTEGER NULL,
    `validationRule` VARCHAR(191) NULL,
    `attachmentRequired` BOOLEAN NOT NULL DEFAULT false,
    `attachmentTypes` JSON NULL,
    `dependencies` JSON NULL,
    `autoValidate` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `checklist_items_templateId_idx`(`templateId`),
    INDEX `checklist_items_type_idx`(`type`),
    INDEX `checklist_items_isRequired_idx`(`isRequired`),
    INDEX `checklist_items_isActive_idx`(`isActive`),
    UNIQUE INDEX `checklist_items_templateId_sequence_key`(`templateId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checklist_item_completions` (
    `id` VARCHAR(191) NOT NULL,
    `caseStageId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `completedBy` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `attachmentPath` VARCHAR(191) NULL,
    `validationResult` JSON NULL,
    `validationErrors` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `checklist_item_completions_caseStageId_idx`(`caseStageId`),
    INDEX `checklist_item_completions_itemId_idx`(`itemId`),
    INDEX `checklist_item_completions_isCompleted_idx`(`isCompleted`),
    INDEX `checklist_item_completions_completedBy_idx`(`completedBy`),
    UNIQUE INDEX `checklist_item_completions_caseStageId_itemId_key`(`caseStageId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `digital_signatures` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `signatureType` ENUM('APPROVAL', 'REJECTION', 'REVIEW', 'WITNESS', 'CERTIFICATION', 'VALIDATION') NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `signatureData` JSON NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `deviceInfo` JSON NULL,
    `geolocation` JSON NULL,
    `biometricData` JSON NULL,
    `delegatedBy` VARCHAR(191) NULL,
    `delegationReason` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `revokedAt` DATETIME(3) NULL,
    `revokedBy` VARCHAR(191) NULL,
    `revokedReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `digital_signatures_userId_idx`(`userId`),
    INDEX `digital_signatures_signatureType_idx`(`signatureType`),
    INDEX `digital_signatures_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `digital_signatures_isActive_idx`(`isActive`),
    INDEX `digital_signatures_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_workflows` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `stage` ENUM('RECEPCION_SOLICITUD', 'VERIFICACION_REQUISITOS', 'CARGA_DOCUMENTOS', 'ASIGNACION_ANALISTA', 'ANALISIS_PRELIMINAR', 'NOTIFICACION_PROPIETARIO', 'PERITAJE_TECNICO', 'DETERMINACION_VALOR', 'OFERTA_COMPRA', 'NEGOCIACION', 'APROBACION_ACUERDO', 'ELABORACION_ESCRITURA', 'FIRMA_DOCUMENTOS', 'REGISTRO_PROPIEDAD', 'DESEMBOLSO_PAGO', 'ENTREGA_INMUEBLE', 'CIERRE_ARCHIVO', 'SUSPENDED', 'CANCELLED') NOT NULL,
    `workflowType` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `requiredApprovals` INTEGER NOT NULL DEFAULT 1,
    `approvalMatrix` JSON NULL,
    `autoApproveRules` JSON NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CONDITIONAL', 'DELEGATED', 'ESCALATED') NOT NULL DEFAULT 'PENDING',
    `initiatedBy` VARCHAR(191) NOT NULL,
    `initiatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `completedBy` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NULL,
    `escalatedAt` DATETIME(3) NULL,
    `escalatedTo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `approval_workflows_caseId_idx`(`caseId`),
    INDEX `approval_workflows_stage_idx`(`stage`),
    INDEX `approval_workflows_status_idx`(`status`),
    INDEX `approval_workflows_initiatedBy_idx`(`initiatedBy`),
    INDEX `approval_workflows_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approvals` (
    `id` VARCHAR(191) NOT NULL,
    `workflowId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `approvalLevel` INTEGER NOT NULL,
    `decision` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CONDITIONAL', 'DELEGATED', 'ESCALATED') NOT NULL DEFAULT 'PENDING',
    `comments` VARCHAR(191) NULL,
    `conditions` JSON NULL,
    `delegationTo` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `responseTime` INTEGER NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `approvals_workflowId_idx`(`workflowId`),
    INDEX `approvals_userId_idx`(`userId`),
    INDEX `approvals_decision_idx`(`decision`),
    INDEX `approvals_reviewedAt_idx`(`reviewedAt`),
    UNIQUE INDEX `approvals_workflowId_userId_key`(`workflowId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `time_tracking` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `stage` ENUM('RECEPCION_SOLICITUD', 'VERIFICACION_REQUISITOS', 'CARGA_DOCUMENTOS', 'ASIGNACION_ANALISTA', 'ANALISIS_PRELIMINAR', 'NOTIFICACION_PROPIETARIO', 'PERITAJE_TECNICO', 'DETERMINACION_VALOR', 'OFERTA_COMPRA', 'NEGOCIACION', 'APROBACION_ACUERDO', 'ELABORACION_ESCRITURA', 'FIRMA_DOCUMENTOS', 'REGISTRO_PROPIEDAD', 'DESEMBOLSO_PAGO', 'ENTREGA_INMUEBLE', 'CIERRE_ARCHIVO', 'SUSPENDED', 'CANCELLED') NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `startTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endTime` DATETIME(3) NULL,
    `duration` INTEGER NULL,
    `pausedDuration` INTEGER NULL,
    `reason` VARCHAR(191) NULL,
    `justification` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `alertThreshold` INTEGER NULL,
    `alertSent` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `time_tracking_caseId_idx`(`caseId`),
    INDEX `time_tracking_stage_idx`(`stage`),
    INDEX `time_tracking_action_idx`(`action`),
    INDEX `time_tracking_userId_idx`(`userId`),
    INDEX `time_tracking_startTime_idx`(`startTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `reviewType` ENUM('INTERNAL_CONTROL', 'TECHNICAL_ANALYSIS', 'LEGAL_REVIEW', 'FINANCIAL_REVIEW', 'SUPERVISORY_REVIEW', 'QUALITY_ASSURANCE') NOT NULL,
    `assignedTo` VARCHAR(191) NOT NULL,
    `assignedBy` VARCHAR(191) NOT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `instructions` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NULL,
    `estimatedTime` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ASSIGNED',
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `parallelWith` JSON NULL,
    `dependsOn` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `review_assignments_caseId_idx`(`caseId`),
    INDEX `review_assignments_reviewType_idx`(`reviewType`),
    INDEX `review_assignments_assignedTo_idx`(`assignedTo`),
    INDEX `review_assignments_status_idx`(`status`),
    INDEX `review_assignments_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` VARCHAR(191) NOT NULL,
    `assignmentId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NOT NULL,
    `findings` VARCHAR(191) NOT NULL,
    `recommendations` VARCHAR(191) NULL,
    `conclusion` VARCHAR(191) NOT NULL,
    `rating` INTEGER NULL,
    `decision` VARCHAR(191) NOT NULL,
    `evidence` JSON NULL,
    `attachments` JSON NULL,
    `reviewTime` INTEGER NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `reviews_assignmentId_idx`(`assignmentId`),
    INDEX `reviews_reviewerId_idx`(`reviewerId`),
    INDEX `reviews_decision_idx`(`decision`),
    INDEX `reviews_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `observations` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `stage` ENUM('RECEPCION_SOLICITUD', 'VERIFICACION_REQUISITOS', 'CARGA_DOCUMENTOS', 'ASIGNACION_ANALISTA', 'ANALISIS_PRELIMINAR', 'NOTIFICACION_PROPIETARIO', 'PERITAJE_TECNICO', 'DETERMINACION_VALOR', 'OFERTA_COMPRA', 'NEGOCIACION', 'APROBACION_ACUERDO', 'ELABORACION_ESCRITURA', 'FIRMA_DOCUMENTOS', 'REGISTRO_PROPIEDAD', 'DESEMBOLSO_PAGO', 'ENTREGA_INMUEBLE', 'CIERRE_ARCHIVO', 'SUSPENDED', 'CANCELLED') NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `subcategory` VARCHAR(191) NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'BLOCKING') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('OPEN', 'IN_PROGRESS', 'RESPONDED', 'RESOLVED', 'CLOSED', 'ESCALATED') NOT NULL DEFAULT 'OPEN',
    `observedBy` VARCHAR(191) NOT NULL,
    `assignedTo` VARCHAR(191) NULL,
    `deadline` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `parentObservationId` VARCHAR(191) NULL,
    `responseTo` VARCHAR(191) NULL,
    `tags` VARCHAR(191) NULL,
    `attachments` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `observations_caseId_idx`(`caseId`),
    INDEX `observations_stage_idx`(`stage`),
    INDEX `observations_priority_idx`(`priority`),
    INDEX `observations_status_idx`(`status`),
    INDEX `observations_observedBy_idx`(`observedBy`),
    INDEX `observations_assignedTo_idx`(`assignedTo`),
    INDEX `observations_deadline_idx`(`deadline`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `observation_responses` (
    `id` VARCHAR(191) NOT NULL,
    `observationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `response` VARCHAR(191) NOT NULL,
    `responseType` VARCHAR(191) NOT NULL,
    `attachments` JSON NULL,
    `responseTime` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `observation_responses_observationId_idx`(`observationId`),
    INDEX `observation_responses_userId_idx`(`userId`),
    INDEX `observation_responses_responseType_idx`(`responseType`),
    INDEX `observation_responses_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `validation_rules` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` ENUM('REQUIRED_FIELD', 'DOCUMENT_COMPLETENESS', 'BUSINESS_RULE', 'REGULATORY_COMPLIANCE', 'TIME_LIMIT', 'FINANCIAL_THRESHOLD', 'APPROVAL_MATRIX') NOT NULL,
    `stage` ENUM('RECEPCION_SOLICITUD', 'VERIFICACION_REQUISITOS', 'CARGA_DOCUMENTOS', 'ASIGNACION_ANALISTA', 'ANALISIS_PRELIMINAR', 'NOTIFICACION_PROPIETARIO', 'PERITAJE_TECNICO', 'DETERMINACION_VALOR', 'OFERTA_COMPRA', 'NEGOCIACION', 'APROBACION_ACUERDO', 'ELABORACION_ESCRITURA', 'FIRMA_DOCUMENTOS', 'REGISTRO_PROPIEDAD', 'DESEMBOLSO_PAGO', 'ENTREGA_INMUEBLE', 'CIERRE_ARCHIVO', 'SUSPENDED', 'CANCELLED') NULL,
    `expression` VARCHAR(191) NOT NULL,
    `errorMessage` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL DEFAULT 'ERROR',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,
    `dependsOn` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `validation_rules_type_idx`(`type`),
    INDEX `validation_rules_stage_idx`(`stage`),
    INDEX `validation_rules_isActive_idx`(`isActive`),
    UNIQUE INDEX `validation_rules_name_version_key`(`name`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `validation_executions` (
    `id` VARCHAR(191) NOT NULL,
    `ruleId` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `stage` ENUM('RECEPCION_SOLICITUD', 'VERIFICACION_REQUISITOS', 'CARGA_DOCUMENTOS', 'ASIGNACION_ANALISTA', 'ANALISIS_PRELIMINAR', 'NOTIFICACION_PROPIETARIO', 'PERITAJE_TECNICO', 'DETERMINACION_VALOR', 'OFERTA_COMPRA', 'NEGOCIACION', 'APROBACION_ACUERDO', 'ELABORACION_ESCRITURA', 'FIRMA_DOCUMENTOS', 'REGISTRO_PROPIEDAD', 'DESEMBOLSO_PAGO', 'ENTREGA_INMUEBLE', 'CIERRE_ARCHIVO', 'SUSPENDED', 'CANCELLED') NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `context` JSON NULL,
    `passed` BOOLEAN NOT NULL DEFAULT false,
    `errors` JSON NULL,
    `warnings` JSON NULL,
    `executedBy` VARCHAR(191) NULL,
    `executedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `validation_executions_ruleId_idx`(`ruleId`),
    INDEX `validation_executions_caseId_idx`(`caseId`),
    INDEX `validation_executions_stage_idx`(`stage`),
    INDEX `validation_executions_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `validation_executions_passed_idx`(`passed`),
    INDEX `validation_executions_executedAt_idx`(`executedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `risk_assessments` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `stage` ENUM('RECEPCION_SOLICITUD', 'VERIFICACION_REQUISITOS', 'CARGA_DOCUMENTOS', 'ASIGNACION_ANALISTA', 'ANALISIS_PRELIMINAR', 'NOTIFICACION_PROPIETARIO', 'PERITAJE_TECNICO', 'DETERMINACION_VALOR', 'OFERTA_COMPRA', 'NEGOCIACION', 'APROBACION_ACUERDO', 'ELABORACION_ESCRITURA', 'FIRMA_DOCUMENTOS', 'REGISTRO_PROPIEDAD', 'DESEMBOLSO_PAGO', 'ENTREGA_INMUEBLE', 'CIERRE_ARCHIVO', 'SUSPENDED', 'CANCELLED') NULL,
    `riskFactors` JSON NOT NULL,
    `riskLevel` ENUM('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH', 'CRITICAL') NOT NULL,
    `riskScore` DOUBLE NOT NULL,
    `likelihood` INTEGER NOT NULL,
    `impact` INTEGER NOT NULL,
    `urgency` INTEGER NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `mitigation` VARCHAR(191) NULL,
    `contingency` VARCHAR(191) NULL,
    `assessedBy` VARCHAR(191) NOT NULL,
    `assessmentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validUntil` DATETIME(3) NULL,
    `recommendations` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `risk_assessments_caseId_idx`(`caseId`),
    INDEX `risk_assessments_stage_idx`(`stage`),
    INDEX `risk_assessments_riskLevel_idx`(`riskLevel`),
    INDEX `risk_assessments_riskScore_idx`(`riskScore`),
    INDEX `risk_assessments_assessedBy_idx`(`assessedBy`),
    INDEX `risk_assessments_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `risk_alerts` (
    `id` VARCHAR(191) NOT NULL,
    `riskAssessmentId` VARCHAR(191) NOT NULL,
    `alertType` ENUM('DEADLINE_APPROACHING', 'DEADLINE_EXCEEDED', 'DOCUMENT_MISSING', 'VALIDATION_FAILED', 'APPROVAL_REQUIRED', 'RISK_IDENTIFIED', 'OBSERVATION_OVERDUE', 'ESCALATION_REQUIRED') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `acknowledgedAt` DATETIME(3) NULL,
    `acknowledgedBy` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `resolvedBy` VARCHAR(191) NULL,
    `sendEmail` BOOLEAN NOT NULL DEFAULT true,
    `sendSMS` BOOLEAN NOT NULL DEFAULT false,
    `recipients` JSON NULL,
    `triggerConditions` JSON NULL,
    `escalationRules` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `risk_alerts_riskAssessmentId_idx`(`riskAssessmentId`),
    INDEX `risk_alerts_alertType_idx`(`alertType`),
    INDEX `risk_alerts_severity_idx`(`severity`),
    INDEX `risk_alerts_isActive_idx`(`isActive`),
    INDEX `risk_alerts_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_configurations` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `environment` VARCHAR(191) NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT false,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `validation` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `previousValue` JSON NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `effectiveAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,

    INDEX `system_configurations_category_idx`(`category`),
    INDEX `system_configurations_environment_idx`(`environment`),
    INDEX `system_configurations_effectiveAt_idx`(`effectiveAt`),
    INDEX `system_configurations_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `system_configurations_key_environment_key`(`key`, `environment`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_configuration_history` (
    `id` VARCHAR(191) NOT NULL,
    `configurationId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `oldValue` JSON NULL,
    `newValue` JSON NULL,
    `type` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `changeReason` VARCHAR(191) NULL,
    `changedBy` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_configuration_history_configurationId_idx`(`configurationId`),
    INDEX `system_configuration_history_key_idx`(`key`),
    INDEX `system_configuration_history_category_idx`(`category`),
    INDEX `system_configuration_history_changedBy_idx`(`changedBy`),
    INDEX `system_configuration_history_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NULL,
    `content` VARCHAR(191) NOT NULL,
    `variables` JSON NULL,
    `metadata` JSON NULL,
    `description` VARCHAR(191) NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'es',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `submittedBy` VARCHAR(191) NOT NULL,
    `reviewedBy` VARCHAR(191) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectionReason` VARCHAR(191) NULL,
    `usageCount` INTEGER NOT NULL DEFAULT 0,
    `lastUsedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `system_templates_type_idx`(`type`),
    INDEX `system_templates_category_idx`(`category`),
    INDEX `system_templates_status_idx`(`status`),
    INDEX `system_templates_isActive_idx`(`isActive`),
    INDEX `system_templates_isDefault_idx`(`isDefault`),
    UNIQUE INDEX `system_templates_name_type_version_key`(`name`, `type`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_template_versions` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `variables` JSON NULL,
    `metadata` JSON NULL,
    `changelog` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_template_versions_templateId_idx`(`templateId`),
    INDEX `system_template_versions_version_idx`(`version`),
    INDEX `system_template_versions_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `system_template_versions_templateId_version_key`(`templateId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_template_tests` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `testData` JSON NOT NULL,
    `expectedResult` VARCHAR(191) NULL,
    `actualResult` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `error` VARCHAR(191) NULL,
    `testRunBy` VARCHAR(191) NOT NULL,
    `testRunAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_template_tests_templateId_idx`(`templateId`),
    INDEX `system_template_tests_status_idx`(`status`),
    INDEX `system_template_tests_testRunAt_idx`(`testRunAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `backup_configurations` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `schedule` VARCHAR(191) NOT NULL,
    `retentionDays` INTEGER NOT NULL DEFAULT 30,
    `compression` BOOLEAN NOT NULL DEFAULT true,
    `encryption` BOOLEAN NOT NULL DEFAULT false,
    `encryptionKey` VARCHAR(191) NULL,
    `storageType` VARCHAR(191) NOT NULL,
    `storageConfig` JSON NOT NULL,
    `storagePath` VARCHAR(191) NULL,
    `includeTables` JSON NULL,
    `excludeTables` JSON NULL,
    `includeFiles` BOOLEAN NOT NULL DEFAULT true,
    `filePaths` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `maxBackupSize` INTEGER NULL,
    `verifyIntegrity` BOOLEAN NOT NULL DEFAULT true,
    `notifyOnSuccess` BOOLEAN NOT NULL DEFAULT false,
    `notifyOnFailure` BOOLEAN NOT NULL DEFAULT true,
    `notificationEmail` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastRunAt` DATETIME(3) NULL,
    `nextRunAt` DATETIME(3) NULL,

    INDEX `backup_configurations_isActive_idx`(`isActive`),
    INDEX `backup_configurations_type_idx`(`type`),
    INDEX `backup_configurations_nextRunAt_idx`(`nextRunAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `backup_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `configurationId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `progress` DOUBLE NOT NULL DEFAULT 0,
    `backupSize` INTEGER NULL,
    `compressedSize` INTEGER NULL,
    `filePath` VARCHAR(191) NULL,
    `checksum` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `duration` INTEGER NULL,
    `recordsBackedUp` INTEGER NULL,
    `filesBackedUp` INTEGER NULL,
    `errorMessage` VARCHAR(191) NULL,
    `logs` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `backup_jobs_configurationId_idx`(`configurationId`),
    INDEX `backup_jobs_status_idx`(`status`),
    INDEX `backup_jobs_type_idx`(`type`),
    INDEX `backup_jobs_createdAt_idx`(`createdAt`),
    INDEX `backup_jobs_completedAt_idx`(`completedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `restoration_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `backupJobId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `progress` DOUBLE NOT NULL DEFAULT 0,
    `restoreTables` JSON NULL,
    `restoreFiles` JSON NULL,
    `targetLocation` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `duration` INTEGER NULL,
    `recordsRestored` INTEGER NULL,
    `filesRestored` INTEGER NULL,
    `errorMessage` VARCHAR(191) NULL,
    `logs` VARCHAR(191) NULL,
    `verificationStatus` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `restoration_jobs_backupJobId_idx`(`backupJobId`),
    INDEX `restoration_jobs_status_idx`(`status`),
    INDEX `restoration_jobs_type_idx`(`type`),
    INDEX `restoration_jobs_createdAt_idx`(`createdAt`),
    INDEX `restoration_jobs_completedAt_idx`(`completedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_logs` (
    `id` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `subcategory` VARCHAR(191) NULL,
    `message` VARCHAR(191) NOT NULL,
    `details` JSON NULL,
    `source` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `requestId` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `duration` INTEGER NULL,
    `memoryUsage` INTEGER NULL,
    `cpuUsage` DOUBLE NULL,
    `stackTrace` VARCHAR(191) NULL,
    `tags` JSON NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_logs_level_idx`(`level`),
    INDEX `system_logs_category_idx`(`category`),
    INDEX `system_logs_userId_idx`(`userId`),
    INDEX `system_logs_createdAt_idx`(`createdAt`),
    INDEX `system_logs_sessionId_idx`(`sessionId`),
    INDEX `system_logs_requestId_idx`(`requestId`),
    INDEX `system_logs_ipAddress_idx`(`ipAddress`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_metrics` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `subcategory` VARCHAR(191) NULL,
    `value` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NULL,
    `tags` JSON NULL,
    `warningThreshold` DOUBLE NULL,
    `criticalThreshold` DOUBLE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'normal',
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `performance_metrics_name_idx`(`name`),
    INDEX `performance_metrics_category_idx`(`category`),
    INDEX `performance_metrics_status_idx`(`status`),
    INDEX `performance_metrics_createdAt_idx`(`createdAt`),
    INDEX `performance_metrics_source_idx`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `holiday_calendars` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'DO',
    `region` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `holiday_calendars_year_idx`(`year`),
    INDEX `holiday_calendars_country_idx`(`country`),
    INDEX `holiday_calendars_region_idx`(`region`),
    INDEX `holiday_calendars_isActive_idx`(`isActive`),
    UNIQUE INDEX `holiday_calendars_name_year_country_region_key`(`name`, `year`, `country`, `region`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `holidays` (
    `id` VARCHAR(191) NOT NULL,
    `calendarId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `isRecurring` BOOLEAN NOT NULL DEFAULT false,
    `recurringPattern` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `affectsWork` BOOLEAN NOT NULL DEFAULT true,
    `workCompensation` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `holidays_calendarId_idx`(`calendarId`),
    INDEX `holidays_date_idx`(`date`),
    INDEX `holidays_type_idx`(`type`),
    INDEX `holidays_isActive_idx`(`isActive`),
    UNIQUE INDEX `holidays_calendarId_date_key`(`calendarId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stage_time_configurations` (
    `id` VARCHAR(191) NOT NULL,
    `stage` ENUM('RECEPCION_SOLICITUD', 'VERIFICACION_REQUISITOS', 'CARGA_DOCUMENTOS', 'ASIGNACION_ANALISTA', 'ANALISIS_PRELIMINAR', 'NOTIFICACION_PROPIETARIO', 'PERITAJE_TECNICO', 'DETERMINACION_VALOR', 'OFERTA_COMPRA', 'NEGOCIACION', 'APROBACION_ACUERDO', 'ELABORACION_ESCRITURA', 'FIRMA_DOCUMENTOS', 'REGISTRO_PROPIEDAD', 'DESEMBOLSO_PAGO', 'ENTREGA_INMUEBLE', 'CIERRE_ARCHIVO', 'SUSPENDED', 'CANCELLED') NOT NULL,
    `maxTimeHours` INTEGER NOT NULL,
    `warningThresholdHours` INTEGER NULL,
    `criticalThresholdHours` INTEGER NULL,
    `businessDaysOnly` BOOLEAN NOT NULL DEFAULT true,
    `workHours` JSON NULL,
    `departmentId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `effectiveTo` DATETIME(3) NULL,

    INDEX `stage_time_configurations_stage_idx`(`stage`),
    INDEX `stage_time_configurations_departmentId_idx`(`departmentId`),
    INDEX `stage_time_configurations_isActive_idx`(`isActive`),
    INDEX `stage_time_configurations_effectiveFrom_idx`(`effectiveFrom`),
    UNIQUE INDEX `stage_time_configurations_stage_departmentId_key`(`stage`, `departmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `security_policies` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `configuration` JSON NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `isRequired` BOOLEAN NOT NULL DEFAULT false,
    `enforcementLevel` VARCHAR(191) NOT NULL DEFAULT 'warn',
    `complianceStandard` VARCHAR(191) NULL,
    `lastAuditedAt` DATETIME(3) NULL,
    `auditResults` JSON NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `security_policies_type_idx`(`type`),
    INDEX `security_policies_category_idx`(`category`),
    INDEX `security_policies_isEnabled_idx`(`isEnabled`),
    INDEX `security_policies_enforcementLevel_idx`(`enforcementLevel`),
    UNIQUE INDEX `security_policies_name_type_key`(`name`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usage_statistics` (
    `id` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `subcategory` VARCHAR(191) NULL,
    `metric` VARCHAR(191) NOT NULL,
    `value` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `departmentId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `role` VARCHAR(191) NULL,
    `dimensions` JSON NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `usage_statistics_category_idx`(`category`),
    INDEX `usage_statistics_metric_idx`(`metric`),
    INDEX `usage_statistics_period_idx`(`period`),
    INDEX `usage_statistics_periodStart_idx`(`periodStart`),
    INDEX `usage_statistics_periodEnd_idx`(`periodEnd`),
    INDEX `usage_statistics_departmentId_idx`(`departmentId`),
    INDEX `usage_statistics_userId_idx`(`userId`),
    INDEX `usage_statistics_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_health_checks` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(191) NULL,
    `method` VARCHAR(191) NULL,
    `expectedStatus` INTEGER NULL,
    `timeout` INTEGER NOT NULL DEFAULT 30000,
    `responseTime` INTEGER NULL,
    `statusCode` INTEGER NULL,
    `errorMessage` VARCHAR(191) NULL,
    `details` JSON NULL,
    `checkInterval` INTEGER NOT NULL DEFAULT 300,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `alertOnFailure` BOOLEAN NOT NULL DEFAULT true,
    `alertChannels` JSON NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastCheckedAt` DATETIME(3) NULL,

    INDEX `system_health_checks_category_idx`(`category`),
    INDEX `system_health_checks_status_idx`(`status`),
    INDEX `system_health_checks_isActive_idx`(`isActive`),
    INDEX `system_health_checks_lastCheckedAt_idx`(`lastCheckedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `favorites` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `url` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `favorites_userId_idx`(`userId`),
    INDEX `favorites_type_idx`(`type`),
    INDEX `favorites_itemId_idx`(`itemId`),
    INDEX `favorites_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `favorites_userId_type_itemId_key`(`userId`, `type`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_headUserId_fkey` FOREIGN KEY (`headUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_histories` ADD CONSTRAINT `password_histories_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_department_assignments` ADD CONSTRAINT `user_department_assignments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_department_assignments` ADD CONSTRAINT `user_department_assignments_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cases` ADD CONSTRAINT `cases_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cases` ADD CONSTRAINT `cases_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cases` ADD CONSTRAINT `cases_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cases` ADD CONSTRAINT `cases_supervisedById_fkey` FOREIGN KEY (`supervisedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `document_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `document_category_refs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `case_histories` ADD CONSTRAINT `case_histories_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `case_histories` ADD CONSTRAINT `case_histories_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `case_assignments` ADD CONSTRAINT `case_assignments_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `case_assignments` ADD CONSTRAINT `case_assignments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reminder_jobs` ADD CONSTRAINT `reminder_jobs_configId_fkey` FOREIGN KEY (`configId`) REFERENCES `reminder_configs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_versions` ADD CONSTRAINT `document_versions_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_versions` ADD CONSTRAINT `document_versions_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_versions` ADD CONSTRAINT `document_versions_previousVersionId_fkey` FOREIGN KEY (`previousVersionId`) REFERENCES `document_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_category_refs` ADD CONSTRAINT `document_category_refs_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `document_category_refs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_templates` ADD CONSTRAINT `document_templates_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_template_versions` ADD CONSTRAINT `document_template_versions_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `document_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_template_versions` ADD CONSTRAINT `document_template_versions_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_permissions` ADD CONSTRAINT `document_permissions_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_permissions` ADD CONSTRAINT `document_permissions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_permissions` ADD CONSTRAINT `document_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_permissions` ADD CONSTRAINT `document_permissions_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_histories` ADD CONSTRAINT `document_histories_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_histories` ADD CONSTRAINT `document_histories_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_tags` ADD CONSTRAINT `document_tags_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_actions` ADD CONSTRAINT `document_actions_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_actions` ADD CONSTRAINT `document_actions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_shares` ADD CONSTRAINT `document_shares_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_shares` ADD CONSTRAINT `document_shares_sharedBy_fkey` FOREIGN KEY (`sharedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_workflows` ADD CONSTRAINT `document_workflows_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_workflows` ADD CONSTRAINT `document_workflows_initiatedBy_fkey` FOREIGN KEY (`initiatedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_workflows` ADD CONSTRAINT `document_workflows_completedBy_fkey` FOREIGN KEY (`completedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_workflow_steps` ADD CONSTRAINT `document_workflow_steps_workflowId_fkey` FOREIGN KEY (`workflowId`) REFERENCES `document_workflows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_comments` ADD CONSTRAINT `document_comments_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `document_comments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_comments` ADD CONSTRAINT `document_comments_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_comments` ADD CONSTRAINT `document_comments_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_comments` ADD CONSTRAINT `document_comments_resolvedBy_fkey` FOREIGN KEY (`resolvedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_stage_assignments` ADD CONSTRAINT `department_stage_assignments_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_permissions` ADD CONSTRAINT `department_permissions_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_permissions` ADD CONSTRAINT `department_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_transfers` ADD CONSTRAINT `department_transfers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_transfers` ADD CONSTRAINT `department_transfers_sourceDepartmentId_fkey` FOREIGN KEY (`sourceDepartmentId`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_transfers` ADD CONSTRAINT `department_transfers_destinationDepartmentId_fkey` FOREIGN KEY (`destinationDepartmentId`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `case_stage_assignments` ADD CONSTRAINT `case_stage_assignments_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `case_stage_assignments` ADD CONSTRAINT `case_stage_assignments_stage_fkey` FOREIGN KEY (`stage`) REFERENCES `stages`(`stage`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stage_progressions` ADD CONSTRAINT `stage_progressions_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stage_progressions` ADD CONSTRAINT `stage_progressions_fromStage_fkey` FOREIGN KEY (`fromStage`) REFERENCES `stages`(`stage`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stage_progressions` ADD CONSTRAINT `stage_progressions_toStage_fkey` FOREIGN KEY (`toStage`) REFERENCES `stages`(`stage`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stage_checklists` ADD CONSTRAINT `stage_checklists_stage_fkey` FOREIGN KEY (`stage`) REFERENCES `stages`(`stage`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklist_completions` ADD CONSTRAINT `checklist_completions_caseStageId_fkey` FOREIGN KEY (`caseStageId`) REFERENCES `case_stage_assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklist_completions` ADD CONSTRAINT `checklist_completions_checklistId_fkey` FOREIGN KEY (`checklistId`) REFERENCES `stage_checklists`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklist_items` ADD CONSTRAINT `checklist_items_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `checklist_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklist_item_completions` ADD CONSTRAINT `checklist_item_completions_caseStageId_fkey` FOREIGN KEY (`caseStageId`) REFERENCES `case_stage_assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklist_item_completions` ADD CONSTRAINT `checklist_item_completions_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `checklist_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `digital_signatures` ADD CONSTRAINT `digital_signatures_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `digital_signatures` ADD CONSTRAINT `digital_signatures_entityId_fkey` FOREIGN KEY (`entityId`) REFERENCES `documents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_workflows` ADD CONSTRAINT `approval_workflows_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_workflows` ADD CONSTRAINT `approval_workflows_initiatedBy_fkey` FOREIGN KEY (`initiatedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_workflows` ADD CONSTRAINT `approval_workflows_completedBy_fkey` FOREIGN KEY (`completedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_workflowId_fkey` FOREIGN KEY (`workflowId`) REFERENCES `approval_workflows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_tracking` ADD CONSTRAINT `time_tracking_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_tracking` ADD CONSTRAINT `time_tracking_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_assignments` ADD CONSTRAINT `review_assignments_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_assignments` ADD CONSTRAINT `review_assignments_assignedTo_fkey` FOREIGN KEY (`assignedTo`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_assignments` ADD CONSTRAINT `review_assignments_assignedBy_fkey` FOREIGN KEY (`assignedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `review_assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `observations` ADD CONSTRAINT `observations_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `observations` ADD CONSTRAINT `observations_observedBy_fkey` FOREIGN KEY (`observedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `observations` ADD CONSTRAINT `observations_assignedTo_fkey` FOREIGN KEY (`assignedTo`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `observations` ADD CONSTRAINT `observations_parentObservationId_fkey` FOREIGN KEY (`parentObservationId`) REFERENCES `observations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `observation_responses` ADD CONSTRAINT `observation_responses_observationId_fkey` FOREIGN KEY (`observationId`) REFERENCES `observations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `observation_responses` ADD CONSTRAINT `observation_responses_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `validation_executions` ADD CONSTRAINT `validation_executions_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `validation_rules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `validation_executions` ADD CONSTRAINT `validation_executions_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_assessments` ADD CONSTRAINT `risk_assessments_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_assessments` ADD CONSTRAINT `risk_assessments_assessedBy_fkey` FOREIGN KEY (`assessedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_alerts` ADD CONSTRAINT `risk_alerts_riskAssessmentId_fkey` FOREIGN KEY (`riskAssessmentId`) REFERENCES `risk_assessments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_alerts` ADD CONSTRAINT `risk_alerts_acknowledgedBy_fkey` FOREIGN KEY (`acknowledgedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_alerts` ADD CONSTRAINT `risk_alerts_resolvedBy_fkey` FOREIGN KEY (`resolvedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_configurations` ADD CONSTRAINT `system_configurations_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_configurations` ADD CONSTRAINT `system_configurations_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_configurations` ADD CONSTRAINT `system_configurations_approvedBy_fkey` FOREIGN KEY (`approvedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_configuration_history` ADD CONSTRAINT `system_configuration_history_configurationId_fkey` FOREIGN KEY (`configurationId`) REFERENCES `system_configurations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_configuration_history` ADD CONSTRAINT `system_configuration_history_changedBy_fkey` FOREIGN KEY (`changedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_templates` ADD CONSTRAINT `system_templates_submittedBy_fkey` FOREIGN KEY (`submittedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_templates` ADD CONSTRAINT `system_templates_reviewedBy_fkey` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_templates` ADD CONSTRAINT `system_templates_approvedBy_fkey` FOREIGN KEY (`approvedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_templates` ADD CONSTRAINT `system_templates_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_templates` ADD CONSTRAINT `system_templates_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_template_versions` ADD CONSTRAINT `system_template_versions_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `system_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_template_versions` ADD CONSTRAINT `system_template_versions_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_template_tests` ADD CONSTRAINT `system_template_tests_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `system_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_template_tests` ADD CONSTRAINT `system_template_tests_testRunBy_fkey` FOREIGN KEY (`testRunBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `backup_configurations` ADD CONSTRAINT `backup_configurations_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `backup_configurations` ADD CONSTRAINT `backup_configurations_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `backup_jobs` ADD CONSTRAINT `backup_jobs_configurationId_fkey` FOREIGN KEY (`configurationId`) REFERENCES `backup_configurations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `backup_jobs` ADD CONSTRAINT `backup_jobs_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `restoration_jobs` ADD CONSTRAINT `restoration_jobs_backupJobId_fkey` FOREIGN KEY (`backupJobId`) REFERENCES `backup_jobs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `restoration_jobs` ADD CONSTRAINT `restoration_jobs_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `restoration_jobs` ADD CONSTRAINT `restoration_jobs_approvedBy_fkey` FOREIGN KEY (`approvedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_logs` ADD CONSTRAINT `system_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `holiday_calendars` ADD CONSTRAINT `holiday_calendars_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `holiday_calendars` ADD CONSTRAINT `holiday_calendars_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `holidays` ADD CONSTRAINT `holidays_calendarId_fkey` FOREIGN KEY (`calendarId`) REFERENCES `holiday_calendars`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `holidays` ADD CONSTRAINT `holidays_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stage_time_configurations` ADD CONSTRAINT `stage_time_configurations_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stage_time_configurations` ADD CONSTRAINT `stage_time_configurations_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stage_time_configurations` ADD CONSTRAINT `stage_time_configurations_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `security_policies` ADD CONSTRAINT `security_policies_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `security_policies` ADD CONSTRAINT `security_policies_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usage_statistics` ADD CONSTRAINT `usage_statistics_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usage_statistics` ADD CONSTRAINT `usage_statistics_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_health_checks` ADD CONSTRAINT `system_health_checks_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

