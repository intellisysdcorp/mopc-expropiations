# Base de Datos

Documentación completa del esquema de base de datos, modelos, relaciones y migraciones para la Plataforma de Expropiación MOPC.

## 🗄️ Overview

La plataforma utiliza **SQLite** con **Prisma ORM** para la gestión de datos. La base de datos está diseñada para mantener integridad referencial y permitir consultas eficientes con relaciones bien definidas entre todos los modelos.

## 📋 Modelos Principales

### 1. Department (Departamento)

Gestión de departamentos con estructura jerárquica.

```prisma
model Department {
  id          String   @id @default(cuid())
  name        String
  code        String   @unique
  description String?
  parentId    String?
  parent      Department? @relation("DepartmentHierarchy", fields: [parentId], references: [id])
  children    Department[] @relation("DepartmentHierarchy")
  users       User[]
  cases       Case[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("departments")
}
```

**Campos:**
- `id`: Identificador único
- `name`: Nombre del departamento
- `code`: Código único del departamento
- `description`: Descripción opcional
- `parentId`: Referencia al departamento padre (jerarquía)
- `parent`: Relación con departamento padre
- `children`: Relación con departamentos hijos

### 2. User (Usuario)

Gestión de usuarios con roles y asignación departamental.

```prisma
model User {
  id           String       @id @default(cuid())
  email        String       @unique
  name         String
  password     String
  isActive     Boolean      @default(true)
  departmentId String
  department   Department   @relation(fields: [departmentId], references: [id])
  roleId       String
  role         Role         @relation(fields: [roleId], references: [id])
  assignedCases Case[]      @relation("CaseAssignee")
  createdCases  Case[]      @relation("CaseCreator")
  activities    Activity[]
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@map("users")
}
```

**Campos:**
- `id`: Identificador único
- `email`: Correo electrónico (único)
- `name`: Nombre completo del usuario
- `password`: Contraseña hasheada con bcrypt
- `isActive`: Estado del usuario (activo/inactivo)
- `departmentId`: ID del departamento asignado
- `roleId`: ID del rol asignado

### 3. Role (Rol)

Definición de roles con permisos JSON flexible.

```prisma
model Role {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  permissions Json     // Permisos estructurados
  users       User[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("roles")
}
```

**Estructura de Permisos JSON:**
```json
{
  "cases": {
    "create": true,
    "read": true,
    "update": true,
    "delete": false,
    "assign": true
  },
  "users": {
    "create": false,
    "read": true,
    "update": false,
    "delete": false
  },
  "departments": {
    "create": false,
    "read": true,
    "update": false,
    "delete": false
  },
  "reports": {
    "view": true,
    "export": true
  }
}
```

### 4. Case (Caso)

Gestión completa de casos de expropiación con 17 etapas.

```prisma
model Case {
  id              String         @id @default(cuid())
  caseNumber      String         @unique
  title           String
  description     String
  propertyAddress String
  propertyType    String
  ownerName       String
  ownerContact    String?
  estimatedValue  Float?
  currentStage    Int            @default(1)
  priority        CasePriority   @default(MEDIUM)
  status          CaseStatus     @default(ACTIVE)
  departmentId    String
  department      Department     @relation(fields: [departmentId], references: [id])
  creatorId       String
  creator         User           @relation("CaseCreator", fields: [creatorId], references: [id])
  assigneeId      String?
  assignee        User?          @relation("CaseAssignee", fields: [assigneeId], references: [id])
  documents       Document[]
  activities      Activity[]
  history         CaseHistory[]
  technicalMeetings TechnicalMeeting[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@map("cases")
}
```

**Enums:**
```prisma
enum CasePriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum CaseStatus {
  ACTIVE
  ON_HOLD
  COMPLETED
  CANCELLED
}
```

### 5. Document (Documento)

Gestión de documentos con control de versiones.

```prisma
model Document {
  id          String        @id @default(cuid())
  filename    String
  originalName String
  mimeType    String
  size        Int
  path        String
  version     Int           @default(1)
  caseId      String
  case        Case          @relation(fields: [caseId], references: [id])
  uploadedById String
  uploadedBy  User          @relation(fields: [uploadedById], references: [id])
  isRequired  Boolean       @default(false)
  category    DocumentCategory
  tags        String[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@map("documents")
}
```

**Enum de Categorías:**
```prisma
enum DocumentCategory {
  LEGAL
  TECHNICAL
  VALUATION
  OWNERSHIP
  IDENTIFICATION
  CORRESPONDENCE
  OTHER
}
```

### 6. Activity (Actividad)

Registro de auditoría de todas las acciones del sistema.

```prisma
model Activity {
  id          String       @id @default(cuid())
  action      String
  description String?
  entityType  String
  entityId    String
  userId      String
  user        User         @relation(fields: [userId], references: [id])
  metadata    Json?
  createdAt   DateTime     @default(now())

  @@map("activities")
}
```

### 7. CaseHistory (Historial de Casos)

Historial de cambios de estado y transiciones de etapas.

```prisma
model CaseHistory {
  id            String   @id @default(cuid())
  caseId        String
  case          Case     @relation(fields: [caseId], references: [id])
  previousStage Int?
  newStage      Int
  changedBy     String
  reason        String?
  notes         String?
  createdAt     DateTime @default(now())

  @@map("case_history")
}
```

### 8. TechnicalMeeting (Reunión Técnica)

Gestión de reuniones técnicas asociadas a casos.

```prisma
model TechnicalMeeting {
  id          String            @id @default(cuid())
  caseId      String
  case        Case              @relation(fields: [caseId], references: [id])
  title       String
  description String?
  scheduledDate DateTime
  location    String?
  status      MeetingStatus     @default(SCHEDULED)
  attendees   String[]          // IDs de usuarios asistentes
  minutes     String?           // Acta de la reunión
  createdBy   String
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@map("technical_meetings")
}
```

## 🔄 Relaciones Entre Modelos

### Diagrama de Relaciones

```
Department (1) ──── (N) User
    │                     │
    │                     │
    └── (1) ──── (N) Case └─── (1) Creator
          │                     │
          │                     │
          └── (1) ──── (N) Document ──── (N) UploadedBy
          │
          └── (1) ──── (N) Activity
          │
          └── (1) ──── (N) CaseHistory
          │
          └── (1) ──── (N) TechnicalMeeting

Role (1) ──── (N) User
```

### Relaciones Detalladas

1. **Department → User**: Un departamento puede tener múltiples usuarios
2. **Department → Case**: Un departamento gestiona múltiples casos
3. **User → Case**: Un usuario puede crear múltiples casos y ser asignado a múltiples
4. **Role → User**: Un rol puede ser asignado a múltiples usuarios
5. **Case → Document**: Un caso puede tener múltiples documentos
6. **Case → Activity**: Un caso genera múltiples actividades de auditoría
7. **Case → CaseHistory**: Un caso tiene un historial completo de cambios

## 🛠️ Gestión de Migraciones

### Comandos de Migración

```bash
# Crear nueva migración
npx prisma migrate dev --name nombre_de_la_migracion

# Aplicar migraciones pendientes
npx prisma migrate deploy

# Resetear base de datos (¡cuidado!)
npx prisma migrate reset

# Ver estado de migraciones
npx prisma migrate status
```

### Estructura de Migraciones

Las migraciones se guardan en `prisma/migrations/`:

```
prisma/migrations/
├── 20231001000000_init/
│   ├── migration.sql
│   └── README.md
├── 20231002000000_add_roles/
│   ├── migration.sql
│   └── README.md
└── migration_lock.toml
```

## 📊 Seed de Datos Iniciales

### Datos de Ejemplo

El archivo `prisma/seed.ts` llena la base de datos con:

1. **Departamentos**:
   - Dirección General de Expropiación
   - Departamento Legal
   - Departamento Técnico
   - Departamento de Avalúos

2. **Roles Predefinidos**:
   - Super Admin
   - Department Admin
   - Analyst
   - Supervisor
   - Observer
   - Technical Meeting Coordinator

3. **Usuarios Iniciales**:
   - admin@mopc.gob.do (Super Admin)
   - dept.admin@mopc.gob.do (Department Admin)
   - analyst@mopc.gob.do (Analyst)

### Ejecutar Seed

```bash
# Poblar base de datos con datos iniciales
npm run db:seed

# O directamente con Prisma
npx prisma db seed
```

## 🔍 Consultas Útiles

### Consultas Básicas

```typescript
// Obtener todos los casos con sus relaciones
const cases = await prisma.case.findMany({
  include: {
    department: true,
    creator: true,
    assignee: true,
    documents: true,
    _count: {
      select: {
        activities: true,
        history: true
      }
    }
  }
});

// Obtener usuarios por departamento
const usersByDept = await prisma.user.findMany({
  where: {
    departmentId: 'dept-id',
    isActive: true
  },
  include: {
    role: true,
    department: true
  }
});

// Obtener historial de un caso
const caseHistory = await prisma.caseHistory.findMany({
  where: {
    caseId: 'case-id'
  },
  orderBy: {
    createdAt: 'desc'
  },
  include: {
    case: true
  }
});
```

### Consultas Avanzadas

```typescript
// Casos por etapa y departamento
const casesByStageDept = await prisma.case.groupBy({
  by: ['currentStage', 'departmentId'],
  _count: {
    id: true
  }
});

// Actividades recientes de un usuario
const recentActivities = await prisma.activity.findMany({
  where: {
    userId: 'user-id'
  },
  orderBy: {
    createdAt: 'desc'
  },
  take: 10,
  include: {
    user: {
      select: {
        name: true,
        email: true
      }
    }
  }
});

// Búsqueda de casos por texto
const searchCases = await prisma.case.findMany({
  where: {
    OR: [
      { title: { contains: 'search-term', mode: 'insensitive' } },
      { description: { contains: 'search-term', mode: 'insensitive' } },
      { propertyAddress: { contains: 'search-term', mode: 'insensitive' } },
      { ownerName: { contains: 'search-term', mode: 'insensitive' } }
    ]
  }
});
```

## 🔧 Configuración de Prisma

### Archivo de Configuración

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

### Cliente Prisma

`src/lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

## 📈 Optimización de Consultas

### Índices Recomendados

```sql
-- Índices para búsquedas frecuentes
CREATE INDEX idx_cases_department ON cases(departmentId);
CREATE INDEX idx_cases_assignee ON cases(assigneeId);
CREATE INDEX idx_cases_stage ON cases(currentStage);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_activities_user ON activities(userId);
CREATE INDEX idx_activities_entity ON activities(entityType, entityId);
CREATE INDEX idx_documents_case ON documents(caseId);
CREATE INDEX idx_history_case ON case_history(caseId);
```

### Buenas Prácticas

1. **Usar `select`** para limitar campos retornados
2. **Usar `include`** solo para relaciones necesarias
3. **Implementar paginación** para consultas grandes
4. **Usar transacciones** para operaciones múltiples
5. **Evitar N+1 queries** con consultas optimizadas

## 🛡️ Seguridad de Datos

### Consideraciones de Seguridad

1. **Passwords**: Hasheadas con bcrypt (12 rounds)
2. **PII**: Información personal identificable encriptada
3. **Audit Trail**: Todas las acciones logged en `Activity`
4. **Row Level Security**: Implementado a nivel de aplicación
5. **Backups**: Regulares de la base de datos SQLite

### Manejo de Datos Sensibles

```typescript
// Ejemplo: Excluir passwords en consultas
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
    department: true,
    role: true,
    // password excluido explícitamente
  }
});
```

---

**Más información**: Consulta la [documentación de Prisma](https://www.prisma.io/docs) para más detalles sobre consultas avanzadas y optimización.